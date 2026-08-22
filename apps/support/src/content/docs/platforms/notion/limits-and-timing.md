---
title: How long a Notion backup takes
description: Notion meters per connection and again per workspace, and a page tree has to be walked node by node, which is the real cost.
platform: notion
---

The steps are the same on every platform. This page covers only what is specific to Notion. For what
a run is and what it captures, see [How backups work](/backups/how-backups-work/).

Notion is slower to back up than a table-shaped platform, and the reason is not the rate limit. It
is that a Notion page is a tree, and a tree has to be walked.

## The two ceilings

Notion applies an average of about **three requests a second per connection**, with short bursts
above it tolerated, and a second limit **per workspace** that is shared by every connection in it
and scales with the workspace's plan.

Past either, Notion answers `429` with a `rate_limited` code and a `Retry-After` header saying how
long to wait. It also uses `529` when it is overloaded, which is not your fault and is retried the
same way.

The per-workspace half is the one that surprises people: another integration of yours, or a
colleague's, spends the same budget. A backup that ran in twenty minutes last month and an hour this
month may be sharing the workspace with something new.

## Walking beats listing

Rows in a Notion database come back in pages, at most 100 to a page, which is comparable to any
other platform. The body of a page does not. Blocks are fetched a level at a time: every block that
has children costs another request to reach them, and the tree nests to any depth.

So the cost of a Notion backup tracks the **shape** of your content rather than its volume. A
database of 10,000 short rows is quick. Two hundred long documents full of nested toggles, columns
and synced blocks is not.

## Share high, not widely

Notion guarantees that pages shared **directly** with a connection are returned by search, while
anything reached by inheritance depends on an index it does not promise is complete or immediate. A
tree walked down from one high share is both more reliable and cheaper than a search across many
small ones. See
[Sharing with the connection](/platforms/notion/connecting/#sharing-with-the-connection).

## Files are a separate cost

Notion hands back signed links that expire an hour after they are issued, and the bytes come from
storage rather than from the API, so they do not spend the request budget. The expiry is what
constrains a long run. See [Files in Notion](/platforms/notion/attachments/).

## What this looks like in the history

A run that is being paced sits in `running` with its counts still climbing. It is not stuck. See
[Reading a backup run](/backups/reading-a-run/) and
[A run is slow or stuck](/troubleshooting/run-slow-or-stuck/).
