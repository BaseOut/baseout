---
title: Reading a backup run
description: Run statuses, the three-level audit trail, failed attachments, and where every number comes from.
api:
  - summary: List the runs on a Space, newest first
  - summary: Read one run, with its per-base results
sources:
  - apps/web/src/views/BackupsListView.astro
  - apps/web/src/views/BackupRunDetailView.astro
  - apps/web/src/views/BackupRunBaseView.astro
  - apps/web/src/pages/api/spaces/[spaceId]/backup-runs.ts
---

The backup history is an audit trail, and it is built to be read downwards: the list tells you
*whether*, the run tells you *what*, the base tells you *exactly what*.

In this guide, you will:

- Drill from the run list down to a single base and back again
- Tell a `failed` run apart from a `succeeded` run that skipped attachments
- Read a run that is still going, and know why some cells hold a dash
- Find one specific run out of a long history

## The three levels

### Backups

One row per run, for every run the Space has ever attempted. Each row carries the status, the kind,
when it finished, what triggered it, and its base, record and attachment counts and duration.

### A run

Status, trigger, start and finish, duration, totals across the run, which layers it captured, where
it wrote, and a table of every base with its own counts and output location.

### A base within a run

The leaf. Every table in that base with its Fields, Records, Views, and Attachments, plus the
folder or database it wrote to.

Clicking anywhere on a row moves you down a level, and a breadcrumb — Backups → Backup run → base —
shows where you are and takes you back up. Drilling preserves state: from a running run you arrive
at a running base, and going back returns you to the run as you left it.

## Run statuses

| Status | What it means |
|---|---|
| [`queued`](/reference/statuses/#queued) | Accepted, not started. |
| [`running`](/reference/statuses/#running) | In progress. |
| [`paused`](/reference/statuses/#paused) | Started, then paused by someone. Can be resumed. |
| [`succeeded`](/reference/statuses/#succeeded) | Finished. |
| [`failed`](/reference/statuses/#failed) | Did not finish. Carries a reason. |
| [`cancelled`](/reference/statuses/#cancelled) | Stopped by a person. Keeps whatever it had already written. |
| [`trial run`](/reference/statuses/#trial-run) | A pre-payment run, taken during onboarding. |

A second badge carries the *kind* — `full` or `schema` — so a frequent schema cadence never gets
mistaken for the monthly full backup.

:::note
**`succeeded` does not mean every single thing landed.** A run can finish successfully and still
have skipped individual attachments. That is reported separately, below, rather than by
downgrading the whole run.
:::

## Reading a run that is still going

A `running` run does not show final numbers, because it does not have them. Instead:

- the header shows an estimated time remaining
- bases in flight show **captured so far versus total**, for records and for attachments
- bases not yet reached are marked pending

## Reading a run that failed

A `failed` run says where it stopped: which base failed, and the error. Bases that completed before
the failure **still show their counts**, because they still wrote their data. A failure is a
stopping point, not an erasure of everything before it.

## Failed attachments

Attachments fail independently of the run. A file above the size cap or an Airtable URL that
expired mid-run will not fail the backup.

When it happens, a banner on the run reports the count and opens a slide-over listing each failed
file with its base, table, and reason. From there, **Retry failed** re-fetches only those files
into the same run — a small in-place repair, not a new backup.

The same view exists one level down, scoped to a single base, and the affected tables are flagged
with their failed count so you can see which part of the base is incomplete.

## Why a cell sometimes shows a dash

A dash means the value is **genuinely absent**, not zero and not hidden. A `queued` run has no
record count because nothing has been counted yet.

A dash does not mean failure. A run that `failed` on one base still wrote the others, and those
numbers are printed — an audit table that blanked them would be denying data it is holding. The
Status column is what carries the failure; the count columns carry counts.

## Where the numbers come from

Every figure on these pages is a number Baseout can actually obtain:

- **Tables, fields, and views** come from Airtable's metadata.
- **Records and attachments** come from the backup engine, counted as it writes.

Nothing is estimated, extrapolated, or filled in for the sake of a tidy column, and each page states
its provenance in a footnote. If a number cannot be obtained, it is not shown.

## Finding a specific run

The list supports search by **Run ID** or **error message** — the two things a support ticket
actually gives you — plus filters by status, trigger, and date range, with pagination and a
rows-per-page control. When filters exclude everything you get a distinct "no runs match" state,
which is not the same screen as a Space that has never run a backup.

There is deliberately **no filter by base.** The included-bases list on a run reflects the Space's
current configuration rather than a per-run snapshot, so filtering on it would return confident and
wrong answers.

## Destination, per base

Each base in a run shows where its data actually landed:

- a **static** destination (Google Drive, Dropbox, S3) shows the folder path as a link that opens
  in your own storage
- a **dynamic** destination (Postgres, for example) shows a database reference to query
- a base that `failed` shows an empty destination, because nothing was written

## Next steps

- [Running a backup now](/backups/running-a-backup/) — pausing and cancelling in flight
- [Status reference](/reference/statuses/) — every status badge in Baseout, in one table
- [My backup failed](/troubleshooting/backup-failed/) — working through a failure
