# Baseout — Pricing Engagement Q&A

**Prepared:** July 23, 2026 · **For:** pricing consultant data request
**Sources:** `shared/Baseout_Features.md` (v1.1, authoritative), `shared/Pricing_Credit_System.md`, `overview/pricing/Baseout_Pricing_Decision_Inputs.md`, `overview/pricing/Baseout_Pricing_Strategy_Briefing.md`, `overview/features/Baseout_GTM_Marketing_Inputs.md`, `research/customers/*` (verified desk research + segments workshop), and the two data-request CSVs in this directory.

> **Honesty key:** Answers marked **[DOCUMENTED]** trace to spec/research. **[INTERNAL DRAFT]** = an internal position offered as a strawman, explicitly open for the consultant to challenge. **[FOUNDER DIRECTION / FOUNDER ANSWER]** = provided directly by the founder (dated) during the July 2026 review — these supersede conflicting statements in older internal docs. *(All items originally marked [NOT ON RECORD] were resolved in founder review, July 25, 2026.)*

---

## Goals & Positioning

### Q: What are your goals or revenue and growth targets for the relaunch (target MRR/ARR, target ACV, target gross margin %, etc.)?

**[FOUNDER DIRECTION, July 25, 2026]** Directional targets, explicitly not hard commitments:

- **Revenue goal: ~$500K ARR within 12–18 months of launch** (vs. the $132.7K legacy ARR baseline — roughly 3.8×).
- **Target average customer value: $100–200/month** (vs. the legacy average of $33.20/mo — i.e., the ladder must center customers on the Growth ($99) / Pro ($199) band, not the entry tiers). Implied account math: $500K ARR at $100–200/mo average ≈ **210–420 customers** — comparable in count to the existing legacy base, at ~3–6× the per-account value.
- **No ACV or gross-margin % target yet** — the founder has explicitly flagged that Baseout's shift from On2Air's mostly-fixed costs to **per-usage infrastructure costs (R2, D1, hosted PostgreSQL)** is not yet well understood, and has commissioned a usage-cost/margin analysis (see the margin question below and `research/pricing/infrastructure-cost-model.md`) before setting one.
- **Legacy conversion expectation:** On2Air customers transitioning at sunset will see **an increase from what they pay today, but at a grandfathered discount off Baseout list prices** — i.e., grandfathering means a permanent-or-temporary discount vs. list, *not* a price freeze at legacy levels. (Note: this refines the older internal mapping in `Pricing_Credit_System.md` §6, which had some cohorts paying the same or less — treat the founder direction as current.)

Still-documented supporting context: the founders' qualitative success criteria (*easy to understand · captures customers' different intents · sound against the cost structure · gives the legacy customers (~330 active subscriptions) a respectful path · leaves room for the V2 roadmap*, Decision Inputs §7); the "On2Air was historically underpriced" belief; and category ambition references (OwnBackup's $1.9B exit; Rewind's 25K+ orgs; Airtable's 500K+ organizations).

### Q: How do you want Baseout to be perceived in the Airtable ecosystem?

**[DOCUMENTED]** As **essential infrastructure with an intelligence layer on top** — specifically, the anchor vendor of a category we are actively creating: **"Airtable DevOps."** The State of Airtable DevOps survey/report (not yet live — launching in the coming months, co-sponsored with BuiltOnAir) is the category-creation play, modeled on Gearset's Salesforce DevOps playbook. Two perception rules are firm:

1. **Never lead with data recovery/restore** — no third party can do restore truly well (record IDs can't be preserved via the API). Lead with backups-as-best-practice + schema/data intelligence; restore is the moment the product proves itself, not the pitch.
2. The daily-use surface (schema changelog, health scores, docs) is what turns Baseout from an insurance policy into an **admin console** — that's the perception shift from the legacy product.

### Q: What is the biggest flaw in your current monetization/structuring?

**[DOCUMENTED]** — several, candidly:

1. **Legacy model (On2Air) — founder framing (July 25, 2026):** the tiers *do* scale with usage — record, attachment, and base allowances step up at each price point — so this is not a flat-regardless-of-usage model. The real flaws are subtler: **(a) it doesn't fully capture the value delivered; (b) the tier allowances are over-generous — each price point permits more data capture than customers at that price typically need, giving headroom away; and (c) the structure is too simple to support where Baseout is going** — a four-step count-cap ladder has no way to price the additional features, functionality, and usage variability of the new product (schema intelligence, restore counts, retention depth, AI operations, per-usage infrastructure). Within that structure, top-tier heavy users still consume far beyond their price (a Premium customer at full hourly utilization consumes enterprise-scale resources for $79.99), there's no expansion-revenue mechanism between tier jumps, and intelligence features were never monetized (Schemas was sunset).
2. **New draft model's known structural risk:** **Dedicated PostgreSQL per Space at Business ($399/mo) with unlimited Spaces** — a Business customer with 10 Spaces could consume ~$200–600/mo in database COGS against $399 revenue. This is flagged internally as the single largest margin hole in the design (Strategy Briefing §7.3). Needs capping, per-Organization provisioning, or add-on pricing.
3. **Enforcement gap:** the designed credit meter is not in code. Today the system can gate frequency, base caps, and trials — it cannot meter or bill usage. Any launch model has a sequencing dependency (Briefing §9).

### Q: What pricing perception would you like to convey — economy, mid-tier, premium, other?

**[INTERNAL DRAFT]** **Mid-to-premium**: intentionally priced above the legacy product and above the "cheap utility" bracket, justified by capability depth — but far below the enterprise-only alternatives (Stacksync's $1,000/mo floor). The public ladder starts at $49 (Launch); the price-sensitive low end ($29 Starter, $9.99 Bridge) is deliberately **non-public** so it captures without polluting the premium ladder. Value-for-money at the mid-tier, premium at the top where governance/AI live.

---

## Differentiation & Market

### Q: What is your USP? What makes you stand out?

**[DOCUMENTED]** In priority order:

1. **BYOS + BYODB** — the only vendor offering both bring-your-own-storage and bring-your-own-database; competitors are consolidating onto their own hosted storage. On static BYOS plans, record data never touches Baseout servers (streams through memory). This is the privacy/compliance story.
2. **Most storage destinations in the market** — Google Drive, Dropbox, Box, OneDrive (only vendor with OneDrive), S3, R2, Frame.io, custom.
3. **The schema-intelligence layer in a vacant category** — visualization, changelog, health scores, AI docs. The only dedicated competitor (On2Air Schemas — our own predecessor product) shut down; nothing native exists at any Airtable tier.
4. **Automatic automation/interface backup via Airtable MCP** *(updated July 25, 2026)* — automations and interfaces are invisible to the Airtable REST API (verified through June 2026), which is why no competitor captures them. **Airtable's MCP server now exposes automations and interfaces, and Baseout can back them up automatically through it** — no manual submission required for customers who enable MCP access. The original intake model (Inbound API, scripts, forms) remains as the path for customers who don't enable MCP and for gathering information beyond what MCP exposes. Either way, Baseout captures the part of a base no other backup vendor touches — the moat is now execution speed (competitors could in principle follow via MCP) rather than pure impossibility, which argues for shipping and marketing it early.
5. **The SQL layer bundled with governed backup** *(roadmap, not launch — founder direction July 25, 2026: SQL mode will likely not be ready at launch and should not be highlighted in the original pricing; use as vision/roadmap context only)* — post-Sequin, alternatives are sync-only and either capped tiny at low prices (Whalesync $20/mo = 500 records) or enterprise-priced (Stacksync $1,000/mo floor).
6. **Credits instead of artificial limits** — no record/attachment caps; the fairness story for migration.
7. **Zero-egress restores** (Cloudflare R2) — the cost that scares every other backup vendor is nearly free for us.

### Q: Tell me about the target market/customer group(s). Does that differ from the legacy product?

**[DOCUMENTED]** Four segments (full profiles in `research/pricing/customer-segments-workshop-1.md`):

| Segment | Profile | Tier territory | Sensitivity |
|---|---|---|---|
| **Solo/small ops admin** | 1 org, 1–3 bases, set-and-forget peace of mind | Trial/Starter/Launch | High |
| **Airtable consultant/agency** | Implements/administers Airtable for many clients; wants professional artifacts (diagrams, health reports) to show clients. **Founder direction (July 25, 2026): consultants are a *channel*, not an umbrella account** — each client organization pays for its own subscription; consultants join client accounts as admins and switch between accounts, and earn **referral/affiliate commissions** for signing clients up on their own subscriptions | Own account: Launch/Growth; primary value via the partner/referral program across client accounts | Medium |
| **RevOps/BizOps at a scale-up** | Business-critical Airtable; daily/instant backup, SQL for BI, Slack alerts | Pro/Business | Medium-low |
| **Enterprise IT/compliance** | Governance mandates, SSO, data sovereignty (BYODB) | Enterprise | Low — gated on our SOC 2 timeline |

**Difference from legacy:** yes, materially. The ~330 On2Air subscriptions (July 2026 Stripe export) bought a static backup product — but note the subscription analysis corrected the "smaller/simpler" assumption: Essentials ($29.99) is the modal plan, and **Professional+Premium hold 58.5% of legacy ARR**, so the base already contains a substantial higher-value cohort. The relaunch deliberately reaches up-market (consultants, RevOps, enterprise) with the intelligence/SQL/governance surface the legacy product never had. Caution flagged internally still holds: don't let the legacy base's shape cap the ambition — it over-represents the insurance job because that's all On2Air sold.

### Q: What is the primary event that forces a user to upgrade their plan?

**[DOCUMENTED]** Ranked by design intent:

1. **Backup frequency (the RPO event)** — "how much data can you afford to lose?" is the strongest willingness-to-pay gate. Monthly→Weekly (Launch) →Daily (Pro) →Instant (Business). On static mode, frequency also multiplies credit burn, so the two levers reinforce each other.
2. **Running out of transfer credits** — the estate grew or cadence increased; add-on packs bridge, upgrades resolve (plan rates are always cheaper per credit than add-ons, by design).
3. **Needing more Spaces** — multi-estate organizations (departments, brands, environments); unlimited arrives at Growth $99. (Deliberately **not** a consultant-umbrella trigger — per founder direction, each consultant client pays for its own account; there is no plan under which one subscription covers many clients.)
4. **The database ladder** *(post-launch — see the SQL launch-scope note in the tiering answer)* — needing real SQL (Shared PG at Pro), isolation (Dedicated at Business), or sovereignty (BYODB at Enterprise).
5. **Team members, retention windows, and API quotas** as secondary nudges.

There are deliberately **no record/attachment-count limits** — the legacy product's caps were removed as a migration selling point.

### Q: Who are your main competitors? Please provide all available competitor data.

**[DOCUMENTED — verified against live pages July 23, 2026]** Full detail in the data-request template: **`research/pricing/competitor-landscape.csv`** (28 rows: every competitor tier with pricing, model, limits, AI allowances, strengths/weaknesses vs. Baseout, URLs). Summary:

| Competitor | Category | Price (verified 2026-07-23) | vs. Baseout |
|---|---|---|---|
| **Airtable native snapshots** | The "do nothing" default | Bundled ($0–54/seat) | Can't leave the platform; whole-base restore into a new base; no schema intelligence; no SQL |
| **ProBackup** | Direct backup | Plus $31 / Pro $47 / Premium $86 per mo (storage-based; ~19–20% annual discount) | Daily-only on all tiers; no automations/interfaces; no SQL; no BYOS |
| **AirBackups** | Direct backup | $15/base/mo, $150/base/yr | Single destination (GCS); per-base pricing scales badly |
| **Whalesync** | SQL/data sync | Personal $5 / Starter $20 (Postgres) / Plus $40–200 / Pro $200–1,600 per mo | Sync ≠ backup; low tiers cap at 250–500 records; 20% annual discount |
| **Coefficient** | Spreadsheet sync | Free / $49 / $99 per user per mo | Sheets-focused; not backup; per-seat model |
| **Stacksync** | SQL sync (enterprise) | $1,000 / $3,000 / $4,200 per mo, billed annually | $12K/yr floor; sync-only |
| **Sequin** † | SQL layer | — | Shut down Oct 2025; customer data deleted — a cautionary tale that sells our story |
| **On2Air Schemas** † | Schema | — | Shut down; the schema category is vacant |
| **DIY scripts** | Self-hosted | $0 + engineering time | "Unreliable backups at best" (the OSS author's own words); attachment URLs expire in ~2h |

**Where no exact match exists (per your instruction):** for the SQL/intelligence surface, the cost a prospect currently incurs is a Whalesync mid-tier ($120–200/mo at 10–50K records, sync only), a Stacksync contract ($1,000+/mo), a DIY ELT stack (Fivetran MAR pricing, "widely considered expensive"), or an engineer's time maintaining scripts. *(Launch-scope note: SQL mode is roadmap, not a launch feature — use this comparison as vision context and for post-launch expansion pricing, not as a launch-tier anchor.)* For governance, there is **no product at any price** — the substitute is Airtable Enterprise Scale audit logs (180 days, no record-level events) plus manual audit-response labor.

**Adjacent market — Salesforce DevOps (the maturity pattern we are following):** Baseout's category thesis is that Airtable is at the inflection Salesforce hit a decade ago — citizen-built apps became production infrastructure, and a backup/DevOps vendor ecosystem grew up around the platform and exited big. The consultant should review these vendors not as competitors we'll meet in a deal, but as the **pricing and packaging pattern-book for where "Airtable DevOps" is headed** (rows included in `competitor-landscape.csv`, flagged "Adjacent market — Salesforce DevOps"):

- **Own Company (ex-OwnBackup)** — Salesforce backup/recovery leader; ~7,000 customers; **acquired by Salesforce for $1.9B cash (Sep 2024)** — the category's proof-of-exit. Peak valuation $3.35B (2021). Historically ~$2.90/protected-user/mo with a $500/mo minimum (third-party estimate); its pricing page now redirects into salesforce.com — the endgame where the platform absorbs its backup vendor. The Salesforce-backup category clusters at **~$2.50–4/protected-user/mo** (Veeam, Druva, Metallic; Salesforce's own native Backup & Restore is $10/user/mo).
- **Gearset** — the Salesforce DevOps suite (deploy, CI/CD, backup); bootstrapped six years, then **$55M growth investment at ~1,700 customers**; author of the annual *State of Salesforce DevOps* report — the exact playbook our State of Airtable DevOps report copies.
- **Copado** — Salesforce-native DevOps platform; **$140M Series C at ~$1.2B valuation** (2021); runs a competing report with the identical name — two vendors fighting over one report title is itself evidence that category-creation reports work.
- **Rewind** — the multi-SaaS backup analog (Shopify/GitHub/QuickBooks); **$65M Series B, 25,000+ organizations** — and the closest *business-model* analog to Baseout: SMB price points ($19–99/mo Shopify flagship, verified July 2026), a platform-native value metric (order volume — the analog of Baseout's credits), 365-day history + unlimited storage as the headline, and retention depth + cloud-sync-to-your-own-S3 as the enterprise differentiators.
- Pattern stats worth quoting to buyers: **87% of Salesforce teams back up their orgs or plan to** (Gearset 2024); **backup was the single most-adopted Salesforce DevOps practice at 70%** (Gearset 2025). Nothing equivalent exists for Airtable yet — that's the white space.

The pricing lessons from the analog (pricing verified July 24, 2026): Gearset prices **each module on a different unit** — deploy per admin seat ($215–320/user/mo), CI/CD per team ($550–1,100/team/mo), and notably **Backup per Salesforce *end-user* with a monthly minimum ($2.75–3.50/user/mo, $275–350/mo floor)** — i.e., the mature market prices *backup on estate size, not admin seats*, which directly validates Baseout's estate-based (credits) approach over per-seat. Gearset's backup tiers differentiate on **high-frequency backup jobs** — validating Baseout's Instant-at-Business gate. Copado shows the other motion: a free self-serve wedge (Essentials $0/$99/$249 per user/mo) under a sales-led enterprise platform (median contract ~$47K/yr per third-party transaction data). The packaging arc transfers cleanly: backup as the wedge → DevOps/intelligence as expansion → compliance as the enterprise gate. What doesn't transfer: the absolute price levels ($275/mo backup *floors*) assume Salesforce-scale budgets; Airtable estates budget an order of magnitude lower today — the gap between those two numbers is the category's growth thesis.

---

## Legacy Product & Pricing History

### Q: What is the legacy product's current pricing/structure?

**[DOCUMENTED]** On2Air Backups (what our ~330 active subscriptions pay today):

| Plan | Price/mo | Bases | Records | Attachments | Restores | Max frequency |
|---|---|---|---|---|---|---|
| Basic (free) | $0 | 1 | ~1,000 | 25 | 1 | — |
| Starter | $9.99 | 1 | 50,000 | 2,500 | 1/mo | Monthly |
| Essentials | $29.99 | 15 | 250,000 | 25,000 | 1/mo | Weekly |
| Professional | $49.99 | 50 | 1,000,000 | 500,000 | 5/mo | Daily |
| Premium | $79.99 | 250 | 5,000,000 | 1,000,000 | 10/mo | Hourly |
| Enterprise | Custom | 250+ | Custom | Custom | Custom | Custom |

Flat fee regardless of actual usage; frequency hard-gated by tier; count-based caps did the limiting.

### Q: How was current (draft) pricing and tiering derived?

**[DOCUMENTED]** The draft ladder (Trial $0 / Launch $49 / Growth $99 / Pro $199 / Business $399 / Enterprise custom, with non-public Starter $29 and Bridge $9.99; annual ≈ 20% off) was derived internally from four anchors: (1) legacy On2Air prices as the migration floor; (2) Airtable's own per-seat spend ($24–54/seat) as a budget proxy; (3) competitor references; (4) cost floors from the infrastructure analysis. **Update (founder direction, July 24, 2026):** anchor (1) is demoted — with the coexist-then-sunset launch sequencing (see the Legacy Migration section), Baseout's launch pricing is to be set **independently** of On2Air's price points; legacy anchors inform only the later transition plan. The **credit meter** was chosen over count caps deliberately — one abstract unit unifying backup volume × frequency, restores, API and AI usage, with the explicit fairness story "no more artificial limits." **All of this is offered as a strawman, not a commitment** — internal drafts were intentionally withheld from the Decision Inputs doc to avoid anchoring, and this engagement exists to pressure-test the model. Known internal inconsistencies are catalogued honestly in Strategy Briefing §10 (e.g., a $49-vs-$59 Launch price conflict, two incompatible trial definitions, a storage-credits contradiction in the credit doc).

### Q: Do you have initial tiering/pricing you'd like to discuss?

**[INTERNAL DRAFT]** Yes — the full draft is in `shared/Baseout_Features.md` §3–5:

| | Trial | Launch | Growth | Pro | Business | Enterprise |
|---|---|---|---|---|---|---|
| Monthly | $0 | $49 | $99 | $199 | $399 | Custom |
| Annual (eff./mo) | $0 | $39 | $79 | $159 | $319 | Custom |
| Credits/mo | 1,000 | 15,000 | 40,000 | 120,000 | 400,000 | Custom |
| Frequency | Monthly | Weekly | Weekly | Daily | Daily + Instant | Daily + Instant |
| Database | D1 schema-only | D1 full | D1 full | Shared PG | Dedicated PG | BYODB |
| Spaces | 1 | 3 | Unlimited | Unlimited | Unlimited | Unlimited |

Plus non-public **Starter $29** and **On2Air Bridge $9.99**, credit add-on packs ($25–420/mo), seat add-ons ($6–12), storage overage ($0.50/GB R2; $1–3/GB DB), and credit overage ($0.004–0.008/cr by tier, hard-cap default).

> **Launch-scope note (founder direction, July 25, 2026):** the **Database row above is roadmap, not launch** — SQL mode (SQL REST API, Direct SQL, the Shared/Dedicated PostgreSQL ladder) will likely not be ready at launch and should not be highlighted in the original pricing. Launch tiers should differentiate on what ships at launch (frequency, retention, Spaces, credits, schema intelligence); the database ladder becomes post-launch expansion packaging when it lands.

### Q: How are/will prospective clients find your product?

**[DOCUMENTED]** Channels, in rough priority: the **Airtable Marketplace listing** (planned — organic discovery); the Airtable community fabric (Airtable Community forum, r/airtable, TableForums, **BuiltOnAir** podcast/community — the upcoming survey is co-sponsored with them); consultant/agency networks and Airtable's partner directory; the **State of Airtable DevOps report** as the category-marketing engine; the inherited On2Air footprint (years of SEO, forum presence, existing customer word-of-mouth); and the **pre-registration schema visualization hook** — OAuth in and see your base's schema diagram *before* creating an account (stays free; it's the top-of-funnel conversion device).

### Q: Does the current billing platform support usage-based credit meters/overages?

**[DOCUMENTED]** Two-part answer:

- **Stripe (the platform): yes.** One subscription per organization, one subscription item per platform (multi-platform-ready), entitlements resolved from product metadata, metered/usage billing, seats, coupons, per-item trials — no known blocker to tiered, usage-based, hybrid, or seat models. Plan limits live in database rows, not code, so packages change without deploys.
- **Our pipeline (the implementation): not yet.** The credit ledger, metering cron, and auto-billing are designed (full DB architecture in `Pricing_Credit_System.md` §8) but **not in code**. Today's enforceable surface: frequency gating, base caps, trial limits, per-run usage *recording*. A launch model can only enforce what's built — this is the central sequencing decision.

---

## Features, Costs & Value

### Q: Please list ALL features and descriptions for product tiering with associated costs to be baked into price.

**[DOCUMENTED]** Delivered in the data-request template: **`research/pricing/feature-value-matrix.csv`** — 67 features across Backup / Restore / Schema / Data / Automations / Interfaces / AI / Analytics / Governance / Integrations / Notifications / Admin, each with its primary value metric, cost-to-Baseout character, tier placement per the Features spec, and build status (critical: unshipped features can't carry launch price promises).

### Q: Please provide a "value" (estimated perceived customer value) for each feature.

**[DOCUMENTED — as estimates]** Included in the same CSV: an Essential/High/Med/Low rating plus a dollar estimate per feature. Each dollar figure is anchored to verified market data (ProBackup's ladder, Whalesync's record-count pricing, Stacksync's floor, On2Air's legacy prices) or to demand evidence from the research (e.g., schema changelog rated Essential because the category is vacant and the pain evidence is strongest there). Treat the column as a workshop starting position, not a conclusion.

### Q: What is your average infrastructure cost per client?

**[DOCUMENTED — order-of-magnitude profiles for floor-setting]** (Decision Inputs §5.4):

| Profile | Shape | Monthly COGS |
|---|---|---|
| Small static/BYOS | 1 base, 10K records, weekly to customer's Drive | **< $0.50** |
| Medium managed | 5 bases, 250K records, 10 GB attachments, weekly to R2 | **~$1–3** |
| Large dynamic-shared | 20 bases, 1M records, daily incremental into shared PG | **~$5–15** |
| Heavy dedicated | 50 bases, 5M records, 200 GB, daily + dedicated PG, long retention | **~$30–80+** |

Base platform fixed costs are low hundreds of $/mo at launch scale. Credits are priced at roughly **10–100× marginal cost** — the meter's job is value capture and abuse prevention, not cost pass-through. Infrastructure billing exports (Cloudflare, DigitalOcean, Trigger.dev, Stripe) are available to firm these up.

### Q: What features/attributes drive hosting and infrastructure costs the most?

**[DOCUMENTED]** In order:

1. **Dedicated PostgreSQL instances** (~$19–60+/mo each) — the dominant step cost, and the flagged margin risk when combined with unlimited Spaces.
2. **Storage retention** — the quiet accumulator; activity meters reset monthly, storage promises don't. Smart Rolling Cleanup is the containment feature (not yet built — storage growth is currently unbounded).
3. **Static-mode backup frequency** — static re-transfers *everything* each run, so cost scales linearly with frequency even if nothing changed. (Dynamic inverts this: deltas only. Steering customers to dynamic is cheaper for us AND unlocks the upsell surface — a well-aligned asymmetry.)
4. **Attachment volume** — transfer compute + storage writes; ~$0.01/GB to move, ~$0.015/GB-month to keep on R2.
5. **The initial-backup spike** — first backup of a large base can be 100–200× steady-state usage; absorbed by onboarding credit buckets so the first invoice doesn't ambush anyone.
6. What does **not** drive cost: restore/download egress (R2 zero-egress), API calls, seats, emails — all ~zero.

### Q: How distinct are the new schema management features from standard backup features?

**[DOCUMENTED]** Architecturally and commercially distinct. Backup is file-output (CSV/JSON to a destination); Schema is a **database-backed intelligence capability** — it requires Dynamic mode writing schema metadata to a queryable store, and it's the daily-use surface (changelog, health score, docs) versus backup's set-and-forget insurance. They share the ingestion pipeline but nothing else. Market-wise, schema intelligence is the **vacant category** (the only dedicated tool died; nothing native exists) while backup is contested — so schema features carry differentiation weight that backup features can't. The cheapest architectural trick in the product: schema-only D1 delivers this surface for pennies without hosting record data.

### Q: Do you view schema visualization as a core feature in all tiers, or a premium upgrade?

**[INTERNAL DRAFT]** **Core-with-a-premium-ladder.** Basic visualization is on every tier including Trial (via schema-only D1), and the pre-registration hook — see your schema diagram before you even sign up — is a firm commitment that stays free (it's the funnel). The premium ladder sits on top: relationship filtering (Starter+), changelog retention depth (30d→24mo), health-score configurability (Pro+), AI-generated docs (Pro+), export formats (PNG→SVG→PDF→embed). Rationale: visualization is the acquisition device; the *history and intelligence* around it is the monetization.

### Q: How are AI credits consumed by the user?

**[DOCUMENTED]** There is **no separate AI credit currency** — AI operations draw from the same unified transfer-credit meter as everything else: **AI documentation generation = 10 credits/run; AI schema insight = 5 credits/run** (rates DB-stored, tunable without deploys). Underlying COGS is cents per generation (Cloudflare Workers AI, open models). V2 AI (MCP server, RAG, chatbot) will carry real inference infrastructure and is expected to extend the same meter, priced at Business+.

### Q: What is your estimated underlying API cost?

**[DOCUMENTED]** The Airtable API itself is **free** — its constraint is rate limits (5 req/s per base; pagination at 100 records/request), which makes large backups cost *time*, not dollars. Our own marginal cost anchors (in the feature CSV's cost column, from Decision Inputs §5.2): 1,000 records transferred ≈ fractions of a cent; 1 GB attachments ≈ ~$0.01; R2 storage ~$0.015/GB-mo; D1 ~$0.75/GB-mo; shared PG $15–60/instance amortized; dedicated PG ~$19–60+/customer; AI generation ≈ cents; API call/SQL query/email ≈ zero. Stripe takes ~2.9% + $0.30.

### Q: Should AI credits be bundled as a monthly allowance per tier, or sold as a separate top-up/add-on?

**[INTERNAL DRAFT — open for your recommendation]** Current design: **bundled in the unified meter** (AI ops consume plan credits) with **generic credit add-on packs** ($25–420/mo) as the top-up path — no AI-specific SKU. Arguments for keeping it unified: one number for customers, one billing pipeline, COGS covered by the 10–100× credit margin. Argument for a separate AI allowance worth weighing: Airtable itself now bundles named AI credit allowances per plan (15K–25K/user/mo — verified July 2026), so the ecosystem is learning "AI credits" as a distinct concept; and V2 AI (RAG/chatbot) has real per-conversation inference costs that a flat transfer-credit rate may misprice. Genuinely undecided — a good workshop question.

### Q: Are specific administrative guardrails reserved for enterprise/top tiers?

**[DOCUMENTED]** Yes:

- **Enterprise only:** BYODB (data never leaves their environment), SSO/SAML, dedicated CSM + SLA, Teams/PagerDuty channels, compliance reporting + SOC 2/GDPR tooling, data-sharing rules, Airtable Enterprise API, custom retention, AI skills/BYO-model, writeback, unlimited everything — **including unlimited dedicated-database Spaces via contract (founder decision July 25, 2026: Business carries a dedicated-DB Space cap, value TBD).**
- **Business+:** dedicated PG isolation, instant backup, Direct SQL, outbound webhooks, PII detection, audit trail, custom cleanup policies, the Governance capability, priority chat.
- **Deliberately NOT enterprise-gated:** multi-Space management (unlimited at Growth $99 — it's the consultant magnet, not an enterprise gate) and audit *reports* (all tiers — provable backups are core to the trust story; only detailed log retention ladders up).
- **Constraint:** SOC 2 is in progress (~6-month runway from April 2026) — Business/Enterprise can't be broadly marketed until certified.

### Q: Do you have a margin % target or floor? Does it differ by tier?

**[FOUNDER DIRECTION, July 25, 2026 — floor on record]** **Gross-margin floor: ~75% per tier at heavy (P90) usage, with ~85% blended as the working target.** Basis: the commissioned usage-cost analysis (**`research/pricing/infrastructure-cost-model.md`**, built from list prices verified July 25, 2026) shows every tier comfortably clears that floor at typical usage (blended infra+payments gross margin ≈ 88–92%), so the floor is a guardrail, not a stretch. Context: the cost structure shifts from On2Air's mostly-fixed costs to per-usage costs (R2, D1/PostgreSQL, per-run compute) — the model quantifies them per tier. Documented cost physics that inform the number: credits price at 10–100× marginal cost; small static/BYOS customers cost <$0.50/mo to serve; the two places price sits *close* to cost are D1 storage overage and the dedicated-PG tier; the Business tier's dedicated-PG-per-Space × unlimited-Spaces combination was flagged as the one place margin could go negative — **now resolved by two decisions (July 25, 2026): (a)** provision per-Space dedicated PG on serverless PAYG PostgreSQL (Neon-class: scale-to-zero, ~$1–5/mo per typical Space — see cost model §4), and **(b) founder decision: Business includes a capped number of dedicated-DB Spaces (cap value TBD); unlimited dedicated-DB Spaces move to Enterprise via contract.** Enterprise/BYODB remains the *cheapest* tier to serve on infrastructure; its margin is support/compliance surface, not COGS.

### Q: Is there a certain tier or feature you want to drive clients to, and why?

**[INTERNAL DRAFT]** Two deliberate magnets:

1. **Growth ($99) as the mid-ladder magnet** — unlimited Spaces/bases makes it the no-brainer for any organization managing more than a few bases, and it sits at the floor of the founder's $100–200/mo target band. **Consultant note (founder direction, July 25, 2026):** consultants are driven to Growth *for their own account*, but their bigger role is as a **channel** — every client they onboard signs its own paying subscription, and the consultant earns a referral/affiliate commission. There is deliberately no umbrella plan where one consultant subscription covers many clients: consultants get multi-account admin access and account switching instead. Consultants are also the community's amplifiers (BuiltOnAir, forums), so their advocacy compounds — the affiliate program monetizes that channel rather than discounting it away.
2. **Dynamic mode generally** — incremental sync is cheaper for us than static re-transfer AND unlocks the intelligence upsell surface (schema changelog, health, docs — and, down the road, SQL). Every nudge toward dynamic aligns COGS reduction with expansion revenue. The credit meter already encodes this (static burns credits faster at high frequency).

---

## Legacy Migration

> **FOUNDER DIRECTION (July 24, 2026) — supersedes the launch-coupled migration framing in the internal docs below.** Baseout launches as a **new, independent platform "from the creators of On2Air."** The two products **coexist**: On2Air keeps running unchanged while Baseout works out the kinks with new customers. Only once Baseout is proven does On2Air get a **sunset announcement plus a transition plan** — auto-transition into Baseout with a grandfathering effort that thanks legacy customers for their long-term support. Three consequences for this engagement:
>
> 1. **Baseout pricing is set independently.** The On2Air price points ($9.99–$79.99) are *context*, not constraints — no launch-day tier needs to absorb the legacy cohort. Design the right ladder for the market; the transition plan is a separate, later exercise.
> 2. **No migration mechanics ship at launch.** The 90-day migration window, Bridge plan activation, and migration credit grants described in `Pricing_Credit_System.md` §6 remain valid *mechanics* but their **trigger moves from Baseout's launch to On2Air's sunset date** (TBD, confidence-gated).
> 3. **The migration cohort is a phase-2 deliverable** of this engagement: the workshops should still pressure-test the transition mapping, but it does not gate launch pricing.

### Q: Please provide historical data/reports on legacy migration clients.

**[PARTIALLY DELIVERED — subscription data analyzed; usage join pending]** The active-subscription export is analyzed in **`research/pricing/legacy-subscription-analysis.md`** (July 25, 2026): 333 active subscriptions, $11.1K MRR / $132.7K ARR, full plan mix, billing-cycle split, and transition-revenue math against the sunset-time mapping. **It corrects two prior assumptions:** the base is ~333 subs, not ~200; and it skews *higher* than "smaller/simpler" — Professional+Premium hold 58.5% of ARR. Still available on request for the deeper cut: per-customer usage shape (bases, records, attachment volumes, backup frequency) and per-run telemetry — needed for the WTP/underpayment join and consultant-account identification (email domains alone identify none). Known qualitative facts hold: multi-year tenures are common; churn is low once configured.

### Q: When you simplified the product suite last year, what expectations/commitments were set regarding legacy pricing? How was it received?

**[FOUNDER ANSWER, July 25, 2026]** The simplification: On2Air's Schemas, Forms, and Actions products were sunset, leaving Backups as the only product. **No promises or commitments were made.** Backups already had its own individual pricing, and that pricing was simply maintained. Customers paying for an all-apps **bundle had their prices adjusted *down*** to standard Backups pricing as the other apps were sunset — no one paid more after the simplification. **Going forward there are no expectations or promises constraining On2Air Backups pricing** — the transition-plan design (phase 2) starts from a clean slate contractually and reputationally.

Consultant-relevant implications: (1) the only precedent set is a *customer-favorable* one (prices adjusted down, core product untouched) — useful goodwill to reference in sunset messaging; (2) the base's multi-year tenures and continued growth through that simplification (~330 active subs today) suggest it was absorbed without meaningful churn; (3) the grandfathered-discount-off-list transition direction (see Legacy Migration section) faces no inherited pricing commitments — the constraint is purely relationship management, not obligation. Related GTM note still open: former Schemas users are warm leads for Baseout's schema-intelligence features (the sunset left that demand unserved).

### Q: What pricing-related feedback have you received?

**[DOCUMENTED — directional]** (a) The team's own assessment that On2Air was underpriced for the value; (b) migration sensitivity is real — these customers chose a cheap, simple product, so any new model needs a no-shock story; (c) multi-year tenures indicate the subscribe-and-forget utility is sticky at current prices (weak price resistance signal); (d) category awareness is low — most Airtable users don't know third-party backup exists, so price objections are rarer than existence objections. Structured WTP data is pending the survey (below).

### Q: Which legacy migration strategy aligns best with your business goals? (Options A / B / C)

**[FOUNDER DIRECTION, July 24, 2026]** None of the three as posed — all three assume migration happens *at* Baseout's launch, and it doesn't. The actual strategy is **coexist first, sunset later**:

- **Phase 1 (launch):** Baseout launches independently ("from the creators of On2Air"). On2Air customers stay on On2Air, unchanged — no forced move, no price change, no feature lock. They may adopt Baseout as new customers if they choose.
- **Phase 2 (confidence-gated, date TBD):** On2Air sunset is announced with a transition plan — auto-transition into Baseout paired with a **grandfathering effort framed as gratitude for long-term support**. **Founder direction on its shape (July 25, 2026):** legacy customers should expect **an increase from what they pay today, but at a grandfathered discount off Baseout list prices** — grandfathering means a discount vs. list, not a freeze at legacy prices. (This refines the older internal mapping in `Pricing_Credit_System.md` §6, which had some cohorts at same-or-lower prices; treat the founder direction as current. Exact discount depth/duration is a workshop topic.)

Within Phase 2, the previously designed mechanics still apply and land closest to a **B + C hybrid with A's feature-lock mechanic**:

- **Option B mechanics:** year-1 price hold, then automatic transition to standard pricing with 60-day notice. Only the lowest cohort ($9.99 Starter → On2Air Bridge) experiences a step-up (to $29 non-public Starter after year 1). Migration pricing requires signup within a ~90-day window.
- **Option C mechanics layered on:** every cohort gets a one-time migration credit grant (2K–80K credits ≈ 2 months of typical usage) to absorb the initial full backup.
- **Option A's lock, without the resentment:** legacy users carry `dynamic_locked` — new dynamic/AI features show as upgrade CTAs rather than being included or hidden. They keep their price *and* their exact product; the new surface is visibly one click away.
- **Why not pure A:** indefinite grandfathering caps the largest revenue-recovery opportunity (the underpriced heavy users below) and creates a permanent second product to maintain. **Why not pure C:** immediate repricing contradicts the anchor constraint and risks churning a low-churn base for modest ARR. The mapping is genuinely gentle: Essentials customers get a price *cut* ($29.99→$29), Professional lands cheaper on annual ($49.99→$39), Premium holds at $79 for year 1.

### Q: What percentage of legacy ARR comes from "heavy power users" significantly underpaying relative to consumption?

**[PARTIALLY ANSWERED — subscription side now analyzed; usage join still needed]** The potential-underpayer pool is now quantified from the July 2026 Stripe export: **Professional + Premium = 128 subscriptions (38.4% of the base) holding $77,671 = 58.5% of legacy ARR.** That is the *ceiling* on heavy-power-user ARR exposure. The credit-equivalence analysis (`Pricing_Credit_System.md` §5) quantifies the per-account subsidy at full utilization: a **Professional** user at plan limits ≈ **129,000 credits/mo** — Baseout Pro-tier ($199) consumption for $49.99; a **Premium** user at full hourly utilization ≈ **10.6M credits/mo** — beyond Business scale, for $79.99 (4–100×+ underpayment). What fraction of the 128 accounts actually runs at those levels requires joining run telemetry (per-run record/attachment counts, available) to these subscriptions — still the single best pre-workshop analysis to run. Mitigating facts: Premium is thin (20 subs, 13.6% of ARR), and most Premium users don't simultaneously max every limit. The coexistence period (see launch-sequencing callout) conveniently defers this exposure — by sunset time, real Baseout telemetry will exist to design their transition tiers from data.

### Q: How many active paid subscribers on the legacy product, and breakdown by plan type?

**[DOCUMENTED — Stripe export analyzed July 25, 2026]** **333 active paying subscriptions** (trial subscriptions were excluded from the export — founder-confirmed; one minor add-on subscription also excluded). **This corrects the "~200 paying customers" figure used in earlier docs — the active base is ~two-thirds larger.** Full analysis: `research/pricing/legacy-subscription-analysis.md`.

| Plan | Price/mo | Subs | % of subs | MRR | ARR | % of ARR |
|---|---|---|---|---|---|---|
| Starter | $9.99 | 57 | 17.1% | $520 | $6,236 | 4.7% |
| Essentials | $29.99 | 148 | 44.4% | $4,064 | $48,770 | 36.8% |
| Professional | $49.99 | 108 | 32.4% | $4,966 | $59,593 | 44.9% |
| Premium | $79.99 | 20 | 6.0% | $1,507 | $18,078 | 13.6% |
| **Total** | | **333** | | **$11,057** | **$132,678** | |

Other facts from the export: 49% annual-billed / 51% monthly (annual discount ~16.6% — so the base already accepts annual terms near Baseout's planned ~20%); average revenue per account $33.20/mo; **no Enterprise/custom subscriptions exist in Stripe**; the base skews *higher* than earlier docs assumed — Essentials is the modal plan, but the revenue center of gravity is Professional ($49.99), and Professional+Premium hold 58.5% of ARR.

### Q: Please provide any survey data on willingness to pay, pricing, or preferred features/tiering.

**[PENDING]** The **State of Airtable DevOps survey** is **not yet live — it launches in the coming months** (co-sponsored with BuiltOnAir); every claim that will depend on it is marked [SURVEY-PENDING] in our research discipline. The instrument is designed and includes the pricing-relevant questions: C1 (current backup practice distribution), C6 (formal external-copy requirement share), E3 (SQL-access demand), D5 (schema-visibility feature matrix), B1/B2 (respondent segmentation), G3 (interview opt-in — the source for WTP interviews). No structured WTP data exists yet; the interim proxies are legacy price anchors, Airtable seat spend, and verified competitor prices. Given the timeline, **don't block launch-pricing decisions on survey close** — use it to validate/adjust post-launch and to inform the phase-2 legacy transition; if WTP input is wanted sooner, the G3-style interviews could be run standalone with the segments already profiled.

---

## Materials & Closing

### Q: Please provide informational material to better understand the product.

**[DOCUMENTED]** In this repo (shareable as exports):

- **Product:** `shared/Baseout_PRD.md` (v1.1 — vision, personas, architecture, V1/V2 scope) · `shared/Baseout_Features.md` (v1.1 — the authoritative tier/capability/overage spec) · `shared/Pricing_Credit_System.md` (credit design + migration strategy + DB architecture).
- **Pricing engagement set:** `overview/pricing/Baseout_Pricing_Decision_Inputs.md` (the neutral inputs doc written for this engagement) · `overview/pricing/Baseout_Pricing_Strategy_Briefing.md` (the opinionated internal briefing incl. spec-vs-built reality check) · `overview/features/Baseout_GTM_Marketing_Inputs.md`.
- **Research:** `research/customers/research-notes.md` (verified evidence base, incl. competitor pricing re-verified 2026-07-23) · `research/customers/state-of-airtable-devops-report.md` (draft) · `research/pricing/customer-segments-workshop-1.md` (segments deep-dive).
- **Data-request templates (this engagement):** `research/pricing/competitor-landscape.csv` · `research/pricing/feature-value-matrix.csv`.
- **Live references:** legacy pricing at on2air.com/pricing; the marketing site and product mockups/design harness exist in-repo (`product/website/`, `apps/design`) — live links and demo access available on request.

### Q: Anything else not covered above, or anecdotal information to share?

**[DOCUMENTED — the things a pricing consultant should know that don't fit a template]**

0. **Launch sequencing (founder direction, July 24, 2026):** Baseout launches as a new platform "from the creators of On2Air," runs **in parallel with On2Air** while the kinks get worked out, and only later — confidence-gated — does On2Air get a sunset announcement with an auto-transition path and a gratitude-framed grandfathering effort. Price Baseout for its market on its own merits; treat the legacy transition as a separable phase-2 workstream. (Several internal docs still assume launch-day migration — the callout in the Legacy Migration section governs.)
1. **The sequencing constraint is real and central.** The designed credit model cannot be enforced by shipped code today (no metering pipeline, no restore, no dynamic DB provisioning, no retention/cleanup). Launch pricing either starts with what's enforceable (flat tiers + frequency + caps) and layers metering in, or waits for the build. Please make this dependency explicit in your recommendation. **Founder confirmation (July 25, 2026): SQL mode (SQL REST API, Direct SQL, the PostgreSQL ladder) will likely not be ready at launch — it comes down the road. Launch pricing should not highlight or depend on SQL; treat it as post-launch expansion packaging.**
2. **Restore must never feel punitive in a crisis** — it's the moment the product proves its worth. Credit costs for extra restores (15–75) are deliberately modest; keep them that way.
3. **Bill-shock protection is table stakes:** hard-cap default, threshold alerts (50/75/90/100%), onboarding buckets absorbing the 100–200× first-backup spike, DB-stored rates tunable without deploys.
4. **Two near-opposite intents live in one ladder:** static/BYOS customers are buying "you never hold my data"; dynamic customers sell that stance back for SQL/intelligence. Worth validating one ladder serves both — pricing must never force privacy-motivated customers into hosted storage.
5. **The Sequin shutdown is a sales asset:** the closest SQL comparable died in Oct 2025 and deleted all customer data at closure. "What happens to your data layer when the vendor dies" is a differentiating question we answer well (BYOS/BYODB).
6. **Fresh competitive intel (July 2026) changed one thesis:** Whalesync repriced sharply down-market (Postgres at $20/mo, tiny record caps) — our SQL story must lead with "affordable at real estate sizes, bundled with governed backup," not "the only affordable SQL." The old "$249+/mo gap" framing is retired.
7. **V2 must extend, not break, the model:** multi-platform Spaces (Notion/HubSpot) arrive as additional Stripe subscription items with a possible multi-platform discount; MCP/RAG carry real inference COGS; the Governance suite is the enterprise expansion. The billing architecture was built for this.
8. **Known spec inconsistencies are catalogued, not hidden** — Strategy Briefing §10 lists ten (price-typo, trial definition, storage-credit contradiction, tier-gate conflicts, code drift). The Features spec v1.1 is the designated authority where they clash; several need explicit decisions during this engagement.
