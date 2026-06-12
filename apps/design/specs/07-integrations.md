# 07 — Integrations (`/integrations`)

The configuration hub. The single page that takes a user from
"empty Space" to "actively backing up Airtable on a schedule, to my
preferred storage destination." Densest page in the product.

**Source:**
- `apps/web/src/views/IntegrationsView.astro` (the page body)
- `apps/web/src/components/backups/{FrequencyPicker,StoragePicker,
  RunBackupButton,BackupHistoryWidget}.astro`

**Layout:** `SidebarLayout`

**Live preview:**
- <http://localhost:4332/integrations> — fully wired up
- <http://localhost:4332/integrations?fixture=empty> — pre-connect

---

## Purpose

Make every meaningful backup decision the user needs to make,
visible on one page, in the order they need to make them:

1. Connect a platform (Airtable in V1).
2. Pick which Bases to back up.
3. Pick a schedule.
4. Pick a storage destination.
5. Trigger a backup right now if you want.

This is also the page they'll come back to when something changes —
new bases appeared in Airtable, they want to swap storage, the
connection broke.

---

## User goal

Two passes:

**First-time user**: "Walk me through getting Airtable connected
and running my first backup."

**Returning user**: "I need to change one thing — add a base,
change the schedule, swap to Dropbox — and get out."

---

## What's on the page (top to bottom)

### 1. Header

- "Integrations"
- "Connect a data platform to begin backing up your content."

### 2. Status alerts (only when applicable)

- **Success alert** when arriving from a fresh OAuth: "Airtable
  connected. We found N bases."
- **Error alert** when arriving from a failed OAuth: friendly
  mapped error message (the `errorLabels` map in the view file has
  all the wording).

### 3. Workspace rediscovery banner (only when applicable)

When the engine has discovered new Airtable bases the user hasn't
seen yet, an `info` banner appears with one card per discovery
event:

- "N new bases discovered in your Airtable workspace."
- Sub-detail: "M auto-added to your backups" and/or "P not included —
  you're at your tier limit of Q. Upgrade to include them."
- "Dismiss" button per card.

Multiple discovery events stack as multiple cards.

### 4. Platform cards grid

Two-column grid on desktop, single-column on mobile. **One card per
platform.**

- **Airtable** card — the primary, fully-functional one (detailed
  below).
- **Notion, HubSpot, Salesforce** cards — opacity 60%, "Coming soon"
  badge. These exist purely to signal "we're platform-agnostic"
  (PRD §6.0 principle #5). Designer can change these visuals as
  long as they make "coming soon" obvious without screaming.

### 5. Airtable card (the core surface)

The card morphs significantly based on connection state.

#### State A: No connection (fixture=empty)

- Card title "Airtable" + tagline
- "Not connected" badge (default/neutral)
- "Connect Airtable" primary button + caption "You'll be
  redirected to Airtable to approve access."

#### State B: Connection in `pending_reauth` / `invalid`

- Status badge: amber "Reconnect required" or red "Disconnected"
- A loud inline alert above the connection details:
  "This Airtable connection is no longer active. Reconnect to resume
  backups for this Space." + "Reconnect Airtable" primary button
- Then the details (Airtable user id, plan, bases discovered) —
  still readable, just stale

#### State C: Connection `active`

- Status badge: green "Connected" with live dot
- A small details list:
  - **Airtable user** — monospace user id
  - **Plan** — "Enterprise" badge if applicable
  - **Bases discovered** — count
- A ghost "Reconnect Airtable" button as escape hatch + tiny help
  text "Refreshes tokens. Use if backups fail with an auth error."
- A "Rescan workspace" button + an "Auto-add new bases" toggle —
  the user controls how new bases in Airtable flow into Baseout
- The **Bases-to-back-up list** (described below)
- The **Frequency picker** (described below)
- The **Next backup** small caption
- The **Storage picker** (described below)
- The **Run backup now** button

### 6. Bases to back up

Below the connection details when bases > 0:

- Section header "Bases to back up" + right-aligned counter
  ("8 selected" or "8 of 12 allowed" when tier-limited)
- List of bases (one row each): checkbox, base name (truncated),
  monospace base ID
- Tier-cap protection: real-time check on every change shows an
  inline error if the user selects too many ("Your tier allows 12
  bases per space. Deselect 2 to continue.")
- "Save selection" primary button at the bottom

### 7. FrequencyPicker

Dropdown / radio of available frequencies for the user's tier (e.g.,
Weekly / Daily / Hourly / Instant). Selecting one PATCHes the
backup config; the "Next backup" caption refreshes accordingly.

### 8. Next backup caption

"Next backup: *Tomorrow at 03:00 UTC*" or similar.

### 9. StoragePicker

Cards or rows for each supported storage destination:

- Google Drive (BYOS — connects via OAuth)
- Dropbox (BYOS — OAuth)
- Box (BYOS — OAuth)
- OneDrive (BYOS — OAuth)
- Baseout-managed R2 (built-in, no setup needed)

Currently-connected destination is highlighted with the account
email. Selecting a different one starts the OAuth dance for that
provider.

### 10. RunBackupButton

A primary "Run backup now" button. Disabled (with reason tooltip)
when the connection is in `pending_reauth` / `invalid`. Click →
fires a one-off backup run, appends it to the history below.

### 11. BackupHistoryWidget (when connection exists)

Same widget as on `/` and `/backups`. Closes the loop: trigger a
run, see it appear in the history without leaving the page.

---

## States to design for

| State | Fixture | What's interesting |
|---|---|---|
| **Default — fully configured** | `/integrations` | All sections rendered: connection, base list, schedule, storage, history |
| **Empty — no connection** | `?fixture=empty` | Single "Connect Airtable" CTA only |
| **Discovery banner** | default (Demo Org has one unread event) | Info banner at top, dismissable |
| **Pending re-auth** | not in fixtures yet | Imagine the connection card with amber alert + Reconnect button |
| **Tier-capped** | (set `tierBasesPerSpace` in fixtures to a low number) | Counter shows "N of M allowed", inline error on over-select |

---

## Notes for designer

### What's strong

- The vertical ordering (connection → bases → schedule → storage →
  run). It's the actual cognitive order of decisions; users learn
  the page once and reuse it.
- The status badge / alert pattern. Color + icon + text are all
  consistent across states.
- The discovery banner is honest about partial outcomes (auto-added
  count, blocked-by-tier count, dismissible per event).

### What's weak (you have freedom)

- This page is *long*. On mobile it's a scroll marathon. Consider
  collapsing the "Bases / Frequency / Storage / Run" cluster into
  a tabbed or step pattern once a connection exists. Tradeoff:
  step UI makes it harder for returning users to spot-edit one
  thing.
- The bases list visual is functional but unstyled — a designer's
  pass on row density, hover state, the base-ID treatment (currently
  monospace at the right edge), and the tier-cap counter would help.
- The "Auto-add new bases" toggle is a tiny but powerful setting —
  it currently sits between Reconnect and the bases list and gets
  lost. Worth elevating.
- Storage picker visual treatment varies wildly across providers
  (Google Drive icon vs. R2 icon vs. Box icon — different art
  sources). Worth a consistency pass.
- The "Coming soon" cards (Notion / HubSpot / Salesforce) feel
  perfunctory. Either lean into them as a tease ("vote for what we
  build next") or shrink them so they don't compete visually with
  the Airtable card.

### What's load-bearing (don't break)

- The form attribute hooks (`data-airtable-connect`,
  `data-base-checkbox`, `data-base-selection-form`,
  `data-auto-add-toggle`, `data-space-event-dismiss`, etc.). These
  drive the JS in the view's `<script>` block.
- The tier-cap live check on the bases form — the script enforces
  it both before submit and on every change. The UI must let users
  *see* the constraint before they hit submit.
- The success/error alert wording (matches actual error reasons
  surfaced from the OAuth callback). Wholesale rewording is fine
  as long as the `errorLabels` map gets updated in step.

### Empty-state design opportunity

The `?fixture=empty` state has a lot of dead space — a single
"Connect Airtable" button on a giant card. There's room here to
make a strong first impression: brief explainer of what happens on
click ("We'll redirect you to Airtable to authorize Baseout. We
request read-only access to your bases — nothing else."), trust
indicators (security badges?), a hint at what's next.

But: don't dress this up so much that it becomes a marketing page.
The user is already in the product; they're not deciding *whether*
to use Baseout — they're trying to *use* it.
