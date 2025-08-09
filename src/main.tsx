import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { testConnection, debugAuth } from './lib/supabase'
import { runHealthCheck, createDebugPanel } from './utils/diagnostics'

// Comprehensive startup diagnostics
const runStartupDiagnostics = async () => {
  console.group('🚀 GymBuddy Application Startup Diagnostics')
  
  // App Information
  console.group('📊 Application Info')
  console.log('App Name:', 'GymBuddy')
  console.log('Version:', '1.0.0')
  console.log('Build Time:', new Date().toISOString())
  console.log('React Version:', '19.1.0')
  console.log('Environment:', import.meta.env.MODE || 'unknown')
  console.groupEnd()
  
  // Browser & Platform Info
  console.group('🌐 Platform Information')
  console.log('User Agent:', navigator.userAgent)
  console.log('Platform:', navigator.platform)
  console.log('Language:', navigator.language)
  console.log('Online:', navigator.onLine)
  console.log('Cookie Enabled:', navigator.cookieEnabled)
  console.log('Local Storage Available:', typeof Storage !== 'undefined')
  console.log('WebGL Available:', !!document.createElement('canvas').getContext('webgl'))
  console.groupEnd()
  
  // Environment Variables Check
  console.group('⚙️ Environment Variables')
  const envVars = import.meta.env
  console.log('Total env vars:', Object.keys(envVars).length)
  console.log('Environment vars:', Object.keys(envVars))
  
  // Critical variables check
  const criticalVars = {
    'VITE_SUPABASE_URL': {
      value: envVars.VITE_SUPABASE_URL,
      required: true,
      format: 'URL'
    },
    'VITE_SUPABASE_ANON_KEY': {
      value: envVars.VITE_SUPABASE_ANON_KEY,
      required: true,
      format: 'JWT'
    }
  }
  
  console.log('🔍 Critical Variables Status:')
  for (const [key, config] of Object.entries(criticalVars)) {
    const exists = !!config.value
    const preview = config.value ? 
      (key.includes('KEY') ? config.value.substring(0, 20) + '...' : config.value) 
      : 'MISSING'
    
    console.log(`  ${exists ? '✅' : '❌'} ${key}:`, preview)
    
    if (config.required && !exists) {
      console.error(`❌ CRITICAL: Missing required environment variable: ${key}`)
    }
  }
  console.groupEnd()
  
  // URL and Routing Info
  console.group('🔗 URL & Routing')
  console.log('Current URL:', window.location.href)
  console.log('Origin:', window.location.origin)
  console.log('Protocol:', window.location.protocol)
  console.log('Host:', window.location.host)
  console.log('Pathname:', window.location.pathname)
  console.log('Hash:', window.location.hash || 'none')
  console.log('Search:', window.location.search || 'none')
  console.groupEnd()
  
  // Performance Timing
  console.group('⏱️ Performance Timing')
  if (performance && performance.timing) {
    const timing = performance.timing
    const navigationStart = timing.navigationStart
    console.log('DNS Lookup:', (timing.domainLookupEnd - timing.domainLookupStart) + 'ms')
    console.log('TCP Connect:', (timing.connectEnd - timing.connectStart) + 'ms')
    console.log('Request:', (timing.responseStart - timing.requestStart) + 'ms')
    console.log('Response:', (timing.responseEnd - timing.responseStart) + 'ms')
    console.log('DOM Loading:', (timing.domContentLoadedEventStart - navigationStart) + 'ms')
  }
  console.groupEnd()
  
  console.log('\n🔍 Running Supabase Diagnostics...')
  
  // Run authentication debugging
  try {
    await debugAuth()
  } catch (error) {
    console.error('❌ Authentication debug failed:', error)
  }
  
  // Run comprehensive health check
  try {
    console.log('\n🏥 Running comprehensive health check...')
    const healthResults = await runHealthCheck()
    
    if (!healthResults.overall) {
      console.error('❌ Health check detected issues!')
      console.error('Failed components:', healthResults.errors)
    } else {
      console.log('✅ All systems healthy!')
    }
  } catch (error) {
    console.error('❌ Health check failed:', error)
  }
  
  // Test legacy connection (for backward compatibility)
  try {
    const connectionResult = await testConnection()
    if (!connectionResult.success) {
      console.error('❌ Legacy connection test failed!')
      console.error('Errors:', connectionResult.errors)
    }
  } catch (error) {
    console.error('❌ Connection test failed:', error)
  }
  
  console.log('\n✅ Startup diagnostics completed')
  console.groupEnd()
  
  // Setup global error handlers for debugging
  window.addEventListener('error', (event) => {
    console.error('🚨 Global JavaScript Error:', {
      message: event.message,
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno,
      error: event.error,
      timestamp: new Date().toISOString()
    })
  })
  
  window.addEventListener('unhandledrejection', (event) => {
    console.error('🚨 Unhandled Promise Rejection:', {
      reason: event.reason,
      promise: event.promise,
      timestamp: new Date().toISOString()
    })
  })
}

// Performance monitoring wrapper
const renderWithDiagnostics = async () => {
  const renderStart = performance.now()
  
  try {
    await runStartupDiagnostics()
    
    console.log('🎨 Rendering React Application...')
    createRoot(document.getElementById('root')!).render(
      <StrictMode>
        <App />
      </StrictMode>
    )
    
    const renderEnd = performance.now()
    console.log(`✅ React app rendered in ${Math.round(renderEnd - renderStart)}ms`)
    
    // Create debug panel for development
    if (import.meta.env.DEV) {
      setTimeout(() => createDebugPanel(), 2000)
    }
    
  } catch (error) {
    console.error('💥 Critical startup error:', error)
    
    // Show user-friendly error message
    const root = document.getElementById('root')
    if (root) {
      root.innerHTML = `
        <div style="padding: 20px; font-family: system-ui; max-width: 600px; margin: 50px auto;">
          <h1 style="color: #dc2626; margin-bottom: 20px;">🚨 Application Startup Error</h1>
          <p style="margin-bottom: 15px;">The GymBuddy app encountered a critical error during startup.</p>
          <details style="margin-bottom: 20px;">
            <summary style="cursor: pointer; font-weight: bold;">Error Details</summary>
            <pre style="background: #f3f4f6; padding: 10px; border-radius: 5px; overflow-x: auto; margin-top: 10px;">${error}</pre>
          </details>
          <p style="color: #6b7280;">Please check the browser console for more detailed debugging information.</p>
        </div>
      `
    }
  }
}

// Start the application
renderWithDiagnostics()
