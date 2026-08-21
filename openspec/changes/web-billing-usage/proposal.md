# web-billing-usage — Proposal

## Why

Billing is the one surface in this promotion program where **there is no fork design to match.**

That is not an oversight — it is a recorded blocker. The audit's `CLIENT-QUESTIONS-PENDING.md` #4 asks: *"Are locks a capability statement or a price prompt? Were the Schema-Health Pro+ gates client-requested? Provenance is not in the repo."* It is marked **"the expensive one"**, it **blocks all of Billing** (`S33-F3`, `F8`, `F10`), and the audit states plainly that until #4 and #6 are answered *"S33 and S35 cannot be designed."*

Confirmed against the fork at `252005be`: there is **no `UsageView.astro`**, no plan-cards view, no add-on library, no meter component. The fork's `openspec/changes/usage-and-billing/` is a *design proposal* — three capabilities, no built views. And its own Impact section defers the data to the monorepo's [`shared-entitlements`](../shared-entitlements/), which has not landed either.

So this change exists to do three honest things rather than one dishonest one:

1. **Fix the two rows that need no design decision at all.** `billing-email` and `billing-invoices` are currently a *gated* text row and a note. But the answer for both is already known and already true: **Stripe's portal owns them.** A gated field pretending to be a future feature is worse than a link to the place the thing actually lives.
2. **Record what #4 blocks**, precisely, so the answer converts straight into work.
3. **Keep the honest gates honest** — and specifically honour `D14`'s interim ruling: **no gate ships pointing at the 12-line billing placeholder.** A capability lock whose "upgrade" path is a dead end is a worse experience than the lock alone.

## What Changes

### Unblocked — ships now, needs no client answer and no new design

- **`billing-email`** stops being a gated text input and becomes a **link into the Stripe portal**, where the customer actually changes it. The current shape asserts "this will be editable here one day"; that is not the plan and never was — card, plan and invoice management are all portal-owned by design (`Card details are handled by Stripe — Baseout never sees them`, already in the catalog's own help text).
- **`billing-invoices`** likewise: a real `action: 'billing-portal'` rather than a note telling the reader to find the portal button one row up.
- **`billing-plan`** keeps its note but points at the portal explicitly, for the same reason.
- **`SettingsRow` gains no new control type** — all three reuse the existing `button`/`action: 'billing-portal'` path that `billing-method` already uses and that `settingsControls` already handles with `setButtonLoading`.

### Blocked on client #4 — specified here, built when answered

- **Settings ▸ Usage page** — every metered lever with limit / used / percent / reset date, grouped as the pricing guide groups them, plus a per-Space breakdown for Space-attributed meters (records, file storage, database size, bases).
- **The `ok / warned (90%) / at-limit / enforced` visual language** — one treatment used everywhere, the recurring-but-dismissable banner, and an enforcement notice that names the limit and offers the matching add-on or upgrade (mirroring the email the customer already received).
- **Space Home's utilization block** — currently gated empty in-code (`usage=[]`, section hidden). It becomes real once meters exist.
- **Plan selection, checkout, plan change with proration preview, and the add-on library.**
- **The On2Air legacy migration offer** — the matched-customer "welcome back" state with 20%-for-life, and the at-or-above tier rule (lower tiers render without the discount).
- **`billing-overage`** — the "allow overage" toggle *is* question #4 in miniature. Whether overage is a capability the customer switches on or a price prompt determines whether this is a toggle at all.

## Capabilities

### New Capabilities

- `billing-surface`: the customer-facing face of the entitlement system — usage meters, limit states, plan and add-on management. **Specified, not built** until #4 lands.

### Modified Capabilities

- `web-settings`: three Billing rows stop being gated placeholders and route to the portal that owns them. No new control type, no new route.

## Impact

- **App:** `apps/web`. Phase 1 touches `views/settingsCatalog.ts` only (three row definitions) — `settingsControls` already handles the action.
- **Data layer:** every blocked item reads from [`shared-entitlements`](../shared-entitlements/) (`resolveEntitlements(orgId)`, the DB-native `plan_features` catalog). **Not from Stripe product metadata or product-name strings** — CLAUDE.md §1 is explicit, and the legacy `subscription_items.tier` read is a cached display value only. Any meter built here must resolve through `resolveEntitlements`.
- **Cross-references:** [`shared-entitlements`](../shared-entitlements/) (the data layer, tasks 9.2–9.3 hold the wiring) · [`baseout-web-billing-portal`](../baseout-web-billing-portal/) (the portal route Phase 1 reuses) · the fork's `usage-and-billing` design proposal (imported as reference when it becomes a built design) · pricing model in `research/pricing/pricing-guide.md`, reconciled into `Baseout_Features.md` §3.
- **Security:** no new secret and no new surface in Phase 1. The blocked phases introduce a money-adjacent surface: every entitlement decision must be **server-side** through `resolveEntitlements` (a client-asserted tier is not a gate), Stripe stays the only holder of card data, and proration previews must come from Stripe rather than being computed locally.
- **`D14`'s interim ruling is binding**: one gate recipe per `pattern-locked-tab`, and **no gate ships pointing at the billing placeholder.** If Phase 1 removes the placeholder's last honest destination, re-check every existing lock's CTA in the same change.

## Open Questions

1. **⛔ Client #4 — blocks everything except Phase 1.** *"Are locks a capability statement or a price prompt? Were the Schema-Health Pro+ gates client-requested?"* If Dan says the Pro+ gates were his, `D14` is superseded and `decision-no-tier-gating-default` falls with it — which changes the gating language across the whole product, not just Billing. **This needs sending, not deciding here.**
2. **The design does not exist yet.** Even with #4 answered, the blocked phases need a fork design before promotion — this is the one surface where we would otherwise be inventing UI, which the standing rule forbids. Recommend: send #4, then request the design, then promote. Do **not** hand-build a Usage page in the meantime.
3. **Client #2** (*is there a second user in V1 — members, invites, roles?*) leaks into Billing through the `Per org · admin` scope labels, which today name a scope no second user can be outside of. Worth sending in the same message.
