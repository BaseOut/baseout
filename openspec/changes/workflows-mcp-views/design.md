# workflows-mcp-views — Design

## Decision 1 — Mode flag from the engine, not client-side inference

Workflows can't know a connection's enterprise scope; the engine already resolves it per run (`resolveViewCaptureForRun`). The payload's `viewCaptureMode: 'rest' | 'mcp' | 'off'` keeps the decision where the data lives: `'rest'` → today's behavior exactly (REST schema carries views; no MCP call); `'mcp'` → MCP call + optional `views` field on schema-sync; `'off'` → nothing. Tier gating folds into the same flag server-side.

## Decision 2 — Ride schema-sync, same as the other captures

Views are schema. Capture runs concurrently with the schema fetch; `views: { capturedAt, raw }` attaches only on `ok`. One MCP handshake can serve all three `tools/call`s per run where the server tolerates it (established by the automations change); otherwise independent exchanges.

## Decision 3 — Extract shared skip-reason constants now

The automations design kept failure taxonomies parallel "until a third capture kind exists." Views are the third: extract the `skipped(timeout|transport|auth|invalid_envelope|oversized)` constants + progress-reporting helper into `_lib/mcp-capture-common.ts`, consumed by all three wrappers. Behavior of the existing two must not change (their tests stay green untouched).

## Decision 4 — Verbatim forwarding, envelope validated at top level only

Same as automations: workflows validates only the spike-documented top-level shape and forwards `raw`; all normalization/diff intelligence is server-side so envelope enrichment (e.g. Airtable later adding view config) never requires a workflows redeploy.

## Open questions (spike resolves)

1. Tool name + args.
2. Envelope depth: id/name/type only, or configuration (filters/sorts/visibility)? Drives the server change's config-diff branch.
3. Payload size on view-heavy bases (100+ views) vs the 2 MB cap.
4. Does one handshake serve three sequential `tools/call`s reliably?
