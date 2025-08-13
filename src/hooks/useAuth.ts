import { useState, useEffect } from 'react'
import type { User as SupabaseUser } from '@supabase/supabase-js'
import { authService } from '@/services/auth'
import type { User } from '@/types'
import { SafeSessionStorage } from '@/lib/sessionStorage'

interface AuthState {
  user: SupabaseUser | null
  profile: User | null
  loading: boolean
  error: string | null
  justLoggedIn: boolean
}

// Session persistence keys
const AUTH_CACHE_KEY = 'gymbuddy_auth_cache'
const CACHE_DURATION = 5 * 60 * 1000 // 5 minutes

// Cache user session and profile to avoid unnecessary loading screens
interface AuthCache {
  user: SupabaseUser | null
  profile: User | null
  timestamp: number
}

// Helper functions for session persistence
function getCachedAuth(): AuthCache | null {
  const cached = SafeSessionStorage.getItem<AuthCache>(AUTH_CACHE_KEY)
  if (!cached) return null
  
  const isExpired = Date.now() - cached.timestamp > CACHE_DURATION
  
  if (isExpired) {
    SafeSessionStorage.removeItem(AUTH_CACHE_KEY)
    return null
  }
  
  return cached
}

function setCachedAuth(user: SupabaseUser | null, profile: User | null) {
  const cache: AuthCache = {
    user,
    profile,
    timestamp: Date.now()
  }
  SafeSessionStorage.setItem(AUTH_CACHE_KEY, cache)
}

function clearCachedAuth() {
  SafeSessionStorage.removeItem(AUTH_CACHE_KEY)
}

export function useAuth() {
  // Try to initialize from cache to prevent unnecessary loading screens
  const cachedAuth = getCachedAuth()
  const [state, setState] = useState<AuthState>({
    user: cachedAuth?.user || null,
    profile: cachedAuth?.profile || null,
    loading: !cachedAuth, // Only show loading if no cache
    error: null,
    justLoggedIn: false
  })

  useEffect(() => {
    let mounted = true;
    
    // Get initial session with optimized caching
    const getInitialSession = async () => {
      console.log('[useAuth] Getting initial session...')
      
      // If we have valid cached data, skip loading for better UX
      const cached = getCachedAuth()
      if (cached && cached.user && cached.profile) {
        console.log('[useAuth] Using cached session for:', cached.user.email)
        setState({
          user: cached.user,
          profile: cached.profile,
          loading: false,
          error: null,
          justLoggedIn: false
        })
        
        // Still verify session in background, but don't show loading
        try {
          const session = await authService.getSession()
          if (mounted && session?.user && session.user.id === cached.user.id) {
            console.log('[useAuth] Cached session verified as valid')
          } else if (mounted) {
            console.log('[useAuth] Cached session invalid, clearing cache')
            clearCachedAuth()
            // Force re-authentication
            setState({
              user: null,
              profile: null,
              loading: false,
              error: null,
              justLoggedIn: false
            })
          }
        } catch (error) {
          console.error('[useAuth] Background session verification failed:', error)
          if (mounted) {
            clearCachedAuth()
            setState({
              user: null,
              profile: null,
              loading: false,
              error: null,
              justLoggedIn: false
            })
          }
        }
        return
      }
      
      // No cache or invalid cache - do full initialization
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
          
          // Cache the successful session
          setCachedAuth(session.user, profile)
          
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
          clearCachedAuth()
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
        
        clearCachedAuth()
        setState({
          user: null,
          profile: null,
          loading: false,
          error: error instanceof Error ? error.message : 'Authentication initialization failed',
          justLoggedIn: false
        })
      }
    }

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
            
            // Cache the successful session
            setCachedAuth(session.user, profile)
            
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
            clearCachedAuth()
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
          clearCachedAuth()
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
      clearCachedAuth() // Clear cache on sign out
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