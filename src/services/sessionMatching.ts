import { supabase } from '@/lib/supabase';

export interface TimeSlot {
  day: string;
  hour: number;
  dayIndex: number; // 0 = Monday, 6 = Sunday
}

export interface SessionOption {
  id: string;
  day: string;
  hour: number;
  duration: number; // hours
  participants: string[];
  dayIndex: number;
}

export interface WeeklySessionPlan {
  session1: SessionOption;
  session2: SessionOption;
  totalOptions: number;
}

export const sessionMatchingService = {
  // Get availability for both users
  async getUsersAvailability(userId1: string, userId2: string) {
    console.log('Getting availability for users:', userId1, userId2);
    
    const { data, error } = await supabase
      .from('availability')
      .select('*')
      .in('user_id', [userId1, userId2]);

    if (error) {
      console.error('Error fetching availability:', error);
      throw error;
    }

    console.log('Raw availability data:', data);

    // Organize by user
    const user1Availability: TimeSlot[] = [];
    const user2Availability: TimeSlot[] = [];

    data?.forEach(slot => {
      const dayIndex = getDayIndex(slot.day);
      
      // Convert each hour in the slot range to individual time slots
      for (let hour = slot.start_time; hour < slot.end_time; hour++) {
        const timeSlot = {
          day: slot.day,
          hour,
          dayIndex
        };

        if (slot.user_id === userId1) {
          user1Availability.push(timeSlot);
        } else {
          user2Availability.push(timeSlot);
        }
      }
    });

    return { user1Availability, user2Availability };
  },

  // Find overlapping time slots
  findOverlappingSlots(user1Slots: TimeSlot[], user2Slots: TimeSlot[]): TimeSlot[] {
    console.log('Finding overlapping slots...');
    console.log('User 1 slots:', user1Slots.length);
    console.log('User 2 slots:', user2Slots.length);

    const overlapping: TimeSlot[] = [];

    user1Slots.forEach(slot1 => {
      const match = user2Slots.find(slot2 => 
        slot1.day === slot2.day && slot1.hour === slot2.hour
      );

      if (match) {
        overlapping.push(slot1);
      }
    });

    console.log('Found overlapping slots:', overlapping.length);
    return overlapping;
  },

  // Generate session options (2-hour workouts)
  generateSessionOptions(overlappingSlots: TimeSlot[], userIds: string[]): SessionOption[] {
    console.log('Generating session options from', overlappingSlots.length, 'overlapping slots');
    
    const sessions: SessionOption[] = [];

    // Group slots by day
    const slotsByDay: { [day: string]: TimeSlot[] } = {};
    overlappingSlots.forEach(slot => {
      if (!slotsByDay[slot.day]) {
        slotsByDay[slot.day] = [];
      }
      slotsByDay[slot.day].push(slot);
    });

    // For each day, find consecutive 2-hour blocks
    Object.entries(slotsByDay).forEach(([day, slots]) => {
      // Sort by hour
      const sortedSlots = slots.sort((a, b) => a.hour - b.hour);
      
      // Find consecutive 2-hour blocks
      for (let i = 0; i < sortedSlots.length - 1; i++) {
        const currentSlot = sortedSlots[i];
        const nextSlot = sortedSlots[i + 1];
        
        // Check if next hour is consecutive
        if (nextSlot.hour === currentSlot.hour + 1) {
          sessions.push({
            id: `${day}-${currentSlot.hour}`,
            day,
            hour: currentSlot.hour,
            duration: 2,
            participants: userIds,
            dayIndex: currentSlot.dayIndex
          });
        }
      }
    });

    console.log('Generated', sessions.length, 'session options');
    return sessions;
  },

  // Create weekly session plans (2 non-consecutive sessions)
  createWeeklyPlans(sessionOptions: SessionOption[]): WeeklySessionPlan[] {
    console.log('Creating weekly plans from', sessionOptions.length, 'session options');
    
    const plans: WeeklySessionPlan[] = [];

    // Try all combinations of 2 sessions
    for (let i = 0; i < sessionOptions.length; i++) {
      for (let j = i + 1; j < sessionOptions.length; j++) {
        const session1 = sessionOptions[i];
        const session2 = sessionOptions[j];

        // Ensure sessions are on non-consecutive days
        const dayDiff = Math.abs(session1.dayIndex - session2.dayIndex);
        
        // Non-consecutive means at least 1 day gap
        if (dayDiff > 1 && dayDiff < 6) {
          plans.push({
            session1,
            session2,
            totalOptions: sessionOptions.length
          });
        }
      }
    }

    // Sort plans by optimal timing (prefer Monday/Thursday, Tuesday/Friday, etc.)
    plans.sort((a, b) => {
      const aSpread = Math.abs(a.session1.dayIndex - a.session2.dayIndex);
      const bSpread = Math.abs(b.session1.dayIndex - b.session2.dayIndex);
      
      // Prefer more evenly spaced sessions (closer to 3 days apart)
      const aScore = Math.abs(aSpread - 3);
      const bScore = Math.abs(bSpread - 3);
      
      return aScore - bScore;
    });

    console.log('Created', plans.length, 'weekly plans');
    return plans.slice(0, 5); // Return top 5 options
  },

  // Main function to find session matches
  async findSessionMatches(userId1: string, userId2: string): Promise<WeeklySessionPlan[]> {
    try {
      console.log('Finding session matches for users:', userId1, userId2);
      
      // Get availability for both users
      const { user1Availability, user2Availability } = await this.getUsersAvailability(userId1, userId2);

      // Find overlapping slots
      const overlappingSlots = this.findOverlappingSlots(user1Availability, user2Availability);

      if (overlappingSlots.length === 0) {
        console.log('No overlapping availability found');
        return [];
      }

      // Generate session options
      const sessionOptions = this.generateSessionOptions(overlappingSlots, [userId1, userId2]);

      if (sessionOptions.length < 2) {
        console.log('Not enough session options for weekly plan');
        return [];
      }

      // Create weekly plans
      const weeklyPlans = this.createWeeklyPlans(sessionOptions);

      console.log('Found', weeklyPlans.length, 'weekly session plans');
      return weeklyPlans;

    } catch (error) {
      console.error('Error finding session matches:', error);
      throw error;
    }
  }
};

// Helper function to get day index
function getDayIndex(day: string): number {
  const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
  return days.indexOf(day.toLowerCase());
}

// Helper function to format time
export function formatTime(hour: number): string {
  if (hour === 0) return '12:00 AM';
  if (hour === 12) return '12:00 PM';
  if (hour < 12) return `${hour}:00 AM`;
  return `${hour - 12}:00 PM`;
}

// Helper function to format session
export function formatSession(session: SessionOption): string {
  const startTime = formatTime(session.hour);
  const endTime = formatTime(session.hour + session.duration);
  return `${session.day} ${startTime} - ${endTime}`;
}