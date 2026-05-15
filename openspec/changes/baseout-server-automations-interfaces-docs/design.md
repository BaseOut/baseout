## Overview

Eight phases. The simplest of the 8 MVP-gap changes — three entity types, four intake paths, one storage table. The work is in the UX (making it discoverable + low-friction for the customer) rather than in the engineering.

Architectural call: **all four intake paths funnel into one storage shape** (`submitted_entities` table). The `submission_source` column tracks which path was used, but the consumer (backup engine, restore engine, diff engine) sees one uniform shape.

## Phase A — Schema

```sql
CREATE TABLE baseout.submitted_entities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  space_id uuid NOT NULL REFERENCES baseout.spaces(id) ON DELETE CASCADE,
  entity_type text NOT NULL CHECK (entity_type IN ('automation','interface','custom_documentation')),
  airtable_entity_id text,
  submission_source text NOT NULL CHECK (submission_source IN ('inbound_api','airtable_script','airtable_automation','manual_form')),
  submitted_by_user_id uuid REFERENCES baseout.users(id) ON DELETE SET NULL,
  payload jsonb NOT NULL,
  version integer NOT NULL DEFAULT 1,
  submitted_at timestamp with time zone DEFAULT now(),
  created_at timestamp with time zone DEFAULT now()
);
CREATE INDEX submitted_entities_space_type_idx ON baseout.submitted_entities (space_id, entity_type);
CREATE INDEX submitted_entities_lookup_idx ON baseout.submitted_entities (space_id, entity_type, airtable_entity_id, version DESC);
```

Re-submitting an entity with the same `airtable_entity_id` increments `version` rather than replacing. Lets us keep version history.

## Phase B — Inbound API (`apps/api`)

Three routes:

- `POST /v1/spaces/:spaceId/automations`
- `POST /v1/spaces/:spaceId/interfaces`
- `POST /v1/spaces/:spaceId/documentation`

Body shape per type:

```ts
// Automation
{ airtableEntityId?: string, name: string, trigger: any, actions: any[], rawDefinition?: string }

// Interface
{ airtableEntityId?: string, name: string, layout: any, dataSources: any[], rawDefinition?: string }

// Custom Documentation
{ title: string, format: 'markdown' | 'html' | 'plain', content: string, tags?: string[] }
```

Auth via Org API token (Bearer). Token resolves to `organization_id` → IDOR-check that `space_id ∈ org.spaces`. Tier-gate via `resolveSubmittedEntityCapability`.

Validation: minimal first-pass — assert `payload` is JSON and ≤ 1 MB. Schema validation is a follow-up.

On success: UPSERT into `submitted_entities`, returning the new row's `id` + `version`.

## Phase C — Airtable Script generator

apps/web page `apps/web/src/pages/spaces/[spaceId]/submitted-entities/script-generator.astro`:

- Asks the user to pick an entity type.
- Asks for the destination `airtable_entity_id` (or "submit all automations in this base").
- Generates a Script snippet pre-filled with `<spaceId>` + `<token>` + the destination endpoint.
- Includes a "Copy to clipboard" button.

The token is the Org's API token (generated separately per `baseout-public-api-tokens`).

## Phase D — Airtable Automation template

Similar: apps/web page generates an Automation config JSON the user can paste into Airtable. Uses Airtable's "Run script" action.

## Phase E — Manual Form UI

`apps/web/src/pages/spaces/[spaceId]/submitted-entities/<type>.astro`:

- Tab nav: Automations / Interfaces / Documentation.
- List of currently-submitted entities (latest version per `airtable_entity_id`). Click to expand version history.
- "Submit new" form:
  - Automation/Interface: file-upload (JSON) or paste textarea.
  - Documentation: rich-text editor or markdown paste.
- Submit button POSTs to Inbound API (browser-side calls api.baseout.com via the user's session — token issued per-request).

## Phase F — Backup-run inclusion

In the engine's per-run completion path:

```ts
const entities = await db.select(...).from(submittedEntities)
  .where(eq(submittedEntities.spaceId, spaceId))
  .orderBy(desc(submittedEntities.version))
  // dedup by (entity_type, airtable_entity_id) — keep latest version per logical entity

const grouped = groupByEntityType(entities)

if (config.mode === 'static') {
  for (const [type, items] of Object.entries(grouped)) {
    await writer.writeFile(jsonStream(items), `${runId}/submitted-${type}.json`, 'application/json')
  }
}

if (config.mode === 'dynamic') {
  for (const [type, items] of Object.entries(grouped)) {
    await upsertEntitiesToDynamic(dynamicDb, type, items)
  }
}
```

The static-mode JSON sits next to the records CSV in R2. The dynamic-mode upsert lands in `_baseout_<type>` tables (defined in `baseout-backup-dynamic-mode`).

## Phase G — Capability resolver

```ts
resolveSubmittedEntityCapability(tier: TierName): {
  automation: boolean
  interface: boolean
  documentation: boolean
}
// Trial/Starter/Launch:    { automation: false, interface: false, documentation: false }
// Growth:                  { automation: true,  interface: true,  documentation: false }
// Pro/Business/Enterprise: { automation: true,  interface: true,  documentation: true  }
```

Apps/api routes consult this resolver before accepting submissions. Lower tiers receive 403 `entity_type_not_available_at_tier`.

## Wire shapes

| Direction | Path | Verb | Notes |
|---|---|---|---|
| External → apps/api | `/v1/spaces/:id/automations` | POST | new — auth via Org API token |
| External → apps/api | `/v1/spaces/:id/interfaces` | POST | new |
| External → apps/api | `/v1/spaces/:id/documentation` | POST | new |
| apps/web → apps/api | same routes | POST | proxied / direct |
| engine → master DB | `SELECT FROM submitted_entities` | — | read-only during run |

## Testing strategy

| Layer | Coverage |
|---|---|
| Pure | `resolveSubmittedEntityCapability` — all seven tiers. |
| Pure | `groupByEntityType(entities)` + `dedupByEntityIdLatest(entities)`. |
| Integration | apps/api endpoints — 401 (no token), 403 (tier), 200 (happy), 400 (oversize), 409 (replay). |
| Integration | UPSERT versioning — re-submit same `airtable_entity_id` increments `version`. |
| Integration | Backup run includes entity JSON in R2 / dynamic DB tables. |
| Playwright | Manual-form flow — open form, paste sample documentation, submit, see in list. |

## Master DB migration

`apps/web/drizzle/0014_submitted_entities.sql` per Phase A. Engine mirror in `apps/server/src/db/schema/submitted-entities.ts`.

## Operational concerns

- **Discoverability**: customers on Growth+ might not realize they need to submit entities manually. UX needs: (1) onboarding-wizard step that surfaces this; (2) periodic email reminder if a tier-eligible Space has no submissions in 30 days.
- **Payload size**: 1 MB cap per submission. Custom Documentation can be large; consider per-entity-type caps.
- **Versioning growth**: re-submission incrementing `version` indefinitely is unbounded. Add a retention-style prune for `submitted_entities` (keep last N versions per logical entity) — out of MVP scope.
- **Customer-supplied JSON**: store-as-given; do not parse for execution. Custom scripts in Automation payloads MUST NOT be executed in our environment.

## What this design deliberately doesn't change

- The Airtable REST-API backup path. Unchanged.
- The dynamic-mode write path. Reused for entity tables.
- Storage destinations. Entity JSON rides the same `StorageWriter` interface as records CSV.
- Restore. Out of scope.
