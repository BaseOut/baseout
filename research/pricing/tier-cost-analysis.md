# Baseout Tier Cost Analysis — COGS from Real Usage Telemetry

**Prepared:** 2026-07-29.
**Unit prices:** from `infrastructure-cost-model.md` (verified against vendor pages 2026-07-25). Not re-derived here.
**Usage inputs:** On2Air production telemetry, 2026-07-29 extraction (`usage-analysis.md`, `sql-output/`) — 336 active paying accounts mapped to their Baseout reference tiers (Starter+Essentials → Launch, Professional → Growth, Premium → Pro).
**What this adds over the 7/25 model:** that model priced *illustrative* profiles. This one prices the *actual* usage distributions, and answers the four homework numbers (1M-record cost, initial-sync cost, non-public tier cost, AI credit sizing).

---

## 1. The headline correction: compute, not storage, is the dominant COGS

Measured monthly processing per account (Trigger-equivalent run-hours, from 90-day actuals):

| Mapped cohort | n | p50 h/mo | p75 | p90 | p95 | max | mean |
|---|---|---|---|---|---|---|---|
| Launch | 168 | 12.6 | 29.7 | 57.7 | 72.8 | 389 | 25.8 |
| Growth | 83 | 49.6 | 76.2 | 137 | 202 | 650 | 68.8 |
| Pro | 17 | 123 | 224 | 501 | 585 | 627 | 182 |

At Trigger.dev rates (Small 1x $0.122/h, Medium 1x $0.306/h), the **median Growth account burns $6/mo and the median Pro account $15/mo in compute alone** — an order of magnitude above every other per-account cost line. Storage, by contrast, is trivial (§3).

**Efficiency caveat, both directions:** these hours are the *legacy engine's* wall-clock. Baseout's streaming architecture should be materially faster (model below shows 1× and 3× efficiency scenarios) — but legacy hours are the only measured number we have, so the 1× column is the honest planning basis until Baseout telemetry exists.

## 2. Per-tier COGS and margin (managed-storage scenario, Small 1x, 1× legacy efficiency)

"Median" = the mapped cohort's p50 on every lever simultaneously; "p90" likewise (conservative: real accounts don't max every lever at once).

| Tier | Revenue | Median profile COGS | Margin | p90 profile COGS | p90 margin | p90 margin @3× efficiency |
|---|---|---|---|---|---|---|
| **Launch $49** | $49 | compute $1.55 + R2 (2 GB) $0.03 + D1 (25K rec) ~$0.05 + AI $0.50 + registry $0.30 ≈ **$2.4** | **95%** | compute $7.0 + R2 (45 GB) $0.68 + D1 $0.30 + AI $1 ≈ **$9.3** | **81%** | 89% |
| **Growth $99** | $99 | compute $6.0 + R2 (11 GB) $0.16 + D1 (78K) $0.15 + AI $1.50 ≈ **$8.2** | **92%** | compute $16.8 + R2 (157 GB) $2.35 + D1 writes $2 + AI $3 ≈ **$24** | **76%** | 87% |
| **Pro $199** | $199 | compute $15.1 + R2 (23 GB) $0.35 + shared-PG slice $2 + AI $3 ≈ **$21** | **90%** | compute $61 + R2 (capped 500 GB) $7.50 + PG $4 + AI $5 ≈ **$78** | **61%** ⚠ | 79% |
| **Business $399** | $399 | (modeled from Pro tail) compute $25–70 + R2 (1.5 TB) $22.50 + 3× dedicated Neon $5–15 + AI $5 ≈ **$58–112** | **72–85%** | — | — | — |

Add ~3.5% Stripe on all margin lines. Fixed platform base (~$200/mo) is <1% of target revenue and excluded per the 7/25 model.

**Findings against the founder's margin targets (85% blended, 75% floor at p90):**

- **Launch and Growth clear the floor comfortably** even at legacy efficiency.
- **Pro's p90 is the one pinch point: 61% at legacy efficiency.** It's driven entirely by the compute tail (501 h/mo at p90; the top two accounts run ~650 h/mo ≈ $79/mo on Small, $199 on Medium). Three mitigations, any one sufficient: (a) Baseout engine ≥2× faster than legacy → back over 75%; (b) frequency gating actually binds (the tail is daily/hourly × huge estates — Instant pricing should carry it); (c) per-account anomaly monitoring with a fair-use compute policy at Pro, hard-metered at Business. Recommend all three; (c) is a launch requirement per `usage-analysis.md` §5.
- **The 2.8 TB / 21-h-per-day class of account must be priced into Business+, never Pro.** One such account at Pro is –$0 to –$50/mo gross; at Business with the storage meter it's fine.

## 3. Storage: confirmed trivial; allowances are nearly free to include

| Included allowance | R2 cost at full utilization | Reality (cohort median) |
|---|---|---|
| Launch 50 GB | $0.75/mo max | 2 GB → **$0.03/mo** |
| Growth 250 GB | $3.75/mo max | 11 GB → $0.16/mo |
| Pro 500 GB | $7.50/mo max | 23 GB → $0.35/mo |
| Business 1.5 TB | $22.50/mo max | — |

Median utilization of included storage will be **~4–5%**. Overage priced anywhere at or above $0.10/GB-mo carries ≥6× margin (list-comparable backup products charge $0.20–0.50). The VP-note question "what's the incremental cost to include storage per tier" answers itself: **cents at median, single-digit dollars at cap — include it.** The only storage that matters economically is the *accumulating* kind (retention × churn) — hence the departed-customer cleanup policy and Smart Cleanup / R2 Infrequent Access for old snapshots (−33%).

## 4. Homework number 1: cost of including 1M records managed

Measured CSV size: 669 bytes/record median, 2.2 KB p90 → **1M records ≈ 0.7–2.2 GB raw, ~1.5–3 GB in a database with indexes.**

| Where it lives | At-rest cost | Write cost (the real driver) |
|---|---|---|
| D1 | $1.10–2.25/mo | Full weekly re-sync: 4.3M row-writes/mo ≈ **$4.30/mo**. Full daily: **≈$30/mo** ⚠. Incremental/webhook (1–5% change): **cents** |
| Neon dedicated PG | $0.50–1.05/mo storage | Compute scales with sync minutes; incremental ≈ $1–3/mo |
| Shared PG slice | amortized $1.50–3/mo | included in slice |

**Conclusion:** storing 1M records is a $1–3/mo cost — trivially includable at Pro+. The binding constraint is **write frequency × sync mode on D1 tiers**: a daily full re-sync of 1M records on D1 costs $30/mo, which would erase Launch's margin. This independently confirms the usage-derived limits: Launch (D1) capped at 250K records (daily full re-sync ≈ $7.50/mo worst case, fine), 1M+ records lands on Postgres tiers where writes are cheap. **"Up to 1M records managed" is safe to advertise on Pro and above; not as a lowest-common-denominator inclusion on Launch unless Launch stays weekly-frequency.** (Frequency gate and record limit protect each other — a coherence worth preserving in packaging.)

## 5. Homework number 2: initial-sync absorption cost (the 50 GB free threshold)

From the q06 timeline: median onboarding processes ~1 GB in month one; p95 = 50 GB; max ever = 437 GB.

Cost of a 50 GB initial sync (the proposed free ceiling): ~31K files → R2 Class A ≈ $0.14; compute 2–6 h Medium ≈ $0.60–1.80; storage first month ≈ $0.75. **Worst case ≈ $2.70 one-time.** Median onboarding: **≈ $0.10–0.30.**

**Conclusion:** absorbing initial sync up to 50 GB costs pennies-to-$3 per customer — obviously correct to eat as CAC. Even the 437 GB record-holder would have cost ~$15–25 one-time. The threshold's purpose isn't cost recovery, it's (a) a sales-conversation trigger for whale migrations and (b) abuse protection on self-serve signup.

## 6. Homework number 3: non-public sunset tier COGS

Product: backup-to-external-storage + data files only (no managed storage, no new platform features), at legacy-equivalent prices (~$29–39/mo).

Median legacy-profile account (Launch-cohort usage, external destination): compute $1.55 + zero R2 + data-file registry ~$0.30 + no AI ≈ **$2/mo → 93% margin at $29.** p90 profile ≈ $8–9/mo → 70–72% margin at $29, 77–79% at $39. The heavy tail (daily × large estates) is why the sunset tiers should be priced per legacy tier (Starter-equivalent $29, Essentials-equivalent $39, etc.) rather than one flat price — each cohort's compute profile carries its own price point.

**Conclusion:** the slimmed sunset offering is economically comfortable at legacy prices; Vaishali's "overstated margin" placeholder can be replaced with ~90% median / ~72% p90.

## 7. Homework number 4: AI credit sizing and cost

Cost per AI operation depends on the model class:

- **Workers AI (Llama-class, verified 7/25):** ~$0.0005–0.002 per doc-generation call (2K in / 500 out).
- **Frontier-model API (Claude-class):** roughly 5–20× that per op depending on model and token volume. ⚠ Verify current per-token rates against the provider's published pricing at AI-feature spec time — do not price credits off this memo.

Suggested framing that is robust to either backend: denominate **1 AI credit ≈ 1 typical operation**, price credits so effective revenue is ~$0.01–0.02/credit (pack pricing), and bundle allowances per tier:

| Tier | Bundled AI credits/mo | COGS at Workers-AI backend | COGS at frontier backend |
|---|---|---|---|
| Launch | 200 | ~$0.20 | ~$2 |
| Growth | 1,000 | ~$1 | ~$10 |
| Pro | 5,000 | ~$5 | ~$50 ⚠ |
| Business | 15,000 | ~$15 | ~$150 ⚠ |

**Conclusion:** at Workers-AI-class inference, bundled allowances are noise (<2% of revenue at every tier). At frontier-model inference, Pro/Business allowances become real COGS lines — which is precisely Vaishali's V2 RAG concern and the argument that won Option B (dedicated AI SKU): if the backend gets expensive, we resize *allowances and packs*, not the plan architecture. Recommend: launch allowances sized to the Workers-AI column, revisit at V2 with measured per-conversation token counts.

## 8. Summary for the pricing model

- Blended infra COGS at target mix, from real usage: **≈ 8–12% of revenue at legacy engine efficiency, ≈ 4–6% at 3× efficiency** (the 7/25 model's 4–8% assumed lighter profiles). Blended gross margin **≈ 85–89%** including Stripe — the 85% blended target holds.
- Per-tier floors hold everywhere except **Pro at p90 under legacy efficiency (61%)** — managed by engine efficiency + Instant-frequency pricing + fair-use compute policy.
- The cost model's three real levers, in order: **(1) compute per account** (engine efficiency, frequency gates, anomaly caps); **(2) accumulating storage** (retention policy, departed-customer cleanup, IA tiering); **(3) D1 row-writes** (bound records × frequency on D1 tiers — already handled by the 250K Launch limit).
- Storage allowances, initial-sync absorption, migration grace windows, and Workers-AI-class AI allowances are all **cheap generosity** — include them and market them.

## 9. Scenario: Cloudflare Workflows instead of Trigger.dev (founder idea, 2026-07-29)

**The mechanism.** Trigger.dev bills **wall-clock** seconds while a task runs — including every second spent waiting on Airtable API pages, Drive/Dropbox uploads, R2 puts, and DB writes. Cloudflare Workflows bills **CPU time only**: "a Workflow that is waiting on a response to an API call, paused, or otherwise idle does not incur CPU time" (verified 2026-07-29, developers.cloudflare.com/workflows/reference/pricing). Backup work is overwhelmingly I/O wait — founder estimate ≥80%.

**Verified pricing (2026-07-29):** Workflows = Workers Standard: $0.02 per additional M CPU-ms (30M included), $0.30/M requests, and — **new, billing starts Aug 10, 2026** — steps at $0.80 per additional 100K (500K/mo included) and state storage $0.20/GB-mo (1 GB included). Limits are workable: 10K–25K steps/instance, 10K–10M subrequests, 50K concurrent instances, unlimited wall-clock duration, 30s–5min CPU per step, 1 MiB per step result.

**Per-account compute at 80% I/O wait (CPU = 20% of legacy wall-hours), $0.072/CPU-hour:**

| Profile | Wall h/mo | Trigger Small 1x | Workflows CPU | Reduction |
|---|---|---|---|---|
| Launch p50 | 12.6 | $1.53 | **$0.18** | 8.5× |
| Growth p50 | 49.6 | $6.05 | **$0.71** | 8.5× |
| Pro p50 | 123 | $15.06 | **$1.78** | 8.5× |
| Pro p90 | 501 | $61.12 | **$7.21** | 8.5× |
| Fleet (13,440 h/mo) | — | ~$1,640/mo | **~$193/mo** | — |

At 90% wait, halve the Workflows column again. Steps add roughly $25–40/mo fleet-wide *if* runs are structured as ~500 steps each (batch attachments per step; never one step per record — per-record steps at fleet volume would cost more than the CPU). Dropping Trigger.dev also removes its $50/mo Pro base fee.

**Effect on the tier model:** the §2 pinch point disappears — Pro p90 COGS falls from ~$78 to ~$25 (**margin 61% → ~87%**), and blended infra COGS drops from 8–12% of revenue to **≈3–5% even at legacy engine efficiency**. This is a bigger lever than the 3× engine-efficiency scenario, and they compound.

**Costs and risks of the move (engineering + platform):**
- `apps/workflows` is currently a Node-only Trigger.dev project by explicit architecture; Workflows runs on workerd — task bodies get rewritten (no Node APIs; provider SDKs must be fetch/REST-based; 128 MB isolate memory makes the already-planned streaming patterns mandatory; pass R2 keys between steps, not data, under the 1 MiB step-result cap).
- CPU isn't zero: CSV serialization, encryption, and parsing are real CPU — the 80% wait share is an estimate to validate with a spike (instrument one real backup: measure CPU-ms vs wall-clock).
- Workflows step/storage billing is brand-new (announced 2026-07-07, effective 2026-08-10) — model against the post-August numbers, and note repricing risk on a young product.
- Observability/retry ergonomics vs Trigger.dev's dashboard; deeper all-Cloudflare vendor concentration.
- Trigger.dev has no equivalent lever: its waitpoints pause billing for explicit `wait.for` sleeps, but in-task network I/O bills at wall-clock.

**Recommendation:** run a one-week spike — port the backup-base task to a Workflow, run it against 3 real bases (small/median/whale), measure actual CPU-ms share. If CPU share ≤30%, the migration pays for itself in COGS within months at target scale and removes the only tier-margin pinch point in the model.
