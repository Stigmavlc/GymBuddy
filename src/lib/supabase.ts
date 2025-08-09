import { createClient } from '@supabase/supabase-js'

// Environment Variable Debugging
const DEBUG_MODE = import.meta.env.DEV || import.meta.env.VITE_DEBUG === 'true'
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// Comprehensive Environment Variable Diagnostics
const logEnvironmentDiagnostics = () => {
  console.group('🔧 Environment Variable Diagnostics')
  console.log('📊 All import.meta.env keys:', Object.keys(import.meta.env))
  console.log('🌐 VITE_SUPABASE_URL exists:', !!supabaseUrl)
  console.log('🔑 VITE_SUPABASE_ANON_KEY exists:', !!supabaseAnonKey)
  console.log('🌐 VITE_SUPABASE_URL length:', supabaseUrl?.length || 0)
  console.log('🔑 VITE_SUPABASE_ANON_KEY length:', supabaseAnonKey?.length || 0)
  console.log('🔗 Supabase URL preview:', supabaseUrl ? `${supabaseUrl.substring(0, 30)}...` : 'MISSING')
  console.log('🔑 Key preview:', supabaseAnonKey ? `${supabaseAnonKey.substring(0, 20)}...` : 'MISSING')
  console.log('🏗️ Build mode:', import.meta.env.MODE)
  console.log('🔧 Dev mode:', import.meta.env.DEV)
  console.log('🚀 Prod mode:', import.meta.env.PROD)
  console.log('🐛 Debug mode:', DEBUG_MODE)
  console.groupEnd()
}

// Log environment diagnostics immediately
logEnvironmentDiagnostics()

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ CRITICAL: Missing Supabase environment variables')
  console.error('Expected variables: VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY')
  throw new Error('Missing Supabase environment variables')
}

// Create Supabase client with enhanced debugging
const createSupabaseClient = () => {
  console.group('🏗️ Creating Supabase Client')
  console.log('📡 URL:', supabaseUrl)
  console.log('🔑 Key preview:', supabaseAnonKey?.substring(0, 20) + '...')
  
  const client = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      debug: DEBUG_MODE,
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true
    },
    global: {
      headers: {
        'X-Client-Debug': 'gymbuddy-v1',
        'X-Client-Timestamp': new Date().toISOString()
      }
    }
  })
  
  console.log('✅ Supabase client created successfully')
  console.groupEnd()
  return client
}

export const supabase = createSupabaseClient()

// Network Request Logger
const logNetworkRequest = (url: string, options: RequestInit) => {
  if (!DEBUG_MODE) return
  
  console.group('🌐 Network Request Debug')
  console.log('📡 URL:', url)
  console.log('🔧 Method:', options.method || 'GET')
  console.log('📝 Headers:', options.headers)
  console.log('📦 Body:', options.body ? (typeof options.body === 'string' ? options.body.substring(0, 200) + '...' : '[Binary Data]') : 'none')
  console.log('⏰ Timestamp:', new Date().toISOString())
  console.groupEnd()
}

// Network Response Logger
const logNetworkResponse = (url: string, response: Response, duration: number) => {
  if (!DEBUG_MODE) return
  
  console.group('📡 Network Response Debug')
  console.log('📡 URL:', url)
  console.log('📊 Status:', response.status, response.statusText)
  console.log('⏱️ Duration:', duration + 'ms')
  console.log('📝 Headers:', Object.fromEntries(response.headers.entries()))
  console.log('🔗 CORS:', response.headers.get('access-control-allow-origin'))
  console.log('📱 Content-Type:', response.headers.get('content-type'))
  console.groupEnd()
}

// Comprehensive connection test with multiple scenarios
export const testConnection = async () => {
  console.group('🔍 Comprehensive Supabase Connection Test')
  
  const results = {
    environmentCheck: false,
    basicConnectivity: false,
    authEndpoint: false,
    dataQuery: false,
    corsTest: false,
    errors: [] as string[]
  }
  
  try {
    // 1. Environment Check
    console.log('\n1️⃣ Environment Check')
    if (supabaseUrl && supabaseAnonKey) {
      results.environmentCheck = true
      console.log('✅ Environment variables present')
    } else {
      results.errors.push('Missing environment variables')
      console.error('❌ Missing environment variables')
    }
    
    // 2. Basic Connectivity Test (Direct Fetch)
    console.log('\n2️⃣ Basic Connectivity Test')
    try {
      const connectivityStart = Date.now()
      const response = await fetch(`${supabaseUrl}/rest/v1/`, {
        method: 'GET',
        headers: {
          'apikey': supabaseAnonKey!,
          'Authorization': `Bearer ${supabaseAnonKey}`,
          'Content-Type': 'application/json'
        }
      })
      const connectivityDuration = Date.now() - connectivityStart
      
      logNetworkResponse(`${supabaseUrl}/rest/v1/`, response, connectivityDuration)
      
      if (response.ok || response.status === 404) { // 404 is expected for root endpoint
        results.basicConnectivity = true
        console.log('✅ Basic connectivity successful')
      } else {
        results.errors.push(`Connectivity failed: ${response.status} ${response.statusText}`)
        console.error('❌ Basic connectivity failed:', response.status, response.statusText)
      }
    } catch (err) {
      results.errors.push(`Connectivity error: ${err}`)
      console.error('❌ Basic connectivity error:', err)
    }
    
    // 3. Auth Endpoint Test
    console.log('\n3️⃣ Auth Endpoint Test')
    try {
      const authStart = Date.now()
      const authResponse = await fetch(`${supabaseUrl}/auth/v1/settings`, {
        method: 'GET',
        headers: {
          'apikey': supabaseAnonKey!,
          'Authorization': `Bearer ${supabaseAnonKey}`
        }
      })
      const authDuration = Date.now() - authStart
      
      logNetworkResponse(`${supabaseUrl}/auth/v1/settings`, authResponse, authDuration)
      
      if (authResponse.ok) {
        results.authEndpoint = true
        console.log('✅ Auth endpoint accessible')
        const authData = await authResponse.json()
        console.log('🔐 Auth settings:', authData)
      } else {
        results.errors.push(`Auth endpoint failed: ${authResponse.status}`)
        console.error('❌ Auth endpoint failed:', authResponse.status)
      }
    } catch (err) {
      results.errors.push(`Auth endpoint error: ${err}`)
      console.error('❌ Auth endpoint error:', err)
    }
    
    // 4. Data Query Test
    console.log('\n4️⃣ Data Query Test')
    try {
      const queryStart = Date.now()
      const { data, error } = await supabase
        .from('users')
        .select('count(*)', { count: 'exact' })
        .limit(1)
      const queryDuration = Date.now() - queryStart
      
      console.log(`⏱️ Query took ${queryDuration}ms`)
      
      if (error) {
        results.errors.push(`Data query failed: ${error.message}`)
        console.error('❌ Data query failed:', {
          message: error.message,
          code: error.code,
          details: error.details,
          hint: error.hint
        })
      } else {
        results.dataQuery = true
        console.log('✅ Data query successful:', data)
      }
    } catch (err) {
      results.errors.push(`Data query error: ${err}`)
      console.error('❌ Data query error:', err)
    }
    
    // 5. CORS Test
    console.log('\n5️⃣ CORS Configuration Test')
    try {
      const corsHeaders = {
        'Origin': window.location.origin,
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'authorization,apikey,content-type'
      }
      
      const corsResponse = await fetch(`${supabaseUrl}/rest/v1/users`, {
        method: 'OPTIONS',
        headers: corsHeaders
      })
      
      const allowedOrigins = corsResponse.headers.get('access-control-allow-origin')
      const allowedMethods = corsResponse.headers.get('access-control-allow-methods')
      const allowedHeaders = corsResponse.headers.get('access-control-allow-headers')
      
      console.log('🌐 CORS Headers:', {
        'access-control-allow-origin': allowedOrigins,
        'access-control-allow-methods': allowedMethods,
        'access-control-allow-headers': allowedHeaders
      })
      
      if (corsResponse.ok) {
        results.corsTest = true
        console.log('✅ CORS configuration looks good')
      } else {
        results.errors.push(`CORS test failed: ${corsResponse.status}`)
        console.error('❌ CORS test failed')
      }
    } catch (err) {
      results.errors.push(`CORS test error: ${err}`)
      console.error('❌ CORS test error:', err)
    }
    
    // Summary
    console.log('\n📊 Connection Test Results:')
    console.log('Environment Check:', results.environmentCheck ? '✅' : '❌')
    console.log('Basic Connectivity:', results.basicConnectivity ? '✅' : '❌')
    console.log('Auth Endpoint:', results.authEndpoint ? '✅' : '❌')
    console.log('Data Query:', results.dataQuery ? '✅' : '❌')
    console.log('CORS Test:', results.corsTest ? '✅' : '❌')
    
    if (results.errors.length > 0) {
      console.error('❌ Errors encountered:', results.errors)
    }
    
    const overallSuccess = results.environmentCheck && results.basicConnectivity && results.authEndpoint
    console.log('🎯 Overall Status:', overallSuccess ? '✅ HEALTHY' : '❌ ISSUES DETECTED')
    
    console.groupEnd()
    return { success: overallSuccess, results, errors: results.errors }
    
  } catch (err) {
    console.error('💥 Connection test exception:', err)
    console.groupEnd()
    return { success: false, results, errors: [String(err)] }
  }
}

// Enhanced authentication and runtime debugging
export const debugAuth = async () => {
  console.group('🔐 Authentication Debug Session')
  
  // Runtime Environment Info
  console.group('🌐 Runtime Environment')
  console.log('📍 Current URL:', window.location.href)
  console.log('🌐 Origin:', window.location.origin)
  console.log('🌍 Protocol:', window.location.protocol)
  console.log('🏠 Host:', window.location.host)
  console.log('🔧 User Agent:', navigator.userAgent)
  console.log('📱 Platform:', navigator.platform)
  console.log('🌐 Online:', navigator.onLine)
  console.log('🍪 Cookies enabled:', navigator.cookieEnabled)
  console.log('⏰ Timezone:', Intl.DateTimeFormat().resolvedOptions().timeZone)
  console.groupEnd()
  
  // Supabase Configuration
  console.group('⚙️ Supabase Configuration')
  console.log('📡 Supabase URL:', supabaseUrl)
  console.log('🔑 Has Anon Key:', !!supabaseAnonKey)
  console.log('🔗 URL is HTTPS:', supabaseUrl?.startsWith('https://') || false)
  console.log('🎯 URL format valid:', /^https:\/\/[a-zA-Z0-9-]+\.supabase\.co$/.test(supabaseUrl || ''))
  console.log('🔑 Key format valid:', /^eyJ[A-Za-z0-9_-]+$/.test(supabaseAnonKey || ''))
  console.groupEnd()
  
  // Browser Compatibility
  console.group('🌐 Browser Compatibility')
  console.log('📦 Fetch API:', typeof fetch !== 'undefined')
  console.log('🔄 Promise support:', typeof Promise !== 'undefined')
  console.log('📊 Local Storage:', typeof localStorage !== 'undefined')
  console.log('📊 Session Storage:', typeof sessionStorage !== 'undefined')
  console.log('🌐 WebSockets:', typeof WebSocket !== 'undefined')
  console.groupEnd()
  
  // Network Diagnostics
  console.group('🌐 Network Diagnostics')
  try {
    const pingStart = Date.now()
    const response = await fetch(`${supabaseUrl}/rest/v1/`, {
      method: 'HEAD',
      headers: {
        'apikey': supabaseAnonKey!,
        'Authorization': `Bearer ${supabaseAnonKey}`
      },
      signal: AbortSignal.timeout(5000) // 5 second timeout
    })
    const pingDuration = Date.now() - pingStart
    
    console.log('✅ Network ping successful')
    console.log('⏱️ Response time:', pingDuration + 'ms')
    console.log('📊 Status:', response.status, response.statusText)
    console.log('🔐 CORS headers:')
    console.log('  - Access-Control-Allow-Origin:', response.headers.get('access-control-allow-origin'))
    console.log('  - Access-Control-Allow-Methods:', response.headers.get('access-control-allow-methods'))
    console.log('  - Access-Control-Allow-Headers:', response.headers.get('access-control-allow-headers'))
  } catch (error) {
    console.error('❌ Network ping failed:', error)
    if (error instanceof TypeError) {
      console.error('🚨 This looks like a network/CORS issue!')
    }
  }
  console.groupEnd()
  
  // Session State
  console.group('👤 Current Session State')
  try {
    const { data: { session }, error } = await supabase.auth.getSession()
    if (error) {
      console.error('❌ Session check failed:', error)
    } else if (session) {
      console.log('✅ Active session found')
      console.log('👤 User ID:', session.user?.id)
      console.log('📧 Email:', session.user?.email)
      console.log('⏰ Expires at:', new Date(session.expires_at! * 1000).toISOString())
      console.log('🔄 Refresh token exists:', !!session.refresh_token)
    } else {
      console.log('ℹ️ No active session')
    }
  } catch (error) {
    console.error('❌ Session check error:', error)
  }
  console.groupEnd()
  
  console.groupEnd()
}

// Monitor network errors globally
if (typeof window !== 'undefined' && DEBUG_MODE) {
  // Listen for global fetch errors
  const originalFetch = window.fetch
  window.fetch = async (...args) => {
    const [url, options] = args
    const urlString = url.toString()
    
    // Only log Supabase requests
    if (urlString.includes('supabase.co')) {
      const startTime = Date.now()
      logNetworkRequest(urlString, options || {})
      
      try {
        const response = await originalFetch(...args)
        const duration = Date.now() - startTime
        logNetworkResponse(urlString, response, duration)
        return response
      } catch (error) {
        const duration = Date.now() - startTime
        console.error('🚨 Network Request Failed:', {
          url: urlString,
          duration: duration + 'ms',
          error: error,
          timestamp: new Date().toISOString()
        })
        throw error
      }
    }
    
    return originalFetch(...args)
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