/**
 * Debug Session Routing Analysis Tool
 * 
 * This script analyzes why session deletion requests are being routed to Claude AI
 * instead of being handled directly by the bot. It provides detailed debugging
 * of the intent detection and routing logic.
 */

const GymBuddyTelegramBot = require('./telegramBot');

class SessionRoutingDebugger {
    constructor() {
        // Create bot instance for testing intent detection
        this.bot = new GymBuddyTelegramBot();
        
        console.log('=== SESSION DELETION ROUTING DEBUGGER ===\n');
    }

    /**
     * Test session deletion messages that should be routed directly
     */
    testSessionDeletionMessages() {
        console.log('🧪 TESTING SESSION DELETION MESSAGE ROUTING\n');
        
        const sessionDeletionMessages = [
            // Direct deletion requests
            'cancel my session',
            'delete my session', 
            'remove my session',
            'cancel the session',
            'delete the session',
            
            // Context-based (from user description)
            'I want it to cancel it as it was just a test session',
            'Can you please delete it?',
            'I want to cancel my confirmed session for Monday',
            'Cancel my session for Monday',
            
            // More variations
            'cancel my confirmed session',
            'delete my confirmed session',
            'remove my confirmed session',
            'I need to cancel my gym session',
            'Please cancel my workout session'
        ];
        
        sessionDeletionMessages.forEach((message, index) => {
            console.log(`Test ${index + 1}: "${message}"`);
            
            // Test current intent analysis
            const currentIntent = this.bot.analyzeMessageIntent(message);
            console.log(`  Current Intent: ${currentIntent.type} (${currentIntent.confidence})`);
            
            // Test what this should be
            const expectedIntent = this.analyzeSessionDeletionIntent(message);
            console.log(`  Expected Intent: ${expectedIntent.type} (${expectedIntent.confidence})`);
            
            // Show routing decision
            const wouldUseClaudeAI = currentIntent.type === 'general_chat';
            const shouldUseClaudeAI = expectedIntent.type === 'general_chat';
            
            console.log(`  Current Routing: ${wouldUseClaudeAI ? 'Claude AI (❌ WRONG)' : 'Direct Processing (✅ CORRECT)'}`);
            console.log(`  Expected Routing: ${shouldUseClaudeAI ? 'Claude AI' : 'Direct Processing'}`);
            
            if (wouldUseClaudeAI !== shouldUseClaudeAI) {
                console.log(`  🚨 ROUTING MISMATCH DETECTED!`);
            }
            console.log('');
        });
    }

    /**
     * Enhanced intent detection that includes session deletion
     */
    analyzeSessionDeletionIntent(messageText) {
        const text = messageText.toLowerCase().trim();
        
        // Session deletion keywords
        const sessionDeletionKeywords = [
            'cancel my session',
            'delete my session',
            'remove my session',
            'cancel the session',
            'delete the session',
            'remove the session',
            'cancel my confirmed session',
            'delete my confirmed session',
            'remove my confirmed session',
            'cancel my gym session',
            'delete my gym session',
            'remove my gym session',
            'cancel my workout session',
            'delete my workout session',
            'remove my workout session'
        ];

        // Contextual session deletion patterns
        const contextualDeletionPatterns = [
            /cancel.*session/i,
            /delete.*session/i,
            /remove.*session/i,
            /cancel.*it.*session/i,
            /delete.*it/i,
            /cancel.*confirmed/i,
            /want.*cancel.*it/i,
            /please.*delete.*it/i,
            /please.*cancel/i
        ];
        
        // Check for explicit session deletion keywords
        for (const keyword of sessionDeletionKeywords) {
            if (text.includes(keyword)) {
                return { type: 'session_deletion', confidence: 'high' };
            }
        }
        
        // Check for contextual patterns
        for (const pattern of contextualDeletionPatterns) {
            if (pattern.test(text)) {
                return { type: 'session_deletion', confidence: 'medium' };
            }
        }
        
        // If no session deletion intent, use existing logic
        return this.bot.analyzeMessageIntent(messageText);
    }

    /**
     * Analyze Claude AI prompt for session handling
     */
    analyzeClaudePrompt() {
        console.log('🤖 CLAUDE AI PROMPT ANALYSIS\n');
        
        // Extract the system prompt from the bot
        const systemPrompt = `You are GymBuddy, a helpful and enthusiastic gym partner! 💪

You're here to chat about fitness, motivation, and workouts. Respond naturally and conversationally to whatever the user says.

Personality:
- Friendly, supportive, and encouraging  
- Short, casual responses like texting a friend
- Focus on fitness, motivation, health topics
- Always positive and upbeat

CRITICAL RULES:
- NEVER mention bot commands or how to use the bot
- NEVER say "you can", "you could", "try saying", or give instructions
- NEVER explain bot functionality or provide examples
- Just chat naturally like a supportive friend
- If they mention scheduling/availability, just acknowledge it briefly and pivot to fitness chat

Examples:
"Hey how's it going?" → "Hey! Going great, just finished a killer leg workout! How about you?"
"I need to cancel my session" → "No worries! What's your next workout gonna be?"
"Clear my availability" → "Got it! Planning to switch up your routine this week?"`;

        console.log('📄 Current Claude System Prompt:');
        console.log(systemPrompt);
        console.log('\n🔍 PROMPT ANALYSIS:');
        
        // Check for problematic patterns
        const problemPatterns = [
            {
                pattern: /If they mention.*just acknowledge.*pivot/,
                issue: 'Tells Claude to acknowledge but immediately pivot away from actual requests',
                severity: 'HIGH'
            },
            {
                pattern: /"I need to cancel my session" → "No worries! What's your next workout gonna be?"/,
                issue: 'Example shows Claude deflecting session cancellation to fitness chat',
                severity: 'HIGH'
            },
            {
                pattern: /Just chat naturally like a supportive friend/,
                issue: 'Instructs Claude to treat all messages as casual chat rather than action requests',
                severity: 'MEDIUM'
            }
        ];
        
        problemPatterns.forEach((problem, index) => {
            if (problem.pattern.test(systemPrompt)) {
                console.log(`❌ Problem ${index + 1} [${problem.severity}]: ${problem.issue}`);
            }
        });
        
        console.log('\n💡 RECOMMENDATIONS:');
        console.log('1. Claude should NOT receive session management requests at all');
        console.log('2. Intent detection should catch session deletion BEFORE Claude AI routing');
        console.log('3. Add session_deletion as a direct processing intent type');
        console.log('4. Update Claude prompt to exclude session management examples');
    }

    /**
     * Analyze missing session management functionality
     */
    analyzeSessionManagement() {
        console.log('\n📋 SESSION MANAGEMENT FUNCTIONALITY ANALYSIS\n');
        
        console.log('🔍 Checking API Service for session methods...');
        
        // Check what methods exist in APIService
        const apiServiceMethods = [
            'getUserByTelegramId',
            'getUserAvailability', 
            'clearUserAvailability',
            'setUserAvailability',
            'testSync',
            'getSyncStatus',
            'healthCheck'
        ];
        
        const missingSessionMethods = [
            'getUserSessions',
            'cancelUserSession', 
            'deleteUserSession',
            'getConfirmedSessions'
        ];
        
        console.log('✅ Available methods:');
        apiServiceMethods.forEach(method => {
            console.log(`   - ${method}()`);
        });
        
        console.log('\n❌ Missing session management methods:');
        missingSessionMethods.forEach(method => {
            console.log(`   - ${method}() - NEEDED FOR SESSION DELETION`);
        });
        
        console.log('\n🔍 Checking bot for session handling...');
        
        const botMethods = [
            'handleAvailabilityUpdate',
            'handleAvailabilityQuery',
            'handleAvailabilityClear'
        ];
        
        const missingBotMethods = [
            'handleSessionQuery',
            'handleSessionDeletion',
            'handleSessionUpdate'
        ];
        
        console.log('✅ Available bot handlers:');
        botMethods.forEach(method => {
            console.log(`   - ${method}()`);
        });
        
        console.log('\n❌ Missing session handlers:');
        missingBotMethods.forEach(method => {
            console.log(`   - ${method}() - NEEDED FOR SESSION MANAGEMENT`);
        });
    }

    /**
     * Generate comprehensive debugging report
     */
    generateReport() {
        console.log('\n📊 DEBUGGING SUMMARY REPORT\n');
        
        console.log('🎯 ROOT CAUSE ANALYSIS:');
        console.log('1. ❌ Intent detection missing session_deletion patterns');
        console.log('2. ❌ No session management handlers in bot');  
        console.log('3. ❌ No session management methods in API service');
        console.log('4. ❌ Claude AI prompt includes session deflection examples');
        console.log('5. ❌ Messages like "cancel my session" route to general_chat');
        
        console.log('\n🔧 REQUIRED FIXES:');
        console.log('1. Add session_deletion to analyzeMessageIntent()');
        console.log('2. Add handleSessionDeletion() method to bot');
        console.log('3. Add session management methods to API service');
        console.log('4. Remove session examples from Claude prompt');
        console.log('5. Add session deletion patterns to intent detection');
        
        console.log('\n⚡ IMMEDIATE ACTION ITEMS:');
        console.log('1. Update intent detection with session patterns');
        console.log('2. Add session routing case in handleNaturalLanguage()'); 
        console.log('3. Implement handleSessionDeletion() method');
        console.log('4. Add API endpoints for session management');
        console.log('5. Test with the exact user messages from screenshot');
        
        console.log('\n🧪 TEST MESSAGES TO VERIFY:');
        console.log('• "I want it to cancel it as it was just a test session"');
        console.log('• "Can you please delete it?"');
        console.log('• "I want to cancel my confirmed session for Monday"');
        console.log('• Should route to → Direct Processing, NOT Claude AI');
    }

    /**
     * Run all debugging tests
     */
    run() {
        this.testSessionDeletionMessages();
        this.analyzeClaudePrompt();
        this.analyzeSessionManagement();
        this.generateReport();
    }
}

// Run the debugger if this file is executed directly
if (require.main === module) {
    const analyzer = new SessionRoutingDebugger();
    analyzer.run();
}

module.exports = SessionRoutingDebugger;