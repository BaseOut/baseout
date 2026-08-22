---
title: ClickUp task fields and Custom Fields
description: ClickUp splits a task's columns in two, the fixed attributes every task has and the Custom Fields you define, and a backup treats them differently.
platform: clickup
---

The steps are the same on every platform. This page covers only what is specific to ClickUp. For
what a run captures overall, see [What we back up in ClickUp](/platforms/clickup/what-we-back-up/).

ClickUp does not have one notion of a column. A task carries a set of **built-in attributes** that
every task has whether you use them or not, and on top of those sit **Custom Fields**, which you
define and which are attached at a level of the hierarchy rather than to the task.

## Built-in task attributes

These come back as part of the task itself: name, description, status, priority, assignees,
watchers, tags, start date, due date, time estimate, points, parent, custom task type, and the
created and updated timestamps.

Two behave unlike anything on the other platforms:

- **Status belongs to the List, not to the task.** A status is a member of a set defined where the
  task lives, so the same word can be a different status in two Lists. This is what makes a restore
  particular: see [Restoring ClickUp data](/platforms/clickup/restoring/).
- **Priority is fixed.** ClickUp's four levels cannot be customised, so priority is the one
  categorical value that always survives a restore intact.

## Custom Field types

A Custom Field is declared at List, Folder, Space or Workspace level and inherited downwards, so a
backup captures the definition where it is declared and the value where it is set.

`short_text` · `text` · `number` · `currency` · `date` · `checkbox` · `url` · `email` · `phone` ·
`drop_down` · `labels` · `location` · `users` · `tasks` · `emoji` · `manual_progress` ·
`automatic_progress` · a **File** type that holds attachments

`drop_down` and `labels` carry their option list in the definition, each option with its own id, so
the value on a task is an option id rather than the label you read on screen.

## Stored against computed

Most Custom Fields hold what someone entered. Three do not:

- **`automatic_progress`** is derived by ClickUp from subtasks or checklist items. The percentage is
  captured; it is an output.
- **`tasks`** stores task ids rather than task names, which is what a restore has to repoint. See [ClickUp task ids](/platforms/clickup/identifiers/).
- **A voting field returns its votes and will not accept them back.** ClickUp's API reads the value
  and has no way to set it, so votes are readable in a backup and cannot be restored.

## Definitions are read, never created

ClickUp's API lists Custom Field definitions and has no endpoint that creates one. That is the
single most important consequence on this page: a restore can write a Custom Field **value** only
where the field already exists at the target. Create the fields first, then restore, or the values
have nowhere to land.

The same is true of statuses, for the same reason and with the same fix.

## Files on a Custom Field

A File type Custom Field holds attachments in its own right, separately from the ones on the task
body, and both are captured. See [Attachments in ClickUp](/platforms/clickup/attachments/).
