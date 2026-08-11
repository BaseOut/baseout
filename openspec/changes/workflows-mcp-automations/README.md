# workflows-mcp-automations — spike results + build notes

## Build (2026-07-24) — capture step docs

- **`_lib/mcp-client.ts`** refactored: a shared `callMcpTool({ tool, toolArgs, accessToken, endpoint?, timeoutMs?, fetchImpl? })` core owns the Streamable-HTTP/SSE exchange; `fetchInterfacePages` (behavior-identical — its 15 tests pass unmodified) and the new `fetchAutomations` (tool `list_automations`, validates `automations[]`) are thin wrappers. Failure taxonomy unchanged and shared (`McpSkipReason`; `InterfacePagesSkipReason` kept as an alias).
- **Capture placement:** step 2c in `runBackupBase`, the twin of the interface capture's 2b — kicked off concurrently with the schema fetch, awaited just before the schema-sync POST, attached as the optional `automations` body field (4th `syncSchema` arg) only on `ok`. The two captures are independent; either can fail without touching the other or the run.
- **Failure isolation:** below tier / flag absent / no `syncSchema` → zero MCP requests. Any skip omits the field (absent ≠ deleted) and reports `result.automations = { status:'skipped', reason, notice? }` — in Trigger.dev run output and forwarded additively on the completion POST. `reason:'auth'` carries `notice:'connection_scope'`.
- **Env:** none new — `AIRTABLE_MCP_URL` override applies to both captures (they share the endpoint).
- **Tests:** 20 new (10 client + 10 orchestration); suite 297 green + tsc clean.

## Spike 1.1 results

**Run 2026-07-24 against `https://mcp.airtable.com/mcp` (dev Connection `d0374502…`, token
resolved via the dev engine's ConnectionDO `/token` route — same method as the
interface-pages spike).**

## Verdict: automations tools EXIST for the standard grant — build proceeds

`tools/list` now advertises **41 tools** (30 on 2026-07-14 — the automations suite is new),
including the two read tools we need:

- **`list_automations`** — "Returns metadata about each automation including its ID, name,
  deployment status, trigger info, and graph nodes." Args: `baseId` (required,
  `^app[A-Za-z0-9]{14}$`), `triggerType` (optional enum filter — 20 trigger types incl.
  `recordEntersView`, `cron`, `genericWebhookReceived`, `rowCommentCreated`, `agentTriggerReceived`).
- **`get_automation`** — "full configuration of a single automation … trigger configuration,
  action nodes with their input expressions, and deployment status." Args: `baseId` +
  `automationId` (`^wfl[A-Za-z0-9]{14}$`).

Write tools also exist (`create_automation`, `update_automation`, `delete_automation`,
`fetch_automation_input_data`, `get_create_automation_instructions`) — not called, not used.

Auth: the same Connection token that passed the interfaces spike called `list_automations`
successfully on all three dev bases (`isError: false`) — **no additional scope required**
(grant: `data.records:read data.recordComments:read schema.bases:read webhook:manage`).
Transport facts unchanged from the 2026-07-14 spike (SSE-primary, no `Mcp-Session-Id`,
`structuredContent` + `content[0].text` duplication).

## Envelope fixture (empty capture)

All three dev bases have zero automations; the empty envelope pins the top-level shape:

```jsonc
// tools/call list_automations { baseId: "appXXXXXXXXXXXXXX" } → result.structuredContent
{
  "automations": []
}
```

**Automation id prefix is `wfl…`** (from `get_automation`'s input schema).

**Pending (task 1.2 / 5.2):** a populated envelope needs an automation created on a dev
base (owner action — test/demo workspaces, action-plan §4). The per-entry shape
(`id`, `name`, deployment status, trigger info, graph nodes — exact key names) is
therefore UNVERIFIED; extraction must stay envelope-tolerant and key off `id`/`name`
leniently until the populated fixture lands.

## V1 capture decision (updates design Open Q2)

V1 calls **`list_automations` only** — one bounded call per base, and its envelope already
carries deployment status + trigger info + graph nodes (more than inventory). A
per-automation `get_automation` fan-out (input expressions) is deliberately deferred:
it's O(automations) extra calls for delta-detail the changelog doesn't need yet. If
customers want input-expression diffs, that's a follow-up change.

## Also observed (for `workflows-comments`)

`tools/list` includes **`list_record_comments`** — an MCP path to comments exists. The
comments pair stays on the REST endpoint (bulk-friendly, pagination documented, and the
scope is already granted), but the MCP alternative is on file if REST fan-out proves
painful.
