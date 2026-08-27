---
title: Baseout is live
description: The first release — Airtable backup on a schedule you set, restore into new tables, and a way to read everything a run captured.
lastUpdated: 2026-08-27
# DRAFT until go-live: `draft: true` excludes this page from production builds
# (Starlight-owned key). At launch: set lastUpdated to the real launch date,
# delete the draft line, review the copy against what actually ships that day,
# and fold in the accumulated candidates from
# plans/2026-08-26-support-docs-automation.md § Changelog candidates.
draft: true
---

This is the first entry, so it is the whole product at once. From here, entries get smaller: one
change, what it does, where to find it.

## Back up Airtable on your schedule

Connect an Airtable account once, choose the bases a Space covers, and pick how deep each run goes —
schema only, or schema and data, on cadences you set separately. Runs start themselves on the
schedule, or right now from [Running a backup](/backups/running-a-backup/). Every run keeps its own
record: what it captured, table by table, down to [the row](/backups/reading-a-run/).

## What a backup actually holds

Structure, records, comments, and attachment files — captured read-only, so a backup can never
change the base it reads. The honest limits are written down too:
[what Baseout cannot capture](/troubleshooting/what-baseout-cannot-capture/).

## Put it back

[Restore a base](/restore/restoring-a-base/) from any successful run — always into new tables,
never over your live data.

## Read what you captured

[Browse the schema](/schema/browse/) of everything backed up, and the records, comments, and
attachments inside each run.

## Getting in touch works before your account does

[The contact page](/contact/) takes a question with no sign-in required, and answers arrive by
email from a person. The chat assistant answers from these docs.
