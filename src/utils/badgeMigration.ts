import { supabase } from '@/lib/supabase';
import { badgeService } from '@/services/badgeService';

export interface BadgeMigrationResult {
  newBadgesAdded: number;
  usersProcessed: number;
  badgesAwarded: number;
  errors: string[];
}

export const badgeMigrationUtils = {
  // Add new badges to the database and process all users
  async migrateNewBadges(newBadges: Array<{
    id: string;
    name: string;
    description: string;
    criteria: string;
    icon: string;
    category: string;
  }>): Promise<BadgeMigrationResult> {
    const result: BadgeMigrationResult = {
      newBadgesAdded: 0,
      usersProcessed: 0,
      badgesAwarded: 0,
      errors: []
    };

    try {
      console.log(`Starting badge migration for ${newBadges.length} new badges...`);

      // Step 1: Add new badges to the database
      for (const badge of newBadges) {
        try {
          const { error } = await supabase
            .from('badges')
            .insert({
              id: badge.id,
              name: badge.name,
              description: badge.description,
              criteria: badge.criteria,
              icon: badge.icon,
              category: badge.category,
              created_at: new Date().toISOString()
            });

          if (error) {
            // If badge already exists, that's okay
            if (error.code === '23505') { // unique_violation
              console.log(`Badge ${badge.id} already exists, skipping...`);
            } else {
              throw error;
            }
          } else {
            result.newBadgesAdded++;
            console.log(`Added new badge: ${badge.name}`);
          }
        } catch (error) {
          result.errors.push(`Failed to add badge ${badge.id}: ${error}`);
          console.error(`Error adding badge ${badge.id}:`, error);
        }
      }

      // Step 2: Get all users and process their badges
      const { data: users, error: usersError } = await supabase
        .from('users')
        .select('id, email');

      if (usersError) {
        throw usersError;
      }

      if (!users || users.length === 0) {
        console.log('No users found to process');
        return result;
      }

      console.log(`Processing ${users.length} users for badge awards...`);

      // Step 3: Check badges for each user
      for (const user of users) {
        try {
          console.log(`Processing badges for user: ${user.email}`);
          
          const newUnlocks = await badgeService.recheckAllUserBadges(user.id);
          result.badgesAwarded += newUnlocks.length;
          result.usersProcessed++;

          if (newUnlocks.length > 0) {
            console.log(`Awarded ${newUnlocks.length} badges to ${user.email}`);
          }
        } catch (error) {
          result.errors.push(`Failed to process user ${user.email}: ${error}`);
          console.error(`Error processing user ${user.email}:`, error);
        }
      }

      console.log('Badge migration complete!');
      console.log(`Results: ${result.newBadgesAdded} badges added, ${result.usersProcessed} users processed, ${result.badgesAwarded} badges awarded`);
      
      return result;
    } catch (error) {
      result.errors.push(`Migration failed: ${error}`);
      console.error('Badge migration error:', error);
      throw error;
    }
  },

  // Generate SQL script for manual execution
  generateBadgeMigrationSQL(newBadges: Array<{
    id: string;
    name: string;
    description: string;
    criteria: string;
    icon: string;
    category: string;
  }>): string {
    let sql = '-- Badge Migration Script\n';
    sql += '-- Generated on: ' + new Date().toISOString() + '\n\n';
    
    sql += '-- Add new badges\n';
    for (const badge of newBadges) {
      sql += `INSERT INTO public.badges (id, name, description, criteria, icon, category, created_at)
VALUES ('${badge.id}', '${badge.name}', '${badge.description}', '${badge.criteria}', '${badge.icon}', '${badge.category}', NOW())
ON CONFLICT (id) DO NOTHING;\n\n`;
    }

    sql += '-- Check and award badges for all users\n';
    sql += 'DO $$\n';
    sql += 'DECLARE\n';
    sql += '    user_record RECORD;\n';
    sql += 'BEGIN\n';
    sql += '    FOR user_record IN SELECT id FROM public.users LOOP\n';
    sql += '        PERFORM check_user_badges(user_record.id);\n';
    sql += '    END LOOP;\n';
    sql += 'END $$;\n\n';

    sql += '-- Verify migration results\n';
    sql += 'SELECT COUNT(*) as total_badges FROM public.badges;\n';
    sql += 'SELECT COUNT(*) as total_user_badges FROM public.user_badges;\n';
    sql += 'SELECT u.email, COUNT(ub.badge_id) as badge_count\n';
    sql += 'FROM public.users u\n';
    sql += 'LEFT JOIN public.user_badges ub ON u.id = ub.user_id\n';
    sql += 'GROUP BY u.id, u.email\n';
    sql += 'ORDER BY badge_count DESC;\n';

    return sql;
  },

  // Rollback migration (remove badges added after a certain date)
  async rollbackMigration(badgeIds: string[]): Promise<{
    badgesRemoved: number;
    userBadgesRemoved: number;
    errors: string[];
  }> {
    const result = {
      badgesRemoved: 0,
      userBadgesRemoved: 0,
      errors: [] as string[]
    };

    try {
      console.log(`Rolling back ${badgeIds.length} badges...`);

      // Remove user badge associations first
      const { count: userBadgesCount, error: userBadgesError } = await supabase
        .from('user_badges')
        .delete()
        .in('badge_id', badgeIds);

      if (userBadgesError) {
        throw userBadgesError;
      }

      result.userBadgesRemoved = userBadgesCount || 0;

      // Remove badges
      const { count: badgesCount, error: badgesError } = await supabase
        .from('badges')
        .delete()
        .in('id', badgeIds);

      if (badgesError) {
        throw badgesError;
      }

      result.badgesRemoved = badgesCount || 0;

      console.log(`Rollback complete: ${result.badgesRemoved} badges removed, ${result.userBadgesRemoved} user associations removed`);
      
      return result;
    } catch (error) {
      result.errors.push(`Rollback failed: ${error instanceof Error ? error.message : String(error)}`);
      console.error('Badge rollback error:', error);
      throw error;
    }
  }
};