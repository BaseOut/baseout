---
title: Comments in Airtable
description: Airtable puts comments on a record, returns them behind their own scope, and gives an author and a date, which is more than it gives for anything else.
platform: airtable
sources:
  - apps/workflows/trigger/tasks/_lib/record-comments.ts
  - apps/workflows/trigger/tasks/_lib/comment-attachments.ts
  - apps/server/src/lib/per-space/comments-sync.ts
---

The steps are the same on every platform. This page covers only what is specific to Airtable. For
how captured comments are browsed inside Baseout, see [Comments](/data/comments/).

An Airtable comment belongs to a **record**. There is no comment on a field, a table or a base, so
the whole comment story hangs off the record it sits on.

## They need their own scope

Comments are read through `data.recordComments:read`, which is granted separately from
`data.records:read`. A connection with records but not comments is a normal, healthy connection that
returns no comments at all.

If a backup arrived complete except for comments, that scope is the first thing to check rather than
the run. See [What an Airtable connection can see](/platforms/airtable/permissions/).

## What a comment carries

- Its text.
- Its author.
- When it was created, and when it was last updated.
- Who was mentioned in it.
- Any files attached to it.

An author and a timestamp are worth pausing on, because Airtable gives neither for a record change:
the Data changelog shows what changed and not who changed it. Comments are the one place Airtable
does report a person, which makes them the closest thing to an activity record a backup can hold.

## Comment attachments expire too

A file on a comment comes back with an id, type, filename and URL, and that URL expires two hours
after the API returned it, exactly as a field attachment's does. The bytes are copied for the same
reason. See [Attachments in Airtable](/platforms/airtable/attachments/).

## What happens when one is deleted

A deleted comment stops being returned. It is in the backups taken before the deletion and not in
the ones taken after, which is why Baseout marks a captured comment `Deleted` rather than removing
it: the backup is a record of what was there. A comment whose record has since gone reads
`Record deleted`. See [Comments](/data/comments/).

## Restoring

Comments are not recreated by a restore. A restored record is a new record, and Airtable's
create-comment call writes as the connection, dated now, so a rebuilt thread would be a fabrication
of who said what when. The comments stay readable in the backup instead.
