class ReminderService {
  constructor(db, telegramBot) {
    this.db = db;
    this.bot = telegramBot;
    
    // Check for reminders every 15 minutes
    this.reminderInterval = setInterval(() => this.checkReminders(), 15 * 60 * 1000);
    
    console.log('ReminderService: Initialized with 15-minute check intervals');
  }

  /**
   * Check for upcoming sessions and send reminders
   */
  async checkReminders() {
    try {
      console.log('ReminderService: Checking for reminder opportunities...');
      
      // Get sessions that are happening in the next 24 hours and next 1 hour
      const upcomingSessions = await this.getSessionsNeedingReminders();
      
      for (const session of upcomingSessions) {
        const sessionTime = new Date(`${session.date}T${this.formatTimeForDate(session.start_time)}:00`);
        const now = new Date();
        const timeUntilSession = sessionTime.getTime() - now.getTime();
        
        // Convert to hours
        const hoursUntil = Math.round(timeUntilSession / (1000 * 60 * 60));
        
        // Send 24-hour reminder
        if (hoursUntil <= 24 && hoursUntil > 23) {
          await this.send24HourReminder(session);
        }
        
        // Send 1-hour reminder
        if (hoursUntil <= 1 && hoursUntil > 0) {
          await this.send1HourReminder(session);
        }
        
        // Send session starting soon reminder (15 minutes)
        const minutesUntil = Math.round(timeUntilSession / (1000 * 60));
        if (minutesUntil <= 15 && minutesUntil > 0) {
          await this.sendStartingSoonReminder(session);
        }
      }
    } catch (error) {
      console.error('ReminderService: Error checking reminders:', error);
    }
  }

  /**
   * Get sessions that need reminders
   */
  async getSessionsNeedingReminders() {
    try {
      const now = new Date();
      const twentyFourHoursFromNow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
      
      const { data, error } = await this.db.supabase
        .from('sessions')
        .select('*')
        .eq('status', 'confirmed')
        .gte('date', now.toISOString().split('T')[0])
        .lte('date', twentyFourHoursFromNow.toISOString().split('T')[0]);

      if (error) {
        console.error('ReminderService: Error fetching sessions:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('ReminderService: Database error:', error);
      return [];
    }
  }

  /**
   * Send 24-hour reminder
   */
  async send24HourReminder(session) {
    try {
      const sessionTime = this.formatSessionTime(session.date, session.start_time, session.end_time);
      
      const reminderMessage = `⏰ **24-Hour Reminder**\n\n` +
        `Don't forget about your upcoming gym session:\n` +
        `📅 ${sessionTime}\n\n` +
        `Time to start preparing mentally! 💪\n\n` +
        `Reply "confirm" if you're still good to go, or let me know if you need to make changes.`;

      // Send to both participants
      for (const participantId of session.participants) {
        const user = await this.getUserById(participantId);
        if (user?.telegram_id) {
          await this.bot.sendMessage(user.telegram_id, reminderMessage, {
            parse_mode: 'Markdown'
          });
          console.log(`ReminderService: 24h reminder sent to ${user.name}`);
        }
      }

      // Mark reminder as sent (we could add a reminders table for this)
      console.log(`ReminderService: 24-hour reminder sent for session ${session.id}`);
    } catch (error) {
      console.error('ReminderService: Error sending 24h reminder:', error);
    }
  }

  /**
   * Send 1-hour reminder
   */
  async send1HourReminder(session) {
    try {
      const sessionTime = this.formatSessionTime(session.date, session.start_time, session.end_time);
      
      const reminderMessage = `🔥 **1-Hour Reminder**\n\n` +
        `Your gym session starts in about 1 hour:\n` +
        `📅 ${sessionTime}\n\n` +
        `Time to get ready! 🏃‍♂️💪\n\n` +
        `• Grab your water bottle 💧\n` +
        `• Put on your workout clothes 👕\n` +
        `• Get pumped! 🎵`;

      // Send to both participants
      for (const participantId of session.participants) {
        const user = await this.getUserById(participantId);
        if (user?.telegram_id) {
          await this.bot.sendMessage(user.telegram_id, reminderMessage, {
            parse_mode: 'Markdown'
          });
          console.log(`ReminderService: 1h reminder sent to ${user.name}`);
        }
      }

      console.log(`ReminderService: 1-hour reminder sent for session ${session.id}`);
    } catch (error) {
      console.error('ReminderService: Error sending 1h reminder:', error);
    }
  }

  /**
   * Send starting soon reminder (15 minutes)
   */
  async sendStartingSoonReminder(session) {
    try {
      const sessionTime = this.formatSessionTime(session.date, session.start_time, session.end_time);
      
      const reminderMessage = `🚨 **Session Starting Soon!**\n\n` +
        `Your gym session starts in 15 minutes:\n` +
        `📅 ${sessionTime}\n\n` +
        `Time to head out! 🏃‍♂️💨\n\n` +
        `See you there, gym buddy! 💪🤝`;

      // Send to both participants
      for (const participantId of session.participants) {
        const user = await this.getUserById(participantId);
        if (user?.telegram_id) {
          await this.bot.sendMessage(user.telegram_id, reminderMessage, {
            parse_mode: 'Markdown'
          });
          console.log(`ReminderService: 15min reminder sent to ${user.name}`);
        }
      }

      console.log(`ReminderService: 15-minute reminder sent for session ${session.id}`);
    } catch (error) {
      console.error('ReminderService: Error sending 15min reminder:', error);
    }
  }

  /**
   * Send post-workout check-in
   */
  async sendPostWorkoutCheckIn(session) {
    try {
      const sessionTime = this.formatSessionTime(session.date, session.start_time, session.end_time);
      
      const checkInMessage = `✅ **How was your workout?**\n\n` +
        `Your gym session was scheduled for:\n` +
        `📅 ${sessionTime}\n\n` +
        `Reply with:\n` +
        `• "completed" if you finished your workout\n` +
        `• "missed" if you couldn't make it\n\n` +
        `Let me know how it went! 💪`;

      // Send to both participants
      for (const participantId of session.participants) {
        const user = await this.getUserById(participantId);
        if (user?.telegram_id) {
          await this.bot.sendMessage(user.telegram_id, checkInMessage, {
            parse_mode: 'Markdown'
          });
          console.log(`ReminderService: Post-workout check-in sent to ${user.name}`);
        }
      }

      console.log(`ReminderService: Post-workout check-in sent for session ${session.id}`);
    } catch (error) {
      console.error('ReminderService: Error sending post-workout check-in:', error);
    }
  }

  /**
   * Schedule a post-workout check-in
   */
  schedulePostWorkoutCheckIn(session) {
    const sessionEndTime = new Date(`${session.date}T${this.formatTimeForDate(session.end_time)}:00`);
    const checkInTime = new Date(sessionEndTime.getTime() + 30 * 60 * 1000); // 30 minutes after session ends
    const now = new Date();
    
    const delay = checkInTime.getTime() - now.getTime();
    
    if (delay > 0) {
      setTimeout(() => {
        this.sendPostWorkoutCheckIn(session);
      }, delay);
      
      console.log(`ReminderService: Post-workout check-in scheduled for session ${session.id} in ${Math.round(delay / 1000 / 60)} minutes`);
    }
  }

  /**
   * Get user by ID
   */
  async getUserById(userId) {
    try {
      const { data, error } = await this.db.supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) {
        console.error('ReminderService: Error fetching user:', error);
        return null;
      }

      return data;
    } catch (error) {
      console.error('ReminderService: Database error:', error);
      return null;
    }
  }

  /**
   * Format session time for display
   */
  formatSessionTime(date, startTime, endTime) {
    const sessionDate = new Date(date);
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    const formattedDate = sessionDate.toLocaleDateString('en-US', options);
    
    const formatHour = (hour) => {
      if (hour === 0) return '12 AM';
      if (hour === 12) return '12 PM';
      if (hour < 12) return `${hour} AM`;
      return `${hour - 12} PM`;
    };
    
    return `${formattedDate}, ${formatHour(startTime)} - ${formatHour(endTime)}`;
  }

  /**
   * Format hour for ISO time string
   */
  formatTimeForDate(hour) {
    return hour.toString().padStart(2, '0') + ':00';
  }

  /**
   * Enable/disable reminders for a user
   */
  async setReminderPreferences(userId, preferences) {
    try {
      const { error } = await this.db.supabase
        .from('users')
        .update({
          preferences: {
            ...preferences,
            notifications: {
              ...preferences.notifications,
              reminders: preferences.reminders !== false // Default to true
            }
          }
        })
        .eq('id', userId);

      if (error) {
        console.error('ReminderService: Error updating preferences:', error);
        return false;
      }

      console.log(`ReminderService: Reminder preferences updated for user ${userId}`);
      return true;
    } catch (error) {
      console.error('ReminderService: Database error:', error);
      return false;
    }
  }

  /**
   * Cleanup - stop intervals when service is destroyed
   */
  destroy() {
    if (this.reminderInterval) {
      clearInterval(this.reminderInterval);
      console.log('ReminderService: Stopped reminder intervals');
    }
  }
}

module.exports = ReminderService;