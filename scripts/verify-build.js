#!/usr/bin/env node

/**
 * Build Verification Script for GymBuddy
 * 
 * This script verifies that the built JavaScript files contain the correct
 * environment variables, particularly the Supabase configuration.
 * 
 * It will fail the build if placeholder values are detected.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const distPath = path.join(__dirname, '..', 'dist');

console.log('🔍 Build Verification Starting...');
console.log(`📁 Checking directory: ${distPath}`);

// Check if dist directory exists
if (!fs.existsSync(distPath)) {
  console.error('❌ FATAL: dist directory does not exist!');
  console.error('   Run `npm run build` first');
  process.exit(1);
}

// Find all JavaScript files in the dist/assets directory
const assetsPath = path.join(distPath, 'assets');
if (!fs.existsSync(assetsPath)) {
  console.error('❌ FATAL: dist/assets directory does not exist!');
  process.exit(1);
}

const jsFiles = fs.readdirSync(assetsPath)
  .filter(file => file.endsWith('.js'))
  .map(file => path.join(assetsPath, file));

console.log(`📄 Found ${jsFiles.length} JavaScript files to verify`);

// Environment variable checks
const checks = [
  {
    name: 'Supabase URL',
    placeholder: 'https://your-project.supabase.co',
    expected: process.env.VITE_SUPABASE_URL,
    critical: true
  },
  {
    name: 'Supabase Anonymous Key',
    placeholder: 'your_anon_key',
    expected: process.env.VITE_SUPABASE_ANON_KEY,
    critical: true
  },
  {
    name: 'Evolution API URL',
    placeholder: 'https://your-evolution-api.herokuapp.com',
    expected: process.env.VITE_EVOLUTION_API_URL,
    critical: false
  }
];

let hasErrors = false;
let hasWarnings = false;

for (const jsFile of jsFiles) {
  const content = fs.readFileSync(jsFile, 'utf8');
  const fileName = path.basename(jsFile);
  
  console.log(`\n🔎 Checking ${fileName}...`);
  
  for (const check of checks) {
    const hasPlaceholder = content.includes(check.placeholder);
    const hasExpected = check.expected ? content.includes(check.expected) : false;
    
    if (hasPlaceholder) {
      const message = `❌ ${check.name}: Found placeholder value "${check.placeholder}"`;
      if (check.critical) {
        console.error(message);
        console.error(`   Expected: ${check.expected ? check.expected.substring(0, 30) + '...' : 'NOT SET'}`);
        hasErrors = true;
      } else {
        console.warn(`⚠️  ${message}`);
        hasWarnings = true;
      }
    } else if (hasExpected) {
      console.log(`✅ ${check.name}: Correctly embedded`);
    }
  }
}

// Final verification
console.log('\n📊 Build Verification Results:');

if (hasErrors) {
  console.error('❌ CRITICAL ERRORS FOUND!');
  console.error('\n🚨 The build contains placeholder environment variables.');
  console.error('   This will cause authentication failures in production.');
  console.error('\n💡 Possible solutions:');
  console.error('   1. Set environment variables on Heroku:');
  console.error('      heroku config:set VITE_SUPABASE_URL=your_url --app your-app');
  console.error('      heroku config:set VITE_SUPABASE_ANON_KEY=your_key --app your-app');
  console.error('   2. Check that environment variables are available during build');
  console.error('   3. Run the heroku-env-setup.sh script to set all variables');
  process.exit(1);
}

if (hasWarnings) {
  console.warn('⚠️  Warnings found, but build can continue');
  console.warn('   Some optional features may not work correctly');
}

if (!hasErrors && !hasWarnings) {
  console.log('✅ All environment variables correctly embedded!');
}

console.log('\n🎯 Build verification completed successfully!');

// Additional diagnostic information
console.log('\n📋 Environment Variables Status:');
const envVars = [
  'VITE_SUPABASE_URL',
  'VITE_SUPABASE_ANON_KEY',
  'VITE_EVOLUTION_API_URL',
  'VITE_N8N_WEBHOOK_URL'
];

envVars.forEach(varName => {
  const value = process.env[varName];
  const status = value ? '✅' : '❌';
  const preview = value ? `${value.substring(0, 30)}...` : 'NOT SET';
  console.log(`${status} ${varName}: ${preview}`);
});

console.log('\n🚀 Build is ready for deployment!');