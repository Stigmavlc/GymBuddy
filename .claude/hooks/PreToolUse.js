#!/usr/bin/env node

/**
 * PreToolUse Hook - Intelligent Agent Selection
 * This hook analyzes incoming tool calls and suggests appropriate agents
 * to help with the specific task at hand.
 */

const fs = require('fs');
const path = require('path');

// Agent specializations mapping
const AGENT_SPECIALIZATIONS = {
  'debug-orchestrator': {
    triggers: ['debug', 'error', 'bug', 'issue', 'crash', 'failing', 'broken'],
    tools: ['Bash', 'Read', 'Grep', 'WebFetch'],
    description: 'Systematic debugging and issue analysis'
  },
  'debug-visibility-engineer': {
    triggers: ['log', 'trace', 'monitor', 'visibility', 'telemetry', 'console'],
    tools: ['Edit', 'Write', 'MultiEdit'],
    description: 'Adding logging and debugging infrastructure'
  },
  'data-contract-auditor': {
    triggers: ['database', 'rls', 'policy', 'permission', 'access', 'supabase', 'sql'],
    tools: ['mcp__supabase__execute_sql', 'mcp__supabase__list_tables', 'mcp__supabase__get_logs'],
    description: 'Database permissions and RLS policy analysis'
  },
  'deploy-pipeline-guardian': {
    triggers: ['deploy', 'heroku', 'build', 'production', 'environment'],
    tools: ['mcp__heroku__', 'Bash(heroku', 'Bash(git push'],
    description: 'Deployment and production environment management'
  },
  'state-architect': {
    triggers: ['state', 'redux', 'context', 'useState', 'render', 'update'],
    tools: ['Edit', 'Read'],
    description: 'React state management issues'
  },
  'realtime-sync-architect': {
    triggers: ['realtime', 'sync', 'websocket', 'subscription', 'update'],
    tools: ['Edit', 'mcp__supabase__'],
    description: 'Real-time data synchronization'
  },
  'test-safety-net': {
    triggers: ['test', 'spec', 'jest', 'vitest', 'coverage'],
    tools: ['Write', 'Bash(npm test', 'Bash(npm run test'],
    description: 'Test creation and maintenance'
  },
  'ui-flow-guardian': {
    triggers: ['ui', 'interface', 'component', 'layout', 'style', 'css'],
    tools: ['Edit', 'Write', 'mcp__browsermcp__'],
    description: 'UI/UX validation and testing'
  },
  'data-sync-orchestrator': {
    triggers: ['fetch', 'api', 'cache', 'stale', 'refresh'],
    tools: ['Edit', 'WebFetch'],
    description: 'Data fetching and caching strategies'
  }
};

// Analyze the incoming tool and parameters
function analyzeTask(toolName, params) {
  const recommendations = [];
  
  // Convert tool name and params to lowercase for matching
  const toolLower = toolName.toLowerCase();
  const paramsStr = JSON.stringify(params).toLowerCase();
  const combinedContext = `${toolLower} ${paramsStr}`;
  
  // Check each agent's triggers and tools
  for (const [agentName, config] of Object.entries(AGENT_SPECIALIZATIONS)) {
    let score = 0;
    
    // Check if any triggers match
    for (const trigger of config.triggers) {
      if (combinedContext.includes(trigger)) {
        score += 2;
      }
    }
    
    // Check if the tool matches agent's typical tools
    for (const toolPattern of config.tools) {
      if (toolName.includes(toolPattern) || toolPattern.includes(toolName)) {
        score += 1;
      }
    }
    
    if (score > 0) {
      recommendations.push({
        agent: agentName,
        score,
        reason: config.description
      });
    }
  }
  
  // Sort by score
  recommendations.sort((a, b) => b.score - a.score);
  
  return recommendations;
}

// Main hook logic
function main() {
  try {
    // Read stdin for tool information
    const input = JSON.parse(fs.readFileSync(0, 'utf-8'));
    const { tool, params } = input;
    
    // Special case: Task tool should not trigger agent recommendations
    if (tool === 'Task') {
      process.exit(0);
      return;
    }
    
    // Analyze the task
    const recommendations = analyzeTask(tool, params);
    
    // If we have strong recommendations, suggest using agents
    if (recommendations.length > 0 && recommendations[0].score >= 3) {
      const topAgent = recommendations[0];
      
      // Log recommendation to stderr (visible to user)
      console.error(`\n💡 Agent Recommendation: Consider using ${topAgent.agent} agent`);
      console.error(`   Reason: ${topAgent.reason}`);
      console.error(`   Confidence: ${topAgent.score > 5 ? 'High' : topAgent.score > 3 ? 'Medium' : 'Low'}\n`);
      
      // Additional agents if relevant
      if (recommendations.length > 1 && recommendations[1].score >= 3) {
        console.error(`   Alternative: ${recommendations[1].agent} (${recommendations[1].reason})\n`);
      }
    }
    
    // Check for specific high-priority scenarios
    if (tool.includes('supabase') && paramsStr.includes('infinite recursion')) {
      console.error('\n🚨 CRITICAL: RLS policy issue detected!');
      console.error('   Strongly recommend using data-contract-auditor agent\n');
    }
    
    if (tool.includes('heroku') && paramsStr.includes('failed')) {
      console.error('\n⚠️ Deployment issue detected!');
      console.error('   Consider using deploy-pipeline-guardian agent\n');
    }
    
    // Always allow the tool to proceed
    process.exit(0);
    
  } catch (error) {
    // On error, log but don't block
    console.error('PreToolUse hook error:', error.message);
    process.exit(0);
  }
}

main();