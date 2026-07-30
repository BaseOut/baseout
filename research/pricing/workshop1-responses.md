# Baseout Relaunch Workshop 1 — Responses & Decisions

**From:** Dan (Openside)
**To:** Vaishali
**Date:** July 29, 2026
**Re:** Follow-ups from the 7.28.26 Relaunch Workshop 1 doc

---

## 1. AI Credit Architecture — Decision: Option B, Dedicated AI Credit Allowance

We're going with your recommendation: a **dedicated AI credit allowance per tier**, with AI-specific top-up packs.

We want to be explicit about the trade-off we're accepting. The unified meter's real advantage was never billing simplicity — it was **fungibility**. With many levers in play (records backed up, files/attachments, storage destinations, backup frequency), a single currency would have let each customer allocate spend to their own usage shape. By separating AI, we take on the packaging challenge instead: for each tier, we must set per-lever limits that work for the majority of customers. That is now the central design problem for Phase 3, and the usage-data analysis described in §8 is how we intend to ground it.

Two implementation notes:

- AI consumed through the MCP interface draws from the same AI credit pool — one AI meter, however the AI is accessed.
- The dedicated meter also fits our launch constraints better: AI credit metering can be live at launch, while a unified transfer meter could not be (see §2).

---

## 2. Launch Enforcement — Confirmed, Plus Two New Questions to Workshop

**Confirmed:** day-one tier boundaries are enforced through the hard structural gates (backup frequency, number of Spaces, database architecture). Usage **metering** — tracking consumption per lever so we know when an org approaches its limits — will exist at launch for all levers (records, storage, AI credits). AI credit **enforcement** will also be live at launch. What isn't built at launch is automated billing enforcement on the transfer-side levers; the gates carry those boundaries until the metering engine ships.

This distinction (metering = tracking vs. enforcement = what happens at the wall) surfaced two questions we'd like to work through with you in Phase 3.

### Question A: What happens when a customer hits a limit?

Applies to every metered lever (record limits, storage limits, AI credits). Options, from most automatic to most manual:

1. **Auto-upgrade to the next tier.** Maximum revenue capture, but bill-shock risk, and interacts awkwardly with annual prepay (mid-cycle proration; can an annual customer be auto-bumped at all?).
2. **Auto-purchase an add-on.** Plan unchanged; an overage pack is charged automatically. Softer, but still an unconsented charge unless opted in.
3. **Metered per-unit overage** billed at cycle end. Convention: price overage at a premium above the effective in-plan rate *and* above add-on pack rates, so upgrading is always the rational move. Those overage unit prices become inputs to your pricing model.
4. **Stop until the customer decides.** Fine for interactive levers; dangerous for background ones (see the constraint below).
5. **Grace buffer / soft limit** — allow ~10–20% over with escalating notifications before enforcement. One rule we consider non-negotiable regardless of policy: **never fail mid-job; enforce only at the next job boundary.** A partial snapshot — or backups that silently stopped months before a restore is needed — is our worst trust failure.
6. **Degrade instead of stop** — step frequency down (instant → daily → weekly), or keep schema/metadata backups running while pausing data/attachments. Customer stays protected at a reduced level.
7. **Retention squeeze** (storage lever only) — keep backing up, roll off the oldest snapshots faster to stay under the cap.
8. **Notify-and-continue with a decision deadline** — service continues through the billing cycle; enforcement (or conversion to overage) kicks in at cycle end if no action.

The meta-option is **customer-configurable** limit-hit behavior per organization (auto-upgrade / auto-buy add-on / metered overage / pause-and-ask) with a deliberately chosen default. That reframes the workshop question as: *what should the default be, per lever, and what does each choice imply for pricing?*

Key constraint: **the levers differ in "stoppability."** AI credits are interactive — the user is present, so a hard stop with an upgrade prompt is industry standard. Record and storage limits are hit by background jobs where we can't get an instant decision — those need grace/degrade/overage paths. One policy for all levers would be wrong.

### Question B: How do we package overage purchasing?

Per lever, or bundled — and one-time or recurring?

- **Per-lever à la carte** (buy additional records at $X, storage at $Y, AI credits at $Z): precise, but multiplies SKUs; at some point the right answer to "I need more of two levers" should be "upgrade."
- **Bundled add-on packs** (X records + Y GB + Z credits): fewer SKUs, but customers pay for components they don't need — the unified-meter mismatch problem in miniature.
- **Hybrid by lever time-profile** — our suspected landing spot, because the levers differ in kind:
  - **Flow levers** (AI credits, records processed per cycle) reset each billing period. An overage can be a genuine one-time spike → one-time top-up packs fit.
  - **Stock levers** (storage, records under management) persist — this month's overage is still there next month → must be a recurring monthly add-on, a tier upgrade, or a retention squeeze.

The question decomposes into: which levers get one-time packs vs. recurring add-ons, at what price points relative to tier upgrades, and where add-ons end and "you've outgrown this tier" begins. We'd like this as a Phase 3 modeling input.

---

## 3. Metering Architecture (context for everything above)

Where we landed internally on what customers actually see — **three gates, three meters**:

**Gates** (structural, enforce tier boundaries at launch):
1. **Backup frequency** (weekly → daily → instant). Note this gate doubles as our compute meter — frequency directly scales processing cost, so processing needs no separate customer-facing meter.
2. **Number of Spaces** (1 → 3 → unlimited)
3. **Database architecture** (D1 → shared Postgres → dedicated Postgres → BYODB)

**Meters:**
1. **GB under management** (files/attachments) — destination-agnostic: a gigabyte counts the same whether stored in our managed storage or delivered to the customer's Google Drive/Dropbox/OneDrive/Box. External-storage customers don't ride free: registry tracking, dedupe, delivery, and integration maintenance are real ongoing service. **Per-destination counting:** a copy with us *and* a copy in Dropbox counts twice ("every managed copy counts"). Multi-destination replication is itself a tier-gated feature.
2. **Records under management** (structured data) — records, not gigabytes: it's the ecosystem's native unit (Airtable plans are quoted in records), it survives every storage format (a Postgres row = a CSV row), and byte-size would fluctuate with our implementation choices. Same destination-agnostic, per-destination counting. **Destinations count; versions don't** — 30 daily snapshots ≠ 30× records; history depth is monetized through the retention-window variable, never the record meter. Schema history, comments (where included in the tier), and changelogs ride along free — "we back up everything, no extra charge" is positioning, not a meter.
3. **AI credits** (dedicated, per §1).

**Location does not change meter rates.** The database-architecture gate already prices infrastructure differences — a Pro record costs more because Pro costs more. Varying per-record rates by storage location would double-charge the same distinction and create an illegible rate matrix.

**First-backup handling:** a migrating customer's initial full sync (especially attachments) is a one-time processing spike. We absorb it as an onboarding cost up to a size threshold derived from the cost model ("free initial sync up to X GB"); above the threshold, a one-time onboarding fee or a sales conversation. The customer's first bill reflects their steady-state GB/records under management — honest and shock-free.

---

## 4. Legacy Migration & Grandfathering

### Discount — Decision: 20% off list, perpetual, floating

- **20% grandfathered discount off the current list price**, applying for as long as the customer remains continuously subscribed.
- **Floating, not frozen:** list prices may rise over time; the legacy customer's price rises with them, but the 20% relationship never expires. This honors the agreed principle — grandfathering is a discount off list, not a price freeze.
- **Applies at the customer's reference tier or higher** (see mapping in §5). Below the reference tier, list price applies — we don't want to subsidize downgrades. The edge case prices sanely: a Premium customer who only wants Growth pays $99 list vs. $159.20 for discounted Pro.
- Billing-period stacking: the 20% applies to whichever billing period the customer chooses, with the annual-prepay discount stacking naturally on top (annual is itself a discount off list). Example on Growth $99: legacy monthly ≈ $79.20/mo; legacy annual ≈ $63.36/mo effective (~36% off monthly list). Rationale: the single behavior we most want from legacy customers in year one is an **annual commitment** — it locks them through the turbulent transition year and directly supports the ≤10% attrition target. Even at the deepest stack, Growth at ~$63 is nearly 2× the current $33.20 average, so the ACV target survives.
- Quiet retention hook: cancel and return later = list-price customer.

### Migration credit grants — Decision: not needed in credit form

The original concern (first full backup burns transfer credits → invoice shock) is moot under hard gates — there is no transfer-credit meter at launch. Instead:

- **Migration grace window:** record/storage limits soft-enforced for the first 30–60 days post-migration, so customers see their real footprint and right-size their tier. A time-boxed grace period is far harder to abuse than a granted credit balance.
- **One-time AI credit grant** for migrating customers as the goodwill gesture — inexpensive, showcases the headline new capability, and the abuse surface is small (one-time, per-org, capped).
- First-sync processing absorbed per §3.

---

## 5. Legacy → New Tier Mapping & Migration Sequence

### Mapping (reference tiers)

| Legacy (On2Air) | Baseout reference tier |
|---|---|
| Essentials | Launch ($49) |
| Professional | Growth ($99) |
| Premium | Pro ($199) |

Legacy **Starter** (58 active accounts, ~17% of the paying base) wasn't in the original either/or list — the usage data settles it: Starter's footprint sits comfortably inside Essentials' (p95: 78K records / 19 GB vs. Essentials' 237K / 69 GB), so **Starter → Launch** alongside Essentials. No separate landing tier is needed at launch.

### Revision to the baseline assumptions: no non-public tiers at launch

The reference assumptions listed Starter $29 / Bridge $9.99 as non-public stealth tiers at launch. Our current position: **non-public tiers do not exist at launch.** They materialize later, at sunset, as legacy landing pads (below).

### Two-phase migration

- **Phase 1 — Coexistence (pull):** both products run. Customers attracted to Baseout's new capabilities migrate voluntarily, taking the 20% grandfathered discount at their reference tier or higher.
- **Phase 2 — Sunset (push):** when Baseout is stable and On2Air winds down, remaining customers move to **non-published, equivalent-priced, limited tiers** — backup-to-external-storage plus data storage only, none of the new platform features. Upgrading from a limited tier to any list tier carries the 20% discount.

**On the grandfathering principle:** an equivalent-priced sunset tier is *not* a price freeze — it's a **lesser product at the old price**. Value and price were rebalanced, not frozen. We think this framing matters for the model and the customer communication.

**Model input for Phase 3:** the sunset cohort splits three ways — stay in the limited tier (revenue preserved at ~today's ARPU), upgrade to list−20% (ARPU expansion), or churn (≤10% baseline). We'll supply split estimates from the usage analysis (§8).

### Tier naming

We're not attached to Launch/Growth/Pro/Business — we'd like to explore naming with you (this pairs with the naming-convention homework already on your list).

---

## 6. Tier Structuring Variables — Additions & Refinements

Refinements to the proposed list:

- **AI credits** → dedicated pools + top-up packs (per §1).
- **Storage** → expressed as **GB under management** (destination-agnostic, per-destination counting), not "R2 storage limits."
- **Data quantity** → expressed as **records under management** (same counting rules).
- **Backup frequency** → "Instant" is webhook-driven; webhook support is listed as a capability of instant-frequency tiers.

Additions (things missing from the original list):

1. **Users/seats** — capped per tier with overage pricing for additional users. (Not unlimited flat org pricing.)
2. **API & MCP access** — rate limits per tier. AI consumed via MCP draws from the AI credit meter (no double-metering).
3. **Backup coverage gates** — *what* gets backed up varies by tier: automations & interfaces backup gated (e.g., Growth+); comments backup potentially unavailable at lower tiers.
4. **Multi-destination replication** — gated per tier, capped at 5 destinations maximum (no unlimited). Each destination's footprint counts on the GB/records meters.
5. **Restore limits** — records restored per month, tiered. (Kept out of headline positioning; exists as a tier capability.)
6. **Active reports** — number of active reports capped per tier; a compute lever, like backup frequency.

---

## 7. Answers to Remaining Doc Questions

- **Migration attrition baseline:** ≤10% (as discussed in-workshop).
- **Competitor positioning:** price above backup-only comps (Rewind, ProBackup), below Gearset-class DevOps comps — Salesforce-ecosystem tooling generally carries higher price points than Airtable-ecosystem equivalents.
- **"No record/attachment caps" USP:** keeping it as a migration selling point — historical evidence says it drives very few cancellations, so it's worth retaining. (Note: Baseout tiers *do* meter records/GB under management; the no-caps commitment is about not imposing the legacy product's hard count ceilings on migrated data. We'll want to reconcile the marketing language with the meter design in Phase 3.)
- **Immediate-migration vs. 1-year-buffer analysis:** agreed it's superfluous — the two-phase plan (§5) makes forced immediate migration an unlikely outcome.

---

## 8. Usage Data Analysis (Dan's homework — complete; full detail in `usage-analysis.md`)

We extracted per-account usage for all 2,971 historical accounts (336 active paying: 147 Essentials, 110 Professional, 58 Starter, 21 Premium) from the On2Air production database. Headlines:

**Usage separates cleanly by tier** — each legacy tier's records/GB distribution sits roughly 3× the one below it. First-cut tier limits, set so ≥95% of each mapped legacy cohort fits its reference tier:

| Lever | Launch $49 | Growth $99 | Pro $199 | Business $399 |
|---|---|---|---|---|
| Records under management | 250K | 750K | 1.5M | 5M (then custom) |
| GB under management | 50 | 250 | 500 | 1,500 |
| Restores | 3/mo | 10/mo | 30/mo | fair-use |

The ~5% of accounts above their reference-tier limits are the designed upsell conversations; the migration grace window gives them 30–60 days to see their footprint first. These fit *current* usage — please model growth headroom (a limit that fits today pinches in 18 months).

**100% of file storage is external today** (Google Drive 9.9 TB / Dropbox 6.3 TB / OneDrive 1.4 TB / Box 0.8 TB; 18.3 TB total, 12.1M files). Without the destination-agnostic GB meter, the entire migrated base would be a zero on the storage lever; managed storage becomes a pure upsell to this cohort.

**The frequency gate is the migration friction point.** Daily-or-faster share by tier: Starter 26%, Essentials 18%, Professional 56%, Premium 78%. With Launch=Weekly / Growth=Daily / Pro+=Instant, ~34 accounts mapped to Launch currently back up daily — they face "pay 2× or drop to weekly." Options to model: accept as upsell pressure; include daily in Launch (cheaper migration, weaker ladder); or a grandfathered keep-your-frequency perk. This directly trades Year-1 ARPU expansion against transition churn.

**The initial-sync spike is confirmed and bounded.** First-month processing is ~10× steady state at the median (~99× at p90), but "free initial sync up to 50 GB" covers ~95% of historical onboardings (only 4 of 367 ever exceeded 200 GB; max 437 GB). Steady state is a trickle: median 0.1 GB/month per account; 300–800 GB/month system-wide.

**Levers that turn out to be free moves:** comments backup has *zero* usage across all active accounts (gating it costs nothing); restores run 2–18 attempts/month across the entire base (caps touch nobody — and the no-recovery-focus positioning now has hard data).

**Concentration is extreme, in both storage and compute.** Top 5 accounts hold 46% of stored GB (one Professional account: 2.8 TB); top 10 accounts consume 32% of all processing run-hours (the top two average ~21 h/day each). The meters, the initial-sync threshold, and per-account anomaly monitoring all exist because of this tail.

**Risk cohorts for the migration model:** 83 of 336 paying accounts (25%) are dormant — active subscription, zero active backup jobs; the most churn-fragile segment. And churned accounts still hold 5.4 TB in the registry — free today (their drives), but under managed storage this class would be real COGS; departed-customer retention policy is a launch requirement.

**Cost analysis (complete — detail in `tier-cost-analysis.md`):** marrying verified unit prices to the real usage distributions: median-profile infra margins are Launch 95% / Growth 92% / Pro 90% / Business 72–85%; every tier clears the 75% p90 floor except Pro at p90 (61%), which is a compute-tail problem managed by engine efficiency, Instant-frequency pricing, and a fair-use compute policy. Homework numbers: **1M records costs $1–3/mo to store** (safe to include Pro+; on D1/Launch the binding constraint is write frequency, independently confirming the 250K Launch limit); **initial-sync absorption costs $0.10–$3 per onboarding** (eat it); **non-public sunset tier runs ~90% median / ~72% p90 margin at legacy prices**; **AI credit allowances sized at 200/1K/5K/15K per tier cost under 2% of revenue** on Workers-AI-class inference (frontier-model backends are 5–20× — the V2 repricing risk that motivated the dedicated AI SKU).

**Still to come:** sunset cohort-split estimates for the Phase 3 migration model.
