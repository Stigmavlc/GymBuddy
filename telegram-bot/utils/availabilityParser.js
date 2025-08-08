// Natural Language Availability Parser for GymBuddy Bot
// Parses user messages like "I'm free Mondays 6-8pm" into structured availability data

class AvailabilityParser {
  constructor() {
    // Day name mappings
    this.dayNames = {
      'monday': 'monday', 'mon': 'monday', 'mondays': 'monday',
      'tuesday': 'tuesday', 'tue': 'tuesday', 'tues': 'tuesday', 'tuesdays': 'tuesday',
      'wednesday': 'wednesday', 'wed': 'wednesday', 'wednesdays': 'wednesday',
      'thursday': 'thursday', 'thu': 'thursday', 'thur': 'thursday', 'thurs': 'thursday', 'thursdays': 'thursday',
      'friday': 'friday', 'fri': 'friday', 'fridays': 'friday',
      'saturday': 'saturday', 'sat': 'saturday', 'saturdays': 'saturday',
      'sunday': 'sunday', 'sun': 'sunday', 'sundays': 'sunday'
    };

    // Time patterns
    this.timePatterns = [
      // 6-8pm, 10am-2pm, 6:30-8:30pm
      /(\d{1,2})(?::(\d{2}))?\s*(?:am|pm)?\s*[-–—]\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)/gi,
      // 6pm-8pm, 10am-2pm
      /(\d{1,2})(?::(\d{2}))?\s*(am|pm)\s*[-–—]\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)/gi,
      // 6-8, 10-14 (24 hour format)
      /(\d{1,2})(?::(\d{2}))?\s*[-–—]\s*(\d{1,2})(?::(\d{2}))?(?!\s*(?:am|pm))/gi
    ];
  }

  // Main parsing function
  parseAvailability(text) {
    try {
      const normalizedText = text.toLowerCase().replace(/[,;]/g, ' ');
      console.log('AvailabilityParser: Parsing text:', normalizedText);

      const results = [];
      
      // Look for availability patterns like "Mondays 6-8pm", "free Tuesday 10am-2pm"
      const availabilityPatterns = [
        // "I'm free Mondays 6-8pm"
        /(?:i'm\s+free|available|free)\s+(?:on\s+)?(\w+day?s?)\s+([^,;.]+)/gi,
        // "Mondays 6-8pm"
        /(\w+day?s?)\s+([^,;.]+)/gi,
        // "Monday from 6 to 8pm"
        /(\w+day?s?)\s+from\s+([^,;.]+)/gi
      ];

      for (const pattern of availabilityPatterns) {
        let match;
        while ((match = pattern.exec(normalizedText)) !== null) {
          const dayText = match[1];
          const timeText = match[2];
          
          const day = this.parseDay(dayText);
          if (day) {
            const timeSlots = this.parseTimeRange(timeText);
            for (const slot of timeSlots) {
              if (slot.startTime !== null && slot.endTime !== null) {
                results.push({
                  day,
                  startTime: slot.startTime,
                  endTime: slot.endTime,
                  originalText: match[0]
                });
              }
            }
          }
        }
      }

      // Remove duplicates
      const uniqueResults = this.removeDuplicates(results);
      
      console.log('AvailabilityParser: Parsed results:', uniqueResults);
      return {
        success: true,
        slots: uniqueResults,
        message: uniqueResults.length > 0 
          ? `Found ${uniqueResults.length} availability slot(s)`
          : 'No availability slots found in text'
      };
    } catch (error) {
      console.error('AvailabilityParser: Error parsing availability:', error);
      return {
        success: false,
        slots: [],
        error: 'Error parsing availability text'
      };
    }
  }

  // Parse day names from text
  parseDay(dayText) {
    const normalized = dayText.toLowerCase().trim();
    return this.dayNames[normalized] || null;
  }

  // Parse time ranges from text
  parseTimeRange(timeText) {
    const slots = [];
    
    for (const pattern of this.timePatterns) {
      let match;
      while ((match = pattern.exec(timeText)) !== null) {
        let startHour, startMin, endHour, endMin, period;
        
        if (pattern.source.includes('am|pm.*am|pm')) {
          // Pattern: 6pm-8pm or 10am-2pm
          startHour = parseInt(match[1]);
          startMin = parseInt(match[2]) || 0;
          const startPeriod = match[3];
          endHour = parseInt(match[4]);
          endMin = parseInt(match[5]) || 0;
          const endPeriod = match[6];
          
          const startTime = this.convertTo24Hour(startHour, startMin, startPeriod);
          const endTime = this.convertTo24Hour(endHour, endMin, endPeriod);
          
          if (startTime !== null && endTime !== null) {
            slots.push({ startTime, endTime });
          }
        } else if (pattern.source.includes('am|pm')) {
          // Pattern: 6-8pm
          startHour = parseInt(match[1]);
          startMin = parseInt(match[2]) || 0;
          endHour = parseInt(match[3]);
          endMin = parseInt(match[4]) || 0;
          period = match[5];
          
          const startTime = this.convertTo24Hour(startHour, startMin, period);
          const endTime = this.convertTo24Hour(endHour, endMin, period);
          
          if (startTime !== null && endTime !== null) {
            slots.push({ startTime, endTime });
          }
        } else {
          // Pattern: 6-8 (24 hour or ambiguous)
          startHour = parseInt(match[1]);
          startMin = parseInt(match[2]) || 0;
          endHour = parseInt(match[3]);
          endMin = parseInt(match[4]) || 0;
          
          // Convert to 24-hour format (assume PM if < 8, otherwise keep as is)
          const startTime = this.normalize24Hour(startHour, startMin);
          const endTime = this.normalize24Hour(endHour, endMin);
          
          if (startTime !== null && endTime !== null && startTime < endTime) {
            slots.push({ startTime, endTime });
          }
        }
      }
    }
    
    return slots;
  }

  // Convert 12-hour time to 24-hour format
  convertTo24Hour(hour, minute, period) {
    if (hour < 1 || hour > 12 || minute < 0 || minute >= 60) {
      return null;
    }
    
    let hour24 = hour;
    if (period.toLowerCase() === 'pm' && hour !== 12) {
      hour24 += 12;
    } else if (period.toLowerCase() === 'am' && hour === 12) {
      hour24 = 0;
    }
    
    // Return hour only (minutes are ignored for slot matching)
    return hour24 + (minute / 60);
  }

  // Normalize ambiguous hours to 24-hour format
  normalize24Hour(hour, minute) {
    if (hour < 0 || hour >= 24 || minute < 0 || minute >= 60) {
      return null;
    }
    
    // If hour is small (1-7), likely PM time
    if (hour >= 1 && hour <= 7) {
      hour += 12;
    }
    
    return Math.floor(hour + (minute / 60));
  }

  // Remove duplicate availability slots
  removeDuplicates(slots) {
    const unique = [];
    const seen = new Set();
    
    for (const slot of slots) {
      const key = `${slot.day}-${slot.startTime}-${slot.endTime}`;
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(slot);
      }
    }
    
    return unique;
  }

  // Parse common availability expressions
  parseCommonExpressions(text) {
    const normalizedText = text.toLowerCase();
    const results = [];

    // "weekdays", "weekends", "daily", etc.
    if (normalizedText.includes('weekday')) {
      const weekdays = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'];
      const timeSlots = this.parseTimeRange(text);
      for (const day of weekdays) {
        for (const slot of timeSlots) {
          results.push({ day, ...slot });
        }
      }
    }

    if (normalizedText.includes('weekend')) {
      const weekends = ['saturday', 'sunday'];
      const timeSlots = this.parseTimeRange(text);
      for (const day of weekends) {
        for (const slot of timeSlots) {
          results.push({ day, ...slot });
        }
      }
    }

    if (normalizedText.includes('daily') || normalizedText.includes('every day')) {
      const allDays = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
      const timeSlots = this.parseTimeRange(text);
      for (const day of allDays) {
        for (const slot of timeSlots) {
          results.push({ day, ...slot });
        }
      }
    }

    return results;
  }

  // Validate parsed availability slots
  validateSlots(slots) {
    return slots.filter(slot => {
      return slot.day && 
             slot.startTime >= 0 && 
             slot.startTime < 24 &&
             slot.endTime > 0 && 
             slot.endTime <= 24 &&
             slot.startTime < slot.endTime;
    });
  }

  // Format slots for display
  formatSlotsForDisplay(slots) {
    return slots.map(slot => {
      const startTime = this.formatHour(slot.startTime);
      const endTime = this.formatHour(slot.endTime);
      const day = slot.day.charAt(0).toUpperCase() + slot.day.slice(1);
      return `${day}: ${startTime} - ${endTime}`;
    }).join('\n');
  }

  // Format hour for display
  formatHour(hour) {
    const h = Math.floor(hour);
    const m = Math.round((hour - h) * 60);
    
    if (h === 0) return m > 0 ? `12:${m.toString().padStart(2, '0')} AM` : '12:00 AM';
    if (h === 12) return m > 0 ? `12:${m.toString().padStart(2, '0')} PM` : '12:00 PM';
    if (h < 12) return m > 0 ? `${h}:${m.toString().padStart(2, '0')} AM` : `${h}:00 AM`;
    return m > 0 ? `${h - 12}:${m.toString().padStart(2, '0')} PM` : `${h - 12}:00 PM`;
  }

  // Test the parser with sample inputs
  static test() {
    const parser = new AvailabilityParser();
    
    const testCases = [
      "I'm free Mondays 6-8pm",
      "Available Tuesday 10am-2pm",
      "Wednesdays from 6 to 10pm",
      "Free weekdays 8-10am",
      "Saturday and Sunday 2-4pm",
      "Monday 18-20, Tuesday 6pm-8pm"
    ];

    console.log('AvailabilityParser: Running tests...');
    
    for (const testCase of testCases) {
      console.log(`\nTest: "${testCase}"`);
      const result = parser.parseAvailability(testCase);
      console.log('Result:', result);
      if (result.slots.length > 0) {
        console.log('Formatted:', parser.formatSlotsForDisplay(result.slots));
      }
    }
  }
}

module.exports = AvailabilityParser;