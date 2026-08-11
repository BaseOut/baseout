## Why

Baseout's only promise is "your data is safe and your backups are running". Today nothing in the app tells you when that stops being true: the top-bar bell (`Header.astro`) rendered a `lucide--bell` with an unread dot and **opened nothing**, and every operational signal — a failed backup, a broken Airtable connection, a breaking schema change — was silent.

Research (`research/notifications-inbox/index.html`) found that **no direct competitor ships an in-app notification centre**: Fivetran, Airbyte and ProBackup all push to email/Slack/webhook and reserve the dashboard for diagnosable errors. Airtable's own bell is social (someone shared a base, @mentioned you), not operational. So this surface is a differentiator, and its interaction model has to be borrowed from productivity tools (Notion, Linear, GitHub) rather than from the backup category.

The client (Slack) asked for "an INBOX item like Linear in the main navbar", and separately asked what the near-empty top section bar is for. Note the naming trap: **Linear's inbox is a full-page master–detail route**, not a panel. The pattern actually wanted is **Notion's**: a nav item that opens a column beside the page.

## What Changes

- **Delete the top-bar bell.** `Header.astro` becomes **mobile-only** (`lg:hidden`); it now holds only the hamburger, which is the sole way to reach the off-canvas sidebar under 1024px.
- **Add an `Inbox` item at the top of the sidebar**, above the Space groups (it is account-scoped, not Space-scoped), carrying a badge that counts rows **needing a decision** — not unread rows.
- **Add the Inbox panel**: a non-modal, single-column side panel that **overlays** the work area from its left edge.
- **Two tabs**: `Needs attention` (task icon) and `Activity` (bell icon), each with its own count badge, **both visible on the inactive tab**.
- **Roll up** successful backups and non-breaking schema changes per base; failures, breaking changes and reconnect never roll up.
- **Self-healing**: state-backed rows (reconnect, health) resolve themselves when the underlying state clears, silently.
- **Triage**: read/unread, Done, Snooze, Mute-this-base, with Undo.
- Every row **deep-links** to the surface where the user can act. There is no in-panel reading pane and no `/inbox` page.

## Capabilities

### New Capabilities
- `notifications-inbox`: the Inbox panel — sidebar entry + count, two tabs with persistent counts, per-base rollups, self-healing state-backed alerts, triage (read/done/snooze/mute + undo), and the toast / inbox / banner routing rules.

### Modified Capabilities
<!-- `Header.astro` loses the bell and becomes mobile-only. `Sidebar.astro` gains the Inbox trigger.
     The existing connection-health banner keeps its role but a broken connection now ALSO appears as
     an Inbox row, and resolving the reconnect clears both. -->

## Impact

- **Surface**: a new app-shell panel (every `SidebarLayout` page), a new sidebar item, and a reduced top bar.
- **Reads** (engine, no DB detail): a list of alerts with kind, base, timestamp, read/done/snooze state, deep-link target, and — for state-backed kinds — the live state they are bound to.
- **Writes**: read/unread, done, snooze-until, per-base subscription level.
- **Reuses**: the `alert`/`badge`/`tabs`/`toast` primitives, Lucide icons, the connection-health banner's `*emphasis*` copy convention, and the non-modal stance of the multi-panel drawer.
- **Not covered here**: the notification **settings** page (what you're notified about, in-app vs email vs digest) — the gear links to `/settings` and the granularity model is still open. Email/digest delivery is out of scope.
