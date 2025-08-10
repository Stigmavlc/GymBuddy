/**
 * MINIMAL REPRODUCTION SCRIPT FOR TIMEPICKER BUG
 * 
 * This script demonstrates the race condition bug in the TimePicker state management.
 * Run this in the browser console while on the availability page to see the issue.
 */

console.log('=== TimePicker Bug Reproduction Script ===');

// Test sequence that reproduces the bug
function reproduceTimePickerBug() {
  console.log('\n🔄 Starting bug reproduction sequence...');
  
  // Helper to simulate user interactions
  const simulateClick = (selector, description) => {
    const element = document.querySelector(selector);
    if (element) {
      console.log(`👆 ${description}: ${selector}`);
      element.click();
      return true;
    } else {
      console.log(`❌ Element not found: ${selector}`);
      return false;
    }
  };
  
  // Helper to wait for state updates
  const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));
  
  // Sequence that triggers the bug
  const bugSequence = async () => {
    console.log('\n📋 Bug reproduction sequence:');
    console.log('1. Click hour cell → Time picker opens');
    console.log('2. Click Cancel → Cell deselects, picker closes');  
    console.log('3. Repeat 5-7 times rapidly');
    console.log('4. Bug: Time picker stops opening\n');
    
    // Find the first available time slot button
    const timeSlotSelector = '[data-testid*="time-slot"], button[class*="cursor-pointer"], .cursor-pointer';
    const cancelSelector = 'button:contains("Cancel"), [data-testid="cancel-button"]';
    
    for (let i = 1; i <= 7; i++) {
      console.log(`\n--- Iteration ${i} ---`);
      
      // Click time slot
      if (!simulateClick(timeSlotSelector, `Click time slot (attempt ${i})`)) {
        // Try alternative selectors
        const alternatives = [
          'button[class*="border"]',
          '.h-10.border',
          '[role="button"]'
        ];
        
        let found = false;
        for (const alt of alternatives) {
          if (simulateClick(alt, `Click time slot alternative`)) {
            found = true;
            break;
          }
        }
        
        if (!found) {
          console.log('❌ Could not find time slot button');
          break;
        }
      }
      
      await wait(100); // Wait for picker to open
      
      // Click Cancel
      if (!simulateClick(cancelSelector, `Click Cancel (attempt ${i})`)) {
        // Try alternative cancel selectors
        const cancelAlts = [
          'button[variant="outline"]',
          'button:contains("Cancel")',
          '[data-testid*="cancel"]'
        ];
        
        let cancelFound = false;
        for (const alt of cancelAlts) {
          if (simulateClick(alt, `Click Cancel alternative`)) {
            cancelFound = true;
            break;
          }
        }
        
        if (!cancelFound) {
          console.log('❌ Could not find Cancel button');
        }
      }
      
      await wait(150); // Wait for picker to close
    }
    
    console.log('\n🔍 Now try clicking a time slot manually - it should fail to open!');
  };
  
  return bugSequence();
}

// Diagnostic function to check current state
function diagnoseTimePicker() {
  console.log('\n🔍 TimePicker State Diagnosis:');
  
  // Check for React Fiber to access component state
  const reactFiber = document.querySelector('[data-reactroot]')?._reactInternalFiber ||
                     document.querySelector('#root')?._reactInternalFiber;
  
  if (reactFiber) {
    console.log('✅ React app detected');
    
    // Look for state in the console logs
    const recentLogs = console.history || [];
    const timePickerLogs = recentLogs.filter(log => 
      log && log.toString().includes('AvailabilityCalendar') || log.toString().includes('TimePicker')
    );
    
    console.log(`📝 Found ${timePickerLogs.length} recent TimePicker logs`);
  }
  
  // Check DOM state
  const timeSlots = document.querySelectorAll('button[class*="cursor-pointer"], .cursor-pointer');
  const openPopovers = document.querySelectorAll('[data-radix-popper-content-wrapper]');
  
  console.log(`🎯 Time slot buttons found: ${timeSlots.length}`);
  console.log(`📱 Open popovers found: ${openPopovers.length}`);
  
  // Check for stuck state indicators
  const selectedButtons = document.querySelectorAll('button[class*="bg-primary"]');
  console.log(`🔘 Selected time slots: ${selectedButtons.length}`);
  
  return {
    timeSlots: timeSlots.length,
    openPopovers: openPopovers.length,
    selectedSlots: selectedButtons.length
  };
}

// Manual test instructions
function showManualTestInstructions() {
  console.log('\n📖 MANUAL TESTING INSTRUCTIONS:');
  console.log('1. Open browser DevTools Console');
  console.log('2. Navigate to the Availability Calendar page');
  console.log('3. Run: reproduceTimePickerBug()');
  console.log('4. Run: diagnoseTimePicker()');
  console.log('5. Try clicking time slots manually to confirm bug');
  console.log('\n🚨 EXPECTED BUG BEHAVIOR:');
  console.log('- After 5-7 cancel operations, time picker stops opening');
  console.log('- Cells can be marked but not unmarked');
  console.log('- Console shows state conflicts in debug logs');
}

// Export functions for manual use
window.reproduceTimePickerBug = reproduceTimePickerBug;
window.diagnoseTimePicker = diagnoseTimePicker;
window.showManualTestInstructions = showManualTestInstructions;

// Show instructions immediately
showManualTestInstructions();

console.log('\n✅ Reproduction script loaded. Use the functions above to test.');