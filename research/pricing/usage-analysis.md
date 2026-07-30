# On2Air Backups — Usage Distribution Analysis (Draft 1)

**Source:** production DB extraction 2026-07-29 (`sql-output/q1.md`, 2,971 accounts).
**Scope:** this draft covers the per-account distributions (q01). Frequency (q03),
processing flow (q04), restores timeline (q05), initial-sync spike (q06), and
destination split (q07) will be folded in as those queries land.
**Population:** 336 active paying accounts (58 starter, 147 essentials,
110 professional, 21 premium) + 7 active trials + 2,628 churned/free.

---

## 1. Usage percentiles by legacy tier (active paying accounts only)

### Records under management

| Tier | n | p50 | p75 | p90 | p95 | max | mean |
|---|---|---|---|---|---|---|---|
| starter | 58 | 8,354 | 23K | 49K | 78K | 136K | 21K |
| essentials | 147 | 25K | 85K | 164K | 237K | 477K | 61K |
| professional | 110 | 78K | 230K | 556K | 704K | 980K | 170K |
| premium | 21 | 147K | 507K | 1.16M | 1.23M | 1.36M | 387K |

### Stored attachment GB (all in customers' external storage today)

| Tier | n | p50 | p75 | p90 | p95 | max | mean |
|---|---|---|---|---|---|---|---|
| starter | 58 | 0.6 | 2.1 | 10.9 | 19.5 | 32 | 3.3 |
| essentials | 147 | 1.9 | 18.1 | 44.5 | 69.3 | 406 | 18.4 |
| professional | 110 | 10.8 | 41.5 | 157 | 229 | **2,767** | 89.2 |
| premium | 21 | 23.4 | 64.1 | 93.6 | 152 | 520 | 60.7 |

### Structured-data GB (CSV file sizes — tiny relative to attachments)

All tiers p95 ≤ 1.1 GB; max 1.8 GB. Structured data is a rounding error in
storage cost; attachments dominate by ~100×.

### Distinct bases backed up

| Tier | p50 | p75 | p90 | p95 | max |
|---|---|---|---|---|---|
| starter | 1 | 1 | 1 | 1 | 2 |
| essentials | 4 | 7 | 12 | 15 | 34 |
| professional | 8 | 20 | 34 | 41 | 52 |
| premium | 43 | 72 | 132 | 149 | 161 |

### Levers that turned out to be non-issues

- **Comments: zero across every active account.** Nobody backs up comments
  today (feature unused or unavailable). Gating comments to higher tiers
  costs the migration nothing.
- **Restores: near-zero.** p95 = 0 restores/12mo in every tier; max is 10.
  The monthly timeline (q05) confirms it system-wide: 2–18 restore attempts
  per month across the ENTIRE customer base, from 1–5 accounts. Restore
  caps can be modest without touching anyone — and the "don't lead with
  recovery" positioning now has hard data behind it.
  (Side observation, product not pricing: completion rates on restore
  attempts are low — many months show under half completing. Worth a QA
  look before Baseout's restore ships.)
- **Active jobs: p50 = 1 everywhere.** Most customers run one backup job;
  premium tail runs up to 10.

---

## 2. Headline findings

1. **Tier usage separates cleanly.** Each legacy tier's records/GB
   distribution sits roughly 3× the one below it. The straight mapping
   (Starter/Essentials → Launch, Professional → Growth, Premium → Pro)
   is empirically comfortable: **Starter fits inside any Launch limit that
   fits Essentials** (Starter p95 = 78K records vs Essentials p95 = 237K),
   so no separate landing tier is needed at launch.
2. **Dormant payers: 83 of 336 (25%).** Active subscription, zero active
   backup jobs (35 essentials, 31 professional, 13 starter, 4 premium).
   A quarter of the paying base is paying-but-not-using — the most
   churn-fragile cohort in the migration. Profile before comms.
3. **Churned accounts still hold 5.4 TB** (28% of the ~19.4 TB registry
   total; top single churned account: 1.3 TB, 2M records). Zero storage
   cost to us today (it's in their drives), but it's 16M+ registry rows of
   DB weight — and in Baseout-managed storage this class of data WOULD be
   real COGS. Retention/cleanup policy for departed customers is a launch
   requirement, not an afterthought.
4. **Extreme concentration at the top.** Top 5 active accounts hold 46% of
   stored GB; top 20 hold 70%. One professional account has 2.8 TB.
   This single-handedly justifies (a) the GB-under-management meter,
   (b) the initial-sync size threshold, and (c) overage as recurring
   monthly add-ons on stock levers.
5. **Pending (tracked-not-uploaded) is small:** 226 GB across active
   accounts — not a material distortion of the stored numbers.

---

## 3. First-cut tier limits (fit-the-cohort rule: ≥95% of the mapped legacy
cohort fits its reference tier without action)

Draft numbers for Phase 3 stress-testing — NOT final:

| Lever | Launch $49 | Growth $99 | Pro $199 | Business $399 |
|---|---|---|---|---|
| Records under management | 250K | 750K | 1.5M | 5M (then custom) |
| GB under management | 50 | 250 | 500 | 1,500 |
| Restores | 3/mo | 10/mo | 30/mo | unlimited-fair-use |

Rationale:
- **Launch 250K records** covers Essentials p95 (237K) and all of Starter.
- **Growth 750K** covers Professional p95 (704K).
- **Pro 1.5M** covers Premium max (1.36M).
- **GB:** Launch 50 covers Essentials p90 (44.5); Growth 250 covers
  Professional p95 (229); Pro 500 covers Premium max except one outlier.
- The handful of accounts above their reference-tier limits (~5% per
  cohort) are exactly the upsell conversations the ladder is designed to
  create — and the migration grace window gives them 30–60 days to see
  their footprint before deciding.
- These limits fit *current* usage; Vaishali should model growth headroom
  (records grow over time — a limit that fits today pinches in 18 months).

Open questions feeding into these numbers:
- q07 destination split confirms 100%-external hypothesis per-account.
- q04c flow data sizes the initial-sync threshold and per-run compute cost.
- q03 frequency-by-tier shows who lands on Weekly vs Daily vs Instant gates.

---

## 4. Backup frequency by tier (q03) — the gate-placement finding

Accounts by current schedule (active jobs only; remainder are one-time/blank):

| Tier | monthly | weekly | daily | hourly | % running daily-or-faster |
|---|---|---|---|---|---|
| starter | 23 | 11 | 12 | 0 | 26% |
| essentials | 9 | 90 | 20 | 2 | 18% |
| professional | 12 | 28 | 50 | 1 | 56% |
| premium | 1 | 3 | 12 | 2 | 78% |

**The friction point:** if the gates land as Launch=Weekly / Growth=Daily /
Pro+=Instant, then ~34 accounts mapped to Launch (12 starter daily +
20 essentials daily + 2 essentials hourly — roughly a fifth of the Launch
cohort) currently back up daily or faster. At migration they either pay
Growth (2× their reference tier) or drop to weekly. Options to model:
(a) accept it as designed upsell pressure, softened by the grace window;
(b) include daily in Launch and differentiate on Instant only — cheaper
migration, but the frequency gate loses most of its ladder power;
(c) a grandfathered "keep your frequency" perk for migrated accounts.
This is a Phase 3 modeling question — it directly trades Year-1 ARPU
expansion against migration friction.

Also: legacy **monthly** frequency (45 accounts) doesn't exist in the new
ladder — those accounts get upgraded to weekly at no cost to us.

## 5. Compute intensity (q04a/b) — cost-model inputs

- System-wide: ~6–8K backup runs/month; **~448 run-hours of processing per
  day** across 298 accounts with activity in the last 90 days.
- Run durations are long: monthly avg run 1.2–3.0 hours; p95 was ~11–12
  hours in 2025, improved to ~3–8 hours in 2026.
- **Compute is as concentrated as storage:** top 10 accounts consume 32%
  of all run-hours; the top two (1,950 h and 1,880 h per 90 days) each
  average ~21 hours of processing *per day*. A handful of accounts are,
  computationally, most of the fleet — reinforcing the frequency gate as
  a real cost lever and per-account anomaly monitoring as a launch need.
- **q04c (processed-volume metrics) returned empty** — the metrics jsonb
  keys exist on only a subset of historical runs (or under a different
  structure). Probe pending; initial-sync sizing falls back to the q06
  attachment-upload timeline if metrics don't pan out.

## 6. Initial-sync spike vs steady state (q06 timeline, 836 accounts / 367 with ≥4 months history)

The spike hypothesis is confirmed, dramatically:

- **Initial sync** (peak of an account's first two months of attachment
  uploads): p50 = **1 GB**, p75 = 6.4, p90 = 25, p95 = **50**, p99 = 176,
  max = 437 GB.
- **Steady state** (median monthly volume thereafter): p50 = **0.1 GB**,
  p90 = 2.0, p95 = 6.4 GB.
- The first month is ~**10× steady state at the median, ~99× at p90** —
  onboarding IS the processing cost event; everything after is a trickle.

**Threshold recommendation:** "free initial sync up to 50 GB" covers ~95%
of historical onboardings (19 of 367 exceeded it; only 4 exceeded 200 GB).
At 100 GB it's ~97%. The tail cases (max 437 GB) are exactly the
sales-conversation accounts. Pair with: initial sync counts toward no
meter; the first bill reflects steady-state GB under management.

**System-wide processing flow** (cost-model input): 300–800 GB and
250K–690K files uploaded per month across the whole base over the last
13 months. At R2-class unit costs this is small; per-file API/compute
overhead (Trigger.dev run-hours, provider API calls) dominates the
processing cost, not bytes.

(This supersedes the q04c metrics approach — run-metrics jsonb turned out
to be unpopulated on recent runs; the attachment timeline gives the same
answer with better coverage.)

## 7. Storage destinations (q07) — the external-storage picture, per provider

| Provider | Active jobs | Stored files | Stored GB | Accounts w/ data | Avg GB/acct |
|---|---|---|---|---|---|
| Google Drive | 223 | 7.13M | 9,867 | 593 | 16.6 |
| Dropbox | 89 | 3.65M | 6,274 | 143 | **43.9** |
| OneDrive | 34 | 0.84M | 1,394 | 54 | 25.8 |
| Box | 16 | 0.45M | 757 | 24 | 31.5 |
| **Total** | **362** | **12.1M** | **18,292** | — | — |

- Active-job total (362) reconciles exactly with q00b. Stored total (18.3 TB)
  reconciles with the 20.1 TB registry within unmapped/legacy jobs.
- **Google Drive is the volume leader; Dropbox users are the heavy hitters**
  (2.6× the per-account footprint of Drive users). Destination integrations
  are not equal-cost either — four provider APIs to maintain, each with its
  own rate limits and failure modes, supporting the decision to gate
  multi-destination and price external delivery on the same GB meter.
- q06b system-wide flow confirms the §6 numbers: ~200–215 accounts upload
  in any given month; 300–800 GB/mo typical (one spike month: 1.8 TB,
  May 2025).

## 8. Sanity checks

- Active + churned stored GB (14.0 + 5.4 TB) reconciles with the q00f
  registry total (~20.1 TB uploaded) within rounding.
- Active paying count (336 + 7 trials) reconciles with q00a (344, one
  account carrying two subscription rows resolved by latest-row rule).
- Revenue check: 337 paying × $33.20 avg × 12 ≈ $134K ≈ $132.7K ARR baseline.
