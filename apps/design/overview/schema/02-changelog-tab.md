# Schema · Tab 2 — Changelog

> The easiest tab to design — it's a structured feed. Companion
> wireframe: `03-changelog-wireframe.excalidraw`.

A **time-ordered feed of schema changes**, generated automatically
from backup-snapshot diffs. No manual annotation: the engine diffs
each run's schema against the previous run's and writes
human-readable entries. The tab just renders them.

---

## User goal

"Show me what changed." A field was renamed last Tuesday, a new
table appeared on the 20th, a field's type changed in a way that may
have broken data. The user wants a trustworthy audit trail of *how
their Airtable structure has evolved* — the kind of thing Airtable
itself doesn't surface.

---

## Layout

A filter rail (or filter bar) plus a **day-grouped feed**:

```
┌─ Changelog ──────────────────────────────────────────────────────┐
│  ┌─ filters ─┐   ── May 20, 2026 ───────────────────────────────  │
│  │ Base    ▾ │   ┌─────────────────────────────────────────────┐  │
│  │ Type    ▾ │   │ 09:14  [Sales]  + Table   "Q2 Forecast"      │  │
│  │ Date    ▾ │   │        new table added (3 fields, 0 records) │  │
│  └───────────┘   └─────────────────────────────────────────────┘  │
│                  ── May 18, 2026 ───────────────────────────────   │
│                  ┌─────────────────────────────────────────────┐  │
│                  │ 16:02  [Mktg]  ✎ Rename  "Lead Source"       │  │
│                  │        → "Acquisition Channel"               │  │
│                  └─────────────────────────────────────────────┘  │
│                  ┌─────────────────────────────────────────────┐  │
│                  │ 11:30  [Ops]  ⚠ Type    "Status"             │  │
│                  │        Single select → Multiple select       │  │
│                  │        ⚠️ 12 records may now be invalid       │  │
│                  └─────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────┘
```

### Entry row
Each change is one row. Fields:
- **Timestamp** (and the day group header above it).
- **Base** — a small badge/tag (which base the change happened in).
- **Change type** — added / removed / renamed / type-change / view
  change. A typed badge or icon so the feed is scannable by kind.
- **Description** — the human-readable string the engine already
  rendered (you don't compose this client-side; you style it). Show
  before → after for renames and type changes.
- **Warning affordance** — a ⚠️ icon **when the change may have
  broken data** (e.g. a select-type narrowing that invalidates
  existing values). This is the highest-value signal in the feed —
  make it unmissable without being alarmist.

### Grouping & density
- Group by **day**, with date headers.
- High-volume Spaces produce a lot of entries — design for density
  and consider secondary grouping by base within a day.

### Filters
- **By base** (multi-base Spaces).
- **By change type** (added / removed / renamed / type / view).
- **By date range.**

---

## Copy & tone

- The strings come pre-rendered from the engine; your job is
  hierarchy and legibility, not wording. But the *frame* copy
  (empty state, filter labels) follows house style: direct,
  second-person, no exclamation marks.
- Example entries to design against:
  - "May 20, 2026 — *Sales Pipeline* base: new table *Q2 Forecast*
    added (3 fields, 0 records)."
  - "May 18, 2026 — *Marketing* base: field *Lead Source* renamed to
    *Acquisition Channel*."
  - "May 12, 2026 — *Ops* base: field *Status* type changed from
    *Single select* to *Multiple select*. ⚠️ 12 records may have
    invalid values now."

---

## Data behind it

Reads `GET /spaces/{id}/schema/changelog?since=…`. Each entry is a
persisted diff with a timestamp, base, structured change type, the
rendered description, and a materiality flag (which drives the ⚠️).
Field- and table-level only — names, types, additions, deletions,
view changes. No record-level content required, so this works on
schema-only plans.

---

## Gating

- Available **Launch+** alongside the rest of the Schema page.
- On Pro+ Spaces with **Instant Backup**, schema diffs also compute
  on webhook-triggered incremental runs — so the feed can update
  near-real-time rather than only on scheduled full runs. Design
  doesn't change; just know entries can arrive between scheduled
  runs for those Spaces.

---

## States

| State | Feed shows |
|---|---|
| Never backed up | "Schema changes appear after your second backup — there's nothing to compare yet." (first run has no prior snapshot) |
| Backed up once, no changes since | Empty-but-healthy: "No schema changes since your first backup." |
| Normal | Day-grouped feed |
| High volume | Density + day/base grouping; filters carry the load |
| Contains broken-data changes | ⚠️ entries surfaced/sortable; consider a "needs attention" filter |

---

## Relationship to other tabs / V2

- A change that breaks data (⚠️) is the same kind of problem the
  **Health** tab grades. Consider linking a ⚠️ entry to the relevant
  Health issue.
- A "compare snapshot A vs snapshot B" diff UI is **out of scope /
  possible V2** — the Changelog is a running feed, not a two-point
  comparator. Defer that scope to engineering.
</content>
</invoke>
