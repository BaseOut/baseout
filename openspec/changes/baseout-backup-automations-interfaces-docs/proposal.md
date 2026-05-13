## Why

[PRD §2.9](../../../shared/Baseout_PRD.md) lists three entities that the engine cannot collect automatically because Airtable's REST API doesn't expose them:

> | Entity | Collection Method | Min Tier |
> | Automations ⚠️ | Manual (user-submitted via intake) | Growth |
> | Interfaces ⚠️ | Manual (user-submitted via intake) | Growth |
> | Custom Documentation ⚠️ | Manual (user-submitted via intake) | Pro |

The intake methods named in [PRD §2.9](../../../shared/Baseout_PRD.md) and elsewhere:

1. **Inbound API** — `api.baseout.com` POST endpoints, authenticated via Org API tokens.
2. **Airtable Scripts** — a Baseout-provided Script snippet that runs inside Airtable's Scripting block and POSTs to the Inbound API.
3. **Airtable Automations** — a Baseout-provided Automation action that POSTs entity payloads to the Inbound API on schedule.
4. **Manual Forms** — apps/web UI where the user pastes/uploads entity definitions.

Today none of these exist. Customers paying for Growth+ or Pro+ are missing this column of the backup matrix entirely.

**Conflict to flag** per CLAUDE.md "v1.1 PRD authoritative":

- [PRD §2.9](../../../shared/Baseout_PRD.md): Automations Min Tier = `Growth`; Interfaces Min Tier = `Growth`.
- [Features §4.2](../../../shared/Baseout_Features.md): Automation Backup ✓ Launch+; Interface Backup ✓ Launch+.

This change commits to **Growth+** (PRD reading) for Automations + Interfaces. Custom Documentation = **Pro+** (both agree).

## What Changes

### Phase A — Schema

- **New table `submitted_entities`** in master DB:
  - `id uuid PK`
  - `space_id uuid FK → spaces.id ON DELETE CASCADE`
  - `entity_type text NOT NULL CHECK (entity_type IN ('automation','interface','custom_documentation'))`
  - `airtable_entity_id text NULL` — the Airtable ID if known (e.g. automation ID); identifies updates of an existing entry
  - `submission_source text NOT NULL CHECK (submission_source IN ('inbound_api','airtable_script','airtable_automation','manual_form'))`
  - `submitted_by_user_id uuid NULL FK → users.id` — NULL for non-UI submissions
  - `payload jsonb NOT NULL` — the entity's content (script source, interface JSON, documentation markdown, etc.)
  - `version int NOT NULL DEFAULT 1` — incremented on re-submission with the same `airtable_entity_id`
  - `submitted_at timestamp with time zone DEFAULT now()`
  - `created_at timestamp with time zone DEFAULT now()`
- Index on `(space_id, entity_type)`.
- The `(space_id, entity_type, airtable_entity_id, version)` is logically unique but enforced at the application layer (an UPSERT increments version).

### Phase B — Inbound API endpoints (apps/api)

Per [PRD §10](../../../shared/Baseout_PRD.md), `apps/api` exposes `api.baseout.com` for inbound payloads:

- `POST /v1/spaces/:spaceId/automations` — submit an automation definition.
- `POST /v1/spaces/:spaceId/interfaces` — submit an interface definition.
- `POST /v1/spaces/:spaceId/documentation` — submit custom documentation.

Auth: Org API tokens per [PRD §10](../../../shared/Baseout_PRD.md). Tier check via `resolveSubmittedEntityCapability(tier, entityType)`. Returns `{ id, version, status: 'recorded' }`.

### Phase C — Airtable Script generator

The apps/web UI generates a Script snippet pre-filled with the Space's API token and endpoints:

```javascript
// Baseout — Submit Automations
// Run this script inside the Airtable Scripting block of a base
const automations = base.tables /* ... */
await remoteFetchAsync('https://api.baseout.com/v1/spaces/<spaceId>/automations', {
  method: 'POST',
  headers: { 'Authorization': 'Bearer <token>' },
  body: JSON.stringify(automations),
})
```

User pastes the snippet into Airtable. Runs ad-hoc. Output gets POSTed to Inbound API.

### Phase D — Airtable Automation generator

Per [PRD §3.3](../../../shared/Baseout_PRD.md), Baseout provides an Automation-block template:

```
Trigger: Schedule (daily)
Action: Run Script → POST entity to api.baseout.com
```

apps/web exposes a "Copy automation config" button that gives the user the JSON to import into Airtable Automations.

### Phase E — Manual Form UI

For Custom Documentation specifically (Pro+) and as a fallback for Automations/Interfaces:

- A page at `apps/web/src/pages/spaces/[spaceId]/submitted-entities/<type>.astro`.
- Tabs: Documentation / Automations / Interfaces.
- For each: a list of currently-submitted entities with version history + a "Submit new" form (file upload, paste textarea, or rich-text editor).
- Submission POSTs to the Inbound API.

### Phase F — Backup-run inclusion

Each backup run (scheduled or manual) for a Space with submitted entities SHALL include the latest version of each entity in its snapshot. For static-mode (CSV) Spaces: a `submitted_entities.<type>.json` file in R2 next to the records CSV. For dynamic-mode Spaces: the entities live in dedicated tables (`_baseout_automations`, `_baseout_interfaces`, `_baseout_documentation`) per [baseout-backup-dynamic-mode] schema. The `_baseout_runs_log` row tracks which entity versions were included.

### Phase G — Tier-gated capability resolver

- `resolveSubmittedEntityCapability(tier) → { automation: boolean, interface: boolean, documentation: boolean }`. Pin per the resolved conflict:
  - Trial/Starter/Launch: all `false`.
  - Growth: `automation=true`, `interface=true`, `documentation=false`.
  - Pro/Business/Enterprise: all `true`.

### Phase H — Doc sync

- Update [shared/Baseout_Features.md §4.2](../../../shared/Baseout_Features.md) — align tier rows to Growth+ for Automations + Interfaces (PRD reading).
- Update [openspec/changes/baseout-backup-schedule-and-cancel/proposal.md](../baseout-backup-schedule-and-cancel/proposal.md) Out-of-Scope.
- Update [shared/Baseout_Backlog_MVP.md](../../../shared/Baseout_Backlog_MVP.md).

## Out of Scope

| Deferred to | Item |
|---|---|
| Future change `baseout-submitted-entities-validation` | Schema-shape validation for each entity type. MVP accepts any JSON payload; future adds JSON-schema-per-type validation. |
| Future change `baseout-submitted-entities-restore` | Restore of submitted entities (paste back into Airtable). Today: backup-only. |
| Future change `baseout-submitted-entities-diff` | Diff a new version against the previous; visualize what changed. |
| Future change `baseout-submitted-entities-ai-import` | LLM-assisted bulk import of automations from Airtable's "automation history" export. |
| Bundled with `baseout-backup-dynamic-mode` | Dedicated `_baseout_automations` / `_baseout_interfaces` / `_baseout_documentation` tables in dynamic DB. |
| Bundled with `baseout-public-api-tokens` (likely exists or pending) | The Org API token flow used to authenticate Inbound API POSTs. |

## Capabilities

### New capabilities

- `submitted-entity-storage` — `submitted_entities` table + versioning. Owned by `apps/web`.
- `submitted-entity-inbound-api` — `apps/api` POST endpoints for the three entity types.
- `submitted-entity-ui` — Manual Form pages + Script/Automation generators. Owned by `apps/web`.

### Modified capabilities

- `backup-engine` — at run completion, include latest entity versions in the snapshot output. For static mode, write a JSON file to R2 next to the records CSV; for dynamic mode, UPSERT into entity tables.
- `capability-resolution` — `resolveSubmittedEntityCapability(tier)`.

## Impact

- **Master DB**: one additive table.
- **apps/api**: new app surface for Inbound API. Wrangler config + DNS for `api.baseout.com` (likely already provisioned).
- **R2**: extra small JSON file per backup snapshot. Negligible storage.
- **Customer effort**: this feature requires customer-side setup (run Airtable script or set up an automation). UX needs clear onboarding-wizard step + reminders if a Space has tier-eligible entities but none submitted in the last 30 days.
- **Cross-app contract**:
  - apps/api → master DB: direct INSERT into `submitted_entities`.
  - apps/web → master DB: same.
  - engine → master DB: read-only SELECT during backup run.

## Reversibility

- **Phase A** (schema): additive.
- **Phases B–G**: reversible by feature-flag.
- **Phase F** (backup-run inclusion): if reverted, backup snapshots no longer include the JSON; entity rows persist; no data loss.

The forward-only state is customer-submitted payloads. If we revert, customer entities stay in the table waiting for the next forward implementation.
