---
title: Attachments in ClickUp
description: ClickUp holds files in two places, on the task and on a File Custom Field, and both are captured as bytes rather than as links.
platform: clickup
---

The steps are the same on every platform. This page covers only what is specific to ClickUp. For how
attachments are browsed inside Baseout, see [Attachments](/data/attachments/).

ClickUp attaches files at two levels, and a backup that reads only one of them silently misses the
other.

**On the task.** The ordinary case: files dropped onto a task, listed with the task itself.

**On a File type Custom Field.** A Custom Field can be a file holder in its own right. Its files are
addressed through the field rather than through the task, which is why they are fetched separately.

## What is captured

- The file itself, in both places.
- Its title, extension and version, as ClickUp reported them.
- The date ClickUp records against the attachment, which is one thing Airtable does not give at all.
- Which task, or which Custom Field on which task, it belonged to.

## The bytes, not the address

As on every platform, the run downloads files into your Destination rather than storing a link to
ClickUp. A link would depend on the connection surviving, and the point of a backup is that it does
not depend on the connection surviving.

## When a file fails

A file fails on its own and does not fail the run. The run reports each skipped file with its
container, task and reason, and **Retry failed** re-fetches only those into the same run. See
[Attachments were skipped](/troubleshooting/attachments-skipped/).

## Putting them back

At restore time you choose between re-uploading files onto the new tasks and writing links to the
copies in your Destination.

Two ClickUp specifics apply on the re-upload path. Uploads are `multipart/form-data` and take the
file bytes, so a file already in cloud storage cannot be handed over as a URL: it has to be sent,
which is what your Destination copy is for. And ClickUp refuses the upload once the Workspace's
storage allowance is spent, which is a Workspace setting rather than anything a restore can work
around. See [Restoring attachments](/restore/attachments/).

## Whiteboards are not attachments

A Whiteboard looks like content with files in it and is not reachable at all: ClickUp's public API
has no Whiteboard endpoint. Nothing in it is captured, files included. See
[What we back up in ClickUp](/platforms/clickup/what-we-back-up/).
