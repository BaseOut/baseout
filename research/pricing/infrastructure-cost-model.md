# Baseout Infrastructure Cost Model — Per-Usage COGS & Margin Estimates

**Prepared:** July 25, 2026, at founder request ("we're moving to per-usage pricing... storage in R2 and D1 or Postgres databases have variable costs and need to be factored into our margins").
**Basis:** all unit prices verified against official vendor pricing pages on **2026-07-25** (list prices; no negotiated discounts assumed). Customer profiles are illustrative; treat margins as directional estimates, not accounting.

---

## 1. Verified unit prices (July 2026)

| Component | Price | Notes |
|---|---|---|
| **R2 storage (Standard)** | $0.015/GB-mo | Infrequent Access: $0.010/GB-mo (+$0.01/GB retrieval, 30-day min) — candidate for old snapshots |
| **R2 writes (Class A)** | $4.50/M ops | Reads (Class B) $0.36/M; **egress $0 — confirmed** |
| **D1 storage** | $0.75/GB-mo | 5 GB included on Workers Paid; rows written $1.00/M after 50M/mo; rows read $0.001/M after 25B/mo |
| **Workers Paid** | $5/mo base | 10M requests + 30M CPU-ms included; DO requests $0.15/M, duration $12.50/M GB-s after allowances |
| **DigitalOcean Managed PG** | $15.15/mo (1 vCPU/1 GiB) · $60.90/mo (2 vCPU/4 GiB) | Fixed per-instance floors |
| **Neon PG** | **Pure pay-as-you-go — no base fee** | Compute $0.106/CU-hr (Launch) / $0.222 (Scale); storage $0.35/GB-mo; **scales to zero when idle** |
| **Supabase Pro** | $25/mo (incl. $10 compute credit) | **Each additional project = $10/mo minimum** — hard per-project floor |
| **Trigger.dev** | Pro $50/mo (incl. $50 usage) | Compute: Small 1x $0.0000338/s · Medium 1x $0.000085/s; $0.000025/run invocation |
| **Workers AI (LLM)** | Llama 3.1 8B: $0.152/M in + $0.287/M out tokens | Typical doc-generation call (~2K in / 500 out) ≈ **$0.0005**; 70B model ≈ $0.0017 |
| **Stripe** | ~2.9% + $0.30/txn | ~3–4% of revenue at these price points |

## 2. Cost primitives (what one unit of activity costs us)

| Activity | Estimated COGS | Working |
|---|---|---|
| One base backup run (static, small base: 10K records, 500 MB attachments to BYOS) | **~$0.02–0.05** | ~10 min Trigger.dev Small 1x ($0.02) + API/Worker overhead; nothing stored at rest |
| One base backup run (large: 1M records, 20 GB attachments, first run) | **~$0.50–1.50** | 1–3 hrs Medium 1x compute ($0.31–0.92) + R2 Class A writes (~10K ops ≈ $0.05) + row writes |
| Steady-state dynamic (incremental) run | **~$0.005–0.02** | Deltas only; minutes of compute |
| Storing 1 GB in R2 for a month | **$0.015** (Standard) / $0.010 (IA) | vs. billed overage $0.50/GB → 33–50× |
| Storing 1 GB in D1 for a month | **$0.75** | vs. billed $1.00/GB → 1.3× ⚠️ thinnest margin in the product |
| Dedicated PG, one Space, typical (Neon PAYG) | **~$1–5/mo** | Scale-to-zero: ~15 min compute/day ≈ $0.80/mo + $0.35/GB-mo storage. **Not $19–60/mo** — see §4 |
| Shared PG slice (Pro tier, DO 2vCPU/4GiB ÷ 20–40 tenants) | **~$1.50–3/mo** | Instance $60.90 amortized |
| One AI doc generation | **~$0.0005–0.002** | vs. 10 credits ≈ $0.04–0.07 effective revenue → 20–100× |
| One restore (reverse transfer) | **~$0.05–0.50** | Compute-dominated; R2 egress genuinely $0 |
| Email / API call / SQL query | ~$0 | Within Worker allowances at launch scale |

**Fixed platform base:** Workers Paid $5 + master DB (DO $15–61) + Trigger.dev Pro $50 + analytics ~$50–100 ≈ **$150–250/mo** — under 1% of revenue at the $41.7K MRR target.

## 3. Per-tier margin estimates (typical usage profiles)

Profiles assume the Features-spec limits used at moderate (not maximal) intensity; dedicated PG assumes **Neon PAYG** (see §4). Stripe fees excluded from COGS rows, shown in the margin line.

| Tier (mo. price) | Illustrative profile | Est. infra COGS/mo | Gross margin (infra) | Margin incl. ~3.5% Stripe |
|---|---|---|---|---|
| **Trial ($0)** | 1 base, monthly, schema-only D1, 250 MB R2 | $0.01–0.05 | — (CAC, not margin) | — |
| **Starter ($29)** | 3 bases, monthly static, schema-only D1 | $0.10–0.30 | ~99% | ~96% |
| **Launch ($49)** | 9 bases, weekly, D1 full ~0.5–1 GB, 5 GB R2 | $1.50–2.50 | ~95–97% | ~92–93% |
| **Growth ($99)** | 15 bases, weekly, D1 ~3 GB, 20 GB R2 | $4–7 | ~93–96% | ~90–92% |
| **Pro ($199)** | 20 bases, daily incremental, shared-PG slice, 75 GB R2 | $10–25 | ~87–95% | ~84–91% |
| **Business ($399), 3 Spaces** | Daily+instant, 3 × dedicated PG (Neon), 250 GB R2 | $15–35 | ~91–96% | ~88–93% |
| **Business ($399), 10 Spaces** | Same, 10 × dedicated PG (Neon) | $30–70 | ~82–92% | ~79–89% |
| **Enterprise (custom)** | BYODB — customer hosts the data | ~$5–20 + support | ~95%+ infra | Margin is support/SLA, not COGS |

**Heavy/adverse cases:** a static-mode customer running daily full re-transfers of a 1M-record estate to BYOS costs ~$15–45/mo in pure compute — exactly what the credit meter is designed to charge for. A retention-maximal Business customer (250 GB × 24 months accumulating) approaches $4–8/mo in R2 alone — contained if Smart Cleanup ships and old snapshots move to R2 Infrequent Access (−33%).

## 4. ⚠️ Finding that changes a known risk: the Business-tier "margin hole" is a **provider choice**, not a structural flaw

The internal docs flag dedicated-PG-per-Space × unlimited Spaces at Business ($399) as "the single largest structural margin risk" (~$19–60+/mo hard cost per Space, so 10 Spaces ≈ $200–600 COGS vs. $399 revenue). **That math assumed fixed-price instances (DigitalOcean) or per-project floors (Supabase $10/mo).** As of July 2026, **Neon's paid plans are pure pay-as-you-go with scale-to-zero and no per-project fee** — a mostly-idle per-Space database costs ~$0 compute + $0.35/GB-mo storage, i.e., **$1–5/mo per typical Space**, not $19–60.

- 10-Space Business customer on Neon: ~$30–70/mo COGS against $399 → 82–92% margin. On DO minimum instances: $150+ → the documented hole.
- **Recommendation:** provision per-Space dedicated PG on Neon (or equivalent serverless PG); reserve fixed instances for customers who demand a named provider.
- **Decision (founder, July 25, 2026):** Business carries a **hard cap on dedicated-DB Spaces** (value TBD — the cost curve here supports 5–10 comfortably) as belt-and-braces even with PAYG provisioning; **unlimited dedicated-DB Spaces are Enterprise-only, via contract**. Also on record: **gross-margin floor ~75% per tier at heavy usage, ~85% blended target.**
- Residual real risks: Neon *storage* still accumulates with retention (cleanup matters); very-high-write Spaces don't scale to zero (compute grows with instant-backup frequency); Neon repricing risk — revisit before GA commitment.

## 5. Blended picture vs. the founder's targets

At the target mix ($500K ARR ≈ $41.7K MRR, average customer $100–200/mo ⇒ ~210–420 customers centered on Growth/Pro):

- **Blended infra COGS ≈ 4–8% of revenue** (~$1.7–3.3K/mo at target scale) + ~3.5% payment processing + ~$200/mo fixed ⇒ **blended gross margin ≈ 88–92%** before support/staff costs.
- The margin-shaping levers, in order of impact: (1) dedicated-DB provider choice (§4); (2) retention promises vs. Smart Cleanup shipping (storage is the only cost that *accumulates*); (3) D1 storage overage pricing ($1.00 billed vs. $0.75 cost — consider repricing to $1.50–2.00/GB or steering big estates to PG tiers); (4) static-mode frequency, already metered by credits.
- **A ≥80% gross-margin floor per tier at typical usage appears comfortably achievable on every tier, including Business — no tier needs to be a structural loss-leader.** Suggested framing for the workshops: target ~85% blended gross margin, floor 75% per-tier at P90 usage, revisit after real telemetry.

## 6. Caveats

- Profiles are assumptions, not telemetry — replace with real per-run counts (shipped telemetry exists) as Baseout customers accumulate.
- List prices, July 2026; Cloudflare/Neon reprice periodically (Neon's move to pure PAYG happened within the last year — verify before contracts).
- Excludes: support/CSM headcount (the real cost at Business/Enterprise), SOC 2 audit costs, engineering. This is *infrastructure* gross margin only.
- Trigger.dev machine sizing per task is a real tuning lever (Small 1x vs Medium 1x is 2.5×); the model assumes right-sizing.
