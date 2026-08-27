---
title: My bases are missing from the picker
description: Airtable access scopes, and what Baseout can and cannot see.
sources:
  - apps/server/src/lib/rediscovery/run.ts
  - apps/web/src/pages/api/spaces/[spaceId]/rescan-bases.ts
  - apps/web/src/components/schema/workspaceGroups.ts
  - apps/web/src/views/IntegrationsManageBasesView.astro
---

Baseout can only see the bases Airtable tells it about. If you granted access to specific bases
rather than a whole workspace, the rest are invisible to Baseout — it cannot know they exist.

There is a second, subtler case: with limited access Airtable returns a workspace's ID but withholds
its **name**, so the picker groups bases under a workspace it cannot name. That is a limit of
Airtable's API, not a bug.

## Questions this page will answer

- How do I grant Baseout access to more bases?
- Why is a group in the picker called "No workspace"?
- Why does one workspace show a name and another does not?
- I added a base in Airtable — when does Baseout notice?
- Does adding a base to a backup re-backup its history?

## Not written yet

Only the summary above.
