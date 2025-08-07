import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Test database connectivity
export const testConnection = async () => {
  try {
    console.log('Testing Supabase connection...')
    console.log('URL:', supabaseUrl)
    console.log('Key:', supabaseAnonKey?.substring(0, 20) + '...')
    
    const { data, error } = await supabase
      .from('users')
      .select('count')
      .limit(1);
      
    console.log('Connection test result:', { data, error })
    return { success: !error, error }
  } catch (err) {
    console.error('Connection test failed:', err)
    return { success: false, error: err }
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