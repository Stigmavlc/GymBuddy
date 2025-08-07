import { supabase } from '@/lib/supabase'
import type { User } from '@/types'

export const authService = {
  // Sign up with email and password
  async signUp(email: string, password: string, name: string) {
    // Only allow Ivan, Youssef, and test account to use this app
    const allowedEmails = [
      'ivanaguilarmari@gmail.com',
      'youssef.dummy@test.com', // Test account for Youssef
      // TODO: Add real Youssef's email here when available
    ];
    
    if (!allowedEmails.includes(email.toLowerCase())) {
      throw new Error('This app is currently limited to Ivan and Youssef only. Contact Ivan if you need access.');
    }

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          name,
        }
      }
    })

    if (error) throw error
    return data
  },

  // Sign in with email and password
  async signIn(email: string, password: string) {
    console.log('authService.signIn called with:', email)
    
    // Only allow Ivan, Youssef, and test account to use this app
    const allowedEmails = [
      'ivanaguilarmari@gmail.com',
      'youssef.dummy@test.com', // Test account for Youssef
      // TODO: Add real Youssef's email here when available
    ];
    
    if (!allowedEmails.includes(email.toLowerCase())) {
      throw new Error('This app is currently limited to Ivan and Youssef only. Contact Ivan if you need access.');
    }

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      console.log('Supabase signIn response:', { data, error })
      
      if (error) throw error
      return data
    } catch (error) {
      console.error('authService.signIn error:', error)
      throw error
    }
  },

  // Sign in with Google OAuth
  async signInWithGoogle() {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`
      }
    })

    if (error) throw error
    return data
  },

  // Sign out
  async signOut() {
    const { error } = await supabase.auth.signOut()
    if (error) throw error
  },

  // Get current session
  async getSession() {
    const { data: { session }, error } = await supabase.auth.getSession()
    if (error) throw error
    return session
  },

  // Get current user
  async getUser() {
    const { data: { user }, error } = await supabase.auth.getUser()
    if (error) throw error
    return user
  },

  // Listen to auth changes
  onAuthStateChange(callback: (event: string, session: any) => void) { // eslint-disable-line @typescript-eslint/no-explicit-any
    return supabase.auth.onAuthStateChange(callback)
  },

  // Create user profile after sign up
  async createUserProfile(user: any): Promise<User> { // eslint-disable-line @typescript-eslint/no-explicit-any
    console.log('Creating user profile for:', user.email)
    
    const userProfileForDB = {
      id: user.id,
      email: user.email,
      name: user.user_metadata?.name || user.email.split('@')[0],
      avatar: user.user_metadata?.avatar_url,
      preferences: {
        notifications: {
          sms: true,
          push: true,
          reminder_time: 30  // snake_case for database
        }
      },
      stats: {
        total_sessions: 0,  // snake_case for database
        current_streak: 0,  // snake_case for database
        badges: []
      }
    }

    try {
      // Add timeout to prevent hanging
      const timeoutPromise = new Promise<never>((_, reject) => 
        setTimeout(() => reject(new Error('Database insert timeout')), 3000)
      );
      
      const insertPromise = supabase
        .from('users')
        .insert(userProfileForDB)
        .select()
        .single();
        
      const { data, error } = await Promise.race([insertPromise, timeoutPromise]);

      console.log('createUserProfile result:', { data, error })

      if (error) {
        console.error('Failed to create user profile in database:', error);
        // If database insert fails, return a basic profile so user can still use the app
        return {
          id: user.id,
          email: user.email,
          name: user.user_metadata?.name || user.email.split('@')[0],
          avatar: user.user_metadata?.avatar_url,
          partnerId: undefined,
          preferences: {
            notifications: {
              sms: true,
              push: true,
              reminderTime: 30
            }
          },
          stats: {
            totalSessions: 0,
            currentStreak: 0,
            badges: []
          }
        };
      }
      
      if (!data) {
        throw new Error('Failed to create user profile - no data returned');
      }
    
      // Convert back to camelCase for TypeScript
      return {
        id: data.id,
        email: data.email,
        name: data.name,
        avatar: data.avatar,
        phoneNumber: data.phone_number,
        partnerId: data.partner_id,
        preferences: {
          notifications: {
            sms: data.preferences?.notifications?.sms ?? true,
            push: data.preferences?.notifications?.push ?? true,
            reminderTime: data.preferences?.notifications?.reminder_time ?? 30
          }
        },
        stats: {
          totalSessions: data.stats?.total_sessions ?? 0,
          currentStreak: data.stats?.current_streak ?? 0,
          badges: data.stats?.badges ?? []
        }
      }
    } catch (err) {
      console.error('createUserProfile error:', err);
      // If there's any error, return a basic profile so user can still use the app
      return {
        id: user.id,
        email: user.email,
        name: user.user_metadata?.name || user.email.split('@')[0],
        avatar: user.user_metadata?.avatar_url,
        partnerId: undefined,
        preferences: {
          notifications: {
            sms: true,
            push: true,
            reminderTime: 30
          }
        },
        stats: {
          totalSessions: 0,
          currentStreak: 0,
          badges: []
        }
      };
    }
  },

  // Get user profile
  async getUserProfile(userId: string): Promise<User | null> {
    console.log('getUserProfile called for userId:', userId)
    
    try {
      // Add timeout to prevent hanging
      const timeoutPromise = new Promise<never>((_, reject) => 
        setTimeout(() => reject(new Error('Database query timeout')), 3000)
      );
      
      const queryPromise = supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .maybeSingle();
        
      const { data, error } = await Promise.race([queryPromise, timeoutPromise]);

      console.log('getUserProfile result:', { data, error })
      console.log('Data details:', data)

      if (error) {
        console.error('Database error:', error)
        // If there's a database error, return null to trigger profile creation
        return null;
      }
      
      if (!data) {
        console.log('No user profile found - will create one')
        return null;
      }
      
      console.log('Found user profile, converting to camelCase...')

      // Convert from snake_case to camelCase for TypeScript
      const profile = {
        id: data.id,
        email: data.email,
        name: data.name,  
        avatar: data.avatar,
        phoneNumber: data.phone_number,
        partnerId: data.partner_id,
        preferences: {
          notifications: {
            sms: data.preferences?.notifications?.sms ?? true,
            push: data.preferences?.notifications?.push ?? true,
            reminderTime: data.preferences?.notifications?.reminder_time ?? 30
          }
        },
        stats: {
          totalSessions: data.stats?.total_sessions ?? 0,
          currentStreak: data.stats?.current_streak ?? 0,
          badges: data.stats?.badges ?? []
        }
      }
      
      console.log('Converted profile:', profile)
      return profile
    } catch (err) {
      console.error('getUserProfile error:', err);
      // If there's any error, return null to trigger profile creation
      return null;
    }
  },

  // Update user profile
  async updateUserProfile(userId: string, updates: Partial<User>) {
    // Convert camelCase fields to snake_case for database
    const dbUpdates: any = { // eslint-disable-line @typescript-eslint/no-explicit-any
      updated_at: new Date().toISOString()
    };

    // Map camelCase to snake_case
    if (updates.name !== undefined) dbUpdates.name = updates.name;
    if (updates.avatar !== undefined) dbUpdates.avatar = updates.avatar;
    if (updates.phoneNumber !== undefined) dbUpdates.phone_number = updates.phoneNumber;
    if (updates.partnerId !== undefined) dbUpdates.partner_id = updates.partnerId;
    if (updates.preferences !== undefined) dbUpdates.preferences = updates.preferences;
    if (updates.stats !== undefined) dbUpdates.stats = updates.stats;

    const { data, error } = await supabase
      .from('users')
      .update(dbUpdates)
      .eq('id', userId)
      .select()
      .single()
    
    if (error) throw error
    
    // Convert back to camelCase for return
    return {
      id: data.id,
      email: data.email,
      name: data.name,
      avatar: data.avatar,
      phoneNumber: data.phone_number,
      partnerId: data.partner_id,
      preferences: data.preferences,
      stats: data.stats
    };
  }
}