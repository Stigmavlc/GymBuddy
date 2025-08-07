// Free Notification Service for GymBuddy
// Supports: Browser Push Notifications, Email Notifications, In-App Notifications

export interface NotificationOptions {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  tag?: string;
  requireInteraction?: boolean;
}

export interface EmailNotification {
  to: string;
  subject: string;
  message: string;
}

class NotificationService {
  private permission: NotificationPermission = 'default';

  constructor() {
    this.checkPermission();
  }

  // Check if browser notifications are supported and get permission
  async checkPermission(): Promise<boolean> {
    if (!('Notification' in window)) {
      console.warn('This browser does not support notifications');
      return false;
    }

    this.permission = Notification.permission;
    return this.permission === 'granted';
  }

  // Request permission for browser notifications
  async requestPermission(): Promise<boolean> {
    if (!('Notification' in window)) {
      return false;
    }

    if (this.permission === 'default') {
      this.permission = await Notification.requestPermission();
    }

    return this.permission === 'granted';
  }

  // Send browser push notification
  async sendBrowserNotification(options: NotificationOptions): Promise<boolean> {
    const hasPermission = await this.checkPermission();
    
    if (!hasPermission) {
      console.log('Browser notifications not available, showing in-app notification instead');
      return false;
    }

    try {
      const notification = new Notification(options.title, {
        body: options.body,
        icon: options.icon || '/favicon.ico',
        badge: options.badge || '/favicon.ico',
        tag: options.tag || 'gymbuddy',
        requireInteraction: options.requireInteraction || false
      });

      // Auto-close after 8 seconds
      setTimeout(() => {
        notification.close();
      }, 8000);

      return true;
    } catch (error) {
      console.error('Failed to send browser notification:', error);
      return false;
    }
  }

  // Send email notification (using mailto for now, can be upgraded to email service later)
  sendEmailNotification(notification: EmailNotification): boolean {
    try {
      const subject = encodeURIComponent(notification.subject);
      const body = encodeURIComponent(notification.message);
      const mailtoLink = `mailto:${notification.to}?subject=${subject}&body=${body}`;
      
      // Open default email client
      window.open(mailtoLink, '_blank');
      return true;
    } catch (error) {
      console.error('Failed to send email notification:', error);
      return false;
    }
  }

  // Check if notifications are available
  isAvailable(): boolean {
    return 'Notification' in window;
  }

  // Get current permission status
  getPermissionStatus(): NotificationPermission {
    return this.permission;
  }
}

// Create singleton instance
export const notificationService = new NotificationService();

// Notification Templates for GymBuddy
export const NOTIFICATION_TEMPLATES = {
  AVAILABILITY_READY: (partnerName: string) => ({
    title: '🏋️‍♂️ Ready to Schedule!',
    body: `Great news! Both you and ${partnerName} have set your availability. Time to find your perfect workout schedule!`,
    tag: 'availability-ready',
    requireInteraction: true
  }),

  SESSION_CONFIRMED: (partnerName: string, day: string, time: string) => ({
    title: '💪 Gym Session Confirmed!',
    body: `Your workout with ${partnerName} is confirmed for ${day} at ${time}. Let's crush it!`,
    tag: 'session-confirmed',
    requireInteraction: true
  }),

  SESSION_CANCELLED: (partnerName: string, day: string, time: string) => ({
    title: '❌ Session Cancelled',
    body: `${partnerName} had to cancel your ${day} ${time} workout. Check the app to reschedule!`,
    tag: 'session-cancelled',
    requireInteraction: true
  }),

  SESSION_REMINDER: (partnerName: string, timeUntil: string) => ({
    title: '⏰ Workout Reminder',
    body: `Your gym session with ${partnerName} starts in ${timeUntil}. Time to get pumped!`,
    tag: 'session-reminder'
  }),

  PARTNER_JOINED: (partnerName: string) => ({
    title: '🎉 Your Gym Buddy Joined!',
    body: `${partnerName} just created their account. You can now coordinate workouts together!`,
    tag: 'partner-joined',
    requireInteraction: true
  }),

  AVAILABILITY_UPDATED: (partnerName: string) => ({
    title: '📅 Schedule Updated',
    body: `${partnerName} updated their availability. Check for new matching workout times!`,
    tag: 'availability-updated'
  })
};

// Email Templates
export const EMAIL_TEMPLATES = {
  AVAILABILITY_READY: (partnerName: string, appUrl: string) => ({
    subject: '🏋️‍♂️ GymBuddy: Ready to Schedule Workouts!',
    message: `Hi there!\n\nGreat news! Both you and ${partnerName} have set your availability in GymBuddy.\n\nYou can now find matching workout times and schedule your sessions together!\n\n👉 Open GymBuddy: ${appUrl}\n\nLet's get those gains! 💪\n\n---\nGymBuddy Team`
  }),

  SESSION_CONFIRMED: (partnerName: string, day: string, time: string, appUrl: string) => ({
    subject: '💪 GymBuddy: Workout Session Confirmed',
    message: `Hi there!\n\nYour gym session is confirmed!\n\n📅 Partner: ${partnerName}\n📅 Date: ${day}\n⏰ Time: ${time}\n\nSee you at the gym! 🏋️‍♂️\n\n👉 Manage sessions: ${appUrl}\n\n---\nGymBuddy Team`
  }),

  SESSION_CANCELLED: (partnerName: string, day: string, time: string, appUrl: string) => ({
    subject: '❌ GymBuddy: Session Cancelled',
    message: `Hi there!\n\nYour gym session has been cancelled:\n\n📅 Partner: ${partnerName}\n📅 Original Date: ${day}\n⏰ Original Time: ${time}\n\nDon't worry - you can reschedule anytime in the app!\n\n👉 Reschedule: ${appUrl}\n\n---\nGymBuddy Team`
  })
};