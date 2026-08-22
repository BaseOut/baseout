---
title: Restoring Airtable data
description: What comes back intact in Airtable, by data type, and what needs a hand afterwards.
platform: airtable
---

The steps are the same on every platform. This page covers only what is specific to Airtable. For
the flow itself, see [Restoring a base](/restore/restoring-a-base/).

Restore is best-effort and it never overwrites. Baseout writes into new tables, either in an
existing base or in a new one, so the original is still there if the result needs correcting.

## Bases

Restore is base by base. You cannot restore a whole Source in one action.

## Tables

Tables come back as new tables. You choose which of the base's tables to bring back; all of them is
the default.

## Fields

Field names and types are rebuilt where Airtable's API can create them. The ones it cannot create
are the ones that need a manual touch-up afterwards, and
[Restoring a base](/restore/restoring-a-base/) is where that is dealt with, field type by field
type.

## Records

Records are recreated as new records, and Airtable mints a new record id for each one. Links between
two tables restored together are therefore the first thing to check, because a link points at a
record id rather than at a name.

A link out to a table that was not part of the restore keeps pointing at the original, which still
exists. That is usually what you want, and it is worth knowing before you go looking for it.

## Attachments

You choose at restore time between re-uploading the files into the new tables as real Airtable
attachments, and writing links to the copies already sitting in your Destination. See
[Restoring attachments](/restore/attachments/).

## Views, automations and interfaces

None of these come back, because none of them was captured. Airtable's API does not export
automations or interfaces, and a view's filters and sorts were never available to read in the first
place. A restored base carries the default view of each new table and nothing more.
