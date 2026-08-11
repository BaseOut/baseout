# Design — Backups redesign

## Three levels, not one accordion

The old page put everything in one place: a list whose rows expanded into a detail panel, polling to stay live. It mixed scanning and reading, and the expanded panel was a flat label/value wall. We split it along the product hierarchy instead:

```
Backups (list)        every run for this Space        scan
  └─ Run detail       one run, all its bases          audit a run
       └─ Base detail one base, all its tables        confirm what was captured
```

Each level is a page with one job. The list is for scanning ("did last night's run succeed?"); the run page is for auditing a run ("which base failed, what did it write, which attachments dropped?"); the base page is the leaf ("for this base, exactly which tables / how many records / views / attachments?"). Pages (not inline expansion) mean each level is linkable — a support ticket can point straight at a run or a base — and nothing re-renders under the user while polling.

## Honest in-progress state

A backup is a long write. Showing only final numbers would make a running run look broken (zeros) or finished (totals it has not reached). So at every level, an in-flight unit shows **captured-so-far / total**:

- Run detail: per-base `records 410 / 642`, `attachments 7 / 12`, header ETA "~Xm left".
- Base detail: the same, per-table; the table currently being written is `running`, later tables `pending`.

The harness fixtures are arithmetic-consistent across levels: the running base's per-table remaining sums back to the per-base remaining the run page shows (Tickets 410/458 + Releases pending 184 = 642; remaining 48 + 184 = 232). When the engineer wires real endpoints, the same shape holds.

## Failed attachments are a first-class, recoverable outcome

Attachments fail independently of the run (a file over the size cap, an expired Airtable URL) — the run still "succeeds". So failed attachments are not an error state; they are a reviewable list: a banner with the count, a slide-over with each file's base, table, and reason, and a Retry. The run page lists all of the run's failed attachments; the base page scopes the slide-over to that base.

## Base detail is not the Schema page

These look adjacent (both list a base's tables) but answer different questions:

- **Base detail (this change):** *what did this run capture for this base* — counts the engine wrote, tied to one run, with running/failed states. Volumes.
- **Schema page (spec `10-schema`, future):** *what is the shape of this base* — tables, fields, relationships, an ERD — run-agnostic. Structure.

Keeping them separate avoids implying the run page is a structure browser, and leaves Schema free to be a proper structure/ERD view later.

## Data feasibility

Every figure traces to a real source, per the project's no-fabrication guardrail:

- **Tables, fields, views** — Airtable metadata API (`GET /v0/meta/bases/{baseId}/tables` returns each table's fields and views).
- **Records, attachments, failed attachments** — the backup engine, recorded as it writes.
- **Output location** — the folder (static / file destinations) or database reference (dynamic) the run wrote to.
- **Open in Airtable** — a real `https://airtable.com/{baseId}` link from the base's Airtable id.

No workspace, plan, or invented metrics. The page footnotes the provenance so the user can trust the audit.

## Destinations and depth

The summary on both detail levels reflects the model the rest of the product uses: the three capture **layers** (Schema always, Data by default, Attachments opt-in) as depth chips, and the **destination** as static (file → folder) or dynamic (database → reference). A Space can fan out to both; the per-base / per-table output cell shows where each landed.
