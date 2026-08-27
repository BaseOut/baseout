---
title: A run is slow or stuck
description: How to tell a run that is being rate-limited from one that has actually stopped, before you cancel something that was going to finish.
sources:
  - apps/server/src/durable-objects/ConnectionDO.ts
  - apps/server/src/lib/runs/reconcile.ts
  - apps/web/src/stores/backup-runs.ts
  - apps/web/src/pages/api/spaces/[spaceId]/backup-runs/[runId]/cancel.ts
---

A run that has been in `running` for an hour is usually being paced by the platform, not stalled.
Cancelling it and starting again makes it slower, because the second run starts from the beginning.

In this guide, you will:

- Tell a run that is being paced apart from one that has actually stopped
- See what sets the pace on your platform
- Narrow what a run has to do, so it has less to pace through
- Know when to pause, when to cancel, and when to report it instead

## Tell the difference first

`running` means in progress. What separates slow from stuck is whether the counts are moving.

Open the run. It shows totals and a per-base table, and those figures climb as the run works. Refresh
after a couple of minutes:

- **The counts moved.** It is working. It is being paced.
- **The counts did not move at all, over several minutes, on a run with plenty left to do.** That is
  worth reporting.

See [Reading a backup run](/backups/reading-a-run/).

## Why pacing is normal

Every platform meters its API, and a backup is a great many requests. Baseout deliberately stays
under the limit rather than racing to it and being told to stop, because a run that keeps tripping a
rate limit finishes later than one that never does.

How much that costs depends on your platform, and the difference between them is large:

| Platform | What sets the pace |
| --- | --- |
| **Airtable** | 5 requests a second per base. One large base is the slow case. See [How long an Airtable backup takes](/platforms/airtable/limits-and-timing/). |
| **ClickUp** | 100 requests a minute on the lower plans, up to 10,000 on Enterprise. See [How long a ClickUp backup takes](/platforms/clickup/limits-and-timing/). |
| **Notion** | About 3 requests a second per connection, and a page tree has to be walked node by node. See [How long a Notion backup takes](/platforms/notion/limits-and-timing/). |

## Things that genuinely make it slower

**Something else of yours is using the same budget.** The limits are per token or per workspace, not
per integration. A script, an automation or another tool sharing the credential is sharing the
allowance. Giving Baseout its own connection separates them.

**Attachments.** For a base full of images the files are usually the longest part of the run, and
they are fetched from storage rather than through the API. See
[Attachments in Airtable](/platforms/airtable/attachments/).

**Scope you did not mean to include.** A Space quietly covering more than you thought is a longer
run by definition. See [Schedule and scope](/backups/schedule-and-scope/).

## What to do about it

- **Wait, if it is moving.** That is the honest first answer.
- **Split the schedule.** Schema is cheap and can run often; data does not have to run as often. See
  [Schedule and scope](/backups/schedule-and-scope/).
- **Narrow the scope**, if part of it does not need protecting on that cadence.
- **Move the Space's connection off a shared token.**

## Pause and Cancel

Both act only on a run that is still in flight.

:::note
A `paused` run can be restarted. A `cancelled` run cannot, and it stays in the history as a
cancelled run, because the history is a permanent record.
:::

See [Running a backup now](/backups/running-a-backup/).

## If it really is stuck

[Contact us](/contact/?kind=ticket) with the Space and the run, rather than cancelling and retrying
repeatedly. A stalled run is a thing we want to see in the state it stalled in.
