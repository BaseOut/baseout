# admin-entitlements — tasks

Depends on `shared-entitlements` phases 1–2 (schema + resolution lib) and `admin-crm-ux` (command center, listing infra, action machinery). TDD per house rules; all mutations through audited admin action routes.

## 1. Foundations

- [ ] 1.1 Schema mirrors in `apps/admin` for the entitlement tables (header-comment canonical source; no `*_enc` anywhere in these tables); resolution lib consumption wired
- [ ] 1.2 Nav: Billing/Catalog group (Plans, Features, Legacy registry) added to the grouped sidebar

## 2. Catalog CRUD

- [ ] 2.1 Plans + prices pages: list/detail, status transitions, Stripe linkage display; audited action routes + tests
- [ ] 2.2 Feature groups + features pages: CRUD with type/enum-rank definitions; audited; tests
- [ ] 2.3 plan_features matrix editor (pricing-guide shape): type-aware cell editors, enum rank selects; tests on the pure validation
- [ ] 2.4 Blast-radius confirmation: live affected-subscriber counts on plan-value edits, plan deactivation, feature removal; tests

## 3. Overrides + Enterprise contracts

- [ ] 3.1 Command-center entitlements section: resolution-transparent per-feature view (plan → override → add-ons → effective + usage + state); tests on assembly
- [ ] 3.2 Override actions (create/edit/expire): typed validation, required reason, expiry, audit; tests
- [ ] 3.3 Contract editor: baseline-prefilled full-feature form, diff-only writes, contract-reference stamping, amendment flow; exhaustive diff tests

## 4. Legacy registry + staff usage view

- [ ] 4.1 Registry browser page on the standard listing infra (search/filter/pagination); tests
- [ ] 4.2 Manual link action (org select + confirm → shared redemption path → coupon + redeemed mark) and manual row entry (mapped tier derived); tests
- [ ] 4.3 Per-org usage panel on the command center (same endpoint data as customer Usage page + enforcement/notification state)

## 5. Verification

- [ ] 5.1 End-to-end: edit a plan value → non-overridden org resolves it, overridden org doesn't; enter an Enterprise contract → effective values match the form; link a legacy row → coupon applied once
- [ ] 5.2 Typecheck, build, admin test suite green; audit-trail assertions for every mutation surface
