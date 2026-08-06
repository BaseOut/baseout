# Tasks — baseout-web-help-page-stub

≤ 20 minutes focused work.

## 1 — Page

- [ ] 1.1 Create [apps/web/src/pages/help.astro](../../../apps/web/src/pages/help.astro):
  - Wraps in `SidebarLayout` with `pageTitle="Help"` and breadcrumbs from `getBreadcrumbs('/help')`.
  - Single `Card variant="outlined"` with:
    - Heading: "Help & Support".
    - Body copy explaining that in-app chat is coming and pointing users to email in the meantime.
    - `btn btn-primary` anchor with `href={mailtoUrl}` where `mailtoUrl = mailto:<owner.email>?subject=Baseout%20%E2%80%94%20Help%20request`.
    - Visible plain-text rendering of the email address beside the button (for users without a configured mail client).
- [ ] 1.2 Use `getOwner()` from `../lib/config` for the contact email — keeps a single source-of-truth.

## 2 — Verification

- [ ] 2.1 `pnpm --filter @baseout/web typecheck` — 0 errors.
- [ ] 2.2 `pnpm --filter @baseout/web build` — clean.
- [ ] 2.3 No `console.*` or `debugger` in the diff (CLAUDE.md §3.5).
- [ ] 2.4 Manual smoke test: load `/help` in dev, button → mail client opens.

## Out of scope

- Modal/widget version — deferred.
- Real chatbot — V2.
- Sidebar.astro modifications — none. Existing `/help` link continues to work; only the destination page changes.
- Server-side ticket creation — depends on future ticketing infra (`baseout-web-mailgun` or similar).
