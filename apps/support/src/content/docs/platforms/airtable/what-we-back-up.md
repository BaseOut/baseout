---
title: What we back up in Airtable
description: The Airtable objects a run captures, and the ones Airtable's API will not hand over.
platform: airtable
sources:
  - apps/workflows/trigger/tasks/backup-base.ts
  - apps/workflows/trigger/tasks/_lib/airtable-client.ts
  - apps/workflows/trigger/tasks/_lib/attachment-downloader.ts
  - apps/workflows/trigger/tasks/_lib/base-metadata.ts
---

The steps are the same on every platform. This page covers only what is specific to Airtable. For
how a run works, see [How backups work](/backups/how-backups-work/).

## Captured

- **Bases**, each with its own output location in your Destination.
- **Tables**, with their names and their place in the base.
- **Fields**, including each field's type.
- **Views**, by id, name and type.
- **Records**, table by table.
- **Attachments**, fetched from their Airtable URLs and stored beside the data.

Which of these a given run takes depends on the Space's scope. Schema Only stops at views;
Schema + Data adds records and attachments. See
[Schedule and scope](/backups/schedule-and-scope/).

Attachments are fetched from URLs Airtable issues for the purpose, and those URLs are short-lived.
A file that is too large, or whose URL expires mid-run, fails on its own and does not fail the run.
The run reports those files separately so you can retry just them.

## Not captured, and why

Every item here is a limit of Airtable's API rather than a choice of ours. Airtable does not expose
it, so no tool can read it.

- **Automations and interfaces.** The API does not export them. You can record them by hand in the
  Schema section, but that is documentation, not a backup, and a restore will not recreate them.
- **A view's filters, sorts and grouping.** Airtable returns a view's id, name and type, and its
  visible field ids only for grid views. Everything that makes the view useful stays behind.
- **Attachment timestamps.** Airtable does not report when a file was attached, so no backup can
  record that date.
- **Who changed a record.** No actor is returned, which is why the Data changelog shows what
  changed and not who changed it.

The whole list, including the parts still being confirmed, lives in
[What Baseout cannot capture](/troubleshooting/what-baseout-cannot-capture/).
