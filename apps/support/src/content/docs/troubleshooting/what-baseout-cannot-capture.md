---
title: What Baseout cannot capture
description: The honest limits — most of them Airtable's, not ours.
---

Some things cannot be backed up because Airtable's API does not expose them. This page will be the
single, blunt list, so nobody discovers a gap during a restore.

Verified limits so far:

- **Automations and interfaces** cannot be exported by the API. Baseout lets you record them by hand
  in the Schema section, but that is documentation, not a backup, and restoring will not recreate
  them.
- **A view's filters and sorts** are not available. Airtable returns a view's id, name and type, and
  its visible field ids only for grid views.
- **Attachment timestamps** do not exist. Airtable does not report when a file was attached, so
  Baseout cannot show that date.
- **Who made a change** is not available, which is why the Data changelog shows what changed but not
  who changed it.
- **Restore is best-effort.** Records come back; some field types and relationships may need a
  manual touch-up.

## Questions this page will answer

- Is this list complete? (Not yet — see below.)
- Which of these are Airtable's limits and which are ours?
- Is there a workaround for any of them?
- What should I keep a separate copy of?

## Not complete

The five items above are the ones verifiable from the project's own research and specifications.
Whether that is the whole list needs confirming with the engineer before this page is published —
an incomplete list here is worse than no list.
