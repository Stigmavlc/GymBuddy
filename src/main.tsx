import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { testConnection, debugAuth } from './lib/supabase'

// Enhanced debugging for authentication issues
console.log('🚀 GymBuddy App Starting...')
debugAuth()

// Test database connection on app start
testConnection()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
