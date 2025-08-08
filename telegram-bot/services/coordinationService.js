const { v4: uuidv4 } = require('uuid');
const AvailabilityParser = require('../utils/availabilityParser');

class CoordinationService {
  constructor(db, telegramBot, reminderService = null) {
    this.db = db;
    this.bot = telegramBot;
    this.reminderService = reminderService;
    
    // Initialize user contexts for tracking conversations
    this.userContexts = new Map();
    
    // Initialize availability parser
    this.availabilityParser = new AvailabilityParser();
    
    // Clean up expired sessions every hour
    setInterval(() => this.cleanupExpiredSessions(), 3600000);
  }

  /**
   * Propose a new gym session
   * @param {Object} proposalData - Session proposal details
   * @returns {Object} - Pending session details
   */
  async proposeSession(proposalData) {
    const { proposedBy, proposedTo, date, startTime, endTime, message } = proposalData;
    
    // Create pending session in database
    const pendingSession = await this.db.createPendingSession({
      proposedBy,
      proposedTo,
      date,
      startTime,
      endTime,
      message
    });
    
    if (!pendingSession) {
      throw new Error('Failed to create pending session in database');
    }
    
    // Log the proposal
    console.log('CoordinationService: New session proposed:', {
      id: pendingSession.id,
      from: proposedBy.name,
      to: proposedTo.name,
      datetime: `${date} ${startTime}:00-${endTime}:00`
    });
    
    // Send notification to partner
    await this.notifyPartner(pendingSession, proposedBy, proposedTo);
    
    return pendingSession;
  }

  /**
   * Send notification to partner about proposed session
   * @param {Object} pendingSession - Pending session details
   * @param {Object} proposedBy - User who proposed the session
   * @param {Object} proposedTo - User who receives the proposal
   */
  async notifyPartner(pendingSession, proposedBy, proposedTo) {
    const { date, start_time, end_time, message, id } = pendingSession;
    
    // Format the time nicely
    const formattedTime = this.formatSessionTime(date, start_time, end_time);
    
    // Build notification message
    let notificationText = `🏋️ **Gym Session Request**\n\n`;
    notificationText += `${proposedBy.name} wants to book a gym session:\n`;
    notificationText += `📅 ${formattedTime}\n`;
    
    if (message) {
      notificationText += `💬 "${message}"\n`;
    }
    
    notificationText += `\nReply with:\n`;
    notificationText += `• "Yes" to confirm\n`;
    notificationText += `• "No" to decline\n`;
    notificationText += `• Or suggest a different time`;
    
    // Send via Telegram
    if (proposedTo.telegram_id) {
      try {
        await this.bot.sendMessage(proposedTo.telegram_id, notificationText, {
          parse_mode: 'Markdown'
        });
        
        // Store the session ID in context for the user
        this.storeUserContext(proposedTo.telegram_id, { 
          pendingSessionId: id,
          waitingForResponse: true 
        });
        
        console.log('CoordinationService: Notification sent to', proposedTo.name);
      } catch (error) {
        console.error('CoordinationService: Failed to send notification:', error);
      }
    } else {
      console.warn('CoordinationService: Partner has no Telegram ID:', proposedTo.name);
    }
  }

  /**
   * Handle partner's response to a session proposal
   * @param {string} userId - User ID responding
   * @param {string} response - User's response
   * @param {Object} context - Message context
   */
  async handleResponse(userId, response, context) {
    const userContext = this.getUserContext(userId);
    
    if (!userContext || !userContext.pendingSessionId) {
      return null;
    }
    
    // Get pending session from database
    const pendingSession = await this.db.getPendingSession(userContext.pendingSessionId);
    if (!pendingSession) {
      return { error: 'Session proposal expired or not found' };
    }
    
    // Enhanced response analysis
    const intent = this.analyzeResponseIntent(response);
    
    switch (intent.type) {
      case 'accept':
        return await this.acceptSession(pendingSession, userId, intent.message);
      
      case 'decline':
        return await this.declineSession(pendingSession, userId, intent.message);
      
      case 'counter_propose':
        return await this.counterProposeSession(pendingSession, userId, response, intent.timeProposal);
      
      case 'mixed':
        // Handle decline + counter-proposal in one message
        if (intent.decline && intent.counterProposal) {
          return await this.handleMixedResponse(pendingSession, userId, response, intent);
        }
        break;
      
      case 'unclear':
        // Let AI handle complex responses we can't parse
        return { 
          needsAiProcessing: true,
          context: { pendingSession, userContext }
        };
      
      default:
        return null;
    }
    
    return null;
  }

  /**
   * Analyze the intent of a user's response
   * @param {string} response - User's response text
   * @returns {Object} - Intent analysis result
   */
  analyzeResponseIntent(response) {
    const lowerResponse = response.toLowerCase();
    
    // Enhanced acceptance patterns
    const acceptPatterns = [
      /\b(yes|yeah|yep|sure|okay|ok|sounds good|perfect|great|absolutely)\b/i,
      /\b(let's do it|i'm in|count me in|that works|works for me)\b/i,
      /\b(confirmed?|confirm|accept)\b/i
    ];
    
    // Enhanced decline patterns
    const declinePatterns = [
      /\b(no|nope|can't|cannot|unable|not available|busy|sorry)\b/i,
      /\b(decline|reject|won't work|doesn't work)\b/i,
      /\b(i have|i'm busy|i've got|conflict)\b/i
    ];
    
    // Time proposal patterns
    const timePatterns = [
      /\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i,
      /\d{1,2}\s*(am|pm)/i,
      /\d{1,2}:\d{2}/,
      /\b(morning|afternoon|evening|night)\b/i,
      /\b(tomorrow|today|next week|this week)\b/i,
      /\b(how about|what about|instead|alternatively)\b/i
    ];
    
    const hasAccept = acceptPatterns.some(pattern => pattern.test(response));
    const hasDecline = declinePatterns.some(pattern => pattern.test(response));
    const hasTimeProposal = timePatterns.some(pattern => pattern.test(response));
    
    // Determine intent type
    if (hasDecline && hasTimeProposal) {
      return {
        type: 'mixed',
        decline: true,
        counterProposal: true,
        timeProposal: this.parseTimeProposal(response),
        message: response
      };
    } else if (hasAccept && !hasDecline) {
      return {
        type: 'accept',
        message: response
      };
    } else if (hasDecline && !hasTimeProposal) {
      return {
        type: 'decline',
        message: response
      };
    } else if (hasTimeProposal && !hasAccept) {
      return {
        type: 'counter_propose',
        timeProposal: this.parseTimeProposal(response),
        message: response
      };
    } else if (response.length > 100 || this.containsQuestionWords(response)) {
      // Complex message that might need AI processing
      return {
        type: 'unclear',
        message: response
      };
    }
    
    return {
      type: 'unknown',
      message: response
    };
  }

  /**
   * Check if response contains question words that might need AI handling
   * @param {string} response - User response
   * @returns {boolean}
   */
  containsQuestionWords(response) {
    const questionWords = ['why', 'how', 'what', 'when', 'where', 'who', 'which', '?'];
    const lowerResponse = response.toLowerCase();
    return questionWords.some(word => lowerResponse.includes(word));
  }

  /**
   * Handle mixed response (decline + counter-proposal)
   * @param {Object} pendingSession - Pending session
   * @param {string} userId - User responding
   * @param {string} response - Full response text
   * @param {Object} intent - Analyzed intent
   */
  async handleMixedResponse(pendingSession, userId, response, intent) {
    // First acknowledge the decline with explanation
    const declineMessage = `📝 **Response Received**\n\n` +
      `${pendingSession.proposed_to_user.name} said: "${response}"\n\n` +
      `I'll send the counter-proposal to ${pendingSession.proposer.name}!`;
    
    // Update session with counter-proposal
    if (intent.timeProposal) {
      // Update the session in the database with new counter-proposal
      await this.db.updatePendingSession(pendingSession.id, {
        status: 'counter_proposed',
        counter_proposal: intent.timeProposal,
        // Swap the proposer and proposed_to for counter-proposal
        proposed_by: pendingSession.proposed_to,
        proposed_to: pendingSession.proposed_by,
        proposer_confirmed: true,
        partner_confirmed: false,
        // Update with new time
        date: intent.timeProposal.date,
        start_time: intent.timeProposal.startTime,
        end_time: intent.timeProposal.endTime
      });
      
      // Notify original proposer with context
      const counterMessage = `🔄 **Counter-Proposal with Context**\n\n` +
        `${pendingSession.proposed_to_user.name} responded: "${response}"\n\n` +
        `New proposed time: ${this.formatSessionTime(intent.timeProposal.date, intent.timeProposal.startTime, intent.timeProposal.endTime)}\n\n` +
        `Reply with "Yes" to accept or suggest another time.`;
      
      if (pendingSession.proposer.telegram_id) {
        await this.bot.sendMessage(pendingSession.proposer.telegram_id, counterMessage, {
          parse_mode: 'Markdown'
        });
        
        this.storeUserContext(pendingSession.proposer.telegram_id, { 
          pendingSessionId: pendingSession.id,
          waitingForResponse: true 
        });
      }
      
      this.clearUserContext(userId);
      
      return { 
        success: true, 
        message: 'Counter-proposal with context sent!' 
      };
    }
    
    return { 
      success: true, 
      message: declineMessage 
    };
  }

  /**
   * Accept a session proposal
   * @param {Object} pendingSession - Pending session
   * @param {string} userId - User accepting
   * @param {string} originalMessage - User's original response (optional)
   */
  async acceptSession(pendingSession, userId, originalMessage) {
    // Use database method to accept pending session
    const result = await this.db.acceptPendingSession(pendingSession.id);
    
    if (!result.success) {
      return { error: result.error || 'Failed to accept session' };
    }
    
    // Build confirmation message with context if available
    let confirmationMessage = `✅ **Session Confirmed!**\n\n`;
    
    if (originalMessage && originalMessage.toLowerCase() !== 'yes') {
      confirmationMessage += `${pendingSession.proposed_to_user.name} said: "${originalMessage}"\n\n`;
    }
    
    confirmationMessage += `Your gym session is booked for:\n` +
      `📅 ${this.formatSessionTime(pendingSession.date, pendingSession.start_time, pendingSession.end_time)}\n\n` +
      `See you both there! 💪`;
    
    // Send to proposer
    if (pendingSession.proposer.telegram_id) {
      await this.bot.sendMessage(pendingSession.proposer.telegram_id, confirmationMessage, {
        parse_mode: 'Markdown'
      });
    }
    
    // Clear user context
    this.clearUserContext(pendingSession.proposed_to_user.telegram_id);
    
    // Schedule post-workout check-in if reminder service is available
    if (this.reminderService && result.sessionId) {
      const sessionData = {
        id: result.sessionId,
        date: pendingSession.date,
        start_time: pendingSession.start_time,
        end_time: pendingSession.end_time
      };
      this.reminderService.schedulePostWorkoutCheckIn(sessionData);
    }
    
    return { 
      success: true, 
      message: 'Session confirmed!',
      sessionId: result.sessionId 
    };
  }

  /**
   * Decline a session proposal
   * @param {Object} pendingSession - Pending session
   * @param {string} userId - User declining
   * @param {string} originalMessage - User's original response (optional)
   */
  async declineSession(pendingSession, userId, originalMessage) {
    // Use database method to decline pending session
    const result = await this.db.declinePendingSession(pendingSession.id);
    
    if (!result.success) {
      return { error: result.error || 'Failed to decline session' };
    }
    
    // Notify proposer with context if available
    let declineMessage = `❌ **Session Declined**\n\n`;
    
    if (originalMessage && originalMessage.toLowerCase() !== 'no') {
      declineMessage += `${pendingSession.proposed_to_user.name} said: "${originalMessage}"\n\n`;
    }
    
    declineMessage += `They are not available for:\n` +
      `📅 ${this.formatSessionTime(pendingSession.date, pendingSession.start_time, pendingSession.end_time)}\n\n` +
      `Try proposing a different time!`;
    
    if (pendingSession.proposer.telegram_id) {
      await this.bot.sendMessage(pendingSession.proposer.telegram_id, declineMessage, {
        parse_mode: 'Markdown'
      });
    }
    
    // Clear user context
    this.clearUserContext(pendingSession.proposed_to_user.telegram_id);
    
    return { 
      success: true, 
      message: 'Session declined. The other person has been notified.' 
    };
  }

  /**
   * Counter-propose with a different time
   * @param {Object} pendingSession - Pending session
   * @param {string} userId - User counter-proposing
   * @param {string} counterProposal - Alternative time suggestion
   */
  async counterProposeSession(pendingSession, userId, counterProposal) {
    // Parse the counter-proposal
    const parsedTime = this.parseTimeProposal(counterProposal);
    
    if (!parsedTime) {
      return { error: 'Could not understand the time suggestion' };
    }
    
    // Update session with counter-proposal in database
    await this.db.updatePendingSession(pendingSession.id, {
      status: 'counter_proposed',
      counter_proposal: parsedTime,
      // Swap proposer/proposed for the counter-proposal
      proposed_by: pendingSession.proposed_to,
      proposed_to: pendingSession.proposed_by,
      proposer_confirmed: true,
      partner_confirmed: false,
      // Update with new time
      date: parsedTime.date,
      start_time: parsedTime.startTime,
      end_time: parsedTime.endTime
    });
    
    // Notify original proposer
    const counterMessage = `🔄 **Counter-Proposal**\n\n` +
      `${pendingSession.proposed_to_user.name} suggests a different time:\n` +
      `📅 ${this.formatSessionTime(parsedTime.date, parsedTime.startTime, parsedTime.endTime)}\n\n` +
      `Reply with "Yes" to accept or suggest another time.`;
    
    if (pendingSession.proposer.telegram_id) {
      await this.bot.sendMessage(pendingSession.proposer.telegram_id, counterMessage, {
        parse_mode: 'Markdown'
      });
      
      // Update context for new recipient
      this.storeUserContext(pendingSession.proposer.telegram_id, { 
        pendingSessionId: pendingSession.id,
        waitingForResponse: true 
      });
    }
    
    // Clear context for counter-proposer
    this.clearUserContext(userId);
    
    return { 
      success: true, 
      message: 'Counter-proposal sent!' 
    };
  }

  /**
   * Format session time for display
   * @param {string} date - Session date
   * @param {number} startTime - Start hour
   * @param {number} endTime - End hour
   */
  formatSessionTime(date, startTime, endTime) {
    const sessionDate = new Date(date);
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    const formattedDate = sessionDate.toLocaleDateString('en-US', options);
    
    const formatHour = (hour) => {
      if (hour === 0) return '12 AM';
      if (hour === 12) return '12 PM';
      if (hour < 12) return `${hour} AM`;
      return `${hour - 12} PM`;
    };
    
    return `${formattedDate}, ${formatHour(startTime)} - ${formatHour(endTime)}`;
  }

  /**
   * Check if message contains a time proposal
   * @param {string} message - User message
   */
  containsTimeProposal(message) {
    const timePatterns = [
      /\d{1,2}\s*(am|pm)/i,
      /(monday|tuesday|wednesday|thursday|friday|saturday|sunday)/i,
      /(tomorrow|today|next)/i,
      /\d{1,2}:\d{2}/
    ];
    
    return timePatterns.some(pattern => pattern.test(message));
  }

  /**
   * Parse time proposal from message
   * @param {string} message - User message
   */
  parseTimeProposal(message) {
    // This is a simplified parser - in production, use the timeParser service
    try {
      const dayMatch = message.match(/(monday|tuesday|wednesday|thursday|friday|saturday|sunday)/i);
      const timeMatch = message.match(/(\d{1,2})\s*(am|pm)/i);
      
      if (!dayMatch || !timeMatch) return null;
      
      // Calculate date for the day
      const today = new Date();
      const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
      const targetDay = days.indexOf(dayMatch[1].toLowerCase());
      const currentDay = today.getDay();
      
      let daysUntil = targetDay - currentDay;
      if (daysUntil <= 0) daysUntil += 7;
      
      const targetDate = new Date(today);
      targetDate.setDate(today.getDate() + daysUntil);
      
      // Parse time
      let hour = parseInt(timeMatch[1]);
      const meridian = timeMatch[2].toLowerCase();
      
      if (meridian === 'pm' && hour !== 12) hour += 12;
      if (meridian === 'am' && hour === 12) hour = 0;
      
      return {
        date: targetDate.toISOString().split('T')[0],
        startTime: hour,
        endTime: hour + 2 // Default 2-hour session
      };
    } catch (error) {
      console.error('CoordinationService: Error parsing time proposal:', error);
      return null;
    }
  }

  /**
   * Store user context for tracking conversations
   * @param {string} telegramId - User's Telegram ID
   * @param {Object} context - Context data
   */
  storeUserContext(telegramId, context) {
    if (!this.userContexts) {
      this.userContexts = new Map();
    }
    this.userContexts.set(telegramId.toString(), context);
  }

  /**
   * Get user context
   * @param {string} telegramId - User's Telegram ID
   */
  getUserContext(telegramId) {
    if (!this.userContexts) return null;
    return this.userContexts.get(telegramId.toString());
  }

  /**
   * Clear user context
   * @param {string} telegramId - User's Telegram ID
   */
  clearUserContext(telegramId) {
    if (!this.userContexts) return;
    this.userContexts.delete(telegramId.toString());
  }

  /**
   * Clean up expired sessions
   */
  async cleanupExpiredSessions() {
    try {
      const expiredCount = await this.db.cleanupExpiredPendingSessions();
      if (expiredCount > 0) {
        console.log('CoordinationService: Cleaned up expired sessions:', expiredCount);
      }
    } catch (error) {
      console.error('CoordinationService: Error during cleanup:', error);
    }
  }

  /**
   * Get all pending sessions for a user
   * @param {string} userId - User ID
   */
  async getPendingSessionsForUser(userId) {
    try {
      return await this.db.getPendingSessionsForUser(userId);
    } catch (error) {
      console.error('CoordinationService: Error getting pending sessions:', error);
      return [];
    }
  }

  // === SESSION MANAGEMENT ===

  /**
   * Request modification of a confirmed session
   * @param {string} sessionId - Session to modify
   * @param {Object} requester - User requesting modification
   * @param {string} newDate - New date
   * @param {number} newStartTime - New start time
   * @param {number} newEndTime - New end time
   * @param {string} reason - Reason for change
   */
  async requestSessionModification(sessionId, requester, newDate, newStartTime, newEndTime, reason) {
    try {
      const result = await this.db.requestSessionModification(
        sessionId, 
        requester, 
        newDate, 
        newStartTime, 
        newEndTime, 
        reason
      );

      if (!result.success) {
        return { error: result.error };
      }

      // Get the original session to notify partner
      const originalSession = await this.db.getSession(sessionId);
      if (originalSession) {
        // Get partner info
        const partnerId = originalSession.participants.find(id => id !== requester.id);
        const partnerData = await this.db.supabase
          .from('users')
          .select('*')
          .eq('id', partnerId)
          .single();

        if (partnerData.data) {
          const partner = partnerData.data;
          
          // Send modification request notification
          const modificationMessage = `🔄 **Session Modification Request**\n\n` +
            `${requester.name} wants to change your scheduled session:\n\n` +
            `**Original Time**: ${this.formatSessionTime(originalSession.date, originalSession.start_time, originalSession.end_time)}\n` +
            `**Proposed New Time**: ${this.formatSessionTime(newDate, newStartTime, newEndTime)}\n\n`;
          
          if (reason) {
            modificationMessage += `**Reason**: ${reason}\n\n`;
          }
          
          modificationMessage += `Reply with:\n• "Yes" to accept the change\n• "No" to keep original time\n• Or suggest a different time`;

          if (partner.telegram_id) {
            await this.bot.sendMessage(partner.telegram_id, modificationMessage, {
              parse_mode: 'Markdown'
            });

            // Store context for response handling
            this.storeUserContext(partner.telegram_id, {
              pendingSessionId: result.modificationId,
              waitingForResponse: true,
              isModification: true,
              originalSessionId: sessionId
            });
          }
        }
      }

      return { 
        success: true, 
        message: 'Modification request sent to your partner!',
        modificationId: result.modificationId
      };
    } catch (error) {
      console.error('CoordinationService: Error requesting modification:', error);
      return { error: 'Failed to request session modification' };
    }
  }

  /**
   * Cancel a confirmed session
   * @param {string} sessionId - Session to cancel
   * @param {Object} canceller - User cancelling
   * @param {string} reason - Reason for cancellation
   */
  async cancelSession(sessionId, canceller, reason) {
    try {
      const result = await this.db.cancelSession(sessionId, canceller, reason);

      if (!result.success) {
        return { error: result.error };
      }

      // Get the session to notify partner
      const session = await this.db.getSession(sessionId);
      if (session) {
        // Get partner info
        const partnerId = session.participants.find(id => id !== canceller.id);
        const partnerData = await this.db.supabase
          .from('users')
          .select('*')
          .eq('id', partnerId)
          .single();

        if (partnerData.data) {
          const partner = partnerData.data;
          
          // Send cancellation notification
          let cancellationMessage = `❌ **Session Cancelled**\n\n` +
            `${canceller.name} has cancelled your scheduled session:\n` +
            `📅 ${this.formatSessionTime(session.date, session.start_time, session.end_time)}\n\n`;
          
          if (reason) {
            cancellationMessage += `**Reason**: ${reason}\n\n`;
          }
          
          cancellationMessage += `Feel free to propose a new time when you're both available! 💪`;

          if (partner.telegram_id) {
            await this.bot.sendMessage(partner.telegram_id, cancellationMessage, {
              parse_mode: 'Markdown'
            });
          }
        }
      }

      return { 
        success: true, 
        message: 'Session cancelled. Your partner has been notified.',
        sessionId
      };
    } catch (error) {
      console.error('CoordinationService: Error cancelling session:', error);
      return { error: 'Failed to cancel session' };
    }
  }

  /**
   * Mark a session as completed
   * @param {string} sessionId - Session to mark as completed
   * @param {Object} user - User marking completion
   */
  async markSessionCompleted(sessionId, user) {
    try {
      const result = await this.db.markSessionCompleted(sessionId);

      if (!result.success) {
        return { error: result.error };
      }

      // Get the session to notify partner
      const session = await this.db.getSession(sessionId);
      if (session) {
        // Get partner info
        const partnerId = session.participants.find(id => id !== user.id);
        const partnerData = await this.db.supabase
          .from('users')
          .select('*')
          .eq('id', partnerId)
          .single();

        if (partnerData.data) {
          const partner = partnerData.data;
          
          // Send completion notification
          const completionMessage = `✅ **Workout Complete!**\n\n` +
            `${user.name} marked your session as completed:\n` +
            `📅 ${this.formatSessionTime(session.date, session.start_time, session.end_time)}\n\n` +
            `Great job on the workout! 💪🎉`;

          if (partner.telegram_id) {
            await this.bot.sendMessage(partner.telegram_id, completionMessage, {
              parse_mode: 'Markdown'
            });
          }
        }
      }

      return { 
        success: true, 
        message: 'Session marked as completed! Great workout! 🎉',
        sessionId
      };
    } catch (error) {
      console.error('CoordinationService: Error marking session completed:', error);
      return { error: 'Failed to mark session as completed' };
    }
  }

  /**
   * Get user's upcoming sessions
   * @param {string} userId - User ID
   * @param {number} limit - Number of sessions to return
   */
  async getUpcomingSessions(userId, limit = 5) {
    try {
      return await this.db.getUpcomingSessions(userId, limit);
    } catch (error) {
      console.error('CoordinationService: Error getting upcoming sessions:', error);
      return [];
    }
  }

  /**
   * Get user's session history
   * @param {string} userId - User ID
   * @param {string} status - Session status filter
   * @param {number} limit - Number of sessions to return
   */
  async getSessionHistory(userId, status = null, limit = 10) {
    try {
      return await this.db.getSessionsForUser(userId, status, limit);
    } catch (error) {
      console.error('CoordinationService: Error getting session history:', error);
      return [];
    }
  }

  /**
   * Get user's workout statistics
   * @param {string} userId - User ID
   */
  async getUserWorkoutStats(userId) {
    try {
      return await this.db.getUserWorkoutStats(userId);
    } catch (error) {
      console.error('CoordinationService: Error getting workout stats:', error);
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

  /**
   * Get formatted workout history for display
   * @param {string} userId - User ID
   * @param {number} limit - Number of sessions to return
   */
  async getFormattedWorkoutHistory(userId, limit = 10) {
    try {
      return await this.db.getWorkoutHistory(userId, limit);
    } catch (error) {
      console.error('CoordinationService: Error getting formatted workout history:', error);
      return [];
    }
  }

  /**
   * Generate workout statistics message for user
   * @param {Object} user - User object
   */
  async generateStatsMessage(user) {
    try {
      const stats = await this.getUserWorkoutStats(user.id);
      const history = await this.getFormattedWorkoutHistory(user.id, 5);

      let statsMessage = `📊 **${user.name}'s Workout Stats**\n\n`;
      
      // Main stats
      statsMessage += `🏋️ **Sessions**: ${stats.totalSessions} total\n`;
      statsMessage += `✅ **Completed**: ${stats.completedSessions}\n`;
      statsMessage += `❌ **Cancelled**: ${stats.cancelledSessions}\n`;
      statsMessage += `📈 **Success Rate**: ${stats.completionRate}%\n`;
      
      if (stats.currentStreak > 0) {
        statsMessage += `🔥 **Current Streak**: ${stats.currentStreak} sessions\n`;
      }
      
      if (stats.lastWorkout) {
        const lastWorkoutDate = new Date(stats.lastWorkout);
        const daysSince = Math.floor((new Date() - lastWorkoutDate) / (1000 * 60 * 60 * 24));
        statsMessage += `📅 **Last Workout**: ${daysSince === 0 ? 'Today' : `${daysSince} days ago`}\n`;
      }

      // Recent history
      if (history.length > 0) {
        statsMessage += `\n**Recent Sessions:**\n`;
        history.forEach(session => {
          statsMessage += `${session.statusEmoji} ${session.displayDate} - ${session.displayTime}\n`;
        });
      }

      statsMessage += `\n💪 Keep up the great work!`;

      return statsMessage;
    } catch (error) {
      console.error('CoordinationService: Error generating stats message:', error);
      return 'Sorry, I couldn\'t fetch your workout statistics right now. Please try again later.';
    }
  }

  // === AVAILABILITY MANAGEMENT ===

  /**
   * Update user availability based on natural language input
   * @param {Object} user - User object
   * @param {string} availabilityText - Natural language availability description
   */
  async updateUserAvailability(user, availabilityText) {
    try {
      console.log('CoordinationService: Updating availability for', user.name, 'input:', availabilityText);

      // Parse the availability text
      const parseResult = this.availabilityParser.parseAvailability(availabilityText);
      
      if (!parseResult.success || parseResult.slots.length === 0) {
        return {
          success: false,
          message: 'I couldn\'t understand your availability. Please try formats like:\n' +
                  '• "I\'m free Mondays 6-8pm"\n' +
                  '• "Available weekdays 8am-10am"\n' +
                  '• "Free Tuesday and Thursday 7-9pm"'
        };
      }

      // Validate the slots
      const validSlots = this.availabilityParser.validateSlots(parseResult.slots);
      
      if (validSlots.length === 0) {
        return {
          success: false,
          message: 'The availability times seem incorrect. Please check your time format.'
        };
      }

      // Update database
      const dbResult = await this.db.updateUserAvailability(user.id, validSlots);
      
      if (!dbResult.success) {
        return {
          success: false,
          message: `Database error: ${dbResult.error}`
        };
      }

      // Format response
      const formattedSlots = this.availabilityParser.formatSlotsForDisplay(validSlots);
      let responseMessage = `✅ **Availability Updated!**\n\n`;
      responseMessage += `Your new availability:\n${formattedSlots}\n\n`;
      
      // Check overlaps with partner
      const partnerInfo = await this.db.getPartnerInfo(user.id);
      if (partnerInfo) {
        const overlapInfo = await this.db.findOverlappingSlots(user.id);
        if (overlapInfo.overlap.length > 0) {
          responseMessage += `💪 **Overlapping times with ${overlapInfo.partnerName}:**\n`;
          overlapInfo.overlap.forEach(slot => {
            responseMessage += `• ${slot.day.charAt(0).toUpperCase() + slot.day.slice(1)}: ${slot.displayTime}\n`;
          });
        } else {
          responseMessage += `⚠️ **No overlapping times found with ${overlapInfo.partnerName}**\n`;
          responseMessage += `You might want to coordinate your schedules.`;
        }
      }

      return {
        success: true,
        message: responseMessage,
        slots: validSlots
      };
    } catch (error) {
      console.error('CoordinationService: Error updating availability:', error);
      return {
        success: false,
        message: 'Sorry, I couldn\'t update your availability right now. Please try again later.'
      };
    }
  }

  /**
   * Add availability slot for user
   * @param {Object} user - User object
   * @param {string} day - Day of the week
   * @param {number} startTime - Start hour (24-hour format)
   * @param {number} endTime - End hour (24-hour format)
   */
  async addAvailabilitySlot(user, day, startTime, endTime) {
    try {
      const result = await this.db.addAvailabilitySlot(user.id, day, startTime, endTime);
      
      if (!result.success) {
        return {
          success: false,
          message: `Failed to add availability: ${result.error}`
        };
      }

      const formattedTime = `${this.formatHour(startTime)} - ${this.formatHour(endTime)}`;
      const dayName = day.charAt(0).toUpperCase() + day.slice(1);
      
      return {
        success: true,
        message: `✅ Added availability: ${dayName} ${formattedTime}`,
        slot: result.slot
      };
    } catch (error) {
      console.error('CoordinationService: Error adding availability slot:', error);
      return {
        success: false,
        message: 'Sorry, I couldn\'t add that availability slot. Please try again.'
      };
    }
  }

  /**
   * Remove availability slots for user
   * @param {Object} user - User object
   * @param {string} day - Optional day to remove (all days if not specified)
   */
  async removeAvailabilitySlots(user, day = null) {
    try {
      const result = await this.db.removeAvailabilitySlots(user.id, day);
      
      if (!result.success) {
        return {
          success: false,
          message: `Failed to remove availability: ${result.error}`
        };
      }

      return {
        success: true,
        message: `✅ ${result.message}`,
      };
    } catch (error) {
      console.error('CoordinationService: Error removing availability slots:', error);
      return {
        success: false,
        message: 'Sorry, I couldn\'t remove availability slots. Please try again.'
      };
    }
  }

  /**
   * Get user availability in formatted display
   * @param {Object} user - User object
   */
  async getUserAvailabilityDisplay(user) {
    try {
      const availability = await this.db.getUserAvailability(user.id);
      
      if (!availability || availability.length === 0) {
        return {
          success: true,
          message: `📅 **${user.name}'s Availability**\n\nNo availability set yet.\n\n` +
                  'You can add availability by saying:\n' +
                  '"I\'m free Mondays 6-8pm" or "Available weekdays 8-10am"'
        };
      }

      // Group by day
      const byDay = {};
      availability.forEach(slot => {
        const day = slot.day.charAt(0).toUpperCase() + slot.day.slice(1);
        if (!byDay[day]) byDay[day] = [];
        byDay[day].push(slot.displayTime);
      });

      let message = `📅 **${user.name}'s Availability**\n\n`;
      
      const dayOrder = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
      for (const day of dayOrder) {
        if (byDay[day]) {
          message += `**${day}**: ${byDay[day].join(', ')}\n`;
        }
      }

      // Show overlaps with partner
      const partnerInfo = await this.db.getPartnerInfo(user.id);
      if (partnerInfo) {
        const overlapInfo = await this.db.findOverlappingSlots(user.id);
        if (overlapInfo.overlap.length > 0) {
          message += `\n💪 **Workout Times with ${overlapInfo.partnerName}:**\n`;
          overlapInfo.overlap.forEach(slot => {
            const day = slot.day.charAt(0).toUpperCase() + slot.day.slice(1);
            message += `• ${day}: ${slot.displayTime}\n`;
          });
        }
      }

      return {
        success: true,
        message,
        availability
      };
    } catch (error) {
      console.error('CoordinationService: Error getting availability display:', error);
      return {
        success: false,
        message: 'Sorry, I couldn\'t fetch your availability right now.'
      };
    }
  }

  /**
   * Check for availability conflicts before proposing a session
   * @param {Object} user - User proposing the session
   * @param {Object} partner - Partner user
   * @param {string} date - Session date
   * @param {number} startTime - Session start time
   * @param {number} endTime - Session end time
   */
  async checkSessionAvailability(user, partner, date, startTime, endTime) {
    try {
      return await this.db.checkAvailabilityConflict(user.id, partner.id, date, startTime, endTime);
    } catch (error) {
      console.error('CoordinationService: Error checking session availability:', error);
      return {
        hasConflicts: true,
        conflicts: ['Error checking availability'],
        userAvailable: false,
        partnerAvailable: false
      };
    }
  }

  /**
   * Enhanced session proposal with availability checking
   * @param {Object} proposalData - Session proposal details
   */
  async proposeSessionWithAvailabilityCheck(proposalData) {
    const { proposedBy, proposedTo, date, startTime, endTime } = proposalData;
    
    try {
      // Check availability conflicts
      const availabilityCheck = await this.checkSessionAvailability(
        proposedBy, proposedTo, date, startTime, endTime
      );
      
      if (availabilityCheck.hasConflicts) {
        let conflictMessage = '⚠️ **Availability Conflict**\n\n';
        conflictMessage += availabilityCheck.conflicts.join('\n');
        
        // Suggest alternative times
        const overlapInfo = await this.db.findOverlappingSlots(proposedBy.id);
        if (overlapInfo.overlap.length > 0) {
          conflictMessage += '\n\n💡 **Available times for both of you:**\n';
          overlapInfo.overlap.forEach(slot => {
            const day = slot.day.charAt(0).toUpperCase() + slot.day.slice(1);
            conflictMessage += `• ${day}: ${slot.displayTime}\n`;
          });
        }
        
        return {
          success: false,
          message: conflictMessage,
          conflicts: availabilityCheck.conflicts
        };
      }
      
      // Proceed with normal proposal if no conflicts
      const pendingSession = await this.proposeSession(proposalData);
      return {
        success: true,
        pendingSession,
        message: 'Session proposed successfully! ✅'
      };
    } catch (error) {
      console.error('CoordinationService: Error in enhanced session proposal:', error);
      // Fallback to normal proposal without availability check
      const pendingSession = await this.proposeSession(proposalData);
      return {
        success: true,
        pendingSession,
        message: 'Session proposed successfully! ✅'
      };
    }
  }
}

module.exports = CoordinationService;