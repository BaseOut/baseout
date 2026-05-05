# BaseOut Pricing & Credit System

## 1. On2Air Current Pricing Analysis

### On2Air Plan Tiers

| Plan | Price/mo | Bases | Records | Attachments | Restore | Frequency | Projects |
|------|----------|-------|---------|-------------|---------|-----------|----------|
| Basic (Free) | $0 | 1 | ~1,000* | 25 | 1 | - | - |
| Starter | $9.99 | 1 | 50,000 | 2,500 | 1/mo | Monthly | - |
| Essentials | $29.99 | 15 | 250,000 | 25,000 | 1/mo | Monthly, Weekly | 5 |
| Professional | $49.99 | 50 | 1,000,000 | 500,000 | 5/mo | Daily, Weekly, Monthly | 15 |
| Premium | $79.99 | 250 | 5,000,000 | 1,000,000 | 10/mo | Hourly, Daily, Weekly, Monthly | 250 |
| Enterprise | Custom | 250+ | Custom | Custom | Custom | Custom | Custom |

> *Basic: 100 records/table x 10 tables. Annual plans save 20% (2 months free).

### Key Observations

- Flat monthly fee regardless of actual usage -- users pay the same whether they use 1 base or the plan maximum
- Backup frequency is hard-gated by tier; hourly is Premium-only
- Limits use attachment count, not total MB -- storage size is not differentiated
- On2Air pricing has historically been underpriced relative to the value delivered

---

## 2. BaseOut Credit System: Two Backup Types

BaseOut supports two fundamentally different backup models, and credits are consumed differently for each.

### Static Backup (same model as On2Air)

Data is transferred and stored at a **third-party destination** chosen by the user (Google Drive, Dropbox, S3, etc.). BaseOut facilitates the transfer but does not host the data.

**Credit usage: transfer only -- charged per backup run**

| Operation | Credit Cost | Unit |
|-----------|-------------|------|
| Schema / metadata backup | **5 credits** | per base, per run |
| Record data transfer | **1 credit** | per 1,000 records transferred |
| Attachment data transfer | **1 credit** | per 50 MB of attachment data transferred |

> Every static backup run re-transfers the full dataset. Cost is purely proportional to data volume x frequency.

---

### Dynamic Backup (BaseOut-hosted)

Data is stored in a **BaseOut-managed database**. BaseOut hosts the data and keeps it queryable and restorable. This has two distinct credit components:

**Transfer credits -- charged each sync run (initial and incremental)**

| Operation | Credit Cost | Unit |
|-----------|-------------|------|
| Schema / metadata sync | **5 credits** | per base, per run |
| Record data sync | **1 credit** | per 1,000 records synced |
| Attachment data sync | **1 credit** | per 50 MB of attachment data synced |

> After the initial full sync, subsequent runs only transfer changed records and new/modified attachments -- making dynamic backups more credit-efficient over time for large, stable datasets.

**Storage credits -- charged monthly, based on data at rest in BaseOut**

| Data Type | Credit Cost | Unit |
|-----------|-------------|------|
| Record storage | **2 credits** | per 1,000 records stored, per month |
| Attachment storage | **5 credits** | per GB of attachment data stored, per month |

> Storage credits are deducted from the monthly credit allotment on the billing date, based on the peak data volume stored during that billing period.

---

### Static vs. Dynamic Credit Comparison

Example: 1 base, 50,000 records, 5 GB attachments

| Scenario | Transfer Credits/run | Storage Credits/mo | Total Month 1 | Total Month 2+ |
|----------|---------------------|-------------------|---------------|----------------|
| Static, monthly backup | 5 + 50 + 100 = **155/run** | 0 | **155** | **155** |
| Static, weekly backup (x4) | 155 x 4 | 0 | **620** | **620** |
| Static, daily backup (x30) | 155 x 30 | 0 | **4,650** | **4,650** |
| Dynamic, initial sync | 155 (full sync) | 100 + 25 = **125** | **280** | - |
| Dynamic, weekly incremental (x4) | ~20/run (small deltas) | **125** | - | **205** |
| Dynamic, daily incremental (x30) | ~20/run | **125** | - | **725** |

> Dynamic becomes significantly more cost-efficient than static for users who want frequent backups of large, slow-changing datasets, because incremental syncs transfer only what changed.

---

## 3. Plan Variables

Every plan is defined by the following dimensions. Credits meter transfer activity only -- there are no hard caps on records or attachments. The monthly credit allotment is the natural limiter for how much data can be transferred.

| Variable | Description |
|----------|-------------|
| **Transfer credits** | Monthly allotment consumed by all backup/sync/restore/API activity. Resets on billing date. No rollover. Overage billed at the plan's per-credit rate at end of period. There are no separate record or attachment caps -- credits are the single consumption meter. |
| **Onboarding credits** | One-time credit grant issued at signup, expiring 30 days after account creation. Consumed before monthly plan credits to absorb large initial backup costs. |
| **R2 file storage** | Persistent managed file storage (Cloudflare R2) for static backup files and attachments. Does not reset monthly. Overage billed per GB/month. |
| **Database storage** | Persistent database storage for dynamic backups (schema and/or full data). Engine varies by tier (D1 SQLite → Shared PG → Dedicated PG). Does not reset monthly. Overage billed per GB/month. |
| **Backup mode** | Whether static (file export to destination), dynamic (BaseOut-managed database), or both are available. |
| **Backup frequency** | How often scheduled backups can run: monthly, weekly, daily, or instant (webhook-driven). Tier-gated. |
| **Snapshot retention** | How many days of backup history is kept and restorable. |
| **Spaces** | Organizational containers within an account. Trial: 1, Starter: 3, Launch: 5, Growth+: unlimited. |
| **Bases per Space** | Number of Airtable bases that can be connected per Space. Trial: 1, Starter: 3, Launch: 5, Growth+: unlimited. |
| **Connections** | Authenticated links to external platforms and storage destinations. Capped at 2 per Space on limited tiers; unlimited at Growth+. Some destination types (S3, custom BYOS) are only available on higher tiers. |
| **Team members** | Number of users who can access the account. |
| **Included restores/month** | Number of restore operations included in the plan each billing period. Additional restores consume credits. |
| **Smart Rolling Cleanup** | Automated policy to delete older snapshots and free storage (e.g., keep daily for 30 days, then weekly). Policy sophistication and automated run frequency are tier-gated. Manual cleanup triggers beyond the scheduled run consume credits. |
| **Alerting** | Failure and status notifications: email, Slack, webhooks, PagerDuty. |
| **API access** | Inbound API and SQL REST API access for programmatic integration. |
| **Support** | Level of support: community, email, priority, dedicated CSM. |

---

## 4. BaseOut Pricing Tiers

Transfer credits reset monthly on billing date. No rollover. Storage is persistent and does not reset. Overages billed at end of billing period.

### Full Plan Comparison

| | **Trial** | **Launch** | **Growth** | **Pro** | **Business** | **Enterprise** |
|-|-----------|------------|------------|---------|--------------|----------------|
| **Price/mo** | $0 | $49 | $99 | $199 | $399 | Custom |
| **Price/mo (annual)** | $0 | $39 | $79 | $159 | $319 | Custom |
| **Transfer credits/mo** | 1,000 | 15,000 | 40,000 | 120,000 | 400,000 | Custom |
| **Onboarding credits** | 500 | 5,000 | 10,000 | 25,000 | 75,000 | Custom |
| **Overage rate** | None (pauses) | $0.007/cr | $0.006/cr | $0.005/cr | $0.004/cr | Negotiated |
| **R2 file storage** | 250 MB | 5 GB | 20 GB | 75 GB | 250 GB | Custom |
| **Database storage** | 100 MB | 1 GB | 5 GB | 25 GB | 100 GB | Custom |
| **DB engine** | D1 (schema) | D1 (full) | D1 (full) | Shared PG | Dedicated PG | BYODB |
| **Backup mode** | Static + Dynamic (Schema Only) | Static + Dynamic | Static + Dynamic | Static + Dynamic | Static + Dynamic | Static + Dynamic |
| **Backup frequency** | Monthly | Weekly | Weekly | Daily | Daily + Instant | Daily + Instant |
| **Snapshot retention** | 30 days | 90 days | 6 months | 12 months | 24 months | Custom |
| **Spaces** | 1 | 3 | Unlimited | Unlimited | Unlimited | Unlimited |
| **Bases per Space** | 1 | 3 | Unlimited | Unlimited | Unlimited | Unlimited |
| **Connections per Space** | 2 | 2 | 2 | 2 | 2 | 2 |
| **Max connections** | 2 | 6 | Unlimited | Unlimited | Unlimited | Unlimited |
| **Team members** | 1 | 3 | 5 | 10 | 15 | Unlimited |
| **Included restores/mo** | 1 | 2 | 3 | 5 | 15 | Unlimited |
| **Smart cleanup policy** | Basic | Time-based | Two-tier | Three-tier | Custom | Custom |
| **Smart cleanup schedule** | Monthly | Weekly | Weekly | Daily | Daily | Continuous |
| **S3 / Frame.io destinations** | No | No | Yes | Yes | Yes | Yes |
| **Custom BYOS destinations** | No | No | No | Yes | Yes | Yes |
| **Alerting** | Email | Email | Email + Slack | Email + Slack | Email + Slack + Webhooks | All + PagerDuty |
| **API access** | No | No | Inbound API | Inbound + SQL REST | Inbound + SQL REST + Direct SQL | Full |
| **Support** | Community | Email | Priority email | Priority email | Priority + chat | Dedicated CSM + SLA |

> Trial DB storage (100 MB) and Starter DB storage (250 MB) are schema-only (D1) and exist to support the Schema capability -- visualizing base structure, changelog, and health scores. Full record data requires Launch or above.

---

### Non-Public Plans

Not shown on the public pricing page. Applied via direct link, migration flow, or admin assignment.

| Plan | Price/mo | Credits/mo | Backup Mode | DB | Spaces | Bases/Space | Frequency | Purpose |
|------|----------|------------|-------------|-----|--------|-------------|-----------|---------|
| **Starter** | $29 | 5,000 | Static + Dynamic (Schema Only) | D1 (schema) | 3 | 3 | Monthly | Entry-level for users who cannot afford Launch. Not marketed publicly — discoverable by users who seek it. After 12 months, can transition to Launch standard pricing. |
| **On2Air Bridge** | $9.99 | 2,000 | Static + Dynamic (Schema Only) | D1 (schema) | 1 | 3 | Monthly | On2Air Basic/Starter migration only. Matches their current price for year 1 before auto-transitioning to Starter ($29/mo) with 60-day advance notice. |

> Both non-public plans include D1 schema-only storage, enabling the Schema capability (visualization, changelog, health score). The On2Air Bridge is applied via a personal migration link. Starter is visible only to users who find it via search or direct URL.

---

### Pay-as-you-go

No monthly plan. Purchase credit packs as needed. Credits expire 12 months from purchase. Storage billed at standard rates. All other limits are fixed at Trial level.

| Pack | Price | Credits | Rate |
|------|-------|---------|------|
| Micro | $10 | 800 | $0.0125/cr |
| Small | $25 | 2,200 | $0.0114/cr |
| Medium | $60 | 5,500 | $0.0109/cr |
| Large | $150 | 15,000 | $0.0100/cr |

> PAYG rates are intentionally above any plan tier. A user consistently spending $30+/mo on packs should upgrade to Starter.

---

### Effective Credit Rate by Plan

| Plan | $/credit (monthly billing) | $/credit (annual billing) |
|------|---------------------------|--------------------------|
| Pay-as-you-go (packs) | $0.0125 | - |
| On2Air Bridge (non-public) | $0.0050 | - |
| Starter | $0.0058 | $0.0046 |
| Launch | $0.0039 | $0.0031 |
| Growth | $0.0025 | $0.0020 |
| Pro | $0.0017 | $0.0013 |
| Business | $0.0010 | $0.0008 |
| Enterprise | Negotiated | Negotiated |

Each tier provides a meaningfully better per-credit rate than the one below, reinforcing the upgrade incentive over relying on overages.

---

### Additional Purchases (Plan Subscribers)

#### Monthly Recurring Credit Add-ons

A subscription add-on that provides a fixed number of additional credits each billing period. Credits refresh monthly alongside plan credits — they do not carry over. Priced between the plan's effective per-credit rate and the automatic overage rate, so pre-buying add-on credits is always cheaper than letting activity run to overage.

Applied as an `addon_monthly` credit bucket each billing cycle (see §8). Managed as a separate Stripe subscription item; can be added or cancelled independently of the base plan.

| Add-on | Credits/mo | Starter | Launch | Growth | Pro | Business |
|--------|-----------|---------|--------|--------|-----|----------|
| Small  | +5,000    | $28 ($0.0056/cr) | $25 ($0.005/cr) | — | — | — |
| Medium | +15,000   | — | $65 ($0.0043/cr) | $55 ($0.0037/cr) | — | — |
| Large  | +50,000   | — | — | $175 ($0.0035/cr) | $150 ($0.003/cr) | — |
| XLarge | +150,000  | — | — | — | $420 ($0.0028/cr) | $330 ($0.0022/cr) |

> Add-on rates are always cheaper than the plan's automatic overage rate. Customers who consistently buy add-ons should upgrade their plan — the plan's effective rate is always better than the add-on rate at the same credit volume.

#### One-Time Transfer Credit Blocks

Proactively purchased one-time blocks applied as a `purchased` credit bucket (see §8). Unused credits carry forward up to 12 months (unlike monthly credits which reset). Use these for known one-time spikes (large migration, initial backup of a new base), not for ongoing supplemental volume.

| Block | Starter | Launch | Growth | Pro | Business |
|-------|---------|--------|--------|-----|----------|
| 5,000 credits | $32 ($0.0064/cr) | $30 ($0.0060/cr) | — | — | — |
| 15,000 credits | $85 ($0.0057/cr) | $78 ($0.0052/cr) | $72 ($0.0048/cr) | — | — |
| 50,000 credits | — | — | $220 ($0.0044/cr) | $200 ($0.0040/cr) | $175 ($0.0035/cr) |
| 200,000 credits | — | — | — | $700 ($0.0035/cr) | $600 ($0.0030/cr) |

#### Additional Storage

Monthly recurring add-on. Persistent -- does not reset. Stacks with included storage.

| Add-on | Launch | Growth | Pro | Business |
|--------|--------|--------|-----|----------|
| +10 GB R2/mo | $7 | $6 | $5 | $4 |
| +50 GB R2/mo | $30 | $26 | $22 | $18 |
| +250 GB R2/mo | $130 | $115 | $100 | $85 |
| +10 GB DB/mo | $12 | $10 | $8 (Shared PG) | $6 (Dedicated PG) |
| +50 GB DB/mo | - | $45 | $35 (Shared PG) | $25 (Dedicated PG) |

#### Additional Seats

| Add-on | Starter | Launch | Growth | Pro |
|--------|---------|--------|--------|-----|
| Per additional seat/mo | $6 | $8 | $10 | $12 |

> Business and Enterprise include unlimited seats. For Starter/Launch/Growth/Pro, upgrading the plan is more cost-effective than adding many individual seats.

---

## 5. On2Air -> BaseOut Tier Mapping

### Estimated Monthly Credit Usage (static backup equivalent)

Assumes ~200 KB average attachment size, users near their plan limits:

| On2Air Plan | Bases | Records | Attach. Data | Frequency | Credits/run | Runs/mo | Est. Credits/mo |
|-------------|-------|---------|--------------|-----------|-------------|---------|-----------------|
| Starter | 1 | 50,000 | ~500 MB | Monthly | ~65 | 1 | ~65 |
| Essentials | 15 | 250,000 | ~5 GB | Weekly | ~525 | 4 | ~2,100 |
| Professional | 50 | 1,000,000 | ~100 GB | Daily | ~4,300 | 30 | ~129,000 |
| Premium | 250 | 5,000,000 | ~200 GB | Hourly | ~14,750 | 720 | ~10,620,000* |

> *Premium at full hourly utilization across all bases is Enterprise-scale. In practice most Premium users don't simultaneously max every limit.

### Recommended Tier Mappings

| On2Air Plan | Old Price | -> BaseOut Plan | Standard Price | Notes |
|-------------|-----------|----------------|---------------|-------|
| Basic (Free) | $0 | **Trial** | $0 | Direct equivalent |
| Starter | $9.99 | **On2Air Bridge** (yr 1) then Starter | $9.99 -> $29 | Bridge holds them at $9.99 for year 1 then auto-transitions to non-public Starter ($29/mo); 2,000 credits/mo covers typical monthly backup usage |
| Essentials | $29.99 | **Starter** (non-public) or **Launch** | $29 or $49 | Starter at $29 is cheaper than their current $29.99. Launch at $49 gives full Dynamic backup and weekly frequency — an easy upgrade story |
| Professional | $49.99 | **Launch** | $49 | BaseOut Launch is actually slightly cheaper. 15,000 credits/mo far exceeds typical usage. Step up to Growth for unlimited spaces/bases |
| Premium | $79.99 | **Growth** | $99 | Growth (40,000 credits/mo, weekly, unlimited) covers typical Premium usage; daily frequency users -> Pro |
| Enterprise | Custom | **Pro / Business / Enterprise** | $199+ | Negotiate based on actual base count and frequency needs |

---

## 6. On2Air Migration Strategy

### Approach

BaseOut pricing is higher than On2Air but reflects a meaningfully more capable product. The migration strategy is designed to minimize price shock: On2Air Essentials customers actually land on a cheaper plan (Starter at $29 vs. their current $29.99), and mid/upper-tier customers receive year-1 discounts that match or closely approximate their existing price before stepping up to standard rates.

### Year-1 Migration Pricing

Annual billing only for discounted rates. After year 1, accounts move to standard annual pricing automatically with 60-day advance notice.

| On2Air Plan | Old Price | -> BaseOut Plan | Standard Price | Migration Price (Yr 1) | After Yr 1 |
|-------------|-----------|----------------|---------------|------------------------|------------|
| Basic | $0 | Trial | $0 | $0 | Stay on Trial or upgrade |
| Starter | $9.99 | **On2Air Bridge** (non-public) | N/A | **$9.99/mo** | Auto-transitions to Starter non-public ($29/mo) with 60-day notice |
| Essentials | $29.99 | **Starter** (non-public) | $29/mo | **No discount needed** -- Starter at $29 is already cheaper than their current $29.99 | $29/mo (or upgrade to Launch at $39/mo annual) |
| Professional | $49.99 | **Launch** | $49/mo | **$39/mo** (standard annual rate) -- cheaper than their current price | $39/mo annual (no change) |
| Premium | $79.99 | **Growth** | $99/mo | **$79/mo** (annual, year 1) | $79/mo annual (standard rate -- no change after yr 1) |
| Enterprise | Custom | **Pro / Business / Enterprise** | $199+ | Negotiate 20-30% year-1 discount | Standard custom rate |

> The migration story is compelling: Essentials customers get a price cut. Professional customers pay almost the same. Premium customers pay their current rate for year 1 and then step up. Only Enterprise requires negotiation.

### Migration Onboarding Credit Grant

In addition to the year-1 pricing, migrating customers receive a one-time onboarding credit grant (separate from the standard onboarding bucket) to absorb their initial full backup without touching their first monthly allotment:

| On2Air Plan | -> BaseOut Plan | Migration Credit Grant | Rationale |
|-------------|----------------|----------------------|-----------|
| Starter | On2Air Bridge | 2,000 credits | Covers ~30 typical monthly backup runs |
| Essentials | Starter | 10,000 credits | ~2 months of typical static backup usage |
| Professional | Launch | 30,000 credits | ~2 months of typical usage at weekly frequency |
| Premium | Growth | 80,000 credits | ~2 months of typical usage at weekly frequency; runway to audit actual patterns |
| Enterprise | Negotiated | Custom | Agreed with account team |

### Migration Messaging

Key points to communicate to On2Air users:

1. **Static backups work exactly the same** -- same destinations, same process, same data you already rely on
2. **Most customers pay the same or less in year 1** -- Essentials customers actually get a price cut at launch
3. **No more artificial limits** -- no caps on records, attachments, or bases; credits reflect actual usage
4. **Dynamic backups are now available** -- store your data in a BaseOut-managed database for SQL access, instant restore, and advanced capabilities
5. **Migrate within 90 days to lock in your rate** -- migration pricing and credit grants require signing up before the window closes

---

## 7. Open Questions & Decisions Needed

- [ ] **Incremental sync threshold**: For dynamic backups, what counts as a "changed" record? Full field-level diff, or row-level change detection? This affects transfer credit accuracy.
- [ ] **Attachment metering**: How is attachment MB measured for static backups -- via Airtable metadata at schedule time, or measured during actual download?
- [ ] **Overage cap**: Consider a monthly overage cap (e.g., 2x monthly plan credits) to protect users from runaway costs from a misconfigured high-frequency backup.
- [ ] **Migration window**: Recommend a 90-day window after BaseOut launch for On2Air users to claim migration pricing.
- [ ] **On2Air Bridge auto-transition**: After year 1, auto-move to Starter annual or require action? Auto-move with 60-day notice is recommended to avoid churn from bill shock.
- [ ] **Enterprise floor**: Define the minimum credit volume or use case that qualifies for Enterprise vs. Business.
- [ ] **First backup attachment rate**: Decide whether to apply a reduced credit rate for the initial attachment transfer of a newly-added base, or rely solely on the onboarding credit bucket to absorb the cost.

---

## 8. Credit System Database Architecture

This section documents the database design needed to implement the credit system. It is intended as a reference for schema implementation and should be read alongside the Drizzle schema file (`master-schema.ts`).

### 8.1 Design Principles

- **Credits meter transfer activity only.** Storage is billed separately in dollars. Credits are never consumed by data sitting at rest.
- **Multiple credit buckets per organization.** Each bucket has its own type, amount, and expiration. This supports plan credits, onboarding bonuses, promotional grants, and purchased top-ups all coexisting on one account.
- **Consume soonest-expiring credits first.** When a debit occurs, the system pulls from the bucket that expires earliest, minimizing waste.
- **Immutable transaction ledger.** Credit usage is never edited or deleted -- only appended. Balances are always derived from the ledger.
- **Feature limits are data, not code.** Plan limits (spaces, bases, backup frequency, etc.) are stored in the database and read at runtime, not hardcoded. This allows limit changes without deploys.

---

### 8.2 Core Tables

#### `plan_definitions`
The source of truth for each plan tier. Synced alongside Stripe product metadata.

| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid | Primary key |
| `name` | text | Plan identifier: `trial`, `starter`, `launch`, `growth`, `pro`, `business`, `enterprise` |
| `display_name` | text | Human-readable name shown in UI |
| `stripe_product_id` | text | Corresponding Stripe Product ID |
| `monthly_price_cents` | integer | Monthly price in cents (0 for trial/enterprise) |
| `annual_price_cents` | integer | Annual price in cents |
| `is_public` | boolean | False for Bridge and internal plans |
| `is_active` | boolean | Soft-disable retired plans |
| `sort_order` | integer | Controls display order on pricing page |
| `created_at` | timestamp | |

---

#### `plan_limits`
Stores all hard limits for each plan as a key-value structure. Keeps limit additions schema-free -- new limits can be added without a migration.

| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid | Primary key |
| `plan_id` | uuid | FK to `plan_definitions` |
| `limit_key` | text | The specific limit identifier (see table below) |
| `limit_value` | text | Value stored as text; parsed by application layer. `-1` means unlimited |
| `limit_type` | text | `count`, `boolean`, `enum`, `storage_gb`, `days` |

**Defined limit keys:**

| `limit_key` | `limit_type` | Example Values |
|-------------|-------------|----------------|
| `max_spaces` | count | `1`, `3`, `5`, `-1` (unlimited) |
| `max_bases_per_space` | count | `1`, `3`, `5`, `-1` |
| `connections_per_space` | count | `2`, `-1` |
| `max_team_members` | count | `1`, `2`, `3`, `5`, `15`, `-1` |
| `backup_frequency_tier` | enum | `monthly`, `weekly`, `daily`, `instant` |
| `instant_backup_enabled` | boolean | `true`, `false` |
| `manual_runs_per_month` | count | `0`, `2`, `5`, `-1` |
| `included_restores_per_month` | count | `1`, `2`, `3`, `5`, `15`, `-1` |
| `smart_cleanup_frequency` | enum | `none`, `monthly`, `weekly`, `daily`, `continuous` |
| `smart_cleanup_policy_tier` | enum | `basic`, `time_based`, `two_tier`, `three_tier`, `custom` |
| `r2_storage_gb` | storage_gb | `0.25`, `5`, `20`, `75`, `250` |
| `db_storage_gb` | storage_gb | `0.1`, `0.25`, `1`, `5`, `25`, `100` |
| `db_engine` | enum | `none`, `d1_schema`, `d1_full`, `shared_pg`, `dedicated_pg`, `byodb` |
| `changelog_retention_days` | days | `30`, `90`, `180`, `365`, `730`, `-1` |
| `data_alert_rules` | count | `0`, `5`, `25`, `-1` |
| `custom_reports` | count | `0`, `5`, `-1` |
| `custom_dashboards` | count | `0`, `3`, `-1` |
| `capability_schema` | boolean | `true`, `false` |
| `capability_data` | boolean | `true`, `false` |
| `capability_automations` | boolean | `true`, `false` |
| `capability_ai_docs` | boolean | `true`, `false` |
| `capability_ai_full` | boolean | `true`, `false` |
| `capability_governance` | boolean | `true`, `false` |
| `capability_sql_rest` | boolean | `true`, `false` |
| `capability_direct_sql` | boolean | `true`, `false` |
| `s3_destination_enabled` | boolean | `true`, `false` |
| `byos_custom_enabled` | boolean | `true`, `false` |

---

#### `plan_credit_config`
Credit allotments and overage rates per plan. Separate from limits to keep billing configuration clean.

| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid | Primary key |
| `plan_id` | uuid | FK to `plan_definitions` |
| `monthly_credits` | integer | Credits included per billing period |
| `onboarding_credits` | integer | One-time credits granted at signup (expires in 30 days) |
| `overage_rate_cents_per_credit` | integer | Cost per overage credit in cents |
| `r2_overage_rate_cents_per_gb` | integer | R2 storage overage in cents per GB/month |
| `db_overage_rate_cents_per_gb` | integer | DB storage overage in cents per GB/month |
| `restore_overage_credits_table` | integer | Credits per table-level restore beyond included |
| `restore_overage_credits_base` | integer | Credits per base-level restore (records only) |
| `restore_overage_credits_full` | integer | Credits per base-level restore (records + attachments) |

**Populated values by plan:**

| Plan | Monthly Credits | Onboarding Credits | Overage Rate |
|------|-----------------|--------------------|--------------|
| Trial | 1,000 | 500 | None (pauses) |
| Starter | 5,000 | 2,000 | $0.008/credit |
| Launch | 15,000 | 5,000 | $0.007/credit |
| Growth | 40,000 | 10,000 | $0.006/credit |
| Pro | 120,000 | 25,000 | $0.005/credit |
| Business | 400,000 | 75,000 | $0.004/credit |
| Enterprise | Custom | Custom | Negotiated |

---

#### `credit_operation_costs`
Lookup table for how many credits each operation type consumes per unit. Stored in the database so rates can be adjusted without deploys.

| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid | Primary key |
| `operation_type` | text | Unique identifier for the operation |
| `credits_per_unit` | integer | Credits consumed per unit of work |
| `unit_description` | text | Human-readable unit (for display and documentation) |
| `is_active` | boolean | Allows retiring operation types |
| `effective_from` | timestamp | When this rate took effect (supports rate history) |
| `notes` | text | Internal notes |

**Defined operation types:**

| `operation_type` | `credits_per_unit` | Unit |
|-----------------|-------------------|------|
| `schema_backup` | 5 | Per base, per run |
| `record_transfer` | 1 | Per 1,000 records |
| `attachment_transfer` | 1 | Per 50 MB of attachment data |
| `restore_table` | 15 | Per table-level restore |
| `restore_base_records` | 40 | Per base restore (records only) |
| `restore_base_full` | 75 | Per base restore (records + attachments) |
| `api_call_inbound` | 1 | Per 100 inbound API calls |
| `api_call_sql_rest` | 1 | Per 50 SQL REST queries |
| `ai_doc_generation` | 10 | Per AI documentation generation run |
| `ai_schema_insight` | 5 | Per AI schema analysis run |
| `smart_cleanup_manual` | 10 | Per manual cleanup trigger (beyond automated schedule) |
| `manual_backup_trigger` | 10 | Per on-demand backup trigger (beyond included count) |

---

#### `credit_buckets`
The central table for credit management. Each organization can have multiple concurrent buckets of different types and expirations.

| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid | Primary key |
| `organization_id` | uuid | FK to organizations |
| `bucket_type` | text | `plan_monthly`, `onboarding`, `promotional`, `purchased`, `migration`, `manual_grant` |
| `total_credits` | integer | Credits allocated to this bucket |
| `used_credits` | integer | Credits consumed from this bucket (updated on each transaction) |
| `expires_at` | timestamp | When unused credits expire. Null = never expires |
| `billing_period_start` | timestamp | For `plan_monthly` buckets: start of billing period |
| `billing_period_end` | timestamp | For `plan_monthly` buckets: end of billing period (= expires_at) |
| `is_active` | boolean | False when bucket is exhausted or expired |
| `source_reference` | text | Stripe invoice ID, promo code, migration ID, etc. |
| `created_at` | timestamp | |
| `metadata` | jsonb | Arbitrary notes (promo campaign, CSM notes, etc.) |

**Computed property** (not stored; calculated from `total_credits - used_credits`):
- `remaining_credits` — available credits in this bucket

**Bucket types and their behavior:**

| `bucket_type` | Expiration | Created by | Notes |
|--------------|------------|------------|-------|
| `plan_monthly` | End of billing period | Stripe `invoice.paid` webhook | Created/renewed each billing cycle. Old period bucket is closed, new one opened. |
| `addon_monthly` | End of billing period | Stripe `invoice.paid` webhook | Created alongside `plan_monthly` for each active monthly credit add-on subscription. Refreshes every cycle; unused credits do not carry over. |
| `onboarding` | 30 days after org creation | Org signup flow | One-time per organization. Absorbs large initial backup costs. |
| `promotional` | Per campaign config | Admin / marketing tool | Promo codes, referral rewards, etc. |
| `purchased` | 12 months from purchase | Stripe one-time charge | One-time credit block purchases. |
| `migration` | 90 days from migration date | On2Air migration flow | One-time grant for migrating On2Air customers. |
| `manual_grant` | Set by admin | Internal admin panel | CSM goodwill credits, support resolutions. |

---

#### `credit_transactions`
Immutable append-only ledger. Every credit debit or grant is recorded here. Balances are derived from this table, never stored independently.

| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid | Primary key |
| `organization_id` | uuid | FK to organizations |
| `bucket_id` | uuid | FK to `credit_buckets` — which bucket was affected |
| `credits_amount` | integer | Negative for consumption, positive for grants/refunds |
| `operation_type` | text | FK to `credit_operation_costs.operation_type` (null for grants) |
| `entity_type` | text | `backup_run`, `restore`, `api_call`, `cleanup`, `grant` |
| `entity_id` | uuid | ID of the related entity (backup run, restore job, etc.) |
| `is_initial_backup` | boolean | True when this is the first backup of a base (aids analysis of first-run spikes) |
| `is_overage` | boolean | True when this transaction was charged to overage rather than a bucket |
| `unit_count` | integer | Quantity transferred (records, MB, calls, etc.) |
| `unit_type` | text | `records`, `mb`, `calls`, `queries` |
| `created_at` | timestamp | |
| `metadata` | jsonb | Additional context (base_id, space_id, records_count, mb_transferred, etc.) |

---

#### `organization_billing_settings`
Per-organization configuration for overage behavior and credit alerting. Allows customers to define a dollar cap on overage spend so that activity pauses before an unexpected bill accumulates.

| Column | Type | Description |
|--------|------|-------------|
| `organization_id` | uuid | PK, FK to organizations |
| `overage_mode` | text | `auto` — allow overage and bill at end of period; `cap` — pause when dollar cap is reached |
| `overage_dollar_cap_cents` | integer | Maximum overage spend allowed per billing period in cents. `null` = no cap. When reached in `cap` mode, activity pauses and the org is notified. |
| `overage_cap_action` | text | `pause` — block further creditable activity; `notify_only` — send alert but allow activity to continue |
| `overage_alert_thresholds` | jsonb | Dollar-amount thresholds at which to send alerts before the cap is reached. E.g., `[1000, 2500, 5000]` (cents). Separate from the cap itself. |
| `credit_alert_thresholds` | jsonb | Percentage of monthly plan credits consumed at which to send alerts. E.g., `[50, 75, 90, 100]`. |
| `updated_at` | timestamp | |

> The overage dollar cap is enforced in real-time during credit consumption (see §8.3). After the cap is hit, the org can either raise the cap, purchase additional credits, or upgrade their plan to resume activity.

---

#### `credit_addon_subscriptions`
Tracks monthly recurring credit add-on subscriptions. Each active add-on generates an `addon_monthly` credit bucket every billing cycle alongside the `plan_monthly` bucket.

| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid | Primary key |
| `organization_id` | uuid | FK to organizations |
| `addon_size` | text | `small`, `medium`, `large`, `xlarge` — determines credits and price |
| `credits_per_month` | integer | Additional credits granted each billing period |
| `price_cents_per_month` | integer | Monthly cost of this add-on subscription |
| `stripe_subscription_item_id` | text | The Stripe subscription item ID for this add-on (same subscription as the base plan) |
| `is_active` | boolean | False when cancelled; no bucket is created on next renewal |
| `started_at` | timestamp | When the add-on was first activated |
| `cancelled_at` | timestamp | When cancelled (null if still active) |
| `created_at` | timestamp | |

> Multiple add-ons can coexist — an org could subscribe to both a Small (+5K/mo) and a Medium (+15K/mo) add-on simultaneously, generating two `addon_monthly` buckets each cycle. Buckets from add-ons expire at the same time as the period's `plan_monthly` bucket and do not roll over.

---

#### `organization_credit_balance` (materialized cache)
A cached rollup of each organization's current credit state. Rebuilt from `credit_transactions` and `credit_buckets` on each transaction, or on a short interval. Never used as source of truth -- always recomputable from the ledger.

| Column | Type | Description |
|--------|------|-------------|
| `organization_id` | uuid | PK |
| `total_available` | integer | Sum of remaining credits across all active non-expired buckets |
| `plan_credits_remaining` | integer | Remaining in current `plan_monthly` bucket |
| `addon_credits_remaining` | integer | Remaining in all active `addon_monthly` buckets combined |
| `supplemental_credits_remaining` | integer | Remaining in all other non-plan buckets (onboarding, purchased, promo, etc.) |
| `current_period_overage` | integer | Credits consumed as overage this billing period |
| `current_period_overage_cents` | integer | Dollar value of overage this period in cents (overage credits × plan's overage rate) |
| `overage_cap_reached` | boolean | True when the org's dollar cap has been hit and activity is paused |
| `last_calculated_at` | timestamp | When this cache was last refreshed |

---

### 8.3 Credit Consumption Logic

When a creditable operation occurs (backup run, restore, API call, etc.), the system executes the following:

```
1. Calculate total credits owed for the operation
   (look up operation_type in credit_operation_costs, multiply by unit count)

2. Load all active, non-expired credit_buckets for the organization
   ORDER BY expires_at ASC NULLS LAST, bucket_type priority

   Priority within same expiration:
     onboarding → plan_monthly → addon_monthly → promotional → purchased → manual_grant

3. For each bucket (in order):
   a. Determine how many credits remain in this bucket
   b. Debit as many credits as available (up to the amount owed)
   c. Record a credit_transaction for this bucket debit
   d. Update bucket.used_credits
   e. If amount_owed is now 0, stop

4. If all buckets exhausted and credits still owed:
   a. Check organization_billing_settings.overage_dollar_cap_cents
      -- If cap is set and (current_period_overage_cents + remaining_owed × rate) > cap:
         - If overage_cap_action = 'pause':  block the operation, set overage_cap_reached = true,
           send notification, return error to caller
         - If overage_cap_action = 'notify_only': send notification, allow overage to proceed
      -- Check overage_alert_thresholds and fire any threshold alerts not yet sent this period
   b. Record the remainder as overage (is_overage = true)
   c. Accumulate overage credits + dollar value in organization_credit_balance cache
   d. Overage billed via Stripe metered usage at end of period

5. Update organization_credit_balance cache
   -- Recompute current_period_overage_cents = overage_credits × plan overage_rate_cents_per_credit
   -- Update overage_cap_reached flag
```

---

### 8.4 The Initial Backup Problem

**Problem:** When a base is connected to BaseOut for the first time, the initial backup transfers the entire attachment dataset -- potentially hundreds or thousands of MB. Subsequent backups only transfer incremental new/changed attachments. This creates a large, unexpected credit spike in the first month that does not reflect ongoing usage.

**Example:**
- A base with 50,000 records and 10 GB of attachments
- Initial backup attachment transfer: 10,000 MB / 50 MB = **200 credits** in one run
- Week 2 incremental: 200 new attachments, 40 MB → **1 credit**
- The initial run is 200x more expensive than a typical run

**Solution: Two-layer approach**

**Layer 1 — Onboarding credit bucket (primary mitigation)**
Every organization receives a one-time onboarding credit bucket at signup that expires in 30 days. This bucket is consumed first (soonest-expiring), so the initial backup draws from onboarding credits before touching the monthly plan allotment.

Onboarding credits are sized to absorb a realistic initial full backup at each tier:

| Plan | Onboarding Credits | Covers Initial Backup Of... |
|------|-------------------|-----------------------------|
| Trial | 500 | ~25K records + 500 MB attachments |
| Starter | 2,000 | ~100K records + 2 GB attachments |
| Launch | 5,000 | ~250K records + 5 GB attachments |
| Growth | 10,000 | ~500K records + 10 GB attachments |
| Pro | 25,000 | ~1M records + 25 GB attachments |
| Business | 75,000 | ~3M records + 75 GB attachments |

**Layer 2 — Initial backup flag + analytics**
Every `credit_transaction` row includes `is_initial_backup = true` when it is the first backup of a given base. This flag:
- Allows the dashboard to explain the credit spike with context ("Your first backup of Base X used 180 credits. Future backups will use ~2 credits.")
- Allows BaseOut to monitor first-run costs across the customer base and calibrate onboarding credit amounts over time
- Provides data to support CSM interventions if a customer's first backup exhausts their onboarding bucket (trigger a support notification)

**Detecting a first backup:**
A backup run is flagged as initial for a base when no prior completed `backup_run` exists for that `(space_id, base_id)` pair.

---

### 8.5 Billing Period Lifecycle

The lifecycle of credits across a billing period:

```
1. SUBSCRIPTION CREATED (or renewed)
   -- Stripe fires invoice.paid webhook
   -- Create new plan_monthly credit_bucket:
        total_credits = plan_credit_config.monthly_credits
        expires_at    = current_period_end
   -- For each active credit_addon_subscription, create an addon_monthly credit_bucket:
        total_credits = addon_subscription.credits_per_month
        expires_at    = current_period_end  (same as plan bucket — no rollover)
   -- Close all previous period buckets of type plan_monthly and addon_monthly
      (mark is_active = false; unused credits forfeited)
   -- Reset overage_cap_reached = false in organization_credit_balance

2. DURING THE PERIOD
   -- Operations consume credits from buckets (consumption order per §8.3)
   -- Overage dollar cap checked in real-time on each operation (§8.3 step 4)
   -- Overage accumulates if all buckets exhausted and cap not blocking
   -- Dashboard shows live credit balance from organization_credit_balance cache

3. END OF PERIOD
   -- Stripe usage record updated with overage credit count for the period
   -- Overage billed via Stripe metered billing at plan's overage_rate_cents_per_credit
   -- New plan_monthly and addon_monthly buckets created for next period (step 1 repeats)

4. SUPPLEMENTAL BUCKETS (purchased, promotional, migration, onboarding)
   -- Created independently of billing cycle
   -- Consumed in priority order per §8.3
   -- Expire on their own schedule (not tied to billing period)
   -- Remaining balance on expired supplemental buckets is forfeited
```

---

### 8.6 Restore Credit Accounting

Restores are an activity operation that consumes credits. Each plan includes a monthly restore allotment tracked as a limit in `plan_limits` (`included_restores_per_month`). Once the included count is exhausted, each additional restore consumes credits.

The restore count is tracked separately from the credit ledger:

```
organization_restore_usage (
  id                    uuid
  organization_id       uuid
  billing_period_start  timestamp
  billing_period_end    timestamp
  restores_used         integer     -- incremented on each restore
  restores_included     integer     -- copied from plan at period start
  created_at            timestamp
)
```

When a restore is requested:
1. Check `restores_used < restores_included` → free restore, increment counter
2. If exhausted → debit credits from the credit bucket system per the restore type (table / base / full)
3. Record the restore operation in `credit_transactions` with `operation_type = restore_*`

---

### 8.7 Smart Rolling Cleanup Credit Accounting

Smart Rolling Cleanup automated runs (executed on the plan's configured schedule) are free -- they are a maintenance operation, not a transfer. Only manual triggers beyond the scheduled run consume credits.

Track automated cleanup runs for audit purposes:

```
cleanup_runs (
  id               uuid
  organization_id  uuid
  space_id         uuid
  trigger_type     text   -- 'scheduled' | 'manual'
  snapshots_deleted integer
  storage_freed_gb  decimal
  credits_used      integer  -- 0 for scheduled, >0 for manual triggers
  executed_at      timestamp
)
```

When a manual cleanup is triggered:
1. Debit `smart_cleanup_manual` credits (10 credits per trigger) from the credit bucket system
2. Record in `credit_transactions`
3. Record in `cleanup_runs` with `trigger_type = 'manual'` and `credits_used = 10`
