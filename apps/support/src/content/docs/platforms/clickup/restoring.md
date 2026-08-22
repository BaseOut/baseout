---
title: Restoring ClickUp data
description: What comes back in ClickUp, what comes back changed, and what cannot come back at all.
platform: clickup
---

The steps are the same on every platform. This page covers only what is specific to ClickUp. For
the flow itself, see [Restoring a base](/restore/restoring-a-base/).

Restore is best-effort and it never overwrites. Baseout writes into new ClickUp objects, so the
originals are still there if the result needs correcting.

## Containers

Spaces, Folders and Lists are recreated as new ones, and a folderless List comes back folderless.
None of ClickUp's create calls takes a position, so where a Folder or List sits among its siblings
is assigned by ClickUp, not restored.

## Statuses

ClickUp's API has no endpoint that creates a status. A task can only be written with a status that
already exists where it lands, so the target List's statuses have to match before the tasks go in.
Check this first: it is the usual reason a restore arrives with everything in the default status.

Priority is the exception. ClickUp's four levels are fixed and cannot be customised, so priority
always survives.

## Tasks and Subtasks

Tasks come back as new tasks with new ids, and a subtask is created against its parent, so parents
are written first. Everything else in ClickUp refers to a task by that id, which is what the next
two sections are about.

## Custom Fields

A Custom Field value is written by its own call rather than as part of the task, and the field has
to exist where the task lands: ClickUp's API reads Custom Field definitions and has no endpoint that
creates one. Voting Custom Fields are the sharp edge, because ClickUp returns their values and does
not let the API set them. Votes are readable in a backup and cannot be put back.

## Relationships

Dependencies and linked tasks are rebuilt once the tasks exist, repointed at the new ids. A
relationship to a task outside the restore keeps pointing at the original.

## Comments

Comments are recreated carrying the identity of the account that authorized the connection and the
date they were written. ClickUp's create-comment call accepts the text, an assignee and a
notification flag; neither an author nor a date. A restored thread reads correctly and is not a
record of who said what when.

## Attachments

You choose at restore time between re-uploading the files onto the new tasks and writing links to
the copies already in your Destination. ClickUp accepts any file type up to 1 GB per file, and
refuses it once the Workspace's storage allowance is spent. See
[Restoring attachments](/restore/attachments/).

## What cannot come back

Dashboards, Automations, Whiteboards and task activity history, because none of them was captured.
A Doc is rebuilt from what the API gave, which is its text and not its toggles, banners or embeds.
