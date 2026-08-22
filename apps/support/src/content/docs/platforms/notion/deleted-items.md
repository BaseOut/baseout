---
title: Deleted pages in Notion
description: Notion keeps a deleted page addressable and flags it as being in the trash, but enumerating the trash goes through a search it does not promise is complete.
platform: notion
---

The steps are the same on every platform. This page covers only what is specific to Notion. For what
a run captures, see [What we back up in Notion](/platforms/notion/what-we-back-up/).

Notion is the one platform of the three where a deleted object does not immediately vanish from the
API, which sounds better than it is.

## In the trash, and still addressable

A deleted Notion page is moved to the trash rather than removed. The page object still comes back
when asked for by id, and it says that it is in the trash. That flag is captured, so a backup can
record that a page existed and had been deleted by the time the run reached it.

## Finding them is the problem

Knowing a page is in the trash is not the same as being able to list what is in there. Notion's
search is what enumerates pages, and Notion is explicit that search is eventually consistent and is
not guaranteed to return everything a connection can reach.

So a trashed page whose id you already hold is readable, and the trash as a whole is not
enumerable. In practice that means a backup finds a deleted page only if it had seen the page
before, which is another way of saying: what protects you is the earlier run, not the trash.

## Access follows the page

A page moved out of a shared parent, deleted or otherwise, takes the connection's access with it.
Notion answers a request for something unshared with an empty result rather than an error, so a page
that has been moved and a page that has been deleted look alike from outside. See
[What a Notion connection can see](/platforms/notion/permissions/).

## This is what retention is for

Retention decides how far back you can reach. A deletion nobody noticed for three weeks needs a
backup older than three weeks, and the tiered schedule is what keeps one. See
[Retention and cleanup](/backups/retention-and-cleanup/).

## Getting one back

Restore writes new pages and never over the original. A restored page is a new page with a new id,
under a parent you nominate, and its created-time says it was made now. See
[Restoring Notion data](/platforms/notion/restoring/).
