---
title: Cancelling
description: What stops when you cancel, what does not, and why the backups you already have are unaffected either way.
---

Cancelling ends the commercial relationship. It is an admin act, and it is a different act from
deleting your account or ending your organization. See
[Deleting your account](/account/deleting-your-account/).

## What stops

Scheduled runs. A Space that is not on an active plan does not keep backing up on its cadence, which
is the whole substance of a cancellation and the thing to plan around.

## What does not stop

**Your backups are yours.** Every run wrote to **your** Destination: your Google Drive, your Dropbox,
your Box, your S3 bucket, your Postgres. Those files are in your own storage under your own
credentials, and cancelling Baseout does not reach into them. Baseout does not hold your backups
hostage, and that is a design position rather than a concession. See
[Destinations](/connections/destinations/).

The exception to notice is a **Baseout-managed store**, where the storage is ours rather than yours.
If that is where your backups live and you are cancelling, move them or point the Space at your own
storage first. That is the single action on this page that is genuinely urgent.

## Before you cancel

1. **Check where the files actually are.** Open a recent run: it names the destination and gives the
   folder path per base. See [Reading a backup run](/backups/reading-a-run/).
2. **Take a final run** if the last one is old, so what you keep is current.
3. **Deal with a managed store**, per above.
4. **Decide about the connections.** A Source is a grant on the platform's side, and revoking it
   there is your action rather than ours. See
   [Reconnecting a broken connection](/connections/reconnecting/) for where the grant lives on each
   platform.

## Coming back

Nothing about the arrangement above makes returning hard: the Sources are re-authorized, the
Destination is the same storage it was, and the Spaces are rebuilt around them. What does not
survive is the schedule running while you were away, which is to say the backups that were never
taken.

## What is not settled yet

Whether cancelling takes effect immediately or at the end of the period, what happens to the backup
history afterwards, and how long an account stays recoverable are not decided. Those are commercial
answers Baseout owes rather than ones this page can invent.

To cancel today, [contact us](/contact/?kind=ticket) from the account's address.
