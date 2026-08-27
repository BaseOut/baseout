---
title: A connection finds nothing
description: A healthy connection that returns no content is a grant problem, not a fault, and each platform hides the grant somewhere different.
sources:
  - apps/web/src/pages/api/connections/airtable/start.ts
  - apps/web/src/lib/airtable/persist.ts
  - apps/server/src/lib/rediscovery/run.ts
---

This is the most confusing failure in the product, because nothing looks broken. The connection says
`connected`. No error is reported. The picker is empty, or the run captured far less than you
expected.

That combination almost always means the same thing: **the connection is fine and the grant is
narrower than you think.** A platform answers a request for something you were not given by saying
there is nothing there, not by refusing.

In this guide, you will:

- Recognize an empty result as a grant problem rather than a fault
- Find where your platform keeps the grant, and widen it there
- Know what Baseout does once the grant is wider

## Check the platform, not Baseout

The grant lives on the platform's side, so widening it is something you do over there and Baseout
notices on the next look. Where to look differs:

### Airtable

Access is granted base by base, or workspace by workspace, by whoever authorized. A base left out of
the grant is invisible to Baseout, which cannot know it exists.

Also check the **scopes**: a connection with `data.records:read` but not `data.recordComments:read`
returns records and no comments, and looks complete otherwise. See
[What an Airtable connection can see](/platforms/airtable/permissions/) and
[My bases are missing from the picker](/troubleshooting/missing-bases/).

### Notion

This is the platform where an empty result is the normal first outcome. A Notion token is not a
grant: the connection starts able to see nothing, and every page or database has to be shared with
it from inside Notion, page by page. Access inherits downward, so sharing high covers a lot.

If a Notion connection finds nothing at all, the shares are missing. That is the answer far more
often than anything else. See
[Sharing with the connection](/platforms/notion/connecting/#sharing-with-the-connection).

### ClickUp

Authorization is Workspace-wide and then bounded by the role of the person who authorized it. A
private Space they cannot open is a Space Baseout cannot know exists, with no error anywhere.

A backup made from a Member's token is a backup of that Member's view, and it will look complete.
See [What a ClickUp connection can see](/platforms/clickup/permissions/).

## The pattern behind all three

The backup sees exactly what was granted, and what was not granted is not reported as missing,
because from the connection's side it does not exist. No tool can list what it was not allowed to
see.

:::note
"The run succeeded" and "everything is backed up" are two different statements. Read what a run
captured, not only its status. See [Reading a backup run](/backups/reading-a-run/).
:::

## After you widen the grant

Nothing needs rebuilding. The new content appears on the next look, and the Space that uses the
Source keeps its scope, schedule and history. Add the newly visible containers to the Space's scope
if you want them backed up. See [Schedule and scope](/backups/schedule-and-scope/).
