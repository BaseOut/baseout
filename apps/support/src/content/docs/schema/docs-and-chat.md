---
title: Schema docs and Chat
description: Long-form documentation about your schema, and asking questions of it.
sources:
  - apps/web/src/views/schema/DocsTab.astro
  - apps/web/src/components/islands/DocsTab.tsx
  - apps/web/src/pages/api/spaces/[spaceId]/documents.ts
  - apps/web/src/pages/api/spaces/[spaceId]/chat/send.ts
  - apps/workflows/trigger/tasks/chat-respond.ts
---

**Docs** is for writing documentation *about* the schema — longer than a field description. It is a
two-pane editor with inline entity tags, a links panel and saved diagrams; tagging works in both
directions, so an entity shows the documents that mention it.

**Chat** is an assistant scoped to your Space's schema, with replies that link to the entities and
documents they cite, and an option to turn an answer into a document.

## Questions this page will answer

- When should something be a doc rather than a field description?
- What does an @-tag do?
- What does Chat actually see — my schema, my records, or both?
- Can I export or share a doc?
- Which plan includes Chat?

## Not built as documented yet

Chat is a faked assistant in the preview build. Real streaming, thread history, error states and an
out-of-credits state are not built. The plan requirement is unconfirmed.
