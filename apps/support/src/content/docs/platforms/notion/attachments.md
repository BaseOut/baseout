---
title: Files in Notion
description: Notion issues links that expire an hour after they are handed over, so a long run has to re-ask, and a backup keeps the bytes rather than the link.
platform: notion
---

The steps are the same on every platform. This page covers only what is specific to Notion. For how
files are browsed inside Baseout, see [Attachments](/data/attachments/).

Files reach a Notion backup from two places: **`files` properties** on a page, and **blocks** in the
page body that carry a file, which means image, file, video, audio and PDF blocks.

## Notion-hosted against external

Notion draws a line a backup has to respect.

A **Notion-hosted** file was uploaded into Notion. The API returns it with a `url` and an
`expiry_time`, and the URL is valid for **one hour** from the moment it was issued. Notion's own
guidance is to re-fetch the file object for a fresh URL if the old one expires.

An **external** file was linked into Notion from somewhere else. Notion returns the address you gave
it and nothing more. There is no expiry because there is no signature: the file is not Notion's, and
whether it is still there is not a question Notion can answer.

Both are captured, and they are captured differently. A Notion-hosted file is downloaded and stored
in your Destination. An external file is recorded as the address Notion holds, because copying
somebody else's URL is not the same act as copying Notion's own content, and the address is what
Notion would give back.

## One hour is shorter than a long run

An hour is a real constraint on a large workspace, and it is why the expiry is worth knowing rather
than a footnote. A file whose URL was issued early in a run and fetched late in one can expire in
between. That file fails on its own and does not fail the run, and re-asking Notion produces a fresh
link. See [Attachments were skipped](/troubleshooting/attachments-skipped/).

## What is captured

- The file itself, for Notion-hosted files.
- Its name and type as Notion reported them.
- Which page, and which property or block, it belonged to.
- The original address, for external files.

## Putting them back

At restore time you choose between re-uploading files into the new pages and writing links to the
copies in your Destination. Notion takes a single upload of up to 20 MiB and splits anything larger
into parts, against a ceiling of 5 MiB per file on a free workspace and 5 GiB on a paid one. See
[Restoring attachments](/restore/attachments/).
