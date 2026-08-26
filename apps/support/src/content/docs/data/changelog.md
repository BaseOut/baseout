---
title: Data changelog
description: What changed in your records between one backup and the next.
---

The Data changelog is a table of backup runs with the record changes each one saw — `Created`,
`Updated` and `Deleted` — plus an `Attention` flag on runs that look unusual, such as a mass delete or
an import spike. Opening a run drills into the individual records that changed.

This is derived by comparing consecutive backups, so it shows *net* change between snapshots, not
every edit that happened in between.

## Questions this page will answer

- Why does the changelog not show every edit?
- What triggers an `Attention` flag?
- Who made a change? (Baseout does not know — Airtable does not give us an actor.)
- Why do the counts drop when I filter?
- How do I get from a changed record back to the run it came from?

## Not written yet

Only the summary above.
