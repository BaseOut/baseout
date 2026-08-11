# server-mcp-workspaces — spike results (task 0.2)

**Run 2026-07-27 against `https://mcp.airtable.com/mcp`** (dev Connection `d0374502…`,
non-enterprise, token resolved via the dev engine's ConnectionDO token route — same
drill as the interface-pages/automations spikes). Script: [`spike.mjs`](spike.mjs)
(shared with the `workflows-mcp-views` spike — one session answered both).

## Verdict: tool EXISTS but the standard grant is REFUSED — STOP, scope decision needed

`tools/list` advertises **`list_workspaces`** ("Lists all workspaces the current user
has access to, along with their permission level in each. … This is typically the
first tool to call when you need a workspaceId."), input schema = optional pagination
`offset` only. But `tools/call list_workspaces {}` returns **HTTP 403
`{"error":"FORBIDDEN"}`** with the standard Baseout grant
(`data.records:read data.recordComments:read schema.bases:read webhook:manage`).

The missing scope is almost certainly **`workspacesAndBases:read`** — "View metadata
about workspaces, bases, and views" — which Airtable's scopes reference lists as a
**basic** (non-enterprise) OAuth scope. It has never been part of Baseout's Connect
grant. This is the exact STOP condition in `tasks.md` 0.2 / design open question 2:
**adding a scope means re-consent for every existing Connection** — a product
decision, surfaced rather than built around.

### What adding the scope would mean

- New Connects get workspace listing immediately.
- Existing Connections keep working for everything else but return `auth` on the
  workspace route until the customer reconnects — workspace grouping and auto-enroll
  must degrade per-connection (flat picker, no auto-enroll, "reconnect to enable"
  affordance), which `web-workspace-bases` Decision 5 (nullable-first, never blocking)
  already anticipates.
- The OAuth consent screen gains one line ("view metadata about workspaces, bases,
  and views") — low friction.

### Cheap de-risk before committing (recommended)

A **personal access token** created at airtable.com/create/tokens with
`workspacesAndBases:read` (+ `schema.bases:read`) can be pointed at the MCP server /
REST to confirm, in minutes, without touching the OAuth app:

1. `list_workspaces` actually succeeds with the scope (and its **envelope shape** —
   see below).
2. Whether base→workspace **membership** is derivable (from the `list_workspaces`
   envelope, or from REST `GET /v0/meta/bases` gaining workspace info under the
   scope).

## Base→workspace membership: still OPEN (403 hid the envelope)

Design open question 1 (workspaces-only vs base membership) could not be resolved —
the 403 arrived before any envelope. Two secondary findings bound it:

- The tool description mentions workspaces + permission level, NOT bases.
- **`list_bases` (works fine on the standard grant) carries NO workspace id**:

```jsonc
// tools/call list_bases {} → result.structuredContent (516 bytes, dev account)
{
  "bases": [
    { "id": "appXXXXXXXXXXXXXX", "name": "…", "permissionLevel": "create", "isFavorite": false },
    { "id": "appYYYYYYYYYYYYYY", "name": "…", "permissionLevel": "create", "isFavorite": false,
      "recentlyViewedTimestamp": "2026-06-09T19:39:33.813Z" }
  ]
}
```

So with today's grant there is **no path to workspace identity at all** — neither the
workspace list nor a per-base workspace stamp. The PAT probe above resolves the
mapping question the moment a scope-bearing token exists.

## Transport notes (same session as the views spike)

- Server `airtable-mcp-server v0.0.1`, protocol `2025-06-18`, `Mcp-Session-Id` not
  issued, every response SSE — all unchanged from the 2026-07-24 automations spike.
- `tools/list` = **41 tools** (~235 KB), same inventory as 2026-07-24.
- **11 sequential `tools/call`s on ONE initialize handshake all succeeded** —
  including calls that 403'd mid-session (the session survives tool-level denials).
- A tool-level scope denial surfaces as a **transport-level HTTP 403** (not a JSON-RPC
  `isError`) — the engine's ported client must map it to `auth` exactly as
  `callMcpTool` does today.

## Impact on this change + `web-workspace-bases`

Both changes are **gated on the scope decision** (Dan): add `workspacesAndBases:read`
to the Connect app (re-consent rollout), or shelve workspace features. The schema and
API work in `web-workspace-bases` is sound either way but pointless to land before
the decision. If the scope is added, re-run `spike.mjs` on a reconsented Connection to
capture the `list_workspaces` envelope and settle design Decision 5's fetch-layer
branch before building.
