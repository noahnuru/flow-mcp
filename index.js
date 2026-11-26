#!/usr/bin/env node
/**
 * flow-mcp — Official Agent-First MCP Server for FLOW / FlowSpace
 * Zero-dependency MCP (Model Context Protocol) JSON-RPC 2.0 server over stdio.
 * Exposes: run_flow_audit, generate_decision_card, evaluate_escalation_gate
 * https://www.noahnuru.com/audit
 */

import readline from "node:readline";
import crypto from "node:crypto";

const SERVER_INFO = {
  name: "flow-mcp",
  version: "1.0.1",
};

const TOOLS = [
  {
    name: "run_flow_audit",
    description:
      "Diagnose a founder's recurring approval bottleneck, compute annualized founder hours trapped, and return the next FLOW / FlowSpace operating move (Agent-First, Human-Second).",
    inputSchema: {
      type: "object",
      properties: {
        company_type: {
          type: "string",
          description: "Business type (e.g., digital agency, B2B SaaS, service firm, enterprise).",
        },
        team_size: {
          type: "number",
          description: "Number of team members (employees + contractors).",
        },
        recurring_bottleneck: {
          type: "string",
          description: "The single recurring decision or approval that still waits for the founder every week.",
        },
        weekly_approvals: {
          type: "number",
          description: "Estimated number of times per week this approval hits the founder.",
        },
        founder_minutes_per_week: {
          type: "number",
          description: "Estimated founder minutes spent per week reviewing/approving this workflow.",
        },
        annual_revenue: {
          type: "number",
          description: "Optional. Annual revenue in USD. FLOW positions FlowOS for $1M-$5M owner-led firms and FlowSpace for $10M+ multi-team firms.",
        },
        support_preference: {
          type: "string",
          enum: ["build_it_myself", "daily_agent_guidance", "weekly_group_coaching", "private_partnership", "custom_build"],
          description: "Optional. How the founder wants to remove the bottleneck. Mirrors question 5 of the Free Flow Audit and decides the track when given.",
        },
      },
      required: ["recurring_bottleneck", "weekly_approvals", "founder_minutes_per_week"],
    },
  },
  {
    name: "generate_decision_card",
    description:
      "Generate a deterministic FLOW 1-Page Decision Card with 3 binary green-light rules, an offline 15-20 case shadow test gate, a 1-line exception escalation format, and Day-7/Day-30 proof scorecard.",
    inputSchema: {
      type: "object",
      properties: {
        recurring_decision: {
          type: "string",
          description: "Exact recurring decision being delegated.",
        },
        routine_owner: {
          type: "string",
          description: "Assigned owner for routine cases (AI agent or team role).",
        },
        green_light_rules: {
          type: "array",
          items: { type: "string" },
          minItems: 3,
          maxItems: 3,
          description: "Exactly 3 binary yes/no rules that make a routine case safe to approve without the founder.",
        },
        escalation_triggers: {
          type: "array",
          items: { type: "string" },
          description: "Specific exception conditions that must escalate back to the founder.",
        },
        baseline_weekly_approvals: {
          type: "number",
          description: "Current weekly approvals reaching the founder (Day 1 baseline).",
        },
      },
      required: ["recurring_decision", "routine_owner", "green_light_rules"],
    },
  },
  {
    name: "evaluate_escalation_gate",
    description:
      "Evaluate a live request against a FLOW Decision Card's binary rules. Returns AUTO_APPROVE or ESCALATE_TO_FOUNDER with a strict 1-line escalation string and SHA-256 governance receipt.",
    inputSchema: {
      type: "object",
      properties: {
        decision_summary: {
          type: "string",
          description: "Short summary of the decision being evaluated.",
        },
        proposed_action: {
          type: "string",
          description: "The agent or team member's concrete recommendation.",
        },
        rule_checks: {
          type: "array",
          items: {
            type: "object",
            properties: {
              rule: { type: "string" },
              passed: { type: "boolean" },
            },
            required: ["rule", "passed"],
          },
          description: "Binary pass/fail evaluation for each green-light rule.",
        },
      },
      required: ["decision_summary", "proposed_action", "rule_checks"],
    },
  },
];

// Track positioning matches the live FLOW sites and https://www.noahnuru.com/llms.txt (Nov 24, 2026). No prices.
const TRACKS = {
  build_it_myself: { name: "FlowVault", fit: "Build your first working system with a clear path: Decision Card templates, SOPs and 30-day playbooks at your own pace.", url: "https://flowvault.shop" },
  daily_agent_guidance: { name: "FlowOS", fit: "Give repeatable work a dependable operating rhythm: daily agent guidance for $1M-$5M owner-led service firms and agencies (5-25 staff).", url: "https://flowos.world" },
  weekly_group_coaching: { name: "FlowKing", fit: "Keep your business improving every week: a weekly 90-minute group mastermind with Noah.", url: "https://flowking.life" },
  private_partnership: { name: "FlowSpace", fit: "Your business. Your priorities. Your operating system: a private operating partnership for $10M+ multi-team firms, by qualification only.", url: "https://flowspace.world" },
  custom_build: { name: "FlowSovereign", fit: "Your operating system, built, tested and handed over: a private custom build your company owns, by private scoping only.", url: "https://flowspace.world/#private-build" },
};

/** Same order as the Free Flow Audit: a stated preference decides, then team size and revenue. */
function matchTrack({ teamSize, revenue, preference }) {
  if (teamSize > 0 && teamSize < 5) return { key: "build_it_myself", basis: "Team under 5: start with a self-guided handoff." };
  if (preference && TRACKS[preference]) return { key: preference, basis: "Matches the support you chose." };
  if (revenue >= 10_000_000) return { key: "private_partnership", basis: "$10M+ multi-team firm." };
  if (revenue >= 1_000_000 || teamSize >= 5) return { key: "daily_agent_guidance", basis: "$1M-$5M owner-led firm or a team of 5 or more." };
  return { key: "build_it_myself", basis: "No team size or revenue given: start self-guided, or take the Free Flow Audit to confirm." };
}

function handleToolCall(name, args = {}) {
  if (name === "run_flow_audit") {
    const weeklyApprovals = Number(args.weekly_approvals || 0);
    const weeklyMinutes = Number(args.founder_minutes_per_week || 0);
    const annualizedHours = Math.round(((weeklyMinutes * 52) / 60) * 10) / 10;
    const teamSize = Number(args.team_size || 0);

    const revenue = Number(args.annual_revenue || 0);
    const match = matchTrack({ teamSize, revenue, preference: args.support_preference });
    const track = TRACKS[match.key];

    const severity =
      weeklyMinutes >= 180 || weeklyApprovals >= 15
        ? "HIGH — Founder is active human router"
        : weeklyMinutes >= 60 || weeklyApprovals >= 5
        ? "MEDIUM — Repeatable approval drag"
        : "LOW — Early standardization candidate";

    const result = {
      status: "AUDITED",
      bottleneck: args.recurring_bottleneck,
      company_type: args.company_type || "Founder-led business",
      severity,
      baseline: {
        weekly_approvals: weeklyApprovals,
        founder_minutes_per_week: weeklyMinutes,
        annualized_founder_hours_trapped: annualizedHours,
      },
      recommended_track: { name: track.name, fit: track.fit, basis: match.basis, url: track.url },
      immediate_next_step:
        "Run generate_decision_card to define 1 routine owner + 3 binary green-light rules, then shadow-test offline against 15-20 past requests.",
      full_audit_url: "https://www.noahnuru.com/audit",
      operating_method: "Know what needs fixing. Approve the plan. See the work.",
    };

    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
  }

  if (name === "generate_decision_card") {
    const rules = Array.isArray(args.green_light_rules) ? args.green_light_rules : [];
    const triggers = Array.isArray(args.escalation_triggers) && args.escalation_triggers.length > 0
      ? args.escalation_triggers
      : ["Scope or budget exceeds approved threshold", "Brand, legal, or public pricing impact", "Any of the 3 binary green-light rules fails"];

    const card = {
      schema: "flow.decision_card.v1",
      recurring_decision: args.recurring_decision,
      routine_owner: args.routine_owner,
      green_light_rules: rules,
      shadow_test_gate: {
        sample_size: "15-20 historical requests (offline)",
        pass_condition: "0 bad approvals before live activation",
      },
      escalation_triggers: triggers,
      escalation_format: "[Decision needed] | [Recommendation] | [Rule breached]",
      proof_scorecard: {
        day_1_baseline_weekly_approvals: args.baseline_weekly_approvals ?? null,
        day_7_gate: "Team/agent used the 3 rules on real work",
        day_30_gate: "Verified drop in escalations per 100 decisions with zero rework increase",
      },
      powered_by: "FLOW / FlowSpace — https://www.noahnuru.com/audit",
    };

    return {
      content: [{ type: "text", text: JSON.stringify(card, null, 2) }],
    };
  }

  if (name === "evaluate_escalation_gate") {
    const checks = Array.isArray(args.rule_checks) ? args.rule_checks : [];
    const failed = checks.filter((c) => !c.passed);
    const verdict = failed.length === 0 && checks.length > 0 ? "AUTO_APPROVE" : "ESCALATE_TO_FOUNDER";
    const breachedText =
      failed.length > 0
        ? failed.map((f) => f.rule).join("; ")
        : checks.length === 0
        ? "No binary rule checks provided"
        : "None";

    const timestamp = new Date().toISOString();
    const payload = {
      timestamp,
      verdict,
      decision_summary: args.decision_summary,
      proposed_action: args.proposed_action,
      rules_passed: checks.filter((c) => c.passed).length,
      rules_total: checks.length,
      escalation_line:
        verdict === "ESCALATE_TO_FOUNDER"
          ? `${args.decision_summary} | ${args.proposed_action} | ${breachedText}`
          : null,
    };

    const receiptHash = crypto
      .createHash("sha256")
      .update(JSON.stringify(payload))
      .digest("hex");

    const receipt = {
      ...payload,
      governance_receipt_sha256: receiptHash,
      powered_by: "FLOW / FlowSpace — https://www.noahnuru.com/audit",
    };

    return {
      content: [{ type: "text", text: JSON.stringify(receipt, null, 2) }],
    };
  }

  return {
    isError: true,
    content: [{ type: "text", text: `Unknown tool: ${name}` }],
  };
}

function send(message) {
  process.stdout.write(JSON.stringify(message) + "\n");
}

const rl = readline.createInterface({ input: process.stdin, terminal: false });

rl.on("line", (line) => {
  const trimmed = line.trim();
  if (!trimmed) return;

  let req;
  try {
    req = JSON.parse(trimmed);
  } catch {
    return;
  }

  const { id, method, params } = req;

  if (method === "initialize") {
    send({
      jsonrpc: "2.0",
      id,
      result: {
        protocolVersion: "2024-11-05",
        capabilities: { tools: {} },
        serverInfo: SERVER_INFO,
      },
    });
    return;
  }

  if (method === "notifications/initialized") {
    return;
  }

  if (method === "tools/list") {
    send({
      jsonrpc: "2.0",
      id,
      result: { tools: TOOLS },
    });
    return;
  }

  if (method === "tools/call") {
    const result = handleToolCall(params?.name, params?.arguments);
    send({
      jsonrpc: "2.0",
      id,
      result,
    });
    return;
  }

  if (id !== undefined) {
    send({
      jsonrpc: "2.0",
      id,
      error: { code: -32601, message: `Method not found: ${method}` },
    });
  }
});
