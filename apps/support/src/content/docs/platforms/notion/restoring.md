---
title: Restoring Notion data
description: What comes back in Notion, what comes back changed, and what cannot come back at all.
platform: notion
---

The steps are the same on every platform. This page covers only what is specific to Notion. For the
flow itself, see [Restoring a base](/restore/restoring-a-base/).

Restore is best-effort and never overwrites. Baseout writes into new Notion objects, so the
original is still there if the result needs correcting.

## Databases and data sources

A database is recreated with its first data source, and the property schema is written onto it. A
database created through the API has to be parented by a page, so a restore lands under a page you
nominate, not at the top of a workspace.

## Pages and properties

Pages come back as new pages and Notion mints a new id for each. Property values are written with
the page, and rich text is capped at 2,000 characters per item, so anything longer arrives split.

## Page bodies

Blocks are appended in the order they were read. Notion accepts at most 1,000 blocks and 500 KB
per request, so a large page is written in many passes. Blocks captured as `unsupported` cannot be
written back, because there is no type to write them as.

## Relations, rollups and mentions

This is the part to watch. A relation stores page ids, and every restored page has a new one, so
relations between two databases restored together are repointed at the new pages, up to Notion's
limit of 100 per request. Rollups read through their relation and come right once the relations
do.

Inline mentions and pasted page links are different. They sit inside rich text and carry the
original id, so left alone they point at the original page, which still exists. That is the safe
outcome and it is not always the one you want.

## Files

You choose at restore time between re-uploading the files into the new pages and writing links to
the copies in your Destination. Notion takes a single upload up to 20 MiB and splits anything
larger into parts, against a ceiling of 5 MiB per file on a free workspace and 5 GiB on a paid one.
See [Restoring attachments](/restore/attachments/).

## Comments

Only open comments were captured, and only some of those go back. Notion's API can add a comment to
a page or reply into an existing discussion, and it cannot start a new thread, so an inline comment
anchored to a block has nowhere to be recreated. What does return is written by the connection,
though the original author's name can ride along as a display name, which is a caption rather than
the person.

## What cannot come back

Page history, resolved comments, permissions, teamspace placement, unsupported blocks and the
original page ids. A restored page was created now, by the connection, and its created-time says so.
