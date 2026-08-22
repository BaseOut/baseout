---
title: Comments in Notion
description: Notion returns open comments only, threads them by discussion, and will not let anything start a new inline thread, which is what limits a restore.
platform: notion
---

The steps are the same on every platform. This page covers only what is specific to Notion. For how
captured comments are browsed inside Baseout, see [Comments](/data/comments/).

Notion has two kinds of comment: one attached to a page as a whole, and one anchored inline to a
particular block. Both are threaded, and a thread is called a **discussion**.

## Open comments only

Notion names this among the things its API cannot do: the comments endpoint returns **un-resolved**
comments. A resolved thread is invisible to any integration, so it is not in a backup and no tool
can put it there.

Resolving a thread in Notion therefore removes it from every backup taken afterwards. The ones taken
before it was resolved still hold it, which is a good reason not to treat resolution as deletion.

## They need the capability

Reading comments is a capability chosen when the connection is made, separately from reading
content. A connection without it returns no comments and is otherwise healthy. See
[What a Notion connection can see](/platforms/notion/permissions/).

## What a comment carries

- Its text, as rich text.
- The discussion it belongs to, which is what groups a thread.
- Who wrote it, as far as the connection's user capability allows.
- When it was created.
- Any files attached to it.

## Restoring is bounded by what Notion accepts

Notion's API can add a comment to a page, and it can reply into a **discussion that already exists**.
It cannot start a new one.

That divides the captured comments in two. A page-level thread has somewhere to go. An inline
comment anchored to a block has nowhere to be recreated, because creating the thread is the part the
API will not do.

What does go back is written by the connection. The original author's name can ride along as a
display name, which is a caption on a comment written now, not the person who wrote it then. See
[Restoring Notion data](/platforms/notion/restoring/).
