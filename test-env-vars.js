#!/usr/bin/env node

// Test script to verify environment variables are loaded correctly
import dotenv from 'dotenv';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);

// Load environment variables
dotenv.config();

console.log('🧪 Environment Variable Test');
console.log('============================');

const requiredVars = [
  'VITE_SUPABASE_URL',
  'VITE_SUPABASE_ANON_KEY'
];

const optionalVars = [
  'VITE_EVOLUTION_API_URL',
  'VITE_EVOLUTION_API_KEY',
  'VITE_EVOLUTION_INSTANCE_NAME',
  'VITE_N8N_WEBHOOK_URL',
  'VITE_USER_IVAN_EMAIL',
  'VITE_USER_IVAN_PHONE'
];

console.log('\n📋 Required Variables:');
requiredVars.forEach(varName => {
  const value = process.env[varName];
  const status = value ? '✅' : '❌';
  const preview = value ? `${value.substring(0, 30)}...` : 'MISSING';
  console.log(`${status} ${varName}: ${preview}`);
});

console.log('\n📋 Optional Variables:');
optionalVars.forEach(varName => {
  const value = process.env[varName];
  const status = value && !value.includes('your_') ? '✅' : '⚠️';
  const preview = value ? `${value.substring(0, 30)}...` : 'NOT SET';
  console.log(`${status} ${varName}: ${preview}`);
});

// Test Supabase URL format
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

console.log('\n🔍 Validation Tests:');
console.log(`✅ Supabase URL format: ${/^https:\/\/[a-zA-Z0-9-]+\.supabase\.co$/.test(supabaseUrl || '') ? 'VALID' : 'INVALID'}`);
console.log(`✅ Supabase key format: ${/^eyJ[A-Za-z0-9_-]+$/.test(supabaseKey || '') ? 'VALID' : 'INVALID'}`);
console.log(`✅ URL is HTTPS: ${supabaseUrl?.startsWith('https://') || false}`);

const allRequiredPresent = requiredVars.every(varName => process.env[varName]);
console.log(`\n🎯 Overall Status: ${allRequiredPresent ? '✅ READY' : '❌ MISSING REQUIRED VARS'}`);

if (allRequiredPresent) {
  console.log('\n🚀 Environment is configured correctly!');
} else {
  console.log('\n⚠️  Please set the missing environment variables before building.');
}