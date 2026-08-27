---
title: Airtable field types
description: Which Airtable field types hold a value a backup can store, and which are computed and come back only when their inputs do.
platform: airtable
sources:
  - apps/workflows/trigger/tasks/_lib/field-normalizer.ts
  - apps/workflows/trigger/tasks/_lib/field-denormalizer.ts
  - apps/workflows/trigger/tasks/_lib/airtable-client.ts
---

The steps are the same on every platform. This page covers only what is specific to Airtable. For
what a run captures overall, see [What we back up in Airtable](/platforms/airtable/what-we-back-up/).

Airtable calls a column a **Field**, and every field has a `type` that the API reports alongside its
name. A backup stores the type with the schema and the value with the record, so the distinction
that matters is whether there is a value to store at all.

## Stored values

These hold something a person or an integration put there, and a backup captures it as it stands.

`singleLineText` · `multilineText` · `richText` · `email` · `url` · `phoneNumber` · `number` ·
`percent` · `currency` · `duration` · `rating` · `checkbox` · `barcode` · `date` · `dateTime` ·
`singleSelect` · `multipleSelects` · `singleCollaborator` · `multipleCollaborators` ·
`multipleRecordLinks` · `multipleAttachments`

Two of them are worth a note. `multipleRecordLinks` stores record ids rather than the names you see
in the cell, which is why a restore has to repoint them: see
[Airtable record ids](/platforms/airtable/identifiers/). `multipleAttachments` stores file metadata
plus a URL that expires, which is why the bytes are copied: see
[Attachments in Airtable](/platforms/airtable/attachments/).

## Computed values

These are derived by Airtable. The API returns what they currently evaluate to, and a backup stores
that number or string, but the value is an output, not an input.

`formula` · `rollup` · `count` · `lookup` · `multipleLookupValues` · `autoNumber` · `createdTime` ·
`lastModifiedTime` · `createdBy` · `lastModifiedBy` · `button` · `aiText` · `externalSyncSource`

What a backup keeps is the **definition** and the **result at the moment of the run**. A formula
field records its expression, with the fields it references named by id, and the answer it gave. A
rollup records which linked-record field it aggregates over, which field in the linked table it
reads, and the aggregation.

## Why the split matters when you restore

A restore writes records into new tables. A stored value is written straight back. A computed value
cannot be: Airtable recomputes it from whatever the new table contains.

That is fine when the inputs came back too, and it is the source of the three surprises people
actually hit:

- **`autoNumber` restarts.** The new table numbers its own records from the beginning. The original
  numbers are in the backup and are not written back.
- **`createdTime`, `createdBy`, `lastModifiedTime` and `lastModifiedBy` describe the restore.** The
  records were created now, by the connection that ran it.
- **A rollup or lookup pointing outside the restore reads as empty** until the link it depends on is
  repointed, because it works through a `multipleRecordLinks` field.

The outcome report lists every field that could not be rebuilt, so this is not left for you to
discover. See [Restoring a base](/restore/restoring-a-base/).

## Field types Airtable will not create through the API

Restore rebuilds a field only where Airtable's API can create that type. Where it cannot, the column
arrives as plain text holding the backed-up value, so the data is present and the type has to be set
by hand afterwards. The outcome report names each one.

## Field descriptions

A field can carry a description of up to 20,000 characters, and it is part of the schema, so it is
captured and restored with the field. Baseout reads these into the Schema section, where they are
shown as Airtable holds them. See [Browse and descriptions](/schema/browse/).
