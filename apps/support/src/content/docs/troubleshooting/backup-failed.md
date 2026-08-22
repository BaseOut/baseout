---
title: My backup failed
description: Reading a failed run and working out whether it will fix itself.
---

A failed run shows up in three places: as a row in the Space's backup history, as a row in the
Inbox, and — if the cause was the connection — as a banner on the Space. Opening the run shows which
bases completed and which did not.

This page will be the triage guide: read the run, identify the cause, decide whether to wait for the
next scheduled run or act now.

## Questions this page will answer

- Where do I find out why it failed?
- "3 of 12 bases incomplete" — was anything saved?
- Airtable rate limits: what are they and can I avoid them?
- A base was deleted mid-run — what happens to the rest?
- Will the next scheduled run pick up what this one missed?

## Not written yet

The failure-cause catalogue is the whole point of this page and does not exist yet. It has to come
from the engineer — the error strings the backup engine actually emits.
