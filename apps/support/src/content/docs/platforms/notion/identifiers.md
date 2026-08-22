---
title: Notion page ids
description: Notion identifies everything by UUID, relations and mentions store those UUIDs, and a restore mints new ones, which splits what can be repointed from what cannot.
platform: notion
---

The steps are the same on every platform. This page covers only what is specific to Notion. For the
restore flow itself, see [Restoring a base](/restore/restoring-a-base/).

An id is the thing a backup can match a row by, so it decides what a restore is able to reconnect.
Notion's are UUIDs, which are precise and tell you nothing by looking at them.

## Shape

Every page, database, data source, block, user and comment is identified by a **UUID**: thirty-two
hexadecimal characters, which Notion accepts either dashed or run together. The id at the end of a
Notion URL is the same id the API uses.

There is no prefix and no type marker, so a UUID alone does not say whether it names a page, a block
or a data source. In backup output the object's position says it instead.

## `unique_id` is not an id

Notion also offers a `unique_id` property, which gives each page in a data source a readable number
with an optional prefix. It is a display convenience: it is scoped to the data source, and Notion
assigns it. A restore cannot set it, so a restored data source numbers its pages from the beginning.

## What stores a UUID

- A **relation** property stores page ids. Notion accepts at most 100 of them per request.
- A **rollup** reads through a relation, so it depends on those ids indirectly.
- **Mentions and pasted page links** inside rich text carry the original page id, in the body text
  rather than in a property.
- A **block's parent** is a UUID, which is what makes a page body a tree.

## A restore mints new ids

Notion assigns a UUID when it creates the object, and it cannot be asked for a particular one. Every
restored page is a new page with a new id.

The important consequence is that Notion splits into two halves here:

**Repointed.** Relations between two databases restored together are rewritten to the new pages,
because both ends are in the restore.

**Not repointed.** Inline mentions and pasted links sit inside rich text and keep the original id,
so they go on pointing at the original page, which still exists. That is the safe outcome and it is
not always the one you want: a restored workspace can read correctly while quietly referring back to
the pages it was restored from.

Nothing detects this for you. If the originals are gone, those mentions are broken links; if they
are still there, the restored pages are cross-linked to them.

## Also new

- **`created_time` and `created_by`** describe the restore. The page was created now, by the
  connection.
- **A database restored through the API is parented by a page**, so a restore lands under a page you
  nominate rather than at the top of a workspace.

## Next

- [Restoring Notion data](/platforms/notion/restoring/): what comes back, and what comes back changed
- [Restoring a base](/restore/restoring-a-base/): the flow, and the outcome report
