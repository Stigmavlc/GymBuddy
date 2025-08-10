#!/usr/bin/env node
/**
 * PostToolUse Hook - Post-Implementation Validation
 * Reads stdin JSON from Claude Code and prints follow-up suggestions to stderr.
 * Persists a small rolling log to project dir for lightweight “phase” detection.
 */
const fs = require("fs");
const path = require("path");

// Use project root when available so the log follows the repo
const PROJECT_DIR = process.env.CLAUDE_PROJECT_DIR || process.cwd();
const RECENT_ACTIONS_FILE = path.join(
  PROJECT_DIR,
  ".claude",
  ".recent_actions.json"
);

// Ensure directory exists
try {
  fs.mkdirSync(path.dirname(RECENT_ACTIONS_FILE), { recursive: true });
} catch {}

const POST_ACTION_AGENTS = {
  "test-safety-net": {
    afterTools: ["Edit", "Write", "MultiEdit", "NotebookEdit"],
    afterPatterns: ["function", "class", "component", "service", "api"],
    description: "Create tests for new/modified code",
  },
  "deploy-pipeline-guardian": {
    afterTools: ["mcp__heroku__", "Bash(git push", "Bash(heroku"],
    afterPatterns: ["deploy", "build", "production"],
    description: "Validate deployment & production readiness",
  },
  "ui-flow-guardian": {
    afterTools: ["Edit", "Write"],
    afterPatterns: ["tsx", "jsx", "component", "page", "ui", "style"],
    description: "Verify UI changes and user flows",
  },
  "acceptance-criteria-validator": {
    afterTools: ["Task"],
    afterPatterns: ["complete", "finished", "done", "implemented"],
    description: "Validate feature meets requirements",
  },
  "data-contract-auditor": {
    afterTools: [
      "mcp__supabase__execute_sql",
      "mcp__supabase__apply_migration",
    ],
    afterPatterns: ["table", "policy", "migration", "schema"],
    description: "Audit DB changes and permissions",
  },
  "state-architect": {
    afterTools: ["Edit", "Write"],
    afterPatterns: ["usestate", "usereducer", "context", "redux", "store"],
    description: "Review state management implementation",
  },
  "debug-visibility-engineer": {
    afterTools: ["Edit", "Write"],
    afterPatterns: ["error", "catch", "try", "debug", "console"],
    description: "Enhance error handling and logging",
  },
};

function loadRecentActions() {
  try {
    if (fs.existsSync(RECENT_ACTIONS_FILE)) {
      return JSON.parse(fs.readFileSync(RECENT_ACTIONS_FILE, "utf8"));
    }
  } catch {}
  return [];
}

function saveRecentActions(actions) {
  try {
    fs.writeFileSync(
      RECENT_ACTIONS_FILE,
      JSON.stringify(actions.slice(-20), null, 2)
    );
  } catch {}
}

function analyzeFollowUp(toolName, params, result) {
  const recs = [];
  const t = (toolName || "").toLowerCase();
  const ps = JSON.stringify(params || {}).toLowerCase();
  const rs = JSON.stringify(result || {}).toLowerCase();
  const ctx = `${t} ${ps} ${rs}`;

  for (const [agent, cfg] of Object.entries(POST_ACTION_AGENTS)) {
    let score = 0;
    let directMatch = false;

    for (const pat of cfg.afterTools) {
      if (toolName.includes(pat) || pat.includes(toolName)) {
        directMatch = true;
        score += 3;
        break;
      }
    }
    for (const pat of cfg.afterPatterns) if (ctx.includes(pat)) score += 2;

    if (score > 0)
      recs.push({ agent, score, reason: cfg.description, directMatch });
  }
  recs.sort((a, b) => b.score - a.score);
  return recs;
}

function isCompletionPhase(recent) {
  if (recent.length < 3) return false;
  const last = recent.slice(-5);
  const editCount = last.filter((a) =>
    ["Edit", "Write", "MultiEdit"].includes(a.tool)
  ).length;
  return editCount >= 3;
}

function main() {
  try {
    const input = JSON.parse(fs.readFileSync(0, "utf8"));

    // Support both canonical and legacy field names defensively
    const toolName = input.tool_name || input.tool || "";
    const params = input.tool_input || input.params || {};
    const result = input.tool_response || input.result || {};

    const recent = loadRecentActions();
    recent.push({ tool: toolName, timestamp: Date.now() });
    saveRecentActions(recent);

    if (toolName === "Task") process.exit(0); // Don’t recommend after subagent “Task”

    const recs = analyzeFollowUp(toolName, params, result);

    // Extra hints for certain classes of changes
    const fileChanged = (params.file_path || params.path || "").toString();
    if (["Edit", "Write", "MultiEdit"].some((n) => toolName.includes(n))) {
      if (/\b(test|spec)\b/i.test(fileChanged)) {
        // If we modified tests, remove “test-safety-net”
        const i = recs.findIndex((r) => r.agent === "test-safety-net");
        if (i >= 0) recs.splice(i, 1);
      }
      if (/\.(tsx|jsx)$/.test(fileChanged) || /component/i.test(fileChanged)) {
        console.error("\n🎨 UI Component Modified");
        console.error(
          "   Consider: ui-flow-guardian agent for UI validation\n"
        );
      }
    }

    // Database & deploy signals
    const ps = JSON.stringify(params).toLowerCase();
    if (
      toolName.includes("supabase") &&
      /sql|apply_migration|execute_sql/i.test(toolName)
    ) {
      console.error("\n🗄️ Database Change Detected");
      console.error(
        "   Recommended: data-contract-auditor agent to verify permissions\n"
      );
      if (ps.includes("policy"))
        console.error("   ⚠️ RLS Policy modified - testing critical!\n");
    }
    if (
      toolName.includes("heroku") ||
      (toolName === "Bash" && ps.includes("heroku"))
    ) {
      console.error("\n🚀 Deployment Action Detected");
      console.error(
        "   Consider: deploy-pipeline-guardian for production validation\n"
      );
    }

    // Completion phase suggestions
    if (isCompletionPhase(recent)) {
      console.error("\n✅ Feature Implementation Phase Detected");
      console.error("   Suggested agents for validation:");
      console.error("   1. test-safety-net - Create comprehensive tests");
      console.error(
        "   2. acceptance-criteria-validator - Verify requirements met"
      );
      if (recs.some((r) => r.agent === "ui-flow-guardian")) {
        console.error("   3. ui-flow-guardian - Test user interface flows");
      }
      console.error("");
    }

    if (recs.length && recs[0].score >= 4 && !isCompletionPhase(recent)) {
      const top = recs[0];
      console.error(`\n📋 Post-Action Recommendation: ${top.agent}`);
      console.error(`   Purpose: ${top.reason}\n`);
    }

    process.exit(0);
  } catch (e) {
    console.error("PostToolUse hook error:", e.message);
    process.exit(0);
  }
}
main();
