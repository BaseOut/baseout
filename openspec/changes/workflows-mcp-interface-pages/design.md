# workflows-mcp-interface-pages — Design

## Context

`backup-base` (apps/workflows, Trigger.dev Node runner) already captures schema via the REST Meta API and POSTs it to the engine's `/api/internal/spaces/:spaceId/schema-sync`, where `schema-diff` + `bo_at_*` persistence live. Interfaces are invisible to the REST API; today `bo_at_interfaces` is fed only by manual submission (`server-automations-interfaces-docs` / `-manual-crud`). Airtable's official MCP server exposes `list_pages_for_base`, and the owner has verified its output shape against a real base:

```jsonc
{
  "interfaces": [
    {
      "id": "pbdXECeOl94vHbpLi",          // Interface app
      "name": "Interface",
      "pages": [
        {
          "id": "pagDbJfEBPEsMIqI6",
          "interfaceId": "pbdXECeOl94vHbpLi",
          "name": "Podcast Roundup 2",
          "pageType": "list",
          "sourceTableId": "tblHr3WJrQiMJu4P5",
          "tablesByTableId": {              // exact tables/fields the page uses
            "tblHr3WJrQiMJu4P5": {
              "id": "tbl…", "name": "Podcast Roundup",
              "fields": [ { "id": "fld…", "name": "Status", "type": "singleSelect", "isEditable": false, "options": { /* … */ } } /* … */ ]
            }
          }
        }
      ]
    }
  ],
  "standaloneForms": []
}
```

Two consequences: (1) this is real backup content — page composition, not just names; (2) `tablesByTableId` is **field→interface dependency data**, the raw material for "this field is used by interface page X" alerts (future consumer: `server-schema-entity-graph`).

## Goals / Non-Goals

**Goals:**
- Every backup run of a base captures its interface apps, pages, and standalone forms automatically when the MCP call succeeds and the Space's tier includes interface backup.
- Capture is best-effort: no MCP failure mode may fail or materially slow the backup run.
- The payload reaches the engine on the existing schema-sync callback (additive field), so diff + persistence happen in one transaction with the same run association.
- The MCP client is a small pure module, testable with mocked HTTP, no SDK dependency.

**Non-Goals:**
- Persistence, diffing, changelog events (server change owns them: [`server-mcp-interface-pages`](../server-mcp-interface-pages/design.md)).
- Dependency-graph edges from `tablesByTableId` (captured in the stored definition; graph extraction is a named follow-up for `server-schema-entity-graph`).
- Restore of interfaces (nothing can write interfaces back — MCP roadmap may change this; out of scope).
- Deprecating manual interface submission (complementary; reconciliation policy lives in the server change).

## Decisions

1. **Direct JSON-RPC over Streamable HTTP, no MCP SDK.** The exchange is three POSTs to `https://mcp.airtable.com/mcp` with `Authorization: Bearer <connection access token>` and `Accept: application/json, text/event-stream`: `initialize` → `notifications/initialized` → `tools/call {name:"list_pages_for_base", arguments:{baseId}}`, echoing the `Mcp-Session-Id` response header (if issued) on every request after `initialize`. **Per the Streamable HTTP transport, any response may arrive as either a single `application/json` body or a `text/event-stream` carrying multiple JSON-RPC messages** (progress/log notifications before the result); the client reads the stream to completion within the timeout, ignores notification frames, and resolves on the message whose `id` matches the request — no incremental consumption is needed because the tool's payload is bounded. A small hand-rolled client beats an SDK dependency in the Node task runner: fewer moving parts, msw-mockable, and we control timeouts. Alternative (official MCP TS SDK) rejected for V1 — resumability and server-initiated-stream abstractions we don't need for a one-shot tool call.
2. **Token reuse, verified by spike before build.** The MCP server authenticates the same Airtable identity; the owner's expectation is our existing Connection OAuth token is accepted. Spike task 1.1 proves it (200 + tool result) and records required scopes in the change README. **Fallback if rejected:** the capture step ships dark (feature-flagged off) and interfaces remain manual-intake-only; nothing else in the backup flow depends on this step.
3. **Placement: after schema capture, before records.** The page payload references table/field ids; capturing after schema means the engine can resolve them against the just-synced working set. The MCP call runs concurrently with the first table's record export (it shares no rate-limit budget with the REST API), with a hard 30s timeout.
4. **Failure isolation contract.** Timeout / 401 / 5xx / malformed payload → log, report `interfacePages: { status: 'skipped', reason }` in run progress, omit the field from schema-sync, continue. A 401 additionally surfaces a `connection-scope` notice on the run so support can see tokens that lack MCP access. Never retried within a run (next backup retries naturally).
5. **Payload passthrough, light normalization.** Workflows does NOT interpret the structure beyond validating the envelope (`interfaces[]`, `standaloneForms[]` arrays exist). It forwards `{ capturedAt, raw }` — the engine owns entity extraction, so payload evolution on Airtable's side lands in one place (server), and the raw capture is preserved verbatim in the per-Space DB.
6. **Tier gate lives in the task payload.** The engine already tells the task what's enabled per run (as with `records_enabled`); an `interfaces_enabled` flag (Growth+, matching `server-automations-interfaces-docs`'s conflict resolution) gates the call. Below tier: skip silently, no progress noise.

## Risks / Trade-offs

- [MCP endpoint/contract is not a published-stable API like REST] → envelope validation + best-effort isolation; monthly canary assertion in tests is impossible against live — instead the spike records a fixture and the client validates only the envelope, tolerating additive change.
- [Token not accepted / needs separate MCP OAuth registration] → spike gates the build; documented dark-ship fallback (Decision 2).
- [Payload size (per-page field lists duplicate schema)] → observed sizes are KBs; envelope capped at 2 MB before forward (truncation → `skipped(reason: 'payload_too_large')`, never partial forward).
- [30s timeout extends run wall-clock] → runs concurrently with record export; worst case adds 0s to happy path, 30s to a failing path.

## Migration Plan

Land [`server-mcp-interface-pages`](../server-mcp-interface-pages/design.md) first (engine accepts + persists the optional field), then this change (task starts sending it). Additive on both sides — either order is safe in production, but server-first makes staging verification cleaner. Rollback: remove the capture step; the engine field is optional.

## Open Questions

| # | Question | Default answer |
|---|---|---|
| W1 | Does the Connection OAuth token authenticate against mcp.airtable.com, and with which scopes? | Spike 1.1 answers; dark-ship fallback if no. |
| W2 | Does `list_pages_for_base` paginate for interface-heavy bases? | Assume no (sample shows inline arrays); envelope validation will catch a cursor field appearing — handle then. |
| W3 | Are `standaloneForms` entries shaped like pages? | Store raw either way; server treats them as pages with `pageType: 'form'` until a real sample says otherwise. |
