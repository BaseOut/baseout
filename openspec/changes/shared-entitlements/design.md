# shared-entitlements — design

## Context

The locked pricing model (`research/pricing/pricing-guide.md`, `ai-credit-model.md`, decision log `final-pricing-matrix.md`) defines: four plans (Lite/Core/Plus/Max + Enterprise custom), ~24 levers split into meters / structural gates / feature gates, a flat add-on library (every recurring add-on $10/mo, one-time packs at +20%), warn-at-90% / enforce-at-100% limit behavior with never-fail-mid-job, and a 14-day trial with a deletion clock.

What exists today: `subscriptions` (one per org) and `subscription_items` (per platform; `tier` text cached from Stripe product metadata — the current capability-resolution source per Features §5.5); `overage_records` (per-period metered overage, mostly unused); `backup_runs` already reporting record/table/attachment counts through the engine callback flow; per-Space databases whose size the engine can measure; utilization placeholders on the Space dashboard. There is no plan table, no feature table, no override mechanism, no usage accounting, no enforcement.

Constraints: master-DB migrations are owned by `apps/web`; the backend worker sees only `INTERNAL_TOKEN`-gated routes; workflows run on Node and talk to the server via the progress/complete callback contract; admin mirrors tables read-only; never fail a backup mid-job.

## Goals / Non-Goals

**Goals:**

- One authoritative, data-driven representation of plans, features, and per-plan values — editable without deploys, seeded from the pricing guide.
- Deterministic per-account resolution: plan value → sparse override → add-on stacking, with plan edits propagating to every non-overridden account.
- Usage accounting for every metered lever, measured where the data lives (Space) and stored where decisions are made (master DB), anchored to billing periods for flow meters.
- Enforcement per the locked model: 90% warning, 100% enforcement, three lever classes, notification skeletons with deduplication.
- Data endpoints feeding the existing dashboard utilization placeholders.

**Non-Goals:**

- Notification content *polish* (a simple email ships; copywriting/design and non-email channels come later).
- Metered per-unit overage *billing* (`overage_records` machinery stays dormant; the model sells add-ons, not per-unit bills).
- The On2Air data export/import itself (the `legacy_customers` table is specced and consumed; populating it is an ops task).
- The visual design of UI (paired ui-only change `usage-and-billing` owns the views; this change owns data, routes, and wiring).
- Admin screens (paired single-app change `admin-entitlements` owns catalog CRUD, override management, Enterprise contract editor, legacy-registry browser — it builds on this change's schema and resolution lib).

## Decisions

### D1 — Capability resolution moves from Stripe metadata to a DB-native catalog

Stripe metadata (`platform` + `tier`) was workable when values were hardcoded in specs; it cannot express 24 typed levers, per-account overrides, or add-on stacking, and editing a limit should not require touching Stripe. New rule: **Stripe carries money and identity (products, prices, subscription state, a `plan_slug` metadata key for reconciliation); the master DB carries what the money buys.** `subscription_items.tier` stays as a cached display value only. *Alternative considered:* pushing all values into Stripe product metadata — rejected: 50-key metadata blobs, no typing, no relational integrity, no override story.

### D2 — Sparse overrides, not materialized per-account feature sets

Per-account copies of every feature were rejected (founder + design agreement): they turn every plan edit into a backfill, bury intentional exceptions in noise, and make drift invisible. Instead `account_feature_overrides` holds **only intentional exceptions** — one row per (organization, feature) with a typed value, a reason, the granting staff user, and an optional expiry. Resolution:

```
effective(org, feature) =
  (override.value  if an active override exists
   else plan_features.value for the org's plan)
  + Σ active addon_purchases.quantity × addon.unit_amount   (limit-type features only)
```

Overrides replace the **plan value**, not the final number, so an override and an add-on compose predictably. Plan edits reflect everywhere immediately except where an override exists — exactly the requested semantics. Every override write is audit-logged (who, what, why).

### D3 — Typed features with stable slugs

`features.value_type ∈ {boolean, limit, enum}` with `unit` (records, GB, credits, calls, count, days) and `enum_values` where applicable (frequency ladder, database class, support level). Code gates on **feature slugs** (`records_under_management`, `backup_frequency_max`, `byo_ai_key`, …), never display names — display names/groups are copy, renameable without code changes (same slug principle as tier naming). A `meterable` flag + `meter_kind ∈ {flow, stock, creation}` links limit-features to the metering system and selects their enforcement class.

### D4 — Plan values edit in place; plan rows are the versioning boundary

Editing a `plan_features` value changes it for every subscriber (the founder's propagation requirement). Structural repackaging (a genuinely different offer) = a **new plan row** with its own Stripe product; old plans flip `status='inactive'` (unsellable, still resolvable for existing subscribers — never delete). The 20% legacy-migration discount is a Stripe coupon, deliberately **not** represented in this catalog (it changes price, not entitlements).

### D5 — Measure at the Space, store authoritatively in master

Per-Space engines/tasks **compute** usage; the master DB **records** it. No persistent usage ledger inside per-Space DBs — they are rebuildable caches, and enforcement/billing/UI all read master. Transport is the existing machinery:

| Meter | Measured by | Reported via |
|---|---|---|
| records, file GB (internal snapshots + attachments), bases | backup tasks (workflows) | existing progress/complete callbacks, extended payload |
| database size (per Space) | server, post-sync — `pg_database_size()` for Postgres; **D1 via the Cloudflare REST API's database `file_size`** (verified 2026-08-03: D1 does *not* support `PRAGMA page_count/page_size`) | written during run finalization |
| documents | counted at CRUD time by the serving document routes (source rows live in per-Space DBs, so the org total is a maintained rollup, corrected by the sweep); body bytes ride the file-storage meter once bodies move to R2 per the pricing decision (currently in-DB) | direct master write on create/delete |
| AI credits | web/server at point of use (credit calc per `ai-credit-model.md`) | direct master write per operation batch |
| API / MCP / SQL calls | serving worker middleware | batched counter flush |
| manual backups, restores | already rows in master (`backup_runs`, restore runs) | counted, not tracked separately |
| spaces, bases, seats, destinations, reports | already rows in master | counted live at resolution time |

A periodic **reconciliation sweep** (server cron) re-derives stock meters from source-of-truth rows to correct drift; callbacks are fire-and-forget per the existing contract, so the sweep is the safety net. *Alternative considered:* per-Space usage tables synced upward — rejected: two sources of truth, and the per-Space DB is customer-facing surface where internal accounting doesn't belong.

### D6 — Monthly-anchored flow meters; stock meters are levels

`usage_rollups` rows are `(organization_id, feature_slug, period_start, period_end, space_id nullable, used numeric)`. **Flow meters** (AI credits, calls, manual backups, restores) reset on a **monthly anniversary cycle derived from the subscription start date — regardless of billing interval**. This matters for annual subscriptions: their Stripe period is a year, but allowances are *per month* — anchoring to the Stripe period would hand an annual customer 12× the monthly allowance once a year. Monthly-billed customers' anniversary cycle coincides with their Stripe period naturally. **Stock meters** (records, GB, DB size) are point-in-time levels — stored as the current-period row continuously updated, history retained per closed period for trends. Creation caps don't roll up at all — they `COUNT(*)` live. One-time pack expiry = `addon_purchases.expires_at` set to the **current monthly anniversary boundary** at purchase ("this cycle only" means this month, on annual plans too).

### D7 — Enforcement evaluates in the server's rollup path; notifications are a deduplicated state machine

Evaluation runs wherever usage changes land: rollup ingestion (after each run/flush) and the reconciliation sweep. It computes `used / effective_limit`, then transitions `usage_notification_state` (`ok → warned_90 → warned_100 → enforced`, reset at period rollover or when usage drops back under). **Only transitions fire notifications** — no re-alerts on every sync. Skeleton functions:

```
notifyLimitWarning(org, feature, used, limit, pctOfLimit)    // fired on → warned_90 and → warned_100
notifyLimitEnforced(org, feature, used, limit, overagePct)   // fired on → enforced
```

Bodies are placeholders (log + TODO); the signatures and call sites are the contract. Enforcement actions by class: **background** meters set a per-Space/org `paused_reason` the scheduler DO checks before enqueuing the next run (in-flight runs always finish); **interactive** meters are checked at point of use (AI call, API middleware) and refuse over-limit with the add-on offer in the error payload; **creation** caps are checked in the mutating route handlers. Restores are never blocked by any *other* meter's enforcement — only by their own count.

### D8 — Purchased add-ons are a new concept; `overage_records` stays dormant

`addon_purchases` = entitlement extensions the customer *bought* (Stripe-synced: recurring = subscription items on add-on prices; one-time = payment/invoice items with `expires_at`). `overage_records` = per-unit *billing* for un-purchased overage — a mechanism the locked model doesn't use (we warn and enforce instead of auto-billing). The table is kept for a possible future metered-billing policy but nothing new writes to it. *Alternative considered:* folding add-ons into `overage_records` — rejected: opposite directions (bought-in-advance vs billed-in-arrears).

### D9 — Resolution is a per-request join now, cache later

`resolveEntitlements(orgId)` is a 3-way join (plan_features ⟕ overrides ⟕ active add-ons) returning the full typed entitlement map; single-digit-ms on Hyperdrive at current scale. No cache layer in this change — but the function is the single choke point, so a KV/DO cache with webhook-driven invalidation can be added behind it without touching callers. Cache keys would invalidate on: plan_features write, override write, add-on/subscription webhook.

### D10 — Enterprise = base plan + full contract overrides (resolves former open question)

Founder decision (2026-08-03): Enterprise organizations sit on a single `enterprise` plan row (kind `custom`, conservative baseline values) and receive their contracted terms as **per-account overrides on every contracted feature**, entered through the admin contract editor (`admin-entitlements`). No per-contract plan rows. Consequences: the resolution path is identical to every other org (no special-casing), the contract is auditable as override rows (who set what, when, why = contract reference), and contract renegotiation is an override edit. The override table is indexed for orgs with many overrides.

### D11 — Interactive counters write through at launch; batching is a bench-later seam

The question ("batch vs write-through") concerns *how AI/API/SQL call usage reaches the master DB*: **write-through** = each metered operation updates the period counter in the same request (one small `UPDATE … SET used = used + n` per op); **batching** = the worker accumulates counts in memory/KV and a flush job writes totals every N seconds (fewer DB writes, usage lags by the flush interval and can lose the tail on crash). Decision: **write-through at launch** — volumes are far below Postgres discomfort (thousands of ops/day, not per second), it's simpler, and enforcement sees exact live numbers. The metering call site is a single function, so introducing a batcher behind it later requires no caller changes. Revisit when sustained call volume approaches ~10 writes/sec.

### D11a — Burst rate limit rides Cloudflare's Rate Limiting binding; monthly accounting stays ours

Verified 2026-08-03: the Workers **Rate Limiting API binding** is GA and keys on arbitrary strings — so the standard burst limit (the every-tier over-usage protection) is implemented as a binding keyed per organization/API token at the routing layer, exactly the "Cloudflare handles it at the API level" model. Its guarantees fit the job precisely: best-effort, eventually consistent, per-location counters, 10s/60s windows — ideal for abuse protection, **disqualifying for accounting**. The monthly call *allowance* therefore remains our own counter (D11 write-through); the two layers are complementary, not redundant. Separately, **AI Gateway** (works in front of Workers AI; per-request logs, token/cost analytics, its own rate limiting) is adopted as an *observability and verification* layer — useful for reconciling our credit metering against provider-reported tokens and as the BYOK routing point — but per-customer credit accounting stays in our meter (gateway analytics don't do billing-grade per-end-customer attribution).

### D12 — Seats: active members count against the limit; invites reserve capacity

Founder decision (2026-08-03): the seat *limit state* (warnings, "over limit") counts **accepted members only** — pending invites don't put an org over its limit. But the **invite action** counts `accepted + outstanding invites`: when that sum has reached the seat limit, new invites are blocked and the org must cancel an outstanding invite (or buy the +2-seats add-on / upgrade) to send another. This prevents invite-overshoot (10 invites against 2 free seats) without punishing orgs for unanswered invites.

### D13 — Legacy registry: match at signup, discount via coupon, table not import

`legacy_customers` (master DB): email (unique, matched case-insensitively), legacy plan slug (`starter | essentials | professional | premium`), mapped Baseout plan slug (lite/core/plus/max per the locked mapping), export metadata, and redemption state (`unredeemed | redeemed`, redeemed org/user/timestamp). Populating it from the On2Air export is an ops task outside this change. At signup (and at checkout for existing accounts that never redeemed), a match: (a) surfaces the "welcome back — 20% for life" state to the UI, (b) applies the **20% lifetime floating Stripe coupon** to the subscription at checkout (coupon off list price per the pricing lock — never bespoke price IDs), (c) marks the row redeemed (one redemption per row). Matching is by verified email only — no fuzzy matching; unmatched legacy customers can be linked manually via the admin registry browser.

### D14 — Trial deletion clock rides the entitlement machinery

Trial = the seeded `trial` plan (Lite values, `backup_frequency_max = one_time`). The clock: `trial_expires_at` = first successful backup run's completion + 14 days (not signup time — the promise is "deleted 14 days after we perform the backup"). A server cron evaluates trials daily: warning emails at T-7, T-3, T-1, day-of (same email skeleton stack as limit notifications), then the deletion job (existing cleanup machinery deletes the run's stored data, marks the org's trial consumed via the existing `trial_ever_used`). Any upgrade to a paid plan cancels the clock. Emails and deletion respect never-fail-mid-job trivially (deletion only ever runs against a completed, expired trial).

### D15 — Checkout and plan changes are in-app against the Stripe API, not Stripe-hosted pages

Purchase/upgrade/downgrade/add-on flows render in-app (ui-only owns visuals) and drive the Stripe API directly: subscription create at signup-tier intent, `subscription.update` with standard proration for plan changes, quantity updates for recurring add-ons, one-off invoice items for one-time packs. Rationale: the trial→paid path, legacy-discount surfacing, and add-on library are too model-specific for Stripe Checkout's hosted page, and an in-app flow keeps entitlement state transitions (enforcement auto-resume on purchase) synchronous with the webhook confirmation. Card capture uses Stripe Elements/PaymentElement — raw card data never touches Baseout.

### D16 — R2 topology: one bucket per customer account, one top-level folder per Space (founder decision 2026-08-03)

**Locked: bucket-per-account.** ("Environment" in earlier drafts meant dev/staging/prod — today's design is one *shared* bucket per deployment env with org key prefixes; this decision replaces it for managed R2.) Platform-verified feasible: R2 allows 1,000,000 buckets per Cloudflare account, bucket creation is API-driven, and bucket-management ops rate-limit at 50/sec — per-customer provisioning is comfortably inside all limits.

- **Naming:** `baseout-{env}-org-{organizationId}` (bucket names are account-global and ≤63 chars; the immutable org ID — not the renamable slug — is the identity). Bucket name recorded on the org's managed storage-destination row.
- **Provisioning:** created **lazily on first managed-R2 write** (not at signup) — avoids orphan buckets for accounts that never back up and makes signup un-failable on storage. Lifecycle rules applied from a template at creation; template changes roll forward via a sweep.
- **Key layout inside the bucket:** the org root segment becomes redundant — keys root at the Space: `{SpaceName}/{BaseName}/{DateTime}/{TableName}.csv` (one folder per Space, as directed). `buildR2Key` keeps the org segment only for BYOS destinations (where it renders as the customer-visible root folder in their own storage).
- **Read path consequence (the accepted cost):** the server's static credential-less `BACKUPS_R2` binding can't address per-account buckets — the media download route moves to the S3 API (aws4fetch with the same account-scoped R2 credentials the write path uses, bucket name from the org row). The runbook's credential rules extend to the server read path; `shared/internal/r2-setup.md` MUST be updated in the implementing change per CLAUDE.md §3.7.
- **Deletion on churn** = empty + delete the bucket — a crisp, auditable erasure story (nice GDPR property vs. prefix-delete in a shared bucket).
- **Metering unchanged:** per-account usage still comes from this change's file-storage meter (per-org *and* per-Space); Cloudflare's per-bucket storage metrics become a free cross-check for the reconciliation sweep.
- **Migration:** existing dev bucket contents are test data — no production migration exists yet (prod bucket unprovisioned per the runbook), so this lands cleanly before launch.

Implementation belongs to the storage change family (`system-r2-launch` / workflows writer + server read route), not this change; this change consumes the topology (per-bucket metrics cross-check, deletion story).

- **[Seed drift vs pricing guide]** the matrix lives in a seed migration; a pricing edit that skips the seed leaves docs and DB disagreeing → the seed file cites the pricing guide version and the guide gains a "reconcile to `plan_features`" note; admin catalog UI is the durable fix (follow-up).
- **[Callback loss under-counts usage]** progress callbacks are fire-and-forget → reconciliation sweep re-derives stock meters from durable rows; flow meters (AI/calls) are written at point of use, not via callbacks, so the lossy path only ever affects stock meters between sweeps.
- **[Interactive checks add a master-DB read per AI/API call]** acceptable at launch volume; the D9 choke point is the future cache seam; the batched counter flush amortizes the write side.
- **[Enum enforcement can't be numeric]** frequency/database-class overrides compare by ladder rank, not arithmetic — the resolution library owns rank tables so callers never string-compare.
- **[Two Stripe sync surfaces]** subscription webhooks now maintain both subscription state and add-on entitlements → idempotent handlers keyed on Stripe event IDs (existing webhook idempotency table pattern).
- **[Existing `tier` consumers]** anything reading `subscription_items.tier` for gating keeps working during migration (value still cached) but must move to `resolveEntitlements` before the catalog and metadata can diverge → migration plan step, greppable.

## Migration Plan

1. Schema lands in `packages/db-schema` + canonical migrations in `apps/web`; seed migration inserts groups, features, four plans + trial, and the full `plan_features` matrix from the pricing guide.
2. Stripe: create the four products + monthly/annual prices + add-on SKUs (idempotent setup script, env-scoped); `plan_prices` rows link them.
3. Backfill: map existing `subscription_items` (tier text) → `plan_id`.
4. Resolution library ships in web + server; consumers migrate off `tier` greps.
5. Usage reporting: workflows extend callback payloads; server ingests + reconciliation sweep cron; notification state machine + skeletons.
6. Endpoints + dashboard wiring last (read-only over the above).
7. Rollback: additive schema — disable enforcement evaluation (config flag `ENTITLEMENT_ENFORCEMENT=off` defaults off until cutover) and consumers fall back to cached `tier`; no destructive migration to unwind.

## Open Questions

_None — the three original open questions were resolved by founder decision 2026-08-03 (D10 Enterprise-via-overrides, D11 write-through counters, D12 seat/invite rule)._
