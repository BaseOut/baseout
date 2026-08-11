# server-mcp-views — Design

## Decision 1 — One `bo_at_views` table, two sources, REST wins on conflict

MCP rows merge into the existing table (no `submitted_via` column exists on views and none is added — source is derivable from the run's mode, and no consumer needs per-row provenance yet). For enterprise connections running `'rest'` mode, MCP is never called — so the two sources never race within a run. If a connection's scope changes between runs, the latest successful capture (either source) is authoritative; lifecycle semantics don't care which source sighted the view.

## Decision 2 — Mode resolution replaces the boolean gate in place

`resolveViewCaptureForRun` returns `'rest'` (enterprise scope), `'mcp'` (non-enterprise, capture enabled), or `'off'` (setting/tier disabled, honoring the existing `VIEW_CAPTURE_OVERRIDE` env escape). `stripCapturedViews` keeps its job for `'off'` and for REST payloads on `'mcp'`-mode runs (belt-and-braces: a non-enterprise REST payload shouldn't carry views anyway). All existing REST-mode tests must pass unmodified.

## Decision 3 — Sweep only when no source captured

`shouldSweepUnknownViews(mode, mcpCaptureOk)`: sweep active→`unknown` only when mode is `'off'`, or mode is `'mcp'` and the capture failed AND the REST payload carried no views. A successful MCP capture is a full sighting — absent views transition through the normal removal lifecycle, not `unknown`. This is the behavioral heart of the change: `unknown` means "we lost visibility," removal means "it's gone," and MCP restores visibility for non-enterprise customers.

## Decision 4 — Config diffing is conditional on the spike

Definition-grade envelope → `definition` jsonb column (per-Space version bump behind `system-per-space-db`), normalized-delta `config` changelog rows mirroring `interfaces-sync.ts` delta rules (stable-key compare, tolerate unknown keys, volatile fields excluded from the hash). Inventory-grade envelope → no migration, no config rows; lifecycle + renames only. The pure module (`views-sync.ts`) owns wire type/extract/diff; `space-db-pg.ts` owns `readViewWorkingSet`/`applyViewDiff`.

## Open questions

1. Envelope depth (drives Decision 4) — workflows spike.
2. Do REST-captured enterprise views and MCP-captured views ever disagree on `type` vocabulary? Normalize at extraction if so.
3. Tier: view capture today follows the schema capability with the enterprise gate on top; `'mcp'` mode inherits the same tier surface — confirm no Features-matrix row change is needed (it reads as widening availability, not a new gate).
