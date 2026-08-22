---
title: What we back up in ClickUp
description: The ClickUp objects a run captures, and the ones ClickUp's API will not hand over.
platform: clickup
---

The steps are the same on every platform. This page covers only what is specific to ClickUp. For
how a run works, see [How backups work](/backups/how-backups-work/).

Fix one collision before anything else: **ClickUp calls one of its levels a Space, and so does
Baseout.** A Baseout Space is a backup configuration; a ClickUp Space is a container inside a
ClickUp Workspace, and on this page Space always means ClickUp's.

The hierarchy runs Workspace, Space, Folder, List, Task, Subtask. Folders are optional: a List can
sit directly in a Space, and ClickUp has a separate endpoint for exactly those. Its older v2
endpoints call a Workspace a "Team", so a `team` id and a Workspace id are the same number.

## Captured

- **Workspaces, Spaces, Folders and Lists**, including subfolders and folderless Lists.
- **Tasks and Subtasks**, with status, priority, assignees, watchers, dates, time estimates, points
  and custom task type.
- **Custom Fields**, both the definitions (declared at List, Folder, Space or Workspace level) and
  the values sitting on each task.
- **Tags**, which in ClickUp belong to a Space and are applied to tasks.
- **Checklists** on a task, with their items.
- **Task relationships**: dependencies and linked tasks, both of which ClickUp returns on the task.
- **Comments** on tasks, Lists and Chat views, including threaded replies.
- **Attachments** on tasks and on File Custom Fields, fetched and stored beside the data.
- **Time tracking** entries, read per assignee across a date range.
- **Views**, with their type, filters, sorting, grouping and columns.
- **Docs**, their page listing, and each page's content.
- **Goals** and their Key Results.

Structure is what a Schema run takes: the hierarchy, Custom Field definitions, tags and views. Tasks
and their values are Data, and files are Attachments. See
[Schedule and scope](/backups/schedule-and-scope/).

## Not captured, and why

Every item here is a limit of ClickUp's API rather than a choice of ours.

- **Dashboards and Automations.** ClickUp's public API has no endpoint for either. The only place an
  Automation surfaces is an outbound webhook payload, which says a rule ran and is not the rule.
- **Whiteboards.** ClickUp states that page views, meaning Docs and Whiteboards, are not supported
  through the public API. Docs got their own endpoints later; Whiteboards have none.
- **A task's activity history.** Nothing returns who changed a field and when. Time in status is the
  single historical figure ClickUp exposes.
- **Most of a Doc's formatting.** ClickUp publishes the losses: toggle lists, checklists, banners
  and alignment are not represented, every embed is dropped (YouTube, Loom, Miro, the Google
  formats, embedded tasks, Docs and Whiteboards, org charts), and code blocks keep their text but
  lose their formatting. The words survive; the layout does not.

The whole list lives in
[What Baseout cannot capture](/troubleshooting/what-baseout-cannot-capture/).
