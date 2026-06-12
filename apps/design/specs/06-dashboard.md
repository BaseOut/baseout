# 06 — Dashboard (`/`)

The session entry point. The first page users hit after sign-in and
the page they bounce off when they switch Spaces.

**Source:**
- `apps/web/src/views/DashboardView.astro` (the page body — edit
  here)
- `apps/web/src/components/backups/BackupHistoryWidget.astro` (the
  history table)
- `apps/web/src/views/ConnectAirtableModal.astro` (modal that opens
  from "Continue setup")

**Layout:** `SidebarLayout` — full app shell

**Live preview:**
- <http://localhost:4332/> — fully onboarded
- <http://localhost:4332/?fixture=empty> — onboarded but no
  connections yet (the "first dashboard" experience)
- <http://localhost:4332/?fixture=failed> — backup history shows
  one failed run
- <http://localhost:4332/?fixture=trial> — pre-onboarding (no Org,
  no Space)

---

## Purpose

Answer four questions at a glance, every time the user lands here:

1. **Where am I?** Org + Space context.
2. **What's the state of things?** Last backup, scheduled runs,
   system health.
3. **What should I do next?** (If anything.)
4. **Did the most recent runs work?**

PRD §6.2 calls out exactly this — backup status visible
immediately, run history one click away, storage summary, alerts /
action items prominent.

---

## User goal

Two distinct goals depending on who the user is:

**The newly-signed-up user** (empty Space): "How do I get this
working? Tell me the next step in plain English."

**The returning daily user**: "Did last night's backup run? Are
any of my bases in trouble? Anything I need to look at?"

The page should serve both — without compromising the second by
shouting at the first. The current layout does this by gating the
"Next Step" card (only visible when needed) and showing the backup
history below.

---

## What's on the page today (top to bottom)

### 1. Welcome header

- "Good morning, *FirstName*" (time-aware greeting)
- "You're signed in to *Org Name*." subhead

### 2. Three "status cards" in a row (collapse to stacked on mobile)

- **Organization** — Org name, big and truncated.
- **Active Space** — Space name + small status pill ("Active" or
  "Setup incomplete") with colored dot.
- **Next Step** — Either:
  - A primary "Continue setup" button with an icon and label that
    matches what the user needs (e.g., "Connect Airtable", "Choose
    bases to back up"), or
  - The text "You're all set." in a muted style when there is no
    next step.

The Next Step card is the conversion mechanic for partially-
onboarded users. The label is computed server-side by
`buildDashboardModel(account)` (in `apps/web/src/lib/dashboard.ts`)
and follows this priority: Connect Airtable → Pick bases → Choose
storage → Set schedule → run first backup → null.

### 3. Backup History widget (visible only when an Airtable
connection exists)

A condensed table of recent runs. See spec 08 — this is the same
widget used on `/backups`. Showing it on the Dashboard means daily
users don't have to click through to see "did it work last night?"

### 4. Two secondary cards (two-column on desktop, stacked on mobile)

- **System Status** — green dot + "All systems are operational. Last
  check 5 minutes ago." Plus a row of 20 status-cells showing
  hover-tooltip uptime. Currently placeholder visualization.
- **Quick Links** — Manage integrations / Space settings /
  Documentation. Currently three plain links with hover-translating
  arrows.

### 5. Hidden modal: ConnectAirtableModal

Opens when the user clicks "Continue setup" *and* their next step
is "Connect Airtable". Has two modes: pre-connect (start the OAuth
flow) and success (post-OAuth confirmation).

---

## States to design for

| State | Fixture | What's different |
|---|---|---|
| **Fully onboarded** | default | Next-Step card says "You're all set." Backup history populated |
| **Just signed up** | `?fixture=empty` | Next-Step card prominent, Backup History hidden |
| **Last run failed** | `?fixture=failed` | History widget shows a failed row prominently |
| **Connection broken** | (no fixture today) | Banner needed — currently surfaced on /integrations, could promote to Dashboard |
| **Pre-trial** | `?fixture=trial` | No Org / no Space — cards show "—" |

---

## Notes for the designer

### What's strong

- The Next-Step pattern. It's the single most important UX in the
  product — without it, partially-onboarded users get lost. Don't
  remove or soften it.
- Status cards as a row at the top. Mirrors expectations from
  Linear / Vercel / Stripe.
- Showing the backup history on the dashboard itself (not behind a
  click). Trust signal #1.

### What's weak (you have freedom)

- **System Status card.** The 20-cell hover-row is a stand-in for
  real uptime data. We don't have uptime data wired in yet. If
  you want to replace this with something more honest (e.g., "Last
  backup engine heartbeat: 2 min ago" + a single dot), do.
- **Quick Links card.** Generic. Could be repurposed for "Top
  alerts" (when alerts exist), "Recently changed bases", or
  removed entirely if the dashboard is too long on mobile.
- **Welcome greeting.** "Good morning, Reese" — fine but unstyled.
  Worth a moment of typography design.
- The cards' visual hierarchy is currently very flat — every card
  has the same outlined treatment. There's room to elevate the
  Next-Step card when it's actionable (subtle accent border,
  slightly more saturation on the button), and de-emphasize System
  Status when everything is green.

### What's load-bearing (don't break)

- The three top-row cards' identities (Org / Space / Next Step) and
  order. The user's eye learns this layout fast; reshuffling it
  forces a re-learn.
- The Next-Step button's `data-open-modal="connect-airtable-modal"`
  attribute. That's how the modal opens.
- The hidden behavior of the Next-Step card: when actionable, the
  Continue-setup button is visible; when no action needed, the
  "You're all set." text shows. Don't merge them into one always-
  visible card — that's how users learned to dismiss it.

---

## V1.5+ additions to plan for

These aren't built yet but the Dashboard will eventually host:

- **Health scores** — per-base grades (PRD §3.3 / Features §1 -
  "Health Score"). A row of base-health cards or a single composite
  health dial.
- **Recent schema changes** — "3 new fields added across 2 bases in
  the last 7 days" link → Schema page.
- **Active alerts** — "2 unread alerts: backup latency spike, schema
  drift on Base X." Today's `space_events` banner on Integrations is
  the precedent — promote relevant ones to Dashboard.

Don't design these screens in detail yet, but if you have a vision
for how the dashboard scales to host them, sketch the slot. The
hardest dashboards-at-scale problem is "everything fights for
top-of-page attention" — building the hierarchy with an empty slot
for future signals beats redesigning later.
