---
title: Sign-in methods
description: Two ways in, no password anywhere, and what each one means for who can reach your account.
---

Baseout has two sign-in methods and no password. No screen anywhere asks for one, so there is
nothing to store, nothing to leak and nothing to reset. This page is about choosing between the two
and understanding what each one implies; [Signing in](/start/signing-in/) walks through the flow
itself.

In this guide, you will:

- Choose between a magic link and Continue with Airtable
- See what each one implies about who can reach your account
- Recognize the wrong-address case, and fix it

## A magic link

Type your email address and Baseout sends a link that signs you in. It is the default, and the field
is focused when the login page loads.

What it means in practice: **your email inbox is your credential.** Anyone who can read it can sign
in as you. That is not a weakness of the method so much as a statement of where the security
actually sits, and it is the reason two-factor authentication is worth turning on. See
[Two-factor authentication](/account/two-factor/).

Links expire, and asking for a second one invalidates the first, so always use the newest email in
the thread. An old link says it is old rather than signing you in quietly as somebody else.

## Continue with Airtable

One button above the form. It uses the email address on your Airtable account to identify you, and
that is the entire extent of it.

**It is not a connection to your data.** Backing up Airtable is a separate authorization you make
later, from [Sources](/connections/sources/), and signing in this way grants Baseout no access to
any base.

The thing to watch is which address it carries.

:::note
If the address on your Airtable account differs from the one you signed up with, this button lands
you in a second, empty account rather than yours. The fix is the magic link on the original
address.
:::

## Which to use

Either. They are two doors into the same account when the address matches, and you can use one today
and the other tomorrow. Neither is more privileged than the other, and neither can be turned off in
favour of the other.

Prefer Continue with Airtable if you live in Airtable and would rather not go via email. Prefer the
magic link if your Baseout address is not the one on your Airtable account, or if you want the sign
in to be independent of a platform you might stop using.

## What there is no method for

There is no password, no security question, no SSO and no API key that signs a person in. If a
sign-in screen asks you for a Baseout password, it is not ours.

## Next steps

- [Two-factor authentication](/account/two-factor/): the step that makes the inbox not enough
- [Sessions and devices](/account/sessions/): what is currently signed in
- [Signing in](/start/signing-in/): the flow, including joining an existing organization
