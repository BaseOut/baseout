---
title: Plans and limits
description: What Baseout meters, where each limit is felt, and which numbers are not final enough to publish yet.
sources:
  - apps/web/src/lib/entitlements/resolve.ts
  - apps/web/src/lib/entitlements/enforce-create.ts
  - apps/web/src/lib/capabilities/resolve.ts
  - apps/web/src/views/settingsCatalog.ts
---

Billing belongs to the *Organization*, not to a person, so a plan covers everybody in it and
changing it is an admin act. See [Members and roles](/account/organization/members-and-roles/).

## What is metered

Four things, and it is worth knowing which is which, because they are felt in different places.

### How many bases a Space may include

Set at the Space's scope. When a Space is at its limit,
adding a base is what tells you. See [Schedule and scope](/backups/schedule-and-scope/).

### How many Spaces the organization may have

A Space is bound to one platform, so this is also the
answer to "can I add a second platform". See
[How Baseout is organized](/start/how-baseout-is-organized/).

### Runs

An off-schedule backup consumes credits beyond the scheduled ones, which is why **Run
backup now** asks for confirmation rather than simply running. A restore counts as one restore run
against your allowance in the same way. See [Running a backup now](/backups/running-a-backup/).

### Storage

Metered where you use a Baseout-managed store. Point a Space at your own Google Drive, Dropbox,
Box or S3 and the storage is yours and is not metered by us. See
[Destinations](/connections/destinations/).

## Where a limit is felt

Baseout's stance is that a limit is a capability, not a sales screen. A control you cannot use says
what would make it available where you would have used it, and it does not interrupt a flow that was
going to work.

:::note
Nothing in the product is hidden behind a plan you are not on. It is visible, and it says what it
needs.
:::

## The trial

Before payment, during onboarding, you can take a real backup of your own base and look at the
output. That is what a `trial run` in the history is, and it is deliberately a single base: enough
to see what Baseout produces from your own data, rather than a demonstration on somebody else's.

See [How backups work](/backups/how-backups-work/).

## The numbers are not final

The tier names and the limits attached to them are not settled. Two different tier lists appear in
Baseout's own specifications, and the metered allowances, add-ons and checkout are specified but not
built.

Publishing a price list that changes next month is worse than saying it is not ready, so this page
describes the **shape** of the plan model, which is stable, and leaves the figures for when they
stop moving. The plan you are on and what it currently allows are shown in Settings, under Billing.

## If you were an On2Air customer

Baseout is the successor to On2Air, and what carries across for existing customers is a commercial
question rather than a product one. It has not been answered publicly yet.
[Contact us](/contact/?kind=ticket) and we will tell you where it stands for your account.

## Next steps

- [Changing your plan](/account/billing/changing-your-plan/)
- [Payment methods](/account/billing/payment-methods/)
- [Invoices and receipts](/account/billing/invoices/)
- [Cancelling](/account/billing/cancelling/)
