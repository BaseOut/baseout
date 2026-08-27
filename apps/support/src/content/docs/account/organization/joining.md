---
title: Joining an organization
description: What happens when somebody at your email domain already has a Baseout organization, and why the choice is offered rather than made for you.
sources:
  - apps/web/src/views/AuthAssociationView.astro
  - apps/web/src/pages/api/onboarding/join-request.ts
  - apps/web/src/lib/signup/domain-association.ts
  - apps/web/src/pages/welcome.astro
---

An *Organization* is the top-level customer entity. It holds the Spaces, the Sources, the
Destinations, the backup history and the billing. See
[How Baseout is organized](/start/how-baseout-is-organized/).

Most people never think about this, because they are the first person from their company to sign up
and the organization is created around them. This page is about the other case.

In this guide, you will:

- Choose between joining an existing organization and creating your own
- Carry on with onboarding while a request waits for an admin
- See what joining changes, and what stays yours

## The fork at signup

If somebody at your email domain already has a Baseout organization, signup pauses on one screen and
offers two choices:

- **Request to join** that organization, which an admin approves.
- **Create my own account**, which gives you an organization of your own.

:::note
The screen is the same whether you arrived by magic link or by Continue with Airtable. The fork
belongs to the domain rather than to the sign-in method.
:::

## Why you are asked rather than routed

Both answers are legitimate and Baseout cannot tell which one you mean. Two teams at one company
often want separate organizations with separate billing, and one team split across two organizations
is a mess nobody notices until a backup is missing. Guessing would be wrong about half the time, so
the question is asked once, at the only moment it is cheap to answer.

## Requesting does not block you

Onboarding continues in your own account with a pending banner while you wait, so you are never
sitting on a screen doing nothing. The approval arrives in your [Inbox](/notifications/inbox/) when
an admin acts on it.

If it is declined, or nobody acts, you still have your own account and can carry on in it.

## What joining changes

Joining puts you inside an existing organization, so you see its Spaces and its history rather than
starting empty, and its plan covers you rather than your needing one of your own.

What it does not change is your own account: your email address, your display name and your security
settings are yours and travel with you. See [Profile and email](/account/profile/).

## Leaving later

Leaving an organization removes you from it and does not remove the organization or anything it
owns. See [Deleting your account](/account/deleting-your-account/).

## Next steps

- [Members and roles](/account/organization/members-and-roles/): who is in it and what they can do
- [Invitations](/account/organization/invitations/): the other direction, bringing somebody in
- [Signing in](/start/signing-in/): the sign-in flow this screen sits inside
