---
title: Getting started
description: Connect a Source, choose what to back up, pick a Destination, run your first backup.
---

Setting up a Space runs in one order, and each step depends on the one before it.

## The order

1. Sign in to Baseout.
2. Choose the **Source** this Space reads through.
3. Select the **Bases** to include.
4. Choose the **Destination** to write to.
5. Set the depth and the schedule.
6. Review, then run the first backup.

Bases come before the Destination because bases belong to a Source. The list you pick from is
whatever that Source can see, which is why the Source is chosen first and why changing it later
clears the selection.

## What Baseout asks your platform for

Read access, and only over what the grant covers. The scope is set at the moment the grant is made,
by whoever makes it, so you can hold a Source to specific objects instead of everything. Baseout
sees exactly what it was given, and the Sources list says how much that is. How a grant is made
differs by platform: see [Sources](/connections/sources/) and your platform's connecting page.

## Bases missing from the picker

Almost always the grant. An object left out is not hidden from you inside Baseout, it is invisible
to Baseout, which cannot know it exists. See
[My bases are missing from the picker](/troubleshooting/missing-bases/).

## When there is nothing to pick yet

The first time through, the account has no Source and no Destination to choose from. Those steps
offer to create one there and then, in a drawer beside the step. The new connection is created on
the account, selected in the step you were on, and the setup never unmounts, so you do not lose
your place.

## The first run

**Run first backup** starts a run immediately over the bases you selected, writes to the
Destination, and records itself in the Space's history like every run after it. A run taken before
payment, during onboarding, is recorded as a **Trial run**, so you can see real output from your own
data before committing to anything.

## What you see when it finishes

The run's detail page: totals, which layers it captured, where it wrote, and a table of every base
with its own counts and output location. The Space overview then shows the pipeline joined by a
status connector, with the last run and the next one. See
[Reading a backup run](/backups/reading-a-run/).

## Changing it afterwards

**Configure** reopens the same panels as free tabs you can jump between in any order, pre-filled
with the current configuration and saved as a set. There is no run step when editing: what you save
applies to the next scheduled run.

## Next

- [How backups work](/backups/how-backups-work/): what a run captures, and what starts one
- [Schedule and scope](/backups/schedule-and-scope/): the two cadences, and changing scope later
- [Signing in](/start/signing-in/): magic links, two-factor, and joining an existing organization
