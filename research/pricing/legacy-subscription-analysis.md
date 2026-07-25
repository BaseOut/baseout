# On2Air Active Subscriptions — Analysis

**Source:** Stripe export `On2Air Subscriptions-Active.csv` (provided July 25, 2026). 334 rows: 333 plan subscriptions + 1 add-on subscription (extra capacity; single instance, ignored per founder instruction). **All 333 are paying, non-trial subscriptions** — the founder confirmed (July 25, 2026) that trial subscriptions were excluded from the export before delivery. One apparent test account (`line1@line1.com`, holding the lone add-on plus one Essentials monthly) is included in totals; material impact is negligible (~$360 ARR).

Plans were decoded from price points (no plan-name column): $9.99/$8.33 = Starter (monthly/annual), $29.99/$25.00 = Essentials, $49.99/$41.67 = Professional, $79.99/$66.67 = Premium. Every row decoded cleanly; no Enterprise/custom-priced subscriptions appear in this export.

## Headline numbers

| Metric | Value |
|---|---|
| Active paying subscriptions (ex add-on; trials excluded from export) | **333** |
| MRR | **$11,056.74** |
| ARR (annualized) | **$132,678.08** |
| Average revenue per account | **$33.20/mo · $398.43/yr** |
| Billing mix | **49% annual / 51% monthly** |
| Effective annual discount (all plans) | **~16.6–16.7%** |

> ⚠️ **Corrects the "~200 paying customers" figure used throughout the spec/GTM docs** — the paying base is 333 subscriptions (≈332 unique customers), roughly two-thirds larger.

## Plan mix

| Plan | Price (mo / eff. annual) | Subs | % of subs | Monthly-billed | Annual-billed | MRR | ARR | % of ARR |
|---|---|---|---|---|---|---|---|---|
| Starter | $9.99 / $8.33 | 57 | 17.1% | 27 | 30 | $519.63 | $6,236.46 | 4.7% |
| Essentials | $29.99 / $25.00 | 148 | 44.4% | 73 | 75 | $4,064.27 | $48,770.49 | 36.8% |
| Professional | $49.99 / $41.67 | 108 | 32.4% | 56 | 52 | $4,966.28 | $59,592.76 | 44.9% |
| Premium | $79.99 / $66.67 | 20 | 6.0% | 13 | 7 | $1,506.56 | $18,078.37 | 13.6% |
| **Total** | | **333** | 100% | 169 | 164 | **$11,056.74** | **$132,678.08** | 100% |

(Excluded: 1 × $24.99/mo add-on subscription.)

## What this changes for the pricing engagement

1. **The base skews higher than the docs assumed.** Prior framing ("skews toward the smaller/simpler end") is only half right: Essentials is the modal plan (44%), but **Professional + Premium = 38.4% of subscriptions and 58.5% of ARR ($77,671)**. The revenue center of gravity is the $49.99 Professional tier, not the low end.
2. **Heavy-power-user exposure is bounded at ~58.5% of ARR** (the Professional+Premium pool — the plans whose at-limit usage maps to Baseout Pro-tier/enterprise-scale consumption per `Pricing_Credit_System.md` §5). How much of that pool *actually* runs at limits requires joining run telemetry; this export gives the ceiling.
3. **Premium is thin (20 subs, 13.6% of ARR)** — the hourly-frequency cohort that would be most disruptive to migrate is small. The Professional cohort (108 subs, 44.9% of ARR) is the one to model carefully at sunset time.
4. **Annual billing is already normal here (49%)** at a ~16.6% discount — Baseout's planned ~20% annual discount is consistent with what this base already accepts.
5. **Transition-plan revenue math (per the sunset-triggered mapping in `Pricing_Credit_System.md` §6):** Starter→Bridge holds $9.99 (no change yr-1); Essentials→Baseout Starter $29 is a slight cut; Professional→Launch $39-annual is a cut from $49.99 (but a raise vs. the $41.67 annual-billed majority... note: 52 of 108 Professionals already pay $41.67 effective — Launch at $39 annual is still marginally cheaper); Premium→Growth $79-annual ≈ current price. Net: year-1 transition revenue is roughly ARR-neutral-to-slightly-negative on the low three cohorts, with upside coming from Bridge→Starter step-ups ($9.99→$29, +$1.1K MRR potential across 57 subs) and from any Professional/Premium usage-based upgrades once real consumption is visible.
6. **No Enterprise subscriptions exist in Stripe** — any Enterprise/custom deals are either invoiced outside this export or don't exist; confirm before modeling an Enterprise legacy cohort.
7. **Consultant-detection via email domain found nothing** (only gmail/hotmail repeat) — multi-workspace consultant accounts can't be identified from this export alone; needs the workspace/usage join.

## Caveats

- Trials: none — the export was pre-filtered to paying subscriptions only (founder-confirmed, July 25, 2026). 333 is the true paying count.
- This is subscriptions, not usage — the WTP/underpayment analysis still needs the per-run telemetry join (bases, records, attachment volumes, frequency per customer).
- One duplicate email (`line1@line1.com`, apparent test account) holds 2 of the 334 rows.
