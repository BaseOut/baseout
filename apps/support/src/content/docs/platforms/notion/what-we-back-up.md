---
title: What we back up in Notion
description: The Notion objects a run captures, and the ones Notion's API will not hand over.
platform: notion
---

The steps are the same on every platform. This page covers only what is specific to Notion. For how
a run works, see [How backups work](/backups/how-backups-work/).

Notion's vocabulary does not line up with Airtable's, so start there. A **database** holds one or
more **data sources**, whose **properties** are its columns. Every row is a **page**, and so is a
document that lives on its own. A page has properties and a body, and that body is a tree of
**blocks** which nests to any depth, whole databases included.

That is the difference that matters: an Airtable record is a row of typed fields, so reading it
ends. A Notion page has to be walked.

None of it applies until the integration can see the page. See
[Sharing with the connection](/platforms/notion/connecting/#sharing-with-the-connection).

## Captured

- **Databases and data sources**, with their full property schema.
- **Pages**, with their property values, icon, cover and parent.
- **Page bodies**, walked block by block to the bottom of the tree.
- **Views** on a database, with their type, filter, sorts and layout.
- **Files and media**, from image, file, video and PDF blocks and from files properties. Notion
  hands these over as signed links that expire an hour later, and an expired link fails that file
  and not the run, as an Airtable attachment does.
- **Open comments**, with the thread each belongs to and any files attached.
- **Timestamps and authorship**, created and last-edited, on every page and block, as far as the
  connection's user capability allows.

## Not captured, and why

Every item here is a limit of Notion's API, not a choice of ours.

- **Teamspaces.** A page's parent is a page, a database, a data source, a block or the workspace
  itself. There is no teamspace object, so which teamspace a page sits in is not a fact the API
  will state.
- **Resolved comments.** Notion names this among the things its API cannot do: the comments
  endpoint returns un-resolved comments only.
- **Page history and permissions.** There is no endpoint for a page's earlier versions, and none
  that reports who can see a page. The only access fact is whether your connection reads it.
- **The trash.** A page says whether it is in the trash, but enumerating the trash goes through
  search, which Notion warns is eventually consistent and never exhaustive.

- **Block types the API does not model.** They arrive as type `unsupported`, naming the real type
  (`form` or `button`, for instance). The block's place in the tree is captured; its content does
  not exist to capture.
- **Duplicate synced blocks.** Notion returns a pointer to the original and no text, so a duplicate
  whose original sits outside your shares records only the pointer.

The whole list lives in
[What Baseout cannot capture](/troubleshooting/what-baseout-cannot-capture/).
