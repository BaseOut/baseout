---
title: Payment methods
description: Where the card lives, who can change it, and why a failed payment is not the same event as a broken connection.
sources:
  - apps/web/src/pages/api/billing/portal.ts
  - apps/web/src/lib/stripe.ts
  - apps/web/src/views/settingsCatalog.ts
---

A payment method belongs to the *Organization*, and the panel is admin-only, like everything else
under Billing. See [Members and roles](/account/organization/members-and-roles/).

## One organization, one billing relationship

There is no per-Space billing and no per-person billing. Two teams that genuinely need separate
invoices need separate organizations, which is exactly the choice offered at signup when somebody
at your domain already has one. See [Joining an organization](/account/organization/joining/).

## A failed payment is not a failed backup

These are two different words that both read as "something is wrong", and telling them apart saves a
lot of time:

- A **connection** problem stops runs, and Baseout says so in three places at once: the connection's
  status, a banner on the affected Space, and a row in the Inbox. See
  [Reconnecting a broken connection](/connections/reconnecting/).
- A **billing** problem is between you and us and does not reach into your Destination. The backups
  you already have are files in your own storage.

:::note
If runs have stopped, check the connection first. It is much more often the cause.
:::

## Where the card lives

**Settings ▸ Billing ▸ Open portal.** The button opens the Stripe customer portal for your
Organization, and the card is added, replaced, or removed there — alongside the plan and the
invoices, because it is all one billing relationship.

## What we do not hold

Card details are handled by Stripe, not stored by Baseout. That is the ordinary arrangement and it
is worth saying because of what it implies for support: we can see that a payment succeeded or
failed, and we cannot read your card back to you.

## What is not settled yet

Whether invoicing is offered alongside cards, and the dunning behaviour when a payment fails, are
not decided. If a card is not workable for your organization,
[contact us](/contact/?kind=ticket).

## Next steps

- [Invoices and receipts](/account/billing/invoices/)
- [Changing your plan](/account/billing/changing-your-plan/)
- [Cancelling](/account/billing/cancelling/)
