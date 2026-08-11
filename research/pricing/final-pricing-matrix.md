# Baseout Final Pricing Matrix

> **Clean reference:** the usable, recommendation-free version of the current model lives in [`pricing-guide.md`](pricing-guide.md). This file remains the decision log (rationale, rejected options, resolved flags).

**Status:** COMPLETE 2026-08-03 — every pricing decision is locked (founder sign-off on the final open items same day). This file is the decision log; `pricing-guide.md` is the clean reference. Remaining work is engineering (engine-efficiency validation, lean cluster provisioning) and the Features.md reconciliation.
**Started:** 2026-08-03.
**Inputs:** `workshop1-responses.md`, `tier-cost-analysis.md`, `legacy-subscription-analysis.md`, `pricing-consultant-qa.md`, `customer-segments-workshop-1.md`, `shared/Baseout_Features.md` (current canonical tiers).
**Downstream:** every decision locked here must be reconciled into `shared/Baseout_Features.md` (naming dictionary §1, tier matrix, Stripe metadata §5.5) before implementation. Until then, Features.md remains canonical for code.

---

## 1. Tier naming ⏳

### 1.1 The problem

Current working names (**Launch / Growth / Pro / Business** + Trial, hidden Starter, Enterprise) encode **company stage**. But the actual selection driver for a Baseout tier is **estate size — the amount of data under management** (records + GB), plus the structural gates that ride with it (backup frequency, Spaces, database architecture). A 4-person consultancy can hold 5M records; a 500-person company can hold 40K. Names like Starter/Growth make the small-estate enterprise feel insulted and the large-estate small shop feel priced out of "their" tier.

Reference points:

- **On2Air (legacy):** Starter / Essentials / Professional / Premium — quality/persona ladder.
- **Airtable:** Free / Team / Business / Enterprise Scale — org-stage ladder (their selection driver *is* org shape; ours isn't).

### 1.2 Naming criteria

1. **Self-selection by estate size** — a visitor who knows roughly how many records/GB they have picks the right tier without reading feature lists.
2. **Instantly rankable** — a stranger can order the tiers correctly from the names alone.
3. **Stage-neutral** — no implication about company maturity (rules out Starter, Growth, Launch, Scale).
4. **Up-market credible** — a consultant recommending Baseout to an enterprise client can name the tier without apologizing; fits the "essential infrastructure / Airtable DevOps" positioning.
5. **Doesn't lean on the recovery promise** (positioning guardrail, `customer-segments-workshop-1.md` §4) — protective metaphors (Vault, Fortress, Shield) oversell restore capabilities we deliberately don't promise.
6. **Copy mechanics** — reads naturally in "Upgrade to X", "the X plan includes 1M records".
7. **Durable** — adding a tier later (or re-slicing allowances) shouldn't break the scheme or force renames.

One structural honesty check: tiers are **not purely volume** — frequency (weekly→daily→instant), database architecture, and Space count gate alongside the meters. A modest-volume customer who needs Instant backups belongs in a high tier. So the *name* should be a neutral ranked ladder, and the **estate numbers belong in the subtitle**, not the name itself.

### 1.3 Option families

| # | Family | Example ladder (4 paid + Enterprise) | For | Against |
|---|--------|--------------------------------------|-----|---------|
| A | **Capacity ladder** (consumer-tech convention) | Lite → Standard → Plus → Max | Universally read as *size*, not stage; crisp ordering; modern | Consumer flavor; "Lite" can undersell a $49 infrastructure product |
| B | **Neutral quality ladder** (storage/backup category convention) | Basic → Standard → Advanced → Premium | The convention in backup/storage products; enterprise-safe; boring in a good way | Says *quality*, not *quantity*; "Basic" undersells; forgettable |
| C | **Explicit size** | Small → Medium → Large → XL (or S/M/L/XL) | The most literal match to the selection driver; AWS normalized size-naming for infra buyers | Reads unpolished on a SaaS pricing page; verbal awkwardness ("we're on Baseout Large") |
| D | **Domain-flavored** | Snapshot → Archive → Vault → Fortress | Brandable, memorable | Not self-rankable (violates #2); protective metaphors violate guardrail #5; cute > clear |
| E | **Airtable-plan mirroring** | Team → Business → Enterprise-aligned names | Instant self-selection for the ICP ("match your Airtable plan") | Estate size varies wildly *within* an Airtable plan (our own telemetry shows heavy overlap), so it mis-selects; couples our brand to Airtable's renames; trademark discomfort |
| F | **On2Air continuity** | Essential → Professional → Premium (+1) | Familiar to the migrating base | Persona-flavored ("Professional"); only 3 ranks; drags the old product's ceiling into the new positioning |
| G | **Numeric estate tiers** | 250K → 1M → 5M → 20M (records in the name) | Perfect volume self-selection; zero ambiguity | Locks allowances into names (any re-slicing = rename); hides the frequency/DB gates that also define tiers; awkward verbally |

### 1.4 Assessment

- **D, E, F reject cleanly** against the criteria (rankability, mis-selection, persona-flavor respectively).
- **G is seductive but wrong for us**: it encodes *one* of the tier dimensions into the name and will fight every future allowance adjustment. Its virtue — explicit numbers — is fully captured by putting the allowance in the tier **subtitle** instead.
- **C is the dark-horse**: maximally honest, and infra buyers are habituated to size-naming — but it costs polish and the brand deserves better than t-shirt sizes.
- **A vs. B is the real choice.** Both are stage-neutral ranked ladders. A reads as *capacity* (what we want); B reads as *grade* (close enough, and safer up-market).

### 1.5 Recommendation (proposed, not locked)

**Option A — `Lite / Standard / Plus / Max`, with the estate allowance as the always-visible subtitle**, e.g.:

> **Standard** — up to 250K records · 50 GB · daily backups
> **Plus** — up to 1M records · 250 GB · daily backups
> **Max** — up to 5M records · 500 GB · instant backups

- Names carry the *ordering*; subtitles carry the *selection*. This is how every capacity-priced product (ESPs by contacts, storage by GB) actually achieves data-volume self-selection — the number does the work, the name just has to not lie about it.
- **Enterprise** stays **Enterprise** above Max (universal, sales-led, no confusion).
- **Trial** stays **Trial** (or **Free** on the public page); the hidden low-end tier and **On2Air Bridge** keep their internal names — they're unmarketed.
- If "Lite" feels too thin for a $49 infrastructure product, the conservative variant is **`Basic / Standard / Plus / Max`** or dropping to three public tiers + Enterprise.

**Implementation note (decouple now, decide display later):** Stripe metadata and code should gate on stable internal tier *slugs* (`tier_1`…`tier_4` or the existing slugs), with display names as copy. Renames then never touch billing logic again. This must be reflected in Features.md §5.5 when this section locks.

### 1.5.1 Capacity-ladder candidates (family A chosen; picking the words)

Name pool per rung — every word here is stage-neutral; the constraint is that adjacent rungs stay **unambiguously ordered**:

| Rung | Candidates | Notes |
|---|---|---|
| 1 (entry, $49) | **Lite**, **Core**, **Basic**, Mini, Compact | Lite = honest but can undersell; Core = dignified ("the essential capacity"); Basic = safe/bland; Mini/Compact = too consumer |
| 2 (mid, $99) | **Standard**, **Plus**, Core | Standard is the strongest anchor word in the family — whichever ladder is chosen, having a "Standard" rung makes every other rung self-locate |
| 3 (upper-mid, $199) | **Plus**, **Pro**, Extended, Advanced, Extra | Pro reads as a *grade* rung post-Apple (not a persona word in a ladder context); Extended/Advanced drift toward family B |
| 4 (top, $399) | **Max**, **Ultra**, Premium, Ultimate | Max = ceiling word, crisp; Ultra only works directly above Max or Pro (Apple-silicon convention); Premium is rank-ambiguous next to Max |

**Words to avoid entirely:** Unlimited (we meter — the name would be a lawsuit against our own pricing page), Scale/Growth/Launch/Starter (stage), Professional/Essential (legacy persona ladder), Enterprise (reserved for the actual Enterprise tier). **Rank-ambiguous adjacencies to avoid:** Core↔Standard, Premium↔Max, Plus↔Pro is *acceptable only* because Apple normalized Pro > Plus… but it still makes some readers pause — prefer not to use both in one ladder.

Curated full ladders:

| # | Ladder | Character | Risk |
|---|---|---|---|
| A0 | **Lite / Core / Plus / Max** ⭐ | Front-runner (founder direction 2026-08-03: keep Lite/Plus/Max; drop Standard — it default-anchors buyers to rung 2, against the self-select-by-volume philosophy). "Core" = what it is, not where you belong; ordering crisp on both joints (Lite<Core, Core<Plus); four punchy words | Loses Standard's deliberate herding effect — recover with a "Most popular" badge if wanted. "Lite" undersell risk remains |
| A1 | Lite / Standard / Plus / Max | The prior default. Telecom/data-plan convention; maximally legible | "Standard" default-anchors rung 2 (rejected); "Lite" may undersell a $49 infrastructure product |
| A2 | **Basic / Standard / Plus / Max** | A1 with a safer entry word | "Basic" is bland and mildly self-deprecating too |
| A3 | **Core / Plus / Max / Ultra** | Apple-silicon convention (base < Plus < Max < Ultra); "Core" gives the entry tier dignity | Ordering is only *instant* for tech-adjacent buyers; Core↔Plus rank takes a beat for others |
| A4 | **Core / Standard / Pro / Max** | "Standard" anchors the middle; Pro as grade-rung | Core↔Standard adjacency is the weak joint — which is bigger? |
| A5 | **Lite / Standard / Pro / Max** | A1 with Pro at rung 3 — matches how the market already talks about the $199 tier | Mixes Pro (grade) into a size ladder; mostly fine post-Apple |

Sentence tests to run on the finalist (per criterion #6): "Upgrade to ___." / "You're approaching the limits of your ___ plan." / "We're on Baseout ___." / "The ___ plan includes 1M records."

### 1.6 Decision ✅

**Locked 2026-08-03 (founder):** the public tier ladder is

> **Lite → Core → Plus → Max**, with **Enterprise** above (custom pricing, sales-led) 

- Estate allowance always appears as the tier subtitle on the pricing page (names carry ordering; numbers carry selection).
- Trial/Free, the hidden low-end tier, and On2Air Bridge keep their internal names (unmarketed).
- Stripe metadata + capability gating use stable internal slugs; these are display names only.
- **Follow-up:** reconcile into `shared/Baseout_Features.md` (§1 naming dictionary, tier matrix, §5.5 Stripe metadata) — Features.md still says Launch/Growth/Pro/Business until that lands.

---

## 2. Tier ladder & price points ⏳ (numbers from Workshop 2 WIP workbook, 2026-08-03)

**Source:** `Workshop 2 WIP Pricing.xlsx` (Vaishali), sheet **"WIP Pricing Model"** — treated as the current tier definition. (The "Your Proposed Pricing Model" sheet in the same workbook still carries the pre-workshop-1 *unified* credit meter — 15K/40K/120K/400K credits/mo — superseded by the dedicated-AI-credit decision in `workshop1-responses.md` §1. Use it for margin/positioning context only.)

| | **Lite** | **Core** | **Plus** | **Max** | **Enterprise** |
|---|---|---|---|---|---|
| (workbook name) | Launch | Growth | Pro | Business | Enterprise |
| Monthly | **$49** | **$99** | **$199** | **$399** | Custom ("Call for price") |
| Annual ✅ **~2 months free**, 9-ending (locked 2026-08-03, founder — supersedes the workbook's −20%) | $499/yr ($41.58 eff., −15.1%) | $999/yr ($83.25, −15.9%) | $1,999/yr ($166.58, −16.3%) | $3,999/yr ($333.25, −16.5%) | Custom |

> Annual decision rationale: "~2 months free" is the market-standard framing and matches the legacy On2Air annual structure; the +$9 adjustment gives every annual price a 9-ending sitting just under the $500/$1K/$2K/$4K thresholds (recovering the consultant's threshold logic at annual scale) while clawing back ~4–5 points of revenue vs. the workbook's 20%. Display rule: monthly price + "$X/yr — ~2 months free"; no separate discounted-monthly print. The 12M FC model and margin tables assume 20% — adjust in the re-run pass.
| Median-profile gross margin | 92% | 89% | 86% | 69% (worst-case COGS; ~82% at low end) | — |
| p90-profile gross margin | 78% | 73% | 58% ⚠ | — | — |

Consultant guardrails worth keeping: all prices under mental thresholds ($50/$100/$200/$400), 9-endings; ceiling advice = don't exceed $499 on the top public tier; Plus p90 margin pinch is the known compute-tail issue (`tier-cost-analysis.md` §2 mitigations: engine efficiency, frequency gating binding, fair-use compute policy).

### 2.1 Margin re-run — 2026-08-03 (final structure)

Re-priced against everything locked today: frequency ladder Monthly/Weekly/Daily/Instant, dedicated cluster at Plus, BYODB at Max, all-tier coverage (automations/comments/API/MCP/SQL/PII/SSO), the AI credit model (`ai-credit-model.md`: 1 credit = $0.008 cost / 1¢ retail), annual = ~2 months free, add-on library, migration 20% lifetime.

**Assumptions (planning-grade, 1× legacy engine efficiency, Small 1x compute $0.122/h):** 50/50 monthly/annual mix → blended revenue/mo Lite $45.29 / Core $91.13 / Plus $182.79 / Max $366.13. Compute = legacy cohort medians scaled by the new frequency caps (Lite ×0.5 → 6.3h, Core ×0.4 → 19.8h, Plus ×0.8 → 98h, Max $40 modeled). DB: D1 $0.05 / shared-cluster slice $2 / dedicated cluster $22 mid ($15 lean–$30) / Max larger $60 or BYODB $0. AI at **25% expected utilization** of full-burn ($0.40/$2/$10/$30). R2 at cohort medians. Stripe 2.9% + $0.30.

| Tier | Blended rev/mo | Median COGS | **Median margin** | Notes |
|---|---|---|---|---|
| Lite | $45.29 | $3.16 | **93%** | frequency drop to Monthly cut compute ~½ |
| Core | $91.13 | $9.83 | **89%** | weekly cap cut the daily-tail compute |
| Plus | $182.79 | $50.25 | **73%** ▼ | was ~86% — the drop is the dedicated cluster (+$22) and the AI allowance (+$10 expected) |
| Max (managed cluster) | $366.13 | $143.42 | **61%** | |
| Max (BYODB) | $366.13 | $83.42 | **77%** | BYODB is worth +16 pts — steer big estates there |

**Blended at goal mix 30/60/6/4** (Max half-BYODB): COGS ≈ $14.40 on $93.88 revenue → **≈85% blended margin — target met** at expected utilization and 1× efficiency.

**Migration cohort (20% lifetime off list):** margins ≈ Lite 91% / Core 87% / Plus 66% / Max 51–71% — blended ≈ 81–82%. Acceptable; Plus/Max migrants are the thin edge.

**p90 watch (compounded worst case — same caveat as the original analysis: real accounts don't max every lever at once):** Plus p90 ≈ $124 COGS → **32%** at 1× efficiency; ~50% at 3×; ~66% at 3× + lean cluster + expected AI. **Plus p90 remains the structural pinch** — the frequency change didn't help it (the Pro tail was already daily). Mitigations, in order of leverage: (1) **engine efficiency ≥2–3× vs. legacy — the single biggest lever, validate before launch**; (2) lean dedicated-cluster provisioning ($15-class to start, scale with use); (3) AI full-burn is bounded by the API/MCP call caps; (4) fair-use compute policy (per `usage-analysis.md` §5, launch requirement).

**AI-allowance exposure check:** full-burn AI COGS = $1.60/$8/$40/$120 by tier — only reachable via scripted MCP volume, which the call allowance caps. At 25% utilization AI is 1–8% of revenue everywhere. Lite's 200 credits ≈ 1,050 Balanced-model chat turns/mo — **the sanity check passes** (`ai-credit-model.md` §5), resolving §3.3 #7.

> **TBD to lock:** final confirmation of the four price points + annual discount; Enterprise floor for sales.

## 3. Gates & meters per tier ⏳ (analysis of the Workshop 2 workbook)

### 3.1 Gating-element inventory — three classes

Everything in the workbook (WIP sheet + "Tier Structuring Variables" sheet) sorts into three classes, which is also how the pricing sheet should present them:

1. **Meters** (quantified allowances, consumption-tracked): records under management, GB under management, AI credits.
2. **Structural gates** (capability ceilings that define the tier): backup frequency, number of Spaces, database architecture, schema-history retention, snapshot destinations, seats, monthly restores, MCP access.
3. **Feature gates** (on/off or graded by tier): backup coverage (automations/interfaces, comments), API access + rate limits, governance & security (SSO/SAML, audit logs, PII detection, Direct SQL), active-report caps, support level.

### 3.2 Full tier matrix (workbook values; new names applied)

| Lever | Class | **Lite** | **Core** | **Plus** | **Max** | Enterprise |
|---|---|---|---|---|---|---|
| Records under management | meter | 250K | 750K | 1.5M | 5M | Custom |
| File storage under management (GB — attachment files + snapshots kept in Baseout-managed storage) | meter | 50 | 250 | 500 | 1,500 | Custom |
| AI credits /mo | meter | 200 | 1,000 | 5,000 | 15,000 | Custom |
| Bring your own AI key (locked 2026-08-03, founder: **Plus and higher** — settles the earlier all-tiers vs. Max+ wavering. BYOK bypasses the AI-credit meter; Plus+ placement balances the credit upsell against the feature's pull) | feature | — | — | ✓ | ✓ | ✓ |
| Bases under management | gate | 15 | 50 | 150 | 500 | Custom |
| Backup frequency (max cadence — every tier may run any slower cadence) | gate | Monthly | Weekly | Daily | Instant | Instant |
| Manual (on-demand) backups /mo (locked 2026-08-03, founder — caps exist mainly because manual runs accrete snapshot/history storage) | gate | 1 | 5 | 10 | 25 | Custom |
| Spaces | gate | 3 | 10 | 25 | 100 | Custom |
| Database architecture | gate | SQLite (D1) | SQLite (D1) **or** dedicated Postgres database in a **shared cluster** | Dedicated Postgres database in a **dedicated cluster** | Dedicated cluster **or bring your own database** | Custom |
| Database size — org-wide total (record data only; Max=50 GB confirmed 2026-08-03; extendable +2 GB/$10/mo add-on, superseding the earlier not-upgradable-within-tier lock) | gate | 5 GB | 10 GB | 25 GB | 50 GB | Custom |
| Seats | gate | 1 | 5 | 10 | 25 | Custom |
| Monthly restores | gate | 3 | 10 | 30 | Fair use | Fair use |
| Schema history retention (ladder confirmed 2026-08-03) | gate | 90 days | 180 days | 1 year | 3 years | 5 years / Custom |
| Record history retention (NEW — same ladder as schema history for now) | gate | 90 days | 180 days | 1 year | 3 years | 5 years / Custom |
| Internal snapshots (usage applies to file storage under management) | feature | ✓ | ✓ | ✓ | ✓ | ✓ |
| Snapshot destinations (external; internal snapshots don't consume a slot) | gate | 1 | 2 | 3 | 5 (hard max) | Custom |
| Supported snapshot destination types | gate | Cloud drives (Drive, Dropbox, Box, OneDrive) | Cloud drives | Cloud drives **+ S3** | Cloud drives **+ S3** | Custom |
| MCP access (all tiers — locked 2026-08-03, founder: "usage drives usage"; supersedes workbook's Core+ gating) | feature | ✓ | ✓ | ✓ | ✓ | ✓ |
| Automations & interfaces backup (all tiers — same lock; supersedes consultant's Core+ suggestion) | feature | ✓ | ✓ | ✓ | ✓ | ✓ |
| Comments backup (all tiers — same lock; supersedes the §3.4 gate-to-Plus+ recommendation) | feature | ✓ | ✓ | ✓ | ✓ | ✓ |
| API access (all tiers — same lock) | feature | ✓ | ✓ | ✓ | ✓ | ✓ |
| Monthly call allowance — API + MCP + Direct SQL, one combined pool (locked 2026-08-03, founder; standard burst rate limit applies at every tier as over-usage protection) | meter | 10K | 50K | 250K | 1M | Custom |
| Active reports (locked 2026-08-03, founder) | gate | 5 | 25 | 50 | 100 | Custom |
| Documents (added + locked 2026-08-03, founder — content bytes count against file storage ⚠ see verification note below) | gate | 10 | 25 | 50 | 100 | Custom |
| SSO / SAML (locked 2026-08-03, founder: **all tiers** — supersedes the from-Plus lock earlier same day) | feature | ✓ | ✓ | ✓ | ✓ | ✓ |
| Audit logs (locked 2026-08-03, founder: from **Max** — supersedes the from-Core suggestion; retention ladder TBD) | feature | — | — | — | ✓ | ✓ |
| PII detection (locked 2026-08-03, founder: **all tiers** — supersedes the from-Max suggestion) | feature | ✓ | ✓ | ✓ | ✓ | ✓ |
| Direct SQL access (locked 2026-08-03, founder: **all tiers** — the combined call allowance is the limiter, not tier gating; supersedes PRD §10 Business+ and the earlier Plus+ draft) | feature | ✓ | ✓ | ✓ | ✓ | ✓ |
| Support | feature | Email | Priority email | Priority email | Priority + chat | Dedicated CSM + SLA |

**Trial ✅ (locked 2026-08-03, founder) — not a tier column.** The trial is **14 days of Lite**: full Lite allowances and features, but backup frequency is **one-time** (a single snapshot, plus whatever Lite's manual-backup allowance permits — TBD). **Trial data is deleted 14 days after the backup runs unless the user upgrades**, with escalating "your backup will be deleted on <date>" notifications as the deadline approaches (the deletion clock is the conversion mechanic). On the pricing page the trial is a line under the cards — "Free 14-day trial — full Lite access, one snapshot" — not a fifth card/column.

**Row definitions locked 2026-08-03 (founder):**
- **Bases / Spaces caps** — no naked "Unlimited" anywhere; the top public tier's cap is set high enough that no real customer hits it (telemetry-grounded ladders per §3.4).
- **Database (locked language 2026-08-03, founder)** — dynamic database at **every paid tier**. The *database* is always the customer's own; tiers buy the isolation class: **Lite** = SQLite (D1); **Core** = SQLite (D1) *or* a dedicated Postgres database in a **shared cluster**; **Plus** = a dedicated Postgres database in a **dedicated cluster** (whole cluster for that account); **Max** = dedicated cluster *or* **bring your own database**; **Enterprise** = custom. Databases are provisioned **per Space**. **No hosting-provider names on the pricing sheet** — "hosted on DigitalOcean" is documentation detail, not pricing copy; Supabase/Neon are *not* offered as managed hosting options. "SQLite (D1)" is the display form so buyers see the engine, parallel to "Postgres."
- **BYODB (at Max; framing locked 2026-08-03, founder)** — "Bring your own database: any Postgres we can reach with a connection string." **Approved (tested) vendors at launch: Supabase, Neon, DigitalOcean** — list grows over time; anything else works via plain connection string on a your-database-your-ops basis. Postgres-only at launch. Enterprise-side BYODB (VPC peering, private networking, on-prem, contractual guardrails) stays a sales-led custom arrangement. Rationale retained: BYODB *reduces* COGS (customer hosts); sovereignty buyers are an IT-policy segment, not a size segment; the expensive support topologies are exactly the ones gated to Enterprise.
- **Database size (revised 2026-08-03 — org-wide, not per-Space)** — one cap per tier across **all** Spaces, record data only (attachment/file bytes ride the file-storage meter): 5 / 10 / 25 / 50 GB total. Rationale: an org-wide number reads like every other meter (records and file-GB are org-wide), doesn't punish or reward Space topology, and is one number on the pricing sheet instead of a multiplication. The per-Space reality survives as a **technical footnote, not a price lever**: databases are provisioned one-per-Space, and **on D1 a single Space's database cannot exceed 10 GB (Cloudflare platform limit)**. At Lite (5 GB total) and Core (10 GB total) the org cap makes the D1 ceiling unreachable-by-construction anyway. Caps are extendable via the +2 GB / $10/mo add-on (locked 2026-08-03 — supersedes the same-day not-upgradable-within-tier lock); larger jumps = higher tier. Coherence check vs. the record meter: 1M records ≈ 1.5–3 GB in a DB with indexes (`tier-cost-analysis.md` §4), so Max's 5M records ≈ 7.5–15 GB — every tier's DB cap sits comfortably above its record allowance; the DB cap is a backstop against pathological record sizes, not the primary limiter. ⚠ Max = 50 GB carried from the per-Space draft — confirm (founder confirmed 5/10/25 explicitly; Max number wasn't restated).
- **Retention pair (ladder confirmed 2026-08-03)** — schema history retention and **record history retention** share one ladder: Lite 90d → Core 180d → Plus 1yr → Max 3yr → Ent 5yr/custom. Record history retention absorbs the "snapshot retention" gap item (§3.4 #1): it is the customer-facing name for how far back record-level history/snapshots go. Audit-log retention (Max+) rides the same ladder at its tiers (3yr at Max, 5yr/custom at Enterprise).
- **Documents — storage-attribution verification (2026-08-03):** founder direction is "documents count against file storage; DB entry per document, content body as an R2 file per document." Verified implementation today: document bodies are **JSON columns in the per-Space DB** (`bo_at_documents.body`, Plate document model) — no R2 involvement — so as built, document bytes fall under the *database-size* meter, not file storage. Recording the founder's target architecture (body → R2 file, metadata row stays; bytes then count under file storage) as the spec; the body-relocation is an implementation task. Pragmatic note: doc bodies are KB-scale — either attribution is economically negligible; the real lever is the 10/25/50/100 count cap.
- **Snapshot destinations (renamed & redefined 2026-08-03, founder — was "external storage destinations")** — each backup run produces **CSV snapshots** of the data; a snapshot destination is where those files are delivered. The name deliberately separates the two concepts: *records under management* = the live database; *snapshots* = point-in-time CSV files per backup. Mechanics: **Baseout-managed storage (R2) is always available** and doesn't consume a destination slot, but snapshots stored there are **not free — they count against the file-storage GB meter** (CSV files in our bucket, same treatment as attachments). The tier ladder (1/2/3/5) counts the **external** destinations a customer may add alongside ours. Types: cloud drives (Google Drive, Dropbox, Box, OneDrive) at every paid tier; **S3 unlocks at Plus**; Enterprise custom. **RESOLVED 2026-08-03: external snapshot copies do NOT count on the GB meter** (founder lean, concurred). Rationale for departing from workshop1 §3's "every managed copy counts": external bytes live in the customer's own storage (their Drive/S3 bill, not our R2); the service dimension of external delivery (registry, dedupe, integration maintenance) is now priced by the **destination-slot ladder** (1/2/3/5, $10/mo per extra slot) instead of by volume; and "your storage, your bytes — free" is a clean competitive line. The meter-escape concern is bounded: records under management, DB size, and frequency still meter the estate regardless of where snapshots land.
- **Connections (platform-side) are NOT a pricing line.** Canonical dictionary: a *Connection* is the Airtable OAuth link (input side) — distinct from snapshot destinations (output side). The destination cap bounds the output side; with Spaces now capped, platform Connections are implicitly bounded too (≤ 2 per Space × Space cap, per the existing Features.md product constant). Keep "2 Connections per Space" as product config, off the pricing sheet.

Support row carried from `Baseout_Features.md` (not in workbook). Seat overage pricing (consultant: cap seats per tier, sell additional seats) belongs in §4 add-ons.

### 3.3 Discrepancies to resolve before lock ⚠

1. ~~**Frequency ladder shifted down one rung.**~~ **RESOLVED 2026-08-03 (founder):** ladder is **Monthly / Weekly / Daily / Instant** — the tier value is the *maximum* cadence; every tier may run any slower cadence (a Max customer can back up monthly if they like). Display rule: show one word per tier, no "Daily + Instant" compounds. Accepted trade-offs: (a) margins improve — the Plus p90 compute pinch was driven by daily/instant tails that now live at Max; (b) migration friction accepted as upsell pressure — legacy daily-or-faster users (56% of Professional cohort) mapping to Core face "upgrade to Plus or run weekly." Recompute the §2 margin table against the final gates (same pass as #8).
2. ~~**Instant moves from Plus ($199) to Max ($399).**~~ **RESOLVED 2026-08-03 (founder):** Instant is **Max-only** (+ Enterprise). Supersedes Features.md/PRD "Instant at Pro+" — update both on lock.
3. ~~**Seats flat spot: Core = Plus = 3.**~~ **RESOLVED 2026-08-03 (founder):** seats = **1 / 5 / 10 / 25** / custom.
4. ~~**Lite external destinations = 1.**~~ **RESOLVED 2026-08-03 (founder):** external destinations = BYOS destinations outside our environment; managed storage always included and uncounted; Lite gets 1 BYOS destination. This supersedes Features.md's BYOS-at-Pro+ gating — BYOS now available at every paid tier (update Features.md §BYOS on lock).
5. ~~**Trial column is undefined in the WIP sheet.**~~ **RESOLVED 2026-08-03 (founder):** trial = 14 days of Lite, one-time backup, data deleted 14 days post-backup unless upgraded (see §3.2 Trial block). Residual TBDs: whether Lite's *dynamic* DB is live during trial or activates on upgrade, and the exact notification cadence for the deletion warning.
6. ~~**Product-mix targets disagree between sheets**~~ **RESOLVED 2026-08-03 (founder): "Most popular" badge goes on Core** — matches the FC model's goal distribution (Core 60%), will be literally true (legacy modal cohort Essentials maps to Core), and Plus doesn't need manufactured demand. Align the workbook's WIP-sheet mix (60/30/6/4) to the FC goal mix in the modeling pass.
7. ~~**AI credits scale 75×**~~ **RESOLVED 2026-08-03:** credit system defined in `ai-credit-model.md` (1 credit = $0.008 Workers-AI cost, 1¢ retail, consumption = CF cost × 125; 4-model menu Fast/Balanced/Advanced + embeddings). Lite's 200 credits ≈ 1,050 Balanced chat turns/mo — not broken. Full-burn exposure at Plus/Max ($40/$120) bounded by the API/MCP call caps; priced at 25% expected utilization in §2.1.
8. **Dedicated-cluster COGS at Plus — largely defused, re-run margins to confirm.** Earlier draft risked "dedicated PG instance × 25 Spaces" at $199. The locked model is **one dedicated cluster per account**, with the per-Space databases living inside it — so Space count no longer multiplies infrastructure. Residual: the §2 margin table still assumed a ~$2/mo shared-PG slice at Plus; a dedicated cluster is ~$15–60/mo depending on sizing. That trims Plus's median margin a few points (fine) — re-run §2 with a real cluster price. Max improves (BYODB customers host their own DB). Core's shared cluster = many accounts per cluster, cost profile unchanged from the old shared-PG assumption.

### 3.4 Gap analysis — meters & line items missing from the workbook ⏳

Cross-checking the workbook against `Baseout_Features.md` §3–§4 (the richer legacy matrix), PRD capability surface, and the usage telemetry:

**Caps that should exist (founder direction 2026-08-03: no naked "Unlimited" anywhere — every tier gets a cap; the top public tier's cap is set high enough that nobody real hits it):**

| Lever | Why records alone doesn't cover it | Proposed ladder (strawman) | Grounding |
|---|---|---|---|
| **Bases under management** | Compute fan-out is per-base, not per-record: each base = its own backup job/run, schema discovery, webhook subscription (Instant), and Airtable API budget. 500 tiny bases cost far more to serve than 1 big base with identical records. Also the most legible unit to an Airtable buyer. | Trial 1 / **Lite 15 / Core 50 / Plus 150 / Max 500** / Ent custom | Legacy On2Air gated bases 15/50/250 and telemetry hugs it: essentials p95 = 15 (max 34), professional p95 = 41 (max 52), premium p95 = 149 (max 161). 500 at Max is a no-real-customer ceiling |
| **Spaces** | Every Space carries real per-unit infra: its own database (D1 per Space; at Plus/Max a shared/dedicated **PostgreSQL footprint per Space**), a scheduler DO, backup configs. "Unlimited Spaces × dedicated PG" at Max is an unbounded COGS clause hiding in the matrix. | Trial 1 / **Lite 3 / Core 10 / Plus 25 / Max 100** / Ent custom | Replaces workbook's Unlimited-from-Core. Max=100 is the "relatively high, nobody hits it" cap; DB-architecture COGS per Space is the binding constraint |
| ~~**Connections**~~ | **RESOLVED 2026-08-03 — not a pricing line.** Platform Connections (Airtable OAuth, input side) ≠ Storage Destinations (output side). The external-destination cap bounds the output side; the Spaces cap implicitly bounds Connections (≤ 2/Space product constant). | Keep "2 per Space" as product config only | Founder direction; see §3.2 row definitions |

**Line items in Features.md the workbook dropped — recommend restoring:**

1. ~~**Snapshot retention**~~ **RESOLVED 2026-08-03:** restored as **record history retention** in §3.2, sharing the schema-history ladder (90d/180d/1yr/3yr/5yr) for now. Open follow-through: how retention interacts with Smart Cleanup grades (#3) and the file-storage meter (retained snapshots × per-destination counting).
2. ~~**Manual (on-demand) backups /mo**~~ **RESOLVED 2026-08-03 (founder): 1 / 5 / 10 / 25 / custom** — caps exist because manual runs accrete snapshot/history storage.
3. **Smart Cleanup policy grade** (Basic / Time-based / Two-tier / Three-tier / Custom) — pairs with snapshot retention.
4. **Backup coverage rows** — what's captured: schema, records, attachments, views, automations, interfaces, comments, media index. Recently built capture (views/comments/media) isn't in the workbook at all. Telemetry: **comments usage is zero across every active account** → gate comments to Plus+ at zero migration cost.
5. **Audit history retention** (Features: 30d→24mo ladder) — governance row.
6. **API surface rows** — PG REST API (Plus+ per DB-tier table), Direct SQL read-only (Max+), API rate limits per tier, SQL query rate limits. The workbook's single "MCP Access Y/N" is too coarse for the detail table.
7. ~~**Initial-sync absorption**~~ **RESOLVED 2026-08-03 (founder): no threshold, no fee — dropped entirely.** The initial full sync is absorbed as a customer-acquisition cost. Rationale: the model no longer prices compute directly, so a sync-size fee has no meter to hang on; oversized estates are naturally bounded by the tier's stock limits (records, file storage, database size). Supersedes workshop1 §3's "free up to X GB, fee above" policy.
8. **Fair-use compute policy** at Plus+ — the tier-cost mitigation (c) needs a public-facing sentence; it's a line item, not just an internal monitor.
9. **Restore size bound** — restores are capped by count only; add "up to N records per restore" or an explicit fair-use clause (telemetry: restores are near-zero — p95 = 0/12mo — so generous bounds cost nothing).
10. **AI feature gating beyond credits** — AI-assisted schema docs (Pro+/Plus+ in Features), AI annotations; the credits meter prices usage, but which AI *features* unlock per tier is a separate row.
11. **Overage/top-up rates per meter** (records, GB, AI credits, seats) — §4's job; the pricing sheet needs the rates row-adjacent ("$X per additional 100K records").

**Levers checked and deliberately absent (no change needed):** attachment *count* (replaced by GB meter — better unit); per-record versions (excluded from the record meter by design, monetized via retention); active-jobs count (telemetry p50 = 1 everywhere — the frequency gate covers it); egress/download fees (R2 egress is free; don't invent a customer-hostile line).

**Features.md ↔ workbook numeric conflicts to reconcile (beyond §3.3):** seats (Features 1/3/5/10/15/unlimited vs workbook 1/3/3/5), storage allowances (Features R2 5/20/75/250 GB vs workbook 50/250/500/1500 GB under management — different unit *and* different numbers), restores (Features 1/2/3/5/15/unlimited vs workbook 3/10/30/fair-use), frequency (§3.3 #1). The workbook is the newer thinking; Features.md §3–§4 must be rewritten from this file when it locks.

### 3.5 Pricing-sheet presentation: headline vs. full breakout

**Top of page — tier cards.** One card per public tier + Enterprise. Each card: name, price (monthly + "or $X/mo billed annually"), the "Most popular" badge on the goal tier, CTA, and **exactly six spec lines** (the self-selection levers, in this order):

1. **Records under management** — the primary selector
2. **File storage** (GB — attachments/files)
3. **Bases** — the unit Airtable buyers think in (swapped in for seats, founder 2026-08-03)
4. **Backup frequency** — the urgency selector
5. **Spaces**
6. **AI credits /mo**

Everything else is deliberately *not* on the cards. **Seats** move to the detail table (Collaboration group). Restore limits stay out of headline positioning (consultant + prior direction). Database architecture is a real differentiator but abstract at card level — it surfaces in the detail table where it can carry an explainer ("your backups in a queryable database"). Enterprise card: "Everything in Max, plus…" (BYODB, SSO/SAML, custom retention, CSM/SLA) + "Talk to us."

**Trial treatment:** no trial card or column. A single line under the cards — *"Free 14-day trial — full Lite access, one snapshot. No credit card."* (CC requirement TBD) — with each paid card's CTA starting the trial at that tier's intent. The 14-day deletion clock and its warning notifications are product behavior, not pricing-page content.

**Below the fold — full comparison table**, grouped, one row per lever, ✓/—/values per tier:

| Group | Rows |
|---|---|
| **Backup** | frequency · bases under management · what's covered (records, attachments, schema, views, automations & interfaces, comments) · snapshot destinations (count of external; managed R2 always available, metered on file-storage GB) · supported destination types (cloud drives all tiers; S3 at Plus+) |
| **Restore & retention** | monthly restores · record history retention · schema history & changelog retention |
| **Data access** | database architecture (SQLite (D1) → dedicated DB in shared cluster → dedicated cluster → BYODB) · database size (org-wide)* · SQL access · API access + rate limits · MCP access |
| **AI & intelligence** | AI credits · schema docs/AI features by tier · active reports |
| **Collaboration** | seats · Spaces |
| **Governance & security** | SSO/SAML · audit logs · PII detection · Direct SQL (read-only) |
| **Support** | support level ladder |

Presentation rules: meters always show the number (never just ✓); gates show the ceiling value; feature gates show ✓/— ; every row that's meterable links to the overage/add-on policy (§4) once locked. *Footnote on the sheet: "One database per Space — sizes are per database (record data only; files/attachments count against file storage under management)."

## 4. Overage & add-on packaging ⏳ (structure locked 2026-08-03; prices proposed)

**Founder direction (2026-08-03):** keep it simple — an add-on library with **one flat price per item across all tiers** (no per-tier add-on pricing). Customers buy more of an item or upgrade to the next tier. One-time vs. recurring follows the lever's time profile (`workshop1-responses.md` §2 flow/stock framework): **flow levers** (reset each cycle) sell as one-time top-up packs; **stock levers** (persist month over month) sell as recurring monthly add-ons.

### 4.1 Sellable add-ons

**Recurring monthly (stock levers):**

| Add-on | Unit | Proposed price | Anchor |
|---|---|---|---|
| Records | +100K | $10/mo | above in-plan effective rate (Core→Plus delta prices +750K at ~$75 of its $100); COGS ≈ $0.30 |
| File storage | +50 GB | $10/mo | $0.20/GB-mo — comp range $0.20–0.50; ≥6× margin per tier-cost §3 |
| Database size | +2 GB | $10/mo | added 2026-08-03 (founder) — supersedes the not-sellable listing below; $5/GB-mo prices dedicated-PG headroom conservatively |
| Bases | +3 | $10/mo | prices the per-base job overhead (tightened from +5, founder 2026-08-03) |
| Spaces | +1 | $10/mo | per-Space DB/scheduler footprint |
| Seats | +2 | $10/mo | consultant: cap seats, sell extras; unit set for uniform $10 pricing (founder 2026-08-03) |
| Snapshot destinations (external) | +1 | $10/mo | can't exceed the 5 hard max |
| Active reports | +5 | $10/mo | compute lever, internal cap philosophy |
| Documents | +10 | $10/mo | added 2026-08-03 (founder) |
| AI credits | +1,000/mo | $10/mo | flow levers also sold recurring (founder 2026-08-03): known monthly need → monthly add-on |
| API/MCP/SQL calls | +50K/mo | $10/mo | same |
| Restores | +3/mo | $10/mo | same |

**One-time packs (flow levers, +20% markup over the recurring price — founder 2026-08-03):**

| Add-on | Unit | Proposed price | Notes |
|---|---|---|---|
| AI credits | +1,000 | $12 | COGS <2% on Workers-AI-class inference |
| API/MCP/SQL calls | +50K | $12 | covers one-cycle spikes |
| Restores | +3 | $12 | telemetry says near-zero usage; modest price, never gouge a recovery moment |

The 20% one-time premium makes the recurring add-on the rational buy for any repeating need (two one-time packs already cost more than two months of the recurring version), mirroring the add-on-vs-upgrade convention one level down.

(Initial-sync fee removed 2026-08-03 — the first full sync is absorbed as onboarding cost at any size; see §3.4 #7. Oversized estates are bounded by the stock limits, not a sync fee.)

### 4.2 Deliberately NOT sellable (upgrade-only levers)

These are the tier ladder's structural rungs — selling them à la carte would dissolve the reason tiers exist:

- **Backup frequency** (monthly/weekly/daily/instant) — the primary tier identity; instant-as-add-on would gut Max.
- **Database isolation class** (D1 → shared cluster → dedicated cluster → BYODB) — the Core→Plus→Max spine.
- ~~**Database size**~~ moved to sellable (+2 GB/$10/mo, founder 2026-08-03) — supersedes the same-day not-upgradable lock. Note: on Lite/Core the D1 10 GB per-Space platform ceiling still bounds how far add-ons can stretch a single Space.
- **Retention ladders** (schema + record history) — the compounding-value upgrade driver.
- **Bring your own AI key** — Plus+ capability marker (locked 2026-08-03).
- **S3 destination type** — Plus's capability marker.
- **Audit logs** — Max's governance marker.
- **Support level** — tier service identity.

Every tier keeps multiple non-purchasable reasons to upgrade, so the add-on library extends tiers without cannibalizing the ladder.

### 4.3 Conventions

- **Pricing convention** (workshop1 §2): every add-on unit price sits **above the effective in-plan rate** of the next tier's bundle, so upgrading is always the rational move for sustained needs. Spot-check at proposed prices: replicating the Core→Plus delta via add-ons costs >$200/mo vs. the $100 upgrade — holds.
- **Mechanics:** recurring add-ons = Stripe subscription items (quantity-based); one-time packs = one-off invoice items. Both keyed to the same internal slugs as tier metadata.
- **Limit-hit defaults — RESOLVED 2026-08-03 (founder; revised same day from a published grace-overage model):** one rule set, identical across tiers — **warning threshold at 90%** of each limit (notifications + add-on/upgrade offer, repeated at 100%), **enforcement at the limit itself**. No published over-limit grace percentages (rejected because a known +25% grace becomes the de-facto limit); the only over-limit tolerance is an **unpublished engineering buffer** so in-flight jobs always finish (workshop1's never-fail-mid-job constraint). Per-class behavior at the limit: background meters (records/file-GB/DB-size) pause new runs at the next job boundary; interactive meters (AI, calls) stop cleanly at point of use with top-up offer; creation caps (Spaces/bases/seats/destinations/reports/manual actions/restores) block the next creation. Existing data never deleted on overage; restore always works. Chart in `pricing-guide.md` §7. Resolves workshop1 §2 Question A (notify-early + stop-at-boundary), with the 90% warning window carrying §4.1's add-on offers (Question B's purchase path).
- Prices above are **proposed, pending the §2 margin re-run pass**; structure (items, units, one-time vs. recurring, not-sellable list) is locked.

## 5. Legacy transition mapping ✅ (locked 2026-08-03, founder)

**Mapping:** Starter → **Lite** · Essentials → **Core** · Professional → **Plus** · Premium → **Max**.

**Offer (duration locked 2026-08-03, founder):** migrating On2Air customers get a **20% lifetime discount** on any Baseout tier **at or above their mapped tier** — positioned as a thank-you + migration incentive. The discount is **floating against list price** (list may rise over time; the 20% off persists as long as they remain a customer, riding whatever list becomes). Mechanically: a permanent Stripe coupon/discount on the subscription keyed off list-price line items — never a bespoke price ID per legacy customer, or future list changes strand them.

Notes for the modeling pass:
- This mapping sits **one tier higher than every prior model** (the workbook's Migration tab, tier-cost cohorts, and workshop1 all mapped Essentials→$49-tier, Professional→$99-tier, Premium→$199-tier). At list-minus-20% the mapped landing prices are $79.20 / $159.20 / $319.20 vs. legacy $29.99 / $49.99 / $79.99 — a ~2.6–4× ARPU step. Expect materially higher migration churn than the workbook's 10% assumption, or expect many customers to land a tier below their mapping (which the "at or above" rule permits pricing for the Starter cohort only via Lite).
- The usage telemetry supports the *capacity* side of the mapping (each legacy cohort's estate fits its mapped tier's allowances) — the open question is price tolerance, not fit.
- On2Air Bridge (sunset-triggered $9.99 tier) is unaffected by this section; it activates at sunset announcement per Features.md.
