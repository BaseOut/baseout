# web-interfaces-source-badge — Proposal

## Why

`bo_at_interfaces` now holds up to TWO rows per Airtable entity: an automatic MCP-captured row (`submitted_via='mcp'`, from `server-mcp-interface-pages` / `workflows-mcp-interface-pages`) and a manually-submitted row (`submitted_via` = intake sources, from the manual-crud slice when it lands). The server change's reconciliation decision (design Decision 3 + open question S3) deliberately keeps them parallel and pushes presentation to the web: any reader that doesn't group by `airtable_entity_id` will show duplicates, and users can't tell captured-from-Airtable truth from hand-submitted context. This change was named as the follow-up in both MCP changes; it's now filed.

## What Changes

- **Dual-source merge rule (pure, shared by every interfaces read):** group rows by `airtable_entity_id`; the MCP row is authoritative for existence, name, and composition; the manual row's richer payload (descriptions, notes) is attached as supplementary detail; rows with only one source pass through. Entities whose MCP row is `status='removed'` but manual row is active render as removed-with-manual-context, not resurrected.
- **Source badge:** each interface entity shows provenance — `Auto` (MCP-captured), `Manual`, or both — using the governed `StatusBadge` primitive (two-tier UI governance: no new custom pill; extend the StatusBadge story with the new variants in the same change).
- Applies wherever interfaces render — initially the Interfaces tab being built by `web-automations-interfaces-tabs`; the merge function is the read contract that change consumes.

## Capabilities

### New Capabilities

- `interfaces-dual-source-read`: the canonical merge + provenance presentation for dual-source interface rows on every web read path.

### Modified Capabilities

None — no schema or engine change; this is read-path presentation over existing rows.

## Impact

- **App:** `apps/web` only — pure merge module in `src/lib/` + `StatusBadge` variant/story + adoption in the Interfaces tab views.
- **Dependency:** renders inside `web-automations-interfaces-tabs` (0/22). Build the merge module + badge first (testable standalone); the tab change consumes them — cross-referenced in both changes.
- **UI governance:** Storybook-first — StatusBadge story extended in the same change; coverage test enforces it.
