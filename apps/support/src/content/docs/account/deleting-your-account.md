---
title: Deleting your account
description: What deleting your own account does, what it deliberately does not touch, and why an organization is a separate question.
---

Deleting your account is not the same act as deleting your organization's data, and confusing the
two is the expensive mistake here. This page separates them.

## Your account against your organization

Your **account** is you: an email address, a display name, your security settings and your
membership.

Your **organization** is the customer entity. Spaces, Sources, Destinations, backup history and
billing all belong to it, not to you. See
[How Baseout is organized](/start/how-baseout-is-organized/).

So removing yourself removes a person from an organization. It does not remove the organization, and
it does not remove anything the organization owns. If you are one of several people, the Spaces keep
running on their schedules after you go.

## Your backups are not in Baseout

Worth stating plainly, because it changes what deletion can even mean: backup files are written to
**your** Destination, in your own storage, under your own account with that provider. Deleting a
Baseout account does not reach into your Google Drive or your S3 bucket, and nothing about leaving
Baseout removes the copies you already hold.

What Baseout holds is the record of where things were put and what happened when. See
[Destinations](/connections/destinations/).

## If you are the only person in the organization

Then there is nobody left to own it, and deleting your account and ending the organization become
the same decision made once. That is the case to think about before starting, because the Spaces
stop running and the history goes with them.

If somebody else should keep it, hand it over first. See
[Transferring ownership](/account/organization/transferring-ownership/).

## Before you delete

- **Check what your Destination holds.** The files are yours and stay yours, but knowing what is
  there before you lose the index to it is worth ten minutes.
- **Hand over anything only you can reach.** A Source authorized with your personal token stops
  working when your access does, whoever else is in the organization. See
  [Reconnecting a broken connection](/connections/reconnecting/).
- **Deal with billing.** An organization with an active plan is still being billed after you leave
  it. See [Cancelling](/account/billing/cancelling/).

## What is not settled yet

The exact controls, what is retained and for how long after a deletion, and the wording of the
confirmation are not final, and the retention question in particular is one Baseout has to answer
rather than improvise. This page will state the periods once they are decided rather than publishing
a number it would have to retract.

To start the process today, [contact us](/contact/?kind=ticket) from the address on the account.
