---
title: Deleted records in Airtable
description: A deleted Airtable record simply stops being in the answer, so the only copy of it is a backup taken before the deletion.
platform: airtable
sources:
  - apps/workflows/trigger/tasks/backup-base.ts
  - apps/server/src/lib/retention/decide-deletions.ts
  - apps/workflows/trigger/tasks/cleanup-expired-snapshots.ts
---

The steps are the same on every platform. This page covers only what is specific to Airtable. For
what a run captures, see [What we back up in Airtable](/platforms/airtable/what-we-back-up/).

This is the case a backup exists for, so it is worth being precise about what happens.

## Airtable's API has no trash

A backup run reads what the API answers at the moment it runs. A deleted record is not in that
answer, and Airtable's API offers no way to ask for it: there is no endpoint that lists deleted
records, and nothing marks a record as having existed.

So the sequence is simple, and it is the whole argument for a schedule:

1. A backup runs. The record is in it.
2. Somebody deletes the record.
3. The next backup runs. The record is not in it.

The record is now in every backup from before step 2 and none from after. Nothing is lost as long as
one of those backups is still inside its retention window.

## This is what retention is for

Retention decides how far back you can reach, and a deletion nobody noticed for three weeks needs a
backup older than three weeks. The tiered schedule exists precisely so that old copies survive the
frequent ones being cleaned up. See [Retention and cleanup](/backups/retention-and-cleanup/).

## A deleted base or table behaves the same way

Delete a table and it stops being in the base's schema. Delete a base and it stops being in the
list the token can reach, which reads to Baseout exactly like a base that was removed from the grant.
The run says the base is no longer available rather than failing.

Where a base has genuinely gone rather than being un-granted is a question Airtable's API cannot
answer, so the Space says what it observed and not why.

## Comments and attachments follow their record

A deleted record takes its comments and its attachments out of the answer with it. Baseout keeps
the captured comment and marks it `Record deleted`, because the backup is a record of what was
there. See [Comments](/data/comments/).

## Getting one back

Restore writes into new tables and never over the original, so recovering one deleted record means
restoring the table it was in and copying the row across. There is no per-record restore in the
flow. See [Restoring a base](/restore/restoring-a-base/).
