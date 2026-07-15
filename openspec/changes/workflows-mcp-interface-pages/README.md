# workflows-mcp-interface-pages — build notes + spike results

## Build (2026-07-14) — capture step docs

(`apps/workflows` has no README of its own; this section is task 4.2's home.)

- **`trigger/tasks/_lib/mcp-client.ts`** — `fetchInterfacePages({ baseId, accessToken, endpoint?, timeoutMs?, fetchImpl? })`: one-shot JSON-RPC/Streamable-HTTP exchange (initialize → notifications/initialized → tools/call `list_pages_for_base`). Never throws; every failure maps to `{ ok: false, reason }` (`timeout` | `auth` | `http_<n>` | `invalid_envelope` | `payload_too_large` | `rpc_error` | `no_result` | `transport`). SSE is the primary response path; `Mcp-Session-Id` optional; 2 MB envelope cap; single AbortController covers the whole exchange (default 30s).
- **Capture placement (deviation from design Decision 3, recorded here):** the capture starts right after the token fetch — concurrent with the Airtable *schema* fetch, not the first record export — and is awaited just before the schema-sync POST it rides on. Rationale: `interfacePages` must be IN the schema-sync body, records-sync depends on schema-sync's response, and the engine resolves table/field ids server-side in the same transaction regardless of client timing. Same isolation guarantees, much smaller diff. Happy path still adds ~0s; the failing path adds ≤30s before schema-sync.
- **Failure isolation:** below tier (`interfacesEnabled` false/absent) or no `syncSchema` wired → zero MCP requests. Any skip omits the field from schema-sync entirely (absent ≠ deleted) and reports `result.interfacePages = { status: 'skipped', reason, notice? }` — visible in Trigger.dev run output and forwarded additively on the completion POST (engine-side persistence of the notice is a flagged follow-up). `reason: 'auth'` carries `notice: 'connection_scope'`.
- **Env:** no new required vars. `AIRTABLE_MCP_URL` optionally overrides the MCP endpoint (tests + the 5.3 failure drill — point it at a black hole); unset in production.

## Spike 1.1 results

**Run 2026-07-14 against `https://mcp.airtable.com/mcp` (dev Connection `d0374502…`, token
resolved via the dev engine's ConnectionDO `/token` route, which refreshed and persisted it
through the production refresh path).**

## Verdict: token ACCEPTED — build proceeds (no dark-ship fallback needed)

The Connection's existing Airtable OAuth access token authenticates against the MCP
server as-is. No separate MCP OAuth client/registration is required.

## Accepted scopes

The tested Connection held exactly the standard Baseout grant:

```
data.records:read data.recordComments:read schema.bases:read webhook:manage
```

`initialize`, `tools/list`, and `tools/call list_pages_for_base` all succeeded (200)
with that scope set — **no additional scope is required** for interface-page capture.
(`tools/list` advertises 30 tools including write tools; those were not called and are
presumably scope-gated at call time.)

## Transport observations (bind the client in task 2.1/2.1b)

| Observation | Value | Client consequence |
|---|---|---|
| Server identity | `airtable-mcp-server` v`0.0.1` | envelope-tolerant validation stays justified |
| Negotiated protocol | `2025-06-18` | send it back as `MCP-Protocol-Version` header post-init |
| `Mcp-Session-Id` | **not issued** | the "echo if issued" conditional is load-bearing — don't require it |
| Response encoding | **every** response arrived as `text/event-stream` (even single-message) | SSE parsing (task 2.1b) is the primary path, not an edge case |
| `notifications/initialized` | `202` empty | expect no body |
| Tool result shape | `result.structuredContent` (parsed object) **and** `result.content[0].text` (same JSON as string), `isError: false` | prefer `structuredContent`, fall back to parsing the text part |

`list_pages_for_base` input schema (verbatim from `tools/list`): requires `baseId`
(`^app[A-Za-z0-9]{14}$`); optional `shouldIncludeRecordDetailPages: boolean` adds a
top-level `recordDetailPages` array — we do NOT pass it in V1 (inventory + page
composition only; record-detail expansion is potential follow-up material for
`server-schema-entity-graph`).

## Scrubbed response fixture (empty capture)

All three dev bases have no interfaces; the empty envelope still confirms the top-level
shape the workflows client validates (`interfaces[]`, `standaloneForms[]`):

```jsonc
// tools/call list_pages_for_base { baseId: "appXXXXXXXXXXXXXX" } → result.structuredContent
{
  "interfaces": [],
  "standaloneForms": []
}
```

A populated envelope (interface apps → pages → `tablesByTableId`) is on file in
[design.md](design.md) §Context — owner-verified against a real base. **Follow-up for
task 5.2 staging verification:** create an interface on a dev base so a populated
capture is exercised end-to-end before landing (open question W3 — the shape of
`standaloneForms` entries — also stays open until then).

## Open questions resolved

- **W1 (token accepted? which scopes?):** yes; standard Baseout grant suffices (above).
- **W2 (pagination):** no cursor field observed on empty captures; unresolved for large
  bases — envelope validation will surface a cursor key if one ever appears.
- **W3 (standaloneForms shape):** still open — no populated sample yet (see follow-up).
