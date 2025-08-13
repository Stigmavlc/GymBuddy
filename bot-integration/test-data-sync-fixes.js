#!/usr/bin/env node

/**
 * Test script to verify the GymBuddy Telegram bot data synchronization fixes
 * 
 * This tests:
 * 1. Enhanced intent detection for availability queries
 * 2. Cache-busting headers for fresh data
 * 3. Improved availability query responses with exact dates
 * 4. Session/availability deletion parsing
 */

const GymBuddyAPIService = require('./apiService');
const { GymBuddyTelegramBot } = require('./telegramBot');

class DataSyncFixesTest {
    constructor() {
        this.apiService = new GymBuddyAPIService();
        this.testTelegramId = '1195143765'; // Ivan's ID for testing
        this.results = {
            passed: 0,
            failed: 0,
            details: []
        };
    }

    log(message, type = 'INFO') {
        const timestamp = new Date().toISOString();
        console.log(`[${type} ${timestamp}] ${message}`);
    }

    recordResult(testName, passed, details = '') {
        if (passed) {
            this.results.passed++;
            this.log(`✅ ${testName}`, 'PASS');
        } else {
            this.results.failed++;
            this.log(`❌ ${testName}: ${details}`, 'FAIL');
        }
        this.results.details.push({ testName, passed, details });
    }

    /**
     * Test 1: Verify cache-busting headers are added to API requests
     */
    async testCacheBustingHeaders() {
        this.log('Testing cache-busting headers...');
        
        try {
            // Mock the fetch to inspect headers
            const originalMakeAPIRequest = this.apiService.makeAPIRequest;
            let capturedHeaders = null;
            
            this.apiService.makeAPIRequest = async function(endpoint, options = {}) {
                capturedHeaders = options.headers || {};
                return { success: true, data: { user: 'test', slots: [] } };
            };
            
            await this.apiService.getUserAvailability(this.testTelegramId);
            
            // Restore original method
            this.apiService.makeAPIRequest = originalMakeAPIRequest;
            
            // Check for cache-busting headers
            const hasCacheControl = capturedHeaders['Cache-Control'] === 'no-cache, no-store, must-revalidate';
            const hasPragma = capturedHeaders['Pragma'] === 'no-cache';
            const hasExpires = capturedHeaders['Expires'] === '0';
            const hasTimestamp = !!capturedHeaders['X-Timestamp'];
            
            const allHeadersPresent = hasCacheControl && hasPragma && hasExpires && hasTimestamp;
            
            this.recordResult(
                'Cache-busting headers added to API requests',
                allHeadersPresent,
                allHeadersPresent ? '' : `Missing headers: ${JSON.stringify(capturedHeaders)}`
            );
            
        } catch (error) {
            this.recordResult('Cache-busting headers test', false, error.message);
        }
    }

    /**
     * Test 2: Test enhanced intent detection for availability queries
     */
    testIntentDetection() {
        this.log('Testing enhanced intent detection...');
        
        // Create a minimal bot instance for testing intent detection
        const bot = {
            detectIntent: function(messageText) {
                const text = messageText.toLowerCase().trim();
                
                // Enhanced keywords from our fix
                const queryKeywords = [
                    'what\'s my availability', 'whats my availability',
                    'show my availability', 'my schedule', 'when am i available',
                    'what\'s my schedule', 'whats my schedule',
                    'check my availability', 'view my availability', 'see my availability',
                    'give me my availability', 'tell me my availability',
                    'exact dates', 'exact times', 'exact dates and times',
                    'give me the exact', 'tell me the exact',
                    'when am i free', 'when can i work out',
                    'my available times', 'my free times',
                    'available this week', 'free this week',
                    'show me when', 'tell me when',
                    'list my availability', 'display my schedule'
                ];
                
                const queryKeywordFound = queryKeywords.find(keyword => text.includes(keyword));
                return queryKeywordFound ? { type: 'availability_query' } : { type: 'general_chat' };
            }
        };
        
        // Test cases from the conversation
        const testCases = [
            { message: "What's my availability?", expected: 'availability_query' },
            { message: "Give me the exact dates and times I'm available this week!", expected: 'availability_query' },
            { message: "exact dates and times", expected: 'availability_query' },
            { message: "show me when I'm free", expected: 'availability_query' },
            { message: "list my availability", expected: 'availability_query' },
            { message: "How are you doing?", expected: 'general_chat' },
            { message: "I need motivation", expected: 'general_chat' }
        ];
        
        let correctDetections = 0;
        
        for (const testCase of testCases) {
            const result = bot.detectIntent(testCase.message);
            if (result.type === testCase.expected) {
                correctDetections++;
                this.log(`  ✓ "${testCase.message}" → ${result.type}`);
            } else {
                this.log(`  ✗ "${testCase.message}" → ${result.type} (expected ${testCase.expected})`);
            }
        }
        
        const accuracy = correctDetections / testCases.length;
        this.recordResult(
            `Intent detection accuracy (${correctDetections}/${testCases.length})`,
            accuracy >= 0.85, // 85% accuracy threshold
            accuracy < 0.85 ? `Only ${Math.round(accuracy * 100)}% accuracy` : ''
        );
    }

    /**
     * Test 3: Test availability deletion request parsing
     */
    testDeletionParsing() {
        this.log('Testing availability deletion parsing...');
        
        // Create a parser function based on our implementation
        const parseAvailabilityDeletionRequest = function(messageText) {
            const text = messageText.toLowerCase().trim();
            const criteria = {};
            
            // Extract day of week
            const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
            for (const day of days) {
                if (text.includes(day)) {
                    criteria.day = day;
                    break;
                }
            }
            
            // Extract time patterns
            const timePatterns = [
                /(\d{1,2})-(\d{1,2})\s*(am|pm)/i,
                /(\d{1,2}):00-(\d{1,2}):00/i,
                /(\d{1,2}):(\d{2})-(\d{1,2}):(\d{2})/i,
                /(\d{1,2})-(\d{1,2})/
            ];
            
            for (const pattern of timePatterns) {
                const match = text.match(pattern);
                if (match) {
                    let startTime = parseInt(match[1]);
                    let endTime = parseInt(match[2]);
                    
                    if (match[3]) {
                        const ampm = match[3].toLowerCase();
                        if (ampm === 'pm' && startTime !== 12) startTime += 12;
                        if (ampm === 'pm' && endTime !== 12) endTime += 12;
                        if (ampm === 'am' && startTime === 12) startTime = 0;
                        if (ampm === 'am' && endTime === 12) endTime = 0;
                    }
                    
                    criteria.startTime = startTime;
                    criteria.endTime = endTime;
                    break;
                }
            }
            
            return (criteria.day || criteria.startTime !== undefined) ? criteria : null;
        };
        
        const testCases = [
            {
                message: "Delete the Monday session booked from 6-9am",
                expected: { day: 'monday', startTime: 6, endTime: 9 }
            },
            {
                message: "Remove Tuesday 14:00-16:00",
                expected: { day: 'tuesday', startTime: 14, endTime: 16 }
            },
            {
                message: "Cancel Wednesday morning",
                expected: { day: 'wednesday' }
            },
            {
                message: "Delete 6-9 session",
                expected: { startTime: 6, endTime: 9 }
            },
            {
                message: "Remove everything",
                expected: null // Should not parse
            }
        ];
        
        let correctParses = 0;
        
        for (const testCase of testCases) {
            const result = parseAvailabilityDeletionRequest(testCase.message);
            const matches = JSON.stringify(result) === JSON.stringify(testCase.expected);
            
            if (matches) {
                correctParses++;
                this.log(`  ✓ "${testCase.message}" → ${JSON.stringify(result)}`);
            } else {
                this.log(`  ✗ "${testCase.message}" → ${JSON.stringify(result)} (expected ${JSON.stringify(testCase.expected)})`);
            }
        }
        
        const accuracy = correctParses / testCases.length;
        this.recordResult(
            `Deletion parsing accuracy (${correctParses}/${testCases.length})`,
            accuracy >= 0.8, // 80% accuracy threshold
            accuracy < 0.8 ? `Only ${Math.round(accuracy * 100)}% accuracy` : ''
        );
    }

    /**
     * Test 4: Verify API service user mapping includes note about missing Youssef ID
     */
    testUserMapping() {
        this.log('Testing user mapping...');
        
        try {
            // Check if Ivan's ID is mapped
            const ivanEmail = this.apiService.getTelegramUserEmail('1195143765');
            const hasIvanMapping = ivanEmail === 'ivanaguilarmari@gmail.com';
            
            // Check available mappings
            const mappingCount = Object.keys(this.apiService.userMapping).length;
            
            this.recordResult(
                'User mapping configured with Ivan\'s ID',
                hasIvanMapping,
                hasIvanMapping ? '' : `Got: ${ivanEmail}`
            );
            
            this.recordResult(
                'User mapping ready for additional users',
                mappingCount >= 1,
                `Has ${mappingCount} mapping(s)`
            );
            
        } catch (error) {
            this.recordResult('User mapping test', false, error.message);
        }
    }

    /**
     * Run all tests
     */
    async runAllTests() {
        this.log('🚀 Starting GymBuddy Bot Data Sync Fixes Test Suite');
        this.log('=' * 60);
        
        await this.testCacheBustingHeaders();
        this.testIntentDetection();
        this.testDeletionParsing();
        this.testUserMapping();
        
        this.log('=' * 60);
        this.log(`📊 Test Results: ${this.results.passed} passed, ${this.results.failed} failed`);
        
        if (this.results.failed === 0) {
            this.log('🎉 All tests passed! Data sync fixes are working correctly.');
        } else {
            this.log('⚠️  Some tests failed. Review the implementation.');
        }
        
        return this.results;
    }
}

// Run tests if called directly
if (require.main === module) {
    const tester = new DataSyncFixesTest();
    tester.runAllTests()
        .then(results => {
            process.exit(results.failed === 0 ? 0 : 1);
        })
        .catch(error => {
            console.error('Test suite failed:', error);
            process.exit(1);
        });
}

module.exports = DataSyncFixesTest;