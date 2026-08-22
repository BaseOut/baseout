---
title: Restoring attachments
description: Bringing files back as real attachments, or as links to the copies in your destination.
---

Step four of a restore asks how attachments should come back. Both options carry the number of files
they would act on, counted from the tables you selected, so the choice is not made blind.

## As attachments

The files are re-uploaded into the new tables as real attachments. What you get back stands on its
own: the restored records stop depending on your Destination, and disconnecting that storage later
costs you nothing. This is the default.

## As links

Nothing is re-uploaded. The field is filled with links to the copies already sitting in your
Destination, which is faster and adds no second copy of anything. The trade is a dependency: the
links stop working if that Destination is disconnected, or its files are removed.

## Re-uploading needs files to re-upload

The first option is only available when your Destination actually holds the attachment **files**. A
Space whose backups keep records only has nothing to send back, however many attachments those
records reference. When that is the case the option says so where you would have chosen it, points
at what to switch on, and selects links for you rather than offering to re-upload files it does not
have. Attachments are part of a Space's scope: see
[Schedule and scope](/backups/schedule-and-scope/).

## Which to pick

Take the default unless you have a reason not to. A restore is usually the moment you want the data
to be self-contained, and re-uploading is the option that makes it so.

Reach for links when you would rather the restored tables point at the copies you already keep than
hold a second copy inside the platform, and you are confident the Destination will stay where it is.

## Attachments the backup never captured

An attachment can fail on its own during a backup without failing the run: a file over the size cap,
or a URL that expired mid-run. Those files are not in your Destination, so no restore can bring them
back in either mode.

The run that skipped them reports how many and lists each one with its base, table and reason, and
**Retry failed** re-fetches only those files into the same run. If you are about to restore from a
run with skipped attachments, do that first. See
[Reading a backup run](/backups/reading-a-run/).

## After it runs

The outcome report shows an Attachments figure with the count that landed and the mode it used. The
choice belongs to that restore run and nothing converts one into the other afterwards. Because a
restore never overwrites, running it again with the other option is always possible; it creates
another set of new tables rather than changing the ones you already have.

## Next

- [Restoring a base](/restore/restoring-a-base/): the whole flow, and what needs finishing by hand
- [Destinations](/connections/destinations/): where the copies live
