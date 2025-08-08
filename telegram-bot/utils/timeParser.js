/**
 * Time Parser Utility
 * 
 * This utility parses natural language time expressions and converts them
 * to proper date/time formats for the GymBuddy system.
 * 
 * Examples:
 *   "tomorrow at 5pm" -> { date: "2024-01-15", time: 17 }
 *   "next Monday morning" -> { date: "2024-01-20", time: 9 }
 *   "3pm today" -> { date: "2024-01-14", time: 15 }
 */

class TimeParser {
  constructor() {
    // Define common time patterns
    this.timePatterns = {
      // Exact times: "5pm", "17:00", "3:30pm"
      exactTime: /(\d{1,2})(?::(\d{2}))?\s*(am|pm|AM|PM)?/g,
      
      // General times: "morning", "afternoon", "evening", "night"
      generalTime: /(morning|afternoon|evening|night|noon)/gi,
      
      // Days: "today", "tomorrow", "monday", "next week"
      dayPattern: /(today|tomorrow|yesterday|monday|tuesday|wednesday|thursday|friday|saturday|sunday|next\s+week|this\s+week)/gi,
      
      // Relative dates: "next monday", "this friday"
      relativeDay: /(next|this)\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)/gi
    };

    // Default time mappings
    this.defaultTimes = {
      morning: 9,
      afternoon: 14,
      evening: 18,
      night: 20,
      noon: 12
    };

    // Day name mappings
    this.dayNames = {
      sunday: 0,
      monday: 1,
      tuesday: 2,
      wednesday: 3,
      thursday: 4,
      friday: 5,
      saturday: 6
    };
  }

  /**
   * Main parsing function - extracts date and time from natural language
   * @param {string} text - Natural language time expression
   * @returns {Object} - { date, time, success, originalText, parsed }
   */
  parseTime(text) {
    if (!text || typeof text !== 'string') {
      return this.createFailureResult(text, 'Invalid input text');
    }

    const originalText = text.trim();
    const lowerText = originalText.toLowerCase();

    console.log('TimeParser: Parsing text:', originalText);

    try {
      // Extract date and time components
      const dateResult = this.extractDate(lowerText);
      const timeResult = this.extractTime(lowerText);

      // Combine results
      const result = {
        date: dateResult.date,
        time: timeResult.time,
        success: dateResult.success && timeResult.success,
        originalText,
        parsed: {
          dateString: dateResult.dateString,
          timeString: timeResult.timeString,
          confidence: Math.min(dateResult.confidence, timeResult.confidence)
        }
      };

      console.log('TimeParser: Result:', result);
      return result;

    } catch (error) {
      console.error('TimeParser: Error parsing time:', error);
      return this.createFailureResult(originalText, error.message);
    }
  }

  /**
   * Extract date from text
   * @param {string} text - Text to parse
   * @returns {Object} - Date parsing result
   */
  extractDate(text) {
    const today = new Date();
    let targetDate = new Date(today);
    let dateString = '';
    let confidence = 0.5;

    // Check for specific day patterns
    if (text.includes('today')) {
      dateString = 'today';
      confidence = 1.0;
    } else if (text.includes('tomorrow')) {
      targetDate.setDate(today.getDate() + 1);
      dateString = 'tomorrow';
      confidence = 1.0;
    } else if (text.includes('yesterday')) {
      targetDate.setDate(today.getDate() - 1);
      dateString = 'yesterday';
      confidence = 1.0;
    } else {
      // Check for specific weekdays
      const relativeMatch = text.match(this.timePatterns.relativeDay);
      if (relativeMatch) {
        const relative = relativeMatch[0];
        const result = this.parseRelativeDay(relative);
        if (result.success) {
          targetDate = result.date;
          dateString = relative;
          confidence = 0.9;
        }
      } else {
        // Check for standalone weekdays
        const dayMatch = text.match(this.timePatterns.dayPattern);
        if (dayMatch) {
          const dayName = dayMatch[0].toLowerCase();
          if (this.dayNames.hasOwnProperty(dayName)) {
            targetDate = this.getNextWeekday(this.dayNames[dayName]);
            dateString = dayName;
            confidence = 0.8;
          }
        }
      }
    }

    // Format date as YYYY-MM-DD
    const formattedDate = this.formatDate(targetDate);

    return {
      date: formattedDate,
      dateString,
      success: true,
      confidence
    };
  }

  /**
   * Extract time from text
   * @param {string} text - Text to parse
   * @returns {Object} - Time parsing result
   */
  extractTime(text) {
    let hour = null;
    let timeString = '';
    let confidence = 0.5;

    // Check for exact times first
    const exactMatches = [...text.matchAll(this.timePatterns.exactTime)];
    if (exactMatches.length > 0) {
      const match = exactMatches[0];
      hour = this.parseExactTime(match);
      timeString = match[0];
      confidence = 0.95;
    } else {
      // Check for general time periods
      const generalMatches = [...text.matchAll(this.timePatterns.generalTime)];
      if (generalMatches.length > 0) {
        const period = generalMatches[0][0].toLowerCase();
        hour = this.defaultTimes[period] || 12;
        timeString = period;
        confidence = 0.7;
      }
    }

    // Default to afternoon if no time specified
    if (hour === null) {
      hour = 14; // 2 PM default
      timeString = 'default (afternoon)';
      confidence = 0.3;
    }

    return {
      time: hour,
      timeString,
      success: true,
      confidence
    };
  }

  /**
   * Parse exact time from regex match
   * @param {Array} match - Regex match array
   * @returns {number} - Hour in 24-hour format
   */
  parseExactTime(match) {
    let hour = parseInt(match[1]);
    const minutes = parseInt(match[2] || 0);
    const period = (match[3] || '').toLowerCase();

    // Convert to 24-hour format
    if (period === 'pm' && hour !== 12) {
      hour += 12;
    } else if (period === 'am' && hour === 12) {
      hour = 0;
    }

    // For now, we're only returning the hour
    // TODO: Add support for minutes in the database schema
    return hour;
  }

  /**
   * Parse relative day expressions like "next monday", "this friday"
   * @param {string} text - Relative day text
   * @returns {Object} - Parse result
   */
  parseRelativeDay(text) {
    const parts = text.toLowerCase().split(/\s+/);
    const relative = parts[0]; // "next" or "this"
    const dayName = parts[1]; // day name

    if (!this.dayNames.hasOwnProperty(dayName)) {
      return { success: false };
    }

    const targetDayIndex = this.dayNames[dayName];
    const today = new Date();
    const currentDayIndex = today.getDay();

    let targetDate = new Date(today);

    if (relative === 'next') {
      // Next occurrence of this day
      let daysUntil = targetDayIndex - currentDayIndex;
      if (daysUntil <= 0) {
        daysUntil += 7; // Go to next week
      }
      targetDate.setDate(today.getDate() + daysUntil);
    } else if (relative === 'this') {
      // This week's occurrence
      let daysUntil = targetDayIndex - currentDayIndex;
      if (daysUntil < 0) {
        daysUntil += 7; // If day already passed, go to next week
      }
      targetDate.setDate(today.getDate() + daysUntil);
    }

    return {
      success: true,
      date: targetDate
    };
  }

  /**
   * Get next occurrence of a specific weekday
   * @param {number} dayIndex - Day index (0 = Sunday, 1 = Monday, etc.)
   * @returns {Date} - Next occurrence date
   */
  getNextWeekday(dayIndex) {
    const today = new Date();
    const currentDay = today.getDay();
    let daysUntil = dayIndex - currentDay;

    if (daysUntil <= 0) {
      daysUntil += 7; // Get next week's occurrence
    }

    const targetDate = new Date(today);
    targetDate.setDate(today.getDate() + daysUntil);
    return targetDate;
  }

  /**
   * Format date as YYYY-MM-DD string
   * @param {Date} date - Date object
   * @returns {string} - Formatted date string
   */
  formatDate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  /**
   * Convert hour to availability slot format
   * @param {number} hour - Hour in 24-hour format
   * @returns {Object} - { start_time, end_time } for typical 1-hour session
   */
  toAvailabilitySlot(hour) {
    return {
      start_time: hour,
      end_time: hour + 1 // Assume 1-hour sessions
    };
  }

  /**
   * Create failure result object
   * @param {string} originalText - Original input text
   * @param {string} reason - Failure reason
   * @returns {Object} - Failure result
   */
  createFailureResult(originalText, reason) {
    return {
      date: null,
      time: null,
      success: false,
      originalText: originalText || '',
      error: reason,
      parsed: null
    };
  }

  /**
   * Test the parser with common expressions
   * @returns {Array} - Test results
   */
  runTests() {
    const testCases = [
      'tomorrow at 5pm',
      'next Monday morning',
      '3pm today',
      'tomorrow morning',
      'friday evening',
      'next week',
      'today at 2:30pm',
      'monday afternoon'
    ];

    console.log('TimeParser: Running tests...');
    const results = testCases.map(testCase => {
      const result = this.parseTime(testCase);
      return {
        input: testCase,
        output: result,
        success: result.success
      };
    });

    console.log('TimeParser test results:', results);
    return results;
  }
}

// Create instance and export
const timeParser = new TimeParser();

/**
 * Convenience function for parsing time expressions
 * @param {string} text - Natural language time expression
 * @returns {Object} - Parse result
 */
function parseTime(text) {
  return timeParser.parseTime(text);
}

/**
 * Quick check if text contains time-related words
 * @param {string} text - Text to check
 * @returns {boolean} - True if text seems to contain time references
 */
function containsTimeReference(text) {
  if (!text) return false;
  
  const timeKeywords = [
    'time', 'when', 'at', 'pm', 'am', 'morning', 'afternoon', 'evening', 'night',
    'today', 'tomorrow', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday',
    'saturday', 'sunday', 'next', 'this', 'week', 'hour', 'minute', 'o\'clock'
  ];

  const lowerText = text.toLowerCase();
  return timeKeywords.some(keyword => lowerText.includes(keyword));
}

module.exports = {
  TimeParser,
  parseTime,
  containsTimeReference,
  runTests: () => timeParser.runTests()
};