---
title: How long an Airtable backup takes
description: Airtable meters the API per base, which is what sets the pace of a run and why one large base is slower than ten small ones.
platform: airtable
sources:
  - apps/server/src/durable-objects/ConnectionDO.ts
  - apps/workflows/trigger/tasks/_lib/airtable-client.ts
---

The steps are the same on every platform. This page covers only what is specific to Airtable. For
what a run is and what it captures, see [How backups work](/backups/how-backups-work/).

A backup run is not slow because Baseout is busy. It is slow because Airtable answers a fixed number
of questions a second, and a large base is a lot of questions.

## The two ceilings

| Ceiling | What it applies to |
| --- | --- |
| 5 requests per second | One base |
| 50 requests per second | All traffic from one user's or service account's personal access tokens |

Past either, Airtable answers `429` with `RATE_LIMIT_REACHED` and expects a 30-second pause before
anything else is sent. A run that trips this repeatedly finishes much later than one that stays
under it, so Baseout paces itself below the limit rather than racing to it and being told to stop.

## Why the per-base limit is the one you feel

Records come back a page at a time, at most 100 records to a page. With five requests a second
against one base, that is a ceiling of roughly 500 records a second for that base, before anything
else the run has to ask for.

The limit is **per base**, so two bases in the same Space are read alongside each other and do not
slow each other down. One base of 200,000 records is the case that takes real time, and splitting it
across Spaces will not help, because the ceiling follows the base rather than the configuration.

The 50-per-second account ceiling is the one to remember if the same token is also driving scripts,
automations or another integration of yours. Baseout's share of it is whatever the rest of your
tooling leaves.

## Schema is cheap, data is not

A Schema run asks for the base's structure and stops, which is a handful of requests per base
whatever its size. That is the reason schema can be scheduled far more often than data without
costing anything noticeable. See [Schedule and scope](/backups/schedule-and-scope/).

## Attachments are a separate cost

Attachment bytes do not come from the API. Airtable hands back a signed URL on a different host, and
the file is fetched from there, so downloading attachments does not spend the base's five requests a
second. It does spend time and bandwidth, and it is usually the longest part of a run for a base
full of images. See [Attachments in Airtable](/platforms/airtable/attachments/).

## What this looks like in the history

A run that is being paced sits in `running` and keeps making progress. It is not stuck. The run
detail shows counts climbing per base, which is the difference between slow and stalled. See
[Reading a backup run](/backups/reading-a-run/) and
[A run is slow or stuck](/troubleshooting/run-slow-or-stuck/).
