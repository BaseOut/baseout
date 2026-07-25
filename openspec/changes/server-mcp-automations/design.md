# server-mcp-automations — Design

## Decision 1 — REUSE the existing `bo_at_automations` table, timestamp lifecycle, no migration

**(Revised at implementation, 2026-07-24.)** The manual-intake schema work already created `bo_at_automations` (`airtable_entity_id`, `name`, `type`, `definition` jsonb, `status`, `submitted_via`, `first_seen_at`/`last_seen_at`) — and the changelog union already reads automation removals from exactly that shape (`schema-changelog-io.ts`: `status='removed'` + `last_seen_at` as the removal timestamp). So MCP rows reuse the table as-is: `submitted_via='mcp'`, timestamps stamped from the capture's `capturedAt` (NOT the run-based lifecycle interfaces use — that would have required a migration for zero consumer benefit). Removal keeps `last_seen_at` at the last sighting, matching the reader.

Trigger/action internals (deployment status, trigger info, graph nodes) stay inside `definition` — no link tables until a real consumer needs table/field-level automation dependencies (YAGNI; if the envelope exposes per-automation table references, note them as a follow-up candidate for the entity graph, don't build now).

## Decision 2 — Diff granularity follows the envelope (workflows spike output)

- **Inventory-grade envelope** (id, name, enabled): lifecycle add/remove + `change_type='name'` renames + `change_type='config'` for enabled/disabled flips. Definition hash short-circuit.
- **Definition-grade envelope** (trigger/actions): additionally emit `config` updates storing the DELTA of the normalized definition, mirroring `interfaces-sync.ts` delta rules (compare IDs/stable keys, tolerate unknown keys, exclude volatile fields from the hash).

The pure module (`automations-sync.ts`) owns wire type, extraction, and diff; `space-db-pg.ts` owns read/apply (`readAutomationWorkingSet` / `applyAutomationDiff`); the schema-sync route wires them inside the same transaction as the schema diff — the exact `interfaces-sync` layering.

## Decision 3 — Reconciliation copies the interfaces contract verbatim

MCP authoritative for existence/name/enabled; manual rows (`submitted_via='manual'`, from `server-automations-interfaces-docs` intake) never deleted by MCP diffs; read path unions both, keyed by `airtable_entity_id`. Removal only on a successful capture — absent/skipped field is never a deletion signal.

## Decision 4 — Per-Space migration sequencing

~~`bo_at_automations` lands as a per-Space schema-version bump~~ **MOOT (see Decision 1): the table already exists in the base per-Space DDL — no version bump, no sequencing dependency on the in-flight `system-per-space-db` work.**

## Open questions

1. Envelope granularity (blocks Decision 2 branch) — resolved by workflows spike 1.1.
2. Does MCP expose automation run-history/status? Out of scope if so (backup ≠ monitoring), but note it for the backlog.
3. Web read path: does `web-automations-interfaces-tabs` already render `submitted_via='mcp'` rows generically, or does it need a follow-up? (Check at implementation; if a gap, file a small web change — don't widen this one.)
