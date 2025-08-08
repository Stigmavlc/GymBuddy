const { createClient } = require('@supabase/supabase-js');

class DatabaseService {
  constructor(supabaseUrl, supabaseKey) {
    this.supabase = createClient(supabaseUrl, supabaseKey);
  }

  // Get user by telegram_id
  async getUserByTelegramId(telegramId) {
    try {
      // CRITICAL FIX: Convert to string to avoid Supabase type issues
      const telegramIdString = String(telegramId);
      console.log('DatabaseService: Looking up user with Telegram ID:', telegramId, typeof telegramId, 'converted to:', telegramIdString);
      
      // Try without .single() first to avoid PGRST116 issues
      const { data, error } = await this.supabase
        .from('users')
        .select('*')
        .eq('telegram_id', telegramIdString);

      console.log('DatabaseService: Query result - data:', data, 'error:', error);

      if (error) {
        console.error('DatabaseService: Error fetching user:', error);
        return null;
      }

      if (!data || data.length === 0) {
        console.log('DatabaseService: No user found with Telegram ID:', telegramIdString);
        return null;
      }

      const userData = data[0]; // Get first result
      console.log('DatabaseService: Successfully found user:', userData?.name || 'Unknown');
      return userData;
    } catch (error) {
      console.error('DatabaseService: Database error:', error);
      return null;
    }
  }

  // Update user's last_active timestamp
  async updateUserActivity(telegramId) {
    try {
      const { data, error } = await this.supabase
        .from('users')
        .update({ last_active: new Date().toISOString() })
        .eq('telegram_id', telegramId);

      if (error) {
        console.error('Error updating user activity:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Database error:', error);
      return false;
    }
  }

  // Get user availability (aggregated)
  async getUserAvailability(userId) {
    try {
      const { data, error } = await this.supabase
        .from('availability')
        .select('*')
        .eq('user_id', userId)
        .order('day');

      if (error) {
        console.error('Error fetching availability:', error);
        return [];
      }

      // Format availability for better readability
      const formattedAvailability = data.map(slot => ({
        day: slot.day,
        startTime: slot.start_time,
        endTime: slot.end_time,
        displayTime: `${this.formatHour(slot.start_time)} - ${this.formatHour(slot.end_time)}`
      }));

      return formattedAvailability;
    } catch (error) {
      console.error('Database error:', error);
      return [];
    }
  }

  // Store chat message
  async storeChatMessage(userId, messageText, messageType = 'user_message', sessionContext = {}) {
    try {
      const { data, error } = await this.supabase
        .from('chat_history')
        .insert([{
          user_id: userId,
          message_text: messageText,
          message_type: messageType,
          session_context: sessionContext,
          timestamp: new Date().toISOString()
        }]);

      if (error) {
        console.error('Error storing chat message:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Database error:', error);
      return false;
    }
  }

  // Store bot response
  async storeBotResponse(userId, responseText, sessionContext = {}) {
    return this.storeChatMessage(userId, responseText, 'bot_response', sessionContext);
  }

  // Get chat history
  async getChatHistory(userId, limit = 10) {
    try {
      const { data, error } = await this.supabase
        .from('chat_history')
        .select('*')
        .eq('user_id', userId)
        .order('timestamp', { ascending: false })
        .limit(limit);

      if (error) {
        console.error('Error fetching chat history:', error);
        return [];
      }

      // Reverse to get chronological order
      return data.reverse();
    } catch (error) {
      console.error('Database error:', error);
      return [];
    }
  }

  // Get partner information
  async getPartnerInfo(userId) {
    try {
      // First get the user to find their partner_id
      const { data: userData, error: userError } = await this.supabase
        .from('users')
        .select('partner_id')
        .eq('id', userId)
        .single();

      if (userError || !userData?.partner_id) {
        console.error('Error fetching user partner_id:', userError);
        return null;
      }

      // Then get the partner's information
      const { data: partnerData, error: partnerError } = await this.supabase
        .from('users')
        .select('*')
        .eq('id', userData.partner_id)
        .single();

      if (partnerError) {
        console.error('Error fetching partner info:', partnerError);
        return null;
      }

      return partnerData;
    } catch (error) {
      console.error('Database error:', error);
      return null;
    }
  }

  // Get partner availability
  async getPartnerAvailability(partnerId) {
    return this.getUserAvailability(partnerId);
  }

  // Find overlapping availability slots
  async findOverlappingSlots(userId) {
    try {
      const partnerInfo = await this.getPartnerInfo(userId);
      if (!partnerInfo) {
        return { overlap: [], userAvailability: [], partnerAvailability: [] };
      }

      const [userAvailability, partnerAvailability] = await Promise.all([
        this.getUserAvailability(userId),
        this.getUserAvailability(partnerInfo.id)
      ]);

      // Find overlapping slots
      const overlap = [];
      
      userAvailability.forEach(userSlot => {
        partnerAvailability.forEach(partnerSlot => {
          if (userSlot.day === partnerSlot.day) {
            // Check if times overlap
            const overlapStart = Math.max(userSlot.startTime, partnerSlot.startTime);
            const overlapEnd = Math.min(userSlot.endTime, partnerSlot.endTime);
            
            if (overlapStart < overlapEnd) {
              overlap.push({
                day: userSlot.day,
                startTime: overlapStart,
                endTime: overlapEnd,
                displayTime: `${this.formatHour(overlapStart)} - ${this.formatHour(overlapEnd)}`
              });
            }
          }
        });
      });

      return {
        overlap,
        userAvailability,
        partnerAvailability,
        partnerName: partnerInfo.name
      };
    } catch (error) {
      console.error('Error finding overlapping slots:', error);
      return { overlap: [], userAvailability: [], partnerAvailability: [] };
    }
  }

  // Helper function to format hours
  formatHour(hour) {
    if (hour === 0) return '12:00 AM';
    if (hour === 12) return '12:00 PM';
    if (hour < 12) return `${hour}:00 AM`;
    if (hour < 24) return `${hour - 12}:00 PM`;
    return `${hour - 24}:00 AM (next day)`;
  }

  // Create a gym session
  async createSession(participants, date, startTime, endTime) {
    try {
      console.log('DatabaseService: Creating session with:', {
        participants,
        date, 
        start_time: startTime,
        end_time: endTime,
        status: 'confirmed'
      });

      const { data, error } = await this.supabase
        .from('sessions')
        .insert([{
          participants,
          date,
          start_time: startTime,
          end_time: endTime,
          status: 'confirmed'
        }])
        .select();

      if (error) {
        console.error('DatabaseService: Error creating session:', error);
        return null;
      }

      console.log('DatabaseService: ✅ Session created successfully:', data);
      return data;
    } catch (error) {
      console.error('DatabaseService: Database error during session creation:', error);
      return null;
    }
  }

  // Get upcoming sessions for a user
  async getUpcomingSessions(userId, limit = 5) {
    try {
      const today = new Date().toISOString().split('T')[0];
      console.log('DatabaseService: Getting upcoming sessions for user:', userId, 'from date:', today);
      
      // First, try to get all sessions for debugging
      const { data: allData, error: allError } = await this.supabase
        .from('sessions')
        .select('*')
        .contains('participants', [userId]);

      console.log('DatabaseService: All sessions for user:', allData?.length || 0);
      if (allData && allData.length > 0) {
        console.log('DatabaseService: All sessions:', allData.map(s => ({
          id: s.id.substring(0, 8),
          date: s.date,
          time: `${s.start_time}-${s.end_time}`,
          status: s.status
        })));
      }

      // Now get filtered upcoming sessions
      const { data, error } = await this.supabase
        .from('sessions')
        .select('*')
        .contains('participants', [userId])
        .gte('date', today)
        .eq('status', 'confirmed') // Only get confirmed sessions
        .order('date', { ascending: true })
        .order('start_time', { ascending: true })
        .limit(limit);

      if (error) {
        console.error('DatabaseService: Error fetching upcoming sessions:', error);
        return [];
      }

      console.log('DatabaseService: Found', data?.length || 0, 'upcoming confirmed sessions');
      if (data && data.length > 0) {
        console.log('DatabaseService: Upcoming sessions:', data.map(s => ({
          date: s.date,
          time: `${s.start_time}-${s.end_time}`,
          status: s.status
        })));
      }

      return data || [];
    } catch (error) {
      console.error('DatabaseService: Database error in getUpcomingSessions:', error);
      return [];
    }
  }

  // === PENDING SESSIONS MANAGEMENT ===

  // Create a pending session proposal
  async createPendingSession(proposalData) {
    try {
      const { proposedBy, proposedTo, date, startTime, endTime, message } = proposalData;
      
      const pendingSession = {
        proposed_by: proposedBy.id,
        proposed_to: proposedTo.id,
        date,
        start_time: startTime,
        end_time: endTime,
        status: 'pending',
        proposer_confirmed: true,
        partner_confirmed: false,
        message,
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 hours
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      console.log('DatabaseService: Creating pending session:', pendingSession);

      const { data, error } = await this.supabase
        .from('pending_sessions')
        .insert([pendingSession])
        .select()
        .single();

      if (error) {
        console.error('DatabaseService: Error creating pending session:', error);
        return null;
      }

      console.log('DatabaseService: ✅ Pending session created:', data.id);
      return data;
    } catch (error) {
      console.error('DatabaseService: Database error during pending session creation:', error);
      return null;
    }
  }

  // Get a pending session by ID
  async getPendingSession(sessionId) {
    try {
      const { data, error } = await this.supabase
        .from('pending_sessions')
        .select(`
          *,
          proposer:proposed_by(id, name, telegram_id),
          proposed_to_user:proposed_to(id, name, telegram_id)
        `)
        .eq('id', sessionId)
        .single();

      if (error) {
        console.error('DatabaseService: Error fetching pending session:', error);
        return null;
      }

      return data;
    } catch (error) {
      console.error('DatabaseService: Database error:', error);
      return null;
    }
  }

  // Get pending sessions for a user
  async getPendingSessionsForUser(userId) {
    try {
      const { data, error } = await this.supabase
        .from('pending_sessions')
        .select(`
          *,
          proposer:proposed_by(id, name, telegram_id),
          proposed_to_user:proposed_to(id, name, telegram_id)
        `)
        .or(`proposed_by.eq.${userId},proposed_to.eq.${userId}`)
        .in('status', ['pending', 'counter_proposed'])
        .order('created_at', { ascending: false });

      if (error) {
        console.error('DatabaseService: Error fetching pending sessions:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('DatabaseService: Database error:', error);
      return [];
    }
  }

  // Update pending session status
  async updatePendingSession(sessionId, updates) {
    try {
      const updateData = {
        ...updates,
        updated_at: new Date().toISOString()
      };

      console.log('DatabaseService: Updating pending session:', sessionId, updateData);

      const { data, error } = await this.supabase
        .from('pending_sessions')
        .update(updateData)
        .eq('id', sessionId)
        .select()
        .single();

      if (error) {
        console.error('DatabaseService: Error updating pending session:', error);
        return null;
      }

      console.log('DatabaseService: ✅ Pending session updated:', sessionId);
      return data;
    } catch (error) {
      console.error('DatabaseService: Database error:', error);
      return null;
    }
  }

  // Accept a pending session and create actual session
  async acceptPendingSession(sessionId) {
    try {
      // Get the pending session first
      const pendingSession = await this.getPendingSession(sessionId);
      if (!pendingSession) {
        return { error: 'Pending session not found' };
      }

      // Create the actual session
      const confirmedSession = await this.createSession(
        [pendingSession.proposed_by, pendingSession.proposed_to],
        pendingSession.date,
        pendingSession.start_time,
        pendingSession.end_time
      );

      if (!confirmedSession) {
        return { error: 'Failed to create confirmed session' };
      }

      // Update pending session status
      await this.updatePendingSession(sessionId, {
        status: 'accepted',
        partner_confirmed: true
      });

      console.log('DatabaseService: ✅ Pending session accepted and confirmed session created');
      return { success: true, sessionId: confirmedSession[0]?.id };
    } catch (error) {
      console.error('DatabaseService: Error accepting pending session:', error);
      return { error: 'Database error during session acceptance' };
    }
  }

  // Decline a pending session
  async declinePendingSession(sessionId) {
    try {
      const result = await this.updatePendingSession(sessionId, {
        status: 'declined'
      });

      if (!result) {
        return { error: 'Failed to decline session' };
      }

      console.log('DatabaseService: ✅ Pending session declined:', sessionId);
      return { success: true };
    } catch (error) {
      console.error('DatabaseService: Error declining pending session:', error);
      return { error: 'Database error during session decline' };
    }
  }

  // Clean up expired pending sessions
  async cleanupExpiredPendingSessions() {
    try {
      const { data, error } = await this.supabase
        .from('pending_sessions')
        .update({ status: 'expired' })
        .eq('status', 'pending')
        .lt('expires_at', new Date().toISOString())
        .select();

      if (error) {
        console.error('DatabaseService: Error cleaning up expired sessions:', error);
        return 0;
      }

      const expiredCount = data?.length || 0;
      if (expiredCount > 0) {
        console.log(`DatabaseService: ✅ Cleaned up ${expiredCount} expired pending sessions`);
      }

      return expiredCount;
    } catch (error) {
      console.error('DatabaseService: Database error during cleanup:', error);
      return 0;
    }
  }

  // Get pending session by user context (for responding to proposals)
  async getPendingSessionByUserContext(telegramId) {
    try {
      const { data, error } = await this.supabase
        .from('pending_sessions')
        .select(`
          *,
          proposer:proposed_by(id, name, telegram_id),
          proposed_to_user:proposed_to(id, name, telegram_id)
        `)
        .eq('proposed_to_user.telegram_id', telegramId)
        .in('status', ['pending', 'counter_proposed'])
        .order('updated_at', { ascending: false })
        .limit(1);

      if (error) {
        console.error('DatabaseService: Error fetching user context session:', error);
        return null;
      }

      return data?.[0] || null;
    } catch (error) {
      console.error('DatabaseService: Database error:', error);
      return null;
    }
  }

  // === SESSION MANAGEMENT ===

  // Get a confirmed session by ID
  async getSession(sessionId) {
    try {
      const { data, error } = await this.supabase
        .from('sessions')
        .select('*')
        .eq('id', sessionId)
        .single();

      if (error) {
        console.error('DatabaseService: Error fetching session:', error);
        return null;
      }

      return data;
    } catch (error) {
      console.error('DatabaseService: Database error:', error);
      return null;
    }
  }

  // Update a confirmed session
  async updateSession(sessionId, updates) {
    try {
      const updateData = {
        ...updates,
        updated_at: new Date().toISOString()
      };

      console.log('DatabaseService: Updating session:', sessionId, updateData);

      const { data, error } = await this.supabase
        .from('sessions')
        .update(updateData)
        .eq('id', sessionId)
        .select()
        .single();

      if (error) {
        console.error('DatabaseService: Error updating session:', error);
        return null;
      }

      console.log('DatabaseService: ✅ Session updated:', sessionId);
      return data;
    } catch (error) {
      console.error('DatabaseService: Database error:', error);
      return null;
    }
  }

  // Request session modification (creates a pending modification)
  async requestSessionModification(sessionId, proposedBy, newDate, newStartTime, newEndTime, reason) {
    try {
      // Get the original session
      const originalSession = await this.getSession(sessionId);
      if (!originalSession) {
        return { error: 'Original session not found' };
      }

      // Get partner info
      const partnerId = originalSession.participants.find(id => id !== proposedBy.id);
      const partnerInfo = await this.supabase
        .from('users')
        .select('*')
        .eq('id', partnerId)
        .single();

      if (!partnerInfo.data) {
        return { error: 'Partner not found' };
      }

      // Create a pending session for the modification
      const modificationData = {
        proposedBy,
        proposedTo: partnerInfo.data,
        date: newDate,
        startTime: newStartTime,
        endTime: newEndTime,
        message: `Modification request: ${reason || 'Schedule change'}`
      };

      const pendingModification = await this.createPendingSession(modificationData);
      
      if (!pendingModification) {
        return { error: 'Failed to create modification request' };
      }

      // Store reference to original session
      await this.updatePendingSession(pendingModification.id, {
        counter_proposal: { 
          originalSessionId: sessionId,
          isModification: true 
        }
      });

      console.log('DatabaseService: ✅ Session modification requested:', sessionId);
      return { success: true, modificationId: pendingModification.id };
    } catch (error) {
      console.error('DatabaseService: Error requesting session modification:', error);
      return { error: 'Database error during modification request' };
    }
  }

  // Cancel a confirmed session
  async cancelSession(sessionId, cancelledBy, reason) {
    try {
      const result = await this.updateSession(sessionId, {
        status: 'cancelled',
        updated_at: new Date().toISOString()
      });

      if (!result) {
        return { error: 'Failed to cancel session' };
      }

      console.log('DatabaseService: ✅ Session cancelled:', sessionId);
      return { success: true, sessionId };
    } catch (error) {
      console.error('DatabaseService: Error cancelling session:', error);
      return { error: 'Database error during session cancellation' };
    }
  }

  // Mark session as completed
  async markSessionCompleted(sessionId) {
    try {
      const result = await this.updateSession(sessionId, {
        status: 'completed'
      });

      if (!result) {
        return { error: 'Failed to mark session as completed' };
      }

      console.log('DatabaseService: ✅ Session marked as completed:', sessionId);
      return { success: true, sessionId };
    } catch (error) {
      console.error('DatabaseService: Error marking session completed:', error);
      return { error: 'Database error during session completion' };
    }
  }

  // Get sessions for a user with status filter
  async getSessionsForUser(userId, status = null, limit = 10) {
    try {
      const today = new Date().toISOString().split('T')[0];
      
      let query = this.supabase
        .from('sessions')
        .select('*')
        .contains('participants', [userId])
        .order('date', { ascending: true })
        .order('start_time', { ascending: true })
        .limit(limit);

      if (status) {
        query = query.eq('status', status);
      }

      const { data, error } = await query;

      if (error) {
        console.error('DatabaseService: Error fetching sessions:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('DatabaseService: Database error:', error);
      return [];
    }
  }

  // Get user workout statistics
  async getUserWorkoutStats(userId) {
    try {
      const { data, error } = await this.supabase
        .from('sessions')
        .select('status, date')
        .contains('participants', [userId]);

      if (error) {
        console.error('DatabaseService: Error fetching workout stats:', error);
        return {
          totalSessions: 0,
          completedSessions: 0,
          cancelledSessions: 0,
          completionRate: 0,
          currentStreak: 0,
          lastWorkout: null
        };
      }

      const sessions = data || [];
      const totalSessions = sessions.length;
      const completedSessions = sessions.filter(s => s.status === 'completed').length;
      const cancelledSessions = sessions.filter(s => s.status === 'cancelled').length;
      const completionRate = totalSessions > 0 ? Math.round((completedSessions / totalSessions) * 100) : 0;

      // Calculate current streak (consecutive completed sessions)
      const sortedSessions = sessions
        .filter(s => s.status !== 'confirmed') // Only count completed/cancelled sessions
        .sort((a, b) => new Date(b.date) - new Date(a.date));
      
      let currentStreak = 0;
      for (const session of sortedSessions) {
        if (session.status === 'completed') {
          currentStreak++;
        } else {
          break; // Streak broken
        }
      }

      // Get last workout date
      const lastCompletedSession = sessions
        .filter(s => s.status === 'completed')
        .sort((a, b) => new Date(b.date) - new Date(a.date))[0];

      return {
        totalSessions,
        completedSessions,
        cancelledSessions,
        completionRate,
        currentStreak,
        lastWorkout: lastCompletedSession?.date || null
      };
    } catch (error) {
      console.error('DatabaseService: Error calculating workout stats:', error);
      return {
        totalSessions: 0,
        completedSessions: 0,
        cancelledSessions: 0,
        completionRate: 0,
        currentStreak: 0,
        lastWorkout: null
      };
    }
  }

  // Get recent workout history with formatted display
  async getWorkoutHistory(userId, limit = 10) {
    try {
      const { data, error } = await this.supabase
        .from('sessions')
        .select('*')
        .contains('participants', [userId])
        .in('status', ['completed', 'cancelled'])
        .order('date', { ascending: false })
        .order('start_time', { ascending: false })
        .limit(limit);

      if (error) {
        console.error('DatabaseService: Error fetching workout history:', error);
        return [];
      }

      return (data || []).map(session => ({
        ...session,
        displayDate: this.formatWorkoutDate(session.date),
        displayTime: `${this.formatHour(session.start_time)} - ${this.formatHour(session.end_time)}`,
        statusEmoji: session.status === 'completed' ? '✅' : '❌'
      }));
    } catch (error) {
      console.error('DatabaseService: Database error:', error);
      return [];
    }
  }

  // Format workout date for display
  formatWorkoutDate(dateString) {
    const date = new Date(dateString);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return 'Today';
    } else if (date.toDateString() === yesterday.toDateString()) {
      return 'Yesterday';
    } else {
      const options = { weekday: 'short', month: 'short', day: 'numeric' };
      return date.toLocaleDateString('en-US', options);
    }
  }

  // Mark a missed session (for sessions that passed without being marked completed)
  async markSessionMissed(sessionId) {
    try {
      const result = await this.updateSession(sessionId, {
        status: 'cancelled' // We use cancelled for missed sessions
      });

      if (!result) {
        return { error: 'Failed to mark session as missed' };
      }

      console.log('DatabaseService: ✅ Session marked as missed:', sessionId);
      return { success: true, sessionId };
    } catch (error) {
      console.error('DatabaseService: Error marking session missed:', error);
      return { error: 'Database error during session missed marking' };
    }
  }

  // Delete a confirmed session (permanently remove from database)
  async deleteSession(sessionId, deletedBy, reason = null) {
    try {
      // First get the session to verify it exists
      const session = await this.getSession(sessionId);
      if (!session) {
        return { error: 'Session not found' };
      }

      console.log('DatabaseService: Deleting session:', sessionId, 'by user:', deletedBy.name);

      // Permanently delete the session
      const { error } = await this.supabase
        .from('sessions')
        .delete()
        .eq('id', sessionId);

      if (error) {
        console.error('DatabaseService: Error deleting session:', error);
        return { error: 'Failed to delete session' };
      }

      console.log('DatabaseService: ✅ Session permanently deleted:', sessionId);
      return { success: true, sessionId, deletedSession: session };
    } catch (error) {
      console.error('DatabaseService: Error deleting session:', error);
      return { error: 'Database error during session deletion' };
    }
  }

  // === AVAILABILITY MANAGEMENT ===

  // Update user availability (create/update/delete availability slots)
  async updateUserAvailability(userId, availabilitySlots) {
    try {
      console.log('DatabaseService: 🔄 STARTING availability update for user:', userId);
      console.log('DatabaseService: Input slots:', JSON.stringify(availabilitySlots, null, 2));

      // Step 1: Verify we can read current availability
      const { data: currentData, error: readError } = await this.supabase
        .from('availability')
        .select('*')
        .eq('user_id', userId);

      if (readError) {
        console.error('DatabaseService: ❌ Error reading current availability (RLS issue?):', readError);
        return { error: 'Failed to read current availability - check RLS policies' };
      }

      console.log('DatabaseService: 📊 Current availability slots in DB:', currentData?.length || 0);
      if (currentData && currentData.length > 0) {
        console.log('DatabaseService: Current slots:', currentData.map(s => `${s.day} ${s.start_time}-${s.end_time}`));
      }

      // Step 2: FORCE DELETE all existing availability for the user with retries
      console.log('DatabaseService: 🗑️ FORCE CLEARING all existing availability...');
      
      let deleteAttempts = 0;
      let deleteSuccess = false;
      const maxDeleteAttempts = 3;
      
      while (!deleteSuccess && deleteAttempts < maxDeleteAttempts) {
        deleteAttempts++;
        console.log(`DatabaseService: Delete attempt ${deleteAttempts}/${maxDeleteAttempts}`);
        
        const { error: deleteError, count: deletedCount } = await this.supabase
          .from('availability')
          .delete({ count: 'exact' })
          .eq('user_id', userId);

        if (deleteError) {
          console.error(`DatabaseService: ❌ Delete attempt ${deleteAttempts} failed:`, deleteError);
          if (deleteAttempts >= maxDeleteAttempts) {
            return { error: `Failed to clear existing availability after ${maxDeleteAttempts} attempts - check RLS policies` };
          }
          // Wait 1 second before retry
          await new Promise(resolve => setTimeout(resolve, 1000));
        } else {
          deleteSuccess = true;
          console.log('DatabaseService: ✅ Successfully deleted', deletedCount, 'existing availability slots');
        }
      }

      // Step 3: Verify deletion worked
      const { data: verifyDeleteData, error: verifyDeleteError } = await this.supabase
        .from('availability')
        .select('*')
        .eq('user_id', userId);
      
      if (!verifyDeleteError && verifyDeleteData && verifyDeleteData.length > 0) {
        console.warn('DatabaseService: ⚠️ WARNING: Still found', verifyDeleteData.length, 'slots after delete!');
        // Try one more forced delete
        await this.supabase
          .from('availability')
          .delete()
          .eq('user_id', userId);
      } else {
        console.log('DatabaseService: ✅ Verified: No remaining availability slots');
      }

      // Step 4: If no new slots provided, return success (user cleared their availability)
      if (!availabilitySlots || availabilitySlots.length === 0) {
        console.log('DatabaseService: ✅ User availability CLEARED successfully - no new slots to add');
        
        // Final verification that availability is truly cleared
        const { data: finalVerify } = await this.supabase
          .from('availability')
          .select('count')
          .eq('user_id', userId);
        
        return { 
          success: true, 
          message: 'Availability cleared completely', 
          deletedCount: deleteAttempts > 0 ? 'multiple' : 0,
          finalSlotCount: 0
        };
      }

      // Step 5: Validate and format new availability slots
      console.log('DatabaseService: 📝 Formatting new availability slots...');
      const newSlots = availabilitySlots.map((slot, index) => {
        // Validate slot data
        if (!slot.day || typeof slot.startTime !== 'number' || typeof slot.endTime !== 'number') {
          console.error(`DatabaseService: ❌ Invalid slot at index ${index}:`, slot);
          throw new Error(`Invalid slot data at index ${index}`);
        }
        
        const formattedSlot = {
          user_id: userId,
          day: slot.day.toLowerCase(),
          start_time: Math.max(0, Math.min(23, slot.startTime)),
          end_time: Math.max(slot.startTime + 1, Math.min(24, slot.endTime)),
          submitted_at: new Date().toISOString(),
          created_at: new Date().toISOString()
        };
        console.log(`DatabaseService: Slot ${index + 1}:`, formattedSlot);
        return formattedSlot;
      });

      // Step 6: Insert new availability slots with retry logic
      console.log('DatabaseService: 💾 Inserting', newSlots.length, 'new availability slots...');
      
      let insertAttempts = 0;
      let insertSuccess = false;
      const maxInsertAttempts = 3;
      let insertData = null;
      
      while (!insertSuccess && insertAttempts < maxInsertAttempts) {
        insertAttempts++;
        console.log(`DatabaseService: Insert attempt ${insertAttempts}/${maxInsertAttempts}`);
        
        const { data, error: insertError } = await this.supabase
          .from('availability')
          .insert(newSlots)
          .select();

        if (insertError) {
          console.error(`DatabaseService: ❌ Insert attempt ${insertAttempts} failed:`, insertError);
          if (insertAttempts >= maxInsertAttempts) {
            return { error: `Failed to insert new availability after ${maxInsertAttempts} attempts - check RLS policies` };
          }
          await new Promise(resolve => setTimeout(resolve, 1000));
        } else {
          insertSuccess = true;
          insertData = data;
          console.log('DatabaseService: ✅ Successfully inserted', data?.length || 0, 'new slots');
        }
      }

      console.log('DatabaseService: 📋 Inserted slots summary:', insertData?.map(s => `${s.day} ${s.start_time}-${s.end_time}`));
      
      // Step 7: Final verification
      console.log('DatabaseService: 🔍 Final verification...');
      const { data: verifyData, error: verifyError } = await this.supabase
        .from('availability')
        .select('*')
        .eq('user_id', userId)
        .order('day')
        .order('start_time');

      if (!verifyError) {
        console.log('DatabaseService: ✅ Final verification - slots in DB:', verifyData?.length || 0);
        if (verifyData && verifyData.length > 0) {
          console.log('DatabaseService: Final slots:', verifyData.map(s => `${s.day} ${s.start_time}-${s.end_time}`));
        }
      } else {
        console.warn('DatabaseService: ⚠️ Verification failed:', verifyError);
      }

      return { 
        success: true, 
        message: 'Availability updated successfully with verification',
        slots: insertData,
        insertedCount: insertData?.length || 0,
        finalSlotCount: verifyData?.length || 0
      };
    } catch (error) {
      console.error('DatabaseService: ❌ CRITICAL ERROR during availability update:', error);
      return { error: 'Database error during availability update: ' + error.message };
    }
  }

  // Add a single availability slot
  async addAvailabilitySlot(userId, day, startTime, endTime) {
    try {
      console.log('DatabaseService: Adding availability slot:', { userId, day, startTime, endTime });

      const newSlot = {
        user_id: userId,
        day: day.toLowerCase(),
        start_time: startTime,
        end_time: endTime,
        submitted_at: new Date().toISOString(),
        created_at: new Date().toISOString()
      };

      const { data, error } = await this.supabase
        .from('availability')
        .insert([newSlot])
        .select()
        .single();

      if (error) {
        console.error('DatabaseService: Error adding availability slot:', error);
        return { error: 'Failed to add availability slot' };
      }

      console.log('DatabaseService: ✅ Availability slot added:', data.id);
      return { success: true, slot: data };
    } catch (error) {
      console.error('DatabaseService: Error adding availability slot:', error);
      return { error: 'Database error during availability addition' };
    }
  }

  // Remove specific availability slots for a user (enhanced for bot sync)
  async removeAvailabilitySlots(userId, day = null) {
    try {
      console.log('DatabaseService: 🗑️ FORCE REMOVING availability slots for user:', userId, 'day:', day);

      // First check what exists
      const { data: beforeData } = await this.supabase
        .from('availability')
        .select('*')
        .eq('user_id', userId);
      
      console.log('DatabaseService: Before removal - existing slots:', beforeData?.length || 0);

      // Build delete query
      let query = this.supabase
        .from('availability')
        .delete({ count: 'exact' })
        .eq('user_id', userId);

      if (day) {
        query = query.eq('day', day.toLowerCase());
      }

      // Execute delete with retry logic
      let attempts = 0;
      let success = false;
      const maxAttempts = 3;
      
      while (!success && attempts < maxAttempts) {
        attempts++;
        console.log(`DatabaseService: Remove attempt ${attempts}/${maxAttempts}`);
        
        const { error, count } = await query;

        if (error) {
          console.error(`DatabaseService: ❌ Remove attempt ${attempts} failed:`, error);
          if (attempts >= maxAttempts) {
            return { error: 'Failed to remove availability slots after retries' };
          }
          await new Promise(resolve => setTimeout(resolve, 1000));
        } else {
          success = true;
          console.log('DatabaseService: ✅ Successfully removed', count, 'slots');
        }
      }

      // Verify removal
      const { data: afterData } = await this.supabase
        .from('availability')
        .select('*')
        .eq('user_id', userId);
      
      const message = day 
        ? `Availability removed for ${day}` 
        : 'ALL AVAILABILITY CLEARED';
      
      console.log('DatabaseService: ✅', message);
      console.log('DatabaseService: After removal - remaining slots:', afterData?.length || 0);
      
      return { 
        success: true, 
        message,
        removedCount: (beforeData?.length || 0) - (afterData?.length || 0),
        remainingCount: afterData?.length || 0
      };
    } catch (error) {
      console.error('DatabaseService: ❌ Error removing availability slots:', error);
      return { error: 'Database error during availability removal: ' + error.message };
    }
  }

  // Check availability conflicts when creating sessions
  async checkAvailabilityConflict(userId, partnerId, date, startTime, endTime) {
    try {
      const dayOfWeek = new Date(date).toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
      
      // Get both users' availability for the day
      const [userAvailability, partnerAvailability] = await Promise.all([
        this.getUserAvailabilityForDay(userId, dayOfWeek),
        this.getUserAvailabilityForDay(partnerId, dayOfWeek)
      ]);

      const conflicts = [];

      // Check if user is available
      const userHasSlot = userAvailability.some(slot => 
        startTime >= slot.start_time && endTime <= slot.end_time
      );
      if (!userHasSlot) {
        conflicts.push('You are not available during this time');
      }

      // Check if partner is available
      const partnerHasSlot = partnerAvailability.some(slot => 
        startTime >= slot.start_time && endTime <= slot.end_time
      );
      if (!partnerHasSlot) {
        conflicts.push('Your partner is not available during this time');
      }

      return {
        hasConflicts: conflicts.length > 0,
        conflicts,
        userAvailable: userHasSlot,
        partnerAvailable: partnerHasSlot
      };
    } catch (error) {
      console.error('DatabaseService: Error checking availability conflict:', error);
      return {
        hasConflicts: true,
        conflicts: ['Error checking availability'],
        userAvailable: false,
        partnerAvailable: false
      };
    }
  }

  // Get user availability for a specific day
  async getUserAvailabilityForDay(userId, day) {
    try {
      const { data, error } = await this.supabase
        .from('availability')
        .select('*')
        .eq('user_id', userId)
        .eq('day', day.toLowerCase());

      if (error) {
        console.error('DatabaseService: Error fetching day availability:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('DatabaseService: Error fetching day availability:', error);
      return [];
    }
  }

  // Check database connection
  async checkConnection() {
    try {
      // Simple query to test connection
      const { data, error } = await this.supabase
        .from('users')
        .select('count')
        .limit(1);
      
      return !error;
    } catch (error) {
      console.error('DatabaseService: Connection check failed:', error);
      return false;
    }
  }

  // Comprehensive database access test for RLS debugging
  async testDatabaseAccess(userId = 'f8939d4a-c2d3-4c7b-80e2-3a384fc953bd') {
    const results = {};
    
    try {
      console.log('DatabaseService: Testing database access for user:', userId);

      // Test users table access
      try {
        const { data, error } = await this.supabase
          .from('users')
          .select('id, name')
          .eq('id', userId);
        results.users = { success: !error, error: error?.message, count: data?.length || 0 };
      } catch (error) {
        results.users = { success: false, error: error.message, count: 0 };
      }

      // Test availability table access
      try {
        const { data, error } = await this.supabase
          .from('availability')
          .select('*')
          .eq('user_id', userId);
        results.availability = { success: !error, error: error?.message, count: data?.length || 0 };
      } catch (error) {
        results.availability = { success: false, error: error.message, count: 0 };
      }

      // Test sessions table access
      try {
        const { data, error } = await this.supabase
          .from('sessions')
          .select('*')
          .contains('participants', [userId]);
        results.sessions = { success: !error, error: error?.message, count: data?.length || 0 };
      } catch (error) {
        results.sessions = { success: false, error: error.message, count: 0 };
      }

      // Test write access to availability
      try {
        const testSlot = {
          user_id: userId,
          day: 'test',
          start_time: 0,
          end_time: 1,
          submitted_at: new Date().toISOString(),
          created_at: new Date().toISOString()
        };
        
        const { data, error } = await this.supabase
          .from('availability')
          .insert([testSlot])
          .select();

        if (!error && data?.length > 0) {
          // Clean up test data
          await this.supabase
            .from('availability')
            .delete()
            .eq('id', data[0].id);
        }

        results.availability_write = { success: !error, error: error?.message };
      } catch (error) {
        results.availability_write = { success: false, error: error.message };
      }

      console.log('DatabaseService: Access test results:', JSON.stringify(results, null, 2));
      return results;
    } catch (error) {
      console.error('DatabaseService: Error during access test:', error);
      return { error: error.message };
    }
  }
}

module.exports = DatabaseService;