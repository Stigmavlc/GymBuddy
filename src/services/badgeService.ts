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
  // Initialize badges if they don't exist
  async initializeBadges(): Promise<boolean> {
    try {
      console.log('BadgeService: Initializing badges...');
      
      // Check if badges exist
      const { data: existingBadges, error: checkError } = await supabase
        .from('badges')
        .select('count')
        .limit(1);
      
      if (checkError) {
        console.error('BadgeService: Error checking existing badges:', checkError);
        return false;
      }
      
      // If badges already exist, no need to initialize
      if (existingBadges && existingBadges.length > 0) {
        console.log('BadgeService: Badges already initialized');
        return true;
      }
      
      console.log('BadgeService: No badges found, creating default badges...');
      
      // Define default badges (matching what's in seed_badges.sql)
      const defaultBadges = [
        { id: 'first-week', name: 'Getting Started', description: 'Complete your first week of workouts', criteria: 'Complete first week with 2 sessions', icon: '🎯', category: 'progress' },
        { id: 'consistency-5', name: 'Steady Gains', description: 'Maintain consistency for 5 weeks', criteria: '5 consecutive weeks with 2+ sessions each', icon: '📈', category: 'consistency' },
        { id: 'consistency-10', name: 'Iron Will', description: 'Show dedication for 10 weeks', criteria: '10 consecutive weeks with 2+ sessions each', icon: '🔥', category: 'consistency' },
        { id: 'unstoppable', name: 'Unstoppable Force', description: 'Amazing consistency streak', criteria: '20 consecutive weeks with 2+ sessions each', icon: '⚡', category: 'consistency' },
        { id: 'quarter-master', name: 'Quarter Master', description: 'Three months of dedication', criteria: '12 consecutive weeks with 2+ sessions each', icon: '🏆', category: 'consistency' },
        { id: 'half-year-hero', name: 'Half Year Hero', description: 'Six months of commitment', criteria: '25 consecutive weeks with 2+ sessions each', icon: '🌟', category: 'consistency' },
        { id: 'yearly-legend', name: 'Yearly Legend', description: 'A full year of dedication', criteria: '50 consecutive weeks with 2+ sessions each', icon: '👑', category: 'consistency' },
        { id: 'sessions-10', name: 'Double Digits', description: 'Reach your first milestone', criteria: 'Complete 10 total gym sessions', icon: '🎲', category: 'milestone' },
        { id: 'sessions-50', name: 'Half Century', description: 'Major achievement unlocked', criteria: 'Complete 50 total gym sessions', icon: '💯', category: 'milestone' },
        { id: 'century-club', name: 'Century Club', description: 'Join the elite 100 club', criteria: 'Complete 100 total gym sessions', icon: '💎', category: 'milestone' },
        { id: 'double-century', name: 'Double Century', description: 'Elite performer status', criteria: 'Complete 200 total gym sessions', icon: '🚀', category: 'milestone' },
        { id: 'triple-digits', name: 'Triple Digits Champion', description: 'Ultimate dedication', criteria: 'Complete 300 total gym sessions', icon: '🏅', category: 'milestone' },
        { id: 'early-bird', name: 'Early Bird', description: 'Morning warrior dedication', criteria: 'Complete 5 sessions before 8 AM', icon: '🌅', category: 'time' },
        { id: 'morning-champion', name: 'Morning Champion', description: 'Master of morning workouts', criteria: 'Complete 25 sessions before 8 AM', icon: '☀️', category: 'time' },
        { id: 'night-owl', name: 'Night Owl', description: 'Evening athlete dedication', criteria: 'Complete 5 sessions after 8 PM', icon: '🌙', category: 'time' },
        { id: 'night-champion', name: 'Night Champion', description: 'Master of evening workouts', criteria: 'Complete 25 sessions after 8 PM', icon: '🌃', category: 'time' },
        { id: 'perfect-month', name: 'Monthly Master', description: 'Excel in a single month', criteria: 'Complete 8+ sessions in any month', icon: '📅', category: 'achievement' },
        { id: 'perfect-quarter', name: 'Quarterly Champion', description: 'Three months of excellence', criteria: '3 consecutive months with 8+ sessions each', icon: '📊', category: 'achievement' }
      ];
      
      const { error: insertError } = await supabase
        .from('badges')
        .insert(defaultBadges);
      
      if (insertError) {
        console.error('BadgeService: Error inserting default badges:', insertError);
        return false;
      }
      
      console.log('BadgeService: Successfully initialized', defaultBadges.length, 'badges');
      return true;
    } catch (error) {
      console.error('BadgeService: Error during badge initialization:', error);
      return false;
    }
  },

  // Get all available badges from database
  async getAllBadges(): Promise<Badge[]> {
    try {
      console.log('BadgeService.getAllBadges: Starting badge fetch...');
      
      // First, try to get current auth session
      const { data: { session }, error: authError } = await supabase.auth.getSession();
      if (authError) {
        console.error('BadgeService.getAllBadges: Auth error:', authError);
      }
      console.log('BadgeService.getAllBadges: Auth status:', session ? 'Authenticated' : 'Not authenticated');
      
      // Ensure badges are initialized
      const initResult = await this.initializeBadges();
      console.log('BadgeService.getAllBadges: Init result:', initResult);
      
      console.log('BadgeService.getAllBadges: Fetching badges from database...');
      const { data, error } = await supabase
        .from('badges')
        .select('*')
        .order('created_at', { ascending: true });

      if (error) {
        console.error('BadgeService.getAllBadges: Database error:', {
          message: error.message,
          code: error.code,
          details: error.details,
          hint: error.hint
        });
        
        // If it's an RLS error, provide more context
        if (error.code === '42501' || error.message.includes('policy')) {
          console.error('BadgeService.getAllBadges: RLS Policy Error - User may not have permission to read badges');
          console.error('BadgeService.getAllBadges: Ensure the badges table has proper SELECT policies for authenticated users');
        }
        
        throw error;
      }

      const badges = data?.map(badge => ({
        id: badge.id,
        name: badge.name,
        description: badge.description,
        criteria: badge.criteria,
        icon: badge.icon,
        category: badge.category
      })) || [];
      
      console.log('BadgeService.getAllBadges: Successfully loaded', badges.length, 'badges from database');
      if (badges.length === 0) {
        console.warn('BadgeService.getAllBadges: No badges returned - this might indicate an RLS issue');
      }
      
      return badges;
    } catch (error: any) {
      console.error('BadgeService.getAllBadges: Critical error fetching badges:', error);
      console.error('BadgeService.getAllBadges: Error stack:', error?.stack);
      
      // Return empty array instead of throwing to prevent dashboard crashes
      // But log the issue prominently
      console.warn('BadgeService.getAllBadges: Returning empty array due to error - badges will not be displayed');
      return [];
    }
  },

  // Get user's unlocked badges
  async getUserBadges(userId: string): Promise<string[]> {
    try {
      console.log('BadgeService.getUserBadges: Fetching badges for user:', userId);
      
      const { data, error } = await supabase
        .from('user_badges')
        .select('badge_id')
        .eq('user_id', userId);

      if (error) {
        console.error('BadgeService.getUserBadges: Database error:', {
          message: error.message,
          code: error.code,
          details: error.details,
          userId: userId
        });
        
        // Check for RLS issues
        if (error.code === '42501' || error.message.includes('policy')) {
          console.error('BadgeService.getUserBadges: RLS Policy Error - User may not have permission to read their own badges');
        }
        
        throw error;
      }

      const badgeIds = data?.map(ub => ub.badge_id) || [];
      console.log('BadgeService.getUserBadges: User has', badgeIds.length, 'unlocked badges:', badgeIds);
      
      return badgeIds;
    } catch (error: any) {
      console.error('BadgeService.getUserBadges: Error fetching user badges:', error);
      console.error('BadgeService.getUserBadges: Error stack:', error?.stack);
      return [];
    }
  },

  // Get badges with user progress
  async getBadgesWithProgress(userId: string): Promise<UserBadge[]> {
    try {
      console.log('BadgeService: Getting badges with progress for user:', userId);
      
      const [allBadges, userBadgeIds, sessions] = await Promise.all([
        this.getAllBadges(),
        this.getUserBadges(userId),
        sessionService.getUserSessions(userId)
      ]);

      console.log('BadgeService: Found', allBadges.length, 'total badges,', userBadgeIds.length, 'unlocked badges,', sessions.length, 'user sessions');

      const completedSessions = sessions.filter(s => s.status === 'completed');
      const currentStreak = await sessionService.calculateStreak(userId);

      const badgesWithProgress = allBadges.map(badge => {
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
      
      console.log('BadgeService: Returning', badgesWithProgress.length, 'badges with progress');
      return badgesWithProgress;
    } catch (error) {
      console.error('BadgeService: Error getting badges with progress:', error);
      // Return empty array instead of throwing to prevent dashboard crashes
      return [];
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