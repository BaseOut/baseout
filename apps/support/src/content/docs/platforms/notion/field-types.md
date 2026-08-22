---
title: Notion property types
description: Which Notion properties hold a value a backup can store, which Notion computes, and why the page body is a separate problem from the properties.
platform: notion
---

The steps are the same on every platform. This page covers only what is specific to Notion. For what
a run captures overall, see [What we back up in Notion](/platforms/notion/what-we-back-up/).

Notion calls a column a **Property**, and properties belong to a data source inside a database.
Every page in that data source has a value for each of them, plus a **body** that no property
describes. The body is the part with no equivalent anywhere else, and it is covered in
[What we back up in Notion](/platforms/notion/what-we-back-up/).

## Stored values

These hold something someone put there, and a backup captures it as it stands.

`title` · `rich_text` · `number` · `select` · `multi_select` · `status` · `date` · `people` ·
`files` · `checkbox` · `url` · `email` · `phone_number` · `relation` · `location` · `place`

Three need a note:

- **`relation`** stores page ids, not titles. It is the property a restore has to repoint, and
  Notion accepts at most 100 relation targets per request. See
  [Notion page ids](/platforms/notion/identifiers/).
- **`files`** stores file metadata and a link that expires an hour after Notion issues it, which is
  why the bytes are copied rather than the link. See [Files in Notion](/platforms/notion/attachments/).
- **`people`** returns as much about each person as the connection's user capability allows, which
  may be a name and an id with no email address at all. See
  [What a Notion connection can see](/platforms/notion/permissions/).

## Computed values

Notion derives these. The API reports what they currently evaluate to, and a backup stores that, but
none of them is an input.

`formula` · `rollup` · `created_time` · `created_by` · `last_edited_time` · `last_edited_by` ·
`unique_id` · `button` · `verification` · `last_visited_time`

The **definition** is kept as well as the result: a formula records its expression, a rollup records
the relation it reads through and what it aggregates.

## Size limits that shape what comes back

Notion caps individual values, and the caps apply when writing as much as when reading:

| Value | Cap |
| --- | --- |
| Rich text content, and URLs | 2,000 characters |
| Equation expressions | 1,000 characters |
| Email and phone number | 200 characters |
| Blocks, multi-select options, relations, people, per request | 100 items |
| Request payload | 500 KB |

A page longer than 2,000 characters in one rich text item comes back split across several items.
That is Notion's shape, not a truncation, and it is restored the same way.

## Why the split matters when you restore

A restore creates new pages, and Notion mints a new id for each. Stored values are written back.
Computed values are recomputed:

- **`unique_id` restarts.** The new data source numbers its own pages.
- **`created_time`, `created_by`, `last_edited_time` and `last_edited_by` describe the restore.**
  The pages were created now, by the connection.
- **A rollup reads through its relation**, so it comes right only once the relations are repointed.

See [Restoring Notion data](/platforms/notion/restoring/).
