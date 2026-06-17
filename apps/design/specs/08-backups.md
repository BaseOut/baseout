# 08 — Backups (`/backups`)

> **Superseded (2026-06-16).** The accordion `BackupHistoryWidget` model
> below has been replaced by a three-level drill-down — a run-history
> **table** (`/backups`) → a per-run **detail page** (`/backups/run`) → a
> per-base **table-level page** (`/backups/run/base`). The authoritative
> spec is `openspec/changes/backups-redesign/`. This doc is kept for the
> original intent, the data-model notes, and the "what's load-bearing"
> list; treat the accordion/polling sections as historical.

The page where users see what's happened, what's happening, and
fire off a one-off run. The Backup History Widget is the heart of
this page (and also appears on Dashboard and Integrations).

**Source:**
- `apps/web/src/components/backups/BackupHistoryWidget.astro`
- `apps/web/src/components/backups/RunBackupButton.astro`
- `apps/design/src/pages/backups.astro` — composes both into the page

**Layout:** `SidebarLayout`

**Live preview:**
- <http://localhost:4332/backups> — full history (8 runs, every
  status)
- <http://localhost:4332/backups?fixture=empty> — no runs yet
- <http://localhost:4332/backups?fixture=failed> — single failed run

---

## Purpose

Auditable log of every backup the system has ever attempted for
this Space. Plus the "run one right now" button.

PRD §2.10 calls out "Backup Auditing" as a core capability — users
need to be able to prove backups ran (for compliance, for their own
peace of mind, for support tickets).

---

## User goal

> "Show me every run. Let me dig into any one. Let me start a new
> one. Let me cancel or delete a problem run."

---

## What's on the page (top to bottom)

### 1. Page header

- "Backups" title
- Possible subtitle / description (currently minimal; designer can
  flesh out)

### 2. Run Backup Button

A primary "Run backup now" CTA. Same component as on Integrations.
States:

- **Default** — primary button, "Run backup now"
- **Disabled** — when connection is broken; tooltip explains why
- **Loading** — spinner while the request is in flight
- **Just-fired** — dispatches a `backup-run-started` CustomEvent
  that the history widget catches, so the new run appears
  immediately (no wait for poll)

### 3. Backup History Widget

The main attraction.

**Layout:** vertical list of accordion rows, one per Backup Run.

**Header bar:** "Backup history" + tiny "last N" count.

**Each row (collapsed):**

- Status badge — color + label per run status (see spec 01:
  Queued / Running / Succeeded / Failed / Cancelled / Trial)
- Timestamp — human-readable start time (or "queued <time>" if not
  started yet)
- Duration — humanized (e.g., "2m 14s", "1h 3m")
- One-line counts — "12 bases · 1,847 records · 23 attachments"
- Health badge — Healthy / Warning / Failure (smaller than status,
  represents post-run audit grade, not whether the run completed)
- Right edge: caret indicating expandable
- Tap/click row → accordion expands

**Each row (expanded):**

- Per-run detail panel:
  - **Health** badge + grade explanation
  - **Trigger** — Manual / Scheduled / Webhook (instant) / Trial
  - **Connection** — Airtable user / connection state at run time
  - **Destination** — storage type + mode (e.g., "google_drive · static")
  - **Full counts** — by base / table / record / attachment
  - **Timestamps** — created, started, completed (each humanized
    and with absolute on hover)
  - **Bases selected at run time** — list of base names (may
    differ from current selection if the user has since changed it)
  - **Error callout** — full error message + stack-trace-ish detail
    if the run failed
  - **Support IDs** — Run ID, Trigger Run IDs (for the engineer
    when the user files a support ticket; copyable)
  - **Actions** — Cancel button (for running runs), Delete button
    (for completed/failed runs)

### 4. Polling behavior

- The widget polls `GET /api/spaces/:spaceId/backup-runs` every 10
  seconds while any run is non-terminal.
- It *upserts* rows rather than replacing the whole list — so
  expanded accordions stay expanded, scroll position stays put.
- Polling stops on its own once every run is terminal.

### 5. Empty state

When `runs.length === 0`:

- "No Backup Runs yet. Click *Run backup now* to start one."

---

## States to design for

Use `?fixture=` to see each:

| Fixture | What | Why interesting |
|---|---|---|
| default | 8 runs covering every status | Visual variety, dense list |
| `?fixture=failed` | 1 failed run | The "something went wrong" moment — the row that demands attention |
| `?fixture=empty` | 0 runs | Empty state design opportunity |

Within the default fixture, click into individual rows to see the
expanded detail panel.

---

## Notes for designer

### What's strong

- The accordion pattern lets the user scan first, dig second.
- Status badge + health badge separation is meaningful: a run can
  complete successfully but have warnings (e.g., a few records
  failed to import, or schema drift detected).
- Optimistic surfacing of just-fired runs (via CustomEvent) — the
  user gets immediate feedback without polling lag.

### What's weak (you have freedom)

- **The collapsed-row layout is a bit cramped.** Five chunks of
  information (status, time, duration, counts, health) compete for
  the row. Worth a designer's eye on hierarchy — could the counts
  collapse to a hover-tooltip, with just one summary line visible?
- **The expanded panel is structured but unstyled** — a wall of
  label/value pairs. A two-column key-value grid with section
  headers (Run / Connection / Destination / Counts / Audit) would
  parse much faster.
- **Status color usage.** Currently relies on daisyUI's badge
  variants. The "Failed" red is necessarily loud; if half a screen
  of rows are "Failed" (unlikely but possible during an incident),
  the page reads as alarming. Consider a calmer treatment for
  Failed when there are many.
- **The empty state is plain text.** A simple illustration (no
  mascots — just a clean line-art "no archive" icon and one
  sentence) could warm it up without violating principle #1
  (functional over decorative). Stay restrained.

### What's load-bearing (don't break)

- The `data-backup-history`, `data-run-id`, `data-backup-history-list`,
  `data-backup-history-empty` attribute hooks — the polling
  upsert logic finds rows by these.
- The native `<details>` element for accordions. The "open state
  survives polling" trick depends on the browser, not on us
  managing open/closed state in JS. Don't replace `<details>` with
  a custom div — you'd break the persistence.
- The `backup-run-started` CustomEvent contract between
  RunBackupButton and the history widget.
- The cancel/delete button visibility logic (`isCancellable`,
  `isDeletable` helpers in `lib/backups/`) — only certain states
  allow these actions, and the buttons should hide when not
  applicable.

---

## Page-level layout questions

The current `/backups` page is just "header + Run button + History
widget" — pretty thin. The history widget is the meat. Some open
questions if you want to flesh it out:

1. **Filtering** — by status (Failed only), by base, by date range.
   Not yet implemented; could land as filter chips above the list.
2. **Search** — by run ID, by error message. Useful when a user
   comes from a support ticket with a specific Run ID.
3. **Pagination / load more** — currently the widget shows "last N"
   (typically last 25 or so). Past-N runs aren't reachable from
   UI. Could be a "Load more" link or proper pagination.
4. **Side rail with summary stats** — total runs this month,
   success rate, average duration. Compliance-friendly.

Not in scope to build all of those; sketch what you think makes the
page feel complete, and flag the rest as follow-up.

---

## Restore is a separate page

Don't add Restore controls here. A failed run has Cancel/Delete
inline; the *Restore from this snapshot* affordance lives on the
Restore page (spec 09) where the user can pick a snapshot
deliberately.
