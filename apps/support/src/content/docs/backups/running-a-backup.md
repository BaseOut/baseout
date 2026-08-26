---
title: Running a backup now
description: Starting an off-schedule run, pausing or cancelling one in flight, and why a run cannot be deleted.
api:
  - summary: Start a backup run on a Space
  - summary: Cancel a run that is in flight
---

**Run backup now** starts a backup immediately instead of waiting for the next scheduled run.

In this guide, you will:

- Start an off-schedule run, and know what it costs before you confirm
- Pause and resume a run, or cancel it for good
- Understand why a run can never be deleted from the history

## When you would use it

Before a change you cannot undo — a bulk import, a script, a contractor's first day in the base, a
field type you are about to convert. The scheduled run is a floor, not a ceiling; an off-schedule
run is how you put a known-good point immediately before a risky one.

## Where the action lives

Run backup now is a **Space-level** action. You will find it in the Space Home rail, and in the
Backups page header and its empty state.

It is deliberately **not** offered per row in the run history. A row is a record of something that
already happened, and a "run again" button on a log entry invites you to think of a past run as
something you can re-do. You cannot. Starting a new run is a new decision, taken at the top.

## It asks first, because it costs

An off-schedule run consumes additional credits. So the action opens a confirmation stating that,
with **Cancel** and **Run anyway**. Nothing starts until you confirm; dismissing the confirmation
leaves the Space exactly as it was.

The credit arithmetic — how many, and against what allowance — depends on the plan model, which is
not settled. This page will carry the numbers once they exist rather than guess at them now.

## Controlling a run in flight

A running backup has exactly two controls, and both act only while it is still going.

### Pause and Restart

Pausing holds the run where it is. Restarting **resumes from where it stopped** rather than
starting over, so a long backup you paused to free up bandwidth does not throw away an hour of
work.

Pausing asks for confirmation and notes that the run can be resumed at any time. Resuming does not
ask — there is nothing to warn about.

### Cancel

Cancelling stops the run for good. **The data captured so far is kept**, not discarded: the bases
that finished before you cancelled remain backed up, and the run is recorded with a
[`cancelled`](/reference/statuses/#cancelled) status and whatever counts it reached.

Cancel asks for confirmation too, and its confirmation says the part already written is kept and
**cannot be resumed**.

:::note
Pause is a comma, Cancel is a full stop. There is no way back from a cancelled run — to cover the
rest of the data you start a new one, which costs credits again.
:::

:::note
Controlling a run is gated by role. A viewer-role member can read a running run in full detail but
cannot pause, resume, or cancel it. Only roles permitted to manage the Space can act on a run.
:::

## Why you cannot delete a run

There is no Delete on a run, finished or failed, and no way to remove one from the history.

The backup history is an audit trail. It is what you point at to show a backup ran on a given day,
what it captured, and where it wrote — for a compliance question, for your own peace of mind, or
attached to a support ticket. **A log that can be pruned is not evidence of anything.** So a run,
once recorded, stays recorded.

This is separate from how long the backed-up *data* lives. Runs are permanent entries; the data
they wrote is thinned over time by the cleanup schedule, which is the only mechanism in Baseout
that removes backed-up data. See [Retention and cleanup](/backups/retention-and-cleanup/).

## When a run partly succeeds

Two outcomes look like failure and are not.

**Attachments that could not be fetched.** A file over the size cap, or an Airtable URL that
expired mid-run, fails on its own without failing the run. The run reports the count, lists each
failed file with its base, table, and reason, and offers **Retry failed** — which re-fetches only
those files into the *same* run. It does not start a new one.

**A run that failed on one base.** The bases that completed before the failure still wrote their
data, and the history still shows their counts. A [`failed`](/reference/statuses/#failed) status
means the run did not finish, not that it achieved nothing.

Both are covered in [Reading a backup run](/backups/reading-a-run/).

## Next steps

- [Reading a backup run](/backups/reading-a-run/) — statuses and the audit trail
- [Schedule and scope](/backups/schedule-and-scope/) — so you need this button less often
- [My backup failed](/troubleshooting/backup-failed/) — when the run did not finish
