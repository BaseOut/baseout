# Baseout — Pricing Strategy Briefing

**Prepared for:** External pricing-strategy consultant
**Date:** July 2, 2026
**Sources:** `shared/Baseout_PRD.md` (v1.1/1.4), `shared/Baseout_Features.md` (v1.1, Apr 23 2026 — authoritative for pricing), `shared/Pricing_Credit_System.md`, `shared/Baseout_Implementation_Plan.md`, plus a full sweep of the implemented codebase (July 2026).

**How to read this:** Sections 1–4 describe the product and its feature set. Section 5 documents the pricing model as currently designed in the specs. Section 6 is the catalog of pricing levers (metrics) available to you. Section 7 covers the cost structure. Section 8 covers customer segments and willingness-to-pay signals. Section 9 is a reality check on what is actually built today versus designed on paper. Section 10 lists internal inconsistencies and open questions we need your input on. Nothing here is confidential to the engineering team — challenge any of it.

---

## 1. Product Overview

### 1.1 What Baseout is

> "Baseout is the backup, restore, and data intelligence layer for Airtable — giving platform admins real-time protection, schema visibility, and direct SQL access to their own data."

Baseout is a B2B SaaS utility that automatically backs up Airtable data (schema, records, attachments, and — via user submission — automations and interfaces) to storage the customer controls or to Baseout-managed storage, provides restore, and layers data-intelligence features on top: schema visualization and changelogs, base health scoring, documentation tooling, usage analytics, and (on higher tiers) a live SQL copy of the customer's data with API access.

V1 is Airtable-only. The architecture is deliberately multi-platform: V2 adds platforms (Notion, HubSpot, Salesforce) with per-platform subscriptions under one billing relationship.

### 1.2 Business context — this is a relaunch, not a cold start

Baseout is the full rebrand and next-generation replacement of **On2Air Backups**, an established Airtable backup product with **~200 paying customers** who will be migrated onto Baseout tiers. This matters for pricing in three ways:

1. There is an existing revenue base and known price points ($9.99–$79.99/mo) that anchor a portion of the customer base.
2. On2Air was, by the team's own assessment, **historically underpriced relative to value delivered**. Baseout's pricing is intentionally higher and justified by a more capable product.
3. A detailed migration strategy already exists (year-1 bridge pricing, non-public plans, migration credit grants — see §5.6 and §8.3) that any new pricing must remain compatible with.

### 1.3 Primary customer

The **Airtable platform admin**: internal IT / RevOps / BizOps owners and independent Airtable consultants who manage workspaces for multiple client organizations. Technically capable (comfortable with OAuth, storage configuration, SQL), professionally accountable for data protection. The product presents as a professional operations console, not a consumer tool.

Secondary (V2): developers building on the hosted SQL layer; enterprise IT/compliance officers (SOC 2, SSO, data sovereignty).

### 1.4 Pain points solved (the value story)

1. **Fear of data loss** — scheduled backups plus a full restore pipeline.
2. **Governance requires an external copy** — Airtable's native snapshots live inside Airtable and don't satisfy data-governance best practice; Baseout stores data *outside* Airtable.
3. **No visibility into schema complexity/health** — visualization, change history, health scores.
4. **Data locked in Airtable's proprietary format** — a queryable SQL database of your own data.

### 1.5 Competitive position

| Competitor | Status | Baseout's edge |
|---|---|---|
| Airtable native snapshots | Active (free) | Not an external/governed copy; no schema intelligence; no SQL |
| Sync Inc | Out of business | — |
| Whalesync | Narrowing to a marketing niche | Baseout stays general-purpose |
| Coefficient | Active | Spreadsheet sync focus, not deep backup/schema intelligence |
| DIY scripts | Common | Convenience, maintenance, and feature depth |

Two claimed unique differentiators worth pressure-testing in pricing research: (a) the **most storage destinations** in the market, including the only OneDrive support; (b) **BYOS/BYODB** (bring your own storage / database) — competitors are moving away from this, and it is the privacy story for static-tier customers (on static BYOS plans, record data never touches Baseout servers; it streams through memory to the customer's own storage).

---

## 2. The Two Product Architectures That Shape Pricing

Every tier decision hangs off one architectural split. This is the single most important thing to internalize:

| | **Static backup** | **Dynamic backup** |
|---|---|---|
| What it is | Flat-file export (CSV/JSON) per run to a storage destination | Data continuously synced into a Baseout-managed (or customer) database |
| Where data lives | Customer's own storage (BYOS) or Baseout-managed R2 | Cloudflare D1 → Shared PostgreSQL → Dedicated PostgreSQL → BYODB, by tier |
| Privacy posture | On BYOS, record data **never stored** on Baseout servers | Customer explicitly opts in to hosted storage |
| Cost profile | Pure transfer cost, re-transfers the full dataset every run — cost scales with **volume × frequency** | Big initial sync, then cheap incremental deltas — but **ongoing storage cost at rest** |
| What it unlocks | Backup + restore only | SQL access, SQL REST API, real-time sync, Data/Automations/Interfaces/AI/Analytics capabilities |

The upsell narrative is: everyone gets static backup; dynamic is the value ladder (schema-only on entry tiers → full database with SQL access on upper tiers). All the data-intelligence features that differentiate Baseout from "just a backup tool" require dynamic mode — so the dynamic database tier is simultaneously a **capability gate**, a **COGS driver**, and the **trust/privacy trade-off** the customer is compensated for with features.

---

## 3. Feature Inventory (the 9 Capabilities)

Features are organized into nine "Capabilities," each independently tier-gated and (in V2) platform-specific. Summary of what each contains and its tier availability (full matrices in `Baseout_Features.md` §6–§14):

| Capability | What's in it | Availability |
|---|---|---|
| **Backup** (core) | Scheduled backups (monthly→weekly→daily→instant/webhook), manual runs, static + dynamic modes, 7+ storage destinations, restore (base/table, point-in-time, always to new data), post-restore verification, audit reports, smart rolling cleanup | All tiers (always on); frequency, mode, destinations, restores gated by tier |
| **Schema** | Auto-generated schema visualization (ERD/node graph), schema changelog (retention tiered 30d→24mo), health score with configurable audit rules, user-authored schema Documents (rich text, tags, diagrams), AI-generated docs (Pro+), rename/describe write-back (Pro+, V2), diagram export (PNG→SVG→PDF→embed by tier) | Basic on Trial/Starter; full from Launch |
| **Data** | Record count dashboards, per-table metrics, data changelog, growth trends, data alerts (rule counts tiered 5/25/unlimited), insights, PII detection (Business+), reports/visualization | Launch+ (requires full dynamic DB) |
| **Automations** | Backup + changelog + docs + insights for Airtable automations (user-submitted via intake — Airtable's API doesn't expose them) | Launch+ per Features; requires dynamic |
| **Interfaces** | Same treatment for Airtable interfaces | Launch+ per Features; requires dynamic |
| **AI** | AI-assisted documentation and schema insights (Pro+, V1); MCP server, RAG, hosted/embeddable chatbot, vector DB (Business+, V2); BYO model (Enterprise, V2) | Pro+ (docs), Business+ (rest, V2) |
| **Analytics** | Basic usage metrics (all), record/storage trend charts, custom reports (5/unlimited) and dashboards (3/unlimited) on Business+, scheduled report delivery, PDF/CSV export | Basic on all; full Business+ |
| **Governance** | Data quality rules, classification, lineage, retention policies, access controls, audit trail, PII scanning, SOC 2/GDPR tooling | Business+ only, entirely V2 |
| **Integrations** | Baseout Inbound API (Growth+), SQL REST API (Pro+), Direct SQL access via connection string (Business+), inbound webhooks (Pro+), Zapier/Make connectors (Business+, V2), Airtable writeback (Enterprise, V2) | Growth+ ladder |

Supporting systems that also carry tier gates: **data intake methods** (manual forms Starter+ → Airtable scripts/automation templates Launch+ → custom extensions Pro+ → Enterprise API), and **notification channels** (email/in-app all tiers → Slack Growth+ → outbound webhook Business+ → Teams/PagerDuty Enterprise).

**V1 vs V2 scope (matters for what you can price at launch):** V1 ships backup/restore/cleanup, schema visualization + changelog + health score, schema documents, basic data metrics, automations/interfaces backup via intake, AI-assisted documentation, basic analytics, Inbound API, SQL REST API, and Direct SQL. V2 holds MCP/RAG/chatbot, Governance (whole capability), third-party connectors, custom dashboards, write-back, and multi-platform. Several tier differentiators for Business+ (Governance, MCP/RAG, Zapier) are therefore **promises, not shipped features, at launch** — see §9.

---

## 4. Organizational Model (What the Customer Buys Containers Of)

```
Organization (billing entity — one Stripe subscription)
├── Connection(s) — OAuth links to Airtable (and later, other platforms + storage providers)
└── Space(s) — the primary unit of configuration
    ├── Backup configuration (frequency, mode, destination, base selection)
    ├── Its own database tier (D1 / Shared PG / Dedicated PG / BYODB)
    ├── Its own storage destination
    └── Base(s) — Airtable bases; each contains tables/fields/records/attachments
```

Users belong to Organizations; one user (e.g., a consultant) can belong to many Organizations. Spaces, bases-per-Space, connections, and team members are all counted, limited resources — i.e., candidate pricing metrics. In V2, a platform is added per-Organization as an additional Stripe subscription item, with a planned multi-platform discount (15–20%, TBD) on the second and subsequent platforms.

---

## 5. The Pricing Model As Currently Designed

This is the model in the specs (`Baseout_Features.md` §3–§5.6 + `Pricing_Credit_System.md`), which stakeholders have iterated to "resolved" status but which has **not** been implemented in billing code yet (§9). Treat it as the current best internal thinking, fully open to your challenge.

### 5.1 Public tiers

| | **Trial** | **Launch** | **Growth** | **Pro** | **Business** | **Enterprise** |
|---|---|---|---|---|---|---|
| Monthly price | $0 | $49 | $99 | $199 | $399 | Custom |
| Annual (per mo) | $0 | $39 | $79 | $159 | $319 | Custom |
| Transfer credits/mo | 1,000 | 15,000 | 40,000 | 120,000 | 400,000 | Custom |
| Onboarding credits (one-time) | 500 | 5,000 | 10,000 | 25,000 | 75,000 | Custom |
| Credit overage rate | None (pauses) | $0.007 | $0.006 | $0.005 | $0.004 | Negotiated |
| Backup frequency | Monthly | Weekly | Weekly | Daily | Daily + Instant | Daily + Instant |
| Manual runs/mo | 0 | 2 | 5 | Unlimited | Unlimited | Unlimited |
| Database (dynamic mode) | D1 schema-only | D1 full | D1 full | Shared PostgreSQL | Dedicated PostgreSQL | BYODB |
| R2 file storage | 250 MB | 5 GB | 20 GB | 75 GB | 250 GB | Custom |
| DB storage | 100 MB | 1 GB | 5 GB | 25 GB | 100 GB | Custom |
| Snapshot retention | 30 days | 90 days | 6 months | 12 months | 24 months | Custom |
| Spaces | 1 | 3 | Unlimited | Unlimited | Unlimited | Unlimited |
| Bases per Space | 1 | 3 | Unlimited | Unlimited | Unlimited | Unlimited |
| Team members | 1 | 3 | 5 | 10 | 15 | Unlimited |
| Included restores/mo | 1 | 2 | 3 | 5 | 15 | Unlimited |
| Support | Community | Email | Priority email | Priority email | Priority + chat | CSM + SLA |

No free tier — trial only. Per the PRD, the trial is 7 days **and** 1 backup run, data-capped (1,000 records / 5 tables / 100 attachments), no credit card required; a $0 Stripe subscription is created at signup and swapped to a paid price on upgrade. (The Features spec models Trial as a $0 tier with 1,000 monthly credits — one of the inconsistencies flagged in §10.)

### 5.2 Non-public plans

| Plan | Price | Credits/mo | Purpose |
|---|---|---|---|
| **Starter** | $29/mo ($23 annual) | 5,000 | Entry plan for those who can't afford Launch; discoverable but not marketed. 3 Spaces, 3 bases/Space, D1 schema-only, monthly backups, 2 seats. |
| **On2Air Bridge** | $9.99/mo | 2,000 | Migration-only landing pad for On2Air Basic/Starter customers; holds their old price for year 1, then auto-transitions to Starter with 60-day notice. |

### 5.3 The credit system (the designed usage meter)

Credits are the single consumption meter for *transfer/activity*; storage is billed separately in dollars. Credits reset monthly, no rollover. Rates live in a DB lookup table (`credit_operation_costs`) so they can be tuned without deploys.

**Activity costs:**

| Operation | Credits | Unit |
|---|---|---|
| Schema/metadata backup | 5 | per base, per run |
| Record data transfer | 1 | per 1,000 records |
| Attachment data transfer | 1 | per 50 MB |
| Restore — table | 15 | per restore beyond included count |
| Restore — base (records) | 40 | per restore beyond included count |
| Restore — base (records + attachments) | 75 | per restore beyond included count |
| Manual backup trigger | 10 | per run beyond included count |
| Manual smart-cleanup trigger | 10 | per trigger (scheduled runs free) |
| AI doc generation | 10 | per run |
| AI schema insight | 5 | per run |
| Inbound API calls | 1 | per 100 calls |
| SQL REST queries | 1 | per 50 queries |

**Dynamic-mode storage credits** (from `Pricing_Credit_System.md` §2 — note the internal contradiction flagged in §10): record storage 2 credits per 1,000 records/month; attachment storage 5 credits per GB/month, charged on peak volume at rest. Incremental syncs after the initial full sync only pay for deltas, making dynamic dramatically cheaper than high-frequency static for large, stable datasets (worked example in that doc: 50K records + 5 GB attachments = 4,650 credits/mo static-daily vs ~725 dynamic-daily).

**Credit-bucket architecture** (fully designed, DB-level): multiple concurrent buckets per Organization — `plan_monthly`, `addon_monthly`, `onboarding` (30-day expiry, absorbs the initial-backup spike), `promotional`, `purchased` (12-month expiry), `migration` (90-day), `manual_grant` — consumed soonest-expiring-first, with an immutable transaction ledger, per-org overage mode (`auto` bill vs `cap` pause), dollar caps, and alert thresholds (50/75/90/100%).

**The initial-backup problem** is explicitly designed for: a first backup of a large base can cost 200× a typical incremental run. Mitigation is the onboarding bucket (sized per tier to absorb a realistic first full backup) plus an `is_initial_backup` ledger flag powering dashboard explanations and CSM alerts.

**Effective per-credit rate by plan** (the upgrade-incentive backbone — each tier is meaningfully cheaper per credit than the one below, and always cheaper than its add-ons, which are cheaper than overage):

| Plan | $/credit (monthly) | $/credit (annual) |
|---|---|---|
| PAYG packs | $0.0100–0.0125 | — |
| Starter | $0.0058 | $0.0046 |
| Launch | $0.0039 | $0.0031 |
| Growth | $0.0025 | $0.0020 |
| Pro | $0.0017 | $0.0013 |
| Business | $0.0010 | $0.0008 |

### 5.4 Overage & add-ons

- **Storage overage:** R2 $0.50/GB/mo; DB storage $1.00/GB/mo (D1), $2.00 (Shared PG), $3.00 (Dedicated PG).
- **Monthly recurring credit add-ons:** +5K to +150K credits/mo, priced between the plan's effective rate and its overage rate ($25–$420/mo depending on tier/size); stackable; no rollover.
- **One-time credit blocks:** 5K–200K credits, 12-month expiry, for known spikes (initial backups, migrations).
- **Storage add-ons:** +10 GB R2 from $4–7/mo up to +250 GB $85–130/mo; DB storage +10/+50 GB tiers.
- **Additional seats:** $6/$8/$10/$12 per seat/mo (Starter/Launch/Growth/Pro); Business+ unlimited.
- **Pay-as-you-go:** credit packs ($10/800cr to $150/15,000cr) with Trial-level limits — deliberately the most expensive rate to push pack-buyers toward plans.

### 5.5 Billing architecture (Stripe)

Decided and documented (`Features` §5.6): one Stripe subscription per Organization, one subscription item per platform, products named `Baseout — [Platform] — [Tier]` with **capabilities resolved from product metadata (`platform` + `tier`), never name strings**. Per-platform trials (one ever, per platform, per org). Tier changes swap the platform's subscription item. Overage billed via Stripe metered usage at period end. Annual = ~20% discount. Multi-platform discount deferred until a second platform exists.

### 5.6 On2Air migration pricing

~200 paying customers map as: Basic(free)→Trial; Starter($9.99)→On2Air Bridge at $9.99 yr-1 → Starter $29; Essentials($29.99)→Starter $29 (a price *cut*) or Launch; Professional($49.99)→Launch at $39 annual (cheaper than today); Premium($79.99)→Growth at $79 annual yr-1; Enterprise→negotiated. Each cohort also gets a one-time migration credit grant (2K–80K credits) sized to ~2 months of typical usage. Migration pricing requires signup within a ~90-day window. Legacy users carry a `dynamic_locked` flag — dynamic features render as upgrade CTAs rather than being hidden.

---

## 6. Pricing Levers Catalog

Every meterable or gateable dimension in the product, classified by role. "Value metric" = scales with customer value; "cost recovery" = tracks Baseout's marginal cost; "packaging gate" = feature fencing for segmentation.

### 6.1 Usage meters

| Lever | Role | Notes |
|---|---|---|
| **Transfer credits** | Primary value metric + cost recovery | Unifies backup volume × frequency, restores, API usage, AI runs into one meter. Deliberately replaces On2Air's record/attachment count caps ("no artificial limits" is a migration selling point). |
| **R2 file storage (GB)** | Cost recovery | Persistent, doesn't reset; overage $0.50/GB/mo against ~$0.015/GB/mo underlying cost (§7.4). |
| **Database storage (GB)** | Cost recovery + tier ladder | Priced per engine ($1/$2/$3 per GB) reflecting real COGS differences. |
| **Inbound API calls / SQL REST queries** | Value metric | Monthly quotas per tier (10K/50K/200K/unlimited calls; 10K/50K/unlimited queries), plus credit costs per unit. |
| **Included restores/mo** | Value metric (insurance events) | 1→2→3→5→15→unlimited; extra restores priced in credits (15/40/75). Restores are high-perceived-value moments — the moment the product proves itself. |
| **Manual backup runs/mo** | Control gate | 0→2→5→unlimited; extras 10 credits. |
| **AI operations** | Value metric + cost recovery | 10 cr/doc-generation, 5 cr/schema-insight — meters LLM inference cost. |

### 6.2 Capacity / structure limits

| Lever | Role | Notes |
|---|---|---|
| **Spaces** | Segmentation | 1→3→unlimited at Growth. Key for the consultant persona (one Space per client) — the jump to unlimited at $99 is the consultant magnet. |
| **Bases per Space** | Scale gate | 1→3→unlimited (spec) — but note code currently implements 5/10/15/25/50/unlimited (§9/§10). |
| **Connections** | Light gate | 2 per Space everywhere; total capped at low tiers. |
| **Team members (seats)** | Secondary value metric | 1→3→5→10→15→unlimited + per-seat add-ons at lower tiers. Deliberately *not* the primary metric — this is an admin tool with few users per account. |

### 6.3 Capability & service gates

| Lever | Role | Notes |
|---|---|---|
| **Backup frequency** (monthly→weekly→daily→instant) | Strongest WTP gate | Frequency = RPO = how much data you can afford to lose. Instant (webhook) at Business+ is the anxiety-relief premium. Also directly multiplies credit consumption on static mode — frequency and credits reinforce each other. |
| **Backup mode / DB engine ladder** (schema-only D1 → full D1 → Shared PG → Dedicated PG → BYODB) | Capability gate + COGS ladder | The core architecture ladder; unlocks the entire data-intelligence surface. |
| **Snapshot retention** (30d→24mo→custom) | Gate + cost alignment | Compliance-driven customers need long retention; storage cost scales with it. |
| **Smart cleanup policy sophistication** | Gate | Basic→time-based→two-tier→three-tier→custom. |
| **Storage destinations** | Gate | Drive/Dropbox/Box/OneDrive/R2 on all tiers; S3 + Frame.io Growth+; custom BYOS Pro+. S3 gating targets technical/enterprise buyers. |
| **Capabilities on/off** (Data, Automations, Interfaces, AI, Analytics, Governance, Integrations) | Feature fencing | Per the capability matrix (§3). Quantity sub-gates inside: data alert rules (5/25/∞), custom reports (5/∞), dashboards (3/∞). |
| **Diagram export formats** (PNG→SVG→PDF→embed) | Micro-gate | Cheap differentiation, low engineering cost. |
| **Notification channels** (email→Slack→webhook→Teams/PagerDuty) | Gate | Maps to organizational seriousness. |
| **Support level** (community→email→priority→chat→CSM/SLA) | Service gate | Real cost at the top (human time). |
| **Auth/compliance** (SSO/SAML, SOC 2, DPAs, BYODB key control) | Enterprise gate | SOC 2 required before Business/Enterprise can be broadly marketed; certification in progress. |

### 6.4 Commercial constructs

| Lever | Role |
|---|---|
| **Annual discount (~20%)** | Cash flow + churn reduction |
| **Onboarding credits** (one-time, 30-day expiry) | Absorbs the initial-backup spike; conversion protection |
| **Overage mode: auto-bill vs hard cap** (default cap) | Bill-shock protection; trust builder |
| **Recurring credit add-ons / one-time blocks / storage add-ons / seat add-ons** | Expansion revenue between tier jumps; each deliberately priced worse per-unit than upgrading |
| **PAYG packs** | Bottom-of-funnel catch; intentionally unattractive vs plans |
| **Non-public plans (Starter, Bridge)** | Price-sensitive capture without polluting the public ladder |
| **Migration pricing + credit grants** | Retention of ~200-customer legacy base |
| **Multi-platform discount (V2)** | Expansion incentive when Notion/HubSpot launch |
| **Trial design** (7 days + 1 run + data caps, no card) | Conversion mechanics; pre-registration schema visualization is the free hook before signup |

---

## 7. Cost Structure

### 7.1 Architecture (what runs where)

The stack is deliberately serverless/usage-based — COGS is near-zero at rest and scales with activity:

| Layer | Technology | Billing model |
|---|---|---|
| Web app + API | Astro SSR on Cloudflare Workers | Per-request + CPU-ms (Workers Paid) |
| Backup engine | Cloudflare Worker + Durable Objects (one DO per Connection for Airtable rate-limiting, one per Space for scheduling) | Per-request + DO duration/storage |
| Long-running backup tasks | Trigger.dev v3 cloud (Node runner, one task per base per run, 10-min default duration, 3 retries) | Per-run compute (per-second, machine-sized) |
| Master DB | PostgreSQL on DigitalOcean (managed), reached via Cloudflare Hyperdrive | Fixed monthly instance |
| Customer DB — entry | Cloudflare D1 (SQLite) | Per-GB storage + per-row reads/writes |
| Customer DB — mid | Shared PostgreSQL (DigitalOcean) | Fixed instance amortized across Spaces |
| Customer DB — dedicated | Neon / Supabase / DigitalOcean, one per Space | **Fixed monthly cost per Space** |
| Customer DB — enterprise | BYODB (customer's own Postgres) | ~$0 to Baseout |
| Managed file storage | Cloudflare R2 | Per-GB-month + per-operation; **zero egress fees** |
| Sessions | Cloudflare KV | Per-op |
| Email (magic links, alerts, digests) | Cloudflare Email Service (Workers binding) | Per-send, cheap |
| AI documentation | Cloudflare Workers AI (open-source model per PRD) | Per-inference |
| Payments | Stripe | ~2.9% + $0.30 per transaction |
| Analytics / referral | PostHog, dub.co | SaaS subscriptions (fixed-ish) |
| Job observability | Trigger.dev dashboard, Cloudflare built-ins | Included |

The **Airtable API itself is free** — the constraint is rate limits (per-base request caps), which is why rate-limiting Durable Objects exist. Airtable attachment URLs expire in ~1–2 hours, forcing timely transfer processing.

### 7.2 Variable cost per activity (what a credit actually costs us)

Directional mapping of credit-metered operations to underlying marginal cost. Vendor list prices as of early 2026 — **verify current pricing before building the model**; treat these as order-of-magnitude anchors:

| Activity (customer pays) | Underlying cost drivers | Order of magnitude |
|---|---|---|
| Record transfer — 1 cr / 1,000 records (≈$0.001–0.007 revenue) | Trigger.dev compute seconds + Worker/DO requests + Airtable API time | Fractions of a cent per 1,000 records |
| Attachment transfer — 1 cr / 50 MB (≈$0.08–0.16/GB revenue at plan rates) | Trigger.dev compute + R2 write ops (Class A ≈ $4.50/M) or third-party upload; zero egress on R2 | ~$0.01/GB or less in ops; bandwidth free on Cloudflare |
| R2 storage at rest — $0.50/GB/mo overage | R2 storage ≈ $0.015/GB/mo | **~97% gross margin** on storage overage |
| D1 DB storage — $1.00/GB/mo overage | D1 ≈ $0.75/GB/mo + per-row read/write ops | Thin (~25% before ops) — worth revisiting |
| Shared PG storage — $2.00/GB/mo | DigitalOcean managed PG instance amortized across Spaces | Healthy if utilization is managed |
| Dedicated PG — $3.00/GB/mo + included 100 GB | **A whole DB instance per Space** (Neon/Supabase/DO ≈ $19–60+/mo each) | See the §7.3 exposure note |
| AI doc generation — 10 cr | Workers AI inference on an open-source model | Cents per run |
| SQL REST / Inbound API — 1 cr / 50–100 calls | Worker requests (~$0.30/M) | Near-zero |
| Restores — 15–75 cr | Same transfer machinery in reverse (Airtable writes are slow/rate-limited, long compute) | Low dollars at most; priced mostly on value |
| Email/notifications | Cloudflare Email per-send | Negligible |

Headline: **credits are priced at a large multiple of marginal infrastructure cost** across the board (likely 10–100×), which is appropriate — the credit meter's job is value capture and abuse prevention, not cost pass-through. The two places where price sits *close* to cost are D1 DB storage overage and dedicated-PG tiers.

### 7.3 Fixed and step costs

- **Base platform fixed costs are small:** Workers Paid plan, master DB instance (~$15–60/mo class), Trigger.dev base plan, PostHog/dub.co — low hundreds of dollars per month at launch scale.
- **The big step cost is Dedicated PostgreSQL at Business tier ($399/mo):** one dedicated instance **per Space**, and Business includes **unlimited Spaces**. A Business customer with 10 Spaces could consume 10 provisioned databases (~$200–600/mo in COGS) against $399 revenue. ⚠️ **This is the single largest structural margin risk in the current design** — recommend either capping included dedicated-DB Spaces, provisioning dedicated PG per-Organization instead of per-Space, or pricing extra dedicated-DB Spaces as an add-on.
- **Shared PG (Pro)** has a milder version of the same dynamic — mitigated by multi-tenancy, but per-Space schema growth needs monitoring.
- **Support** is the other real step cost: priority chat at Business and CSM+SLA at Enterprise are human costs that should inform those price points.
- **Enterprise/BYODB is the cheapest tier to serve on infrastructure** (customer hosts the data) — margin there is about support, SLA, SSO, and compliance surface, not COGS.
- **Payment processing:** ~3% of revenue; annual prepay reduces per-transaction overhead.
- **Compliance:** SOC 2 audit costs (vendor engaged from ~April 2026) are a real prerequisite investment for selling Business/Enterprise.

### 7.4 Cost-structure asymmetries a pricing model can exploit

1. **Zero egress on R2** means restore/download traffic — normally a backup vendor's scariest cost — is nearly free for managed storage.
2. **BYOS static plans cost almost nothing to serve at rest** (no storage, only per-run transfer compute). High-frequency static backup on BYOS is the worst case (full re-transfer every run) — which is exactly what credits meter.
3. **Dynamic incremental sync is cheaper for us AND for the customer** at high frequency — the credit model already encodes this, nudging customers toward the mode that also unlocks upsell features. Well-aligned.
4. **Storage costs persist; credits reset.** Retention-heavy tiers accumulate real COGS over months. Smart Rolling Cleanup is the cost-containment feature — note from §9 that it is **not implemented yet**, so today storage growth is unbounded.

---

## 8. Customer Segments & Willingness-to-Pay Signals

### 8.1 Segments

| Segment | Profile | What they value | Pricing sensitivity |
|---|---|---|---|
| **Solo/small ops admin** | 1 org, 1–3 bases, backup peace-of-mind | Set-and-forget scheduled backup, cheap | High — Trial/Starter/Launch territory; On2Air's base skews here |
| **Airtable consultant / agency** | Manages many client orgs; may want one Space per client | Unlimited Spaces, multi-org membership, professional artifacts (schema diagrams, docs, health reports they can show clients) | Medium — Growth is designed as their magnet ($99, unlimited Spaces/bases) |
| **RevOps/BizOps team at a scale-up** | Business-critical Airtable, daily/instant backup, SQL access for BI | Frequency, retention, SQL layer, Slack alerts, API | Medium-low — Pro/Business; value story is downtime/data-loss insurance + unlock of data |
| **Enterprise IT/compliance** | Governance requirements, SOC 2, SSO, data sovereignty | BYODB (data never leaves their environment), audit trails, SLA, CSM | Low — Enterprise custom; blocked on SOC 2 completion |
| **Legacy On2Air cohort (~200 paying)** | Known usage patterns, anchored to $9.99–$79.99 | Continuity ("static backups work exactly the same") | Anchored — handled by bridge/migration pricing (§5.6); `dynamic_locked` upsell surface |

### 8.2 Intent signals encoded in the model

- **Frequency is the cleanest WTP proxy** for the core job (how much data can you afford to lose?). It already sequences the tiers and multiplies credit spend.
- **Restores are the "product proved itself" moment** — included counts are small (1–15/mo) so the meter exists, but restore pricing should never feel punitive at the moment of a crisis; the credit costs (15–75) are modest by design.
- **The privacy → capability trade** is explicit: static BYOS customers are buying "you never hold my data"; dynamic customers are selling that stance back for SQL/intelligence. These are near-opposite intents inside one price ladder — worth validating that one ladder serves both.
- **Credits as a meter were chosen over record/attachment caps** specifically as a fairness/migration story ("no more artificial limits — pay for actual usage"). The known risk of credit systems — customers can't predict their bill — is mitigated by design: onboarding buckets, first-run flags with dashboard explanations, threshold alerts, hard-cap default, and DB-stored rates that can be tuned without deploys.

### 8.3 Open segmentation questions for you

- Is $49 the right public floor, given ~200 legacy customers anchored at $9.99–$29.99 and a hidden $29 plan? (The team's answer so far: hide the low end, don't market it.)
- Does the consultant segment need its own packaging (client-count-based) rather than riding the Growth tier?
- Should "unlimited Spaces at $99" survive contact with the dedicated-DB cost exposure at higher tiers (§7.3)?

---

## 9. Reality Check: Spec vs. What's Actually Built (July 2026)

This matters for launch sequencing: **the pricing model can't launch ahead of the metering that enforces it.** Condensed from a full codebase audit.

### Built and working

- **Backup pipeline end-to-end:** Airtable OAuth, scheduled backups (per-Space Durable Object alarms: monthly/weekly/daily/instant plumbing), manual runs, per-base Trigger.dev tasks, CSV + attachment export with dedup, run history/cancel/delete, per-connection rate limiting.
- **Storage destinations:** managed R2, Google Drive, Dropbox, Box, OneDrive (full OAuth connect/refresh/disconnect flows). S3 and Frame.io are stubs.
- **Billing skeleton:** Stripe customer + subscription creation at signup, 7-day trial with one-backup-run enforcement (`trial_backup_run_used`, `trial_ever_used` — one trial ever per org per platform), subscription-item-per-platform model matching the spec, tier resolution from active subscription items.
- **Tier gating in code** (`apps/web/src/lib/capabilities/tier-capabilities.ts`): backup frequency by tier, bases-per-Space caps, schema-docs level (none/manual/manual+AI).
- **Auth (magic link), dashboard, integrations/sources/destinations UI, schema browsing, schema documents API, staff admin console.**

### Designed but NOT implemented (revenue-relevant gaps)

| Gap | Status | Pricing consequence |
|---|---|---|
| **Credit system** | Not in code at all — no buckets, ledger, operation costs, or consumption logic | The entire §5.3 meter is paper. Code has a simpler `overage_records` table (metrics: records, attachments, storage_gb, database_gb, bases, spaces, team_members, manual_runs, api_calls) with **no metering cron and no auto-billing** |
| **Overage billing** | Schema exists; nothing populates or invoices it | Revenue leakage on any usage-based component until built |
| **Restore** | UI placeholder only; no restore backend | A headline feature of every tier is unshipped; restore-count pricing is unenforceable |
| **Retention / smart cleanup** | Not implemented; runs accumulate indefinitely | Unbounded R2 COGS growth; retention tiers unenforceable |
| **Dynamic backup / D1 / PG provisioning** | Schema hooks exist (`space_databases` supports d1/managed_pg/byodb); no provisioning flow | The entire dynamic ladder — and every capability gated on it — is not yet sellable |
| **Webhooks / instant backup** | `apps/hooks` is a placeholder Worker | Business+ headline feature unshipped |
| **Inbound API / SQL REST / Direct SQL** | `apps/api` and `apps/sql` are placeholder Workers | Growth/Pro/Business integration gates unshipped |
| **Seat limits, storage quotas** | Tables exist; no enforcement | Seat add-on pricing unenforceable |
| **Analytics/reports, health score, schema changelog UI** | Placeholders | Value-story features pending |

### Code vs. spec drift already present

The implemented tier table **doesn't match the spec**: code tiers are `starter/launch/growth/pro/business/enterprise` (no Trial tier object; unsubscribed orgs fall back to `starter`), with bases-per-Space of 5/10/15/25/50/unlimited vs. the spec's 1/3/3/unlimited…, and code allows weekly frequency on Starter while the spec says monthly-only. None of these numbers has been reconciled — treat the implemented values as provisional engineering defaults, not decisions.

**Implication for you:** there is a real sequencing decision — launch pricing can either (a) start with what's enforceable today (flat tiers + frequency + bases caps + trial), layering credits/overage in later, or (b) hold launch for the credit meter. The gap between the designed model and the enforceable model is currently large.

---

## 10. Known Inconsistencies & Open Questions (Please Weigh In)

Internal spec conflicts we know about — the Features spec v1.1 (April 2026) is the designated authority where they clash, but several need explicit decisions:

1. **PRD §8.1 shows a stale price ladder** ($15/$29/$49/$99/$249 with Starter public) vs. Features §3 ($0 trial, $49/$99/$199/$399, Starter non-public at $29). Features is current; the PRD table was never updated.
2. **Launch price typo somewhere:** Features §3 says Launch $49/mo, but Features Open Question #6 records the resolution as "$59." $49 appears everywhere else.
3. **Trial definition conflict:** PRD = 7 days + 1 run + hard data caps (1,000 records/5 tables/100 attachments). Features/Credit doc = a persistent $0 Trial tier with 1,000 credits/mo and monthly backups. Code implements the PRD version. Which is it?
4. **Storage credits contradiction:** `Pricing_Credit_System.md` §2 charges monthly *storage credits* on dynamic plans (2 cr/1K records, 5 cr/GB), while §8.1 of the same doc and Features §5 state "credits meter transfer activity **only**; storage is billed separately in dollars; credits are never consumed by data at rest." These can't both be true — this changes dynamic-plan economics materially.
5. **Instant backup tier:** PRD says Pro+, Features says Business+.
6. **Automations/Interfaces backup minimum tier:** Features §6.3 says Launch+, PRD §2.9 says Growth+.
7. **Spaces on Launch:** Credit doc prose says 5; every table says 3.
8. **Code drift** on tier limits and frequencies (§9) — bases-per-Space and Starter frequency don't match any spec version.
9. **Spec'd open items awaiting decisions:** Enterprise qualification floor; overage cap default multiple (e.g., 2× monthly credits); incremental-sync "changed record" definition (affects credit accuracy); attachment MB measurement point; first-backup reduced attachment rate vs. onboarding-bucket-only; multi-platform discount %; Bridge auto-transition mechanics.
10. **Structural question from cost analysis (§7.3):** dedicated-PG-per-Space at Business with unlimited Spaces is a margin hole as designed. Cap it, restructure it, or price it?

---

## 11. Source Document Index

| Document | What it holds |
|---|---|
| `shared/Baseout_Features.md` (v1.1) | Authoritative tier/limit/capability matrices, overage pricing, Stripe architecture, naming dictionary |
| `shared/Pricing_Credit_System.md` | Credit-system design, On2Air analysis + migration strategy, add-on/PAYG pricing, credit DB architecture |
| `shared/Baseout_PRD.md` (v1.1/1.4) | Product vision, personas, competitive landscape, architecture, V1/V2 scope, MoSCoW |
| `shared/Baseout_Implementation_Plan.md` | Phased build order (Phase 0–6) |
| `shared/Master_DB_Schema.md`, `shared/Baseout_Backlog*.md` | Schema reference and prioritized backlog |
| Codebase (`apps/web`, `apps/server`, `apps/workflows`, `apps/api|sql|hooks|admin`) | Ground truth on implementation status (§9) |
