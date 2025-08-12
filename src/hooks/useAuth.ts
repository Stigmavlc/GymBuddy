import { useState, useEffect } from 'react'
import type { User as SupabaseUser } from '@supabase/supabase-js'
import { authService } from '@/services/auth'
import type { User } from '@/types'

interface AuthState {
  user: SupabaseUser | null
  profile: User | null
  loading: boolean
  error: string | null
  justLoggedIn: boolean
}

export function useAuth() {
  const [state, setState] = useState<AuthState>({
    user: null,
    profile: null,
    loading: true,
    error: null,
    justLoggedIn: false
  })

  useEffect(() => {
    let mounted = true;
    
    // Get initial session
    const getInitialSession = async () => {
      console.log('[useAuth] Getting initial session...')
      try {
        const session = await authService.getSession()
        
        if (!mounted) return;
        
        if (session?.user) {
          console.log('[useAuth] Found existing session for:', session.user.email)
          
          const profile = await authService.getUserProfile(session.user.id)
          console.log('[useAuth] Initial profile loading result:', {
            hasProfile: !!profile,
            profileEmail: profile?.email
          })
          
          if (!mounted) return;
          
          // Session restoration - don't trigger splash
          setState({
            user: session.user,
            profile,
            loading: false,
            error: profile ? null : 'Profile data could not be loaded',
            justLoggedIn: false
          })
          
          console.log('[useAuth] Initial session state set')
        } else {
          console.log('[useAuth] No existing session found')
          setState({
            user: null,
            profile: null,
            loading: false,
            error: null,
            justLoggedIn: false
          })
        }
      } catch (error) {
        console.error('[useAuth] Initial session error:', error)
        
        if (!mounted) return;
        
        setState({
          user: null,
          profile: null,
          loading: false,
          error: error instanceof Error ? error.message : 'Authentication initialization failed',
          justLoggedIn: false
        })
      }
    }

    // Remove timeout since auth is working properly now
    
    getInitialSession()

    // Listen for auth changes
    const { data: { subscription } } = authService.onAuthStateChange(
      async (event, session) => {
        console.log('Auth state changed:', event, session?.user?.email)
        
        if (!mounted) return;
        
        try {
          if (session?.user) {
            console.log('[useAuth] Auth listener: Getting profile for user:', session.user.email)
            
            // Set loading state to true for profile loading
            setState(prev => ({ ...prev, loading: true, error: null }))
            
            let profile = await authService.getUserProfile(session.user.id)
            console.log('[useAuth] Auth listener: Profile loading result:', {
              hasProfile: !!profile,
              profileEmail: profile?.email,
              profileName: profile?.name
            })
            
            // Create profile if it doesn't exist (new user)
            if (!profile && event === 'SIGNED_IN') {
              console.log('[useAuth] Creating new user profile...')
              profile = await authService.createUserProfile(session.user)
              console.log('[useAuth] Created profile:', {
                hasProfile: !!profile,
                profileEmail: profile?.email
              })
            }

            // If we still don't have a profile after trying to create one, this is an error
            if (!profile) {
              console.error('[useAuth] Failed to load or create profile for user:', session.user.email)
              setState({
                user: session.user,
                profile: null,
                loading: false,
                error: 'Failed to load user profile. Please try refreshing the page.',
                justLoggedIn: false
              })
              return;
            }

            console.log('[useAuth] Successfully loaded profile, updating state')
            setState({
              user: session.user,
              profile,
              loading: false,
              error: null,
              justLoggedIn: event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED'
            })
            console.log('[useAuth] State updated successfully with profile')
          } else {
            console.log('[useAuth] Auth listener: No user, clearing state')
            setState({
              user: null,
              profile: null,
              loading: false,
              error: null,
              justLoggedIn: false
            })
          }
        } catch (error) {
          console.error('[useAuth] Auth state change error:', error)
          setState({
            user: session?.user || null,
            profile: null,
            loading: false,
            error: error instanceof Error ? error.message : 'Profile loading failed',
            justLoggedIn: false
          })
        }
      }
    )

    return () => {
      mounted = false;
      subscription.unsubscribe();
    }
  }, [])

  const signUp = async (email: string, password: string, name: string) => {
    setState(prev => ({ ...prev, loading: true, error: null }))
    try {
      await authService.signUp(email, password, name)
      // Auth state change will be handled by the listener
    } catch (error) {
      setState(prev => ({
        ...prev,
        loading: false,
        error: error instanceof Error ? error.message : 'Sign up failed',
        justLoggedIn: false
      }))
      throw error
    }
  }

  const signIn = async (email: string, password: string) => {
    console.log('useAuth signIn called')
    try {
      const result = await authService.signIn(email, password)
      console.log('Sign in result:', result)
      // Don't set loading state here - let the auth state listener handle it
      // Auth state change will be handled by the listener
    } catch (error) {
      console.error('useAuth signIn error:', error)
      setState(prev => ({
        ...prev,
        loading: false,
        error: error instanceof Error ? error.message : 'Sign in failed',
        justLoggedIn: false
      }))
      throw error
    }
  }

  const signInWithGoogle = async () => {
    setState(prev => ({ ...prev, loading: true, error: null }))
    try {
      await authService.signInWithGoogle()
      // Auth state change will be handled by the listener
    } catch (error) {
      setState(prev => ({
        ...prev,
        loading: false,
        error: error instanceof Error ? error.message : 'Google sign in failed',
        justLoggedIn: false
      }))
      throw error
    }
  }

  const signOut = async () => {
    setState(prev => ({ ...prev, loading: true, error: null }))
    try {
      await authService.signOut()
      // Auth state change will be handled by the listener
    } catch (error) {
      setState(prev => ({
        ...prev,
        loading: false,
        error: error instanceof Error ? error.message : 'Sign out failed',
        justLoggedIn: false
      }))
      throw error
    }
  }

  const updateProfile = async (updates: Partial<User>) => {
    if (!state.user) throw new Error('No user logged in')

    setState(prev => ({ ...prev, loading: true, error: null }))
    try {
      const updatedProfile = await authService.updateUserProfile(state.user.id, updates)
      setState(prev => ({
        ...prev,
        profile: updatedProfile,
        loading: false,
        error: null
      }))
      return updatedProfile
    } catch (error) {
      setState(prev => ({
        ...prev,
        loading: false,
        error: error instanceof Error ? error.message : 'Profile update failed',
        justLoggedIn: false
      }))
      throw error
    }
  }

  const clearJustLoggedIn = () => {
    setState(prev => ({ ...prev, justLoggedIn: false }))
  }

  return {
    ...state,
    signUp,
    signIn,
    signInWithGoogle,
    signOut,
    updateProfile,
    clearJustLoggedIn,
    isAuthenticated: !!state.user
  }
}