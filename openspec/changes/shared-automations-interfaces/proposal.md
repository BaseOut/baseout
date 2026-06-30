## Why

Airtable's REST/Metadata API does not expose Automations or Interfaces, so the Schema page can never show them from a backup run alone ([PRD §2.9](../../../shared/Baseout_PRD.md) lists both as **Manual (user-submitted via intake)**). Customers paying for Growth+ are missing this column of the schema/backup matrix entirely. The per-Space storage for it already shipped — `bo_at_automations` and `bo_at_interfaces` in `packages/db-schema/src/space/pg.ts` (header: *"Inbound-captured metadata (Airtable API doesn't expose these)"*) — but there is no UI, no engine read/write path, and no inbound API. The storage shipped ahead of the feature.

This change builds that feature with two intake paths for now (manual UI form + inbound REST API), defers other paths (Airtable Script/Automation generators) to follow-ups, and reconciles a stale competing design.

## What Changes

- **Manual + inbound intake for Automations and Interfaces.** Automations require `airtableEntityId` + `name`. Interfaces require `airtableEntityId` + `type` (`interface | page`); a `page` must reference a parent interface. Both carry an optional `definition` JSON body and Table/Field tags. (The two **Schema UI tabs** that drive manual create/edit/delete are specced UI-only in the `ui-only` repo — `automations-interfaces-tabs` — and consume this change's proxy routes; this change owns the data, engine, API, and `apps/web` proxy/capability wiring.)
- **Hybrid data model on the already-shipped per-Space tables** — keep the required/queryable scalars as columns (`airtableEntityId`, `name`, `type`, `status`, plus a new `parentInterfaceId` for interface pages) and store the full config verbatim in the existing `definition` JSONB. No per-step / per-config-type relational modeling — new Airtable step or interface types land in `definition` untouched.
- **New per-Space tagging table** linking an automation/interface → the Tables/Fields it references, mirroring the established `bo_at_document_tags` pattern. Populated two ways: **auto-extracted** by walking `definition` for table/field references on every write, **and** manually via the UI tag-picker. Tags surface (clickable) on entity detail panels in the Browse tab, and an automation/interface surfaces on a Table/Field it tags.
- **Engine CRUD broker** (`apps/server`) — `x-internal-token`-gated `/api/internal/spaces/:spaceId/{automations,interfaces}` routes that own all per-Space DB reads/writes, mirroring the `shared-schema-docs` document-broker pattern. `apps/web` and `apps/api` both reach the per-Space DB only through this broker.
- **Inbound REST API** (`apps/api`) — Org-API-token-authenticated `POST/PUT/DELETE` endpoints under `api.baseout.com` that accept the same automation/interface payload shape a customer can scrape from their environment and forward it (HMAC service token) to the engine broker. Create / edit / delete all supported.
- **Tier gating** — a capability resolved from cached Stripe metadata gates both intake paths at Growth+ (per PRD §2.9; flagging the Features §4.2 "Launch+" divergence below).
- **Supersede the stale design** — `server-automations-interfaces-docs`'s master-DB `submitted_entities` table contradicts the shipped per-Space `bo_at_automations`/`bo_at_interfaces`. This change adopts the per-Space tables as canonical; the `submitted-entity-storage` spec is retired (custom-documentation intake, the third entity in that change, is **out of scope here** and remains for a separate follow-up).

**Spec conflict to flag** (per CLAUDE.md "v1.1 PRD authoritative"): [PRD §2.9](../../../shared/Baseout_PRD.md) gates Automations + Interfaces at **Growth+**; [Features §4.2](../../../shared/Baseout_Features.md) marks them **Launch+**. This change commits to the PRD reading (**Growth+**) and notes the divergence for reconciliation.

**Payload shapes confirmed** against both example exports (`airtable_automations.json`, `airtable_interfaces.json`): interface submissions arrive **nested** (`interfaces[].pages[]`) and are flattened to one row per interface + per page; interface tag-extraction reads a page's `sourceTable` and `detailFieldsShown[]`.

## Capabilities

### New Capabilities
- `automation-intake`: store Airtable Automations per Base in the per-Space DB — required scalars + `definition` JSONB + auto/manual Table/Field tags, soft-delete/reactivation, tier-gating — brokered by the engine. (UI tab specced in `ui-only`.)
- `interface-intake`: same for Airtable Interfaces and their Pages, including the `interface | page` type and the page→interface parent link.
- `inbound-entity-api`: Org-API-token-authenticated public REST endpoints (`apps/api`) to create/edit/delete automations and interfaces, forwarded to the engine broker.

### Modified Capabilities
<!-- No archived capability in openspec/specs/ changes its requirements. The competing
     server-automations-interfaces-docs/submitted-entity-storage spec is an unstarted, un-archived
     change; it is superseded (not a delta) and called out in Impact below. -->

## Impact

- **Supersedes** `openspec/changes/server-automations-interfaces-docs/` (master-DB `submitted_entities` design) and narrows `workflows-automations-interfaces-docs/` — both to be re-scoped or archived; custom-documentation intake stays out of scope.
- `packages/db-schema/src/space/{pg,sqlite,pg-ddl}.ts` — add `parentInterfaceId` to `bo_at_interfaces`; add new `bo_at_entity_tags` table; bump `SPACE_SCHEMA_VERSION`; schema-parity + DDL-parity tests.
- `apps/server` — new `lib/per-space/{automations,interfaces}.ts` + `pages/api/internal/spaces/{automations,interfaces}.ts` + route registration + tag auto-extraction helper; mirrors `withSpaceSchema` + `x-internal-token` gate.
- `apps/web` — `src/lib/backup-engine.ts` client methods; IDOR- + capability-gated `/api/spaces/[spaceId]/{automations,interfaces}` proxy routes; new tier capability field. (The Automations/Interfaces tab views + components are the **UI-only** half — `ui-only` change `automations-interfaces-tabs`.)
- `apps/api` — new versioned `POST/PUT/DELETE /v1/spaces/:spaceId/{automations,interfaces}` routes; Org-API-token auth; HMAC service-token forward to engine.
- **Paired UI-only change**: `ui-only` `automations-interfaces-tabs` (Schema tabs, forms, tag-picker, upsell, tag surfacing) — the manual-intake UI for this data.
- `shared/Baseout_Features.md` §1 naming-dictionary entries (Automation Tag, Interface, Page, Entity Tag); flag the §4.2 vs PRD §2.9 tier divergence.
- New tier capability field resolved from cached Stripe metadata (additive).
- **Security review points:** new public inbound API surface (Org API token auth + tier gate + Zod validation), new internal broker surface (`x-internal-token` + IDOR check on `spaceId`), new HMAC service-token call path `apps/api → apps/server`.
