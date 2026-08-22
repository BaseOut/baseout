---
title: Restoring a base
description: Base by base, into new tables, never over the original.
---

Restore is the rare operation, the one you reach for after something has gone wrong. It works one
base at a time, it always writes into **new tables**, and it never overwrites what is there.

It is offered from a run that **succeeded**, and from a base inside one. A failed run does not offer
it.

## The six steps

1. **The base.** One per restore. Every base in the Space is listed with its own coverage, because
   which backups exist depends on the base. A base no backup holds stays on the list and says so
   rather than quietly disappearing.
2. **The backup.** Only the backups that actually hold that base, newest clean one preselected. A
   failed, cancelled or partial run can be chosen deliberately, and warns on its row and again at
   the end, naming which bases it captured.
3. **The tables.** All selected by default; uncheck the ones you do not need.
4. **Attachments.** Re-uploaded as files, or written as links to the copies in your Destination. See
   [Restoring attachments](/restore/attachments/).
5. **Where it goes.** A brand-new base, which is the default and comes with its name prefilled, or
   an existing base you choose, where the restored tables are added beside the ones already there.
6. **Confirmation.** What is being restored and how much of it, the backup's timestamp and the run
   that wrote it, the target, what happens to what is already there, that it cannot be undone, that
   restore needs a connection with write access, and that it counts as one restore run against your
   allowance.

## Best-effort, and what that costs you

Records recreate well. Structure recreates only as far as the platform's API can create it, and the
gap is real. Computed fields the API will not create have to be rebuilt by hand. Some fields come
back as plain text for you to convert to their original type. Links between records need re-linking,
because every restored record is a new record with a new id.

None of that is left for you to discover. A restore ends on an **outcome report**: the tables
recreated, the records that landed, and a list of what could not be rebuilt, item by item, with a
link into the restored base to finish the work. The detail by data type is on your platform's page,
for example [Restoring Airtable data](/platforms/airtable/restoring/).

## Whole tables, not single records

You choose tables. There is no per-record selection in the flow.

## It is recorded like a backup

A restore writes an audit row into the Space's history beside the backup runs, so what you did and
where it landed sit in the same trail.

## Next

- [Restoring attachments](/restore/attachments/): files back, or links to your Destination
- [Reading a backup run](/backups/reading-a-run/): finding the run you want to restore from
- [What Baseout cannot capture](/troubleshooting/what-baseout-cannot-capture/): what was never in
  the backup
