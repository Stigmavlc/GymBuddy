#!/usr/bin/env node
/**
 * Comprehensive GymBuddy Bot Diagnostic Test Script
 * 
 * This script tests all bot functionality and identifies issues with:
 * - Data sync between bot and API
 * - Intent routing accuracy
 * - Real-time availability access
 * - API connectivity and response times
 * 
 * Usage:
 * node debug_comprehensive_test.js
 * 
 * Environment variables:
 * - BOT_DEBUG_MODE=true (for detailed logging)
 * - TELEGRAM_BOT_TOKEN (required)
 * - GYMBUDDY_API_URL (optional, defaults to Heroku)
 */

const GymBuddyAPIService = require('./apiService');
const GymBuddyTelegramBot = require('./telegramBot');

class ComprehensiveBotDiagnostics {
    constructor() {
        this.results = {
            timestamp: new Date().toISOString(),
            tests: {},
            summary: {
                totalTests: 0,
                passed: 0,
                failed: 0,
                warnings: 0
            },
            recommendations: []
        };
        
        // Test Telegram ID (use Ivan's ID for testing)
        this.testTelegramId = '1195143765';
        
        console.log('🔍 GymBuddy Bot Comprehensive Diagnostics');
        console.log('==========================================');
    }

    async runAllTests() {
        try {
            // Initialize services
            console.log('📋 Initializing services...');
            this.apiService = new GymBuddyAPIService();
            
            // Don't initialize the full bot for testing, just create instance for testing methods
            this.botInstance = {
                apiService: this.apiService,
                debugMode: process.env.BOT_DEBUG_MODE === 'true',
                analyzeMessageIntent: function(text, availability) {
                    // Simplified intent analysis for testing
                    const lowerText = text.toLowerCase();
                    if (lowerText.includes('available') && (lowerText.includes('monday') || lowerText.includes('tuesday'))) {
                        return { type: 'availability_update', confidence: 'high' };
                    }
                    if (lowerText.includes('what') && lowerText.includes('availability')) {
                        return { type: 'availability_query', confidence: 'high' };
                    }
                    if (lowerText.includes('clear') && lowerText.includes('availability')) {
                        return { type: 'availability_clear', confidence: 'high' };
                    }
                    return { type: 'general_chat', confidence: 'medium' };
                }
            };

            // Run test suite
            await this.testAPIConnectivity();
            await this.testUserMapping();
            await this.testAvailabilityDataAccess();
            await this.testIntentRoutingAccuracy();
            await this.testDataSyncConsistency();
            await this.testRealTimeDataFreshness();
            
            // Generate final report
            this.generateFinalReport();
            
        } catch (error) {
            console.error('❌ Diagnostic test failed:', error);
            this.results.summary.failed++;
        }
    }

    async testAPIConnectivity() {
        console.log('\n🌐 Testing API Connectivity...');
        const testStart = Date.now();
        
        try {
            // Test basic API health
            const healthResult = await this.apiService.makeAPIRequest('/health');
            
            this.results.tests.apiConnectivity = {
                name: 'API Connectivity',
                success: healthResult.success,
                duration: Date.now() - testStart,
                details: {
                    baseURL: this.apiService.baseURL,
                    healthCheck: healthResult.success,
                    error: healthResult.error
                }
            };
            
            if (healthResult.success) {
                console.log('✅ API connectivity test passed');
                this.results.summary.passed++;
            } else {
                console.log('❌ API connectivity test failed:', healthResult.error);
                this.results.summary.failed++;
                this.results.recommendations.push('Check API server status and network connectivity');
            }
            
        } catch (error) {
            console.log('❌ API connectivity test error:', error.message);
            this.results.tests.apiConnectivity = {
                name: 'API Connectivity',
                success: false,
                error: error.message,
                duration: Date.now() - testStart
            };
            this.results.summary.failed++;
        }
        
        this.results.summary.totalTests++;
    }

    async testUserMapping() {
        console.log('\n👤 Testing User ID Mapping...');
        const testStart = Date.now();
        
        try {
            const userResult = await this.apiService.getUserByTelegramId(this.testTelegramId);
            
            this.results.tests.userMapping = {
                name: 'User ID Mapping',
                success: !!userResult,
                duration: Date.now() - testStart,
                details: {
                    telegramId: this.testTelegramId,
                    foundUser: !!userResult,
                    userName: userResult?.name,
                    userEmail: userResult?.email,
                    mappingCount: Object.keys(this.apiService.userMapping).length
                }
            };
            
            if (userResult) {
                console.log(`✅ User mapping test passed - Found: ${userResult.name} (${userResult.email})`);
                this.results.summary.passed++;
            } else {
                console.log(`❌ User mapping test failed - No user found for Telegram ID: ${this.testTelegramId}`);
                this.results.summary.failed++;
                this.results.recommendations.push('Add Telegram ID to user mapping in apiService.js');
            }
            
        } catch (error) {
            console.log('❌ User mapping test error:', error.message);
            this.results.tests.userMapping = {
                name: 'User ID Mapping',
                success: false,
                error: error.message,
                duration: Date.now() - testStart
            };
            this.results.summary.failed++;
        }
        
        this.results.summary.totalTests++;
    }

    async testAvailabilityDataAccess() {
        console.log('\n📅 Testing Availability Data Access...');
        const testStart = Date.now();
        
        try {
            const availabilityResult = await this.apiService.getUserAvailability(this.testTelegramId);
            
            const isValidArray = Array.isArray(availabilityResult);
            const hasValidStructure = isValidArray && availabilityResult.every(slot => 
                slot.day && 
                typeof slot.start_time === 'number' && 
                typeof slot.end_time === 'number'
            );
            
            this.results.tests.availabilityAccess = {
                name: 'Availability Data Access',
                success: isValidArray && hasValidStructure,
                duration: Date.now() - testStart,
                details: {
                    isArray: isValidArray,
                    slotsCount: availabilityResult?.length || 0,
                    hasValidStructure,
                    sampleSlot: availabilityResult?.[0] || null
                }
            };
            
            if (isValidArray && hasValidStructure) {
                console.log(`✅ Availability access test passed - Found ${availabilityResult.length} valid slots`);
                this.results.summary.passed++;
            } else if (isValidArray && availabilityResult.length === 0) {
                console.log('⚠️  Availability access test - No availability data found (user needs to set availability)');
                this.results.summary.warnings++;
                this.results.recommendations.push('User should set availability through the website or bot');
            } else {
                console.log('❌ Availability access test failed - Invalid data structure');
                this.results.summary.failed++;
                this.results.recommendations.push('Check API response format and data transformation logic');
            }
            
        } catch (error) {
            console.log('❌ Availability access test error:', error.message);
            this.results.tests.availabilityAccess = {
                name: 'Availability Data Access',
                success: false,
                error: error.message,
                duration: Date.now() - testStart
            };
            this.results.summary.failed++;
        }
        
        this.results.summary.totalTests++;
    }

    async testIntentRoutingAccuracy() {
        console.log('\n🧠 Testing Intent Routing Accuracy...');
        const testStart = Date.now();
        
        const testCases = [
            { message: "Set me available Monday 9am", expected: "availability_update" },
            { message: "What's my availability?", expected: "availability_query" },
            { message: "Clear my availability", expected: "availability_clear" },
            { message: "Cancel my session", expected: "session_deletion" },
            { message: "How's your day?", expected: "general_chat" }
        ];
        
        const results = [];
        let correctDetections = 0;
        
        try {
            for (const testCase of testCases) {
                const intent = this.botInstance.analyzeMessageIntent(testCase.message, []);
                const isCorrect = intent.type === testCase.expected;
                
                results.push({
                    message: testCase.message,
                    expected: testCase.expected,
                    detected: intent.type,
                    confidence: intent.confidence,
                    correct: isCorrect
                });
                
                if (isCorrect) {
                    correctDetections++;
                    console.log(`✅ "${testCase.message}" → ${intent.type} (correct)`);
                } else {
                    console.log(`❌ "${testCase.message}" → ${intent.type} (expected: ${testCase.expected})`);
                }
            }
            
            const accuracy = (correctDetections / testCases.length * 100).toFixed(1);
            
            this.results.tests.intentRouting = {
                name: 'Intent Routing Accuracy',
                success: correctDetections === testCases.length,
                duration: Date.now() - testStart,
                details: {
                    totalTests: testCases.length,
                    correctDetections,
                    accuracy: `${accuracy}%`,
                    results
                }
            };
            
            if (correctDetections === testCases.length) {
                console.log(`✅ Intent routing test passed - ${accuracy}% accuracy`);
                this.results.summary.passed++;
            } else {
                console.log(`❌ Intent routing test failed - Only ${accuracy}% accuracy`);
                this.results.summary.failed++;
                this.results.recommendations.push('Review intent detection patterns and keyword matching');
            }
            
        } catch (error) {
            console.log('❌ Intent routing test error:', error.message);
            this.results.tests.intentRouting = {
                name: 'Intent Routing Accuracy',
                success: false,
                error: error.message,
                duration: Date.now() - testStart
            };
            this.results.summary.failed++;
        }
        
        this.results.summary.totalTests++;
    }

    async testDataSyncConsistency() {
        console.log('\n🔄 Testing Data Sync Consistency...');
        const testStart = Date.now();
        
        try {
            // Get data through bot service
            const botData = await this.apiService.getUserAvailability(this.testTelegramId);
            
            // Get data through direct API call
            const email = this.apiService.getTelegramUserEmail(this.testTelegramId);
            const directApiResult = await this.apiService.makeAPIRequest(
                `/availability/by-email/${encodeURIComponent(email)}`
            );
            
            const apiData = directApiResult.success ? directApiResult.data.slots : [];
            
            // Compare data consistency
            const botSlotsCount = botData?.length || 0;
            const apiSlotsCount = apiData?.length || 0;
            const countsMatch = botSlotsCount === apiSlotsCount;
            
            this.results.tests.dataSyncConsistency = {
                name: 'Data Sync Consistency',
                success: countsMatch && directApiResult.success,
                duration: Date.now() - testStart,
                details: {
                    botSlotsCount,
                    apiSlotsCount,
                    countsMatch,
                    directApiSuccess: directApiResult.success,
                    email
                }
            };
            
            if (countsMatch && directApiResult.success) {
                console.log(`✅ Data sync consistency test passed - Both methods return ${botSlotsCount} slots`);
                this.results.summary.passed++;
            } else {
                console.log(`❌ Data sync consistency test failed - Bot: ${botSlotsCount}, API: ${apiSlotsCount}`);
                this.results.summary.failed++;
                this.results.recommendations.push('Check data transformation logic between API and bot');
            }
            
        } catch (error) {
            console.log('❌ Data sync consistency test error:', error.message);
            this.results.tests.dataSyncConsistency = {
                name: 'Data Sync Consistency',
                success: false,
                error: error.message,
                duration: Date.now() - testStart
            };
            this.results.summary.failed++;
        }
        
        this.results.summary.totalTests++;
    }

    async testRealTimeDataFreshness() {
        console.log('\n⏱️  Testing Real-time Data Freshness...');
        const testStart = Date.now();
        
        try {
            const email = this.apiService.getTelegramUserEmail(this.testTelegramId);
            
            // Make two API calls with a small delay
            const firstCall = await this.apiService.makeAPIRequest(
                `/availability/by-email/${encodeURIComponent(email)}`
            );
            
            await new Promise(resolve => setTimeout(resolve, 50));
            
            const secondCall = await this.apiService.makeAPIRequest(
                `/availability/by-email/${encodeURIComponent(email)}`
            );
            
            const bothSuccessful = firstCall.success && secondCall.success;
            const dataConsistent = JSON.stringify(firstCall.data) === JSON.stringify(secondCall.data);
            
            this.results.tests.realTimeDataFreshness = {
                name: 'Real-time Data Freshness',
                success: bothSuccessful && dataConsistent,
                duration: Date.now() - testStart,
                details: {
                    firstCallSuccess: firstCall.success,
                    secondCallSuccess: secondCall.success,
                    dataConsistent,
                    firstCallSlots: firstCall.data?.slots?.length || 0,
                    secondCallSlots: secondCall.data?.slots?.length || 0
                }
            };
            
            if (bothSuccessful && dataConsistent) {
                console.log('✅ Real-time data freshness test passed - Data is consistent');
                this.results.summary.passed++;
            } else {
                console.log('❌ Real-time data freshness test failed - Data inconsistency detected');
                this.results.summary.failed++;
                this.results.recommendations.push('Check for database synchronization issues or caching problems');
            }
            
        } catch (error) {
            console.log('❌ Real-time data freshness test error:', error.message);
            this.results.tests.realTimeDataFreshness = {
                name: 'Real-time Data Freshness',
                success: false,
                error: error.message,
                duration: Date.now() - testStart
            };
            this.results.summary.failed++;
        }
        
        this.results.summary.totalTests++;
    }

    generateFinalReport() {
        console.log('\n📋 COMPREHENSIVE DIAGNOSTIC REPORT');
        console.log('=====================================');
        
        const { summary } = this.results;
        const successRate = ((summary.passed / summary.totalTests) * 100).toFixed(1);
        
        console.log(`📊 Test Results: ${summary.passed}/${summary.totalTests} passed (${successRate}%)`);
        console.log(`✅ Passed: ${summary.passed}`);
        console.log(`❌ Failed: ${summary.failed}`);
        console.log(`⚠️  Warnings: ${summary.warnings}`);
        
        if (this.results.recommendations.length > 0) {
            console.log('\n💡 RECOMMENDATIONS:');
            this.results.recommendations.forEach((rec, index) => {
                console.log(`${index + 1}. ${rec}`);
            });
        }
        
        console.log('\n🔧 DETAILED TEST RESULTS:');
        Object.values(this.results.tests).forEach(test => {
            const status = test.success ? '✅' : '❌';
            console.log(`${status} ${test.name} (${test.duration}ms)`);
            if (test.error) console.log(`   Error: ${test.error}`);
        });
        
        console.log('\n🚀 NEXT STEPS:');
        if (summary.failed === 0) {
            console.log('✅ All critical tests passed! Bot should be working correctly.');
            console.log('📱 Test the bot by sending: "What\'s my availability?" or "Set me available Monday 9am"');
        } else {
            console.log('❌ Critical issues found. Address the recommendations above.');
            console.log('🔍 Enable debug mode (BOT_DEBUG_MODE=true) for detailed logs.');
        }
        
        // Save detailed report to file
        const fs = require('fs');
        const reportFile = `diagnostic_report_${Date.now()}.json`;
        fs.writeFileSync(reportFile, JSON.stringify(this.results, null, 2));
        console.log(`📄 Detailed report saved to: ${reportFile}`);
    }
}

// Run diagnostics if script is executed directly
if (require.main === module) {
    const diagnostics = new ComprehensiveBotDiagnostics();
    diagnostics.runAllTests().catch(console.error);
}

module.exports = ComprehensiveBotDiagnostics;