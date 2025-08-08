import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Test database connectivity with enhanced debugging
export const testConnection = async () => {
  try {
    console.log('🔍 Testing Supabase connection...')
    console.log('📡 URL:', supabaseUrl)
    console.log('🔑 Key:', supabaseAnonKey?.substring(0, 20) + '...')
    
    // Test basic connectivity first
    const startTime = Date.now()
    const { data, error } = await supabase
      .from('users')
      .select('count(*)')
      .limit(1);
    const endTime = Date.now()
      
    console.log(`⏱️  Query took ${endTime - startTime}ms`)
    
    if (error) {
      console.error('❌ Connection test failed:', error)
      console.error('📋 Error details:', {
        message: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint
      })
      return { success: false, error }
    } else {
      console.log('✅ Connection test successful:', data)
      return { success: true, error: null }
    }
  } catch (err) {
    console.error('💥 Connection test exception:', err)
    return { success: false, error: err }
  }
}

// Enhanced authentication debugging
export const debugAuth = () => {
  console.log('🔐 Authentication Debug Info:')
  console.log('📡 Supabase URL:', supabaseUrl)
  console.log('🔑 Has Anon Key:', !!supabaseAnonKey)
  console.log('🌐 Environment:', import.meta.env.MODE)
  console.log('🔧 User Agent:', navigator.userAgent)
  console.log('📍 Origin:', window.location.origin)
  
  // Check if we can reach Supabase
  fetch(`${supabaseUrl}/rest/v1/`, {
    headers: {
      'apikey': supabaseAnonKey,
      'Authorization': `Bearer ${supabaseAnonKey}`
    }
  }).then(response => {
    console.log('🌐 Direct Supabase ping response:', response.status, response.statusText)
  }).catch(error => {
    console.error('💥 Direct Supabase ping failed:', error)
  })
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