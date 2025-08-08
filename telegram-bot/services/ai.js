const Anthropic = require('@anthropic-ai/sdk');

class AIService {
  constructor(apiKey) {
    this.anthropic = new Anthropic({
      apiKey: apiKey
    });
    this.model = 'claude-3-5-sonnet-20241022';
  }

  // Generate AI response with full context and action detection
  async generateResponse(userMessage, context) {
    try {
      const { userName, userType, chatHistory, availability, partnerAvailability, partnerName, userId, partnerId } = context;

      // Build conversation history string
      const historyString = this.buildChatHistory(chatHistory);
      
      // Build availability string
      const availabilityString = this.buildAvailabilityString(availability);
      const partnerAvailabilityString = partnerAvailability ? 
        this.buildAvailabilityString(partnerAvailability) : 
        'Not set yet';

      // Build overlapping slots context
      const overlappingSlots = context.overlappingSlots || [];
      const overlappingString = this.buildOverlappingSlots(overlappingSlots);

      // Build the prompt
      const systemPrompt = this.getSystemPrompt();
      const userPrompt = this.buildUserPrompt({
        userName,
        userType,
        userMessage,
        historyString,
        availabilityString,
        partnerName: partnerName || 'your partner',
        partnerAvailabilityString,
        overlappingString,
        userId,
        partnerId
      });

      // Call Claude API with retry logic for overload errors
      const response = await this.callClaudeWithRetry({
        model: this.model,
        max_tokens: 1200,
        temperature: 0.7,
        messages: [
          {
            role: 'user',
            content: userPrompt
          }
        ],
        system: systemPrompt
      });

      // Extract and parse response
      const responseText = response.content[0].text;
      return this.parseStructuredResponse(responseText, context);

    } catch (error) {
      console.error('AI Service Error:', error);
      
      // Provide specific error messages for different error types
      if (error.status === 529) {
        return {
          response: "🤖 Claude is experiencing high traffic right now. Please try your message again in a few seconds!",
          actions: []
        };
      }
      
      return {
        response: "Sorry, I'm having trouble processing that right now. Please try again in a moment!",
        actions: []
      };
    }
  }

  // Call Claude API with retry logic for overload errors
  async callClaudeWithRetry(params, maxRetries = 3, baseDelay = 1000) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await this.anthropic.messages.create(params);
      } catch (error) {
        console.log(`AI Service: Attempt ${attempt}/${maxRetries} failed:`, error.status, error.message);
        
        // Only retry on overload errors (529) or rate limits (429)
        if ((error.status === 529 || error.status === 429) && attempt < maxRetries) {
          const delay = baseDelay * Math.pow(2, attempt - 1); // Exponential backoff
          console.log(`AI Service: Retrying in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
        
        // Re-throw the error if we can't retry or have exhausted retries
        throw error;
      }
    }
  }

  // Build chat history string from array
  buildChatHistory(chatHistory) {
    if (!chatHistory || chatHistory.length === 0) {
      return "No previous conversation";
    }

    return chatHistory
      .map(msg => {
        const type = msg.message_type === 'user_message' ? 'User' : 'Bot';
        const text = msg.message_text || msg.response_text || '';
        return `${type}: ${text}`;
      })
      .join('\n');
  }

  // Build availability string from array
  buildAvailabilityString(availability) {
    if (!availability || availability.length === 0) {
      return "No availability set yet";
    }

    return availability
      .map(slot => `- ${this.capitalizeDay(slot.day)}: ${slot.displayTime}`)
      .join('\n');
  }

  // Get system prompt with action instructions
  getSystemPrompt() {
    return `You are GymBuddy, a friendly AI assistant helping Ivan and Youssef coordinate their gym sessions. You're like a reliable friend who genuinely cares about their fitness goals.

**IMPORTANT RULES:**
1. ALWAYS prioritize and respond to the user's current message first
2. Don't introduce yourself unless users seem confused
3. Be natural and conversational, not overly enthusiastic
4. Use minimal emojis (max 1-2 per message)
5. Keep responses concise and helpful

**Your Main Job:**
- Help coordinate gym sessions between Ivan and Youssef
- Manage their availability schedules
- Check for conflicts and suggest optimal workout times
- Send reminders about setting availability if needed
- Track their progress and celebrate achievements
- Answer any questions they have

**Communication Style:**
- Be supportive but not pushy
- Write like a helpful friend, not a cheerleader
- If they ask about non-gym topics, answer naturally
- After addressing their question, you can gently mention gym scheduling if relevant

**AVAILABILITY MANAGEMENT:**
You can help users manage their gym availability:
- Parse natural language like "I'm free Mondays 6-8pm"
- Update their availability based on their preferences
- Show current availability and overlapping times
- Clear or modify existing availability
- Check for conflicts when booking sessions

Examples of availability management:
- "I'm free weekdays 6-8pm" → Update availability
- "Show my availability" → Display current schedule
- "I'm not available Mondays anymore" → Remove Monday availability
- "Clear my schedule" → Remove all availability

**When Both Have Availability:**
- Find overlapping time slots
- Suggest 2-3 best options
- Consider their preferences (morning vs evening)
- Help them confirm sessions

**CRITICAL: SESSION COORDINATION PROCESS:**
When users want to book a gym session, you PROPOSE it to their partner for confirmation. DO NOT book sessions immediately!

**COORDINATION FLOW:**
1. User suggests a session time
2. You propose it to their partner via notification
3. Partner receives notification asking for confirmation
4. Only after both confirm do we create the actual session
5. You help coordinate back-and-forth negotiations if needed

Examples of booking intent:
- "Let's book Monday at 10pm" 
- "Yes, let's do it" (when discussing specific times)
- "Sounds good, confirm that session"
- "Yeah, let's go ahead for Monday"

**SESSION MANAGEMENT:**
You can also help with existing sessions:
- Cancel sessions with partner notification
- Reschedule sessions (with partner approval)
- Mark sessions as completed
- Delete sessions permanently
- Show workout statistics and history

**MANDATORY RESPONSE FORMAT:**
You MUST ALWAYS use this exact format:

[RESPONSE]
Your conversational response about the action you're taking
[/RESPONSE]

[ACTION]
If booking detected: CREATE_SESSION|YYYY-MM-DD|start_hour|end_hour|0.95
If availability update detected: UPDATE_AVAILABILITY|day|start_hour|end_hour|0.95
If clearing availability: CLEAR_AVAILABILITY|day|0.95
If no action: NONE
[/ACTION]

**CRITICAL ACTION RULES:**
- ONLY generate ONE action per message
- NEVER combine UPDATE_AVAILABILITY and CLEAR_AVAILABILITY for the same day
- When user sets new availability, use UPDATE_AVAILABILITY (this replaces existing)
- Only use CLEAR_AVAILABILITY when user explicitly says to remove/clear availability

**EXAMPLES:**
User: "Let's book Monday at 10pm"
Your response:
[RESPONSE]
Great idea! I'll send a notification to Youssef asking if Monday at 10pm works for him. You'll both get updates as we coordinate this session! 💪
[/RESPONSE]

[ACTION]
CREATE_SESSION|2025-08-11|22|24|0.95
[/ACTION]

User: "I'm free Tuesday 2-4pm"
Your response:
[RESPONSE]
I'll add Tuesday 2-4pm to your availability schedule. Just to note, this time slot currently doesn't overlap with Youssef's schedule, but it's good to have more options!
[/RESPONSE]

[ACTION]
UPDATE_AVAILABILITY|tuesday|14|16|0.95
[/ACTION]

Remember: The user's current message is the MOST important thing to address.`;
  }

  // Build user prompt with context including overlapping slots
  buildUserPrompt(context) {
    const { userName, userType, userMessage, historyString, availabilityString, partnerName, partnerAvailabilityString, overlappingString, userId, partnerId } = context;

    let prompt = `User: ${userName} (${userType})
User ID: ${userId}
Partner ID: ${partnerId}
Current Message: ${userMessage}

Recent Conversation History (last 10 messages):
${historyString}

${userName}'s availability:
${availabilityString}

${partnerName}'s availability:
${partnerAvailabilityString}

Overlapping time slots (when both are free):
${overlappingString}

Current date: ${new Date().toISOString().split('T')[0]}`;

    // Add coordination context if user is responding to a pending session
    if (context.respondingToPendingSession && context.pendingSession) {
      const session = context.pendingSession;
      prompt += `\n\nIMPORTANT CONTEXT: The user is responding to a pending session proposal:
- Proposed session: ${session.date} ${session.startTime}:00-${session.endTime}:00
- Proposed by: ${session.proposedBy.name}
- Their message: "${userMessage}"

The coordination system couldn't automatically handle this response, so please provide a natural, conversational reply that acknowledges their message and helps coordinate the session appropriately. You can suggest alternatives, ask for clarification, or help them communicate with their partner.`;
    }

    prompt += `\n\nIMPORTANT: Respond primarily to the user's current message "${userMessage}". Use the availability data as context only if relevant to their question.

Remember to use the [RESPONSE] and [ACTION] format in your reply.`;

    return prompt;
  }

  // Helper to capitalize day names
  capitalizeDay(day) {
    return day.charAt(0).toUpperCase() + day.slice(1);
  }

  // Analyze if message is asking about scheduling
  isSchedulingRequest(message) {
    const schedulingKeywords = [
      'schedule', 'book', 'plan', 'available', 'free', 'gym',
      'workout', 'session', 'when', 'time', 'meet', 'train',
      'availability', 'calendar', 'tomorrow', 'today', 'week'
    ];

    const lowerMessage = message.toLowerCase();
    return schedulingKeywords.some(keyword => lowerMessage.includes(keyword));
  }

  // Generate a scheduling-focused response
  async generateSchedulingResponse(overlappingSlots, context) {
    const { userName, partnerName } = context;

    if (!overlappingSlots || overlappingSlots.length === 0) {
      return `Hey ${userName}! I checked both your schedules, but it looks like you and ${partnerName} don't have any overlapping availability this week. Maybe one of you could adjust your schedule? Let me know when you've updated your availability!`;
    }

    // Format top 3 suggestions
    const suggestions = overlappingSlots
      .slice(0, 3)
      .map((slot, index) => `${index + 1}. ${this.capitalizeDay(slot.day)} ${slot.displayTime}`)
      .join('\n');

    return `Great news ${userName}! I found ${overlappingSlots.length} time slot${overlappingSlots.length > 1 ? 's' : ''} that work for both you and ${partnerName}:

${suggestions}

Which one works best for you? Just let me know and I'll set it up! 💪`;
  }

  // Build overlapping slots string
  buildOverlappingSlots(overlappingSlots) {
    if (!overlappingSlots || overlappingSlots.length === 0) {
      return "No overlapping time slots found";
    }

    return overlappingSlots
      .map(slot => `- ${this.capitalizeDay(slot.day)}: ${slot.displayTime} (both free)`)
      .join('\n');
  }

  // Parse structured response from Claude
  parseStructuredResponse(responseText, context) {
    try {
      // Extract response and action sections
      const responseMatch = responseText.match(/\[RESPONSE\](.*?)\[\/RESPONSE\]/s);
      const actionMatch = responseText.match(/\[ACTION\](.*?)\[\/ACTION\]/s);

      const response = responseMatch ? responseMatch[1].trim() : responseText;
      const actionText = actionMatch ? actionMatch[1].trim() : 'NONE';

      // Parse actions from ACTION section
      let actions = this.parseActions(actionText, context);

      // FALLBACK: If no actions found but response indicates booking, try to extract from text
      if (actions.length === 0 && this.detectBookingInResponse(response, context)) {
        console.log('AI Service: No ACTION section found, but detected booking in response. Attempting fallback extraction...');
        actions = this.extractBookingFromResponse(response, context);
      }

      console.log('AI Service: Parsed response with actions:', {
        responseLength: response.length,
        actionsCount: actions.length,
        hasBookingAction: actions.some(a => a.type === 'create_session'),
        usedFallback: actionText === 'NONE' && actions.length > 0
      });

      return {
        response,
        actions
      };

    } catch (error) {
      console.error('AI Service: Error parsing structured response:', error);
      return {
        response: responseText,
        actions: []
      };
    }
  }

  // Parse action commands from Claude
  parseActions(actionText, context) {
    const actions = [];

    if (!actionText || actionText === 'NONE') {
      return actions;
    }

    // Parse CREATE_SESSION actions
    const sessionMatch = actionText.match(/CREATE_SESSION\|([^|]+)\|(\d+)\|(\d+)\|([\d.]+)/);
    if (sessionMatch) {
      const [, date, startTime, endTime, confidence] = sessionMatch;
      
      // Validate confidence threshold
      if (parseFloat(confidence) >= 0.9) {
        actions.push({
          type: 'create_session',
          data: {
            participants: [context.userId, context.partnerId].filter(Boolean),
            date: date,
            start_time: parseInt(startTime),
            end_time: parseInt(endTime),
            confidence: parseFloat(confidence)
          }
        });

        console.log('AI Service: Detected session creation action:', actions[0]);
      } else {
        console.log('AI Service: Session creation confidence too low:', confidence);
      }
    }

    // Parse UPDATE_AVAILABILITY actions
    const availabilityMatch = actionText.match(/UPDATE_AVAILABILITY\|([^|]+)\|(\d+)\|(\d+)\|([\d.]+)/);
    if (availabilityMatch) {
      const [, day, startTime, endTime, confidence] = availabilityMatch;
      
      // Validate confidence threshold (lower threshold for availability updates)
      if (parseFloat(confidence) >= 0.8) {
        // Database expects hours (0-23), not half-hour slots
        const startHour = parseInt(startTime);
        const endHour = parseInt(endTime);
        
        actions.push({
          type: 'update_availability',
          data: {
            user_id: context.userId,
            day: day.toLowerCase(),
            start_time: startHour,
            end_time: endHour,
            confidence: parseFloat(confidence)
          }
        });

        console.log('AI Service: Detected availability update action:', actions[actions.length - 1]);
      } else {
        console.log('AI Service: Availability update confidence too low:', confidence);
      }
    }

    // Parse CLEAR_AVAILABILITY actions
    const clearMatch = actionText.match(/CLEAR_AVAILABILITY\|([^|]+)\|([\d.]+)/);
    if (clearMatch) {
      const [, day, confidence] = clearMatch;
      
      // Validate confidence threshold
      if (parseFloat(confidence) >= 0.8) {
        actions.push({
          type: 'clear_availability',
          data: {
            user_id: context.userId,
            day: day.toLowerCase(),
            confidence: parseFloat(confidence)
          }
        });

        console.log('AI Service: Detected availability clear action:', actions[actions.length - 1]);
      } else {
        console.log('AI Service: Availability clear confidence too low:', confidence);
      }
    }

    // Validate and resolve conflicts between actions
    const validatedActions = this.resolveActionConflicts(actions);
    
    return validatedActions;
  }
  
  // Resolve conflicts between actions (e.g., update + clear for same day)
  resolveActionConflicts(actions) {
    const resolvedActions = [];
    const dayConflicts = new Map(); // Track actions by day
    
    // Group actions by day to detect conflicts
    for (const action of actions) {
      if (action.type === 'update_availability' || action.type === 'clear_availability') {
        const day = action.data.day;
        
        if (!dayConflicts.has(day)) {
          dayConflicts.set(day, []);
        }
        dayConflicts.get(day).push(action);
      } else {
        // Non-availability actions don't conflict
        resolvedActions.push(action);
      }
    }
    
    // Resolve conflicts for each day
    for (const [day, dayActions] of dayConflicts.entries()) {
      if (dayActions.length === 1) {
        // No conflict, add the single action
        resolvedActions.push(dayActions[0]);
      } else {
        // Conflict detected - prioritize based on action type and confidence
        const updateActions = dayActions.filter(a => a.type === 'update_availability');
        const clearActions = dayActions.filter(a => a.type === 'clear_availability');
        
        if (updateActions.length > 0 && clearActions.length > 0) {
          // UPDATE + CLEAR conflict - prioritize UPDATE (user wants to set new availability)
          const bestUpdate = updateActions.reduce((best, current) => 
            current.data.confidence > best.data.confidence ? current : best
          );
          
          console.log(`AI Service: Resolved conflict for ${day} - keeping UPDATE_AVAILABILITY, discarding CLEAR_AVAILABILITY`);
          resolvedActions.push(bestUpdate);
        } else if (updateActions.length > 1) {
          // Multiple UPDATEs - keep the one with highest confidence
          const bestUpdate = updateActions.reduce((best, current) => 
            current.data.confidence > best.data.confidence ? current : best
          );
          
          console.log(`AI Service: Resolved conflict for ${day} - keeping highest confidence UPDATE_AVAILABILITY`);
          resolvedActions.push(bestUpdate);
        } else if (clearActions.length > 0) {
          // Only CLEAR actions - keep the one with highest confidence
          const bestClear = clearActions.reduce((best, current) => 
            current.data.confidence > best.data.confidence ? current : best
          );
          
          resolvedActions.push(bestClear);
        }
      }
    }
    
    if (resolvedActions.length !== actions.length) {
      console.log(`AI Service: Action conflict resolution: ${actions.length} → ${resolvedActions.length} actions`);
    }
    
    return resolvedActions;
  }

  // Detect booking confirmation in response text (fallback method)
  detectBookingInResponse(responseText, context) {
    const bookingPhrases = [
      'booked', 'set up', 'scheduled', 'confirmed', 'locked in',
      "i'll book", "i've booked", "i'll set up", "i've set up",
      'session is confirmed', 'session for', 'see you both'
    ];
    
    const lowerResponse = responseText.toLowerCase();
    return bookingPhrases.some(phrase => lowerResponse.includes(phrase));
  }

  // Extract booking details from response text (fallback method)
  extractBookingFromResponse(responseText, context) {
    try {
      const actions = [];
      
      // Look for day mentions
      const dayMatch = responseText.match(/\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i);
      if (!dayMatch) return actions;

      const day = dayMatch[1].toLowerCase();
      
      // Calculate next occurrence of that day
      const today = new Date();
      const daysOfWeek = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
      const targetDayIndex = daysOfWeek.indexOf(day);
      const currentDayIndex = today.getDay();
      
      let daysUntilTarget = targetDayIndex - currentDayIndex;
      if (daysUntilTarget <= 0) daysUntilTarget += 7; // Next week
      
      const targetDate = new Date(today);
      targetDate.setDate(today.getDate() + daysUntilTarget);
      const dateString = targetDate.toISOString().split('T')[0];

      // Look for time mentions
      let startTime = 22; // Default to 10pm
      let endTime = 24;   // Default to 12am
      
      const timeMatch = responseText.match(/(\d{1,2})\s*(pm|am)/i);
      if (timeMatch) {
        let hour = parseInt(timeMatch[1]);
        const meridian = timeMatch[2].toLowerCase();
        
        if (meridian === 'pm' && hour !== 12) hour += 12;
        if (meridian === 'am' && hour === 12) hour = 0;
        
        startTime = hour;
        endTime = hour + 2; // Default 2-hour session
      }

      console.log('AI Service: Extracted booking details:', {
        day, dateString, startTime, endTime
      });

      actions.push({
        type: 'create_session',
        data: {
          participants: [context.userId, context.partnerId].filter(Boolean),
          date: dateString,
          start_time: startTime,
          end_time: endTime,
          confidence: 0.85 // Lower confidence for fallback extraction
        }
      });

      return actions;
    } catch (error) {
      console.error('AI Service: Error in fallback booking extraction:', error);
      return [];
    }
  }

  // Check if AI service is configured
  isConfigured() {
    return this.anthropic && this.anthropic.apiKey ? true : false;
  }
}

module.exports = AIService;