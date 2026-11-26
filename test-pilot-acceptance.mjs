#!/usr/bin/env node
/**
 * FLOW Pilot Acceptance Test Suite (Claude + Cursor Supported Environments)
 * Verifies deterministic state, schema fidelity, SHA-256 receipts, and zero pricing leaks.
 */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";

const requests = [
  { jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2024-11-05", capabilities: {}, clientInfo: { name: "pilot-qa", version: "1.0" } } },
  { jsonrpc: "2.0", id: 2, method: "tools/list", params: {} },
  { jsonrpc: "2.0", id: 3, method: "tools/call", params: { name: "run_flow_audit", arguments: { company_type: "digital agency", team_size: 14, recurring_bottleneck: "Client kickoff approval", weekly_approvals: 12, founder_minutes_per_week: 210 } } },
  { jsonrpc: "2.0", id: 4, method: "tools/call", params: { name: "generate_decision_card", arguments: { recurring_decision: "Client kickoff approval", routine_owner: "Account Lead", green_light_rules: ["Matches SOW", "Margin >= 55%", "Within SLA"], baseline_weekly_approvals: 12 } } },
  { jsonrpc: "2.0", id: 5, method: "tools/call", params: { name: "evaluate_escalation_gate", arguments: { decision_summary: "Routine kickoff", proposed_action: "Approve", rule_checks: [{ rule: "Matches SOW", passed: true }, { rule: "Margin >= 55%", passed: true }, { rule: "Within SLA", passed: true }] } } },
  { jsonrpc: "2.0", id: 6, method: "tools/call", params: { name: "evaluate_escalation_gate", arguments: { decision_summary: "Discounted kickoff", proposed_action: "Approve w/ 15% rush fee", rule_checks: [{ rule: "Matches SOW", passed: true }, { rule: "Margin >= 55%", passed: false }, { rule: "Within SLA", passed: true }] } } },
];

const proc = spawnSync("node", ["index.js"], {
  input: requests.map((r) => JSON.stringify(r)).join("\n") + "\n",
  encoding: "utf8",
});

assert.equal(proc.status, 0, `flow-mcp exited non-zero: ${proc.stderr}`);
const responses = proc.stdout.trim().split("\n").map((l) => JSON.parse(l));
assert.equal(responses.length, 6, "Expected 6 JSON-RPC responses");

// Gate 1: Tools registered
const tools = responses[1].result.tools.map((t) => t.name);
assert.deepEqual(tools, ["run_flow_audit", "generate_decision_card", "evaluate_escalation_gate"]);

// Gate 2: Audit deterministic math & zero public pricing leak
const audit = JSON.parse(responses[2].result.content[0].text);
assert.equal(audit.baseline.annualized_founder_hours_trapped, 182);
// A price is a dollar amount, with optional thousands separators and cents.
// A trailing magnitude letter marks a revenue band, not a price.
const dollarPrice = /\$(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?(?![.\dA-Za-z])/;
assert.ok(!dollarPrice.test(responses[2].result.content[0].text), "CANON A43 violation: public tier price leaked");

// Gate 3: Decision Card schema & 3 binary rules
const card = JSON.parse(responses[3].result.content[0].text);
assert.equal(card.schema, "flow.decision_card.v1");
assert.equal(card.green_light_rules.length, 3);

// Gate 4: Auto-approve vs Escalate + 64-char SHA-256 governance receipt
const passRes = JSON.parse(responses[4].result.content[0].text);
assert.equal(passRes.verdict, "AUTO_APPROVE");
assert.equal(passRes.escalation_line, null);
assert.match(passRes.governance_receipt_sha256, /^[a-f0-9]{64}$/);

const failRes = JSON.parse(responses[5].result.content[0].text);
assert.equal(failRes.verdict, "ESCALATE_TO_FOUNDER");
assert.equal(failRes.escalation_line, "Discounted kickoff | Approve w/ 15% rush fee | Margin >= 55%");
assert.match(failRes.governance_receipt_sha256, /^[a-f0-9]{64}$/);

console.log("ALL 4 PILOT ACCEPTANCE GATES PASSED (6/6 assertions green)");
