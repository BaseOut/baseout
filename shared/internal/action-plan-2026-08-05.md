# Action Plan — Aug 5 Sync (Dan/Autumn)

Meeting-notes → actions, grounded in repo state as of 2026-08-05 (branch `admin-crm-ux`). Trigger for the sync: **Airtable was acquired by Bending Spoons**. All engineering below is **spec/proposal-first and UNCOMMITTED** — three new OpenSpec proposals + two doc reconciliations, staged in the working tree pending review (nothing committed or pushed; deep code work deferred until the in-flight `admin-crm-ux`/entitlements streams land). Items completed this session are marked ✅.

## 1. Airtable acquired by Bending Spoons — strategic context

**What Dan said:** Airtable sold for ~$2B, ~1/10th of its ~$12B peak. Expect a talent exodus and a likely pivot from enterprise → self-serve/consumer. The AI "hyper agent" was carved out (CEO runs it separately). A big client "isn't phased." Net read: **a tailwind for Baseout** if we (a) help customers de-risk/leave Airtable and (b) prove we can add a second platform fast. Positioning: "DevOps for all these databases."

- No code action for the news itself; it reprioritizes §2 and §3 below and expedites the second-platform question.

## 2. Multi-platform readiness — can we add a 2nd platform in "a month, not six"? (Zite)

**Dan's ask:** confirm the infra can add a second data source cheaply; specific candidate **Zite** (AI-native no-code DB, ~200k customers, weak native backup/export tooling; Dan knows the founders and can get API access).

- ✅ **Readiness assessment + adapter design filed:** [`openspec/changes/system-platform-abstraction/`](../../openspec/changes/system-platform-abstraction/) (spec/design only, no code).
- **Finding:** the **control plane is already platform-abstracted** (`platforms` / `space_platforms` / `connections.platformId` / per-platform `subscription_items` / `resolveCapabilities(orgId, platformSlug)`), so **no new master tables** are needed. The **execution layer is Airtable-shaped end-to-end** with **no source-provider adapter seam** (unlike the clean destination `storage-writers/` set). The design proposes a symmetric `SourcePlatformClient` interface and catalogs every chokepoint with file:line.
- **Verdict: weeks, not six months — roughly 6–10 focused engineering-weeks** (adapter seam ~2–3 wks + first Zite adapter ~2.5–5 wks; ~1.5–2.5 months solo, ~1 month with two engineers). Not one month from a cold start.
- [ ] **Dan:** obtain Zite API docs (auth model, schema/metadata API, pagination, rate limits, field-type taxonomy) — 3 of 6 Zite estimate line-items are blocked on this.
- [ ] **Decide (Dan/architecture):** the payload-schema strategy (reuse `bo_at_*` vs new `bo_zt_*` vs a normalized `bo_src_*`) — the single biggest cost lever; and whether to build the seam now (optionality) vs. after V1 launch (less regression surface). Multi-platform remains **PRD V2** — this change commits nothing.

## 3. Migration / exit tooling — "help people get off Airtable"

**Dan's ask:** prioritize migration tools that de-risk the Airtable dependency.

- ✅ **V1-feasible slice filed:** [`openspec/changes/shared-data-portability/`](../../openspec/changes/shared-data-portability/) — a one-click **"export all my data"** portable archive (every base's latest snapshot across all Spaces → self-contained CSV bundle + `manifest.json`), reusing the existing CSV pipeline + storage writers.
- **Finding:** no customer-facing "exit Airtable" feature exists today. Restore writes *back into* Airtable (and its `ensureRestoreTarget` is a throwing stub pending write-scope OAuth); the only current exit paths are static-CSV backups and dynamic-DB SQL.
- **Boundary:** cross-platform *clone/migration* (writing INTO another platform) stays **PRD V2 §3.8** and depends on the §2 adapter — explicitly excluded from this change.
- [ ] **Decide (Dan):** is a data-*out* export the right V1 slice? Archive format (CSV-only vs +JSON; include attachments?); which tiers get it and whether it's metered or a universal anti-lock-in feature.

## 4. Pricing / spec reconciliation — the model is "solidifying" ✅

**Dan's ask:** the pricing model is finalized (RUM-primary tiers, snapshots, per-account R2, AI-credit markup, BYOK). Verified: the model matches on paper and in the seeded catalog (`apps/web/src/db/seed/entitlements-catalog.ts` is the runtime source of truth), but the spec docs contradicted themselves. Fixed:

- ✅ **"Snapshot" is now canonical** — [`Baseout_Features.md`](../Baseout_Features.md) §1 previously made "Backup" canonical and listed "Snapshot" as an *alias to avoid*, contradicting the locked pricing + code. Now: Backup = the process, **Snapshot** = the stored output (one CSV per table; counts toward File-storage-under-management when kept in Baseout R2).
- ✅ **RUM counts regardless of storage location** — added to [`pricing-guide.md`](../../research/pricing/pricing-guide.md) §63 and mirrored in Features §3: records count identically whether snapshots live in Baseout R2 or the customer's own storage (BYOS). *(Code gap: metering counts backup-run records only today — BYOS-only counting is a `shared-entitlements` follow-up.)*
- ✅ **BYO-key vs BYO-Model reconciled** — Features §11 defined a stale "Bring your own AI **Model** (Enterprise)"; clarified it as a distinct deferred V2 concept, separate from the locked "Bring your own AI **key** (Plus+)".
- Note: §4/§5 legacy-tier tables were **left as-is** — they already carry clear SUPERSEDED banners pointing at the locked source; rewriting them would be churn.

## 5. BYOK — "we probably need to spec bring your own keys" ✅

- ✅ **Mechanism spec filed:** [`openspec/changes/shared-ai-byok/`](../../openspec/changes/shared-ai-byok/). BYOK was priced (`byo_ai_key`, Plus+) but had **no mechanism anywhere**. The spec: per-provider key vault (`ai_provider_keys`, `key_enc` AES-256-GCM like OAuth tokens — never logged/returned), Plus+-gated key-management UI, a `resolveAiRouting(orgId)` seam at all three AI call sites, plaintext never on the Trigger.dev payload, zero-credit accounting when BYOK is active, and composition with the `shared-ai-controls` `ai_usage` gate (policy resolves first).
- **Compliance angle (Dan's case):** gov-contractor orgs run AI on their own provider account/terms; "we never see the key."
- [ ] **Decide (Dan):** AI Gateway vs direct routing; launch provider set (Anthropic only vs +OpenAI/Cloudflare); route all 3 AI sites or just paid chat; strict-custody vs true non-custody for compliance orgs.

## 6. ⚠️ AI models & credits — the pricing rests on a false premise (decision needed)

**Dan's mental model:** "all our current AI is whatever's free in Cloudflare (llama), plus open-weight Gemma; paid Gemini is only in OKB for YouTube reads." **Reality in the baseout repo:**

- **Schema Chat runs PAID Anthropic Claude** (`claude-opus-4-8`, `apps/workflows/trigger/tasks/chat-respond.task.ts:20`, via `@anthropic-ai/sdk`) — not free Workers AI. Only schema-descriptions + health-scoring use Cloudflare Workers AI (`@cf/meta/llama-3.3-70b`).
- The **AI-credit model** (`pricing-guide.md` §67, `ai-credit-model.md`) computes `credits = provider cost × 125` against **Cloudflare** model prices (Fast=llama-3.1-8b, Balanced=gpt-oss-120b, Advanced=kimi-k2.5) — so chat is mispriced. **This is almost certainly why AI credits feel "fuzzy."**
- **AI credits are defined + priced but not metered/consumed at any call site yet** (`shared-entitlements` task 3.3, unbuilt) — today no credits are actually deducted.
- **No Gemini in baseout** — it's entirely in the separate OKB product; confirmed no action here.
- [ ] **Decide (Dan):** re-price chat against Claude, move chat to a Workers AI model, or gate chat behind BYOK (§5). Then wire the credit meter (§3.3 of `shared-entitlements`).

## 7. SOC 2

- Dan-owned; targeting Monday via Comp AI + Claude/MCP evidence gathering. Blocker noted: no pen test yet. No new baseout engineering here; Autumn's evidence pass is already largely done (see the comp-ai handoff docs).

## 8. OKB — out of this repo

- OKB (`o-kb.com`) deploy failures discussed (missing `wrangler.json` / entry point from an unresolved merge; better-auth URL → `o-kb.com`; web/intake/api Workers). **OKB is a separate repo (`Opensided/okb`)** — not fixable from baseout; needs a session in that checkout.

## 9. Decisions needed from Dan (consolidated)

1. **AI pricing (§6):** re-price chat vs. move to Workers AI vs. BYOK-gate it — the credit model is wrong until this is settled.
2. **Platform payload schema (§2):** reuse `bo_at_*` / new `bo_zt_*` / normalized — the biggest multi-platform cost lever.
3. **Build the platform adapter now vs. post-V1 (§2);** get Zite API docs.
4. **Portable-export scope (§3):** V1 data-out acceptable? format, attachments, tiers/metering.
5. **BYOK specifics (§5):** routing, provider set, call-site coverage, custody model.
