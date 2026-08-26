---
title: Settings
description: How Settings is divided, which panel a thing you are looking for is in, and why some of them are admin-only.
---

Settings is split by **what a setting applies to**, not by what it looks like. Once you know the
split, finding anything takes one guess.

| Panel | What it governs | Who can change it |
| --- | --- | --- |
| **Account** | Your display name and email address | You |
| **Security** | Two-factor authentication and backup codes | You |
| **Organization** | The organization itself | An admin |
| **Billing** | Plan, payment method, invoices | An admin |
| **Developer** | Programmatic access to the organization | An admin |
| **Space** | Scope, schedule, destination, retention | Anybody in the organization |
| **Notifications** | What you are told about, per Space | You, per Space |

## The three questions this answers

### Why can I not change this?

Because it is one of the three admin-only panels. They belong to
the organization rather than to a person, and billing in particular is a commercial relationship the
organization holds. See [Members and roles](/account/organization/members-and-roles/).

### Is this setting mine or everybody's?

Account, Security and Notifications are yours. Nothing you
change in them is visible to anybody else, and Notifications is deliberately per person per Space,
so two people watching one Space can be told about different things.

### Why is a Space setting not in Settings?

It is, and it is also on the Space, because that is
where you are when you want it. A Space's scope, schedule, destination and retention are the Space's
configuration rather than the account's. See [Schedule and scope](/backups/schedule-and-scope/).

## What is not in Settings

### Sources and Destinations

They belong to the account and are reused across Spaces, but they have
their own section, because a connection has a status and a history and a list of Spaces using it,
which is more than a settings panel. See [Sources](/connections/sources/).

### What a backup can see

That is a grant on the platform's side, made in Airtable, Notion or
ClickUp, not a Baseout setting.

:::note
This catches people regularly: widening what is backed up is something you do over there, and
Baseout notices. See [My bases are missing from the picker](/troubleshooting/missing-bases/).
:::

## Next steps

- [Profile and email](/account/profile/): your name, your address, and what changing it does
- [Two-factor authentication](/account/two-factor/): the Security panel
- [Plans and limits](/account/billing/): what the Billing panel governs
