---
title: Profile and email
description: Your name, your email address, and why changing the address is a different act from changing anything else about you.
sources:
  - apps/web/src/views/settingsCatalog.ts
  - apps/web/src/views/settingsControls.ts
  - apps/web/src/views/SettingsView.astro
  - apps/web/src/pages/profile.astro
---

Your profile is the part of Baseout that is about you rather than about your work: a display name,
an email address, and the preferences that follow you between Spaces. It is identical whichever
platform you back up, and nothing on this page changes if you connect a second one.

In this guide, you will:

- Change your display name, and know what depends on it
- Change the email address your sign-in links go to
- See what changing the address deliberately does not touch

## Your name

The display name is what teammates see beside anything you did: who invited whom, who started an
off-schedule run, who is on a request. Change it in **Settings**, under **Account**. Nothing else
depends on it.

## Your email address is your account

Baseout identifies you by email address, and that has one consequence worth stating up front.

:::note
`you@company.com` and `you@personal.com` are two accounts, not two addresses for one person. They
have separate organizations, separate Spaces and separate history.
:::

Because there is no password, the address is also the credential. A magic link goes to it, and
whoever reads the inbox can sign in. See [Sign-in methods](/account/sign-in-methods/).

### Changing it

Changing it is not an edit in the ordinary sense. It moves where sign-in links are sent, which
means it is confirmed from the new address before it takes effect, and it does not change what your
account contains.

## What it does not change

- **Your organization.** Membership belongs to the account, not to the address on it.
- **Your Sources and Destinations.** Those authorize against the platform and your storage, under
  their own credentials. Changing your Baseout address does not touch them.
- **Continue with Airtable.** That button identifies you by the address on your **Airtable**
  account. If the two stop matching, use the magic link on your Baseout address, which is the
  address that is now correct.

## Where the settings live

**Account** and **Security** are yours and affect nothing anybody else sees.
**Organization**, **Billing** and **Developer** belong to the organization and are admin-only.
**Space** settings belong to a Space, and **Notifications** are per person per Space, so two people
watching the same Space can be told about different things. See [Settings](/account/settings/).

## Next steps

- [Sign-in methods](/account/sign-in-methods/): how you get in, and what to do when you cannot
- [Sessions and devices](/account/sessions/): where you are currently signed in
- [Members and roles](/account/organization/members-and-roles/): who you share an organization with
