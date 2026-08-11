## Context

The Inbox is the single home for every operational signal in Baseout: backup finished/failed, schema changed (with breaking flags), health score dropped, a connection needs reconnecting, an automation turned off, an interface unpublished, a chat answer saved as a doc.

Designer-facing repo: the panel is driven by a fixture (`apps/design/src/fixtures/inbox.ts`), triage mutates client state only, and every faked action announces its result rather than implying persistence. Research and the measured evidence behind the decisions below live in `research/notifications-inbox/index.html`.

## Goals / Non-Goals

**Goals**
- One place that answers "is it working, and what needs me?"
- Never sell silence as safety: no filter, tab, or bulk action may hide an unresolved problem.
- Survive volume: a nightly backup per base must not bury the one row that matters.
- Never show a stale alert for a problem that has already been fixed.

**Non-Goals**
- The notification **settings** page (channels, digests, granularity).
- Email / Slack / webhook delivery.
- A full-page inbox or archive route.

## Decisions

### 1. Two perpendicular axes, and only one of them may be filtered

The panel carries two independent axes:

- **"Have I seen it"** — `read` / `unread`. A memory axis, about the user.
- **"Is it closed"** — `needs attention` / `handled`. A state axis, about the world.

Slack has only the first, which is why its global *Unreads* toggle is safe. We have both, and **a read row is not a resolved row**. Therefore:

- The `All | New` filter lives **only** in Activity, and is pinned there by the CSS selector, not by convention.
- `Mark all read` touches **Activity only**. Otherwise the two-click sequence `Mark all read → New` — both muscle-memory from Slack — empties the panel while backups are stopped.
- The `Needs attention` tab count is rendered **on the inactive tab**. This is the condition under which tabs are permitted at all; the `Tabs` storybook entry already forbids hiding critical actions behind a non-default tab.

### 2. Triage belongs to `Needs attention`; Activity rows are facts

You resolve a broken connection. You do not "finish" the news that a backup ran. So:

- Attention rows get `Done` + `Snooze`. Activity rows get `Mute this base` and nothing else — offering `Done` on "backup completed" invents a state the row never had.
- `Show handled` lives in `Needs attention`, and a handled or self-resolved row **stays in its own lane**. Demoting a resolved reconnect into Activity files a connection matter as news.
- `Show handled` doubles as the Undo for a mis-clicked `Done`; without it the row is gone until reload.

### 3. Self-healing, and silence on recovery

State-backed rows (reconnect, health) are bound to live state rather than describing a past event. When that state clears, the row **resolves itself**: struck through, quiet `Resolved` label, moved behind `Show handled`. **No "it's fixed!" row is minted** — the reward is the alert going away.

This is the Datadog→PagerDuty model (a recovering monitor auto-resolves the incident; PagerDuty deliberately does not notify on recovery). It is a **cross-domain transfer** — no backup tool was observed doing this in an in-app inbox — but a stale "reconnect!" after the user already reconnected is exactly the trust-eroding bug this product cannot afford.

Event rows (a failed backup) are **acknowledge-based**: a later success does not un-happen a failure, so only the user clears them. A self-resolved row therefore has **no Undo** — restoring it would assert the connection is broken again.

### 4. Rollups: successes collapse, failures never

Successful backups and non-breaking schema changes roll up **per base** ("*Marketing Ops* — 3 backups completed", expandable). Failures, breaking schema changes and reconnect are always standalone. Grouping is by entity, not globally, so the rollup stays meaningful. Batch-on-read (collapse at render) is the implementation.

Expected states are silent by default — Airbyte defaults "queued syncs" to off for the same reason.

### 5. Overlay, not push — measured, not assumed

The panel **overlays** the work area from its left edge (`position: absolute` inside the right column).

Push was the original design and was wrong. Sidebar (256px) + panel (352px) = **608px of chrome**, so a ~970px data table only breathed above a ~1580px viewport. Measured on `/backups`:

| Viewport | Pushing panel | Overlay panel |
|---|---|---|
| 1280px | **339px of the table hidden** behind a horizontal scroll | 0px hidden |
| 1440px | work area 1169px → 817px (table needs 906px) | unchanged |

Overlay leaves the page's own layout untouched at every width. Under 1024px the panel goes fullscreen.

**It stays non-modal**: no scrim, no focus trap, no `role="dialog"`. Overlay means "the panel sits on top", not "the page behind is frozen" — the page remains interactive wherever it is still visible. (incident.io dims its notification panel; we deliberately do not.)

### 6. The deep-link IS the detail view

A row navigates to the surface where the user can **act** — the run's log, the schema diff, the reconnect flow. There is no in-panel reading pane: it would restate that surface, worse, and give the same information two homes.

### 7. Counts, not dots

Both tabs carry a numeric badge (capped at `9+`). `Needs attention` counts what you must **fix** (red); `Activity` counts what you have not **read** (neutral). No researched product used a bare dot where a count was available — "something broke" and "three things broke" are different decisions.

## Surface routing — toast vs inbox vs banner

Baseout has three places a signal can land. The split is mechanical: **if a notification carries a decision it cannot be a toast**, because a toast is a passive live region that auto-dismisses (Carbon; ARIA live-region guidance).

| Signal | Toast | Inbox | Connection banner |
|---|---|---|---|
| Backup finished OK | only if user triggered it | Activity, rolled up | no |
| Backup failed | only if on the triggering page | Needs attention | no |
| Connection needs reconnect | no | Needs attention | **yes — primary** |
| Schema changed (breaking) | no | Needs attention | no |
| Schema changed (non-breaking) | no | Activity, rolled up | no |
| Health score dropped | no | Needs attention past a threshold, else Activity | no |
| Automation off / interface unpublished | no | Activity | no |
| Chat answer saved as a doc | yes | optional Activity | no |
| Setting saved · export run | yes | no | no |

The banner means exactly one thing: **a broken connection that undermines "is it working right now"**. Let health dips or schema drift into it and it stops meaning "act now".

## Rejected alternatives

- **Full-page inbox (Linear / a `/inbox` route).** Built, reviewed, cut. It duplicated `Show handled` and added nothing — no search, no type/base filters, no date grouping. Our alert volume (tens per week) does not earn a second surface; incident.io ships a separate Alerts page because it has hundreds.
- **Expand-to-two-pane reading view.** Built, reviewed, cut. See decision 6.
- **A global `Unread` toggle (Slack).** See decision 1.
- **Push instead of overlay.** See decision 5.
- **A user preference for push vs overlay.** A preference nobody discovers does not fix the default, and the default was broken on every ordinary laptop. One predictable behaviour beats a clever one.

## Accessibility

- The panel is **not** a dialog: no focus trap, no focus steal on open, `Esc` closes and returns focus to the trigger.
- Arrivals announce through a **polite** live region; reserve assertive for a failed backup or a broken connection.
- Row triage is hover-revealed but reachable via `:focus-within`; every icon control carries an `sr-only` label and a daisyUI tooltip (never a native `title=`).

## Open questions

1. **Notification settings**: channels (in-app / email / digest), granularity (Space / base / watched entity), and whether one "watch" toggle replaces the per-tab subscriber lists. The gear currently links to `/settings`.
2. **Thresholds**: how many successes before a rollup, and the health-score debounce window. No citable number — tune with the client.
3. **Snooze duration**: fixed at 1 day; Linear offers a picker and auto-un-snoozes on new activity.
4. **Mute granularity**: currently per base, all-or-nothing. A `All runs / Failures only / Off` level is the proposed flood valve.
