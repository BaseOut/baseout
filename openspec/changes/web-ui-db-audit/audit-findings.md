# UI ↔ DB audit findings — 2026-07-07

Audited surface: Dan's latest Schema round-2/3 design (`ui-only@d97c777`, synced into
`apps/design` this change) plus the non-schema design fixtures, compared against:
- per-Space DB (`packages/db-schema`, schema v5, 23 `bo_at_*` tables, pg + sqlite)
- master DB (`apps/web/src/db/schema/core.ts`, migrations through `0024`)
- engine payloads (`apps/server/.../schema-read.ts`, `schema-sync.ts`) and the web
  client types (`apps/web/src/lib/backup-engine.ts`)

Statuses: **exists** (column/payload field present) · **derivable** (computable from
existing data at read time — engine/web work, no migration) · **missing** (no plausible
source — needs a migration or an inbound capture path) · **fixture-only** (design
concept with no persistence intent yet — needs a product decision with Dan).

Dan's expectation held: **no table-level gaps — every gap is field-level or
payload-level.** The per-Space schema is structurally ahead of the UI (docs, chat,
health metrics, synced-view candidates all have tables); the misses cluster in five
areas below.

---

## 1. Descriptions / annotations on schema entities

UI model (per base/table/field): `airtableDescription` (synced truth), `description`
(AI), `technicalDescription` (AI technical draft), `userDescription` (internal),
`airtableDraft` (edited-but-unpublished), `airtableExternallyChanged` (stale flag).

| UI field | Status | Backing | Note |
|---|---|---|---|
| airtableDescription | exists | `bo_at_*.description` | captured each run |
| description (AI) | exists | `bo_at_*.ai_description` | |
| userDescription | exists | `bo_at_*.description_override` | naming differs; confirm semantic match with Dan |
| technicalDescription | **exists?** | `bo_at_*.ai_overview` | plausible match, but `ai_overview` reads as "overview", not "technical draft" — decide mapping or add `ai_technical` |
| airtableDraft | **missing** | — | needs a `description_draft` column (per entity) + a publish path (writeback is V2 — flag scope conflict, PRD §10) |
| airtableExternallyChanged | derivable | compare last two captured versions at sync time | engine compute; no column needed if derived per read |

## 2. Engine `schema-read` payload is far thinner than the UI

The per-field payload emits only `name / type / isPrimary / description / status`. The
UI renders, per field: `options` (select choices), `linkedTableId`, `allowsMultiple`,
`inverseFieldId`, `formula`, `referencedFieldIds`, `lookupViaFieldId`,
`lookupTargetFieldId`, `derivedFrom`, all four description variants, `removedAt`.

| UI need | Status | Backing | Note |
|---|---|---|---|
| field `options` + link/formula/lookup config | derivable | `bo_at_fields.options` (jsonb, already captured) | **payload gap** — schema-read must emit/unpack options |
| reverse-reference edges (back-refs, "Referenced by") | derivable | invert the forward graph from `options` | upstream design doc says explicitly "the engine must emit them" |
| removedAt (entity) | derivable | `first_unseen_run` → `bo_at_base_runs.completed_at` | join, then emit |
| ai/user/technical descriptions | exists | annotation columns | **payload gap** — schema-read emits only `description` |
| per-table health chip (`green/amber/red`) | derivable | `bo_at_health_issues.table_id` rollup | health scores are per-base only; per-table = derived severity rollup |
| lastBackupAt | derivable | master `backup_runs.completed_at` | already used elsewhere |
| aiState (`ready/locked/no-credits`) | exists | tier caps via `resolveSchemaDocsLevel` + credits | |

## 3. Automations & Interfaces — biggest field-level gap

DB (`bo_at_automations` / `bo_at_interfaces`): `airtable_entity_id, name, type,
definition, status, submitted_via, first_seen_at, last_seen_at`. The UI wants much more:

| UI field | Status | Note |
|---|---|---|
| triggerType (automations) | exists? | plausibly `type` — confirm |
| enabled (on/off, distinct from removed) | **missing** | needs `enabled` boolean |
| airtableDescription (automations) | **missing** | needs a `description` column (user-maintained; API can't export) |
| internalDescription (both) | **missing** | annotation columns (`description_override`) absent on these two tables |
| subscribers (notification emails) | **missing / fixture-only?** | no column; confirm with Dan whether V1 |
| tags → schema entities (auto/manual) | **missing** | no tag table; needs `bo_at_automation_tags`-style table (docs already have the pattern: `bo_at_document_tags`) |
| triggers (page/interface → automation edges) | **missing** | no column/table for the app-layer graph edges |
| parentId (page → parent interface) | **missing** | flat table today; `type` exists but no hierarchy |
| published (interfaces) | **missing** | needs boolean |
| removedAt | derivable | `last_seen_at` + `status` | |

Remediation owner: extend `server-automations-interfaces-docs` (+ paired
`workflows-automations-interfaces-docs`) with a per-Space schema v6 migration; the
`web-automations-interfaces-tabs` change consumes it.

## 4. Health tab — insights missing, metrics mostly wired

| UI field | Status | Backing / note |
|---|---|---|
| score, band | exists | `bo_at_health_scores` — **enum mismatch: UI `amber` vs DB `yellow`; UI `med` vs DB `medium`** (map at the edge, pick one canon) |
| metrics (name, weight, enabled, prompts, staleness) | exists | `bo_at_health_metric_*` + master `health_score_rules` (`HealthConfigMetricView` already models it) |
| per-metric findings (expanded rows) | derivable | `bo_at_health_issues.rule_id` | |
| issues (severity, text, count, airtableUrl) | exists | `occurrence_count`, `airtable_deeplink` | |
| trend sparkline | derivable | historical `bo_at_health_scores` per base — needs a read path that returns more than the latest row |
| assessedAt | derivable | `run_id` → `bo_at_base_runs.completed_at` | |
| insights (`SchemaInsight`: text, tags, category, evidence, archived) | **missing** | no table; owned by `server-schema-insights` / `workflows-schema-insights` (change exists, data model not yet in `packages/db-schema`) |
| insightConfig (system/space/base prompt + staleness) | **missing** | same owner; health-metric prompts have the pattern to copy |

## 5. Changelog

Engine view: `entityType (base/table/field/view)`, `kind (modified/removed)`,
`changeType`, `before/after`, `breaksData`. UI wants:

| UI field | Status | Note |
|---|---|---|
| type = `added` | **missing in read view** | adds are recorded (lifecycle `first_seen_run`) but `ChangelogEntryView.kind` only has modified/removed — emit adds |
| entityKind = automation/interface | exists | `bo_at_schema_updates.entity_type` already allows them |
| entityKind = `page` | **missing** | not an allowed entity_type; folds into interface hierarchy decision (§3) |
| fieldType (for filter/icon) | derivable | join `bo_at_fields.type` | |
| aiSummary (plain-language explanation) | **missing** | no column on `bo_at_schema_updates`; needs `ai_summary` + a generation path |
| warning | partial | `breaks_data` boolean exists; UI shows a message string — derive text from changeType |
| summary (pre-rendered line) | derivable | render from before/after | |

## 6. Chat

`bo_at_chat_threads` / `bo_at_chat_messages` cover threads, scope, archive, roles,
async status. Gaps:

| UI field | Status | Note |
|---|---|---|
| message `refs` (entity/doc chips under assistant replies) | **missing** | needs a `refs` jsonb column on `bo_at_chat_messages` (or a message-refs table) |
| `convertedDoc` (message → created doc link) | **missing** | needs a nullable `converted_document_id` |
| scope chips with names | derivable | ids in `scope` jsonb + name join | |

Owner: `server-schema-chat` / `workflows-schema-chat`.

## 7. Relationships

Structurally healthy: derived relationships compute from `bo_at_fields.options`;
synced-view candidates persist with confirm/dismiss (`bo_at_synced_view_candidates`).
Field-level notes: `cardinality`/`direction` derivable from `allowsMultiple` +
`inverseFieldId`; per-link `firstSeen`/`removedAt` derivable from field lifecycle;
per-link `note` ("reciprocal field was briefly removed") is **fixture-only** — decide
whether to keep. UI shape ≠ engine view shape (`DerivedRelationshipView` /
`SyncedViewRelationshipView`) — mapping work in `web-relationships-tab`, no migration.

## 8. Docs

Fully backed: `bo_at_documents/_tags/_links/_diagrams` match the UI (`author` derives
from `created_by_user_id` → master `users`). The design fixture's simplified block model
vs the production Plate JSON is fixture-only — no gap.

## 9. Non-schema surfaces (master DB sweep)

| Surface | Field | Status | Note |
|---|---|---|---|
| Backups | `configuration.mode` ('all_bases') | fixture-only | no DB concept; scope/base-selection already covers it |
| Destinations | `status` (connected/reconnect) | **missing** | no status column on `storage_destinations` (connections has one) — needed for the reconnect UX |
| Destinations | `lastWrite` | derivable | latest succeeded `backup_runs.completed_at` per destination — needs run→destination attribution once multi-destination writes land |
| Sources | `auth` (oauth vs pat) | **missing** | connections doesn't record auth method; PATs are roadmap — defer or add now |
| Sources | `basesAvailable`, `lastChecked` | derivable/live | Airtable meta call or `at_bases` count + a checked-at stamp |
| Sources | per-Space rollup `status` (ok/failed/paused) | derivable | latest run status per Space |
| Connection health banner | `side`, `count`, `names` | derivable | classify by table (connections=source, storage_destinations=destination) + aggregate |

---

## Proposed remediation (for game-planning with Dan)

**A. Engine read-path expansion (no migrations):** emit field `options`-derived config,
annotation columns, `removedAt`, reverse-reference edges, per-table health rollup,
health trend history, changelog `added` events + `fieldType`. This is the largest and
cheapest win — most of what the UI shows is already captured.

**B. Per-Space schema v6 migration (packages/db-schema):**
1. `bo_at_automations`: + `enabled`, `description`, `description_override`, (decide: `subscribers`)
2. `bo_at_interfaces`: + `published`, `parent_id`, `description_override`
3. new `bo_at_app_tags` (automation/interface → entity, `source: auto|manual`) + `triggers` edges (column or table)
4. `bo_at_chat_messages`: + `refs` jsonb, `converted_document_id`
5. `bo_at_schema_updates`: + `ai_summary`; widen `entity_type` if pages get first-class rows
6. insights tables (`bo_at_schema_insights` + prompt config) — land inside `server-schema-insights` rather than here
7. (decision) `description_draft` per entity for the Airtable-draft/publish flow — conflicts with V2 writeback scope, needs Dan

**C. Master DB (apps/web migration 0025+):** `storage_destinations.status`; (decide)
`connections.auth_method`.

**D. Canon fixes (cheap, do early):** health band `yellow` vs `amber`, severity
`medium` vs `med` — pick the DB spelling as canon and map in the view layer.

**E. Product decisions needed from Dan:** automation `subscribers`, relationship link
`note`, the draft/publish description flow (writeback adjacency), interface `page`
hierarchy depth.
