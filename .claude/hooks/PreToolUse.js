#!/usr/bin/env node
/**
 * PreToolUse Hook - Intelligent Agent Selection
 * Reads stdin JSON from Claude Code and prints advisory to stderr.
 * Never blocks (exit 0). Safe to evolve later to exit(2) for blocking.
 */
const fs = require("fs");

const AGENT_SPECIALIZATIONS = {
  "debug-orchestrator": {
    triggers: ["debug", "error", "bug", "issue", "crash", "failing", "broken"],
    tools: ["Bash", "Read", "Grep", "WebFetch"],
    description: "Systematic debugging and issue analysis",
  },
  "debug-visibility-engineer": {
    triggers: ["log", "trace", "monitor", "visibility", "telemetry", "console"],
    tools: ["Edit", "Write", "MultiEdit"],
    description: "Add logging and debugging instrumentation",
  },
  "data-contract-auditor": {
    triggers: [
      "database",
      "rls",
      "policy",
      "permission",
      "access",
      "supabase",
      "sql",
    ],
    tools: [
      "mcp__supabase__execute_sql",
      "mcp__supabase__list_tables",
      "mcp__supabase__get_logs",
    ],
    description: "Database permissions and RLS policy analysis",
  },
  "deploy-pipeline-guardian": {
    triggers: ["deploy", "heroku", "build", "production", "environment"],
    tools: ["mcp__heroku__", "Bash(heroku", "Bash(git push"],
    description: "Deployment & production env management",
  },
  "state-architect": {
    triggers: ["state", "redux", "context", "usestate", "render", "update"],
    tools: ["Edit", "Read"],
    description: "React state management issues",
  },
  "realtime-sync-architect": {
    triggers: ["realtime", "sync", "websocket", "subscription", "update"],
    tools: ["Edit", "mcp__supabase__"],
    description: "Realtime data synchronization",
  },
  "test-safety-net": {
    triggers: ["test", "spec", "jest", "vitest", "coverage"],
    tools: ["Write", "Bash(npm test", "Bash(npm run test"],
    description: "Test creation and maintenance",
  },
  "ui-flow-guardian": {
    triggers: [
      "ui",
      "interface",
      "component",
      "layout",
      "style",
      "css",
      "tsx",
      "jsx",
    ],
    tools: ["Edit", "Write", "mcp__browsermcp__"],
    description: "UI/UX validation and testing",
  },
  "data-sync-orchestrator": {
    triggers: ["fetch", "api", "cache", "stale", "refresh"],
    tools: ["Edit", "WebFetch"],
    description: "Data fetching & caching strategies",
  },
};

function analyzeTask(toolName, params) {
  const recommendations = [];
  const t = (toolName || "").toLowerCase();
  const p = JSON.stringify(params || {}).toLowerCase();
  const context = `${t} ${p}`;

  for (const [agent, cfg] of Object.entries(AGENT_SPECIALIZATIONS)) {
    let score = 0;
    for (const trig of cfg.triggers) if (context.includes(trig)) score += 2;
    for (const tp of cfg.tools)
      if (toolName.includes(tp) || tp.includes(toolName)) score += 1;
    if (score > 0)
      recommendations.push({ agent, score, reason: cfg.description });
  }
  recommendations.sort((a, b) => b.score - a.score);
  return recommendations;
}

function main() {
  try {
    const input = JSON.parse(fs.readFileSync(0, "utf8"));
    const toolName = input.tool_name || input.tool || "";
    const params = input.tool_input || input.params || {};

    // Never recommend agents after Task (subagent) calls
    if (toolName === "Task") process.exit(0);

    const recs = analyzeTask(toolName, params);
    if (recs.length && recs[0].score >= 3) {
      const top = recs[0];
      const conf = top.score > 5 ? "High" : top.score > 3 ? "Medium" : "Low";
      console.error(`\n💡 Agent Recommendation: Consider using ${top.agent}`);
      console.error(`   Reason: ${top.reason}`);
      console.error(`   Confidence: ${conf}\n`);
      if (recs[1] && recs[1].score >= 3) {
        console.error(`   Alternative: ${recs[1].agent} (${recs[1].reason})\n`);
      }
    }

    // Example special case: warn on suspected RLS recursion
    const ps = JSON.stringify(params).toLowerCase();
    if (toolName.includes("supabase") && ps.includes("infinite recursion")) {
      console.error("\n🚨 CRITICAL: RLS policy issue suspected!");
      console.error("   Strongly recommend data-contract-auditor agent\n");
    }

    process.exit(0);
  } catch (e) {
    console.error("PreToolUse hook error:", e.message);
    process.exit(0);
  }
}
main();
