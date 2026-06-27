# Schema · Tab 3 — Health

> The most commercially valuable tab — it's the kind of thing that
> justifies a Pro/Business upgrade. Design it second (after
> Visualize). Companion wireframe: `04-health-wireframe.excalidraw`.

A **per-Base composite grade** plus a breakdown of the issues behind
it. The engine computes a 0–100 score after every backup run from a
set of rules, assigns a colour band, and surfaces the contributing
problems. This tab displays that and lets Pro+ users tune the rules.

---

## User goal

"Tell me where the rot is." Surface the problems a power user can't
easily see across a sprawling Airtable workspace: unnamed fields,
duplicate field names, empty tables, orphaned/circular linked
records, formula errors, type changes that invalidated data, missing
descriptions. Give them a grade they can track and a punch-list they
can act on.

---

## The grade — use the engine's model

The engine emits a **0–100 score per Base** with three bands:

| Band | Range | Colour |
|---|---|---|
| **Green** | ≥ 90 | success / green |
| **Yellow** | 60–89 | warning / amber |
| **Red** | < 60 | error / red |

> **Reconcile this with the page spec.** The intent spec at
> `../../specs/10-schema.md` floats "A–F **or** 0–100" as options.
> The backend actually produces **0–100 + Green/Yellow/Red**, so
> design to that — the visible grade should map 1:1 to what the
> engine computes. A letter grade would need a mapping engineering
> isn't producing. If you want letters for legibility, propose the
> 0–100→letter mapping explicitly rather than assuming one.

The health dot on each table node in the **Visualize** tab uses the
same band colours — keep them identical so the two tabs reinforce
each other.

---

## Layout

Top: a grade per Base. Select a Base → its breakdown and issue list.

```
┌─ Health ─────────────────────────────────────────────────────────┐
│  ┌── Sales ──┐  ┌── Mktg ───┐  ┌── Ops ────┐    [Configure rules] │
│  │    92     │  │    74     │  │    48     │     (Pro+)            │
│  │  ● Green  │  │ ● Yellow  │  │  ● Red    │                      │
│  └───────────┘  └───────────┘  └───────────┘                      │
│  ── Ops · 48 · Red ──────────────────────────────────────────────│
│                                                                    │
│   Schema cleanliness        62  ▓▓▓▓▓▓░░░░                         │
│   Data quality              31  ▓▓▓░░░░░░░                         │
│   Config best practices     58  ▓▓▓▓▓▓░░░░                         │
│                                                                    │
│   Issues                                  [ Sort: severity ▾ ]     │
│   ● high   Empty primary field — 47 records in "Tasks"  → Show     │
│   ● high   Linked field "Owner" points to deleted recs  → Show     │
│   ● med    3 unnamed fields in "Imports"                → Show     │
│   ● low    12 fields missing descriptions               → Show     │
└────────────────────────────────────────────────────────────────────┘
```

### Grade cards (per Base)
- Big **number (0–100)** + **band** with its colour.
- One card per Base in the Space; selecting one drives the breakdown
  below. Multi-base Spaces: this row is the navigation.

### Category breakdown (selected Base)
Decompose the score into categories, each with its own sub-score /
bar:
- **Schema cleanliness** (naming, unnamed/duplicate fields, empty
  tables)
- **Data quality** (empty primary fields, broken linked records,
  formula errors)
- **Configuration best practices** (missing descriptions, etc.)

(Exact category set is rule-driven; design for ~3 categories with
room to vary.)

### Issue list (selected Base)
A list of detected issues. Each row:
- **Severity** — high / medium / low (a dot + label; colour-coded).
- **Issue text** — what + where: "3 unnamed fields in table *X*,"
  "Empty primary field in 47 records in table *Y*," "Linked-record
  field *Z* points to deleted records."
- **Occurrence count** — how many fields/records are affected.
- **"Show me" link** — jumps to that field/record **in Airtable**
  (opens Airtable; this is the "fix it where it lives" affordance,
  consistent with read-only positioning).

The list is **sortable by severity** and **filterable by base**.

---

## Tone — advisory, not pejorative

Health scores are **advisory**. Wording matters:

- ✅ "12 fields could use clearer names."
- ❌ "Your schema is bad."

The user owns this data and made these choices deliberately
sometimes. Frame issues as opportunities and surface impact ("47
records affected"), not judgement.

---

## Rule configuration (Pro+)

- A **rule-configuration UI** lets Pro+ users define what counts and
  set thresholds — writes the Org's health-score rules.
- It must **surface the same default rules the engine uses** when
  none are configured, so non-Pro+ users (and Pro+ users before they
  customize) see a sensible, explained baseline rather than a blank.
- Below Pro+: show the defaults read-only, with the configure entry
  point as an upgrade affordance.

---

## Gating

- Tab available **Launch+** (audit grade with default rules).
- **Rule configuration** is **Pro+**.
- Some **data-quality** issues (empty records, broken links at the
  record level) require a **dynamic backup** to detect — schema-only
  Spaces grade on schema-level rules only. Design the breakdown so a
  category can be "schema-only" without looking broken or empty.

---

## States

| State | Health shows |
|---|---|
| Never backed up | "Health appears after your first backup completes." |
| Healthy single base | Green grade, short/empty issue list — celebrate quietly, no confetti |
| Yellow / Red base | Breakdown + sortable issue list; "Show me" affordances prominent |
| Many bases | Grade-card row is the navigation; one breakdown at a time |
| Below Pro+ | Default rules shown; configure = upgrade affordance |
| No rules configured (any tier) | Engine's built-in baseline rules apply; surface that they're defaults |

---

## Explicitly not this tab

- Not auto-fix — Baseout doesn't repair Airtable for the user. The
  "Show me" link sends them to Airtable to fix it themselves.
- Not record-data browsing — issues reference records by count and
  link out; the tab doesn't render record contents.
</content>
</invoke>
