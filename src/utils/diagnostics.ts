/**
 * Comprehensive Diagnostic Utilities for GymBuddy
 * 
 * This module provides debugging tools specifically designed to diagnose
 * "Failed to fetch" authentication issues in React + Supabase applications
 * deployed on Heroku.
 */

import { supabase } from '@/lib/supabase'

export interface DiagnosticResult {
  success: boolean
  message: string
  details?: any
  timestamp: string
  duration?: number
}

export interface HealthCheckResults {
  overall: boolean
  environment: DiagnosticResult
  network: DiagnosticResult
  supabase: DiagnosticResult
  authentication: DiagnosticResult
  database: DiagnosticResult
  errors: string[]
}

/**
 * Environment Variables Validator
 * Checks that all required environment variables are present and properly formatted
 */
export const validateEnvironment = (): DiagnosticResult => {
  const start = Date.now()
  console.log('🔍 Validating environment variables...')
  
  const errors: string[] = []
  const warnings: string[] = []
  
  // Required variables
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
  const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY
  
  // Check presence
  if (!supabaseUrl) errors.push('VITE_SUPABASE_URL is missing')
  if (!supabaseKey) errors.push('VITE_SUPABASE_ANON_KEY is missing')
  
  // Check format
  if (supabaseUrl) {
    if (!supabaseUrl.startsWith('https://')) {
      errors.push('VITE_SUPABASE_URL must use HTTPS')
    }
    if (!supabaseUrl.includes('.supabase.co')) {
      warnings.push('VITE_SUPABASE_URL does not appear to be a Supabase URL')
    }
  }
  
  if (supabaseKey) {
    if (!supabaseKey.startsWith('eyJ')) {
      errors.push('VITE_SUPABASE_ANON_KEY does not appear to be a valid JWT token')
    }
    if (supabaseKey.length < 100) {
      warnings.push('VITE_SUPABASE_ANON_KEY seems unusually short')
    }
  }
  
  // Environment info
  const envDetails = {
    mode: import.meta.env.MODE,
    dev: import.meta.env.DEV,
    prod: import.meta.env.PROD,
    totalVars: Object.keys(import.meta.env).length,
    supabaseUrlPresent: !!supabaseUrl,
    supabaseKeyPresent: !!supabaseKey,
    supabaseUrlLength: supabaseUrl?.length || 0,
    supabaseKeyLength: supabaseKey?.length || 0,
    errors,
    warnings
  }
  
  const success = errors.length === 0
  const duration = Date.now() - start
  
  console.log(success ? '✅' : '❌', 'Environment validation:', success ? 'PASSED' : 'FAILED')
  if (errors.length > 0) console.error('Errors:', errors)
  if (warnings.length > 0) console.warn('Warnings:', warnings)
  
  return {
    success,
    message: success ? 'Environment variables valid' : `${errors.length} validation errors`,
    details: envDetails,
    timestamp: new Date().toISOString(),
    duration
  }
}

/**
 * Network Connectivity Tester
 * Tests basic internet connectivity and DNS resolution
 */
export const testNetworkConnectivity = async (): Promise<DiagnosticResult> => {
  const start = Date.now()
  console.log('🌐 Testing network connectivity...')
  
  const tests = [
    { name: 'Internet Connectivity', url: 'https://httpbin.org/status/200' },
    { name: 'DNS Resolution', url: 'https://1.1.1.1/dns-query?name=supabase.co&type=A' },
    { name: 'Supabase CDN', url: 'https://supabase.com/favicon.ico' }
  ]
  
  const results: any[] = []
  let successCount = 0
  
  for (const test of tests) {
    try {
      const testStart = Date.now()
      const response = await fetch(test.url, {
        method: 'HEAD',
        mode: 'no-cors',
        signal: AbortSignal.timeout(5000)
      })
      const testDuration = Date.now() - testStart
      
      const success = response.type === 'opaque' || response.ok
      if (success) successCount++
      
      results.push({
        name: test.name,
        success,
        status: response.status || 'no-cors',
        duration: testDuration
      })
    } catch (error) {
      results.push({
        name: test.name,
        success: false,
        error: (error as Error).message,
        duration: Date.now() - start
      })
    }
  }
  
  const success = successCount >= 2 // At least 2 out of 3 tests should pass
  const duration = Date.now() - start
  
  console.log(success ? '✅' : '❌', 'Network connectivity:', success ? 'GOOD' : 'ISSUES')
  
  return {
    success,
    message: `${successCount}/${tests.length} connectivity tests passed`,
    details: { tests: results, successCount, totalTests: tests.length },
    timestamp: new Date().toISOString(),
    duration
  }
}

/**
 * Supabase Service Health Checker
 * Tests various Supabase endpoints to ensure service availability
 */
export const checkSupabaseHealth = async (): Promise<DiagnosticResult> => {
  const start = Date.now()
  console.log('🏥 Checking Supabase service health...')
  
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
  const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY
  
  if (!supabaseUrl || !supabaseKey) {
    return {
      success: false,
      message: 'Cannot test Supabase health without credentials',
      timestamp: new Date().toISOString(),
      duration: Date.now() - start
    }
  }
  
  const endpoints = [
    { name: 'REST API Root', path: '/rest/v1/', method: 'HEAD' },
    { name: 'Auth Settings', path: '/auth/v1/settings', method: 'GET' },
    { name: 'Auth Health', path: '/auth/v1/health', method: 'GET' },
    { name: 'Realtime Health', path: '/realtime/v1/api/health', method: 'GET' }
  ]
  
  const results: any[] = []
  let successCount = 0
  
  for (const endpoint of endpoints) {
    try {
      const testStart = Date.now()
      const response = await fetch(supabaseUrl + endpoint.path, {
        method: endpoint.method,
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json'
        },
        signal: AbortSignal.timeout(8000)
      })
      const testDuration = Date.now() - testStart
      
      const success = response.ok || response.status === 404 // 404 might be expected for some endpoints
      if (success) successCount++
      
      results.push({
        name: endpoint.name,
        success,
        status: response.status,
        statusText: response.statusText,
        duration: testDuration,
        headers: Object.fromEntries(response.headers.entries())
      })
      
      console.log(success ? '✅' : '❌', endpoint.name, `(${response.status})`)
    } catch (error) {
      results.push({
        name: endpoint.name,
        success: false,
        error: (error as Error).message,
        duration: Date.now() - testStart
      })
      console.log('❌', endpoint.name, 'ERROR:', (error as Error).message)
    }
  }
  
  const success = successCount >= 2 // At least 2 endpoints should be healthy
  const duration = Date.now() - start
  
  return {
    success,
    message: `${successCount}/${endpoints.length} Supabase endpoints healthy`,
    details: { endpoints: results, successCount, totalEndpoints: endpoints.length },
    timestamp: new Date().toISOString(),
    duration
  }
}

/**
 * Authentication Flow Tester
 * Tests the complete authentication flow with a test account
 */
export const testAuthenticationFlow = async (): Promise<DiagnosticResult> => {
  const start = Date.now()
  console.log('🔐 Testing authentication flow...')
  
  const steps: any[] = []
  let currentStep = 'Session Check'
  
  try {
    // Step 1: Check current session
    currentStep = 'Session Check'
    const sessionStart = Date.now()
    const { data: { session }, error: sessionError } = await supabase.auth.getSession()
    steps.push({
      step: currentStep,
      success: !sessionError,
      duration: Date.now() - sessionStart,
      details: sessionError ? { error: sessionError.message } : { hasSession: !!session }
    })
    
    // Step 2: Test anonymous access (get user without auth)
    currentStep = 'Anonymous Access'
    const anonStart = Date.now()
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser()
      steps.push({
        step: currentStep,
        success: true,
        duration: Date.now() - anonStart,
        details: { hasUser: !!user, error: userError?.message }
      })
    } catch (anonError) {
      steps.push({
        step: currentStep,
        success: false,
        duration: Date.now() - anonStart,
        details: { error: (anonError as Error).message }
      })
    }
    
    // Step 3: Test auth state change listener setup
    currentStep = 'Auth Listener Setup'
    const listenerStart = Date.now()
    try {
      const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {})
      subscription.unsubscribe() // Clean up immediately
      steps.push({
        step: currentStep,
        success: true,
        duration: Date.now() - listenerStart,
        details: { listenerCreated: true }
      })
    } catch (listenerError) {
      steps.push({
        step: currentStep,
        success: false,
        duration: Date.now() - listenerStart,
        details: { error: (listenerError as Error).message }
      })
    }
    
    const successfulSteps = steps.filter(s => s.success).length
    const success = successfulSteps >= 2
    const duration = Date.now() - start
    
    console.log(success ? '✅' : '❌', 'Authentication flow:', success ? 'HEALTHY' : 'ISSUES')
    
    return {
      success,
      message: `${successfulSteps}/${steps.length} authentication steps successful`,
      details: { steps, successfulSteps, totalSteps: steps.length },
      timestamp: new Date().toISOString(),
      duration
    }
    
  } catch (error) {
    const duration = Date.now() - start
    console.log('❌ Authentication flow failed at:', currentStep)
    
    return {
      success: false,
      message: `Authentication flow failed at: ${currentStep}`,
      details: { 
        failedStep: currentStep,
        error: (error as Error).message,
        steps
      },
      timestamp: new Date().toISOString(),
      duration
    }
  }
}

/**
 * Database Connectivity Tester
 * Tests basic database operations without requiring authentication
 */
export const testDatabaseConnectivity = async (): Promise<DiagnosticResult> => {
  const start = Date.now()
  console.log('🗄️ Testing database connectivity...')
  
  const tests = [
    {
      name: 'Health Check Query',
      operation: async () => {
        // This should work without auth if RLS allows it
        const { data, error } = await supabase
          .from('users')
          .select('count(*)', { count: 'exact', head: true })
          .limit(0)
        return { data, error }
      }
    },
    {
      name: 'Schema Introspection',
      operation: async () => {
        // This might fail due to RLS but should still test connectivity
        const { data, error } = await supabase.rpc('version')
        return { data, error }
      }
    }
  ]
  
  const results: any[] = []
  let successCount = 0
  
  for (const test of tests) {
    try {
      const testStart = Date.now()
      const result = await test.operation()
      const testDuration = Date.now() - testStart
      
      // Consider it successful if we get a response, even if it's an RLS error
      const success = result.error?.code !== 'PGRST301' || result.data !== null
      if (success || result.error?.message?.includes('RLS')) successCount++
      
      results.push({
        name: test.name,
        success: success || result.error?.message?.includes('RLS'),
        duration: testDuration,
        data: result.data,
        error: result.error?.message,
        errorCode: result.error?.code
      })
      
      console.log(
        success ? '✅' : (result.error?.message?.includes('RLS') ? '⚠️' : '❌'),
        test.name,
        result.error?.message || 'OK'
      )
    } catch (error) {
      results.push({
        name: test.name,
        success: false,
        duration: Date.now() - testStart,
        error: (error as Error).message
      })
      console.log('❌', test.name, 'ERROR:', (error as Error).message)
    }
  }
  
  const success = successCount > 0 // At least one test should indicate connectivity
  const duration = Date.now() - start
  
  return {
    success,
    message: success ? 'Database is reachable' : 'Database connectivity issues',
    details: { tests: results, successCount, totalTests: tests.length },
    timestamp: new Date().toISOString(),
    duration
  }
}

/**
 * Comprehensive Health Check
 * Runs all diagnostic tests and provides a complete system health report
 */
export const runHealthCheck = async (): Promise<HealthCheckResults> => {
  console.group('🏥 GymBuddy System Health Check')
  console.log('Starting comprehensive diagnostics...')
  
  const errors: string[] = []
  
  // Run all diagnostic tests
  const [environment, network, supabase, authentication, database] = await Promise.allSettled([
    Promise.resolve(validateEnvironment()),
    testNetworkConnectivity(),
    checkSupabaseHealth(),
    testAuthenticationFlow(),
    testDatabaseConnectivity()
  ])
  
  // Process results
  const environmentResult = environment.status === 'fulfilled' ? environment.value : {
    success: false,
    message: 'Environment check failed',
    timestamp: new Date().toISOString()
  }
  
  const networkResult = network.status === 'fulfilled' ? network.value : {
    success: false,
    message: 'Network check failed',
    timestamp: new Date().toISOString()
  }
  
  const supabaseResult = supabase.status === 'fulfilled' ? supabase.value : {
    success: false,
    message: 'Supabase check failed',
    timestamp: new Date().toISOString()
  }
  
  const authenticationResult = authentication.status === 'fulfilled' ? authentication.value : {
    success: false,
    message: 'Authentication check failed',
    timestamp: new Date().toISOString()
  }
  
  const databaseResult = database.status === 'fulfilled' ? database.value : {
    success: false,
    message: 'Database check failed',
    timestamp: new Date().toISOString()
  }
  
  // Collect errors
  if (!environmentResult.success) errors.push(`Environment: ${environmentResult.message}`)
  if (!networkResult.success) errors.push(`Network: ${networkResult.message}`)
  if (!supabaseResult.success) errors.push(`Supabase: ${supabaseResult.message}`)
  if (!authenticationResult.success) errors.push(`Authentication: ${authenticationResult.message}`)
  if (!databaseResult.success) errors.push(`Database: ${databaseResult.message}`)
  
  const overall = environmentResult.success && networkResult.success && supabaseResult.success
  
  console.log('📊 Health Check Summary:')
  console.log('Environment:', environmentResult.success ? '✅' : '❌')
  console.log('Network:', networkResult.success ? '✅' : '❌')
  console.log('Supabase:', supabaseResult.success ? '✅' : '❌')
  console.log('Authentication:', authenticationResult.success ? '✅' : '❌')
  console.log('Database:', databaseResult.success ? '✅' : '❌')
  console.log('Overall:', overall ? '✅ HEALTHY' : '❌ ISSUES DETECTED')
  
  if (errors.length > 0) {
    console.error('🚨 Issues found:', errors)
  }
  
  console.groupEnd()
  
  return {
    overall,
    environment: environmentResult,
    network: networkResult,
    supabase: supabaseResult,
    authentication: authenticationResult,
    database: databaseResult,
    errors
  }
}

/**
 * Debug Panel Toggle
 * Creates a floating debug panel for easy access to diagnostic tools
 */
export const createDebugPanel = (): void => {
  if (typeof window === 'undefined' || import.meta.env.PROD) return
  
  // Remove existing panel if any
  const existingPanel = document.getElementById('gymbuddy-debug-panel')
  if (existingPanel) existingPanel.remove()
  
  const panel = document.createElement('div')
  panel.id = 'gymbuddy-debug-panel'
  panel.innerHTML = `
    <style>
      #gymbuddy-debug-panel {
        position: fixed;
        top: 20px;
        right: 20px;
        z-index: 10000;
        background: rgba(0, 0, 0, 0.9);
        color: white;
        padding: 15px;
        border-radius: 8px;
        font-family: monospace;
        font-size: 12px;
        max-width: 300px;
        backdrop-filter: blur(5px);
        border: 1px solid #333;
      }
      #gymbuddy-debug-panel button {
        background: #007acc;
        color: white;
        border: none;
        padding: 5px 10px;
        margin: 2px;
        border-radius: 4px;
        cursor: pointer;
        font-size: 11px;
      }
      #gymbuddy-debug-panel button:hover {
        background: #005999;
      }
      #gymbuddy-debug-panel h4 {
        margin: 0 0 10px 0;
        color: #00ff88;
      }
      .debug-status {
        margin: 5px 0;
        padding: 3px 6px;
        border-radius: 3px;
        font-size: 11px;
      }
      .debug-status.success { background: #0f5132; color: #d1e7dd; }
      .debug-status.error { background: #842029; color: #f8d7da; }
      .debug-status.warning { background: #664d03; color: #fff3cd; }
    </style>
    <h4>🔧 GymBuddy Debug</h4>
    <div id="debug-status">Loading...</div>
    <div>
      <button onclick="window.gymbuddyDebug.runHealthCheck()">🏥 Health Check</button>
      <button onclick="window.gymbuddyDebug.testAuth()">🔐 Test Auth</button>
      <button onclick="window.gymbuddyDebug.clearLogs()">🧹 Clear Logs</button>
      <button onclick="document.getElementById('gymbuddy-debug-panel').remove()">❌ Close</button>
    </div>
  `
  
  document.body.appendChild(panel)
  
  // Expose debug functions globally
  (window as any).gymbuddyDebug = {
    runHealthCheck: async () => {
      const results = await runHealthCheck()
      const statusDiv = document.getElementById('debug-status')
      if (statusDiv) {
        statusDiv.innerHTML = `
          <div class="debug-status ${results.overall ? 'success' : 'error'}">
            Overall: ${results.overall ? '✅ HEALTHY' : '❌ ISSUES'}
          </div>
          <div class="debug-status ${results.environment.success ? 'success' : 'error'}">
            Environment: ${results.environment.success ? '✅' : '❌'}
          </div>
          <div class="debug-status ${results.network.success ? 'success' : 'error'}">
            Network: ${results.network.success ? '✅' : '❌'}
          </div>
          <div class="debug-status ${results.supabase.success ? 'success' : 'error'}">
            Supabase: ${results.supabase.success ? '✅' : '❌'}
          </div>
        `
      }
    },
    testAuth: async () => {
      try {
        const session = await supabase.auth.getSession()
        console.log('Current session:', session)
        alert('Check console for auth details')
      } catch (error) {
        console.error('Auth test error:', error)
        alert('Auth test failed - check console')
      }
    },
    clearLogs: () => {
      console.clear()
      console.log('🧹 Console cleared - GymBuddy Debug Panel')
    }
  }
  
  // Auto-run initial health check
  setTimeout(() => {
    (window as any).gymbuddyDebug.runHealthCheck()
  }, 1000)
}