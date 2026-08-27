---
title: Schedule and scope
description: Which bases a Space backs up, how deep it goes, and how often each layer runs.
sources:
  - apps/web/src/pages/api/spaces/[spaceId]/backup-config.ts
  - apps/server/src/lib/scheduling/dual-schedule.ts
  - apps/server/src/durable-objects/SpaceDO.ts
  - apps/web/src/views/IntegrationsSetupWizard.astro
---

A Space's backup configuration has two halves. *Scope* is what gets captured — which bases, and how
deep. *Schedule* is how often. Both are edited together from the Space's backup options.

In this guide, you will:

- Choose between capturing structure only and capturing structure with records
- Put schema and data on two different cadences
- Change which bases a Space includes, and see what that does to backups already taken

## Choosing the depth: `schema only` or `schema + data`

The first choice reshapes everything below it.

`schema only` captures structure — tables, fields, field types, views — and no record data. It is
available on every plan. Choose it when what you need to protect is the shape of a base: the field
you renamed, the view someone deleted, the table that changed type last Tuesday.

`schema + data` captures structure and the records inside it, along with attachments where they
exist. This is a full backup in the ordinary sense.

:::caution
`schema only` does not back up your records. If you pick it, the zero-states and the Space card say
so plainly rather than letting you assume otherwise — but it is worth knowing before you choose.
:::

## Two cadences, not one

When the scope is `schema + data`, you set two schedules independently:

- **Data backup** — how often the records are captured.
- **Schema backup** — how often the structure is captured.


They are separate because they cost differently. Structure is small and cheap; records are not.
Most teams want to know within a day that a field changed type, but are content to capture the
records weekly or monthly.

**Every data backup also captures schema.** The schema schedule exists to run *more* often than the
data one, in the gaps between full backups.

<figure class="bo-shot">
  <img class="bo-shot-light" src="/screens/docs/schedule-and-scope-1-light.png" alt="Backup options with Record data and Attachments checked on a Monthly cadence, and Schema untied from that schedule onto its own Daily cadence." width="1040" height="414" loading="lazy" decoding="async" />
  <img class="bo-shot-dark" src="/screens/docs/schedule-and-scope-1-dark.png" alt="Backup options with Record data and Attachments checked on a Monthly cadence, and Schema untied from that schedule onto its own Daily cadence." width="1040" height="414" loading="lazy" decoding="async" />
  <figcaption>Schema follows the data schedule until you switch the toggle off. Then it gets a cadence row of its own, here Daily against Monthly data.</figcaption>
</figure>

If you set schema to run *less* often than data, Baseout points out that the schema schedule is
then redundant — a full backup already captured the structure. It is a hint, not a block; you can
save it anyway.

With scope set to `schema only`, there is one cadence control and no data schedule at all.

## The cadence options

Each cadence offers the same ladder:

| Cadence | Availability |
|---|---|
| `monthly` | All plans |
| `weekly` | Launch and above |
| `daily` | Pro and above |
| `instant` | Pro and above |

`instant` does not mean continuous polling. It means Airtable notifies Baseout when something
changes, so a run starts from the change rather than from the clock. Those runs appear in the
history with a `webhook` trigger.

Options above your plan are shown as an upgrade affordance rather than hidden or dead — you can see
what exists and what it would take to reach it. Choosing `schema only` as a scope is never gated.

## Knowing when the next run is

The backup settings and the Space card show the next scheduled run for each active schedule
separately:

- **Next data backup: …**
- **Next schema backup: …**

A `schema only` Space shows only the schema line. Each handles the not-yet-scheduled case explicitly
rather than showing a blank where a date belongs.

## Changing scope after backups exist

Adding and removing bases from a Space's scope is an ordinary edit, but two consequences are worth
stating.

### Removing a base does not remove its backups

Runs already taken are permanent log entries, and the data they wrote stays in your Destination
under the cleanup schedule's rules. Removing a base stops future runs from including it; it does
not reach backwards.

### New bases in Airtable are not added automatically

Baseout will not silently start backing up — and billing you for — a base you did not choose. When
it notices bases in the Source that the Space does not include, it surfaces them for you to add.

### A run does not snapshot its scope

The included-bases list shown on a past run reflects the Space's configuration *today*, not the
selection at the time that run happened. This is also why the backup history cannot be filtered by
base — the list it would filter on is not per-run truth.

## Limits

How many bases a Space may include, and how many Spaces an account may have, follow from the plan.
The plan model is not settled yet, so this page does not quote numbers it would have to retract.
See [Plans and limits](/account/billing/) for the current position.

## Next steps

- [How backups work](/backups/how-backups-work/) — what a run captures and what starts it
- [Retention and cleanup](/backups/retention-and-cleanup/) — how long the versions live
- [Sources](/connections/sources/) — where the bases come from
