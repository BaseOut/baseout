---
title: Comments
description: Record comments captured by the backup.
sources:
  - apps/web/src/components/data/DataComments.astro
  - apps/web/src/pages/api/spaces/[spaceId]/data/comments.ts
  - apps/server/src/lib/per-space/comments-read.ts
  - apps/workflows/trigger/tasks/_lib/record-comments.ts
---

The Comments tab is a stream of the comments Baseout captured, filterable and groupable, with each
comment linking to the record it sits on. A comment carries one of three statuses: `Active`,
`Deleted` (the comment was deleted) and `Record deleted` (the record it belonged to is gone).

This page will explain those three statuses, how comment authors appear, and why the author is
sometimes a name and sometimes an email address.

## Questions this page will answer

- What is the difference between `Deleted` and `Record deleted`?
- Why do some comments show a name and others an email?
- Can I read a whole thread rather than one comment?
- Are comment attachments captured too?
- How long are deleted comments kept?

## Not written yet

Only the summary above. Comment retention is an open decision, not a documented behaviour.
