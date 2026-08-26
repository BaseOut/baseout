## Why

A person can write to Baseout today and then falls into nothing. `/contact` has five doors, three of
them private, a step machine, attachment handling and live duplicate detection — 1,633 lines across
`contact.astro` and `submit.ts` — and it ends on a page that says *"Nothing was sent."* There is no
case, no number, no way back, and no second message. The front door is built and the room behind it
is not.

Dan named this on 2026-08-21, item four of four, and it is the only one still open:

> "we'll need to design the user's ticket portal and ticket back and forth with support team
> experience."

The other three of his four shipped. This is the largest undesigned surface in the portal.

**What makes it designable now, when research argued against it on 2026-08-18:** that argument rested
on three blockers and two are gone. `apps/support` had no design system — it has one now, the brand
bridge plus `support.css` plus twenty-three components. The signed-out page had the wrong emphasis —
it was replaced by `/contact`. The third, no auth bridge, is not a blocker under the framing already
agreed: the portal is a demo of what the finished documentation and support look like, which is the
same ruling that removed the provisional banners.

## What Changes

The boundary that decides everything below, and it is the client's, stated verbatim in his own two
sentences: **the chat is AI and never reaches a person; a ticket is answered by a person, by email.**
Synchronous is a machine, asynchronous is a human. So:

- **Email-first, portal as the mirror.** A ticket is keyed by an email address — *"it will send an
  email and create a ticket for that email address"*. The mailbox is the surface that reaches
  everyone; the portal is where someone with an account reads the same thing.
- **The done-state becomes a receipt.** A case number, the address the mail went to, and one line
  saying a person answers by replying to it. Today it says nothing was sent.
- **Deflection before submission.** Suggested articles under the subject field as it is typed, from
  the corpus already in this app — 86 pages, 8 of them troubleshooting, indexed by Pagefind, ranked
  by machinery `submit.ts` already runs on this same page for duplicate detection.
- **An exit from the chat.** A persistent, low-emphasis `Ask a person` in the composer from the first
  turn, promoted after two answers that cite no documentation. What it carries into the ticket —
  the question verbatim, the AI's attempts summarised, the pages that did not help — is shown to the
  person **collapsed, editable and removable** before it is sent. No vendor in the sweep does this;
  every one of them attaches a transcript the customer never sees.
- **`My requests`** — the signed-in list: `Open / Closed / All` with counts, sorted by last activity.
- **The thread** on its own route: two parties, a composer, file chips, collapsed quoted history,
  close and reopen as transitions rather than new entities.

### Not built, and the reason is evidence rather than budget

**An anonymous submitter gets no portal view of their case, and there is no code-entry screen.** The
client's specification lists submit · send email · create ticket · flag unauthenticated, and never
mentions viewing. A sweep of fifteen customer portals found **not one** that lets an unidentified
person browse their case — all convert to an identified session first, and five publish no history
destination at all. The ruling already written at `contact.astro:476-482` said the same thing before
any of this research existed. Three independent lines agreeing is the cheapest yes available.

## Capabilities

### New Capabilities
- `support-tickets`: a customer's case over time — created from any of the private contact doors or
  from a failed chat, answered by email, mirrored in the portal for anyone signed in.

### Modified Capabilities
- `support-chat`: gains an escalation exit and the consent block that goes with it.

## Impact

- `apps/support` only. No change to `apps/web` or `apps/design` beyond three catalog entries.
- **`apps/support` is covered by no design-system gate** — not `ds-lint`, `ds-audit` or `census`.
  `css-guard` was extended to it on 2026-08-21 after a 73-line verbatim duplicate survived in
  `support.css` unseen. The catalog rules are held by hand and by review here, and that has to be
  said at every review or it silently does not happen.
- **Data-model fields that must be filed now or become a migration**: a Space reference, a run
  reference, an attachment concept, the `unauthenticated` flag, and **two separate ids** — the
  human-quotable case number and a high-entropy token that threads email replies. Conflating those
  two is the failure Krebs documented against Zendesk in October 2025, where guessable sequential
  ids let an attacker join someone else's ticket.
- Nothing here sends mail. The backend is a paired monorepo change; every path ends in a state that
  says what will happen rather than pretending it happened.
