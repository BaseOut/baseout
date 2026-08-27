---
title: Browse and descriptions
description: Find any base, table or field — and write descriptions against it.
sources:
  - apps/web/src/pages/schema.astro
  - apps/web/src/components/schema/SchemaBrowse.astro
---

Browse is the index of everything Baseout captured: a Tree or Flat list of every base, table, field
and view, with one global search and faceted filters over type, field type, health and description
status. Clicking a row opens a detail panel that drills base → table → field without losing your
place.

Each entity carries two descriptions: `Airtable`, which is the public one and the only one that
syncs back, and `Internal`, which stays inside Baseout. This page will cover both, and the
draft → publish lifecycle an edit goes through.

## Questions this page will answer

- How do I find a field when I only remember part of its name?
- What is the difference between the Airtable and Internal description?
- Which of the two actually writes back to Airtable? (Airtable — Internal never leaves Baseout.)
- What does the `Draft` badge on an entity mean?
- Can I see fields and tables that were removed from Airtable?
- What does the Tagged column count?

## Not written yet

Only the summary above. The description sync lifecycle is faked in the preview build and its real
behaviour depends on backend work that is not done.
