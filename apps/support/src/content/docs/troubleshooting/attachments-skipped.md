---
title: Attachments were skipped
description: Why a successful run can still report missing files, what caused each one, and why retrying is the step to take before a restore.
sources:
  - apps/workflows/trigger/tasks/_lib/attachment-downloader.ts
  - apps/workflows/trigger/tasks/backup-base.ts
  - apps/web/src/views/BackupRunDetailView.astro
---

A run can succeed and still have skipped files. That is deliberate: an attachment fails on its own
and does not fail the run, because losing a whole backup of 200,000 records over one oversized PDF
would be the wrong trade.

It does mean `succeeded` is not a promise that every file arrived, which is why the run reports
skipped attachments separately and by name.

In this guide, you will:

- Find the skipped-attachment figure on a run, with a reason against each file
- Tell an oversized file apart from a URL that expired mid-run
- Retry the failed files into the same run
- Know why retrying comes before a restore, not after it

## Where to look

Open the run. Skipped attachments are their own figure, and each one is listed with the container it
came from, the record or task or page, and a reason. See
[Reading a backup run](/backups/reading-a-run/).

## The two reasons

**The file was too large.** There is a size cap, and a file above it is not fetched. Nothing about
retrying changes that, so this one is a decision rather than a fix: keep that file somewhere else.

**The URL expired mid-run.** This is the common one, and it is a consequence of how the platforms
hand files over. None of them gives out a permanent address:

| Platform | How long a file URL lasts |
| --- | --- |
| **Airtable** | 2 hours from when the API returned it |
| **Notion** | 1 hour from when the API issued it, for Notion-hosted files |
| **ClickUp** | Fetched from the address on the task |

A run long enough for the window to close on files it read early will skip those files. It is not a
fault in the backup and it is not a fault in your data.

## Retry the failed files

**Retry failed** re-fetches only the skipped files, into the same run, with fresh URLs. It does not
re-read the records and it does not create a second run in the history.

That is the whole fix for an expiry, and it is usually the whole fix full stop.

## Do this before you restore

A restore can only put back what your Destination holds. A file that was skipped is not there, so no
restore brings it back in either mode, and choosing "re-upload as attachments" will not conjure it.

:::caution
If you are about to restore from a run with skipped attachments, retry them first. A restore can
only put back what your Destination holds, and this is the one chance to put the file there. See
[Restoring attachments](/restore/attachments/).
:::

## If they are skipped every time

A file that fails on every run is almost certainly over the size cap rather than unlucky. Check its
size at the source. If it is not large and it still fails,
[contact us](/contact/?kind=ticket) with the run and the file, because that is a case worth seeing.

## Next steps

- [Attachments in Airtable](/platforms/airtable/attachments/)
- [Files in Notion](/platforms/notion/attachments/)
- [Attachments in ClickUp](/platforms/clickup/attachments/)
