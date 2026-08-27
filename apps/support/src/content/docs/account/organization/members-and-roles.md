---
title: Members and roles
description: What an admin can do that a member cannot, and which settings the split actually governs today.
sources:
  - apps/web/src/db/schema/core.ts
  - apps/web/src/views/settingsCatalog.ts
  - apps/web/src/layouts/SettingsBody.astro
  - apps/web/src/pages/api/organizations/join-requests/index.ts
---

An organization has more than one person in it, and not everything in it should be changeable by
everybody. Baseout expresses that as a split between two roles, `member` and `admin`.

## Where the split shows up

The clearest statement of it is in Settings, which is divided by **what a setting applies to**:

| Section | Whose it is |
| --- | --- |
| **Account** | Yours. Nobody else sees it. |
| **Security** | Yours. Your two-factor enrollment and backup codes. |
| **Organization** | The organization's, and admin-only. |
| **Billing** | The organization's, and admin-only. |
| **Developer** | The organization's, and admin-only. |
| **Space** | The Space's. Scope, schedule, destination, retention. |
| **Notifications** | Yours, per Space. Two people watching one Space can be told different things. |

:::note
A setting you can see is not always one you can change. The panel is visible so the organization's
configuration is legible to everyone in it; changing it is an admin act.
:::

## What an admin does

- Approves or declines requests to join from your email domain. See
  [Joining an organization](/account/organization/joining/).
- Changes organization, billing and developer settings.
- Holds the commercial relationship, since billing lives on the organization rather than on a
  person.

## What everybody does

Everything the work is actually made of: Spaces, Sources, Destinations, running a backup, reading a
run, restoring. Baseout is a utility, and gating the utility behind a role would only mean waiting
for somebody.

## What a role is not

A role does not decide what a backup can see. That is set by the platform, on the connection, by
whoever authorized it, and it is a different mechanism entirely. An admin with no access to a
private ClickUp Space cannot back it up either. See
[What a ClickUp connection can see](/platforms/clickup/permissions/).

## What is not settled yet

The full list of roles, whether there is anything between `member` and `admin`, and the screen for
changing somebody's role are not decided. What is settled is the split above, which the product
already enforces.

This page will name the roles once they exist rather than inventing a hierarchy that then has to be
un-invented.

## Next steps

- [Invitations](/account/organization/invitations/): bringing somebody in
- [Transferring ownership](/account/organization/transferring-ownership/): handing it over
