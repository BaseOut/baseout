---
title: Airtable record ids
description: Every Airtable object carries a prefixed id, links are stored as those ids, and a restore mints new ones, which is the whole reason links need repointing.
platform: airtable
sources:
  - apps/workflows/trigger/tasks/_lib/field-normalizer.ts
  - apps/workflows/trigger/tasks/_lib/field-denormalizer.ts
  - apps/workflows/trigger/tasks/_lib/airtable-create.ts
---

The steps are the same on every platform. This page covers only what is specific to Airtable. For
the restore flow itself, see [Restoring a base](/restore/restoring-a-base/).

An id is the thing a backup can match a row by, so it decides what a restore is able to reconnect
and what it cannot. Airtable's are readable, which is useful when you are looking at raw backup
output and trying to work out what you are holding.

## Shape

Every Airtable id is a three-letter prefix followed by fourteen characters, seventeen in all, and
the prefix says what kind of object it is.

| Prefix | Object | Example |
| --- | --- | --- |
| `app` | Base | `appLkNDICXNqxSDhG` |
| `tbl` | Table | `tblXXXXXXXXXXXXXX` |
| `fld` | Field | `fldXXXXXXXXXXXXXX` |
| `viw` | View | `viwXXXXXXXXXXXXXX` |
| `rec` | Record | `rec560UJdUtocSouk` |
| `att` | Attachment | `att00000000000000` |
| `usr` | User | `usrL2PNC5o3H4lBEi` |

A base id is what you see in an Airtable URL, so a folder in your Destination named after one can be
matched to the base it came from by eye.

## Ids are how Airtable refers to itself

This is the part with consequences. Where a name appears on screen, an id is usually what is stored:

- A **linked record** field stores `rec` ids. The names in the cell are looked up for display.
- A **formula** returned by the API names its inputs by field id, not by field name, so
  `LEFT(4, {Birthday})` in the editor comes back as `LEFT(4, {fldXXXXXXXXXXXXXX})`.
- A **rollup** or **lookup** identifies both the linked-record field and the field it reads by id.

Renaming a field in Airtable therefore breaks nothing, and a backup taken before the rename still
matches the one taken after.

## A restore mints new ids

Airtable assigns a record id when it creates the record, and there is no way to ask for a particular
one. A restored record is a new record with a new `rec` id, and so is every restored table and field.

Everything follows from that:

- **Links between two tables restored together are repointed** to the new records, because both ends
  of the link are in the restore and can be matched.
- **A link out to a table that was not restored keeps pointing at the original**, which still exists.
  That is usually what you want, and it is worth knowing before you go looking for it.
- **An `autoNumber` field restarts.** The new table numbers from the beginning.
- **Anything outside Airtable that stored a record id no longer resolves.** A URL you bookmarked, a
  reference in another system, a webhook payload you kept: they point at the original record, not
  the restored one.

## If you need your own stable key

Airtable's ids are the platform's, and a restore cannot preserve them. If matching a restored row
back to an external system matters to you, keep your own identifier in an ordinary field. A stored
value comes back exactly as it was: see [Airtable field types](/platforms/airtable/field-types/).

## Next steps

- [Restoring Airtable data](/platforms/airtable/restoring/): what comes back, type by type
- [Restoring a base](/restore/restoring-a-base/): the flow, and the outcome report
