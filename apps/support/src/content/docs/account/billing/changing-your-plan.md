---
title: Changing your plan
description: What moving up or down actually affects, and what happens to a Space that is above the limit of the plan you moved to.
sources:
  - apps/web/src/pages/api/billing/portal.ts
  - apps/web/src/lib/stripe.ts
  - apps/web/src/lib/entitlements/webhook-sync.ts
  - apps/web/src/views/settingsCatalog.ts
---

Changing the plan is an admin act, from **Settings**, under **Billing**. It applies to the whole
organization, because that is where billing lives.

## Moving up

The reason to move up is almost always one of the four metered things: more bases in a Space, more
Spaces, more runs, or more managed storage. See [Plans and limits](/account/billing/).

The effect is immediate in the sense that matters: the control that was telling you it needed a
larger plan stops saying so, and the Space you were configuring can be finished. Nothing about your
existing Spaces, schedules or history changes, and no backup is re-run.

## Moving down

Moving down is the case with a real question in it, because a Space can be above the limit of the
plan you are moving to.

:::note
A downgrade does not delete your data. Backups already taken are files in your own Destination and
are not ours to remove, and the backup history is a permanent record that a billing change does not
prune.
:::

That position follows from everything else in the product. See
[How backups work](/backups/how-backups-work/) and
[Retention and cleanup](/backups/retention-and-cleanup/).

What a downgrade does affect is what runs next: a Space whose scope exceeds the new limit has to be
brought within it before it will run on schedule again, and Baseout says which Space and by how
much rather than silently skipping it.

## What never changes with a plan

- **Your Sources and Destinations.** They authorize against the platform and your storage under
  their own credentials, and a plan change does not touch them.
- **Who is in the organization.** See [Members and roles](/account/organization/members-and-roles/).
- **What a backup can see.** That is set by the grant on the connection, not by the plan. See
  [Sources](/connections/sources/).

## What is not settled yet

The tier names, the allowances, how a mid-cycle change is prorated, and the exact wording of the
downgrade warning are not final. The behaviour above is the settled part, because it follows from
where the data lives rather than from a pricing decision.

Until the checkout is built, a plan change goes through [contact us](/contact/?kind=ticket).
