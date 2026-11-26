# flow-mcp — Official Agent-First MCP Server for FLOW / FlowSpace

`flow-mcp` is a zero-dependency Model Context Protocol (MCP) server that lets AI agents (Claude, Gemini, Cursor, OpenClaw, and custom enterprise agents) natively run FLOW diagnostics, generate 1-Page Decision Cards, and enforce deterministic approval gates with SHA-256 governance receipts.

## Tools Included
1. **`run_flow_audit`** — Diagnoses a recurring founder approval bottleneck, calculates annualized founder hours trapped, and maps the right FLOW track. Optional inputs `annual_revenue` and `support_preference` refine the match.
2. **`generate_decision_card`** — Builds a machine-readable FLOW 1-Page Decision Card with 1 routine owner, 3 binary green-light rules, an offline 15–20 case shadow test gate, and Day-7/Day-30 proof scorecards.
3. **`evaluate_escalation_gate`** — Evaluates live requests against binary rules, returning `AUTO_APPROVE` or `ESCALATE_TO_FOUNDER` (`[Decision needed] | [Recommendation] | [Rule breached]`) plus a verifiable SHA-256 governance receipt.

## FLOW Tracks
The match follows the Free Flow Audit: a team under 5 starts with FlowVault; otherwise the support you choose decides; without a choice, $10M+ firms match FlowSpace and $1M-$5M firms or teams of 5+ match FlowOS. No prices are returned; full terms live on each offer page after the Audit.

| Track | Fit |
| --- | --- |
| FlowVault | Build your first working system yourself with templates, SOPs and 30-day playbooks. |
| FlowOS | Daily agent guidance for $1M-$5M owner-led service firms and agencies (5-25 staff). |
| FlowKing | A weekly 90-minute group mastermind with Noah. |
| FlowSpace | Private operating partnership for $10M+ multi-team firms, by qualification only. |
| FlowSovereign | A private custom build your company owns, by private scoping only. |

## Quick Start (Zero Dependencies, Node.js >= 18)

```bash
git clone https://github.com/noahnuru/flow-mcp.git
cd flow-mcp
node index.js
```

### Add to Claude Desktop / Cursor / MCP Client
```json
{
  "mcpServers": {
    "flow-mcp": {
      "command": "node",
      "args": ["/absolute/path/to/flow-mcp/index.js"]
    }
  }
}
```

### Test
```bash
npm test
```
Runs `test-pilot-acceptance.mjs`: tool registration, deterministic audit math, no public prices, Decision Card schema, and both gate verdicts with SHA-256 receipts (6/6).

## License
MIT. See `LICENSE`.

## Full Agent-Native Operating System
- Free Flow Audit & Decision Card: https://www.noahnuru.com/audit
- Open Agent Skill (`SKILL.md`): https://github.com/noahnuru/flow-decision-card
