---
title: Retention and cleanup
description: The only thing in Baseout that removes backed-up data, and how to set how long versions live.
---

The cleanup schedule is the **only** mechanism in Baseout that removes backed-up data. Nothing else
deletes a backup: not removing a base from a Space's scope, not disconnecting a Source, and not any
action on a run — runs cannot be deleted at all.

It exists because a backup that never thins grows without limit, and storage you pay for is storage
that should hold something worth keeping.

## How thinning works

The schedule is a rolling, tiered policy in the grandfather-father-son tradition. Rather than
keeping every version forever or dropping old ones abruptly, it **downsamples** as versions age:

> continuous → daily → weekly → monthly → removed past the cutoff

So a version does not vanish when it gets old. It becomes one of fewer versions covering that
period. You keep fine-grained history for the recent past, where you are most likely to need it,
and coarse history going back years, where you mostly need to prove something existed.

## The ladder follows your backup frequency

The tiers are keyed to how often the Space backs up, so the policy always matches the shape of the
data it is thinning:

| Backup frequency | What is kept |
|---|---|
| **Monthly** | Monthly versions |
| **Weekly** | 3 months of weekly, then monthly |
| **Daily** | 30 days of daily, then 2 months of weekly, then monthly |
| **Continuous** | 3 days of continuous, then 27 days of daily, then 2 months of weekly, then monthly |

Change the backup frequency and the retention ladder updates to match it. You do not configure the
tiers themselves — they are fixed.

## The cutoff is the knob

One setting is yours: how long backups are kept before they are removed entirely.

- 1 year
- 2 years
- 5 years — **the default**
- Never

"Never" means versions are still thinned by the ladder above, but nothing is ever removed for age.
Thinning and the cutoff are two different mechanisms: the ladder controls *how many* versions cover
a period, the cutoff controls *how far back* the record goes at all.

## Where to set it

The cleanup schedule sits in the Space's backup **Options**, directly below the backup Schedule.
The two belong together — how often you capture and how long you keep are one decision made in two
halves.

<figure class="bo-shot">
  <img class="bo-shot-light" src="/screens/docs/retention-and-cleanup-1-light.png" alt="Backup Options panel: the cadence controls at the top set to Monthly, and beneath them a Cleanup schedule block reading &quot;With Monthly backups we keep: Monthly versions kept&quot; above a &quot;Then remove anything older than&quot; control set to 5 years." width="1040" height="606" loading="lazy" decoding="async" />
  <img class="bo-shot-dark" src="/screens/docs/retention-and-cleanup-1-dark.png" alt="Backup Options panel: the cadence controls at the top set to Monthly, and beneath them a Cleanup schedule block reading &quot;With Monthly backups we keep: Monthly versions kept&quot; above a &quot;Then remove anything older than&quot; control set to 5 years." width="1040" height="606" loading="lazy" decoding="async" />
  <figcaption>The ladder is read-only and restates itself from the cadence above it. The cutoff select at the bottom is the one thing here you set.</figcaption>
</figure>

## What this means in practice

**A run you cancelled still leaves data behind.** Cancelling keeps whatever was written before you
stopped, and that partial backup lives under the same retention rules as any other.

**Removing a base from scope does not remove its backups.** Future runs stop including it; the
versions already captured stay until the cleanup schedule ages them out.

**There is no per-backup delete, and no exemption.** You cannot delete one run's data, and you
cannot mark a specific version to survive the ladder. If you need a version to outlive the policy,
take it out of Baseout — the data is in your own Destination and you can copy it.

:::caution
Because the ladder and the cutoff work on age, **shortening the cutoff takes effect against history
that already exists.** Moving from 5 years to 1 year does not only change the future.
:::

## What happens to backups if you cancel your account

This does not have an answer yet.

The data is written to a Destination you own, which is the strongest part of the answer — Baseout
is not holding it. But what happens to the run history, the metadata, and any storage Baseout
manages on your behalf is a decision that has not been made, and this page will not invent one.

If this matters to your decision to adopt Baseout, ask support and it will be answered directly
rather than from a page.

## Next

- [Schedule and scope](/backups/schedule-and-scope/) — the frequency the ladder keys off
- [How backups work](/backups/how-backups-work/) — why a run is a permanent record
- [Destinations](/connections/destinations/) — where your backups actually live
