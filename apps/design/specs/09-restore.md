# 09 — Restore (`/restore`)

The page where users restore a Backup Snapshot back into Airtable.
Currently a placeholder — your design will define the screen.

**Source:**
- Today: `apps/design/src/pages/restore.astro` (uses `PlaceholderView`)
- Once designed: a new `apps/web/src/views/RestoreView.astro`

**Layout:** `SidebarLayout`

**Live preview:** <http://localhost:4332/restore> — placeholder

---

## Purpose

Get a user's Airtable data back from a Backup Snapshot when
something has gone wrong (accidental deletion, corruption, a script
that ran amok, a base they want to clone for testing).

PRD §2.3 sets the V1 scope here precisely. Read it before designing.

---

## User goal

> "Show me my snapshots. Let me pick one. Let me pick what to
> restore. Tell me exactly what's about to happen. Do it."

This is a *cautious* user moment. Restore writes to Airtable. The
user is anxious. The page must be calm, explicit, and
unambiguous — every confirmation step is worth its weight.

---

## The V1 restore contract (PRD §2.3)

These are the rules. Build the design around them, not the other
way around.

- **Restore is always non-destructive.** Restored data lands as
  *new records* in a *new copy* of the source. Never overwrites
  existing records, never modifies the live base in place.
- **Scope choices (V1):**
  - **Whole base** — restore a whole Base from a snapshot. Creates a
    *new Base* in the user's Airtable workspace.
  - **Whole table** — restore one table out of the snapshot. Creates
    a new Table inside the user's existing Base (with a name like
    `RESTORED – Old Table Name – 2026-06-04`).
  - **Records-only** — restore selected records as new rows in the
    existing Table.
- **No partial-field restore in V1.** You can't say "only restore
  fields X and Y of these records." It's all-or-nothing per
  selected record.
- **No automated conflict resolution.** If a record with the same
  primary-field value exists in the live Base, we create the
  restored record alongside it (Airtable allows duplicates).
- **Restore creates a Backup Run-like audit row** (a "Restore Run")
  in the same audit log surface as Backups.

---

## Suggested page flow

Three-step wizard, all on one page (or three sequential views,
designer's call):

### Step 1 — Pick a snapshot

- List of available snapshots (most-recent-first), shown as
  expandable rows.
- Each row: snapshot timestamp, "from Backup Run #abc123", size
  (records / tables / attachments), health badge.
- Quick filter: by Base.
- Pre-selected: the most recent successful snapshot.

### Step 2 — Pick what to restore

After a snapshot is chosen, switch to a tree-like picker:

- **Snapshot root** — checkbox: "Restore whole snapshot"
  - **Per Base** — checkbox + base name + tiny stats
    - **Per Table** — checkbox + table name + record count
      - **Records** — link "Pick records" → opens record picker
        modal (filterable by primary field)

The user can check at any level. Higher checkboxes auto-fan-out;
deselecting a leaf de-checks its parent's "all" state.

### Step 3 — Confirm

A summary card stating *exactly* what will happen, in plain English:

> You're about to restore:
>
> - **A new Base** named `RESTORED – Sales CRM – 2026-06-04` in your
>   Airtable workspace `Acme Co`.
> - Containing **3 tables**, **1,243 records**, **48 attachments**.
> - This will count as **1 restore run** against your activity
>   credit allowance.
>
> Your live Base will not be modified.
>
> **[Cancel] [Restore now]**

After confirmation, show a progress UI similar to the backup-run
flow (a row appears in the Restore Runs log; status polls until
terminal).

---

## States to design for

| State | What |
|---|---|
| **No snapshots** | Empty state — "You haven't completed a Backup Run yet. Run one first." with link to /backups |
| **Snapshot list** | Many snapshots — design the row density |
| **Step 2 — Tree picker** | Large bases with many tables — usability under scale |
| **Step 3 — Confirm** | The "are you sure" moment — make it weighty |
| **In progress** | Restore Run row, status polling |
| **Completed** | Success state + "Open new Base in Airtable" link |
| **Failed** | Failure state with error detail + retry / contact support |

---

## What we are NOT designing in V1

Per PRD §2.3 — these are V2+:

- Partial-field restore (cell-level overwrite)
- Diff view: "show me what changed between snapshot and live"
- Restore *into* an existing Base in place
- Restore to a different Airtable Workspace than the snapshot
  source
- Scheduled / triggered restores

If you have strong ideas about how the V2 versions could look,
sketch them and pass to the engineering team for the v2 PRD — but
don't fold them into the V1 design.

---

## Notes for designer

- This is the most-anxious-user page in the product. Lean into it.
  Take more whitespace, more confirmation text, slower-feeling
  transitions, calmer color. The opposite of "fast and confident."
- Trust signals matter here too — show the snapshot's source
  Backup Run, the timestamp, the size — so the user knows *which*
  snapshot they're choosing.
- The "creates a new Base / new Table" rule is the headline of the
  whole page. The user should never have to wonder "will this
  overwrite my data?" — every screen reassures.
- Consider an "I understand what will happen" checkbox before the
  final Restore button. Yes, it's friction. Yes, it's worth it.
- Plan for a future where this page also lists *Restore Runs* (an
  audit log of past restores), much like Backup Runs are listed on
  /backups. Empty-state copy can mention "You haven't restored
  anything yet."

---

## Component reuse

You can reuse:

- The status / health badge components from `apps/web/src/components/ui/Badge.astro`
- The accordion row pattern from `BackupHistoryWidget`
- The `Card`, `Button`, `Modal`, `Checkbox`, `TextInput`, `Select`
  primitives
- `setButtonLoading` for any async button

You probably need:

- A new tree-picker component for the Step-2 cascade. Designer's
  call on visual structure.
- A new "diff badge" / "what-will-change summary" component for
  Step 3 — distinctive enough that it doesn't blend with regular
  Cards.
