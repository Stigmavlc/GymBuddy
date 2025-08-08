/**
 * Message Handler Service
 * 
 * This service handles the core logic of processing messages from the Telegram bot.
 * It coordinates between user identification, database operations, AI processing,
 * and response generation.
 * 
 * Main responsibilities:
 * - Identify users (Ivan vs Youssef)
 * - Build context from user data, availability, and chat history
 * - Call AI service to generate appropriate responses
 * - Store messages and responses in database
 * - Handle time parsing for scheduling requests
 */

const { identifyUser, getDisplayName } = require('../utils/userIdentifier');
const { parseTime, containsTimeReference } = require('../utils/timeParser');

class MessageHandler {
  constructor(databaseService, aiService, coordinationService) {
    this.db = databaseService;
    this.ai = aiService;
    this.coordination = coordinationService;
    
    // Track processing stats
    this.stats = {
      messagesProcessed: 0,
      identifiedUsers: 0,
      schedulingRequests: 0,
      errors: 0
    };
  }

  /**
   * Main message processing function
   * @param {Object} telegramMessage - Full Telegram message object
   * @returns {Object} - { success, response, context, error }
   */
  async processMessage(telegramMessage) {
    const startTime = Date.now();
    
    try {
      console.log('MessageHandler: Processing message from:', telegramMessage.from?.first_name);
      
      // Step 1: Extract message data
      const messageData = this.extractMessageData(telegramMessage);
      
      // Step 2: Identify user
      const userIdentification = this.identifyMessageUser(messageData);
      
      // Step 3: Get or create user in database
      const userRecord = await this.getUserRecord(userIdentification, messageData);
      
      if (!userRecord) {
        return this.createErrorResponse('Unable to identify or create user record', messageData);
      }

      // Step 4: Build full context
      const context = await this.buildMessageContext(userRecord, messageData);
      
      // Step 5: Store incoming message
      await this.storeUserMessage(userRecord.id, messageData.text, context);
      
      // Step 6: Check for time parsing if message contains time references
      const timeParsingResult = this.parseTimeFromMessage(messageData.text);
      if (timeParsingResult.success) {
        context.parsedTime = timeParsingResult;
        console.log('MessageHandler: Parsed time from message:', timeParsingResult);
      }

      // Step 6.5: Check if this is a response to a pending session proposal
      if (this.coordination) {
        const coordinationResponse = await this.coordination.handleResponse(
          userRecord.telegram_id.toString(), 
          messageData.text, 
          context
        );
        
        if (coordinationResponse) {
          // Check if coordination service wants AI to handle this
          if (coordinationResponse.needsAiProcessing) {
            console.log('MessageHandler: Coordination service requests AI processing for complex response');
            // Add coordination context to regular context
            context.pendingSession = coordinationResponse.context.pendingSession;
            context.respondingToPendingSession = true;
            // Continue to AI processing below
          } else {
            // This was handled by coordination service
            console.log('MessageHandler: Message handled by coordination service');
            return {
              success: true,
              response: coordinationResponse.message || 'Response processed.',
              context: context,
              userRecord: userRecord,
              handledByCoordination: true
            };
          }
        }
      }

      // Step 7: Generate AI response with action detection
      const aiResult = await this.ai.generateResponse(messageData.text, context);
      
      // Step 8: Execute any actions Claude suggests
      const actionResults = await this.executeActions(aiResult.actions, context);
      
      // Step 9: Store bot response
      await this.storeBotResponse(userRecord.id, aiResult.response, { ...context, actionResults });
      
      // Step 10: Update user activity
      await this.db.updateUserActivity(userRecord.telegram_id);
      
      // Update stats
      this.stats.messagesProcessed++;
      if (userIdentification.userType !== 'unknown') {
        this.stats.identifiedUsers++;
      }
      if (this.isSchedulingMessage(messageData.text)) {
        this.stats.schedulingRequests++;
      }

      const processingTime = Date.now() - startTime;
      console.log(`MessageHandler: Processed message in ${processingTime}ms`);

      return {
        success: true,
        response: aiResult.response,
        actions: aiResult.actions,
        actionResults: actionResults,
        context: context,
        userRecord: userRecord,
        processingTime: processingTime
      };

    } catch (error) {
      console.error('MessageHandler: Error processing message:', error);
      this.stats.errors++;
      
      return this.createErrorResponse(
        'Sorry, I encountered an error processing your message. Please try again!',
        messageData,
        error
      );
    }
  }

  /**
   * Extract relevant data from Telegram message
   * @param {Object} telegramMessage - Raw Telegram message
   * @returns {Object} - Cleaned message data
   */
  extractMessageData(telegramMessage) {
    return {
      telegramId: telegramMessage.from?.id,
      telegramUser: telegramMessage.from,
      text: telegramMessage.text || '',
      messageId: telegramMessage.message_id,
      date: telegramMessage.date,
      chatId: telegramMessage.chat?.id,
      chatType: telegramMessage.chat?.type
    };
  }

  /**
   * Identify user type and get display name
   * @param {Object} messageData - Extracted message data
   * @returns {Object} - User identification result
   */
  identifyMessageUser(messageData) {
    // CRITICAL FIX: Add the Telegram ID to the user object so UserIdentifier can use it
    const telegramUserWithId = {
      ...messageData.telegramUser,
      id: messageData.telegramId  // This is the missing piece!
    };
    
    const userType = identifyUser(telegramUserWithId);
    const displayName = getDisplayName(userType, telegramUserWithId);
    
    console.log(`MessageHandler: Identified user as ${userType} (${displayName})`);
    
    return {
      userType,
      displayName,
      telegramId: messageData.telegramId,
      telegramUser: telegramUserWithId
    };
  }

  /**
   * Get existing user record or handle unknown users
   * @param {Object} userIdentification - User identification result
   * @param {Object} messageData - Message data
   * @returns {Object|null} - User record from database
   */
  async getUserRecord(userIdentification, messageData) {
    try {
      // Try to get existing user by Telegram ID
      let userRecord = await this.db.getUserByTelegramId(userIdentification.telegramId);
      
      if (userRecord) {
        console.log('MessageHandler: Found existing user record');
        return userRecord;
      }

      // If user is unknown, we can't create a record automatically
      // This requires manual setup in the database
      if (userIdentification.userType === 'unknown') {
        console.warn('MessageHandler: Unknown user attempted to use bot:', {
          telegramId: userIdentification.telegramId,
          name: userIdentification.displayName
        });
        return null;
      }

      // For known users (Ivan/Youssef), we should have records already
      // Log this as a warning since they should be pre-configured
      console.warn(`MessageHandler: Known user ${userIdentification.userType} not found in database`);
      return null;

    } catch (error) {
      console.error('MessageHandler: Error getting user record:', error);
      return null;
    }
  }

  /**
   * Build comprehensive context for AI response generation
   * @param {Object} userRecord - User database record
   * @param {Object} messageData - Message data
   * @returns {Object} - Complete context object
   */
  async buildMessageContext(userRecord, messageData) {
    try {
      const context = {
        userName: userRecord.name || messageData.telegramUser?.first_name || 'User',
        userType: userRecord.user_type || 'unknown',
        userId: userRecord.id,
        telegramId: userRecord.telegram_id
      };

      // Get user's availability
      console.log('MessageHandler: Fetching user availability...');
      context.availability = await this.db.getUserAvailability(userRecord.id);

      // Get partner information and availability
      console.log('MessageHandler: Fetching partner information...');
      const partnerInfo = await this.db.getPartnerInfo(userRecord.id);
      if (partnerInfo) {
        context.partnerName = partnerInfo.name;
        context.partnerId = partnerInfo.id;
        context.partnerAvailability = await this.db.getPartnerAvailability(partnerInfo.id);
        
        // Find overlapping availability slots
        const overlappingSlots = await this.db.findOverlappingSlots(userRecord.id);
        context.overlappingSlots = overlappingSlots.overlap || [];
      } else {
        context.partnerId = null;
      }

      // Get recent chat history
      console.log('MessageHandler: Fetching chat history...');
      context.chatHistory = await this.db.getChatHistory(userRecord.id, 10);

      // Get upcoming sessions
      console.log('MessageHandler: Fetching upcoming sessions...');
      context.upcomingSessions = await this.db.getUpcomingSessions(userRecord.id, 5);

      // Add message metadata
      context.messageMetadata = {
        isSchedulingRequest: this.isSchedulingMessage(messageData.text),
        containsTimeReference: containsTimeReference(messageData.text),
        messageLength: messageData.text.length,
        timestamp: new Date().toISOString()
      };

      console.log('MessageHandler: Built context with:', {
        availabilitySlots: context.availability?.length || 0,
        partnerAvailable: !!context.partnerName,
        partnerSlots: context.partnerAvailability?.length || 0,
        overlappingSlots: context.overlappingSlots?.length || 0,
        historyMessages: context.chatHistory?.length || 0,
        upcomingSessions: context.upcomingSessions?.length || 0
      });

      return context;

    } catch (error) {
      console.error('MessageHandler: Error building context:', error);
      
      // Return minimal context on error
      return {
        userName: userRecord.name || 'User',
        userType: userRecord.user_type || 'unknown',
        userId: userRecord.id,
        availability: [],
        chatHistory: [],
        error: 'Context building failed'
      };
    }
  }

  /**
   * Store user message in database
   * @param {string} userId - User ID
   * @param {string} messageText - Message text
   * @param {Object} context - Full context object
   * @returns {boolean} - Success status
   */
  async storeUserMessage(userId, messageText, context) {
    try {
      const sessionContext = {
        userType: context.userType,
        hasAvailability: (context.availability?.length || 0) > 0,
        hasPartner: !!context.partnerName,
        messageMetadata: context.messageMetadata
      };

      const success = await this.db.storeChatMessage(
        userId,
        messageText,
        'user_message',
        sessionContext
      );

      if (success) {
        console.log('MessageHandler: Stored user message successfully');
      } else {
        console.warn('MessageHandler: Failed to store user message');
      }

      return success;
    } catch (error) {
      console.error('MessageHandler: Error storing user message:', error);
      return false;
    }
  }

  /**
   * Store bot response in database
   * @param {string} userId - User ID
   * @param {string} responseText - Bot response text
   * @param {Object} context - Full context object
   * @returns {boolean} - Success status
   */
  async storeBotResponse(userId, responseText, context) {
    try {
      const sessionContext = {
        userType: context.userType,
        responseGenerated: true,
        contextQuality: this.assessContextQuality(context),
        overlappingSlotsFound: (context.overlappingSlots?.length || 0) > 0
      };

      const success = await this.db.storeBotResponse(userId, responseText, sessionContext);

      if (success) {
        console.log('MessageHandler: Stored bot response successfully');
      } else {
        console.warn('MessageHandler: Failed to store bot response');
      }

      return success;
    } catch (error) {
      console.error('MessageHandler: Error storing bot response:', error);
      return false;
    }
  }

  /**
   * Parse time references from message text
   * @param {string} messageText - Message text to parse
   * @returns {Object} - Time parsing result
   */
  parseTimeFromMessage(messageText) {
    if (!containsTimeReference(messageText)) {
      return { success: false, reason: 'No time reference detected' };
    }

    return parseTime(messageText);
  }

  /**
   * Check if message is about scheduling/gym sessions
   * @param {string} messageText - Message text
   * @returns {boolean} - True if scheduling-related
   */
  isSchedulingMessage(messageText) {
    if (!messageText) return false;

    const schedulingKeywords = [
      'schedule', 'book', 'plan', 'available', 'free', 'gym',
      'workout', 'session', 'when', 'time', 'meet', 'train',
      'availability', 'calendar', 'tomorrow', 'today', 'week',
      'monday', 'tuesday', 'wednesday', 'thursday', 'friday',
      'saturday', 'sunday', 'morning', 'afternoon', 'evening'
    ];

    const lowerText = messageText.toLowerCase();
    return schedulingKeywords.some(keyword => lowerText.includes(keyword));
  }

  /**
   * Assess the quality of built context for debugging
   * @param {Object} context - Context object
   * @returns {string} - Quality assessment
   */
  assessContextQuality(context) {
    let score = 0;
    const checks = [];

    if (context.availability && context.availability.length > 0) {
      score += 2;
      checks.push('has_availability');
    }

    if (context.partnerName) {
      score += 2;
      checks.push('has_partner');
    }

    if (context.partnerAvailability && context.partnerAvailability.length > 0) {
      score += 2;
      checks.push('partner_has_availability');
    }

    if (context.overlappingSlots && context.overlappingSlots.length > 0) {
      score += 3;
      checks.push('overlapping_slots_found');
    }

    if (context.chatHistory && context.chatHistory.length > 0) {
      score += 1;
      checks.push('has_history');
    }

    if (score >= 7) return 'excellent';
    if (score >= 5) return 'good';
    if (score >= 3) return 'fair';
    return 'poor';
  }

  /**
   * Create error response object
   * @param {string} message - Error message for user
   * @param {Object} messageData - Original message data
   * @param {Error} error - Original error (optional)
   * @returns {Object} - Error response
   */
  createErrorResponse(message, messageData, error = null) {
    return {
      success: false,
      response: message,
      error: error?.message || 'Unknown error',
      context: {
        userName: messageData?.telegramUser?.first_name || 'User',
        userType: 'unknown',
        errorOccurred: true
      }
    };
  }

  /**
   * Get processing statistics
   * @returns {Object} - Current stats
   */
  getStats() {
    return {
      ...this.stats,
      uptime: process.uptime(),
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Reset statistics
   */
  resetStats() {
    this.stats = {
      messagesProcessed: 0,
      identifiedUsers: 0,
      schedulingRequests: 0,
      errors: 0
    };
    console.log('MessageHandler: Statistics reset');
  }

  /**
   * Execute actions suggested by Claude AI
   * @param {Array} actions - Array of action objects from AI
   * @param {Object} context - Current message context
   * @returns {Array} - Results of action execution
   */
  async executeActions(actions, context) {
    const results = [];

    if (!actions || actions.length === 0) {
      console.log('MessageHandler: No actions to execute');
      return results;
    }

    console.log(`MessageHandler: Executing ${actions.length} action(s)`);

    for (const action of actions) {
      try {
        const result = await this.executeAction(action, context);
        results.push(result);
      } catch (error) {
        console.error('MessageHandler: Error executing action:', action, error);
        results.push({
          action: action.type,
          success: false,
          error: error.message
        });
      }
    }

    return results;
  }

  /**
   * Execute a single action
   * @param {Object} action - Action object with type and data
   * @param {Object} context - Current message context
   * @returns {Object} - Execution result
   */
  async executeAction(action, context) {
    console.log('MessageHandler: Executing action:', action.type, action.data);

    switch (action.type) {
      case 'create_session':
        return await this.executeCreateSession(action.data, context);
      
      case 'update_availability':
        return await this.executeUpdateAvailability(action.data, context);
      
      case 'clear_availability':
        return await this.executeClearAvailability(action.data, context);
      
      default:
        console.warn('MessageHandler: Unknown action type:', action.type);
        return {
          action: action.type,
          success: false,
          error: 'Unknown action type'
        };
    }
  }

  /**
   * Execute session creation action
   * @param {Object} sessionData - Session creation data
   * @param {Object} context - Current message context
   * @returns {Object} - Creation result
   */
  async executeCreateSession(sessionData, context) {
    try {
      const { participants, date, start_time, end_time, confidence } = sessionData;

      console.log('MessageHandler: Creating session proposal (not direct booking):', {
        participants,
        date,
        start_time,
        end_time,
        confidence
      });

      // Validate session data
      if (!participants || participants.length < 2) {
        throw new Error('Need at least 2 participants for session');
      }

      if (!date || !start_time || !end_time) {
        throw new Error('Missing required session details');
      }

      // Get user records for both participants
      const proposerRecord = context.userRecord;
      const partnerRecord = context.partnerRecord;

      if (!proposerRecord || !partnerRecord) {
        throw new Error('Cannot find both user records for coordination');
      }

      // Use coordination service to propose session instead of creating directly
      if (this.coordination) {
        const pendingSession = await this.coordination.proposeSession({
          proposedBy: proposerRecord,
          proposedTo: partnerRecord,
          date: date,
          startTime: start_time,
          endTime: end_time,
          message: context.originalMessage || 'Gym session proposal'
        });

        console.log('MessageHandler: ✅ Session proposal created, waiting for partner confirmation');
        return {
          action: 'propose_session',
          success: true,
          pendingSessionId: pendingSession.id,
          message: `Session proposed to ${partnerRecord.name}! They'll receive a notification to confirm.`,
          data: sessionData
        };
      } else {
        // Fallback to direct creation if no coordination service
        const sessionResult = await this.db.createSession(
          participants,
          date,
          start_time,
          end_time
        );

        return {
          action: 'create_session',
          success: !!sessionResult,
          sessionId: sessionResult?.id || 'unknown',
          data: sessionData
        };
      }

    } catch (error) {
      console.error('MessageHandler: ❌ Session proposal failed:', error);
      return {
        action: 'propose_session',
        success: false,
        error: error.message,
        data: sessionData
      };
    }
  }

  /**
   * Execute availability update action
   * @param {Object} availabilityData - Availability update data
   * @param {Object} context - Current message context
   * @returns {Object} - Update result
   */
  async executeUpdateAvailability(availabilityData, context) {
    try {
      const { user_id, day, start_time, end_time, confidence } = availabilityData;

      console.log('MessageHandler: Updating availability:', {
        user_id,
        day,
        start_time,
        end_time,
        confidence
      });

      // Validate availability data
      if (!user_id || !day || start_time === undefined || end_time === undefined) {
        throw new Error('Missing required availability details');
      }

      // Clear any existing availability for this day first
      await this.db.removeAvailabilitySlots(user_id, day);

      // Add the new availability slot
      const result = await this.db.addAvailabilitySlot(
        user_id,
        day,
        start_time,
        end_time
      );

      if (result && result.success) {
        console.log('MessageHandler: ✅ Availability updated successfully');
        return {
          action: 'update_availability',
          success: true,
          message: `Updated availability for ${day.charAt(0).toUpperCase() + day.slice(1)}`,
          data: availabilityData
        };
      } else {
        throw new Error(result?.error || 'Database update failed');
      }

    } catch (error) {
      console.error('MessageHandler: ❌ Availability update failed:', error);
      return {
        action: 'update_availability',
        success: false,
        error: error.message,
        data: availabilityData
      };
    }
  }

  /**
   * Execute availability clear action
   * @param {Object} clearData - Availability clear data
   * @param {Object} context - Current message context
   * @returns {Object} - Clear result
   */
  async executeClearAvailability(clearData, context) {
    try {
      const { user_id, day, confidence } = clearData;

      console.log('MessageHandler: Clearing availability:', {
        user_id,
        day,
        confidence
      });

      // Validate clear data
      if (!user_id || !day) {
        throw new Error('Missing required clear availability details');
      }

      // Clear availability for the specified day
      const result = await this.db.removeAvailabilitySlots(user_id, day);

      if (result && result.success) {
        console.log('MessageHandler: ✅ Availability cleared successfully');
        return {
          action: 'clear_availability',
          success: true,
          message: `Cleared availability for ${day.charAt(0).toUpperCase() + day.slice(1)}`,
          data: clearData
        };
      } else {
        throw new Error(result?.error || 'Database clear failed');
      }

    } catch (error) {
      console.error('MessageHandler: ❌ Availability clear failed:', error);
      return {
        action: 'clear_availability',
        success: false,
        error: error.message,
        data: clearData
      };
    }
  }

  /**
   * Health check for the message handler
   * @returns {Object} - Health status
   */
  async healthCheck() {
    try {
      const checks = {
        databaseConnection: false,
        aiService: false,
        overallHealth: false
      };

      // Test database connection
      try {
        // This is a simple test - in a real scenario, you might ping the database
        checks.databaseConnection = !!this.db;
        console.log('MessageHandler: Database service check passed');
      } catch (error) {
        console.error('MessageHandler: Database service check failed:', error);
      }

      // Test AI service
      try {
        checks.aiService = !!this.ai;
        console.log('MessageHandler: AI service check passed');
      } catch (error) {
        console.error('MessageHandler: AI service check failed:', error);
      }

      checks.overallHealth = checks.databaseConnection && checks.aiService;

      return {
        healthy: checks.overallHealth,
        checks,
        stats: this.getStats(),
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      console.error('MessageHandler: Health check failed:', error);
      return {
        healthy: false,
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }
}

module.exports = MessageHandler;