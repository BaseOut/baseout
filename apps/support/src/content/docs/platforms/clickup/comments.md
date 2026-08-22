---
title: Comments in ClickUp
description: ClickUp puts comments on tasks, Lists and Chat views, threads them, and accepts them back without an author or a date.
platform: clickup
---

The steps are the same on every platform. This page covers only what is specific to ClickUp. For how
captured comments are browsed inside Baseout, see [Comments](/data/comments/).

ClickUp is the most talkative of the three platforms, and a backup that captured only task comments
would miss most of the conversation.

## Three places a comment lives

- **On a task.** The ordinary case.
- **On a List.** ClickUp's List comments are their own thing, addressed through the List rather than
  through any task in it.
- **In a Chat view.** A Chat view is a conversation attached to a container.

All three are captured, along with **threaded replies**, so a thread comes back as a thread rather
than as a flat run of messages.

## What a comment carries

- Its text.
- Who wrote it.
- When it was written.
- Who it was assigned to, where a comment was turned into an action.
- Any files attached to it.

A ClickUp comment can be **assigned**, which no other platform here does. It is closer to a small
task than to a note, and the assignment is part of what is captured.

## Restoring loses the attribution

ClickUp's create-comment call accepts the text, an assignee and a notification flag. It does not
accept an author and it does not accept a date.

So a restored thread is written by the account that authorized the connection, dated now. It reads
correctly and it is not a record of who said what when. If the attribution is the point, the backup
is where it is preserved. See [Restoring ClickUp data](/platforms/clickup/restoring/).

## What has no comments at all

A Whiteboard's contents are not reachable through ClickUp's public API, so nothing said on one is
captured. See [What we back up in ClickUp](/platforms/clickup/what-we-back-up/).
