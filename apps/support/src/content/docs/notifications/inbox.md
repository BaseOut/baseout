---
title: The Inbox
description: What needs your attention, and what merely happened.
sources:
  - apps/web/src/views/InboxView.astro
  - apps/web/src/pages/api/spaces/[spaceId]/inbox.ts
  - apps/web/src/pages/api/spaces/[spaceId]/inbox/triage.ts
  - apps/web/src/pages/api/spaces/[spaceId]/inbox/mute.ts
  - apps/server/src/lib/notifications/derive.ts
---

The Inbox is account-wide and splits into two lanes: **Needs attention** for things you have to act
on — a failed backup, a broken connection, a breaking schema change — and **Activity** for things
that simply happened, rolled up per base so a week of successful backups is one row rather than
seven.

Every row links to the surface where you can act on it. Rows backed by a state, like a broken
connection, clear themselves when the state clears.

## Questions this page will answer

- What is the count badge counting — unread rows, or rows needing a decision?
- What is the difference between Done, Snooze and Mute this base?
- Why did a row disappear without my touching it?
- Which events email me, and which only appear here?
- How do I stop hearing about one noisy base?

## Not written yet

Only the summary above. Which events send email is not specified anywhere.
