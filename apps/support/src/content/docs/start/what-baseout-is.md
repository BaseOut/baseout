---
title: What Baseout is
description: A utility admin tool for backing up, restoring and inspecting the data you keep in another platform.
sources:
  - apps/workflows/trigger/tasks/backup-base.ts
  - apps/server/src/lib/scheduling/dual-schedule.ts
  - apps/workflows/trigger/tasks/restore-base.ts
---

Baseout copies your data out of the platform you work in, on a schedule you set, holds those copies
in storage you connect, and puts them back when something goes wrong. Between those moments it lets
you read what it captured: the structure of your data, what changed since the last run, and the
records themselves.

It is a layer on top of your platform rather than a replacement for it. Your team keeps working
where it always worked.

## What it captures

A backup run takes up to three layers. *Schema* is the structure: tables, fields, field types and
views. *Data* is the records themselves. *Attachments* are the files held on attachment fields,
fetched and stored beside the data.

Which of the three a run takes depends on the Space's scope, and you choose between `schema only`
and `schema + data`. The two layers also run on separate cadences, because structure is small and
cheap to capture while records are neither. `monthly`, `weekly`, `daily` and `instant` are all
available. See [Schedule and scope](/backups/schedule-and-scope/).

## Where the backups go

Into a *Destination* you connect: a file store, with a database alongside it if you want one. The
output lands in storage you control, and Baseout records the folder path or database reference for
every base in every run, so you can open what it wrote without going through Baseout to reach it.
See [Destinations](/connections/destinations/).

## Baseout reads, and does not write

A backup run has no write access to your data. It reads, it copies, and it changes nothing in the
platform it read from.

Two features write back, and both are things you start deliberately: *Restore*, which recreates
data in new tables, and *Actions*. Each asks for a separate connection that can write, so the
ability to write is never a side effect of backing up.

## What it cannot capture

Some things are not exposed by the platforms' own APIs, so no tool can read them and no backup can
hold them. Today's confirmed list is short: automations and interfaces, a view's filters and sorts,
the date a file was attached, and who made a change.

:::note
That gap matters most during a restore, which is why it is written down in one place rather than
discovered later. See [What Baseout cannot capture](/troubleshooting/what-baseout-cannot-capture/).
:::

## Next steps

- [How Baseout is organized](/start/how-baseout-is-organized/): the containers, and the words for
  what sits inside them
- [Getting started](/start/getting-started/): the setup order, once through
- [How backups work](/backups/how-backups-work/): what a run is, and what starts one
