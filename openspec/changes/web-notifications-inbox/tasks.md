## 1. App shell

- [x] 1.1 Remove the bell from `Header.astro`; make the top bar `lg:hidden` (mobile keeps the hamburger, the only route to the off-canvas sidebar).
- [x] 1.2 Add the `Inbox` trigger to `Sidebar.astro`, above the Space groups, with a badge counting rows that need a decision (`9+` cap, hidden at zero).
- [x] 1.3 Mount the panel inside the work-area column so it overlays rather than pushes; keep it non-modal (no scrim, no focus trap, no `role="dialog"`); fullscreen under 1024px.
- [ ] 1.4 **Blocked** — lift the page `<h1>` into `SidebarLayout` (the client's "bell on the same level as the page title"). `pageTitle` / `breadcrumbs` / `$pageHeader` are already wired and rendered by nothing. Touches ~20 views incl. `SchemaView.astro`, which is owned by another branch. Do after the Schema branch merges.

## 2. Panel structure

- [x] 2.1 Two tabs — `Needs attention` (`lucide--list-todo`) and `Activity` (`lucide--bell`) — attention active by default; drop the "Inbox" heading (keep it `sr-only`).
- [x] 2.2 Per-tab count badges that stay visible on the inactive tab; attention = red (must fix), activity = neutral (unread).
- [x] 2.3 Per-tab zero-states, so an empty lane never claims the whole inbox is clear.
- [x] 2.4 Row anatomy: icon chip, `*emphasis*` copy, optional detail line, right-aligned stamp + unread dot, inline action where the user can resolve it.

## 3. Volume control

- [x] 3.1 Roll up successful backups and non-breaking schema changes per base, expandable; never roll up failures, breaking changes or reconnect.
- [x] 3.2 `All | New` filter in Activity only, defaulting to `All`, unable to hide an attention row.
- [x] 3.3 `Mark all read` touches Activity only.
- [x] 3.4 "No new activity" when the filter empties a lane that has rows.
- [ ] 3.5 Per-base subscription level (`All runs / Failures only / Off`) — currently `Mute` is all-or-nothing.
- [ ] 3.6 Debounce the health-score signal so a flapping score cannot spam the lane.

## 4. Triage + state

- [x] 4.1 Attention rows: `Mark done` + `Snooze`. Activity rows: `Mute this base` only.
- [x] 4.2 `Show handled` in `Needs attention`; handled rows stay in their own lane, with a `Move back` control.
- [x] 4.3 `Undo` in the toast for done / snooze / mute; faked actions announce that nothing persisted.
- [x] 4.4 Self-healing: state-backed rows resolve silently, drop out of the count, and offer no `Undo` and no `Mark done`.
- [ ] 4.5 Wire self-healing to real connection state (`$integrations`) instead of the `inbox:resolve` event used by the fixture.
- [ ] 4.6 Snooze resurfaces early on new activity (Linear's model); currently a fixed 1 day with no wake-up.

## 5. Integration

> **Imported 2026-07-10 from ui-only@3153dfd** (renamed `notifications-inbox` →
> `web-notifications-inbox` per the §3.6 prefix convention). Tasks 5.1–5.3 are
> **blocked on a notifications backend** — filed as the paired
> `server-notifications-inbox` change (engine-brokered alert feed). The web
> promotion mounts the Inbox UI with an empty feed + the designed zero-states
> ("soon"-gated actions) so wiring the backend later swaps the data source only.

- [ ] 5.1 Bind the panel to engine-brokered alerts instead of `apps/design/src/fixtures/inbox.ts`. **(blocked: server-notifications-inbox)**
- [ ] 5.2 Clear the connection-health banner when the reconnect alert resolves (both are currently independent).
- [ ] 5.3 Notification settings page — channels (in-app / email / digest) and granularity (Space / base / watched entity). The gear links to `/settings` today.
- [ ] 5.4 Keyboard triage (`J`/`K`, `U`, `E`) and a shortcut to focus the panel.

## 6. Documentation

- [x] 6.1 `pattern-inbox` entry in `apps/design/src/lib/storybook.ts`, including the two-axes rule, the counts-not-dots rule, and the overlay-not-push rule with its measurements.
- [x] 6.2 Research report at `research/notifications-inbox/index.html` + screenshots in `shots/`.
