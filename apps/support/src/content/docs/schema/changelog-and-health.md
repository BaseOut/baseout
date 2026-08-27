---
title: Schema changelog and Health
description: What changed in your schema, and where the rot is.
sources:
  - apps/web/src/views/schema/ChangelogTab.astro
  - apps/web/src/views/schema/HealthTab.astro
  - apps/server/src/lib/per-space/schema-changelog.ts
  - apps/server/src/lib/per-space/health-scoring.ts
  - apps/workflows/trigger/tasks/health-score-base.ts
---

**Changelog** is a day-grouped feed of schema changes — fields added, removed, renamed or
retyped — diffed between backup snapshots, with a warning marker on changes that may have broken
something downstream.

**Health** grades each base 0–100 with a Green / Yellow / Red band, breaks the score into
categories, and lists the specific issues behind it.

## Questions this page will answer

- Where do the changelog entries come from? (Diffs between backups, not a live Airtable feed.)
- Why does a change carry a warning marker?
- What goes into a health score?
- What counts as Green, Yellow and Red?
- Can I turn off a health rule I do not care about?

## Not built as documented yet

Health today shows grades and issues. Configuring the rules, enabling and disabling individual
metrics, and the Insights layer are specified but not built.
