---
title: Attachments in Airtable
description: Airtable hands back a signed URL that expires two hours later, which is exactly why a backup copies the bytes instead of keeping the link.
platform: airtable
sources:
  - apps/workflows/trigger/tasks/_lib/attachment-downloader.ts
  - apps/workflows/trigger/tasks/_lib/comment-attachments.ts
  - apps/workflows/trigger/tasks/_lib/r2-path.ts
---

The steps are the same on every platform. This page covers only what is specific to Airtable. For
how attachments are browsed inside Baseout, see [Attachments](/data/attachments/).

An Airtable attachment lives in a `multipleAttachments` field. The API returns each file's id,
filename, size, content type, image dimensions where it has them, and a `url`.

## The URL is not the file

That `url` is a signed link on Airtable's own content host, and **it expires two hours after the API
returned it**. Airtable says so plainly and recommends downloading anything you need to keep.

This single fact is the reason a backup stores bytes. A backup that recorded attachment URLs would
be a set of dead links by lunchtime, and it would look correct until the day you needed it, which is
the worst property a backup can have.

So a run fetches every attachment it finds and writes the file into your Destination beside the
record data. What you hold afterwards is a file, not a reference to Airtable.

## What is captured

- The file itself.
- Its filename, size and content type, as Airtable reported them.
- Which record and which field it belonged to.

## What is not captured, and why

**When the file was attached.** Airtable does not report it. An attachment object has no created
timestamp, so no tool can record that date, and Baseout does not invent one. See
[What Baseout cannot capture](/troubleshooting/what-baseout-cannot-capture/).

**Who attached it.** No actor is returned on an attachment, for the same reason the Data changelog
shows what changed and not who changed it.

## Comment attachments expire the same way

A file attached to a record comment carries an id, type, filename and URL, and that URL expires two
hours after it was returned, exactly as a field attachment's does. See
[Comments in Airtable](/platforms/airtable/comments/).

## When a file fails

An attachment fails on its own and does not fail the run. Two things cause it: a file above the
size cap, and a URL that expired mid-run, which is the two-hour window catching up with a long
backup of a very large base.

The run reports each skipped file with its base, table and reason, and **Retry failed** re-fetches
only those into the same run. See [Attachments were skipped](/troubleshooting/attachments-skipped/).

## Putting them back

At restore time you choose between re-uploading files into the new tables as real Airtable
attachments and writing links to the copies already in your Destination. Airtable's direct upload
endpoint accepts a file of up to 5 MB, which is the ceiling on the re-upload path. See
[Restoring attachments](/restore/attachments/).
