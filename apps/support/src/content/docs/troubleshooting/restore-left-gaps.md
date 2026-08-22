---
title: A restore left gaps
description: Restore is best-effort by design, the outcome report names every gap, and most of them come from one cause.
---

A restore that finished with things to fix is not a restore that went wrong. It is the documented
behaviour: records come back, structure comes back only as far as the platform's API can create it,
and the difference is reported rather than hidden.

## Read the outcome report first

A restore ends on an outcome report listing the tables recreated, the records that landed, and every
item that could not be rebuilt, with a link into the restored result. Nothing on this page is
something you have to discover by inspection. See [Restoring a base](/restore/restoring-a-base/).

## One cause explains most of it

**Every restored row is a new row with a new id.** The platform mints identifiers when it creates
objects and will not accept a particular one.

So anything that referred to a row by its id has to be repointed, and only the references whose both
ends are inside the restore can be. That single fact produces most of the list:

- Links between two containers restored together are repointed.
- A link out to something not restored keeps pointing at the original, which still exists.
- Automatic numbering restarts.
- Created and modified stamps describe the restore, because the rows were created now.

See [Airtable record ids](/platforms/airtable/identifiers/),
[Notion page ids](/platforms/notion/identifiers/) and
[ClickUp task ids](/platforms/clickup/identifiers/).

## The rest is what the API will not create

A restore can only build what the platform lets an integration build, and each one draws the line
somewhere different:

| Platform | The thing it will not create |
| --- | --- |
| **Airtable** | Some field types, which arrive as plain text holding the value, for you to convert |
| **ClickUp** | Statuses and Custom Field definitions, which have to exist at the target first |
| **Notion** | Blocks captured as `unsupported`, and new comment threads |

The ClickUp one is worth acting on **before** you restore rather than after: create the statuses and
the Custom Fields at the target, and the values have somewhere to land. See
[Restoring ClickUp data](/platforms/clickup/restoring/).

## Things that were never in the backup

A restore cannot return what a backup could not capture. Automations, interfaces, dashboards,
whiteboards, view filters and page history are absent because the platform's API never offered them,
not because the restore dropped them. See
[What Baseout cannot capture](/troubleshooting/what-baseout-cannot-capture/).

## Files that are not there

If the run you restored from skipped attachments, those files are not in your Destination and no
restore brings them back. Retry them on the run first, then restore. See
[Attachments were skipped](/troubleshooting/attachments-skipped/).

## Running it again is safe

Restore never overwrites. It writes into new tables, so running it again with different choices
creates another set rather than changing the one you have, and the original is untouched throughout.

## Next

- [Restoring a base](/restore/restoring-a-base/): the flow, step by step
- [Restoring attachments](/restore/attachments/): files back, or links to your storage
