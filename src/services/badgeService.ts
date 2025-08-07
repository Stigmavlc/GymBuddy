import { supabase } from '@/lib/supabase';
import { sessionService } from './sessionService';
import type { Badge, GymSession } from '@/types';

export interface UserBadge extends Badge {
  category: string;
  isUnlocked: boolean;
  unlockedAt?: Date;
  progress?: number; // Percentage towards earning this badge
  progressText?: string; // Human readable progress
}

export interface BadgeUnlock {
  badge: UserBadge;
  isNewUnlock: boolean;
}

export const badgeService = {
  // Get all available badges from database
  async getAllBadges(): Promise<Badge[]> {
    try {
      const { data, error } = await supabase
        .from('badges')
        .select('*')
        .order('created_at', { ascending: true });

      if (error) throw error;

      return data?.map(badge => ({
        id: badge.id,
        name: badge.name,
        description: badge.description,
        criteria: badge.criteria,
        icon: badge.icon,
        category: badge.category
      })) || [];
    } catch (error) {
      console.error('Error fetching badges:', error);
      throw error;
    }
  },

  // Get user's unlocked badges
  async getUserBadges(userId: string): Promise<string[]> {
    try {
      const { data, error } = await supabase
        .from('user_badges')
        .select('badge_id')
        .eq('user_id', userId);

      if (error) throw error;

      return data?.map(ub => ub.badge_id) || [];
    } catch (error) {
      console.error('Error fetching user badges:', error);
      return [];
    }
  },

  // Get badges with user progress
  async getBadgesWithProgress(userId: string): Promise<UserBadge[]> {
    try {
      const [allBadges, userBadgeIds, sessions] = await Promise.all([
        this.getAllBadges(),
        this.getUserBadges(userId),
        sessionService.getUserSessions(userId)
      ]);

      const completedSessions = sessions.filter(s => s.status === 'completed');
      const currentStreak = await sessionService.calculateStreak(userId);

      return allBadges.map(badge => {
        const isUnlocked = userBadgeIds.includes(badge.id);
        const progress = this.calculateBadgeProgress(badge.id, completedSessions, currentStreak);

        return {
          ...badge,
          category: badge.category || 'general',
          isUnlocked,
          progress: progress.percentage,
          progressText: progress.text
        };
      });
    } catch (error) {
      console.error('Error getting badges with progress:', error);
      throw error;
    }
  },

  // Calculate progress towards a specific badge
  calculateBadgeProgress(badgeId: string, completedSessions: GymSession[], currentStreak: number): { percentage: number; text: string } {
    const totalSessions = completedSessions.length;
    
    // Get sessions by time of day
    const morningSessions = completedSessions.filter(s => s.startTime < 8).length;
    const eveningSessions = completedSessions.filter(s => s.startTime >= 20).length;

    // Calculate monthly sessions (last 12 months)
    const monthlySessionCounts = this.getMonthlySessionCounts(completedSessions);
    const perfectMonths = monthlySessionCounts.filter(count => count >= 8).length;

    switch (badgeId) {
      case 'first-week':
        return currentStreak >= 1 
          ? { percentage: 100, text: 'Completed!' }
          : { percentage: Math.min((totalSessions / 2) * 100, 99), text: `${totalSessions}/2 sessions this week` };

      case 'consistency-5':
        return { 
          percentage: Math.min((currentStreak / 5) * 100, 100), 
          text: `${currentStreak}/5 consecutive weeks` 
        };

      case 'consistency-10':
        return { 
          percentage: Math.min((currentStreak / 10) * 100, 100), 
          text: `${currentStreak}/10 consecutive weeks` 
        };

      case 'unstoppable':
        return { 
          percentage: Math.min((currentStreak / 20) * 100, 100), 
          text: `${currentStreak}/20 consecutive weeks` 
        };

      case 'quarter-master':
        return { 
          percentage: Math.min((currentStreak / 12) * 100, 100), 
          text: `${currentStreak}/12 consecutive weeks` 
        };

      case 'half-year-hero':
        return { 
          percentage: Math.min((currentStreak / 25) * 100, 100), 
          text: `${currentStreak}/25 consecutive weeks` 
        };

      case 'yearly-legend':
        return { 
          percentage: Math.min((currentStreak / 50) * 100, 100), 
          text: `${currentStreak}/50 consecutive weeks` 
        };

      case 'sessions-10':
        return { 
          percentage: Math.min((totalSessions / 10) * 100, 100), 
          text: `${totalSessions}/10 total sessions` 
        };

      case 'sessions-50':
        return { 
          percentage: Math.min((totalSessions / 50) * 100, 100), 
          text: `${totalSessions}/50 total sessions` 
        };

      case 'century-club':
        return { 
          percentage: Math.min((totalSessions / 100) * 100, 100), 
          text: `${totalSessions}/100 total sessions` 
        };

      case 'double-century':
        return { 
          percentage: Math.min((totalSessions / 200) * 100, 100), 
          text: `${totalSessions}/200 total sessions` 
        };

      case 'triple-digits':
        return { 
          percentage: Math.min((totalSessions / 300) * 100, 100), 
          text: `${totalSessions}/300 total sessions` 
        };

      case 'early-bird':
        return { 
          percentage: Math.min((morningSessions / 5) * 100, 100), 
          text: `${morningSessions}/5 morning sessions` 
        };

      case 'morning-champion':
        return { 
          percentage: Math.min((morningSessions / 25) * 100, 100), 
          text: `${morningSessions}/25 morning sessions` 
        };

      case 'night-owl':
        return { 
          percentage: Math.min((eveningSessions / 5) * 100, 100), 
          text: `${eveningSessions}/5 evening sessions` 
        };

      case 'night-champion':
        return { 
          percentage: Math.min((eveningSessions / 25) * 100, 100), 
          text: `${eveningSessions}/25 evening sessions` 
        };

      case 'perfect-month':
        return { 
          percentage: perfectMonths > 0 ? 100 : Math.min((Math.max(...monthlySessionCounts, 0) / 8) * 100, 99), 
          text: perfectMonths > 0 ? 'Completed!' : `${Math.max(...monthlySessionCounts, 0)}/8 sessions this month` 
        };

      case 'perfect-quarter': {
        const consecutivePerfectMonths = this.getConsecutivePerfectMonths(monthlySessionCounts);
        return { 
          percentage: Math.min((consecutivePerfectMonths / 3) * 100, 100), 
          text: `${consecutivePerfectMonths}/3 consecutive perfect months` 
        };
      }

      default:
        return { percentage: 0, text: 'Not started' };
    }
  },

  // Check and award new badges
  async checkAndAwardBadges(userId: string): Promise<BadgeUnlock[]> {
    try {
      const badgesWithProgress = await this.getBadgesWithProgress(userId);
      const newUnlocks: BadgeUnlock[] = [];

      for (const badge of badgesWithProgress) {
        if (!badge.isUnlocked && badge.progress === 100) {
          // Award this badge
          await this.awardBadge(userId, badge.id);
          newUnlocks.push({
            badge: { ...badge, isUnlocked: true, unlockedAt: new Date() },
            isNewUnlock: true
          });
        }
      }

      return newUnlocks;
    } catch (error) {
      console.error('Error checking and awarding badges:', error);
      return [];
    }
  },

  // Award a badge to a user
  async awardBadge(userId: string, badgeId: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('user_badges')
        .insert({ 
          user_id: userId, 
          badge_id: badgeId,
          unlocked_at: new Date().toISOString()
        });

      if (error) throw error;

      // Update user stats with new badge
      const { data: userBadges } = await supabase
        .from('user_badges')
        .select('badge_id')
        .eq('user_id', userId);

      const badgeIds = userBadges?.map(ub => ub.badge_id) || [];

      await supabase
        .from('users')
        .update({
          stats: {
            total_sessions: 0, // Will be updated by sessionService
            current_streak: 0, // Will be updated by sessionService
            badges: badgeIds
          },
          updated_at: new Date().toISOString()
        })
        .eq('id', userId);

    } catch (error) {
      console.error('Error awarding badge:', error);
      throw error;
    }
  },

  // Helper function to get monthly session counts
  getMonthlySessionCounts(completedSessions: GymSession[]): number[] {
    const monthCounts: Record<string, number> = {};
    
    completedSessions.forEach(session => {
      const monthKey = session.date.toISOString().slice(0, 7); // YYYY-MM
      monthCounts[monthKey] = (monthCounts[monthKey] || 0) + 1;
    });

    return Object.values(monthCounts);
  },

  // Helper function to get consecutive perfect months
  getConsecutivePerfectMonths(monthlySessionCounts: number[]): number {
    let consecutive = 0;
    let maxConsecutive = 0;

    for (const count of monthlySessionCounts.reverse()) {
      if (count >= 8) {
        consecutive++;
        maxConsecutive = Math.max(maxConsecutive, consecutive);
      } else {
        consecutive = 0;
      }
    }

    return maxConsecutive;
  },

  // Retroactively check and award all badges for a user
  async recheckAllUserBadges(userId: string): Promise<BadgeUnlock[]> {
    try {
      console.log(`Starting retroactive badge check for user ${userId}`);
      
      // Get all sessions and current data
      const [allBadges, userBadgeIds, sessions] = await Promise.all([
        this.getAllBadges(),
        this.getUserBadges(userId),
        sessionService.getUserSessions(userId)
      ]);

      const completedSessions = sessions.filter(s => s.status === 'completed');
      const currentStreak = await sessionService.calculateStreak(userId);
      const newUnlocks: BadgeUnlock[] = [];

      console.log(`User has ${completedSessions.length} completed sessions and ${currentStreak} week streak`);
      console.log(`User currently has ${userBadgeIds.length} badges unlocked`);

      // Check each badge against current progress
      for (const badge of allBadges) {
        const isCurrentlyUnlocked = userBadgeIds.includes(badge.id);
        const progress = this.calculateBadgeProgress(badge.id, completedSessions, currentStreak);
        
        // If badge should be unlocked but isn't, award it
        if (!isCurrentlyUnlocked && progress.percentage >= 100) {
          console.log(`Awarding missing badge: ${badge.name} (${badge.id})`);
          await this.awardBadge(userId, badge.id);
          newUnlocks.push({
            badge: {
              ...badge,
              category: badge.category || 'general',
              isUnlocked: true,
              unlockedAt: new Date(),
              progress: 100,
              progressText: 'Completed!'
            },
            isNewUnlock: true
          });
        }
      }

      console.log(`Retroactive check complete. Awarded ${newUnlocks.length} missing badges.`);
      return newUnlocks;
    } catch (error) {
      console.error('Error in retroactive badge check:', error);
      throw error;
    }
  },

  // Check badge consistency and return mismatches
  async checkBadgeConsistency(userId: string): Promise<{
    missingBadges: Badge[];
    incorrectlyUnlocked: Badge[];
    totalSessions: number;
    currentStreak: number;
  }> {
    try {
      const [allBadges, userBadgeIds, sessions] = await Promise.all([
        this.getAllBadges(),
        this.getUserBadges(userId),
        sessionService.getUserSessions(userId)
      ]);

      const completedSessions = sessions.filter(s => s.status === 'completed');
      const currentStreak = await sessionService.calculateStreak(userId);

      const missingBadges: Badge[] = [];
      const incorrectlyUnlocked: Badge[] = [];

      for (const badge of allBadges) {
        const isUnlocked = userBadgeIds.includes(badge.id);
        const progress = this.calculateBadgeProgress(badge.id, completedSessions, currentStreak);
        const shouldBeUnlocked = progress.percentage >= 100;

        if (shouldBeUnlocked && !isUnlocked) {
          missingBadges.push(badge);
        } else if (!shouldBeUnlocked && isUnlocked) {
          incorrectlyUnlocked.push(badge);
        }
      }

      return {
        missingBadges,
        incorrectlyUnlocked,
        totalSessions: completedSessions.length,
        currentStreak
      };
    } catch (error) {
      console.error('Error checking badge consistency:', error);
      throw error;
    }
  }
};