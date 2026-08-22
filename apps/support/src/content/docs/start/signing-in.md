---
title: Signing in
description: Magic link, Continue with Airtable, why there is no password, two-factor codes and joining an existing organization.
---

Baseout has no password, and no screen anywhere asks for one. There are two ways in.

**A magic link.** Type your email address on the login page and Baseout sends a link that signs you
in. This is the default path, and the field is focused when the page loads.

**Continue with Airtable.** One button above the form. It uses the email address on your Airtable
account to identify you, and that is all it does. It does not connect your data and it is not a
Source: backing up Airtable is a separate connection you make later, from
[Sources](/connections/sources/).

## Forgotten password

There is nothing to forget, and that is the whole answer: Baseout stores no password for you, so
there is no reset link and no security questions. If you cannot get in, the problem is one of three
other things.

**The link did not arrive.** Check the spam folder, then send another — asking for a second link
invalidates the first, so use the newest email in the thread. Links expire, and an old one reports
that rather than signing you in quietly as somebody else.

**You are signing in with a different address.** An account is the email address, so
`you@company.com` and `you@personal.com` are two accounts even when they are the same person. If
your organization was set up under a work address, the magic link has to go there.

**Continue with Airtable used another email.** That button identifies you by the address on your
Airtable account. When that differs from the one you first signed up with, it lands you in a second,
empty account rather than yours. Sign in with the magic link on the original address instead.

If none of those is it, [contact us](/contact/?kind=ticket) — we can see whether an account exists
for an address without you being signed in.

## Two-factor authentication

Two-factor is optional and off until you turn it on, from the Security panel in Settings.
Enrollment runs in three steps: scan the code with an authenticator app or enter the secret by
hand, type a code back to verify it, then save your backup codes. Two-factor is not active until
the verify step passes, so leaving halfway leaves the account exactly as it was.

The backup codes are shown once, at that moment, with copy and download, and you confirm you saved
them before the screen closes. Regenerating them later invalidates the old set.

Once you are enrolled, signing in gains a step after either method above: a six-digit code, in an
input that advances box by box and accepts a paste. **Use a backup code** swaps it for a backup
code. **Trust this device for 30 days** skips the step on that device for that long. A wrong code
says so in plain words, and repeated wrong codes show you the wait rather than a dead end.

## If you lost your authenticator

A backup code gets you in, which is what they are for. If you have neither the app nor a code,
[contact support](/contact/) from the address on the account.

Turning two-factor off asks for a current code first, so it cannot be switched off from a session
somebody left open.

## When your company already has an organization

If someone at your email domain already has a Baseout organization, signup pauses on one screen and
offers two choices: **request to join** that organization, which an admin approves, or **create my
own account**.

Requesting to join does not block you. Onboarding continues in your own account with a pending
banner, and the approval arrives in your [Inbox](/notifications/inbox/) when it comes. The screen is
the same whether you arrived by magic link or by Continue with Airtable, because the fork belongs to
the domain rather than to the method.

## Next

- [Getting started](/start/getting-started/): what happens after you are in
- [Sources](/connections/sources/): the connection that actually reads your data
- [Settings](/account/settings/): which settings are yours and which need an admin
