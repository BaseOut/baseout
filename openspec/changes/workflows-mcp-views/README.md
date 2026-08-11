# workflows-mcp-views — spike results (task 0.2)

**Run 2026-07-27 against `https://mcp.airtable.com/mcp`** (dev Connection `d0374502…`,
**non-enterprise** — exactly the population this change targets; token via the dev
engine's ConnectionDO token route). Script:
[`../server-mcp-workspaces/spike.mjs`](../server-mcp-workspaces/spike.mjs) (one
session answered both spikes).

## Verdict: build proceeds — standard grant works, envelope is INVENTORY-grade, tool is PER-TABLE

### Tool name + args (open question 1)

**`list_views_for_table`** — NOT the per-base `list_views_for_base` the proposal
guessed. Input schema requires **both**:

- `baseId` (`^app[A-Za-z0-9]{14}$`)
- `tableId` — accepts a table **id or name** (names resolved case-insensitively)

There is no per-base view tool in the 41-tool inventory. Table ids are already in the
task's hands (the schema fetch precedes the capture), so the capture step **fans out
one `tools/call` per table**, not one per base — see "capture-shape consequence"
below.

### Envelope depth (open question 2): id/name/type ONLY — inventory-grade

```jsonc
// tools/call list_views_for_table { baseId, tableId } → result.structuredContent
{
  "views": [
    { "id": "viwXXXXXXXXXXXXXX", "name": "Grid view", "type": "grid" }
  ]
}
```

No filters, sorts, or field visibility. **`server-mcp-views` design Decision 4
resolves to the no-migration branch**: no `bo_at_views.definition` jsonb column, no
`config` changelog rows, lifecycle + renames only. (The tool description confirms the
intent: "returning each view's ID, name, and type.") The proposal's "either envelope
ships" risk note lands on the still-valuable side: views open to non-enterprise
connections, REST-parity data.

### Scope check: standard grant SUFFICES — no STOP

`list_views_for_table`, `list_tables_for_base`, `list_pages_for_base`, and
`list_automations` all succeeded with the standard grant
(`data.records:read data.recordComments:read schema.bases:read webhook:manage`).
(Contrast: `list_workspaces` 403s — see the workspaces spike README. View capture is
NOT caught in that scope problem.)

### Payload size (open question 3): non-issue

Observed ~**180 bytes per table** (single-view dev tables). Even a pathological
100-view table extrapolates to ~15 KB; the 2 MB cap is over two orders of magnitude
away. Per-table responses make the cap even softer than the per-base assumption did.

### One-handshake-many-calls (open question 4): CONFIRMED

**11 sequential `tools/call`s on a single initialize handshake** all succeeded
(tables + views across 3 bases, plus interfaces + automations). One session per run
serves all three capture kinds + the per-table view fan-out. Mid-session tool-level
403s do not kill the session.

## Capture-shape consequence (design deviation to carry into build)

Decision 2 ("one MCP handshake can serve all three `tools/call`s") holds, but the
views capture is **N calls (one per table)**, not one. The `fetchViews` wrapper (task
1.1) should take the run's table list and aggregate
`{ tables: [{ tableId, views: [...] }] }` (or equivalent) into the single `views`
schema-sync field — aggregation shape is owned by `server-mcp-views` task 1.1.
Per-table failures inside one capture need a policy (suggest: any table failing marks
the whole capture `skipped(reason)` — partial view visibility would trigger false
removal lifecycle server-side; matches the sweep rule's "a successful capture is a
full sighting" semantics).

## Transport notes

Unchanged from the 2026-07-24 automations spike: server `airtable-mcp-server v0.0.1`,
protocol `2025-06-18`, no `Mcp-Session-Id` issued, every response SSE,
`structuredContent` + `content[0].text` both present, scope denials are HTTP-level
403 (map to `auth`).
