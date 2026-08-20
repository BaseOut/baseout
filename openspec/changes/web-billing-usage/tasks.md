## Status

Phase 1 **DONE** 2026-08-20 on `autumn/cursor-ui-implementation-test`. Phases 2–4 remain for usage meters / plan checkout when `shared-entitlements` + a real Usage design land — build from `pricing-guide` / honest placeholders; do not wait on client #4 for portal rows (already shipped).

---

## 1. Unblocked — the three rows that need no answer (one file)

- [x] 1.1 `views/settingsCatalog.ts` — `billing-email`: gated text row → `control: 'button'`, `action: 'billing-portal'`, copy naming Stripe as the owner. Nobody intends to build an in-app billing-email editor; the gate was inventing a gap (design D1).
- [x] 1.2 Same file — `billing-invoices`: note → `action: 'billing-portal'`. Replaces the "open it from Payment method above" navigation puzzle with the button that does it.
- [x] 1.3 Same file — `billing-plan`: portal button + note naming Stripe as the place plan changes happen.
- [x] 1.4 **No new control type and no new client code** — all three reuse the `data-set-portal` handler `settingsControls` already ships (design D2). Verify `setButtonLoading` + revert-on-error still apply to the new rows.
- [x] 1.5 Update `views/settingsCatalog.test.ts` for the changed row shapes (the catalog test asserts them).

Also: `billing-overage` toggle replaced with read-only limit-behaviour fact (warn @ 90% / enforce @ 100% per `pricing-guide`).

## 2. ⛔ BLOCKED on #4 — send the question first

- [ ] 2.1 Send client question #4 (and, per proposal open question 3, #2 in the same message — it leaks into Billing through the `Per org · admin` scope labels). Assembled in [`apps/design/audit/CLIENT-QUESTIONS-PENDING.md`](../../../apps/design/audit/CLIENT-QUESTIONS-PENDING.md). **Not a design question — do not phrase it as one.**
- [ ] 2.2 On answer: if the Pro+ gates were client-requested, `D14` is superseded and `decision-no-tier-gating-default` falls with it. That changes gating language **product-wide**, not just here — **re-file it as its own change**, do not absorb it (design Risks).
- [ ] 2.3 Request the fork design for `S33` once #4 is answered. Promotion, not invention.

## 3. ⛔ BLOCKED — the usage surface (needs #4 + a design + `shared-entitlements`)

- [ ] 3.1 Settings ▸ Usage page: every metered lever with limit / used / percent / reset date, grouped as `research/pricing/pricing-guide.md` groups them; per-Space breakdown for Space-attributed meters (records, file storage, database size, bases).
- [ ] 3.2 The `ok / warned (90%) / at-limit / enforced` visual language — one treatment everywhere, the recurring-but-dismissable banner, and an enforcement notice naming the limit and offering the matching add-on or upgrade (mirroring the email already sent).
- [ ] 3.3 Space Home's utilization block goes real (today: `usage=[]`, section hidden — already correct behaviour, so **no change until meters exist**).
- [ ] 3.4 **Every meter, limit and lock resolves through `resolveEntitlements(orgId)`** over the DB-native `plan_features` catalog — never Stripe product metadata, never a product-name string, never the cached `subscription_items.tier` display value (CLAUDE.md §1, design D3).
- [ ] 3.5 `billing-overage` — stays gated until #4, because the toggle *is* the question: a capability is a switch the customer owns, a price prompt is a purchase and a toggle is the wrong control (design D4).

## 4. ⛔ BLOCKED — plans, checkout, add-ons, legacy offer

- [ ] 4.1 Plan cards per the locked pricing-page spec; monthly/annual toggle; checkout via Stripe Elements; confirmation. Trial-to-paid entry points including from the deletion-clock warnings.
- [ ] 4.2 Plan change with **proration preview from Stripe** (never computed locally — design/Security), plus the downgrade over-limit warning naming the specific meters.
- [ ] 4.3 Add-on library + purchase/cancel, with quantity shown on the Usage rows they extend.
- [ ] 4.4 On2Air legacy migration offer: matched-customer state, 20%-for-life, at-or-above tier rule (lower tiers render without the discount).

## 5. Verification

- [ ] 5.1 Phase 1 demo: Settings ▸ Billing → all three rows open the Stripe portal; spinner shows and clears; a failed POST reverts rather than hanging. **`Caveats` must record that the portal itself is not locally verifiable without test-mode keys** (design Risks) — do not claim the portal rendered if it did not.
- [ ] 5.2 `pnpm --filter @baseout/web test:unit` (targeted: `settingsCatalog`) + `typecheck` + `audit:components` exit 0 + `build` green.
- [ ] 5.3 **`D14` re-check**: after Phase 1, walk every existing capability lock's CTA and confirm none lands on a dead end — including `ChatTab`'s `/settings/billing` upgrade link, which should be **verified to resolve**, not assumed (design D5).
- [ ] 5.4 No stray `console.*` / `debugger` (§3.5).
