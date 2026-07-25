# server-mcp-views — Proposal

## Why

The per-Space view machinery (`bo_at_views`, changelog `entity_type='view'`, unknown-status sweep) exists but only fills for Enterprise-scope connections; everyone else gets views stripped before diff/store (`view-capture.ts`). With the paired [`workflows-mcp-views`](../workflows-mcp-views/proposal.md) capturing views via MCP for all connections, the engine must: stamp which capture mode each run uses, accept the optional `views` schema-sync field, persist/diff it into the existing view tables, and stop sweeping views to `unknown` when MCP supplied them. If the spike shows MCP exposes view *configuration* (beyond REST's id/name/type), config changes join the changelog — the detail the schema UI pair (ui-only `view-schema-details`) renders.

## What Changes

- **`viewCaptureMode` on the task payload:** `resolveViewCaptureForRun` widens from the boolean enterprise gate to `'rest' | 'mcp' | 'off'` — `'rest'` for enterprise-scope connections (today's path, unchanged), `'mcp'` for everyone else (subject to the same tier/override settings the boolean honored), `'off'` when disabled.
- **schema-sync accepts an optional `views` field** (raw MCP capture + `capturedAt`). Absent field = no MCP view processing — never "all views deleted." REST-mode runs continue to carry views inside the schema payload exactly as today.
- **Extraction + persistence:** MCP view entities (keyed by `viewId`, with `tableId`/`baseId`/`name`/`type`) merge into the existing **`bo_at_views`** rows via the established lifecycle columns. **Conditional migration:** if the spike shows configuration in the envelope, `bo_at_views` gains a `definition` jsonb column (per-Space schema-version bump, sequenced behind `system-per-space-db`); if not, **no migration**.
- **Diffing:** run-over-run in the same `withSpaceSchema` transaction — add/remove/rename via lifecycle + `bo_at_schema_updates` rows (`entity_type='view'`), plus `change_type='config'` rows with the normalized delta when definitions exist.
- **Sweep semantics fixed:** `shouldSweepUnknownViews` currently sweeps active views to `unknown` when the REST gate is closed. New rule: sweep only when **neither** source captured views this run — a successful MCP capture is a real sighting.

## Capabilities

### New Capabilities

- `views-sync`: engine-side mode resolution, persistence, lifecycle, and diffing of MCP-captured views into the existing per-Space view tables and changelog, coexisting with the REST enterprise path.

### Modified Capabilities

None named — `view-capture` gate helpers are reshaped internally but every REST-mode behavior is preserved (spec requirement below).

## Impact

- **App:** `apps/server` — `view-capture.ts` mode widening, schema-sync route, new `per-space/views-sync.ts` (pure extract/diff, modeled on `interfaces-sync.ts`), `space-db-pg.ts` IO. Conditional per-Space migration (spike-dependent).
- **Cross-repo contract:** the optional `views` field + `viewCaptureMode` flag — owned by THIS change; workflows consumes. Land this change first.
- **Reads/consumers:** schema Browse/Changelog surfaces pick up rows generically; the richer panel is ui-only `view-schema-details`.
- **No new secrets, no master-DB schema change.**
