# workflows-mcp-automations — Design

## Decision 1 — Reuse `_lib/mcp-client.ts` by extracting a shared `tools/call` core

`fetchInterfacePages` already owns the full Streamable-HTTP exchange (initialize → optional `Mcp-Session-Id` → `notifications/initialized` → `tools/call`), SSE frame parsing, timeout via a single AbortController, and the 2 MB cap. Refactor it into a generic `callMcpTool({ tool, args, accessToken, endpoint, timeoutMs })` core with two thin typed wrappers: `fetchInterfacePages` (existing envelope validation, unchanged behavior — its 15 tests must stay green untouched) and `fetchAutomations` (envelope validation per the spike's fixture). No MCP SDK dependency, same injected-`fetchImpl` testability.

**Rejected:** a second parallel client (duplicates the SSE/session subtleties that took a spike to get right); depending on `@modelcontextprotocol/sdk` (heavier than the two tools we call, and the existing client is proven against the real endpoint).

## Decision 2 — Capture concurrently with schema fetch, ride schema-sync

Same deviation the interface capture landed on (recorded in that change's README): the capture runs concurrently with the Airtable SCHEMA fetch because its output must be in the schema-sync body, which records-sync depends on. `automations: { capturedAt, raw }` is attached to the schema-sync POST only on `ok`. One MCP handshake can serve both `tools/call`s in a run (interface pages + automations) if the spike confirms the server tolerates sequential calls on one exchange; otherwise two independent exchanges — correctness first, the extra handshake is cheap.

## Decision 3 — Unknown envelope → spike-gated validation, verbatim forwarding

Workflows validates only the envelope's top-level shape (whatever the spike documents — parallel to `interfaces[]`/`standaloneForms[]`) and forwards `raw` verbatim. All normalization/diffing intelligence lives server-side (`server-mcp-automations`), so an Airtable-side envelope enrichment never requires a workflows redeploy.

## Decision 4 — Failure taxonomy is copied, not shared

`skipped(timeout|transport|auth|invalid_envelope|oversized)` — the same reasons the interface capture reports. 401 additionally emits the connection-scope notice on the run (same as interfaces). Kept as parallel constants rather than a shared module until a third capture kind exists (YAGNI, CLAUDE.md §3.2).

## Open questions (spike resolves)

1. Tool name + arg shape (`list_automations_for_base`? args `{ baseId }`?) — from `tools/list`.
2. Envelope: inventory-only vs full definitions (trigger/action config, script bodies)? Determines the server change's diff granularity (Decision 3 there).
3. Does the standard grant (`data.records:read data.recordComments:read schema.bases:read webhook:manage`) unlock the tool, or does it need a scope we don't request? If a new scope: STOP — scope additions force customer re-consent; surface before building (action-plan §2).
4. Payload size for automation-heavy bases — is 2 MB still the right cap?
