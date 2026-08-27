---
title: Reconnecting a broken connection
description: What "reconnect required" means and how to clear it.
sources:
  - apps/web/src/views/SourceDetailView.astro
  - apps/web/src/views/DestinationDetailView.astro
  - apps/web/src/pages/api/connections/airtable/start.ts
  - apps/server/src/lib/airtable-refresh.ts
---

A Source or Destination that loses access stops backups for every Space that uses it. Baseout says
so in three places at once: the connection's own status, a banner in the affected Space, and a row
in the Inbox. Fixing the connection clears all three.

In this guide, you will:

- Tell the connection states apart, and know which of them stop backups
- Reconnect a Source or Destination once, and heal every Space that uses it
- Cover the window it was down with an off-schedule run

## The states a connection can be in

| Status | What it means |
|---|---|
| `connected` | Authorization is current. Backups can run. |
| `refreshing` | A token refresh is in flight. Transient. |
| `needs connection` | Created but never authorized. |
| `reconnect required` | The credential expired and the refresh failed. Backups are paused. |
| `disconnected` | The connection is broken. Backups will not run until you reconnect. |

The last two differ in how they arrived. `reconnect required` is an expiry Baseout expected and
could not renew on its own; `disconnected` is a connection that is broken outright. The action is
the same either way, and so is the cost of leaving it: nothing is backed up.

## Why it happened

- **The grant was revoked** from the platform's own settings, which Baseout is not told about.
- **The person who authorized it lost the access it carried.** A connection carries the permissions
  of whoever made it, so it narrows when theirs narrows and stops when they leave.
- **The credential expired** and the refresh could not renew it.

## The status is last known good

No platform offers an endpoint answering "is this still valid", and none of them announce a revoked
grant. Baseout finds out on the next call that fails, so the status is the last conversation it had
rather than a live reading, and a connection can be broken for a while before it says so.

## Your existing backups are safe

A broken connection does not touch what is already backed up.

:::note
Runs are permanent records, and the cleanup schedule is the only mechanism that ever removes
backed-up data.
:::

## Clearing it

Reconnect the connection itself, from its page under Sources or Destinations. One reconnect heals
every Space that uses it. You can also do it in place: a broken row inside a Space's setup offers
**Reconnect**, and a broken row that is the current selection blocks saving until it is fixed.

Backups resume on the Space's schedule. For a copy covering the time it was down, take one rather
than waiting for the clock. See [Running a backup now](/backups/running-a-backup/).

## If the message is still there

Two things to check. A Space uses one Source and at least one Destination, so the connection you
fixed may not be the one that broke. And the status reflects the last call rather than a live check,
so it settles once the connection has been used again.

## Next steps

- [Sources](/connections/sources/) and [Destinations](/connections/destinations/): where a reconnect
  lives
- [Status reference](/reference/statuses/): every badge in Baseout, in one table
