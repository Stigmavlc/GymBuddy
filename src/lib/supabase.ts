import { createClient } from '@supabase/supabase-js'

// Environment variables
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY
const DEBUG_MODE = import.meta.env.DEV

// Simple environment check on startup
if (DEBUG_MODE) {
  console.log('🚀 GymBuddy Application Startup Diagnostics')
  console.log('🏗️ Mode:', import.meta.env.MODE)
  console.log('🌐 Supabase URL configured:', !!supabaseUrl)
  console.log('🔑 Supabase key configured:', !!supabaseAnonKey)
}

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ CRITICAL: Missing Supabase environment variables')
  console.error('Expected variables: VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY')
  throw new Error('Missing Supabase environment variables')
}

// Create Supabase client
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true
  }
})

// Simple health check function
export const healthCheck = async () => {
  if (DEBUG_MODE) {
    console.log('🏥 GymBuddy System Health Check')
  }
  
  const issues = []
  
  try {
    // Basic connection test
    const { data, error } = await supabase.from('users').select('count(*)', { count: 'exact' }).limit(0)
    if (error) {
      issues.push(`Database connection: ${error.message}`)
    }
  } catch (err) {
    issues.push(`Connection error: ${err}`)
  }
  
  if (issues.length > 0 && DEBUG_MODE) {
    console.log('🚨 Issues found:', issues)
  }
  
  return { healthy: issues.length === 0, issues }
}

// Comprehensive connection test (for debugging)
export const testConnection = async () => {
  console.log('🔍 Comprehensive Supabase Connection Test')
  
  const results = {
    environmentCheck: !!supabaseUrl && !!supabaseAnonKey,
    dataQuery: false,
    authEndpoint: false,
    errors: [] as string[]
  }
  
  try {
    // Test basic data query
    const { data, error } = await supabase
      .from('users')
      .select('count(*)', { count: 'exact' })
      .limit(1)
    
    if (error) {
      results.errors.push(`Data query failed: ${error.message}`)
      console.error('❌ Data query failed:', error)
    } else {
      results.dataQuery = true
      console.log('✅ Data query successful')
    }
    
    // Test auth endpoint
    const authResponse = await fetch(`${supabaseUrl}/auth/v1/settings`, {
      headers: { 'apikey': supabaseAnonKey! }
    })
    
    if (authResponse.ok) {
      results.authEndpoint = true
      console.log('✅ Auth endpoint accessible')
    } else {
      results.errors.push(`Auth endpoint failed: ${authResponse.status}`)
      console.error('❌ Auth endpoint failed:', authResponse.status)
    }
    
    const overallSuccess = results.environmentCheck && results.dataQuery
    console.log('🎯 Overall Status:', overallSuccess ? '✅ HEALTHY' : '❌ ISSUES DETECTED')
    
    return { success: overallSuccess, results, errors: results.errors }
    
  } catch (err) {
    console.error('💥 Connection test exception:', err)
    return { success: false, results, errors: [String(err)] }
  }
}

// Simple auth debug function
export const debugAuth = async () => {
  if (!DEBUG_MODE) return
  
  console.log('🔐 Authentication Flow Started')
  try {
    const { data: { session }, error } = await supabase.auth.getSession()
    if (error) {
      console.error('❌ Errors encountered:', [error])
    } else if (session) {
      console.log('✅ Active session found:', session.user?.email)
    } else {
      console.log('ℹ️ No active session')
    }
  } catch (error) {
    console.error('❌ Session error:', error)
  }
}

// Database types based on our schema
export type Database = {
  public: {
    Tables: {
      users: {
        Row: {
          id: string
          email: string
          name: string
          avatar?: string
          partner_id?: string
          preferences: {
            notifications: {
              sms: boolean
              push: boolean
              reminder_time: number
            }
          }
          stats: {
            total_sessions: number
            current_streak: number
            badges: string[]
          }
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          email: string
          name: string
          avatar?: string
          partner_id?: string
          preferences?: {
            notifications?: {
              sms?: boolean
              push?: boolean
              reminder_time?: number
            }
          }
          stats?: {
            total_sessions?: number
            current_streak?: number
            badges?: string[]
          }
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string
          name?: string
          avatar?: string
          partner_id?: string
          preferences?: {
            notifications?: {
              sms?: boolean
              push?: boolean
              reminder_time?: number
            }
          }
          stats?: {
            total_sessions?: number
            current_streak?: number
            badges?: string[]
          }
          created_at?: string
          updated_at?: string
        }
      }
      availability: {
        Row: {
          id: string
          user_id: string
          day: string
          start_time: number
          end_time: number
          submitted_at: string
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          day: string
          start_time: number
          end_time: number
          submitted_at?: string
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          day?: string
          start_time?: number
          end_time?: number
          submitted_at?: string
          created_at?: string
        }
      }
      sessions: {
        Row: {
          id: string
          participants: string[]
          date: string
          start_time: number
          end_time: number
          status: 'confirmed' | 'cancelled' | 'completed'
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          participants: string[]
          date: string
          start_time: number
          end_time: number
          status?: 'confirmed' | 'cancelled' | 'completed'
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          participants?: string[]
          date?: string
          start_time?: number
          end_time?: number
          status?: 'confirmed' | 'cancelled' | 'completed'
          created_at?: string
          updated_at?: string
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
  }
}