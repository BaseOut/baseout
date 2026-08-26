# support-ticket-portal — Design

Evidence lives in `../support-portal/research-tickets-portal-2026-08-21.md` (858 lines) and, for the
patterns that predate it, `../support-portal/research-tickets.md`. This file decides; it does not
re-argue. Where a decision here contradicts a source, the source's own section number is named.

## 1. The boundary everything else follows from

**Synchronous is a machine. Asynchronous is a human.** The chat is AI and never reaches a person;
a case is answered by a person, by email. Both halves are the client's own words, and reading either
half alone produces the wrong product: "AI only" deletes the surface he asked for, and "chat with
support" promises a queue that does not exist.

Three consequences, and they are not negotiable at the level of a screen:

- **The mailbox is the primary surface.** A case is keyed by an email address. Before sign-in exists,
  the portal reaches nobody and the mail reaches everyone.
- **No label anywhere may promise a person is waiting.** `Ask a person` is the escalation label;
  `Talk to a human` and `Talk to a support specialist` are rejected for implying a live queue.
- **No text promises a duration.** Not "shortly", not "within 24 hours", not "as soon as possible".
  Name the channel, the address, and the event that ends the wait. Measured across `apps/support/src`
  on 2026-08-21: zero occurrences. Keep it that way.

## 2. Information architecture

| Surface | Route | Audience | Status |
| --- | --- | --- | --- |
| The five doors | `/contact/`, `?kind=` deep links | everyone | built |
| The receipt | `/contact/` done-state | everyone | built, content changes |
| Escalation out of the chat | the dock, on every docs page | everyone | new |
| `My requests` | `/requests/` | signed in | new |
| One case | `/requests/<ref>/` | signed in | new |

**`My requests` earns no header slot until sign-in exists.** The header is three items and that is a
measured budget at 390px; a fourth item leading to a locked page is a fourth item that fails for
every visitor. It is reached from the receipt and from the case emails until there is a session to
put behind it.

**A route, not a drawer.** A case must survive a cold load from an email link, and `/contact` has no
panel host to borrow. The panel-stack law is an `apps/web` law about pages that already have a stack.

## 3. The surfaces and their states

### 3.1 The create form and its deflection

The form is built. Two additions:

- **Suggested articles under the subject as it is typed.** An inline strip, not a side column —
  `/contact` is single-column with the docs sidebar suppressed (`support.css:355-372`), so a side
  column has nowhere to live. Reuses `submit.ts:294-341`'s phrase-then-words ranking with its ≥2-word
  overlap floor, already running on this page for duplicate detection. **Pagefind indexes at build
  time**, so this returns nothing under `astro dev` and must be verified against a build.
- **One line above the file picker about other people's data.** A screenshot of a customer's own
  Airtable carries third-party record values, names and addresses; redaction inside a binary is
  all-or-nothing and never reaches a copy already mailed, so the only control that works is before
  the file is chosen. **We already do this in one door** — billing's *"Never send a full card
  number"* is the precedent, and the screenshot sentence is written in the same register.

States: empty · typing with no matches · typing with matches · a match dismissed · at the attachment
cap · over it · a rejected type · submitted · submit failed.

### 3.2 The receipt — the smallest change with the largest effect

Today it says *"Nothing was sent."* When there is a backend it must say three things, and they are
the three the person needs a week later:

1. **The case number**, copyable (`Copyable id` exists in the catalog).
2. **The address the mail went to**, printed rather than asked for — with the deliverability line
   beside it, because a filtered acknowledgement leaves the person with no channel at all.
3. **"A person answers by replying to that email."** The channel, the address, the event. No clock.

The same three facts are a contract on the acknowledgement email, written into the backend handoff,
so a receipt on screen cannot disagree with the receipt in the mailbox.

### 3.3 The exit from the chat

- **A persistent, low-emphasis `Ask a person` in the composer row from the first turn**, promoted
  after two consecutive answers that cite no documentation page. Conversational-only escalation is
  rejected here specifically: it works for products with a live queue, and ours is a destination
  change, so a bot asked for a human would have to explain what it cannot do.
- **Sentiment as a trigger is rejected** — no ground truth, and the wrong register for an admin tool.
- **The payload is shown before it is sent, collapsed, editable and removable.** The person's words
  verbatim, the AI's attempts summarised, the pages that did not help, the current page. Every vendor
  in the sweep attaches a transcript; **not one shows it to the customer or asks.** That is the gap
  this takes.

States: idle · offered · promoted · payload open · payload edited · payload removed · sent.

### 3.4 `My requests`

`Open / Closed / All` with counts, **sorted by last activity, never by creation** — a customer opens
this page to find the one that moved. Per-tab empty states: "no open cases" is a different sentence
from "you have never written to us", and the first-ever version points at the docs and the chat,
which are free and already shipped.

**Signed out, it is a locked capability in place, not a redirect.** The industry sends a 302 to a
sign-in; we render `pattern-locked-tab` — the lock mark, what the page does, why it is locked, and
the way in. A redirect answers a question the person did not ask and loses the explanation.

The label is `My requests`. Zero of the fifteen portals surveyed said "My tickets".

### 3.5 The case

Two parties, distinguished by **label, alignment and a quiet plate — no avatars**, inherited verbatim
from `pattern-schema-chat`. A named agent if there is one, otherwise `Baseout Support`, never an
invented person — the `DataComments` "Author not captured" ruling.

- **Status is carried once**, in the record rail, not repeated per row.
- **Quoted history collapses and is never deleted** — `Show quoted text · N lines`. Stripping has no
  standard and the documented failure direction is over-stripping.
- **Messages are not badged by channel.** No peer portal has a channel column, and the axis that
  actually earns a marker is *verified vs asserted author*.
- Attachments: file chips on the case (glyph + filename + size, one line, no thumbnail), a paperclip
  and a count on a dense row. Both already decided in `pattern-changelog-timeline`.
- **`View original email` is agent-side only.** The customer gets the labelled collapse; the raw MIME
  is a storage requirement, not a control on this screen.

### 3.6 Reply, close, reopen

The composer stays on a closed case; sending reopens it and **says so inline before the send**, not
after. One state transition, not a second entity — Zendesk's follow-up ticket exists only because it
has two closed-ish states and a 4-to-28-day timer, neither of which we have.

A customer may close their own case. Someone who solved it themselves should not have to write
"never mind".

## 4. Status wording

The stored enum and the rendered label are different things, and every mature product separates them.

| stored | shown | variant |
| --- | --- | --- |
| `open` | `Open` | soft neutral |
| `pending` | `Awaiting your reply` | `warning` — the only row with a task on the customer |
| `closed` | `Closed` | soft neutral, quieter |

`Pending` rendered literally says the opposite of what it means: it reads as "pending on our side",
so the customer waits and the case stalls. `Badge / Status` has no `info` variant and that is a
ruling, not an omission — there is no fourth colour to reach for.

`Closed` beats Zendesk's `Solved`: a case closed by the customer, or after silence, was not
necessarily solved, and a label that claims otherwise is a small lie the customer can see.

## 5. The data model — file these now or pay a migration

`design.md:35` of the parent change specifies `ticket (id, org/user refs, subject, status)` and a
messages thread. Ten things are missing; the full table with the failure each causes is
`research-tickets-portal-2026-08-21.md` §6. The load-bearing four:

- **`spaceId` and `runId`, both nullable.** A backup tool's most common case is "my backup failed",
  and without `runId` support asks for it in the first reply — a full round-trip on every failure
  case. Retro-fitting means a migration *and* re-asking every open case.
- **Two ids: `ref` (human, quotable, high-entropy) and `threadToken` (routing, rotatable).** One id
  is the Krebs hole: the string a customer pastes into a public forum becomes a write key into their
  own case. Adding the second after cases exist changes every live reply-to at once.
- **`kind: 'human' | 'auto'` per message.** Without it an out-of-office bounce counts as a customer
  reply, flips the case out of `Awaiting your reply` and bumps the sort. Detection leaks, so the model
  must tolerate one arriving.
- **`lastActivityAt`, distinct from `raised`.** The list's whole default sort depends on it.

And one that already exists and is read by nothing: **`unauthenticated`**. A declared field no
component consumes is the `provisional: true` failure repeated — every gate green, the fact invisible.

## 6. What we are not building, and why it is evidence rather than budget

**No anonymous portal view, no code-entry screen.** The client's specification lists submit · send
email · create ticket · flag unauthenticated, and never mentions viewing. Fifteen customer portals
were checked and **not one** lets an unidentified person browse their case; five publish no history
destination at all. The ruling at `contact.astro:473-475` said the same before any of it was read.

The cost is real and stated once: **lose the email, lose the case.** Three cheap mitigations carry
it — the case number and the address on the receipt, "reply to this email" in the mail itself, and
the merge rule below.

**Merge, when sign-in lands:** a prior anonymous case attaches to an account only if that case's
submitter address was *proven*, and absent a code screen the proof is an inbound reply from that
address on that case. An unverified address follows nobody.

## 7. Open questions for Dan — each with the default we ship if unanswered

1. Verify the address before the case enters the queue? **Default: no** — the spec says create.
   Abuse is met with a neutral acknowledgement subject, a per-address daily cap and rate limiting.
2. Does a case carry a Space and a run reference? **Default: yes, both, nullable, now.**
3. May the acknowledgement echo the submitted body? **Default: yes in the body, never in the
   subject** — the subject is what a mail bomb weaponises.
4. Plus-addressed or catch-all inbound routing? **Default: assume yes.** If not, threading falls back
   to the bracketed ref in the subject and we accept the documented wrong-thread failure.
5. Object storage for attachments, so outbound replies carry expiring links? **Default: assume yes.**
   If not there are no outbound attachments at all, and the case says so — outbound caps are 7–10 MB
   everywhere and a mailed byte can never be revoked.
6. Who closes a case, and does silence close one? **Default: support closes, the customer may close
   their own, no timed auto-close** — a timed close needs a warning email, which is a whole flow.
7. `apps/support` or `apps/web`? **Default: `apps/support`** — the design system is here now and the
   intake already shipped here, so graduation becomes a port of views rather than a rebuild.

## 8. Non-goals

SLAs and priority · categories that route nothing · CSAT · a status-over-time timeline (a case has no
stages; the conversation *is* the history, and four existing catalog entries are timeline-shaped with
the wrong semantics) · an agent console, which is a separate product and a separate question for Dan.
