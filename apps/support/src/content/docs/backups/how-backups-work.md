---
title: How backups work
description: What a backup run is, what it captures, what starts one, and where it writes.
---

A **backup run** is one execution of the backup process for a Space. It reads the bases in that
Space's scope, writes what it finds to your Destination, and records itself permanently in the
Space's backup history.

Everything on this page follows from one rule: **Baseout reads your Airtable and does not change
it.** A backup run has no write access to your bases. The only two features that ever write back
are Restore and Actions, and each asks for a separate token that can write.

## What a run captures

A run captures up to three layers, and which of them it takes depends on the Space's scope.

**Schema** — the structure of each base: its tables, fields, field types, and views. This is the
smallest and fastest layer, which is why it can run on its own schedule.

**Data** — the records themselves, table by table.

**Attachments** — the files held in attachment fields, fetched and stored alongside the data.

The run detail page shows which of the three a given run captured, so you never have to infer it
from the counts.

## Full runs and Schema runs

Because schema and data can run on different cadences, a run has a **kind** as well as a status:

- A **Full** run captures schema and data (and attachments, where they exist).
- A **Schema** run captures structure only.

The history shows the kind as a second badge beside the status, so a day of frequent schema runs
never gets confused with the monthly full backup. Every Full run also captures schema — a schema
run is the cheap, frequent version, not a different pipeline.

<figure class="bo-shot">
  <img class="bo-shot-light" src="/screens/docs/how-backups-work-1-light.png" alt="Backup history table with Queued, Running, Paused, Succeeded, Failed, Cancelled and Trial run rows, each carrying a Full, Schema or Restore kind badge and a Scheduled, Manual or Trial trigger." width="1040" height="731" loading="lazy" decoding="async" />
  <img class="bo-shot-dark" src="/screens/docs/how-backups-work-1-dark.png" alt="Backup history table with Queued, Running, Paused, Succeeded, Failed, Cancelled and Trial run rows, each carrying a Full, Schema or Restore kind badge and a Scheduled, Manual or Trial trigger." width="1040" height="731" loading="lazy" decoding="async" />
  <figcaption>Kind is the second column, next to Status; Trigger says which of the four things started the run.</figcaption>
</figure>

See [Schedule and scope](/backups/schedule-and-scope/) for how the two cadences are configured.

## What starts a run

Four things, and the history labels every run with which one it was:

**Scheduled** — the Space's data or schema cadence came due. This is the normal case and most of
your history will read this way.

**Manual** — someone pressed Run backup now. Because an off-schedule run consumes additional
credits, this one asks for confirmation first. See
[Running a backup now](/backups/running-a-backup/).

**Webhook** — used by the Instant cadence, where Airtable tells Baseout that something changed
rather than Baseout waiting for the clock.

**Trial** — a run taken before payment, during onboarding, so you can see real output from your own
bases before committing.

## Where the data lands

A run writes to the Space's **Destination**, and how that reads depends on the kind of destination:

- A **static** destination — Google Drive, Dropbox, S3 — holds files. The run detail shows the
  folder path as a link you can open in your own storage.
- A **dynamic** destination — Postgres, for example — holds a database. The run detail shows a
  database reference you can query, because a database is queried rather than browsed.

<figure class="bo-shot">
  <img class="bo-shot-light" src="/screens/docs/how-backups-work-2-light.png" alt="Run detail showing totals, the layers requested, the destination Company Drive on Google Drive, and a per-base table whose Destination column gives each base its own folder path." width="1040" height="547" loading="lazy" decoding="async" />
  <img class="bo-shot-dark" src="/screens/docs/how-backups-work-2-dark.png" alt="Run detail showing totals, the layers requested, the destination Company Drive on Google Drive, and a per-base table whose Destination column gives each base its own folder path." width="1040" height="547" loading="lazy" decoding="async" />
  <figcaption>One destination for the run, and one output location per base: here folder paths, because the destination is a static one.</figcaption>
</figure>

The data is in your storage, under your control. Baseout records where it put things; it does not
hold your backups hostage.

:::note
A base that failed in a run wrote nothing, and its Destination reads as empty rather than showing a
link to a folder that was never created.
:::

## A run is a permanent record

A finished run is a log entry. It cannot be edited, and it cannot be deleted from the history —
there is no Delete and no Run-again on a past run.

This is deliberate. The backup history is the thing you point at when you need to prove a backup
ran, and a log you can quietly prune is not evidence. The only controls that act on a run act while
it is still in flight: Pause and Cancel.

The single mechanism that ever removes backed-up data is the cleanup schedule, described in
[Retention and cleanup](/backups/retention-and-cleanup/).

## What a run does not do

- It does not modify, move, or delete anything in Airtable.
- It does not fail because one attachment failed. Attachments fail independently — a file over the
  size cap, an expired Airtable URL — and the run reports them separately so you can retry just
  those files.
- It does not snapshot which bases were selected. The included-bases list on a run reflects the
  Space's **current** configuration, not what was chosen at the time the run happened. If you have
  changed the scope since, an old run will show today's list.

## Next

- [Schedule and scope](/backups/schedule-and-scope/) — which bases, and how often
- [Running a backup now](/backups/running-a-backup/) — off-schedule runs, pausing, cancelling
- [Reading a backup run](/backups/reading-a-run/) — statuses and the audit trail
- [What Baseout cannot capture](/troubleshooting/what-baseout-cannot-capture/) — the honest limits
