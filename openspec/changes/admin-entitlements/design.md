# admin-entitlements — design

## Context

Builds directly on two substrates: `shared-entitlements` (tables: plans, plan_prices, feature_groups, features, plan_features, account_feature_overrides, addon_purchases, usage_rollups, usage_notification_state, legacy_customers; the shared resolution lib) and `admin-crm-ux` (command-center page structure, actions-on-detail-pages rule, table infrastructure, audit machinery from `shared-admin-actions`). Admin owns no migrations; it mirrors tables read-only and mutates through its own audited action routes.

## Goals / Non-Goals

**Goals:** staff can do everything the entitlement model assumes humans do — edit the catalog, grant exceptions, enter Enterprise contracts, work the legacy registry — with audit and guardrails proportional to blast radius.

**Non-Goals:** customer-facing surfaces (web), the entitlement schema itself, notification content, Stripe product/price creation (the setup script owns that; admin *views* Stripe linkage, links existing prices, but does not call Stripe APIs in v1).

## Decisions

- **D1 — Writes go through admin action routes, not direct table edits.** Every mutation (plan value, override, contract, redemption) is an admin action: validation against the feature's type/enum ranks, audit row, and the existing confirm flow. Catalog edits get **blast-radius confirmation** — "this changes included records for 214 active subscribers" — computed live before commit.
- **D2 — The plan_features matrix edits cell-by-cell, renders as the pricing guide.** The editor is the guide's §3 table shape (features grouped, plans as columns); each cell opens a type-aware editor. No bulk CSV import in v1 (the seed migration covers initial state).
- **D3 — The contract editor is a façade over overrides.** One form listing every feature with the enterprise-baseline value prefilled; staff set contracted values; submit diffs against existing overrides and writes only changes (add/update/expire), stamping each override's reason with the contract reference. Amendment = same form, pre-filled with current effective values. There is deliberately no separate contracts table — the override set *is* the contract record (D10 of shared-entitlements), with the audit trail as history.
- **D4 — Entitlement view on the command center is resolution-transparent.** Per feature: plan value → override (if any, with reason/actor/expiry) → add-on contribution → effective value, plus current usage and notification state. Staff see *why* a number is what it is — the support question this exists to answer.
- **D5 — Legacy manual linking requires an existing verified match target.** Manual redemption links a registry row to an Organization by explicit staff action (typed org selection + confirm), applies the canonical coupon via the same code path as self-serve redemption, and never edits a redeemed row. Adding a row by hand requires email + legacy plan; mapped tier derives from the locked mapping.

## Risks / Trade-offs

- **[Catalog edit mistakes have wide blast radius]** → blast-radius confirmations, audit with before/after, and values are instantly re-editable (propagation is a read-time join — no backfill to unwind).
- **[Contract-as-overrides has no single contract document]** → override reasons carry the contract reference; if a real contracts artifact is needed later, it layers on without schema change. Accepted per D10.
- **[Admin needs write access to entitlement tables]** → scoped through action routes with the existing role gate + audit; no generic SQL surface.

## Migration Plan

Implement after `shared-entitlements` phases 1–2 land (schema + resolution). Nav/pages are additive; no data migration. Rollback = remove pages.

## Open Questions

- None blocking. (Stripe price *creation* from admin is explicitly deferred; revisit if catalog edits outpace the setup script.)
