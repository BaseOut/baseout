---
title: Invoices and receipts
description: What a finance team needs from Baseout, where to download it, and what to ask us for when the document needs more.
sources:
  - apps/web/src/pages/api/billing/portal.ts
  - apps/web/src/views/settingsCatalog.ts
---

Invoices belong to the *Organization*, so they are addressed to the customer entity rather than to
whoever happened to sign up, and the panel is admin-only. See
[Members and roles](/account/organization/members-and-roles/).

## Why this is its own page

Nobody reads documentation about invoices for pleasure. They read it because somebody in finance
asked for a document with a particular thing on it, and the useful answer is where to get it and who
can.

## Who can see them

An admin. If you are a member and need a receipt, an admin either sends it to you or makes you an
admin: the split is per-organization and not per-document.

## What a backup record is not

Worth separating, because two different things here look like proof:

- The **backup history** proves a backup ran. It is a permanent log, it cannot be edited and it
  cannot be deleted, which is what makes it evidence. See
  [How backups work](/backups/how-backups-work/).
- An **invoice** proves you paid for a period.

Auditors sometimes want both, and they come from different places. The history is in the Space, on
the run.

## Where to get one

**Settings ▸ Billing ▸ Open portal.** The button opens the Stripe customer portal for your
Organization, and every invoice and receipt is there to download. Stripe hosts the portal, which is
why the documents look like Stripe documents: they are the payment processor's own records, which
is exactly what a finance team wants them to be.

The button is admin-only, like the rest of Billing.

## What is not settled yet

Whether purchase-order numbers and VAT identifiers can be added to an invoice, and whether receipts
are emailed automatically, are still open. If the standard document is missing something your
finance team needs on it, [contact us](/contact/?kind=ticket) from the account's address and say
what it needs to carry.

## Next steps

- [Plans and limits](/account/billing/)
- [Payment methods](/account/billing/payment-methods/)
- [Cancelling](/account/billing/cancelling/)
