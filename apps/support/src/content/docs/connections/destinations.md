---
title: Destinations
description: Where your backups are written.
---

A *Destination* is storage a Space writes its backups to. Like a Source it belongs to the account
rather than to one Space, so you set one up once and reuse it. The list shows each one's name, type,
status, how many Spaces use it, and when it was last written to.

In this guide, you will:

- Add a file store, and optionally a database, once for the whole account
- Reach a run's output afterwards, in files or in a database
- Share one destination across Spaces without their output colliding
- Reconnect once, and heal every Space writing to it

## File storage, and optionally a database

Every Space needs one *file store*. The add flow offers a Baseout-managed store, Google Drive,
Dropbox, Box and Amazon S3.

A *database* destination sits alongside it: Postgres, Neon, Supabase, or another of your own. It
is recommended and never required, and a Space works with only a file store.

### Reaching the output afterwards

The difference shows in how you reach the output afterwards. A file destination holds files, so a
run's detail page gives each base a folder path you can open in your own storage. A database
destination holds a database, so the run gives you a reference to query instead, because a database
is queried rather than browsed.

## Adding one

Pick the type, name it, configure it, save. A managed store that needs no authorization arrives
connected.

:::note
A destination that needs authorization is created first and connected second: it appears as
`needs connection` until you connect it from its own page. That is not a failure — it has simply
never been authorized.
:::

You can also create one without leaving a Space's setup. The Destination step opens the same form in
a drawer and selects the new destination once it is saved.

## Two Spaces, one destination

Sharing is normal and nothing collides. Each Space sets its own folder, or its own schema on a
database, underneath the shared connection, so each Space's output is namespaced separately. The
destination's own page lists the Spaces using it.

## One status, one reconnect

The status belongs to the destination rather than to any Space, and so does the fix. A destination
that has lost access pauses backups for every Space writing to it, states how many that is, and
takes one reconnect to heal all of them. See
[Reconnecting a broken connection](/connections/reconnecting/).

## Removing one

:::note
You cannot remove a destination while a Space still uses it. Baseout blocks the removal and names
the Spaces to unlink first — pulling a destination out from under a running configuration would
break every backup pointed at it.
:::

### The backups already written

Removing a destination has nothing to do with the backups already written. Runs are permanent
records, the cleanup schedule is the only thing in Baseout that ever removes backed-up data, and the
files are in your own storage, so you can copy them out whenever you want. See
[Retention and cleanup](/backups/retention-and-cleanup/).

## Next steps

- [Sources](/connections/sources/): the other half of the account's connections
- [How backups work](/backups/how-backups-work/): what a run writes, and where it says it wrote it
- [Getting started](/start/getting-started/): picking a destination during setup
