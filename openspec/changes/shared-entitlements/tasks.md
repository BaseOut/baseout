# shared-entitlements — tasks

TDD throughout (CLAUDE.md §3.4): every pure module gets its Vitest suite first. Enforcement ships behind `ENTITLEMENT_ENFORCEMENT` (default off) so schema/metering can land safely ahead of cutover. Cross-app payload changes (workflows callbacks ↔ server ingestion) update both sides in the same task.

## 1. Catalog schema + seed

- [ ] 1.1 `packages/db-schema`: table definitions — `plans`, `plan_prices`, `feature_groups`, `features`, `plan_features`, `addon_catalog` (feature slug, unit quantity, kind, price, Stripe price IDs — the locked add-on library as data), `account_feature_overrides`, `addon_purchases` (references `addon_catalog`), `usage_rollups`, `usage_notification_state`; `subscription_items.plan_id` reference; typed-value columns + enum-rank storage; tests for type/rank helpers
- [ ] 1.2 Canonical migrations in `apps/web` (+ header-comment mirror updates queued for server/admin); `db:check` clean
- [ ] 1.3 Seed migration: 7 groups, all features (slug, type, unit, enum ranks, meter_kind), 4 public plans + trial + enterprise baseline, the `addon_catalog` library (guide §6), full `plan_features` matrix from `pricing-guide.md` §3 (cite guide version in the seed header); test asserting seeded matrix == a fixture derived from the guide
- [ ] 1.4 Stripe setup script (idempotent, env-scoped): 4 products (+`plan_slug` metadata) × monthly/annual prices + add-on SKUs from guide §6; writes `plan_prices` / add-on price mapping

## 2. Resolution + account entitlements

- [ ] 2.1 Pure resolution lib (shared: web + server + admin consume): `resolveEntitlements(orgId)` join + `effective()` rule (override ?? plan, add-on stacking on limits, enum rank comparisons, override expiry, fair-use sentinel); exhaustive Vitest on composition cases
- [ ] 2.2 Webhook extensions in `apps/web`: subscription item ↔ `plan_id` maintenance, add-on purchase lifecycle (recurring items; one-time with `expires_at` = period end), idempotent by Stripe event ID; integration tests vs msw Stripe
- [ ] 2.3 Backfill script: existing `subscription_items.tier` → `plan_id`; grep-audit and migrate all `tier`-based gating call sites to the resolution lib
- [ ] 2.4 Override write path (staff-only route + lib): typed validation against the feature, required reason, audit row on every write; tests incl. audit assertions

## 3. Usage metering

- [ ] 3.1 `apps/workflows` + `apps/server` (same task — shared contract): extend progress/complete callback payloads with records, file bytes, and base counts; server ingestion writes Space-attributed `usage_rollups`; tests both sides
- [ ] 3.2 `apps/server`: per-Space database-size measurement at run finalization (PG `pg_database_size()`; D1 via Cloudflare REST API `file_size` — PRAGMAs unsupported) → stock rollup write
- [ ] 3.2a Documents count rollup maintained by the web document CRUD routes (+ sweep correction); enforcement check on document create against the effective cap
- [ ] 3.3 Point-of-use metering: AI-credit recording (cost × 125 per `ai-credit-model.md`, per-model rates table/config) and API/MCP/SQL call counting in the serving middleware; period-anchored flow rollups; tests
- [ ] 3.3a Burst rate limit via the Workers Rate Limiting binding keyed per org/token (D11a) on API/MCP/SQL routes; AI Gateway in front of Workers AI for observability/verification (logs, token analytics) — not accounting
- [ ] 3.4 Live-count resolution for creation caps (Spaces, bases, seats accepted-members, destinations, reports) inside the resolution/usage read path — no stored rollups; tests
- [ ] 3.5 Reconciliation sweep (server cron): re-derive stock meters from durable rows, correct `usage_rollups`, handle period rollover closing/opening of flow rows; drift-healing test

## 4. Enforcement + notification skeletons

- [ ] 4.1 Pure evaluator: `evaluate(used, effectiveLimit, state)` → transitions of `ok → warned_90 → warned_100 → enforced` with hysteresis + period reset; exhaustive state-machine Vitest
- [ ] 4.2 Wire evaluation into every usage-write path (ingestion, point-of-use, sweep); persist `usage_notification_state`; transitions-only invoke `notifyLimitWarning` / `notifyLimitEnforced` skeletons (structured-logged no-ops with final signatures)
- [ ] 4.3 Enforcement actions behind `ENTITLEMENT_ENFORCEMENT` flag: scheduler DO pre-enqueue check (background pause at job boundary), interactive refusal payloads (AI + API middleware, 429 + add-on hint), creation-cap checks in mutating routes; restore-immunity test; auto-resume on add-on purchase/plan upgrade/cycle rollover
- [ ] 4.4 Retention-window wiring: the cleanup/retention engine reads schema-history, record-history, and audit-log retention from `resolveEntitlements` (per-org effective values) instead of any hardcoded ladder; tests
- [ ] 4.5 Churn lifecycle: `past_due` = unchanged entitlements; cancellation = churn grace state (backups stop, data readable/restorable, deletion warnings, cleanup after the grace window, re-subscribe restores); grace window 30 days (locked, held as config); tests with fake clock

## 5. Notifications (email) + seat rule

- [ ] 5.1 Limit emails: React Email template (feature, used, limit, pct/overage, add-on/upgrade link) sent via Mailgun from the notifier call sites; structured-logged; tests with mocked transport
- [ ] 5.2 Seat/invite rule: limit state counts accepted members only; invite route blocks when accepted + outstanding ≥ effective seat limit with cancel/add-on/upgrade guidance; cancel-invite frees a slot; tests

## 6. Billing checkout (web)

- [ ] 6.1 Plan purchase flow: Stripe Elements payment capture, subscription create/update at the selected plan price, webhook-confirmed entitlement switch; msw-Stripe integration tests
- [ ] 6.2 Plan change with proration: upcoming-invoice preview before confirm; downgrade over-limit warning listing the specific meters; tests
- [ ] 6.3 Add-on purchase/cancel: recurring quantities + one-time packs (`expires_at` = period end); enforcement re-evaluation on confirmation (auto-resume); tests

## 7. Trial lifecycle

- [ ] 7.1 `trial_expires_at` set on first successful trial run completion (+14 days); upgrade cancels the clock; tests
- [ ] 7.2 Daily trial evaluation cron (server): staged T-7/T-3/T-1/day-of emails, deduplicated per stage; tests on the pure stage logic
- [ ] 7.3 Deletion job at expiry via existing cleanup machinery; deletion recorded/auditable; account remains usable; end-to-end test with fake clock

## 8. Legacy migration registry

- [ ] 8.1 `legacy_customers` table (schema + migration, per D13 — no import tooling): unique ci-email, legacy plan, mapped plan, export metadata, redemption state
- [ ] 8.2 Signup/checkout matching: verified-email lookup, UI surfacing payload (mapped tier + offer), at-or-above tier rule; tests
- [ ] 8.3 Redemption: apply the canonical 20%-forever Stripe coupon on checkout, mark row redeemed (single redemption), audit; msw-Stripe tests

## 9. Visibility + verification

- [ ] 9.1 `apps/web` endpoints: org-scope and Space-scope usage/limits payloads (effective limit, used, pct, state, period) from resolution lib + rollups; auth via middleware; tests
- [ ] 9.2 Wire Space-dashboard utilization placeholders to the endpoints (loading states per §4.5; warning-state treatment)
- [ ] 9.3 Settings → Usage page: org-wide meter list + per-Space breakdown from the endpoints (structure per the paired ui-only `usage-and-billing` design; promotion via /ui-sync flow)
- [ ] 9.4 End-to-end smoke: seeded plan → legacy signup shows offer → subscribe with coupon → run backup → usage appears → cross 90% → single warning email → cross 100% → enforcement holds next run → buy add-on in-app → resumes. Documented as the Verification demo
- [ ] 9.5 Typecheck, build, `db:check`, full test suites green across web/server/workflows/db-schema
- [ ] 9.6 Docs: note in `pricing-guide.md` that `plan_features` is now the runtime source; flag Features.md §5.5 supersession in the queued Features reconciliation change; cross-reference `admin-entitlements` + ui-only `usage-and-billing`
