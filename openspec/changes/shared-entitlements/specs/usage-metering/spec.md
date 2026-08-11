# usage-metering

Measure at the Space, record authoritatively in the master DB, account per billing period.

## ADDED Requirements

### Requirement: Every meterable feature has a usage source

Each meterable feature SHALL have a defined measurement source: backup tasks report records, file bytes (internal snapshots + attachments), and base counts in their existing progress/complete callbacks (extended payload); the server measures per-Space database size at run finalization; AI credits and API/MCP/SQL calls are recorded at point of use; manual backups and restores are counted from their existing master rows; creation-capped levers (Spaces, bases, seats, destinations, reports) are counted live from source-of-truth rows and have no usage store; documents (source rows in per-Space DBs) are counted via a master rollup maintained at document create/delete by the serving routes and corrected by the reconciliation sweep.

#### Scenario: Backup run reports usage

- **WHEN** a per-base backup task completes
- **THEN** its completion callback carries the base's record count and file bytes, and the server updates the owning Space's usage without any new workflow→DB coupling

#### Scenario: AI operation meters credits

- **WHEN** a schema-chat turn completes using the Balanced model
- **THEN** the computed credit cost (provider cost × 125 per `ai-credit-model.md`) is recorded against the Organization's current period

### Requirement: Master DB is the single usage authority

Usage SHALL be stored in master-DB `usage_rollups` rows keyed by (organization, feature slug, period, optional Space) — per-Space attribution retained so Space-level utilization is displayable. Per-Space databases SHALL NOT hold a persistent usage ledger. Space-level reporting reaches master only via `INTERNAL_TOKEN`-gated internal routes.

#### Scenario: Space and org views from one store

- **WHEN** the dashboard asks for one Space's file-storage usage and the org's total
- **THEN** both come from `usage_rollups` (Space-scoped rows and their org sum) with no per-Space DB query

### Requirement: Flow meters reset monthly regardless of billing interval; stock meters are levels

Flow meters (AI credits, API/MCP/SQL calls, manual backups, restores) SHALL accumulate within a **monthly anniversary cycle derived from the subscription start date** and reset at each monthly boundary — on annual subscriptions too (allowances are per month; the Stripe billing period is not the meter period). Closed cycles are retained. One-time pack expiry SHALL align to the same monthly boundary. Stock meters (records, file GB, database GB) SHALL be current levels, continuously updated, with period snapshots retained for trends.

#### Scenario: Annual subscriber still gets monthly allowances

- **WHEN** a Core annual subscriber (1,000 AI credits/mo) crosses their monthly anniversary
- **THEN** their credit and call usage reset for the new month while their Stripe billing period continues unchanged

#### Scenario: Cycle rollover resets flow, not stock

- **WHEN** an Organization's monthly cycle rolls over
- **THEN** its AI-credit and call usage restart at zero while records/GB levels carry over unchanged

### Requirement: Reconciliation corrects drift

A scheduled server sweep SHALL re-derive every stock meter from durable source-of-truth data (run rows, measured DB sizes, storage listings) and correct `usage_rollups`, so lost fire-and-forget callbacks can only cause bounded, temporary under-counting.

#### Scenario: Lost callback heals

- **WHEN** a completion callback never arrives for a run that added 50K records
- **THEN** the next reconciliation sweep restores the correct records level from durable data
