---
title: ClickUp task ids
description: ClickUp has two kinds of task id, the internal one and the custom one your Workspace may have turned on, and only one of them is yours.
platform: clickup
---

The steps are the same on every platform. This page covers only what is specific to ClickUp. For the
restore flow itself, see [Restoring a base](/restore/restoring-a-base/).

An id is the thing a backup can match a row by, so it decides what a restore is able to reconnect.
ClickUp is the only one of the three platforms where a task can have two ids at once.

## Shape

Containers are numeric. A Workspace, Space, Folder and List each carry a number, and ClickUp's older
v2 endpoints call a Workspace a **Team**, so a `team_id` and a Workspace id are the same value.

A task id is a short alphanumeric string that ClickUp assigns. It is what appears in a task URL and
what every other object refers to a task by.

## Custom task ids

A Workspace can additionally turn on **custom task ids**, giving each task a readable identifier of
your own, typically a short prefix and a number.

This one is genuinely yours: you chose the prefix and the numbering follows your work rather than
ClickUp's internal sequence. It is also a second address for the same task, and the API treats it
that way. An endpoint accepts a custom task id only when the request says so, by carrying
`custom_task_ids=true` together with the Workspace id in `team_id`. Without both, the same string is
read as an internal id and does not resolve.

A backup captures both, because the internal id is what the data refers to and the custom id is what
your team says out loud.

## What stores a task id

- **Dependencies and linked tasks**, both of which ClickUp returns on the task itself.
- **A `tasks` Custom Field**, which holds references to other tasks.
- **A subtask's parent.**

## A restore mints new ids

ClickUp assigns a task id when it creates the task, and it cannot be asked for a particular one. A
restored task is a new task with a new id, and the containers around it are new too.

- **Parents are written first**, so a subtask can be created against its restored parent.
- **Dependencies and linked tasks are repointed** at the new ids once the tasks exist.
- **A relationship to a task outside the restore keeps pointing at the original.**
- **Position is not restored.** None of ClickUp's create calls takes a position, so where a Folder or
  List sits among its siblings is assigned by ClickUp.

## Custom task ids on a restore

A restored task takes its place in the Workspace's own custom-id sequence, so the readable id you
knew a task by is in the backup rather than on the restored task. If that identifier is what your
team quotes in conversation, keeping it in an ordinary Custom Field is what makes it survive: a
stored value comes back exactly as it was.

## Next steps

- [Restoring ClickUp data](/platforms/clickup/restoring/): what comes back, and what cannot
- [Restoring a base](/restore/restoring-a-base/): the flow, and the outcome report
