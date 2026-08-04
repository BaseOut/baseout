# Baseout AI Credit Model — Cloudflare Workers AI

**Date:** 2026-08-03. Cloudflare prices fetched from developers.cloudflare.com/workers-ai/platform/pricing (2026-08-03). Companion to [`pricing-guide.md`](pricing-guide.md) §4 (AI credits) and [`final-pricing-matrix.md`](final-pricing-matrix.md) §4 (add-ons).

---

## 1. The credit definition

Two already-locked decisions pin the whole system:

- Top-up pack: **1,000 credits = $10** (recurring) → **1 credit = $0.01 retail**.
- Founder rule: our price = **Cloudflare's price + 25% markup** → underlying cost per credit = $0.01 ÷ 1.25 = **$0.008**.

So: **1 AI credit = $0.008 of Workers AI spend, sold at 1¢.**

**Consumption formula:** `credits = Cloudflare $ cost × 125`
(equivalently: credits per 1K tokens = model's $/M-token price × 0.125). Metered internally at 0.01-credit granularity; the customer-facing usage view shows credits, never neurons or dollars.

Consistency check: a 1,000-credit pack costs the customer $10 and costs us $8 of Cloudflare spend at full burn — exactly the 25% markup. The one-time pack at $12 carries 50% markup. Included tier allowances carry the same $0.008/credit cost ceiling: Lite 200 = $1.60, Core 1,000 = $8, Plus 5,000 = $40, Max 15,000 = $120 **at full utilization** (real utilization is far lower; see §5 and the margin re-run).

## 2. Cloudflare's full LLM menu (fetched 2026-08-03, with our +25% credit rates)

Neuron base rate: $0.011/1K neurons; per-model token prices below already express it. Credit rates = price × 125 per M tokens.

| Model | CF $/M in | CF $/M out | Credits/1K in | Credits/1K out |
|---|---|---|---|---|
| @cf/ibm-granite/granite-4.0-h-micro | 0.017 | 0.112 | 0.002 | 0.014 |
| @cf/meta/llama-3.2-1b-instruct | 0.027 | 0.201 | 0.003 | 0.025 |
| @cf/meta/llama-3.2-3b-instruct | 0.051 | 0.335 | 0.006 | 0.042 |
| @cf/qwen/qwen3-30b-a3b-fp8 | 0.051 | 0.335 | 0.006 | 0.042 |
| @cf/meta/llama-3.1-8b-instruct-fp8-fast | 0.045 | 0.384 | 0.006 | 0.048 |
| @cf/zai-org/glm-4.7-flash | 0.060 | 0.400 | 0.008 | 0.050 |
| @cf/google/gemma-4-26b-a4b-it | 0.100 | 0.300 | 0.013 | 0.038 |
| @cf/openai/gpt-oss-20b | 0.200 | 0.300 | 0.025 | 0.038 |
| @cf/meta/llama-3.2-11b-vision-instruct | 0.049 | 0.676 | 0.006 | 0.085 |
| @cf/meta/llama-4-scout-17b-16e-instruct | 0.270 | 0.850 | 0.034 | 0.106 |
| @cf/mistralai/mistral-small-3.1-24b-instruct | 0.351 | 0.555 | 0.044 | 0.069 |
| @cf/google/gemma-3-12b-it | 0.345 | 0.556 | 0.043 | 0.070 |
| @cf/openai/gpt-oss-120b | 0.350 | 0.750 | 0.044 | 0.094 |
| @cf/qwen/qwen2.5-coder-32b-instruct | 0.660 | 1.000 | 0.083 | 0.125 |
| @cf/qwen/qwq-32b | 0.660 | 1.000 | 0.083 | 0.125 |
| @cf/meta/llama-3.3-70b-instruct-fp8-fast | 0.293 | 2.253 | 0.037 | 0.282 |
| @cf/nvidia/nemotron-3-120b-a12b | 0.500 | 1.500 | 0.063 | 0.188 |
| @cf/moonshotai/kimi-k2.5 | 0.600 (0.100 cached) | 3.000 | 0.075 | 0.375 |
| @cf/deepseek-ai/deepseek-r1-distill-qwen-32b | 0.497 | 4.881 | 0.062 | 0.610 |
| @cf/moonshotai/kimi-k2.6 | 0.950 (0.160 cached) | 4.000 | 0.119 | 0.500 |
| @cf/moonshotai/kimi-k2.7-code | 0.950 (0.190 cached) | 4.000 | 0.119 | 0.500 |
| @cf/zai-org/glm-5.2 | 1.400 (0.260 cached) | 4.400 | 0.175 | 0.550 |
| **Embeddings:** @cf/baai/bge-m3 | 0.012 | — | 0.0015 | — |

## 3. Recommended menu — three capability levels + embeddings (4 models)

Menu confirmed by founder 2026-08-03:

| Level | Model | Why | Credits/1K in | Credits/1K out |
|---|---|---|---|---|
| **Fast** | @cf/meta/llama-3.1-8b-instruct-fp8-fast | cheapest capable chat model on the fast runtime; instant answers | 0.006 | 0.048 |
| **Balanced** (default) | @cf/openai/gpt-oss-120b | best price/quality on the menu — 120B-class quality at mid prices, recognizable OpenAI lineage | 0.044 | 0.094 |
| **Advanced** | @cf/moonshotai/kimi-k2.5 | frontier-class reasoning/agentic model; prompt-caching discounts repeat schema context 6× on input | 0.075 | 0.375 |
| **Embeddings** (internal) | @cf/baai/bge-m3 | powers semantic search over schema/docs; near-free | 0.0015 | — |

Alternates considered and passed over: llama-3.3-70b (output 3× gpt-oss-120b for similar quality), qwen2.5-coder-32b (niche formula/scripting — revisit if formula-authoring becomes a headline AI feature), glm-5.2 / kimi-k2.6 (pricier without a clear quality step for our workloads), deepseek-r1-distill (reasoning-token burn makes costs unpredictable).

## 4. What operations cost (credit-usage matrix)

Representative Baseout operations (input ≈ schema context + question; output ≈ answer/doc):

| Operation (tokens in/out) | Fast | Balanced | Advanced |
|---|---|---|---|
| Schema chat turn (3K / 600) | 0.05 cr | 0.19 cr | 0.45 cr |
| Field/table annotation (1K / 200) | 0.02 cr | 0.06 cr | 0.15 cr |
| AI doc for one table (8K / 1.5K) | 0.12 cr | 0.49 cr | 1.16 cr |
| Base-wide doc generation (30K / 5K) | 0.42 cr | 1.79 cr | 4.13 cr |
| Changelog summary (10K / 800) | 0.10 cr | 0.52 cr | 1.05 cr |

## 5. What tier allowances buy (sanity check — resolves the "is Lite's 200 broken?" question)

At the **Balanced** default (~0.2 cr per chat turn, ~0.5 cr per table doc):

| Tier | Credits/mo | ≈ Chat turns | ≈ Table docs | Full-burn cost to us |
|---|---|---|---|---|
| Lite | 200 | ~1,050 | ~400 | $1.60 |
| Core | 1,000 | ~5,300 | ~2,000 | $8 |
| Plus | 5,000 | ~26,000 | ~10,000 | $40 |
| Max | 15,000 | ~79,000 | ~30,000 | $120 |

**Verdict: Lite's 200 credits are not broken — they're ~35 chat turns a day.** The allowances are generous in operation-count terms at every tier; the economic exposure is full-burn cost at Plus/Max ($40/$120), which only materializes if a customer scripts the AI via MCP at volume — and MCP calls also consume the API call allowance, which caps that. The margin re-run prices expected utilization at 25%.

## 6. Rules that fall out

- **Model choice is the customer's** (per operation or as a default setting); credit rates differ per the matrix — the 25% markup is uniform, so we're indifferent to their choice.
- **One pool, every path**: schema chat, AI docs, annotations, and MCP-driven AI all draw the same credits at the same rates.
- **BYOK (Plus+)**: customer's key, their provider bill, zero credits consumed; our AI COGS for BYOK users ≈ $0. (BYOK providers/models are the customer's affair — the menu above is for *our* metered offering.)
- **Cloudflare's free 10K neurons/day** quietly offsets a slice of our cost; ignored in pricing (small, ours to keep).
- **V2 repricing risk contained**: if a future frontier-model backend costs 5–20× (the known risk from the tier-cost homework), only the credit *rates per operation* change — the credit's dollar definition ($0.008 cost / 1¢ retail) and every pack/allowance price stay fixed.
