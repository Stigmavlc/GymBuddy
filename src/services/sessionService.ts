import { supabase } from '@/lib/supabase';
import type { GymSession } from '@/types';

export const sessionService = {
  // Get all sessions for a user
  async getUserSessions(userId: string, status?: 'confirmed' | 'completed' | 'cancelled'): Promise<GymSession[]> {
    try {
      let query = supabase
        .from('sessions')
        .select('*')
        .contains('participants', [userId])
        .order('date', { ascending: false });

      if (status) {
        query = query.eq('status', status);
      }

      const { data, error } = await query;

      if (error) throw error;

      return data?.map(session => ({
        id: session.id,
        participants: session.participants,
        date: new Date(session.date),
        startTime: session.start_time,
        endTime: session.end_time,
        status: session.status as 'confirmed' | 'cancelled' | 'completed',
        createdAt: new Date(session.created_at)
      })) || [];
    } catch (error) {
      console.error('Error fetching user sessions:', error);
      throw error;
    }
  },

  // Get sessions for current week
  async getCurrentWeekSessions(userId: string): Promise<{
    completed: number;
    total: number;
    sessions: GymSession[];
  }> {
    try {
      // Get start and end of current week (Monday to Sunday)
      const now = new Date();
      const monday = new Date(now);
      const dayOfWeek = now.getDay();
      const daysToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
      monday.setDate(now.getDate() + daysToMonday);
      monday.setHours(0, 0, 0, 0);

      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);
      sunday.setHours(23, 59, 59, 999);

      const { data, error } = await supabase
        .from('sessions')
        .select('*')
        .contains('participants', [userId])
        .gte('date', monday.toISOString().split('T')[0])
        .lte('date', sunday.toISOString().split('T')[0])
        .in('status', ['confirmed', 'completed']);

      if (error) throw error;

      const sessions = data?.map(session => ({
        id: session.id,
        participants: session.participants,
        date: new Date(session.date),
        startTime: session.start_time,
        endTime: session.end_time,
        status: session.status as 'confirmed' | 'cancelled' | 'completed',
        createdAt: new Date(session.created_at)
      })) || [];

      const completed = sessions.filter(s => s.status === 'completed').length;
      const total = sessions.length;

      return { completed, total, sessions };
    } catch (error) {
      console.error('Error fetching current week sessions:', error);
      throw error;
    }
  },

  // Get upcoming confirmed sessions
  async getUpcomingSessions(userId: string, limit: number = 5): Promise<GymSession[]> {
    try {
      const now = new Date();
      const today = now.toISOString().split('T')[0];

      const { data, error } = await supabase
        .from('sessions')
        .select('*')
        .contains('participants', [userId])
        .eq('status', 'confirmed')
        .gte('date', today)
        .order('date', { ascending: true })
        .order('start_time', { ascending: true })
        .limit(limit);

      if (error) throw error;

      // Filter out sessions that have already ended today
      const currentHour = now.getHours();
      
      return data?.map(session => ({
        id: session.id,
        participants: session.participants,
        date: new Date(session.date),
        startTime: session.start_time,
        endTime: session.end_time,
        status: session.status as 'confirmed' | 'cancelled' | 'completed',
        createdAt: new Date(session.created_at)
      })).filter(session => {
        // If session is today, check if it hasn't ended yet
        if (session.date.toDateString() === now.toDateString()) {
          return session.endTime > currentHour;
        }
        return true;
      }) || [];
    } catch (error) {
      console.error('Error fetching upcoming sessions:', error);
      throw error;
    }
  },

  // Check and update completed sessions
  async updateCompletedSessions(userId: string): Promise<number> {
    try {
      const now = new Date();
      const currentDate = now.toISOString().split('T')[0];
      const currentHour = now.getHours();

      // Find all confirmed sessions that should be marked as completed
      const { data: sessionsToComplete, error: fetchError } = await supabase
        .from('sessions')
        .select('*')
        .contains('participants', [userId])
        .eq('status', 'confirmed')
        .or(`date.lt.${currentDate},and(date.eq.${currentDate},end_time.lte.${currentHour})`);

      if (fetchError) throw fetchError;

      if (!sessionsToComplete || sessionsToComplete.length === 0) {
        return 0;
      }

      // Update all these sessions to completed
      const sessionIds = sessionsToComplete.map(s => s.id);
      const { error: updateError } = await supabase
        .from('sessions')
        .update({ status: 'completed', updated_at: new Date().toISOString() })
        .in('id', sessionIds);

      if (updateError) throw updateError;

      return sessionsToComplete.length;
    } catch (error) {
      console.error('Error updating completed sessions:', error);
      throw error;
    }
  },

  // Calculate current streak
  async calculateStreak(userId: string): Promise<number> {
    try {
      // Get all completed sessions ordered by date
      const { data, error } = await supabase
        .from('sessions')
        .select('date')
        .contains('participants', [userId])
        .eq('status', 'completed')
        .order('date', { ascending: false });

      if (error) throw error;
      if (!data || data.length === 0) return 0;

      // Group sessions by week
      const sessionsByWeek = new Map<string, number>();
      
      data.forEach(session => {
        const date = new Date(session.date);
        const monday = new Date(date);
        const dayOfWeek = date.getDay();
        const daysToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
        monday.setDate(date.getDate() + daysToMonday);
        monday.setHours(0, 0, 0, 0);
        
        const weekKey = monday.toISOString().split('T')[0];
        sessionsByWeek.set(weekKey, (sessionsByWeek.get(weekKey) || 0) + 1);
      });

      // Check consecutive weeks with at least 2 sessions
      const weeks = Array.from(sessionsByWeek.entries())
        .filter(([, count]) => count >= 2)
        .sort((a, b) => new Date(b[0]).getTime() - new Date(a[0]).getTime());

      if (weeks.length === 0) return 0;

      let streak = 0;
      const currentWeekStart = new Date();
      const dayOfWeek = currentWeekStart.getDay();
      const daysToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
      currentWeekStart.setDate(currentWeekStart.getDate() + daysToMonday);
      currentWeekStart.setHours(0, 0, 0, 0);

      // Start checking from current week or last week
      let checkDate = new Date(currentWeekStart);
      
      for (let i = 0; i < weeks.length; i++) {
        const weekDate = new Date(weeks[i][0]);
        
        // If there's a gap, break the streak
        if (Math.abs(checkDate.getTime() - weekDate.getTime()) > 7 * 24 * 60 * 60 * 1000) {
          break;
        }
        
        streak++;
        checkDate = new Date(weekDate);
        checkDate.setDate(checkDate.getDate() - 7);
      }

      return streak;
    } catch (error) {
      console.error('Error calculating streak:', error);
      return 0;
    }
  },

  // Update user stats
  async updateUserStats(userId: string): Promise<void> {
    try {
      // Get total completed sessions
      const { data: completedSessions, error: sessionsError } = await supabase
        .from('sessions')
        .select('id')
        .contains('participants', [userId])
        .eq('status', 'completed');

      if (sessionsError) throw sessionsError;

      const totalSessions = completedSessions?.length || 0;
      const currentStreak = await this.calculateStreak(userId);

      // Update user stats
      const { error: updateError } = await supabase
        .from('users')
        .update({
          stats: {
            total_sessions: totalSessions,
            current_streak: currentStreak,
            badges: [] // Will be updated when we implement badge logic
          },
          updated_at: new Date().toISOString()
        })
        .eq('id', userId);

      if (updateError) throw updateError;

    } catch (error) {
      console.error('Error updating user stats:', error);
      throw error;
    }
  }
};