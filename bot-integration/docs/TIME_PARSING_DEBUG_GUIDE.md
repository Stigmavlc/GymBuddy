# Time Parsing Debug Guide

## Issue Fixed: "and" Pattern Not Recognized

**Problem**: When users said "between 09 and 11am", the bot was incorrectly parsing it or falling through to other patterns, potentially parsing as 1:00-3:00 instead of 9:00-11:00.

**Root Cause**: The regex patterns in `parseAvailabilityFromText()` and related functions did not include "and" as a valid connector word.

**Fix Applied**: Added "and" to the regex alternation groups in three locations:

### 1. Main parsing function (line ~1748):
```javascript
// BEFORE (missing 'and'):
/(\d{1,2})\s*(?:to|-|until)\s*(\d{1,2})\s*(am|pm)/gi

// AFTER (fixed with 'and'):
/(\d{1,2})\s*(?:to|-|until|and)\s*(\d{1,2})\s*(am|pm)/gi
```

### 2. Session matching function (line ~1533):
```javascript
// BEFORE:
/(\d{1,2})\s*(?:to|-|until)\s*(\d{1,2})\s*(am|pm)/gi

// AFTER:
/(\d{1,2})\s*(?:to|-|until|and)\s*(\d{1,2})\s*(am|pm)/gi
```

### 3. Sync testing function (line ~2156):
```javascript
// BEFORE:
/(\d{1,2})\s*(?:to|-|until)\s*(\d{1,2})\s*(am|pm)/gi

// AFTER:
/(\d{1,2})\s*(?:to|-|until|and)\s*(\d{1,2})\s*(am|pm)/gi
```

## Enhanced Debugging Added

Added comprehensive logging to `parseAvailabilityFromText()` and `parseTime()` functions:

- **Pattern Testing**: Shows which regex patterns are being tested
- **Match Analysis**: Detailed breakdown of regex match groups
- **Conversion Tracking**: Step-by-step time conversion process
- **Validation Logging**: Clear indication of why parsing fails or succeeds
- **Final Results**: Summary of parsed times before validation

## Supported Time Formats

The bot now correctly recognizes these formats:

✅ **"X and Y am/pm"** formats:
- "9 and 11am"
- "09 and 11am" 
- "between 09 and 11am"
- "7 and 9pm"
- "2 and 4pm"

✅ **Traditional formats** (already worked):
- "9 to 11am"
- "9-11am"
- "9am to 11am"
- "from 9am to 11am"
- "at 9am" (assumes 2-hour duration)

## Testing Protocol

### Quick Verification:
```bash
node verify-time-parsing.js
```

### Debug Mode Testing:
1. Set `DEBUG_MODE=true` in environment
2. Send test message to bot
3. Check logs for detailed parsing information

### Common Test Cases:
```
"Monday between 09 and 11am"     → monday 9:00-11:00
"Tuesday 7 and 9pm"              → tuesday 19:00-21:00  
"Wednesday from 2 and 4pm"       → wednesday 14:00-16:00
"Thursday 9am and 11am"          → thursday 9:00-11:00
```

## Future Debug Checklist

When time parsing issues occur:

1. **Check Regex Patterns**: Ensure all connector words are included in alternation groups
2. **Test Pattern Matching**: Use debug logs to see which pattern matches
3. **Verify parseTime()**: Check AM/PM conversion logic
4. **Validate Range**: Ensure hours are in valid ranges (0-23)
5. **Cross-Check Functions**: Verify consistency across all parsing functions

## Debug Environment Variables

Enable detailed logging:
```bash
DEBUG_MODE=true
```

## Files Modified

- `/Users/ivanaguilar/Desktop/Web Development  Projects/Completed By Me/GymBuddy/bot-integration/telegramBot.js`
  - Enhanced `parseAvailabilityFromText()` with debugging
  - Fixed regex patterns to include "and"
  - Enhanced `parseTime()` with debugging
  - Updated `parseSessionFromNaturalLanguage()`
  - Updated `parseAvailabilityFromTextSync()`

## Verification

All test cases now pass:
- ✅ "between 09 and 11am" → 9:00-11:00 ✓
- ✅ "Tuesday 09 and 11am" → 9:00-11:00 ✓ 
- ✅ "Wednesday from 9 and 11am" → 9:00-11:00 ✓
- ✅ "Thursday 7 and 9pm" → 19:00-21:00 ✓
- ✅ "Friday between 2 and 4pm" → 14:00-16:00 ✓

The time parsing bug has been completely resolved.