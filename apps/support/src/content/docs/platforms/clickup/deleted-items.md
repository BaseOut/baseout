---
title: Archived and deleted items in ClickUp
description: ClickUp archives rather than deletes, hides archived items from the API by default, and a backup has to ask for them explicitly.
platform: clickup
---

The steps are the same on every platform. This page covers only what is specific to ClickUp. For
what a run captures, see [What we back up in ClickUp](/platforms/clickup/what-we-back-up/).

ClickUp draws a distinction the other two platforms do not: archiving is not deleting, and the API
treats them completely differently.

## Archived is hidden, not gone

Archiving a task, List, Folder or Space takes it out of the ordinary view without destroying it.
ClickUp's read endpoints leave archived items out of the answer **by default**, and return them only
when a request asks for them with `archived=true`.

That default is the trap. An integration that never asks will produce a backup of the active
Workspace and look complete, while a year of archived Lists sits outside it. A backup asks.

## Deleted is gone

A deleted task goes to ClickUp's trash and out of the API's answer, in the same way a deleted
Airtable record does. There is no endpoint that lists it, so the only copy of a deleted task is a
backup taken before the deletion.

## The distinction is worth keeping

The two look similar in the interface and are opposites for a backup:

| | In the API | In a backup |
| --- | --- | --- |
| **Archived** | Returned when asked for | Captured, with its archived state |
| **Deleted** | Not returned at all | Only in earlier runs |

Restoring an archived item is a ClickUp action and needs no backup. Restoring a deleted one needs
the run that still holds it.

## This is what retention is for

Retention decides how far back you can reach, and a deletion nobody noticed for three weeks needs a
backup older than three weeks. See [Retention and cleanup](/backups/retention-and-cleanup/).

## Getting one back

Restore writes into new containers and never over the original, and the restored task carries a new
task id. See [Restoring ClickUp data](/platforms/clickup/restoring/) and
[ClickUp task ids](/platforms/clickup/identifiers/).
