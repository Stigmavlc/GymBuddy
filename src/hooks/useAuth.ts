import { useState, useEffect } from 'react'
import type { User as SupabaseUser } from '@supabase/supabase-js'
import { authService } from '@/services/auth'
import type { User } from '@/types'

interface AuthState {
  user: SupabaseUser | null
  profile: User | null
  loading: boolean
  error: string | null
}

export function useAuth() {
  const [state, setState] = useState<AuthState>({
    user: null,
    profile: null,
    loading: true,
    error: null
  })

  useEffect(() => {
    let mounted = true;
    
    // Get initial session
    const getInitialSession = async () => {
      try {
        const session = await authService.getSession()
        
        if (!mounted) return;
        
        if (session?.user) {
          const profile = await authService.getUserProfile(session.user.id)
          
          if (!mounted) return;
          
          setState({
            user: session.user,
            profile,
            loading: false,
            error: null
          })
        } else {
          setState({
            user: null,
            profile: null,
            loading: false,
            error: null
          })
        }
      } catch (error) {
        console.error('Auth error:', error)
        
        if (!mounted) return;
        
        setState({
          user: null,
          profile: null,
          loading: false,
          error: error instanceof Error ? error.message : 'An error occurred'
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
            console.log('Auth listener: Getting profile for user...')
            let profile = await authService.getUserProfile(session.user.id)
            console.log('Auth listener: Got profile:', profile)
            
            // Create profile if it doesn't exist (new user)
            if (!profile && event === 'SIGNED_IN') {
              console.log('Creating new user profile...')
              profile = await authService.createUserProfile(session.user)
            }

            console.log('Auth listener: Setting state with user and profile')
            setState({
              user: session.user,
              profile,
              loading: false,
              error: null
            })
            console.log('Auth listener: State updated successfully')
          } else {
            console.log('Auth listener: No user, clearing state')
            setState({
              user: null,
              profile: null,
              loading: false,
              error: null
            })
          }
        } catch (error) {
          console.error('Auth state change error:', error)
          setState({
            user: null,
            profile: null,
            loading: false,
            error: error instanceof Error ? error.message : 'An error occurred'
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
        error: error instanceof Error ? error.message : 'Sign up failed'
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
        error: error instanceof Error ? error.message : 'Sign in failed'
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
        error: error instanceof Error ? error.message : 'Google sign in failed'
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
        error: error instanceof Error ? error.message : 'Sign out failed'
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
        error: error instanceof Error ? error.message : 'Profile update failed'
      }))
      throw error
    }
  }

  return {
    ...state,
    signUp,
    signIn,
    signInWithGoogle,
    signOut,
    updateProfile,
    isAuthenticated: !!state.user
  }
}