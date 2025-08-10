import { supabase } from '@/lib/supabase'
import type { User } from '@/types'

// Debug flag for additional logging
const DEBUG_AUTH = import.meta.env.DEV || import.meta.env.VITE_DEBUG === 'true'

// Common authentication errors and their explanations
const AUTH_ERROR_EXPLANATIONS = {
  'Failed to fetch': {
    cause: 'Network connectivity issue',
    solutions: [
      'Check if environment variables are properly set',
      'Verify Supabase URL and API key are correct',
      'Check CORS configuration in Supabase dashboard',
      'Ensure internet connectivity',
      'Try disabling ad blockers or security extensions'
    ]
  },
  'Invalid login credentials': {
    cause: 'Wrong email or password',
    solutions: [
      'Double-check email and password',
      'Ensure user account exists in Supabase',
      'Check if email confirmation is required'
    ]
  },
  'Email not confirmed': {
    cause: 'User has not confirmed their email address',
    solutions: [
      'Check email inbox for confirmation link',
      'Resend confirmation email',
      'Check Supabase Auth settings for email confirmation requirements'
    ]
  },
  'Too many requests': {
    cause: 'Rate limiting in effect',
    solutions: [
      'Wait a few minutes before trying again',
      'Check Supabase rate limiting settings'
    ]
  }
}

// Enhanced error handler with explanations
const handleAuthError = (error: any): never => {
  const errorMessage = error?.message || 'Unknown error'
  const explanation = AUTH_ERROR_EXPLANATIONS[errorMessage as keyof typeof AUTH_ERROR_EXPLANATIONS]
  
  console.group('🚨 Authentication Error Analysis')
  console.error('Error message:', errorMessage)
  console.error('Error type:', typeof error)
  console.error('Error name:', error?.name)
  console.error('Error status:', error?.status)
  console.error('Full error:', error)
  
  if (explanation) {
    console.log('💡 Likely cause:', explanation.cause)
    console.log('🔧 Suggested solutions:')
    explanation.solutions.forEach((solution, index) => {
      console.log(`   ${index + 1}. ${solution}`)
    })
  } else {
    console.log('❓ This is an uncommon error - check Supabase documentation')
  }
  console.groupEnd()
  
  throw error
}

export const authService = {
  // Sign up with email and password
  async signUp(email: string, password: string, name: string) {
    // Only allow Ivan, Youssef, and test account to use this app
    const allowedEmails = [
      'ivanaguilarmari@gmail.com',
      'youssef.gaber222@gmail.com', // Youssef's real email
      'youssef.dummy@test.com', // Test account for Youssef (keeping for backwards compatibility)
    ];
    
    if (!allowedEmails.includes(email.toLowerCase())) {
      throw new Error('This app is currently limited to Ivan and Youssef only. Contact Ivan if you need access.');
    }

    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            name,
          }
        }
      })

      if (error) handleAuthError(error)
      return data
    } catch (error) {
      handleAuthError(error)
    }
  },

  // Sign in with email and password - Enhanced with comprehensive debugging
  async signIn(email: string, password: string) {
    console.group('🔐 Authentication Flow Started')
    console.log('📧 Email:', email)
    console.log('⏰ Timestamp:', new Date().toISOString())
    console.log('🌐 User Agent:', navigator.userAgent)
    console.log('📍 Origin:', window.location.origin)
    
    // Only allow Ivan, Youssef, and test account to use this app
    const allowedEmails = [
      'ivanaguilarmari@gmail.com',
      'youssef.gaber222@gmail.com', // Youssef's real email
      'youssef.dummy@test.com', // Test account for Youssef (keeping for backwards compatibility)
    ];
    
    if (!allowedEmails.includes(email.toLowerCase())) {
      const error = new Error('This app is currently limited to Ivan and Youssef only. Contact Ivan if you need access.');
      console.error('❌ Access denied for email:', email)
      console.groupEnd()
      throw error;
    }
    
    console.log('✅ Email authorization passed')

    try {
      console.log('\n📡 Pre-Authentication Checks')
      
      // Check network connectivity
      console.log('🌐 Testing network connectivity...')
      try {
        await fetch('https://httpbin.org/get', { 
          method: 'HEAD',
          signal: AbortSignal.timeout(3000)
        })
        console.log('✅ Network connectivity OK')
      } catch (netError) {
        console.warn('⚠️ Network connectivity test failed:', netError)
      }
      
      // Check Supabase service availability
      console.log('🔍 Testing Supabase availability...')
      try {
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
        const response = await fetch(`${supabaseUrl}/auth/v1/settings`, {
          method: 'HEAD',
          signal: AbortSignal.timeout(5000)
        })
        console.log('✅ Supabase service available:', response.status)
      } catch (serviceError) {
        console.error('❌ Supabase service check failed:', serviceError)
      }
      
      console.log('\n🔐 Initiating Authentication')
      const authStartTime = Date.now()
      
      // Pre-auth environment check
      console.log('📊 Environment check:')
      console.log('  - Supabase URL exists:', !!import.meta.env.VITE_SUPABASE_URL)
      console.log('  - Supabase Key exists:', !!import.meta.env.VITE_SUPABASE_ANON_KEY)
      console.log('  - Build mode:', import.meta.env.MODE)
      
      // Attempt authentication with timeout
      const authPromise = supabase.auth.signInWithPassword({
        email,
        password,
      })
      
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Authentication timeout (10s)')), 10000)
      })
      
      console.log('⏳ Waiting for authentication response...')
      const { data, error } = await Promise.race([authPromise, timeoutPromise])

      const authEndTime = Date.now()
      const authDuration = authEndTime - authStartTime
      console.log(`⏱️  Authentication completed in ${authDuration}ms`)
      
      // Detailed response logging
      console.log('\n📋 Authentication Response Analysis:')
      console.log('Response received:', !!data)
      console.log('Error received:', !!error)
      
      if (data) {
        console.group('📊 Response Data Details')
        console.log('User present:', !!data.user)
        console.log('Session present:', !!data.session)
        
        if (data.user) {
          console.log('User details:', {
            id: data.user.id,
            email: data.user.email,
            email_confirmed_at: data.user.email_confirmed_at,
            confirmed_at: data.user.confirmed_at,
            created_at: data.user.created_at,
            last_sign_in_at: data.user.last_sign_in_at,
            role: data.user.role
          })
        }
        
        if (data.session) {
          console.log('Session details:', {
            access_token_preview: data.session.access_token?.substring(0, 20) + '...',
            refresh_token_preview: data.session.refresh_token?.substring(0, 20) + '...',
            expires_at: data.session.expires_at,
            expires_in: data.session.expires_in,
            token_type: data.session.token_type,
            user_id: data.session.user?.id
          })
        }
        console.groupEnd()
      }
      
      if (error) {
        console.group('❌ Error Analysis')
        console.error('Error name:', error.name)
        console.error('Error message:', error.message)
        console.error('Error status:', (error as any).status)
        console.error('Error code:', (error as any).code)
        console.error('Error details:', (error as any).details)
        console.error('Full error object:', error)
        
        // Specific error type detection
        if (error.message.includes('fetch')) {
          console.error('🚨 NETWORK ERROR DETECTED: This is likely a connectivity or CORS issue')
        } else if (error.message.includes('Invalid login credentials')) {
          console.error('🚨 CREDENTIAL ERROR: Invalid email/password combination')
        } else if ((error as any).status === 0) {
          console.error('🚨 CONNECTION ERROR: Request failed to reach server')
        }
        
        console.groupEnd()
        console.groupEnd() // Close main auth group
        throw error
      }
      
      console.log('✅ Authentication successful!')
      console.groupEnd()
      return data
      
    } catch (error) {
      console.group('💥 Authentication Exception Handler')
      console.error('Exception type:', typeof error)
      console.error('Exception constructor:', error?.constructor?.name)
      console.error('Exception message:', (error as Error).message)
      console.error('Exception stack:', (error as Error).stack)
      
      // Detailed error analysis
      if (error instanceof TypeError) {
        console.error('🚨 TypeError detected - likely network/fetch issue')
        console.error('This often indicates:')
        console.error('  - CORS configuration problems')
        console.error('  - Network connectivity issues')
        console.error('  - Supabase service unavailable')
        console.error('  - Invalid Supabase URL/credentials')
      }
      
      if (error instanceof Error && error.message.includes('Failed to fetch')) {
        console.error('🚨 "Failed to fetch" error detected!')
        console.error('Potential causes:')
        console.error('  - Environment variables not loaded in production')
        console.error('  - CORS not properly configured for this domain')
        console.error('  - Supabase project is paused or deleted')
        console.error('  - Network connectivity issues')
        console.error('  - Ad blockers or security extensions blocking requests')
      }
      
      console.error('Full error properties:', Object.getOwnPropertyNames(error))
      console.groupEnd()
      console.groupEnd() // Close main auth group
      
      // Use enhanced error handler
      handleAuthError(error)
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

  // Get current session with debugging
  async getSession() {
    console.log('🔍 Getting current session...')
    try {
      const startTime = Date.now()
      const { data: { session }, error } = await supabase.auth.getSession()
      const duration = Date.now() - startTime
      
      console.log(`⏱️ getSession took ${duration}ms`)
      
      if (error) {
        console.error('❌ getSession error:', error)
        throw error
      }
      
      if (session) {
        console.log('✅ Active session found')
        console.log('Session expires at:', new Date(session.expires_at! * 1000).toISOString())
        console.log('Session user:', session.user?.email)
      } else {
        console.log('ℹ️ No active session')
      }
      
      return session
    } catch (error) {
      console.error('💥 getSession exception:', error)
      throw error
    }
  },

  // Get current user with debugging  
  async getUser() {
    console.log('🔍 Getting current user...')
    try {
      const startTime = Date.now()
      const { data: { user }, error } = await supabase.auth.getUser()
      const duration = Date.now() - startTime
      
      console.log(`⏱️ getUser took ${duration}ms`)
      
      if (error) {
        console.error('❌ getUser error:', error)
        throw error
      }
      
      if (user) {
        console.log('✅ User found:', user.email)
      } else {
        console.log('ℹ️ No user found')
      }
      
      return user
    } catch (error) {
      console.error('💥 getUser exception:', error)
      throw error
    }
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