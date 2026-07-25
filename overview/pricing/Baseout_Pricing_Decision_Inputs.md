# Baseout — Pricing Decision Inputs

**Prepared for:** External pricing-strategy consultant
**Date:** July 2026
**Status of pricing:** **Undecided.** This document deliberately does not propose tiers, price points, or a metering model — that is the output we are hiring for. Internal exploratory pricing drafts exist and can be shared on request, but they are excluded here to avoid anchoring your analysis.

**What we want out of the engagement:** a pricing strategy that is easy for customers to understand, captures the different intents customers arrive with, and stays sound against our cost structure. This document is the ingredients list: the product, the customers, the market anchors, the meterable dimensions, the unit economics, and the constraints.

---

## 1. The Product

### 1.1 What Baseout does

Baseout is a B2B SaaS utility for **Airtable platform admins**. It:

1. **Backs up Airtable automatically** — schema, records, and attachments via the Airtable REST API on a schedule (the product supports monthly, weekly, daily, and webhook-driven "instant" cadences as technical capabilities); automations and interfaces via user-submitted intake (Airtable's API does not expose them).
2. **Restores** — base-level and table-level, point-in-time from any snapshot, always into *new* bases/tables (never overwrites live data).
3. **Gives the data an external home** — either the customer's own storage (Google Drive, Dropbox, Box, OneDrive, S3, "bring your own storage") or Baseout-managed storage (Cloudflare R2), and optionally a **live SQL database copy** (SQLite → shared PostgreSQL → dedicated PostgreSQL → customer's own database).
4. **Layers intelligence on top** — schema visualization (auto-generated ERD), schema change history, base health scoring, schema documentation tooling, data metrics/alerts, AI-assisted documentation, analytics, and (roadmap) governance/compliance tooling, MCP/RAG AI access, and third-party connectors.

V1 is Airtable-only. The architecture is explicitly multi-platform: Notion, HubSpot, Salesforce are the planned V2 platforms, each added as its own subscription component under one customer billing relationship.

### 1.2 The jobs customers hire it for

1. **Insurance** — fear of data loss / accidental deletion; someone is accountable for recovery.
2. **Governance** — best practice (and some compliance regimes) require a copy *outside* the SaaS vendor; Airtable's native snapshots don't satisfy this.
3. **Visibility** — no native way to see schema complexity, change history, or "health" of a growing Airtable estate.
4. **Data liberation** — data locked in Airtable's proprietary format; a SQL copy makes it queryable, portable, and BI-connectable.

Note these are **different intents with different willingness-to-pay curves**: insurance buyers want cheap peace of mind; governance buyers have budget and requirements; data-liberation buyers are buying an unlock, not a backup.

### 1.3 The architectural fork that packaging must respect

The product has two fundamentally different modes, with opposite privacy postures and opposite cost shapes:

| | **Static backup** | **Dynamic backup** |
|---|---|---|
| Mechanism | Flat-file export (CSV) per run to a storage destination | Continuous sync into a managed database |
| Privacy | With customer-owned storage, record data **never touches Baseout servers** (streams through memory) — a marketed differentiator | Customer explicitly opts in to Baseout hosting their data |
| Cost shape | Re-transfers the **full dataset every run** — cost scales with data volume × run frequency | Expensive initial sync, then cheap incremental deltas — but **ongoing storage cost at rest** |
| What it enables | Backup + restore only | Everything else: SQL access, APIs, real-time sync, and all data-intelligence features |

Any pricing model has to decide how these two modes relate: separate products? modes within a plan? a ladder where dynamic is the upsell? The intelligence features all depend on dynamic mode, so the dynamic database is simultaneously a capability unlock, a cost driver, and a trust decision by the customer.

### 1.4 Differentiation claims (pressure-test these)

- Only backup vendor focused exclusively on Airtable (deepest product understanding).
- Most storage destinations in the market; only vendor supporting OneDrive.
- Only vendor offering both BYOS (bring your own storage) and BYODB (bring your own database) — competitors are moving away from this.
- The "never stores your data" static/BYOS posture vs. competitors who keep everything in their own databases.
- Only vendor going deep on *unlocking* Airtable data as a live SQL layer.

---

## 2. Customers & Market

### 2.1 The buyer

**Primary persona: the Airtable platform admin** — internal IT managers, RevOps/BizOps owners, and independent Airtable consultants managing multiple client accounts. Technically capable (comfortable with OAuth, storage config, SQL). Professionally accountable for the org's Airtable estate. The UI is deliberately an information-dense operations console.

**Secondary (V2):** developers building on the hosted SQL layer; enterprise IT/compliance officers (SOC 2, SSO, data sovereignty).

### 2.2 Segments and what each values

| Segment | Profile | What they value | Notes for pricing research |
|---|---|---|---|
| Solo / small ops admin | 1 org, a few bases; wants set-and-forget protection | Cheap, simple, trustworthy | The bulk of the legacy customer base skews here |
| Airtable consultant / agency | Manages many client orgs; wants per-client separation | Multiple isolated workspaces, professional artifacts (diagrams, health reports, docs) to show clients | May multi-home one subscription across clients or want per-client billing — packaging question |
| RevOps/BizOps team at a scale-up | Airtable is business-critical; wants frequent backup + SQL for BI | Recovery speed (frequency), retention, SQL access, Slack alerts, API | The "data liberation" buyer overlaps here |
| Enterprise IT / compliance | Governance mandates | BYODB (data never leaves their environment), audit trails, SSO, SLA, CSM | Gated by our SOC 2 timeline (§6.4) |
| Legacy On2Air customer | ~330 active subscriptions on the predecessor product | Continuity — "static backups work exactly the same" | Anchored to old prices; see §2.3 |

### 2.3 The existing customer base and its price anchors

Baseout is the next-generation successor to **On2Air Backups** (**~330 active paying subscriptions** — July 2026 Stripe export, trials excluded; earlier drafts said ~200. Plan mix: Starter 57 / Essentials 148 / Professional 108 / Premium 20; $11.1K MRR / $132.7K ARR; 49% annual-billed; Professional+Premium = 58.5% of ARR. Full analysis: `research/pricing/legacy-subscription-analysis.md`).

> **Update (2026-07-24, founder direction):** Baseout launches as an independent platform "from the creators of On2Air" and **coexists** with On2Air; the sunset + transition plan comes later, confidence-gated. Consequently the table below is **context for the eventual transition plan, not an anchor on Baseout's launch pricing** — design the launch ladder for the market on its own merits.

Their current pricing — i.e., what On2Air customers pay **today**:

| On2Air plan | Price/mo | Bases | Records | Attachments | Restores | Max frequency |
|---|---|---|---|---|---|---|
| Basic (free) | $0 | 1 | ~1,000 | 25 | 1 | — |
| Starter | $9.99 | 1 | 50,000 | 2,500 | 1/mo | Monthly |
| Essentials | $29.99 | 15 | 250,000 | 25,000 | 1/mo | Weekly |
| Professional | $49.99 | 50 | 1,000,000 | 500,000 | 5/mo | Daily |
| Premium | $79.99 | 250 | 5,000,000 | 1,000,000 | 10/mo | Hourly |
| Enterprise | Custom | 250+ | Custom | Custom | Custom | Custom |

Observations the team has made about this legacy model (treat as inputs, not conclusions):

- Tiers scale with *allowed* usage (record/attachment/base caps step up per tier), but within a tier the fee is flat — a customer using 1 base pays the same as one at plan maximums. **Founder framing (2026-07-25):** the deeper issues are that the model under-captures value, the per-tier allowances are more generous than customers at that price typically need, and the structure is too simple to support Baseout's feature breadth and usage variability.
- Frequency was hard-gated by tier; count-based caps (records, attachment *count* not size) did the limiting.
- The team believes On2Air was **historically underpriced relative to the value delivered**, and Baseout is a substantially more capable product.
- Migration sensitivity is real: these customers chose a cheap, simple product. Whatever model we adopt needs a migration story that doesn't shock them (grandfathering, bridge pricing, and usage-based mapping have all been discussed internally).

### 2.4 Competitive landscape

| Alternative | Status | Notes |
|---|---|---|
| **Airtable native snapshots** | Free, built-in | The default "do nothing" competitor. Doesn't satisfy external-copy governance, no schema intelligence, no SQL. |
| **Sync Inc** | Out of business | Was the closest "Airtable → Postgres" comparable. |
| **Whalesync** | Active, narrowing to a marketing-sync niche | Losing general-purpose positioning. |
| **Coefficient** | Active | Spreadsheet-sync focus, not deep backup/schema intelligence. |
| **DIY scripts** | Common among technical admins | Free but unmaintained; Baseout sells convenience + fidelity. |

Also relevant as a reference point: **Airtable's own per-seat pricing** (Team ~$20–24/seat/mo, Business ~$45–54/seat/mo) sets customer expectations about what "tooling around Airtable" costs, and the size of a customer's Airtable spend is a plausible proxy for their Baseout budget.

Distribution notes: an Airtable Marketplace listing is planned (organic discovery), and the product offers **pre-registration schema visualization** — OAuth in and see your schema diagram before creating an account — as the top-of-funnel conversion hook.

---

## 3. Feature Catalog (Packaging Raw Material)

Everything below is a discrete, gateable unit. Dependencies and cost character are engineering facts; **which features group into which packages, and at what prices, is open** — internal drafts assign features to tiers, but treat all such assignments as provisional. Build status matters because unshipped features can't carry a launch price promise (see §6.2).

### 3.1 Core backup & restore

| Feature | Dependency | Marginal cost character | Build status |
|---|---|---|---|
| Scheduled backup: monthly / weekly / daily | — | Transfer compute per run (static re-sends everything) | ✅ Built |
| Instant backup (webhook-driven, near-real-time) | Airtable webhooks infra | Low steady-state; webhook plumbing | ❌ Not built |
| Manual on-demand runs | — | Same as a scheduled run | ✅ Built |
| Storage destinations: managed R2, Google Drive, Dropbox, Box, OneDrive | OAuth per provider | R2 = our storage cost; BYOS = ~zero at rest | ✅ Built |
| Storage destinations: S3, Frame.io, custom BYOS | — | ~zero at rest | ❌ Stubbed |
| Restore (base/table, point-in-time, to new data) | Snapshots retained | Reverse-transfer compute; Airtable write API is slow/rate-limited | ❌ Not built (UI placeholder) |
| Post-restore verification, audit reports, run history | — | Negligible | Partially built |
| Snapshot retention windows / smart rolling cleanup policies | — | **Retention = persistent storage cost**; cleanup is the containment | ❌ Not built |
| Backup of automations & interfaces (via user-submitted intake) | Inbound API / forms | Negligible | ❌ Not built |

### 3.2 Data intelligence (all require dynamic mode)

| Feature | Dependency | Marginal cost character | Build status |
|---|---|---|---|
| Schema visualization (auto ERD) | Schema-only DB suffices | Negligible | Partially built (schema browsing shipped; graph UI in progress) |
| Schema changelog (change history) | Schema-only DB | Small storage, grows with retention | ❌ Not built |
| Base health score + configurable audit rules | Schema-only DB | Negligible | ❌ Not built |
| Schema documentation (rich-text docs, tags, diagrams) | — | Negligible | Partially built (API routes exist) |
| AI-generated documentation / schema insights | LLM inference | Cents per generation (Workers AI, open model) | ❌ Not built |
| Record metrics, data changelog, growth trends | **Full** dynamic DB | DB storage at rest | ❌ Not built |
| Data alerts, PII detection, data insights/reports | Full dynamic DB | Compute per scan | ❌ Not built |
| Analytics dashboards, scheduled reports, exports | Full dynamic DB | Negligible | ❌ Not built |
| Governance suite (quality rules, lineage, retention policy, access controls, SOC 2/GDPR tooling) | Full dynamic DB | Moderate | ❌ V2 roadmap |

### 3.3 Access & integration (all require dynamic mode)

| Feature | Marginal cost character | Build status |
|---|---|---|
| Inbound API (submit automations/interfaces/metadata programmatically) | ~zero per call | ❌ Placeholder service |
| SQL REST API (query your hosted DB over HTTP) | ~zero per query | ❌ Placeholder service |
| Direct SQL access (connection string to your DB) | DB instance cost | ❌ Not built |
| MCP server / RAG / hosted chatbot / vector DB | Real inference + vector infra | ❌ V2 roadmap |
| Zapier / Make connectors, Airtable writeback | Partnership + build | ❌ V2 roadmap |
| Outbound webhooks, Slack/Teams/PagerDuty notifications | ~zero | ❌ Email only today |

### 3.4 The database ladder (dynamic mode's internal gradient)

A distinct gradient *within* dynamic mode, each step a real COGS step (see §5.3):

1. **Schema-only SQLite (Cloudflare D1)** — enables schema features without hosting record data. Very cheap.
2. **Full SQLite (D1)** — full record data, SQL-accessible. Cheap, per-GB.
3. **Shared PostgreSQL** — multi-tenant instance, schema-level isolation. Instance cost amortized.
4. **Dedicated PostgreSQL** — one instance per customer workspace. **Fixed $/month per instance.**
5. **BYODB** — customer's own Postgres; near-zero infra cost to us; value is control/compliance.

### 3.5 Enterprise & trust surface

SSO/SAML, 2FA, SOC 2 (in progress — see §6.4), GDPR/DPAs, encryption at rest everywhere Baseout hosts data, support ladder (community → email → priority → chat → CSM/SLA), Airtable Enterprise API support. These are classic enterprise-gate material and carry human step costs (§5.3).

---

## 4. Meterable Dimensions (Candidate Pricing Metrics)

Every dimension the system can count, cap, or gate. "Measured today" = the plumbing exists in shipped code; "enforcement" = what it would take to bill or block on it. No recommendation implied by ordering.

| Dimension | Value-alignment (does more of it = more customer value?) | Cost-alignment (does more of it = more COGS?) | Measured today | Enforcement status |
|---|---|---|---|---|
| **Records transferred per run/month** | Strong — proportional to estate size × cadence | Weak-moderate (compute) | ✅ per-run counts recorded | Metering cron + billing not built |
| **Attachment volume transferred (MB/GB)** | Strong | Moderate (compute + write ops) | ✅ per-run counts recorded | Same |
| **Backup frequency (monthly→weekly→daily→instant)** | **Very strong — frequency = how much data you can afford to lose (RPO)** | Strong on static (multiplies re-transfer); weak on dynamic | ✅ | ✅ Gating shipped |
| **Storage at rest — file (GB)** | Moderate | **Strong — persistent, accumulates with retention** | Partial (per-run sizes; no aggregate) | Quota enforcement not built |
| **Storage at rest — database (GB) + engine class** | Strong (SQL unlock) | **Strong — engine class is a step function** | ❌ | Provisioning itself not built |
| **Snapshot retention window** | Strong for governance buyers | Strong (storage × time) | ❌ | Cleanup not built |
| **Workspaces ("Spaces")** | Strong for consultants (per-client separation) | Weak — except where each carries a dedicated DB | ✅ | Partially (cap exists) |
| **Bases (per Space or total)** | Strong — estate size proxy | Weak | ✅ | ✅ Caps shipped |
| **Connections (Airtable accounts / storage providers)** | Moderate | Weak | ✅ | Partial |
| **Seats / team members** | Weak-moderate — admin tool, few users per account | ~Zero | ✅ (members table) | Limits not enforced |
| **Restores per month** | High perceived value (the crisis moment) | Weak | ❌ (restore not built) | Not built |
| **Manual runs per month** | Moderate | Same as a run | ✅ | Not enforced |
| **API calls / SQL queries** | Strong for integration buyers | ~Zero | ❌ (services not built) | Not built |
| **AI operations (doc generation, insights)** | Moderate | Real per-op inference cost | ❌ | Not built |
| **Platforms connected (V2: Airtable + Notion + …)** | Strong — whole new estate protected | Moderate | Schema supports it | Billing architecture supports it (§6.1) |

Two composite approaches the data model could also support (again, options — not recommendations): a **single abstract usage unit** (a "credit"-style meter unifying several dimensions — internal drafts explored this; pro: one number, flexible; con: customers can't predict bills without help), or **pure feature-tiering with soft caps** (what shipped code does today).

**Usage-physics facts any metered model must handle:**

- **The initial-backup spike.** The first backup of a large base transfers the entire history (potentially GBs of attachments); subsequent runs are small. First-month usage can be 100–200× steady-state. Any usage-based bill needs a mechanism (grants, amortization, exclusions) or the first invoice ambushes the customer.
- **Static mode re-transfers everything each run** — usage grows linearly with frequency even if the base never changes. Dynamic mode inverts this (deltas only).
- **Storage persists while activity resets** — retention promises accumulate COGS month over month.
- **Airtable rate limits** (per-base request caps) bound how fast we can move data — cost of a big backup is partly *time*, not dollars.

---

## 5. Cost Structure

### 5.1 The stack (all usage-based / serverless)

| Component | Runs on | Billing model to us |
|---|---|---|
| Web app + API | Cloudflare Workers (Astro SSR) | Per-request + CPU-time |
| Backup engine + schedulers + per-connection rate limiters | Cloudflare Workers + Durable Objects | Per-request + duration + DO storage |
| Long-running backup tasks (one per base per run) | Trigger.dev v3 cloud (Node) | Per-second compute, machine-sized; 10-min default task budget |
| Master database | DigitalOcean managed PostgreSQL (via Cloudflare Hyperdrive) | Fixed instance $/mo |
| Customer databases | Cloudflare D1 (SQLite) → shared PG (DigitalOcean) → dedicated PG (Neon/Supabase/DO) → BYODB | Per-GB / amortized instance / **fixed instance per customer** / ~zero |
| Managed file storage | Cloudflare R2 | Per GB-month + per operation; **zero egress fees** |
| Email (magic links, alerts, digests) | Cloudflare Email Service | Per send, cheap |
| AI features | Cloudflare Workers AI (open-source models) | Per inference |
| Payments | Stripe | ~2.9% + $0.30 per transaction |
| Analytics / referral | PostHog, dub.co | SaaS subscriptions |

The Airtable API itself is **free** — rate limits, not dollars, are its constraint.

### 5.2 Marginal cost anchors (early-2026 list prices — verify before modeling)

| Activity | Underlying cost | Order of magnitude |
|---|---|---|
| Transferring 1,000 records | Task compute + API time | Fractions of a cent |
| Transferring 1 GB of attachments | Task compute + storage write ops; egress-free on R2 | ~$0.01/GB or less |
| Storing 1 GB in R2 for a month | R2 list price | ~$0.015 |
| Storing 1 GB in D1 for a month | D1 list price | ~$0.75 (+ per-row read/write ops) |
| Shared PostgreSQL | Instance amortized across customers | ~$15–60/mo per instance ÷ tenants |
| **Dedicated PostgreSQL** | One instance per customer workspace | **~$19–60+/mo each — the big step cost** |
| An AI documentation generation | Open-model inference | Cents |
| A restore | Reverse transfer; slow Airtable writes | Low dollars at most |
| An API call / SQL REST query / email | Worker request / send | ~Zero |

### 5.3 Fixed and step costs

- **Base platform fixed costs are small** — low hundreds of $/mo at launch scale (Workers plan, master DB, Trigger.dev base, analytics tools).
- **Dedicated database instances are the dominant COGS step.** If a package promises a dedicated PG per workspace, each workspace adds ~$19–60+/mo of hard cost. How many dedicated-DB workspaces a plan includes is a first-order margin decision.
- **Support is the other step:** chat support and CSM/SLA commitments are human costs that should be priced where they're promised.
- **SOC 2 certification** — audit + vendor costs, in progress; a prerequisite investment for the enterprise segment.
- **Payment processing** ~3% of revenue; annual prepay reduces per-transaction overhead.

### 5.4 Illustrative cost-to-serve profiles (order-of-magnitude, for floor-setting)

| Profile | Shape | Approx. monthly COGS to Baseout |
|---|---|---|
| Small static/BYOS | 1 base, 10K records, 500 MB attachments, weekly to customer's Drive | **< $0.50** (compute only; nothing stored at rest) |
| Medium managed | 5 bases, 250K records, 10 GB attachments, weekly to managed R2 | **~$1–3** (R2 ~$0.15 + compute + ops) |
| Large dynamic-shared | 20 bases, 1M records, 50 GB attachments, daily incremental into shared PG | **~$5–15** (shared-instance slice + R2 + compute) |
| Heavy dedicated | 50 bases, 5M records, 200 GB attachments, daily + dedicated PG, long retention | **~$30–80+** (dedicated instance + ~$3 R2 + compute; grows with retention) |

Headline: **marginal cost is tiny at the low end and dominated by database-instance and storage-retention promises at the high end.** Static/BYOS customers cost almost nothing to serve at rest; the enterprise BYODB configuration is the *cheapest* to serve on infrastructure (margin there is support/compliance, not COGS).

### 5.5 Cost asymmetries worth exploiting

1. **Zero egress on R2** — restore/download traffic, normally a backup vendor's scariest cost, is nearly free.
2. **Dynamic incremental sync is cheaper for us *and* better for the customer** at high frequency — whatever model you design, note that steering customers toward dynamic aligns cost with the mode that also carries the feature depth.
3. **Retention is the quiet cost accumulator** — activity meters reset monthly; storage promises don't.

---

## 6. Constraints & Assets

### 6.1 Billing infrastructure (asset)

Already designed/partially built, and flexible enough for most models you might propose:

- **Stripe**, one subscription per customer organization, **one subscription item per platform** (built for the V2 multi-platform expansion — a Notion product line slots in beside Airtable without re-architecting billing).
- **Entitlements resolve from Stripe product metadata** (`platform` + `tier`), never product names — new packages are config, not code.
- Stripe supports metered/usage billing, seat quantities, coupons, and per-item trials — no known blocker to tiered, usage-based, hybrid, or seat models.
- The data model was designed so **plan limits live in database rows, not code** — limits can change without deploys.
- A trial mechanism is live: signup creates a $0 subscription (no card), currently enforced as 7 days and one backup run; the trial's shape (length, caps, free-tier-or-not) is **open for you to revisit**.

### 6.2 Enforcement reality (constraint)

What shipped code can gate or meter **today**: backup frequency by plan, bases-per-workspace caps, trial limits, per-run record/attachment counts (recorded, not billed). What does **not** exist yet: usage metering/billing pipeline, storage quotas, seat enforcement, restore (entire feature), retention/cleanup, dynamic DB provisioning, webhooks/instant backup, the API/SQL services, AI features, and most intelligence surfaces.

Implication: a launch model can only *enforce* what's built. If the recommended model depends on usage metering or features not yet shipped, we need a sequencing plan (launch simple → layer metering) — or a build-first decision. Please make the dependency explicit in your recommendation.

### 6.3 Migration constraint

> **Update (2026-07-24, founder direction):** migration is **decoupled from launch**. Baseout and On2Air coexist after launch; the ~330 On2Air subscriptions stay on On2Air unchanged until a later, confidence-gated **sunset announcement** with an auto-transition plan and a gratitude-framed grandfathering effort. Migration is therefore a **phase-2 workstream** — it must not constrain launch pricing.

When the sunset does trigger, constraints we believe are real: (a) their then-current prices are the anchor for the *transition* offer (§2.3); (b) their product experience must not regress ("static backups work the same"); (c) legacy customers can be flagged to see new capabilities as upgrade prompts rather than losing anything. Grandfathering duration, bridge pricing, and tier mapping are all open — internal sketches exist if useful.

### 6.4 Timeline & roadmap constraints

- **SOC 2 is in progress** (vendor engagement started ~April 2026; ~6-month audit runway). Until certified, the enterprise/governance segment can't be broadly marketed — "SOC 2 in progress" is disclosable on hosted-data plans.
- **V2 roadmap** (multi-platform, MCP/RAG/AI access, governance suite, connectors) should extend the model, not break it: per-platform pricing, a possible multi-platform discount, and AI features with real inference COGS are all coming.
- GDPR/DPAs are required before dynamic (hosted-data) plans launch.

### 6.5 Product-experience commitments (soft constraints)

Positions the team holds that interact with pricing — challenge them if the strategy warrants:

- Restore should never feel punitive at the moment of crisis (it's when the product proves its worth).
- Customers should be protected from bill shock — spend caps, alerts, and predictable defaults are considered table stakes if any usage meter exists.
- The static/BYOS privacy posture ("we never store your data") is marketed; pricing shouldn't force privacy-motivated customers into hosted storage.
- Pre-registration schema visualization stays free (conversion hook).

---

## 7. The Decision Space (What We're Asking You to Determine)

1. **Value metric(s).** Which dimension(s) from §4 should carry price? Single metric, composite unit, pure feature tiers, or hybrid?
2. **Packaging architecture.** How many packages; what anchors each (frequency? database ladder? intelligence features? segment identity?); what's add-on vs. included; how static and dynamic modes relate commercially.
3. **Price levels.** Against the anchors available: legacy On2Air prices, Airtable's own per-seat spend, competitor pricing, our cost floors (§5.4), and the "underpriced historically" belief.
4. **Free motion.** Free tier vs. trial-only; trial shape (time, runs, data caps); what the pre-registration hook feeds into.
5. **Expansion & overage philosophy.** How customers grow spend: upgrades only? metered overage? add-on packs? seats? What defaults protect against bill shock?
6. **Migration mapping (phase 2 — not launch-gating).** Where each On2Air cohort lands at sunset time, what's grandfathered, for how long, and the messaging. Per §6.3, this is designed after launch pricing, on real coexistence-period telemetry.
7. **Enterprise definition.** What qualifies a deal as custom-priced; the floor; what's reserved for it (BYODB, SSO, SLA, CSM).
8. **Sequencing.** What model launches given §6.2 enforcement reality, and what it evolves into as metering ships.
9. **Multi-platform readiness.** How the model extends when Notion/HubSpot arrive (per-platform pricing? bundles? discounts?).

**Success criteria (from the founders):** easy to understand · captures customers' different intents · sound against the cost structure · gives the ~330 legacy subscriptions a respectful path · leaves room for the V2 roadmap.

---

## 8. Data & Materials Available on Request

- On2Air customer roster with plan, tenure, and usage shape (bases, records, attachment volumes, backup frequency) — for cohort/WTP analysis.
- Shipped telemetry: per-run record/table/attachment counts for every backup run.
- Internal exploratory pricing drafts (tiers, a credit-based meter, overage/add-on sketches) — withheld from this document to avoid anchoring; available whenever useful as a strawman.
- Product spec set: PRD (vision/scope), Features spec (capability inventories), credit-system design doc, implementation plan.
- Infrastructure billing exports (Cloudflare, DigitalOcean, Trigger.dev, Stripe) to firm up the §5 cost anchors.
