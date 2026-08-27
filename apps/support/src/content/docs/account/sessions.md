---
title: Sessions and devices
description: What being signed in means when there is no password, and what a trusted device changes.
sources:
  - apps/web/src/lib/auth-factory.ts
  - apps/web/src/pages/2fa.astro
  - apps/web/src/lib/auth-client.ts
---

A session is one signed-in browser. Because Baseout has no password, a session is created by
following a magic link or by Continue with Airtable, and there is nothing else that creates one.

In this guide, you will:

- See what creates a session when there is no password
- Tell a trusted device apart from a signed-in session
- Know what to do when you lose a device

## Signing in does not sign anything out

Signing in on a second device leaves the first one signed in. That is deliberate: people work from a
laptop and a phone, and being ejected from one by using the other is a small daily annoyance with no
security benefit, since both were authorized the same way.

## Trusted devices are a separate thing

If you have two-factor authentication on, the code step can be skipped on a device you mark with
**Trust this device for 30 days**. Trust is not a session. It is a note that this particular browser
already proved it had your second factor, and it expires on its own after thirty days.

Two consequences follow. A trusted device still needs a magic link to start a new session, so trust
alone does not get anybody in.

:::note
Clearing your browser data clears the trust, which is why the code comes back after a cleanup that
appeared unrelated.
:::

## Signing out

Signing out ends that one session. It does not invalidate a link that is still sitting unread in
your inbox, so on a shared or borrowed machine, the safer move is to sign out **and** delete the
sign-in email.

## When you lose a device

There is no password to change, so the useful actions are these, in order:

1. **Turn on two-factor** if it is not on, which makes the inbox alone insufficient. See
   [Two-factor authentication](/account/two-factor/).
2. **Secure the email account** the links go to. It is the credential.
3. **Regenerate your backup codes**, which invalidates the old set, in case a printed copy went with
   the device.

## What is not settled yet

A list of active sessions, with the ability to end one remotely, is the obvious next control here
and it is not built. This page will say where it lives once it is, rather than describing a screen
that does not exist.

## Next steps

- [Sign-in methods](/account/sign-in-methods/): the two doors, and what each implies
- [Two-factor authentication](/account/two-factor/): enrollment and backup codes
- [Deleting your account](/account/deleting-your-account/): ending it entirely
