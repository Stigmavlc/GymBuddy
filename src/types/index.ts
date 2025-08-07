// User types
export interface User {
  id: string;
  email: string;
  name: string;
  avatar?: string;
  phoneNumber?: string;
  partnerId?: string;
  preferences: {
    notifications: {
      sms: boolean;
      push: boolean;
      browser?: boolean;
      email?: boolean;
      whatsapp?: boolean;
      reminderTime: number; // minutes before session
    };
  };
  stats: {
    totalSessions: number;
    currentStreak: number;
    badges: string[];
  };
}

// Availability types
export interface TimeSlot {
  day: 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';
  startTime: number; // 30-minute slots (0-47, where 0 = 00:00, 1 = 00:30, etc.)
  endTime: number;
}

export interface WeeklyAvailability {
  userId: string;
  slots: TimeSlot[];
  submittedAt: Date;
}

// Session types
export interface GymSession {
  id: string;
  participants: string[]; // user IDs
  date: Date;
  startTime: number;
  endTime: number;
  status: 'confirmed' | 'cancelled' | 'completed';
  createdAt: Date;
}

// Gamification types
export interface Badge {
  id: string;
  name: string;
  description: string;
  criteria: string;
  icon: string;
  category?: string;
  unlockedAt?: Date;
}

export interface Challenge {
  id: string;
  name: string;
  description: string;
  targetValue: number;
  currentValue: number;
  startDate: Date;
  endDate: Date;
  type: 'weekly' | 'monthly';
}

// Analytics types
export interface SessionStats {
  totalSessions: number;
  attendanceRate: number;
  currentWeeklyStreak: number;
  sessionsPerWeek: number[];
  favoriteDays: Record<string, number>;
  favoriteTimes: Record<number, number>;
  averageLeadTime: number;
  scheduleVariability: number;
}