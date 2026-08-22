---
title: How long a ClickUp backup takes
description: ClickUp meters the API per token and the ceiling comes from your plan, so the same Workspace reads at ten different speeds on different plans.
platform: clickup
---

The steps are the same on every platform. This page covers only what is specific to ClickUp. For
what a run is and what it captures, see [How backups work](/backups/how-backups-work/).

ClickUp is the platform where the plan you are on changes the wall-clock time of a backup by two
orders of magnitude. It is worth knowing which row you are in before deciding a run is too slow.

## The ceiling comes from the plan

ClickUp counts requests **per token**, personal or OAuth alike, in one-minute windows.

| Plan | Requests per minute |
| --- | --- |
| Free Forever, Unlimited, Business | 100 |
| Business Plus | 1,000 |
| Enterprise | 10,000 |

Past the ceiling ClickUp answers `429`. Every response carries `X-RateLimit-Limit`,
`X-RateLimit-Remaining` and `X-RateLimit-Reset`, so the budget left in the current window is a fact
rather than a guess, and Baseout paces itself against it instead of retrying blindly.

## What 100 a minute buys

On the lower three plans that is under two requests a second for everything the run needs: the
hierarchy, then each List's tasks, then Custom Field values, comments, checklists and time entries.
A Workspace of a few thousand tasks is a run measured in tens of minutes rather than seconds, and
nothing about that indicates a fault.

The limit follows the **token**, not the Workspace, so a second integration of yours using the same
personal token is competing for the same 100. Authorizing Baseout with its own token, or through
OAuth, keeps the two budgets apart.

## Structure first, then tasks

A run walks Workspace, then Space, then Folder, then List, before it asks for a single task, and
folderless Lists take their own call. That fixed cost is small on a shallow Workspace and noticeable
on one with hundreds of Lists.

A Schema run stops after that walk, plus the Custom Field definitions, tags and views. It is the
cheap, frequent one. See [Schedule and scope](/backups/schedule-and-scope/).

## Attachments are a separate cost

Files are fetched from the URLs on each task, not from the task endpoints, so they do not spend the
request budget. They do spend time. See [Attachments in ClickUp](/platforms/clickup/attachments/).

## What this looks like in the history

A run that is being paced sits in `running` with its counts still climbing. It is not stuck. See
[Reading a backup run](/backups/reading-a-run/) and
[A run is slow or stuck](/troubleshooting/run-slow-or-stuck/).
