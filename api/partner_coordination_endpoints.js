/**
 * Partner Coordination API Endpoints
 * 
 * This module provides comprehensive partner coordination functionality including:
 * 1. Availability overlap detection
 * 2. Session suggestion algorithms  
 * 3. Partner request management
 * 4. Session proposal workflows
 * 5. Dual notification system
 */

const { createClient } = require('@supabase/supabase-js');

class PartnerCoordinationAPI {
    constructor(supabase) {
        this.supabase = supabase;
    }

    // ========================================
    // AVAILABILITY OVERLAP DETECTION
    // ========================================

    /**
     * Find overlapping availability between two partners
     * Returns slots with minimum 2-hour overlap
     */
    async findCommonAvailability(user1Email, user2Email) {
        console.log(`Finding common availability between ${user1Email} and ${user2Email}`);

        try {
            // Get both users' data and availability
            const [user1Result, user2Result] = await Promise.all([
                this.getUserWithAvailability(user1Email),
                this.getUserWithAvailability(user2Email)
            ]);

            if (!user1Result.success || !user2Result.success) {
                return {
                    success: false,
                    error: `Failed to load user data: ${user1Result.error || user2Result.error}`
                };
            }

            const user1 = user1Result.data;
            const user2 = user2Result.data;

            // Find overlapping slots
            const overlappingSlots = this.calculateOverlappingSlots(user1.availability, user2.availability);
            
            // Filter for minimum 2-hour slots
            const validSlots = overlappingSlots.filter(slot => slot.duration >= 4); // 4 half-hour slots = 2 hours

            console.log(`Found ${validSlots.length} valid overlapping slots (2+ hours)`);

            return {
                success: true,
                data: {
                    user1: {
                        id: user1.id,
                        name: user1.name, 
                        email: user1.email,
                        availabilityCount: user1.availability.length
                    },
                    user2: {
                        id: user2.id,
                        name: user2.name,
                        email: user2.email, 
                        availabilityCount: user2.availability.length
                    },
                    overlappingSlots: validSlots,
                    totalOverlapHours: validSlots.reduce((sum, slot) => sum + (slot.duration * 0.5), 0)
                }
            };

        } catch (error) {
            console.error('Error finding common availability:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Get user with their availability slots
     */
    async getUserWithAvailability(email) {
        try {
            // Get user
            const { data: user, error: userError } = await this.supabase
                .from('users')
                .select('id, name, email, partner_id')
                .eq('email', email)
                .single();

            if (userError || !user) {
                return { success: false, error: 'User not found' };
            }

            // Get availability
            const { data: availability, error: availError } = await this.supabase
                .from('availability')
                .select('*')
                .eq('user_id', user.id)
                .order('day', { ascending: true })
                .order('start_time', { ascending: true });

            if (availError) {
                return { success: false, error: availError.message };
            }

            return {
                success: true,
                data: {
                    ...user,
                    availability: availability || []
                }
            };

        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    /**
     * Calculate overlapping time slots between two availability arrays
     */
    calculateOverlappingSlots(avail1, avail2) {
        const overlaps = [];
        const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

        // Group availability by day
        const avail1ByDay = this.groupAvailabilityByDay(avail1);
        const avail2ByDay = this.groupAvailabilityByDay(avail2);

        // Find overlaps for each day
        dayNames.forEach(day => {
            const user1Slots = avail1ByDay[day] || [];
            const user2Slots = avail2ByDay[day] || [];

            user1Slots.forEach(slot1 => {
                user2Slots.forEach(slot2 => {
                    const overlap = this.findSlotOverlap(slot1, slot2, day);
                    if (overlap) {
                        overlaps.push(overlap);
                    }
                });
            });
        });

        // Merge adjacent/overlapping slots on same day
        return this.mergeAdjacentSlots(overlaps);
    }

    /**
     * Group availability slots by day
     */
    groupAvailabilityByDay(availability) {
        const byDay = {};
        availability.forEach(slot => {
            if (!byDay[slot.day]) {
                byDay[slot.day] = [];
            }
            byDay[slot.day].push(slot);
        });
        return byDay;
    }

    /**
     * Find overlap between two time slots on the same day
     */
    findSlotOverlap(slot1, slot2, day) {
        const overlapStart = Math.max(slot1.start_time, slot2.start_time);
        const overlapEnd = Math.min(slot1.end_time, slot2.end_time);

        if (overlapStart < overlapEnd) {
            return {
                day: day,
                dayIndex: this.getDayIndex(day),
                startTime: overlapStart,
                endTime: overlapEnd,
                duration: overlapEnd - overlapStart, // In half-hour slots
                displayStart: this.formatTime(overlapStart),
                displayEnd: this.formatTime(overlapEnd)
            };
        }
        return null;
    }

    /**
     * Merge adjacent or overlapping slots on the same day
     */
    mergeAdjacentSlots(slots) {
        if (slots.length <= 1) return slots;

        // Sort by day then start time
        slots.sort((a, b) => {
            if (a.dayIndex !== b.dayIndex) return a.dayIndex - b.dayIndex;
            return a.startTime - b.startTime;
        });

        const merged = [];
        let current = slots[0];

        for (let i = 1; i < slots.length; i++) {
            const next = slots[i];

            // If same day and adjacent/overlapping
            if (current.dayIndex === next.dayIndex && current.endTime >= next.startTime) {
                // Merge slots
                current.endTime = Math.max(current.endTime, next.endTime);
                current.duration = current.endTime - current.startTime;
                current.displayEnd = this.formatTime(current.endTime);
            } else {
                merged.push(current);
                current = next;
            }
        }
        merged.push(current);

        return merged;
    }

    // ========================================
    // SESSION SUGGESTION ALGORITHM
    // ========================================

    /**
     * Generate optimal session suggestions from overlapping slots
     * Returns exactly 2 sessions on non-consecutive days
     */
    generateSessionSuggestions(overlappingSlots, partnerIds) {
        console.log(`Generating session suggestions from ${overlappingSlots.length} overlapping slots`);

        if (overlappingSlots.length === 0) {
            return {
                success: true,
                suggestions: [],
                message: "No overlapping availability found"
            };
        }

        // Filter slots that can accommodate 2-hour sessions
        const viableSlots = overlappingSlots.filter(slot => slot.duration >= 4);

        if (viableSlots.length === 0) {
            return {
                success: true,
                suggestions: [],
                message: "No overlapping slots with sufficient duration (2 hours minimum)"
            };
        }

        // Score and rank slots
        const scoredSlots = viableSlots.map(slot => ({
            ...slot,
            score: this.calculateSlotScore(slot)
        })).sort((a, b) => b.score - a.score);

        // Select 2 optimal sessions on non-consecutive days
        const suggestions = this.selectOptimalSessions(scoredSlots, partnerIds);

        return {
            success: true,
            suggestions: suggestions,
            totalViableSlots: viableSlots.length,
            message: suggestions.length === 2 ? 
                "Found 2 optimal session suggestions" : 
                `Found ${suggestions.length} session suggestion(s)`
        };
    }

    /**
     * Calculate quality score for a time slot
     * Higher scores for better times (not too early, not too late)
     */
    calculateSlotScore(slot) {
        let score = 0;

        // Base score from duration (longer is better, up to a point)
        score += Math.min(slot.duration, 8) * 10; // Cap at 4 hours

        // Time preference scoring (higher score for good times)
        const startHour = Math.floor(slot.startTime / 2);
        
        if (startHour >= 6 && startHour <= 8) score += 20; // Morning preferred
        else if (startHour >= 9 && startHour <= 11) score += 25; // Late morning best
        else if (startHour >= 17 && startHour <= 19) score += 20; // Evening preferred  
        else if (startHour >= 20 && startHour <= 21) score += 15; // Night okay
        else if (startHour < 6 || startHour > 22) score -= 20; // Very early/late penalized

        // Weekend bonus
        if (slot.dayIndex === 0 || slot.dayIndex === 6) score += 15;

        // Mid-week bonus (Tuesday-Thursday)
        if (slot.dayIndex >= 2 && slot.dayIndex <= 4) score += 10;

        return score;
    }

    /**
     * Select 2 optimal sessions ensuring non-consecutive days
     */
    selectOptimalSessions(scoredSlots, partnerIds) {
        const suggestions = [];
        const usedDays = new Set();

        for (const slot of scoredSlots) {
            // Skip if this day is already used or adjacent to used day
            const dayIndex = slot.dayIndex;
            let canUseDay = !usedDays.has(dayIndex);
            
            // Check adjacent days
            if (canUseDay) {
                for (const usedDay of usedDays) {
                    if (Math.abs(dayIndex - usedDay) === 1 || 
                        (dayIndex === 0 && usedDay === 6) || 
                        (dayIndex === 6 && usedDay === 0)) {
                        canUseDay = false;
                        break;
                    }
                }
            }

            if (canUseDay) {
                // Create 2-hour session in the middle of the available slot
                const sessionDuration = 4; // 2 hours = 4 half-hour slots
                const maxStartTime = slot.endTime - sessionDuration;
                const optimalStartTime = Math.max(slot.startTime, maxStartTime);

                const suggestion = {
                    id: `suggestion_${Date.now()}_${dayIndex}`,
                    day: slot.day,
                    dayIndex: dayIndex,
                    date: this.getNextDate(dayIndex), // Get next occurrence of this day
                    startTime: optimalStartTime,
                    endTime: optimalStartTime + sessionDuration,
                    duration: sessionDuration,
                    displayStart: this.formatTime(optimalStartTime),
                    displayEnd: this.formatTime(optimalStartTime + sessionDuration),
                    participants: partnerIds,
                    score: slot.score,
                    availableRange: {
                        start: this.formatTime(slot.startTime),
                        end: this.formatTime(slot.endTime)
                    }
                };

                suggestions.push(suggestion);
                usedDays.add(dayIndex);

                // Stop when we have 2 suggestions
                if (suggestions.length >= 2) break;
            }
        }

        return suggestions;
    }

    // ========================================
    // UTILITY FUNCTIONS
    // ========================================

    getDayIndex(dayName) {
        const days = { 'sunday': 0, 'monday': 1, 'tuesday': 2, 'wednesday': 3, 'thursday': 4, 'friday': 5, 'saturday': 6 };
        return days[dayName.toLowerCase()] || 0;
    }

    formatTime(halfHourSlot) {
        const hours = Math.floor(halfHourSlot / 2);
        const minutes = (halfHourSlot % 2) * 30;
        return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
    }

    getNextDate(dayIndex) {
        const today = new Date();
        const currentDay = today.getDay();
        let daysUntil = dayIndex - currentDay;
        
        if (daysUntil <= 0) daysUntil += 7; // Next week if day has passed
        
        const targetDate = new Date(today);
        targetDate.setDate(today.getDate() + daysUntil);
        
        return targetDate.toISOString().split('T')[0]; // YYYY-MM-DD format
    }

    // ========================================
    // PARTNER DISCOVERY & MANAGEMENT
    // ========================================

    /**
     * Find partner by email or Telegram ID
     */
    async findPartnerByIdentifier(identifier) {
        try {
            // First try by email
            let { data: user, error } = await this.supabase
                .from('users')
                .select('id, name, email, telegram_id, partner_id')
                .eq('email', identifier)
                .single();

            // If not found by email, try by Telegram ID
            if (error && identifier.match(/^\d+$/)) {
                const { data: telegramUser, error: telegramError } = await this.supabase
                    .from('users')
                    .select('id, name, email, telegram_id, partner_id')
                    .eq('telegram_id', identifier)
                    .single();

                if (!telegramError && telegramUser) {
                    user = telegramUser;
                    error = null;
                }
            }

            if (error || !user) {
                return { success: false, error: 'User not found' };
            }

            return {
                success: true,
                data: {
                    id: user.id,
                    name: user.name,
                    email: user.email,
                    telegramId: user.telegram_id,
                    hasPartner: !!user.partner_id,
                    partnerId: user.partner_id
                }
            };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    /**
     * Send partner request (enhanced with Telegram ID support)
     */
    async sendPartnerRequest(requesterIdentifier, targetIdentifier, message = '') {
        try {
            // Get both users (supports email and Telegram ID)
            const [requesterResult, targetResult] = await Promise.all([
                this.findPartnerByIdentifier(requesterIdentifier),
                this.findPartnerByIdentifier(targetIdentifier)
            ]);

            if (!requesterResult.success) {
                return { success: false, error: 'Requester not found' };
            }
            if (!targetResult.success) {
                return { success: false, error: 'Target user not found' };
            }

            const requester = requesterResult.data;
            const target = targetResult.data;


            // Check if they're already partners
            if (requester.partnerId === target.id) {
                return { success: false, error: 'Users are already partners' };
            }

            // Check for existing request
            const { data: existingRequest } = await this.supabase
                .from('partner_requests')
                .select('*')
                .or(`and(requester_id.eq.${requester.id},requested_user_id.eq.${target.id}),and(requester_id.eq.${target.id},requested_user_id.eq.${requester.id})`)
                .eq('status', 'pending')
                .single();

            if (existingRequest) {
                return { success: false, error: 'Partner request already exists' };
            }

            // Create partner request
            const { data: request, error } = await this.supabase
                .from('partner_requests')
                .insert({
                    requester_id: requester.id,
                    requested_user_id: target.id,
                    message: message
                })
                .select()
                .single();

            if (error) {
                return { success: false, error: error.message };
            }

            return {
                success: true,
                data: request,
                message: `Partner request sent to ${target.name}`,
                requester,
                target
            };

        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    /**
     * Respond to partner request (accept/reject)
     */
    async respondToPartnerRequest(requestId, userEmail, response, message = '') {
        try {
            if (!['accepted', 'rejected'].includes(response)) {
                return { success: false, error: 'Invalid response. Use "accepted" or "rejected"' };
            }

            // Get user
            const userResult = await this.getUserWithAvailability(userEmail);
            if (!userResult.success) {
                return { success: false, error: 'User not found' };
            }

            // Get and validate request
            const { data: request, error: requestError } = await this.supabase
                .from('partner_requests')
                .select('*, requester:requester_id(name, email), requested:requested_user_id(name, email)')
                .eq('id', requestId)
                .eq('status', 'pending')
                .single();

            if (requestError || !request) {
                return { success: false, error: 'Partner request not found or already processed' };
            }

            // Verify user can respond to this request
            if (request.requested_user_id !== userResult.data.id) {
                return { success: false, error: 'Not authorized to respond to this request' };
            }

            // Update request status
            const { error: updateError } = await this.supabase
                .from('partner_requests')
                .update({
                    status: response,
                    response_message: message,
                    responded_at: new Date().toISOString()
                })
                .eq('id', requestId);

            if (updateError) {
                return { success: false, error: updateError.message };
            }

            // If accepted, link partners and create coordination state
            if (response === 'accepted') {
                await this.linkPartners(request.requester_id, request.requested_user_id);
            }

            return {
                success: true,
                message: `Partner request ${response}`,
                partnersLinked: response === 'accepted'
            };

        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    /**
     * Link two users as partners
     */
    async linkPartners(userId1, userId2) {
        try {
            // Update both users' partner_id
            const updates = [
                this.supabase.from('users').update({ partner_id: userId2 }).eq('id', userId1),
                this.supabase.from('users').update({ partner_id: userId1 }).eq('id', userId2)
            ];

            await Promise.all(updates);

            // Create coordination state
            const { data: coordination } = await this.supabase
                .from('coordination_states')
                .insert({
                    partner_1_id: userId1 < userId2 ? userId1 : userId2,
                    partner_2_id: userId1 < userId2 ? userId2 : userId1,
                    state: 'waiting_availability'
                })
                .select()
                .single();

            console.log(`Partners linked: ${userId1} <-> ${userId2}, coordination state: ${coordination?.id}`);

        } catch (error) {
            console.error('Error linking partners:', error);
            throw error;
        }
    }

    // ========================================
    // SESSION PROPOSAL MANAGEMENT
    // ========================================

    /**
     * Create session proposal
     */
    async createSessionProposal(proposerEmail, proposedDate, startTime, endTime, message = '') {
        try {
            // Get proposer and their partner
            const proposerResult = await this.getUserWithAvailability(proposerEmail);
            if (!proposerResult.success || !proposerResult.data.partner_id) {
                return { success: false, error: 'User not found or has no partner' };
            }

            const proposer = proposerResult.data;
            const partnerId = proposer.partner_id;

            // Validate session duration (minimum 2 hours)
            if (endTime - startTime < 4) {
                return { success: false, error: 'Session must be at least 2 hours long' };
            }

            // Create proposal
            const { data: proposal, error } = await this.supabase
                .from('session_proposals')
                .insert({
                    proposer_id: proposer.id,
                    partner_id: partnerId,
                    proposed_date: proposedDate,
                    proposed_start_time: startTime,
                    proposed_end_time: endTime,
                    response_message: message
                })
                .select()
                .single();

            if (error) {
                return { success: false, error: error.message };
            }

            return {
                success: true,
                data: proposal,
                message: 'Session proposal created'
            };

        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    /**
     * Respond to session proposal
     */
    async respondToSessionProposal(proposalId, userEmail, response, message = '') {
        try {
            if (!['accepted', 'rejected', 'counter_proposed'].includes(response)) {
                return { success: false, error: 'Invalid response' };
            }

            const userResult = await this.getUserWithAvailability(userEmail);
            if (!userResult.success) {
                return { success: false, error: 'User not found' };
            }

            // Get proposal
            const { data: proposal, error: proposalError } = await this.supabase
                .from('session_proposals')
                .select('*')
                .eq('id', proposalId)
                .eq('status', 'pending')
                .single();

            if (proposalError || !proposal) {
                return { success: false, error: 'Proposal not found or already processed' };
            }

            // Verify user can respond
            if (proposal.partner_id !== userResult.data.id) {
                return { success: false, error: 'Not authorized to respond to this proposal' };
            }

            // Update proposal
            const { error: updateError } = await this.supabase
                .from('session_proposals')
                .update({
                    status: response,
                    response_message: message,
                    responded_at: new Date().toISOString()
                })
                .eq('id', proposalId);

            if (updateError) {
                return { success: false, error: updateError.message };
            }

            // If accepted, create actual session
            if (response === 'accepted') {
                const sessionResult = await this.createSessionFromProposal(proposal);
                return {
                    success: true,
                    message: 'Proposal accepted and session created',
                    session: sessionResult.data
                };
            }

            return {
                success: true,
                message: `Proposal ${response.replace('_', ' ')}`
            };

        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    /**
     * Create actual session from accepted proposal
     */
    async createSessionFromProposal(proposal) {
        try {
            const { data: session, error } = await this.supabase
                .from('sessions')
                .insert({
                    participants: [proposal.proposer_id, proposal.partner_id],
                    date: proposal.proposed_date,
                    start_time: proposal.proposed_start_time,
                    end_time: proposal.proposed_end_time,
                    status: 'confirmed',
                    proposal_id: proposal.id,
                    both_partners_confirmed: true
                })
                .select()
                .single();

            if (error) {
                return { success: false, error: error.message };
            }

            // Link session back to proposal
            await this.supabase
                .from('session_proposals')
                .update({ session_id: session.id })
                .eq('id', proposal.id);

            return { success: true, data: session };

        } catch (error) {
            return { success: false, error: error.message };
        }
    }
}

module.exports = PartnerCoordinationAPI;