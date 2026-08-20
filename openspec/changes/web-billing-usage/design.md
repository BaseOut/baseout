# web-billing-usage — Design

## Context

Every other change in this program promotes a settled fork design onto real data. **This one cannot**, and the honest response is to separate the part that needs no design from the part that needs both a client answer *and* a design that does not exist.

What exists today in `apps/web`:

- `billing-plan` — a note pointing at "Payment below".
- `billing-usage` — a real link to `/reports`.
- `billing-method` — a **real** `POST /api/billing/portal` button with `setButtonLoading` (landed in `web-settings`).
- `billing-email` — a **gated** text row showing the account email.
- `billing-invoices` — a note telling the reader to open the portal from the row above.
- `billing-overage` — a **gated** toggle.

Space Home's utilization section is gated empty in-code (`usage=[]`), and the view hides it when empty — which is already the correct behaviour and needs no change until meters exist.

## Goals / Non-Goals

**Goals**
- Remove the two gates that are gating nothing real, replacing them with the destination that already owns the job.
- Specify the blocked surface precisely enough that the client answer converts directly into tasks.
- Leave no gate pointing at a dead end.

**Non-Goals**
- **Building a Usage page.** There is no design, and inventing one violates the standing rule that we match the fork rather than author UI.
- Changing the entitlement data layer — that is `shared-entitlements`.
- Touching Stripe products, prices, or webhook handling.

## Decisions

### D1 — A gate is only honest if the thing behind it is actually coming

`SettingsRow.gated` was introduced by `web-settings` to avoid fake saves, and it was the right instrument for rows whose backend is genuinely pending. **`billing-email` is not such a row.** Nobody intends to build an in-app billing-email editor: Stripe's portal owns billing identity, deliberately, and the catalog's own help text already says card details never reach Baseout.

So the gate here is not "honest about a gap" — it is *inventing* a gap. The fix is to route to the real owner. Same for `billing-invoices`, whose current note asks the reader to do a small navigation puzzle ("open it from Payment method above") that a button solves.

*Rejected:* leaving both gated until the Usage page lands. It couples a five-line fix to a client blocker for no reason, and it keeps two rows lying about the roadmap.

### D2 — Reuse the existing action; add no control type

All three rows use `control: 'button'` + `action: 'billing-portal'`, which `settingsControls` already handles (`data-set-portal`, `POST /api/billing/portal`, `setButtonLoading`, revert-on-error). **Zero new client code.** This is the smallest possible diff for the outcome, per §3.2.

### D3 — The blocked work is specified against `resolveEntitlements`, not Stripe metadata

When it unblocks, every meter, limit and lock resolves through `resolveEntitlements(orgId)` over the DB-native `plan_features` catalog. Stripe carries money and identity only — products, prices, subscription state, and one `plan_slug` reconciliation key (CLAUDE.md §1, `shared-entitlements` D1). The legacy `subscription_items.tier` read is a cached display value and must not become a gate.

Writing this down now matters because a usage meter is exactly the surface where someone reaches for "the tier name we already have on the row".

### D4 — `billing-overage` stays gated, because the toggle *is* the question

Question #4 asks whether locks are a capability statement or a price prompt. "Allow overage" is that question wearing a switch: if overage is a capability, it is a toggle the customer owns; if it is a price prompt, it is a purchase decision and a toggle is the wrong control entirely. Un-gating it before #4 would pick the answer silently — the exact failure CLAUDE.md §3.1 forbids.

### D5 — Re-check every lock's CTA in the same change

`D14`'s interim ruling: no gate ships pointing at the 12-line billing placeholder. Phase 1 changes what the Billing pane offers, so any existing capability lock whose "Upgrade" CTA lands there must be re-checked — including `ChatTab`'s `/settings/billing` upgrade link, which is a route that should be verified rather than assumed to resolve.

## Risks

- **Scope creep into a Usage page.** The strongest pressure on this change will be "we could just build a simple meter". A simple meter is a design decision about how limits are communicated, made by whoever writes the CSS, on the surface where getting it wrong reads as a billing threat. Hold the line; the plan's value is partly that it says no.
- **#4's answer is wider than Billing.** If the Pro+ gates were client-requested, `decision-no-tier-gating-default` falls and the gating *language* changes product-wide. Do not scope that fallout into this change when it arrives — re-file it.
- **Portal round trips are not locally verifiable** against a real Stripe account without test-mode keys. Phase 1's demo is therefore "the button posts and the portal URL comes back", not "the portal renders" — say so in `Caveats`.

## Migration

Phase 1 is three row definitions in one file. No migration, no route, no new dependency. Rollback is the same three definitions.
