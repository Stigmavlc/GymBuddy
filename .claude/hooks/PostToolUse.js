#!/usr/bin/env node

/**
 * PostToolUse Hook - Post-Implementation Validation
 * This hook analyzes completed tool actions and suggests follow-up agents
 * for testing, validation, and quality assurance.
 */

const fs = require('fs');
const path = require('path');

// Track recent actions for context
const RECENT_ACTIONS_FILE = path.join(__dirname, '.recent_actions.json');

// Follow-up agent recommendations based on tool usage
const POST_ACTION_AGENTS = {
  'test-safety-net': {
    afterTools: ['Edit', 'Write', 'MultiEdit', 'NotebookEdit'],
    afterPatterns: ['function', 'class', 'component', 'service', 'api'],
    description: 'Create tests for new/modified code'
  },
  'deploy-pipeline-guardian': {
    afterTools: ['mcp__heroku__', 'Bash(git push', 'Bash(heroku'],
    afterPatterns: ['deploy', 'build', 'production'],
    description: 'Validate deployment and production readiness'
  },
  'ui-flow-guardian': {
    afterTools: ['Edit', 'Write'],
    afterPatterns: ['tsx', 'jsx', 'component', 'page', 'ui', 'style'],
    description: 'Verify UI changes and user flows'
  },
  'acceptance-criteria-validator': {
    afterTools: ['Task'],
    afterPatterns: ['complete', 'finished', 'done', 'implemented'],
    description: 'Validate feature meets requirements'
  },
  'data-contract-auditor': {
    afterTools: ['mcp__supabase__execute_sql', 'mcp__supabase__apply_migration'],
    afterPatterns: ['table', 'policy', 'migration', 'schema'],
    description: 'Audit database changes and permissions'
  },
  'state-architect': {
    afterTools: ['Edit', 'Write'],
    afterPatterns: ['useState', 'useReducer', 'context', 'redux', 'store'],
    description: 'Review state management implementation'
  },
  'debug-visibility-engineer': {
    afterTools: ['Edit', 'Write'],
    afterPatterns: ['error', 'catch', 'try', 'debug', 'console'],
    description: 'Enhance error handling and logging'
  }
};

// Load recent actions
function loadRecentActions() {
  try {
    if (fs.existsSync(RECENT_ACTIONS_FILE)) {
      return JSON.parse(fs.readFileSync(RECENT_ACTIONS_FILE, 'utf-8'));
    }
  } catch (error) {
    // Ignore errors, start fresh
  }
  return [];
}

// Save recent actions
function saveRecentActions(actions) {
  try {
    // Keep only last 20 actions
    const recentActions = actions.slice(-20);
    fs.writeFileSync(RECENT_ACTIONS_FILE, JSON.stringify(recentActions, null, 2));
  } catch (error) {
    // Ignore save errors
  }
}

// Analyze what follow-up might be needed
function analyzeFollowUp(tool, params, result) {
  const recommendations = [];
  const toolLower = tool.toLowerCase();
  const paramsStr = JSON.stringify(params).toLowerCase();
  const resultStr = JSON.stringify(result).toLowerCase();
  const combinedContext = `${toolLower} ${paramsStr} ${resultStr}`;
  
  // Check each post-action agent
  for (const [agentName, config] of Object.entries(POST_ACTION_AGENTS)) {
    let score = 0;
    let matched = false;
    
    // Check if tool matches
    for (const toolPattern of config.afterTools) {
      if (tool.includes(toolPattern) || toolPattern.includes(tool)) {
        matched = true;
        score += 3;
        break;
      }
    }
    
    // Check patterns in context
    for (const pattern of config.afterPatterns) {
      if (combinedContext.includes(pattern)) {
        score += 2;
      }
    }
    
    if (score > 0) {
      recommendations.push({
        agent: agentName,
        score,
        reason: config.description,
        directMatch: matched
      });
    }
  }
  
  // Sort by score
  recommendations.sort((a, b) => b.score - a.score);
  
  return recommendations;
}

// Check if we're in a completion phase
function isCompletionPhase(recentActions) {
  if (recentActions.length < 3) return false;
  
  const lastActions = recentActions.slice(-5);
  const editCount = lastActions.filter(a => 
    a.tool === 'Edit' || a.tool === 'Write' || a.tool === 'MultiEdit'
  ).length;
  
  // If we've done multiple edits recently, we might be completing a feature
  return editCount >= 3;
}

// Main hook logic
function main() {
  try {
    // Read stdin for tool information
    const input = JSON.parse(fs.readFileSync(0, 'utf-8'));
    const { tool, params, result } = input;
    
    // Load and update recent actions
    const recentActions = loadRecentActions();
    recentActions.push({ tool, timestamp: Date.now() });
    saveRecentActions(recentActions);
    
    // Don't recommend agents after agent tasks
    if (tool === 'Task') {
      process.exit(0);
      return;
    }
    
    // Analyze follow-up needs
    const recommendations = analyzeFollowUp(tool, params, result);
    
    // Check for specific scenarios
    if (tool.includes('Edit') || tool.includes('Write')) {
      const fileChanged = params.file_path || params.path || '';
      
      // If we modified test files, don't suggest test-safety-net
      if (fileChanged.includes('test') || fileChanged.includes('spec')) {
        const testIdx = recommendations.findIndex(r => r.agent === 'test-safety-net');
        if (testIdx >= 0) recommendations.splice(testIdx, 1);
      }
      
      // If we modified a component, suggest UI testing
      if (fileChanged.includes('component') || fileChanged.includes('.tsx') || fileChanged.includes('.jsx')) {
        console.error('\n🎨 UI Component Modified');
        console.error('   Consider: ui-flow-guardian agent for UI validation\n');
      }
    }
    
    // Database changes need special attention
    if (tool.includes('supabase') && tool.includes('sql')) {
      console.error('\n🗄️ Database Change Detected');
      console.error('   Recommended: data-contract-auditor agent to verify permissions\n');
      if (paramsStr.includes('policy')) {
        console.error('   ⚠️ RLS Policy modified - testing critical!\n');
      }
    }
    
    // Deployment actions
    if (tool.includes('heroku') || (tool === 'Bash' && paramsStr.includes('heroku'))) {
      console.error('\n🚀 Deployment Action Detected');
      console.error('   Consider: deploy-pipeline-guardian for production validation\n');
    }
    
    // If we're in completion phase, suggest validation
    if (isCompletionPhase(recentActions)) {
      console.error('\n✅ Feature Implementation Phase Detected');
      console.error('   Suggested agents for validation:');
      console.error('   1. test-safety-net - Create comprehensive tests');
      console.error('   2. acceptance-criteria-validator - Verify requirements met');
      if (recommendations.some(r => r.agent === 'ui-flow-guardian')) {
        console.error('   3. ui-flow-guardian - Test user interface flows');
      }
      console.error('');
    }
    
    // Show top recommendations if high confidence
    if (recommendations.length > 0 && recommendations[0].score >= 4) {
      const top = recommendations[0];
      if (!isCompletionPhase(recentActions)) { // Avoid duplicate messages
        console.error(`\n📋 Post-Action Recommendation: ${top.agent}`);
        console.error(`   Purpose: ${top.reason}\n`);
      }
    }
    
    // Always allow continuation
    process.exit(0);
    
  } catch (error) {
    // On error, log but don't block
    console.error('PostToolUse hook error:', error.message);
    process.exit(0);
  }
}

main();