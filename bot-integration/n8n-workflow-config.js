/**
 * Updated n8n Workflow Configuration for GymBuddy Bot
 * 
 * This configuration fixes the main issues:
 * 1. Prevents duplicate messages by using .first() instead of .item
 * 2. Uses API service instead of direct Supabase calls
 * 3. Prioritizes user's actual message over availability data
 * 4. Implements proper error handling and logging
 */

// Node configurations for the updated n8n workflow

const workflowConfig = {
    // ==========================================
    // 1. TELEGRAM WEBHOOK TRIGGER (unchanged)
    // ==========================================
    webhookTrigger: {
        id: "telegram-webhook",
        type: "@n8n/n8n-nodes-base.webhook",
        parameters: {
            path: "gymbuddy",
            httpMethod: "POST",
            responseMode: "responseNode"
        }
    },

    // ==========================================
    // 2. MESSAGE VALIDATION (unchanged)
    // ==========================================
    checkMessageEvent: {
        id: "check-message-event", 
        type: "@n8n/n8n-nodes-base.if",
        parameters: {
            conditions: {
                string: [
                    {
                        value1: "={{ $json.message }}",
                        operation: "isNotEmpty"
                    }
                ]
            }
        }
    },

    // ==========================================
    // 3. EXTRACT USER DATA (updated for API)
    // ==========================================
    processUserData: {
        id: "process-user-data",
        type: "@n8n/n8n-nodes-base.code", 
        parameters: {
            jsCode: `
// Extract and structure user data for API service
const message = $input.all()[0].json.message;

const userData = {
    telegramId: message.from.id,
    firstName: message.from.first_name,
    username: message.from.username || null,
    chatId: message.chat.id,
    messageText: message.text,
    messageDate: message.date
};

console.log('[n8n] Extracted user data:', userData);

// Determine user type based on Telegram ID
let userType = 'unknown';
let userEmail = null;

if (userData.telegramId === 1195143765) {
    userType = 'Ivan';
    userEmail = 'ivanaguilarmari@gmail.com';
} else {
    // Add Youssef's ID when known
    userType = 'guest';
}

return [{
    userData: userData,
    userType: userType,
    userEmail: userEmail,
    timestamp: new Date().toISOString()
}];
            `
        }
    },

    // ==========================================
    // 4. API USER LOOKUP (replaces Supabase query)
    // ==========================================
    getUserFromAPI: {
        id: "get-user-from-api",
        type: "@n8n/n8n-nodes-base.httpRequest",
        parameters: {
            url: "={{ process.env.GYMBUDDY_API_URL || 'https://gymbuddy-api-ivan-9969a58fc7f4.herokuapp.com' }}/user/by-email/{{ $json.userEmail }}",
            method: "GET",
            headers: {
                "Content-Type": "application/json",
                "User-Agent": "GymBuddy-Bot-n8n/1.0"
            },
            options: {
                timeout: 10000,
                retry: {
                    enabled: true,
                    maxAttempts: 2
                }
            },
            onError: "continueErrorOutput"
        }
    },

    // ==========================================
    // 5. GET AVAILABILITY VIA API (fixed to prevent multiple processing)
    // ==========================================
    getAvailabilityFromAPI: {
        id: "get-availability-from-api",
        type: "@n8n/n8n-nodes-base.httpRequest",
        parameters: {
            url: "={{ process.env.GYMBUDDY_API_URL || 'https://gymbuddy-api-ivan-9969a58fc7f4.herokuapp.com' }}/availability/by-email/{{ $('process-user-data').first().json.userEmail }}",
            method: "GET",
            headers: {
                "Content-Type": "application/json",
                "User-Agent": "GymBuddy-Bot-n8n/1.0"
            },
            options: {
                timeout: 10000,
                retry: {
                    enabled: true,
                    maxAttempts: 2
                }
            },
            onError: "continueErrorOutput"
        }
    },

    // ==========================================
    // 6. CLAUDE AI NODE (FIXED - single response)
    // ==========================================
    claudeAI: {
        id: "claude-ai-coordinator",
        type: "@n8n/n8n-nodes-base.anthropic",
        parameters: {
            model: "claude-3-5-sonnet-20241022",
            maxTokens: 1000,
            temperature: 0.7,
            systemPrompt: `You are GymBuddy, an AI assistant that helps gym partners coordinate their workout schedules.

Your primary role is to:
1. Respond naturally to user messages
2. Use availability data as context, not as the main topic
3. Help with gym scheduling when explicitly asked
4. Be encouraging and supportive about fitness goals

Always respond to what the user actually said, using availability data only when relevant.`,
            // CRITICAL FIX: Use .first() to prevent multiple processing
            message: `{{ 
                "User: " + $('process-user-data').first().json.userData.firstName + 
                " (" + $('process-user-data').first().json.userType + ")" +
                " - Telegram ID: " + $('process-user-data').first().json.userData.telegramId + 
                "\\nMessage: " + $('process-user-data').first().json.userData.messageText + 
                "\\n\\nUser's current availability:\\n" + 
                (($('get-availability-from-api').first().json && $('get-availability-from-api').first().json.slots && $('get-availability-from-api').first().json.slots.length > 0) ? 
                    $('get-availability-from-api').first().json.slots.map(slot => 
                        "- " + slot.day.charAt(0).toUpperCase() + slot.day.slice(1) + 
                        ": " + slot.startTime + ":00 - " + slot.endTime + ":00"
                    ).join("\\n") : 
                    "No availability set yet"
                ) +
                "\\n\\nPlease respond naturally to the user's message. Use availability data only when relevant."
            }}`
        }
    },

    // ==========================================
    // 7. SEND TELEGRAM RESPONSE (unchanged)
    // ==========================================
    sendTelegramMessage: {
        id: "send-telegram-response",
        type: "@n8n/n8n-nodes-base.telegram",
        parameters: {
            resource: "message",
            operation: "sendMessage",
            chatId: "={{ $('process-user-data').first().json.userData.chatId }}",
            text: "={{ $json.content || $json.text || $json.message || 'Sorry, I had trouble processing your message.' }}",
            replyMarkup: "inlineKeyboard",
            additionalFields: {
                parse_mode: "HTML"
            }
        },
        credentials: {
            telegramApi: {
                botToken: process.env.TELEGRAM_BOT_TOKEN || "8255853885:AAFlGskAj77voLkFCtMFEXlewBnusB4gzkQ"
            }
        }
    },

    // ==========================================
    // 8. ERROR HANDLING NODE
    // ==========================================
    errorHandler: {
        id: "error-handler",
        type: "@n8n/n8n-nodes-base.code",
        parameters: {
            jsCode: `
// Handle errors gracefully and provide helpful responses
const errorInfo = $input.all()[0].json;

console.error('[n8n Error]', JSON.stringify(errorInfo, null, 2));

let errorMessage = "I'm having trouble right now. Please try again in a moment.";

// Customize error messages based on the error type
if (errorInfo.error && typeof errorInfo.error === 'string') {
    if (errorInfo.error.includes('User not found')) {
        errorMessage = "I couldn't find your user profile. Please make sure you're registered on the GymBuddy website.";
    } else if (errorInfo.error.includes('timeout') || errorInfo.error.includes('ECONNRESET')) {
        errorMessage = "The connection timed out. Please try your request again.";
    } else if (errorInfo.error.includes('500')) {
        errorMessage = "There's a temporary server issue. Please try again in a few minutes.";
    }
}

return [{
    content: errorMessage,
    error: true,
    timestamp: new Date().toISOString()
}];
            `
        }
    },

    // ==========================================
    // 9. BOT OPERATIONS HANDLER (new)
    // ==========================================
    botOperationsHandler: {
        id: "bot-operations-handler",
        type: "@n8n/n8n-nodes-base.code",
        parameters: {
            jsCode: `
// Handle specific bot operations like clearing availability
const userData = $('process-user-data').first().json;
const messageText = userData.userData.messageText.toLowerCase();

// Check if user is requesting a specific operation
if (messageText.includes('clear availability') || 
    messageText.includes('reset availability') || 
    messageText.includes('remove schedule')) {
    
    // This will trigger the clear availability API call
    return [{
        operation: 'clear_availability',
        userEmail: userData.userEmail,
        telegramId: userData.userData.telegramId,
        shouldClear: true
    }];
}

if (messageText.includes('show availability') || 
    messageText.includes('check schedule') ||
    messageText.includes('my availability')) {
    
    return [{
        operation: 'show_availability',
        userEmail: userData.userEmail,
        telegramId: userData.userData.telegramId
    }];
}

// Default: no specific operation
return [{
    operation: 'chat',
    userEmail: userData.userEmail,
    telegramId: userData.userData.telegramId
}];
            `
        }
    },

    // ==========================================
    // 10. CLEAR AVAILABILITY API CALL (new)
    // ==========================================
    clearAvailabilityAPI: {
        id: "clear-availability-api",
        type: "@n8n/n8n-nodes-base.httpRequest",
        parameters: {
            url: "={{ process.env.GYMBUDDY_API_URL || 'https://gymbuddy-api-ivan-9969a58fc7f4.herokuapp.com' }}/availability/by-email/{{ $json.userEmail }}",
            method: "DELETE",
            headers: {
                "Content-Type": "application/json",
                "User-Agent": "GymBuddy-Bot-n8n/1.0"
            },
            options: {
                timeout: 10000,
                retry: {
                    enabled: true,
                    maxAttempts: 2
                }
            },
            onError: "continueErrorOutput"
        }
    }
};

// ==========================================
// WORKFLOW CONNECTION CONFIGURATION
// ==========================================
const workflowConnections = [
    {
        from: "telegram-webhook",
        to: "check-message-event"
    },
    {
        from: "check-message-event",
        to: "process-user-data",
        condition: "true"
    },
    {
        from: "process-user-data", 
        to: "get-user-from-api"
    },
    {
        from: "get-user-from-api",
        to: "bot-operations-handler"
    },
    {
        from: "bot-operations-handler",
        to: "get-availability-from-api"
    },
    {
        from: "get-availability-from-api",
        to: "claude-ai-coordinator"
    },
    {
        from: "claude-ai-coordinator",
        to: "send-telegram-response"
    },
    // Error handling connections
    {
        from: "get-user-from-api",
        to: "error-handler",
        condition: "error"
    },
    {
        from: "get-availability-from-api", 
        to: "error-handler",
        condition: "error"
    },
    {
        from: "claude-ai-coordinator",
        to: "error-handler", 
        condition: "error"
    },
    {
        from: "error-handler",
        to: "send-telegram-response"
    },
    // Bot operations
    {
        from: "bot-operations-handler",
        to: "clear-availability-api",
        condition: "operation === 'clear_availability'"
    },
    {
        from: "clear-availability-api",
        to: "claude-ai-coordinator"
    }
];

// ==========================================
// ENVIRONMENT VARIABLES REQUIRED
// ==========================================
const requiredEnvironmentVariables = {
    GYMBUDDY_API_URL: "https://gymbuddy-api-ivan-9969a58fc7f4.herokuapp.com",
    TELEGRAM_BOT_TOKEN: "8255853885:AAFlGskAj77voLkFCtMFEXlewBnusB4gzkQ",
    BOT_DEBUG_MODE: "true", // Set to "false" in production
    ANTHROPIC_API_KEY: "your_anthropic_api_key_here"
};

module.exports = {
    workflowConfig,
    workflowConnections,
    requiredEnvironmentVariables
};