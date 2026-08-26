# Tickets — the customer portal, consolidated

Date: 2026-08-21. Consolidates 1,499 lines of same-day research — email mechanics (A), external
patterns (B), repo inventory (C) — into one document an engineer can build from and Oleh can
review. **Nothing here is new research.** Where the three sources disagreed, this file rules and
says why; where a claim was labelled unverified it stays labelled. Every URL that carried a factual
claim is kept.

`research-tickets.md` (2026-08-18) is **not superseded**. §1 says exactly which of its conclusions
events have overtaken and which carry forward untouched.

## Bound before this file was written — stated, never re-argued

1. **Chat is AI-only and never reaches a human.** Tickets are answered by a human, asynchronously,
   **email-first**, keyed by email address.
2. **No anonymous portal browse, and no six-digit-code screen.** The client's spec lists submit /
   send email / create ticket / flag unauthenticated, and never mentions viewing. Confirmed
   independently by B's 15-portal sweep and by the ruling already written at
   `apps/support/src/pages/contact.astro:473-482`.
3. Customer-facing status words: **`Open` · `Awaiting your reply` · `Closed`**. `Awaiting your
   reply` is the only one carrying `warning`, because it is the only state with a task on the
   customer.
4. The list is labelled **`My requests`**, never "My tickets".
5. **No UI text may promise a duration.** Name the channel, the address, and the event that ends
   the wait.
6. Platforms 4 and 5 are **Smartsheet** and **Monday.com** — relevant only to the handoff page,
   recorded here so the platform count in this document is not read as three.

---

## 1. What this supersedes, and what it does not

### 1.1 `research-tickets.md` §7 argued "do not design tickets now" on three blockers. Two are gone.

| Blocker, as stated 2026-08-18 | Status 2026-08-21 | Evidence |
|---|---|---|
| **(a) The page that can ship has no ticket UI on it.** `/tickets` was 25 lines of signed-out state; designing list/create/thread would produce artefacts nobody could render or review | **Half gone.** `/tickets` is now a **301 to `/contact`** (`apps/support/astro.config.mjs:19-21`), and `/contact` ships a complete, reviewable ticket **intake**: five doors, a step machine with a `?kind=` deep link, attachments with per-file rejection, `novalidate` + named failures, and five distinct done-states (`contact.astro` 1068 lines · `lib/submit.ts` 565 lines). What is still unrenderable is **list and thread**, which need the session | `astro.config.mjs:19-21` · `contact.astro:142-482` · `submit.ts:100-190` |
| **(b) `apps/support` has no design system, and that is the actual blocker.** Measured then: no Tailwind, no daisyUI, no `@opensided/theme`, **no CSS file anywhere under `apps/support`** | **Gone.** `brand/baseout-bridge.css` (342 lines) maps every `--sl-*` onto Baseout tokens and is shared by four public apps; `apps/support/src/styles/support.css` (647 lines) carries the portal's own rules on top; `Icon.astro`, `StatusBadge.astro` and `lib/status.ts` are a working badge system with the product's own rulings ported by hand | C §1.3 · `support.css:287-340` · `status.ts:10-34` · `design.md:8-22` |
| **(c) `proposal.md:28` — ticketing "cannot ship before" graduation to the monorepo** | **Stands, unchanged.** Nobody has moved `apps/support`. Designing here may still be designing twice — but (a) shows the intake already shipped here and survived, so the port is a port of **views**, not of a platform | `proposal.md:28` |

**Consequence.** The 2026-08-18 recommendation ("do three smaller things instead") was correct on
its evidence and is now expired on two of its three legs. What replaces it is not "design
everything": it is **design the two surfaces the session unblocks (list, thread) as contracts, and
build the one surface that needs no session (intake + deflection) now.**

### 1.2 Its three "do instead" items

| Item | Status |
|---|---|
| 1. Recompose the signed-out `/tickets` page on `pattern-locked-tab` | **Overtaken.** The page no longer exists. Its content survives as `.sb-signin` on `/contact` (`contact.astro:476-482`), and `pattern-locked-tab` (`storybook.ts:4834`) is now the answer for **`My requests`**, not for `/tickets` |
| 2. Build the deflection (article suggestions from the subject field) | **Still unbuilt, still the highest-leverage item on this surface, still needs no auth.** C §4.3 measured the cost: one second call site plus one inverted predicate. See §5.1 |
| 3. Amend the spec — five edits | **1 of 5 done.** "No second design system" was struck (`design.md:8-22`, revised 2026-08-19). Outstanding: the customer-facing status mapping · Space ref + run ref + attachments on the ticket model · the verb list · the sort default. `design.md:34` is additionally **now factually stale** — it says `/tickets` renders the signed-out state; it renders a redirect |

### 1.3 Findings that carry forward unchanged

- **The storage enum and the rendered label are different things** (`research-tickets.md` §2.2).
  `open|pending|closed` is fine as storage; `pending` rendered literally to a customer says the
  *opposite* of what it means. Zendesk renamed it because the word inverted the state
  ([Zendesk — customer portal ticket statuses](https://support.zendesk.com/hc/en-us/articles/4408825864858-What-are-the-customer-portal-ticket-statuses)).
  Bound decision 3 is this finding, now settled.
- **Sort by last activity, never by creation**; two-or-three tabs, not a facet bar; counts on the
  tabs (§2.1).
- **The row carries the object, not just the subject** — for Baseout the Space and, where the
  ticket came from a failure, the run (§2.1). Still the one row element that is Baseout-specific.
- **The thread lives on a route, not in a drawer** (§2.4) — and email-first makes linkability the
  whole argument, so this hardens rather than softens.
- **Reply reopens; it does not mint a follow-up entity** (§2.5). The customer can also close.
- **Per-tab empty states**, plus Gusto's freshness footnote that pre-empts "I just wrote in and
  it's not here" (§2.6).
- **Inbox: separate surfaces, borrow the vocabulary, share no code** (§5). One row crosses —
  "Support replied to your request" as an Inbox **Activity** row — and it belongs to the paired
  monorepo change.
- **No status-over-time timeline** (§6). A ticket has no stages; the conversation *is* the history.
  Four catalog entries are shaped like a timeline and every one has the wrong semantics.
- **The three catalog gaps** (§6): `pattern-message-thread`, `pattern-file-attach`, and a
  customer-facing status-wording rulings table. C §3.1 re-verified all three still absent —
  `/usr/bin/grep -an -E "message-thread|file-attach|pattern-comment|'pattern-attach"` over
  `storybook.ts` returns zero matches.

### 1.4 Its open questions, resolved or carried

| 2026-08-18 question | Now |
|---|---|
| Q1 `apps/support` or `apps/web`? | **Still open**, but no longer blocking: blocker (b) is gone, so the question is where the *views* live, not where the design system comes from. Carried to §9 |
| Q2 Status wording — three labels or two? | **Answered by bound decision 3.** Three. Note the divergence from Zendesk: their third word is `Solved`; ours is `Closed`, because Baseout has one closed state and a ticket the customer closed themselves, or one closed after silence, was not necessarily *solved* |
| Q3 Does the ticket carry a Space? | **Still open and still a migration risk.** `design.md:35` gives the ticket `org/user refs` and nothing else. Carried to §6 and §9 |
| Q4 Machine-context toggles (Supabase's "attach the last run") | **Adjudicated closed for v1.** On `/contact` there is no session, therefore no run to attach — the toggle would have nothing to toggle. It is a signed-in-only feature that arrives with the auth bridge. The anonymous equivalent already ships as the door's own helper text: *"Run IDs, base names and error text all help"* (`contact.astro:85-86`) |

### 1.5 What bound decision 2 dissolves in the same-day research

- **A §3.5's six-digit-code specification** — length, 10-minute lifetime, 5 wrong attempts, 30-second
  resend throttle, daily cap, one-ticket session scope — is **not a build spec any more**. It stays
  in this document as the argument for *why*, if an anonymous view ever returns, it must be a code
  and not a magic link: corporate link scanners (Microsoft Defender Safe Links and peers) follow
  links programmatically before delivery and consume single-use ones
  ([supabase/auth #1214](https://github.com/supabase/auth/issues/1214),
  [Safe Links overview](https://learn.microsoft.com/en-us/defender-office-365/safe-links-about)),
  and Baseout's buyer is a technical ops person, i.e. disproportionately behind such a gateway.
  A's own coda — *"the honest option worth putting to Oleh: build no anonymous portal view at all
  in V1"*, with GitLab Service Desk as the precedent
  ([external participants](https://docs.gitlab.com/user/project/service_desk/external_participants/))
  — is the option that was taken.
- **C's "genuinely missing #4 — a follow-without-signing-in destination"** and its claim that an
  email-keyed anonymous portal *reverses* the `.sb-signin` ruling: **dissolved.** The ruling at
  `contact.astro:473-475` — *"'See the ones I opened' is a different destination from 'open one',
  and it needs an account… a menu item that leads to a locked door is worse than no menu item"* —
  is **confirmed**, not reversed. Nothing in that comment needs editing. What it costs: a returning
  anonymous customer has only their inbox, which is precisely what email-first says it should be.
- **B §2.6's "do not build `/my-requests` for launch"** — see §5.3. Its argument was about an
  *anonymous* audience and does not survive the gate.

---

## 2. The model, in one pass

One case. Two ways in. One queue. The mailbox is the source of truth; the portal is a mirror that
only signed-in people can look into.

```
                 ┌── anonymous ────────────────────────────────┐
docs / chat ──►  │ /contact ▸ "Something is broken"            │
  Ask a person   │  · deflection under the subject field       │
                 │  · attachments · no session, no Space       │──┐
                 └─────────────────────────────────────────────┘  │
                                                                  ├─►  ONE QUEUE
                 ┌── signed in ────────────────────────────────┐  │    (row keyed by EMAIL,
app.baseout.com  │ same form, address printed not asked,       │──┘     `unauthenticated` flag
                 │ Space derived, run attachable               │        set on the anonymous lane)
                 └─────────────────────────────────────────────┘
                                        │
                       ticket created ──┼──► ACK EMAIL   ref · "reply to this email" · no duration
                                        │
                                        ▼
                       human replies ───────► REPLY EMAIL  ── customer replies to it ──┐
                                        │                                              │
                                        └◄─────────────────────────────────────────────┘
                                        │
                          status: Open ─┴─ Awaiting your reply ─── Closed ──(reply)──► Open
                                        │
                       signed-in mirror ▼
                       /requests  →  /requests/:ref     (locked state when signed out)
```

**The two lanes differ in exactly four things,** and nothing else: the anonymous lane asks for the
address (the signed-in lane prints it), carries no Space (the signed-in lane derives it), cannot
attach a run, and sets `unauthenticated` on the row so the record says what it is rather than
implying an account (`design.md:63-64`).

**Status, stored vs rendered.**

| stored | rendered | tone | glyph test | who owes whom |
|---|---|---|---|---|
| `open` | `Open` | ghost | idle, so no hue — `Badge/Status:748`: *"does this state want something from the user?"* | Baseout owes an answer |
| `pending` | **`Awaiting your reply`** | **warning** | the only state with a task on the customer | the customer owes a reply |
| `closed` | `Closed` | ghost, quieter | nothing wants anything | nobody |
| *unrecognised* | `Unknown` | ghost | **a new neutral entry, never an alias onto an existing status** — `Badge/Status:752`, audit D43: `?? statusMeta.cancelled` once labelled an unrecognised backup *Cancelled* | — |

Every one is **glyph + word + colour** (`status.ts:30-31` — colour alone fails ~8% of readers, and
green-vs-grey is the pair that fails first). **Never index the map bare**; route every read through
one `metaOf()` helper.

**Tabs are `Open / Closed / All` with counts** — `Awaiting your reply` is a sub-state of open for
tab purposes. A fourth tab would split the one lane that matters, and a customer holds 1–5 cases,
not 300. Cost: a customer with one awaiting case among five open must scan for it. Paid back by the
last-activity sort putting it near the top and by it being the **only** warning-toned thing on the
page.

---

## 3. The email is the primary surface

Source: A, throughout. This is the half of the product a customer actually uses.

### 3.1 The acknowledgement

Zendesk's shipped default, verbatim: *"Your request ({{ticket.id}}) has been received and is being
reviewed by our support staff. To add additional comments, reply to this email."*
([Zendesk](https://support.zendesk.com/hc/en-us/articles/4408831473562-How-do-I-edit-the-automatic-response-sent-to-someone-who-submits-a-ticket-)).
It does three things, all of which survive the no-SLA constraint: states the case exists and names
its id; **teaches the reply mechanic**, which is the single most load-bearing sentence in an
email-first product; and promises **no duration**.

Ship four facts and nothing else: **received · the ref · "reply to this email to add to it" · (for
a signed-in submitter) the link.** No "shortly", no "as soon as possible", no "within 24 hours". For
contrast on wording the absence of a guarantee honestly, Supabase states SLAs exist only on paid
tiers and that community channels carry "no guarantee of response"
([Supabase Support Policy](https://supabase.com/support-policy)).

**Cost, named:** a customer with no time expectation may re-send, creating a duplicate. Paid
deliberately — the alternative is a duration the business has not agreed to, visibly broken on the
first busy week.

**Loop safety is not optional.** RFC 3834 requires every automatically generated message to carry
`Auto-Submitted`, and requires responders **not** to reply to any message whose `Auto-Submitted` is
anything other than `no` ([RFC 3834](https://datatracker.ietf.org/doc/html/rfc3834)). Zendesk
operationalises the receiving half — inbound mail carrying `Precedence: bulk` or
`Auto-submitted: auto-generated` is suspended under "Automated response mail"
([Causes for ticket suspension](https://support.zendesk.com/hc/en-us/articles/4408828416282-Causes-for-ticket-suspension)).

### 3.2 The acknowledgement's subject line is an abuse surface — RULED

**The collision.** A §3.5 and B §2.6 both recommend Zendesk's March-2026 anonymous flow: the
submission is *provisional*, no ticket exists, and an emailed verification click is what makes it
real — the documented fix for attackers using open support forms as spam relays, sending
attacker-chosen subject lines from the victim brand's domain
([Krebs](https://krebsonsecurity.com/2025/10/email-bombs-exploit-lax-authentication-in-zendesk/),
[Zendesk announcement](https://support.zendesk.com/hc/en-us/articles/10360295453082-Announcing-verification-for-anonymous-help-center-requests)).
**But the client's spec says submit → send email → create ticket → flag unauthenticated.** It
creates the ticket. Provisional submission is a different product.

**Ruling: the spec wins; the abuse defence moves.** The ticket is created on submit. Three
mitigations replace the verification round-trip:

1. **The acknowledgement's subject is ours, not the submitter's.** `[BO-4F2A91] Your request to
   Baseout support` — never `Re: <submitted subject>`. A mail bomb weaponises the **subject line**,
   because that is what lands in the victim's inbox list without being opened. A human's reply,
   later, carries the real subject (§3.3) — by then the address has either engaged or not.
2. **A daily cap on acknowledgements per address**, copied from HubSpot's documented limit of five
   membership-related emails per contact per day
   ([HubSpot](https://knowledge.hubspot.com/website-pages/manage-private-content-settings)).
3. **Rate limiting on the form**, which `design.md:67` already requires: *"An unauthenticated form
   on a public site is a spam target on day one."*

**Cost:** the customer's acknowledgement has a generic subject, so it is marginally harder to find
in their inbox six weeks later. Paid back by the ref in the subject and repeated as the body's first
line. **Beats provisional submission** because provisional costs a round-trip and a measurable
drop-off of people who never click, on a spec that did not ask for it — and beats doing nothing
because doing nothing is the documented Krebs hole. **This is Dan question 1 in §9;** if he wants
the verification round-trip, it is a small backend change and one extra confirmation state, and the
confirmation must then say the request has **not yet** been submitted, never claim a success it has
not achieved.

### 3.3 Anatomy of an outbound reply

Zendesk sends **both HTML and plain-text parts simultaneously**; "the version end users see depends
on their email application settings"
([Customizing your email notifications](https://support.zendesk.com/hc/en-us/articles/4408886168090-Customizing-your-email-notifications)).

| Element | Rule for Baseout |
|---|---|
| Subject | `Re: [BO-4F2A91] <original subject>`. The ref is in the subject because it is a threading signal **and** the only handle a customer can quote back at us |
| First line of body | Repeats the ref. **It must never exist only inside a link** |
| Status line | One short line in the bound wording. Not a badge image |
| Human name | One line, no title, no photo, no legal block. A named human is the whole point of email-first. Where no agent name exists the label is `Baseout Support` — **never an invented person** (the `DataComments` "Author not captured" ruling, `commentText.ts:44-63`) |
| Quoted history | Include, collapsed. Mail clients trim it anyway |
| Link back | One, last. In email-first it is an **offer**, not the payload — which is also why a signed-out click landing on a locked state is acceptable |
| `text/plain` part | **Mandatory.** The only version that survives a corporate gateway stripping HTML |
| Attachments | Links, not bytes (§3.6) |

**Ship no "reply above this line" delimiter.** Zendesk ships it **off by default**, and its failure
mode is user-visible silent truncation: text typed below the line is excluded from the rendered
comment, though "Zendesk stores the full email even if it doesn't appear in the comment field"
([Updated ticket does not show any content](https://support.zendesk.com/hc/en-us/articles/4408820954906-Updated-ticket-does-not-show-any-content-from-the-customer)).
**Cost:** our stripping will sometimes leave quoted junk in a thread. It beats a customer's
paragraph vanishing while support believes it received nothing — an invisible failure in a product
whose pitch is "you can see what happened". The rule to copy from that asymmetry: **never discard,
only collapse**, and store the full MIME source of every inbound message.

### 3.4 Threading, and what the UI shows when it fails

Zendesk's documented signal set, in order
([How are incoming emails threaded](https://support.zendesk.com/hc/en-us/articles/8396827889946-How-are-incoming-emails-threaded-to-tickets)):
`References`/`In-Reply-To` headers → an encoded id in the **body**, in square brackets, e.g.
`[1G7EOR-0Q2J]` → a plus-addressed Reply-To → no match, **new ticket**. Subject-line matching is
deliberately absent, and rightly: it is what makes "Re: your invoice" from three customers collapse
into one case.

**The 30-day window is the fact that decides the id design.** Zendesk keeps threading header data
for 30 days; after that `References`/`In-Reply-To` no longer match and the reply may thread wrongly
or start a new ticket
([Why do emails thread to the wrong ticket](https://support.zendesk.com/hc/en-us/articles/4408821051034-Why-do-emails-thread-to-the-wrong-ticket)).
*(B §2.3 saw this only in a search snippet and labelled it unverified; A fetched the article body.
**A wins — treat the 30-day window as verified.**)* Headers therefore cannot be the only signal; a
durable id in the subject and in the reply-to address is what survives header expiry.

**Two ids, and conflating them is the Krebs/Zendesk failure.**

| | Human ref | Threading token |
|---|---|---|
| Example | `BO-4F2A91` | the local-part suffix of `support+<token>@baseout.com` |
| Where it appears | email subject · body first line · the portal UI · anything a customer quotes | **only** in the Reply-To address |
| Entropy | high — 8 chars over a 32-symbol alphabet, **not sequential** | high, and independently rotatable |
| What holding it grants | nothing. It is a label | the ability to **post** into the thread |
| What it must never grant | read access | read access |

The mechanism behind the rule: signals 2 and 3 above are **bearer tokens in plain text**, and
Zendesk's abuse history is the concrete exploit — an attacker who knew the support address and a
ticket id, "often sequential and guessable", could spoof the sender and CC themselves onto someone
else's ticket ([Krebs](https://krebsonsecurity.com/2025/10/email-bombs-exploit-lax-authentication-in-zendesk/)).
So: the human ref is high-entropy *as well*, because a customer pastes it into public forums; and it
is still a **different string** from the routing token, so leaking one does not hand over the other.

**What the UI must show when threading fails.**

| Failure | Cause | UI |
|---|---|---|
| Reply cannot be threaded at all | no headers, no id, unknown sender | **Create a new visible case. Never hold silently.** Zendesk's hold-bucket (suspended tickets) is agent-only ([Understanding suspended tickets](https://support.zendesk.com/hc/en-us/articles/4408889141146-Understanding-suspended-tickets-and-spam)); a held message is invisible to the customer *and* to their notification, which in email-first is indistinguishable from being ignored |
| Reply threads to an old case unexpectedly | the customer replied to a saved old notification | Every case view carries a plainly labelled **"Start a new request"** door, so reply-to-old is not the default path. Zendesk's own documented remedy is the manual version of this |
| Reply from a different address | threading is by token, so it lands — Zendesk then flags "User has yet to confirm ownership of the address used to deliver this email" ([spoofed emails](https://support.zendesk.com/hc/en-us/articles/4436864526618-Why-do-I-receive-spoofed-emails-in-my-account)) | The thread renders an **unverified-sender marker on that message** and does not silently attribute it to the submitter. GitLab's version: an external participant's reply "displays the email address of the external participant instead of a GitLab username" ([GitLab](https://docs.gitlab.com/user/project/service_desk/external_participants/)) |
| Out-of-office / autoresponder lands in the thread | detection is header-based and **leaks** — Zendesk documents OOO replies that do *not* reach the suspended view ([why aren't OOO replies appearing](https://support.zendesk.com/hc/en-us/articles/4408818595482-Why-aren-t-out-of-office-replies-appearing-in-the-suspended-ticket-view)) | The thread renders a machine-generated message **without letting it change state**: it must not count as "customer replied", must not flip the status out of `Awaiting your reply`, and must not bump the last-activity sort |
| Attachment dropped | over the size limit | An explicit artefact in the thread — *"Attachment removed — over the size limit"* — **never silence** (§3.6) |

**Do not badge messages by channel.** Zendesk's end-user request list shows Subject, ID, Created,
Last activity, Status and **no channel column**
([Help Center request list](https://support.zendesk.com/hc/en-us/articles/4408821681050-How-can-I-add-content-to-the-Help-Center-Request-list-page-activities-)).
Origin is our implementation detail; the customer knows how they sent it. **Do** badge identity
confidence — the distinction worth rendering is not *email vs portal*, it is **verified author vs
asserted author**.

### 3.5 Quoted history and signatures

There is no standard. Mailgun built `talon` because "there is no standard format for an email
message, and different email clients compose replies in different manners"
([Mailgun](https://www.mailgun.com/blog/product/open-sourcing-our-email-signature-parsing-library/)),
and ML stripping has a documented **over-stripping** failure — `stripped-text` "excluding
information that was not a quoted part or signature block", commonly triggered by a colon in the
body ([talon #129](https://github.com/mailgun/talon/issues/129)). Over-stripping is the dangerous
direction: it removes real content, silently.

**Strip conservatively, never delete — collapse.** Label the control with what and how much
(`Show quoted text · 34 lines`), not a bare ellipsis; Gmail's universal precedent is "Show trimmed
content". Low-confidence parses render **unstripped**. Corporate legal disclaimers are appended by
the gateway after the sender's client, are distinguishable by no header, and fold into the same
collapsed region — there is no reason to model them separately.

**One divergence from A, ruled.** A wants a **View original email** control on every thread message,
copying Zendesk's escape hatch. On a *customer-facing* thread that is noise — a customer reading
their own message does not audit our parser. **Ruling: raw MIME retention is a storage requirement
(§6) and "View original" is agent-side.** The customer-facing half is the collapse control alone.
Cost: a customer who suspects truncation cannot check. Small, because we ship no delimiter — nothing
is truncated, only collapsed.

### 3.6 Attachments over email

| | Inbound per file | Outbound | Count |
|---|---|---|---|
| **Zendesk** | 50 MB; over that "the ticket is created without the attachment" | **7 MB/file, 10 MB total**, then auto-converted to **linked** attachments | 500/ticket authenticated; **5 per request for unauthenticated web-form submitters**, a spam policy admins cannot change ([source](https://support.zendesk.com/hc/en-us/articles/4408832757146-Allowing-attachments-in-tickets)) |
| **Plain** | **6 MB for email** | — | 100/message ([source](https://www.plain.com/docs/graphql/attachments.md)) |
| **Baseout today** | 10 MB/file, 5 files, PNG/JPG/GIF/WebP/PDF | — | `submit.ts:78-98` |

**The asymmetry is the design rule: inbound caps are generous, outbound caps are tiny.** In
email-first the outbound reply is therefore *always* link-bearing, never byte-bearing. And a link is
the only attachment we can later revoke — Zendesk's redaction is **irreversible and "doesn't affect
external channels"**, so anything already mailed out is outside our control
([Redacting ticket content](https://support.zendesk.com/hc/en-us/articles/4408846470170-Redacting-ticket-content)).
Attachment URLs must be **expiring signed URLs scoped to the viewing session**, not long-lived
bearer links — Zendesk's standard attachments "use complex random tokens but remain visible to
URL/token holders".

Baseout's existing limits are already announced **before** the picker opens, derived from the
constants rather than written twice (`ATTACH_HINT`, `submit.ts:96-98`; rendered at
`contact.astro:291-322`), and per-file rejection is already a message rather than a catastrophe
(`submit.ts:506-528`). What is missing is one sentence about **third-party data** —
*"Screenshots often contain record data. Crop or blur anything that shouldn't leave your base."*

**A said no peer does this and called it a gap. C's inventory upgrades that claim: Baseout already
does it in one door.** The billing door's helper reads *"…the last four digits of the card if a
payment failed. Never send a full card number"*, with the reason written above it: *"People paste
one when a payment fails and the field says nothing, and once it is in a ticket it is in a mailbox,
a database and a backup… it has to be said before the box, not after"* (`contact.astro:94-99`). The
screenshot sentence is the same move on the ticket door's `filesHint`. It is a precedent, not an
invention — which is the strongest possible argument for shipping it.

**`cid:` resolution is the main path, not an edge case.** Screenshots are the dominant attachment in
a support tool, and screenshots usually arrive **inline** — a MIME part referenced by `cid:` from
the HTML body. Unresolved, the customer's screenshot renders as literal text like
`[cid:image001.png@01D72008.6F1763B0]`
([Zendesk community](https://support.zendesk.com/hc/en-us/community/posts/4408868723098-Embedded-images-from-emails-not-showing-in-ticket)).

---

## 4. The chat → ticket handoff

Source: B §1. Bound decision 1 makes the handoff a **destination change**, not a transfer — which is
what disqualifies the industry default.

### 4.1 The affordance

**One persistent, low-emphasis control in the composer row, from the first turn, on every docs
page.** Placement copied from Base44, which pins its escalate to the right of the "AI assistant ·
May make mistakes" disclaimer under the input
([Mobbin](https://mobbin.com/screens/395389df-bb57-46b6-bb2d-db2a19696b8e)); Blue Apron ships the
cheaper version as a standing quick-reply chip
([Mobbin](https://mobbin.com/screens/367291cd-490c-4512-aa07-2d25258b1873)).

**Rejected — conversational-only escalation**, which is Intercom Fin's documented default: *"In Fin
over chat, escalation to a human teammate happens through text — Fin offers the handoff
conversationally, not through a button"*
([Intercom](https://www.intercom.com/help/en/articles/12396892-manage-fin-ai-agent-s-escalation-guidance-and-rules)).
It works when a human queue exists and the bot can hand into it mid-sentence. **Here it produces the
exact dead end the portal already has**: the user types "can I talk to a person" and the assistant
must explain that it cannot do that. Baseout's current line is worse than that — `chat-core.ts:196`
tells an out-of-matches visitor to *"open a ticket if you're signed in"*, which points at a surface
that **does not exist** (`/tickets` is a redirect). That is the doom-loop anti-pattern with a broken
link inside it, and it is where the promoted control goes.

**Label.** Keep B's **`Ask a person`**. Rejected: `Talk to a human` (Blue Apron) and `Talk to a
support specialist` (Base44) — both imply a live queue Baseout does not have. Cost of `Ask a
person`: one word of ambiguity at press time about *how* the person is reached, resolved within
200 ms by the destination, whose own submit button already reads `Send to support`
(`contact.astro:88`).

**The second trigger.** After **two consecutive turns whose answer cites no doc**, or a user message
that restates the previous one, the same control is promoted in place to a soft inline row — not a
new modal, not a new control. **Sentiment detection is rejected**: it is the one trigger family with
no observable ground truth in this stack, it mis-fires on terse admin users, and the Linear/Vercel/
Plaid register has no room for a bot that reacts to tone.

**Also rejected: a "was this helpful? 👍👎" on chat answers** unless the 👎 branch's only job is to
raise `Ask a person`. A thumbs-down that logs a metric and offers nothing is the loop —
Intercom's own community carries a thread titled "How to deal with customers saying 'No' to Fin's
question of whether it answered their question"
([community.intercom.com](https://community.intercom.com/train-fin-94/how-to-deal-with-customers-saying-no-to-fins-question-of-whether-it-answered-their-question-14715)).
WhatsApp's version survives only because the same message already handed over a ticket number.

### 4.2 The payload

Every vendor with real documentation attaches the transcript; the differentiator is a **summary** on
top, and the stated reason is always the same — the human should not have to read the transcript to
learn why the conversation escalated. Ada summarises "all the messages exchanged… so far", placed
"after the last message of the transcript", because "This summary helps support agents quickly
determine the reason for the escalation"
([Ada](https://docs.ada.cx/scripted/docs/integrate-ada-with-other-tools/attach-chat-summaries-to-handoff-transcripts)).
Intercom's structured handoff note exists because a poor one forces agents to "restart the
conversation, asking the customer to re-explain their issue"
([Intercom](https://www.intercom.com/learning-center/ai-human-collaboration-procedures-handoffs)).

Pressing the control routes to `/contact?kind=ticket` — a **real route change**, using the URL guard
that already exists (`submit.ts:183-185`, `isKind` at `:53`) — with the body pre-filled, in this
order:

```
[user-editable free text — empty, focused, placeholder:
 "Anything the transcript does not already say?"]

--- from your chat, 21 Aug 2026 ---
Page: /platforms/airtable/restore/
What you asked:  <verbatim, the user's own messages, up to 3, most recent first>
What the assistant answered:  <2–3 line summary of the AI's own answers>
Docs it cited:  <titles + paths of every article the answer linked>
Why this is here:  <"you asked for a person" | "the assistant could not cite a doc for this">
```

Four rules, each traceable: the **user's own words are verbatim, never summarised** — summarising
the customer is how a handoff loses the fact the human needs; the **AI's side is summarised, not
transcribed** (Ada's rationale); the **cited docs travel**, so the human does not re-send an article
the user already rejected; and the **page URL travels**, because for a backup tool the surface
someone was reading is half the diagnosis.

### 4.3 The review block — the deliberate divergence

The block renders in the `/contact` composer as a **collapsed, bordered, editable quote** labelled
`Chat transcript (2 messages)`, with a disclosure chevron and a `Remove` action. Three properties,
none optional:

- **Visible before submit**, not attached invisibly. Across Intercom, Zendesk, Ada and Decagon there
  is **no documentation of the customer being shown the summary, asked to approve it, or consenting
  to the transcript being attached**. Ada's page explicitly declines to say whether customers see
  it. This is a gap in the industry, not a settled pattern — so showing it is a differentiator, not
  a deviation.
- **Editable and removable.** A Baseout chat about a failing restore can carry base names, table
  names, record counts, a pasted API error with an id. Snowflake's answer is a standing warning
  ("Do not enter any confidential information, data that has been uploaded to the Service…",
  [Mobbin](https://mobbin.com/screens/49451731-8a5e-463e-b7ef-890af3d7978e)); Aboard's is a composer
  hint ("To keep your identity private, avoid mentioning personal details",
  [Mobbin](https://mobbin.com/screens/e7a52c3d-53ec-4a2b-a1aa-5cc4db708dab)). **Baseout should let
  the person delete.**
- **Opt-out, not opt-in** — attached by default, removable in one click. Opt-in loses the context
  for most users, which is the failure Decagon and Intercom both name. Cost: a user who does not
  read the block sends more than they meant to; the collapsed-but-visible rendering and the
  `Remove` control are what buy that back.

**Build note.** The block is markup built at click time, so its classes must live in `support.css`
(global) or use `:global()` — a scoped `<style>` never reaches `innerHTML`-built DOM (`status.ts:103-107`,
`icons.ts:151-155`, `support.css:284-286`; the established pattern is at `contact.astro:858-869`).

### 4.4 The wait, said honestly

The sweep splits cleanly into copy that survives bound decision 5 and copy that does not.

| Survives | Does not |
|---|---|
| **Supabase** — names the address: "We'll reach out at alexsmith.mobbin+1@gmail.com" ([Mobbin](https://mobbin.com/screens/25174a6a-493c-45a3-9d9a-72f90859262e)) | **Whop** — "Refund requests get answered within 48 hours!" ([Mobbin](https://mobbin.com/screens/bbd4e248-ff4f-489f-8a57-4e2b5716d737)) |
| **Cofounder** — names the event: "We'll email you when there is an update" ([Mobbin](https://mobbin.com/screens/ec1b23cc-c10a-4aa0-9615-1499f6849f8d)) | **Etsy** — "Typically responds within a few hours" ([Mobbin](https://mobbin.com/screens/b49d37b5-d908-42f2-868c-d6b02978fe20)) |
| **Expedia** — refuses outright: "While we cannot guarantee a response, we can assure you that the report will be read and investigated" ([Mobbin](https://mobbin.com/screens/5c1e19f6-1898-4c5b-bf27-d8ee6ec2edc5)) | **Intercom's own worked example** — "will follow up within 2 hours". The vendor's model answer is the thing to not copy |

Ship, verbatim:

> **Sent.** A person will read this and reply by email to `oleh@example.com`.
> We don't publish response times — you'll get an email the moment there's an update.
> Reference `BO-4F2A91`.

The second sentence does the work Whop's "within 48 hours" does, without the promise: it converts
"we won't tell you how long" from an omission into a stated policy.

---

## 5. The surfaces, and their states

### 5.1 The create form — `/contact`, and its deflection

**What already ships and must not be rebuilt:** the fork and step machine (`submit.ts:100-190`), the
`?kind=` deep link, the `?about=` platform pre-answer, per-door attachments, `novalidate` with named
failures, `readVoteEmail()` pre-fill (*"Someone who has already voted has already given us this.
Asking again is a toll"*, `submit.ts:385`), and five distinct done-states.

**CORRECTION — B §3's cheapest finding is wrong for us, and the correction is worth more than the
finding.** B states: *"Baseout's five doors currently share a body field; changing the label and
placeholder per door costs nothing."* **They do not share it.** Verified by reading the file:

| door | body label | body helper | line |
|---|---|---|---|
| `ticket` | `What happened?` | "Run IDs, base names and error text all help. Please leave out anything you would not want support to read." | `contact.astro:84-86` |
| `billing` | `What do you need?` | "An invoice number, the plan you are on, or the last four digits of the card if a payment failed. **Never send a full card number.**" | `contact.astro:94-99` |
| `other` | `What is it?` | "Say as much as you can. If it turns out to be a fault or an idea, we will move it to the right place for you." | `contact.astro:107-109` |
| `request` | `Why — what would this let you do?` | "The reason is worth more than the vote. One concrete situation beats a paragraph of description." | `contact.astro:362-364` |
| `sales` | `What do you want to know?` | "How much data you are protecting, how many people need access, and any policy you have to meet…" | `contact.astro:442-444` |

The three private doors take theirs from a `PRIVATE` array (`contact.astro:79-113`), rendered at
`:286-289`; `request` and `sales` are hand-written for the reasons argued at `:72-77` and `:29-37`.
**Two things follow.** First, the Zapier pattern B recommends is already implemented, and
implemented *better*: Baseout uses a persistent `<small>` helper, not a placeholder — a placeholder
disappears on focus, i.e. exactly when the person starts typing the thing it was warning them about.
Second, the billing door is the reason this matters: *"Never send a full card number"* is a
data-protection instruction that only works because the label and helper vary per door. Do not
"add" this; do not regress it into a shared field.

**What is missing on this form: article suggestions under the subject.** The machinery already runs
on this page for a different purpose. `wireDuplicates()` (`submit.ts:239-292`) watches
`[data-dupe-input]`, calls `findSimilar()` (`:312-341`) which queries Pagefind and keeps hits under
`/roadmap/`. Point the identical machinery at the ticket subject and **invert** the filter — keep
hits that are **not** in `NOT_DOCS`, a predicate already written at `search-modal.ts:59-66` — and
the following are solved for free: phrase-then-words fallback (**Pagefind ANDs its terms**, so a
phrase query matches nothing — `submit.ts:294-304`), the ≥2-word overlap floor (*one shared word is
a coincidence*), 200 ms debounce, 4-char minimum, the sequence guard, and the shared row vocabulary
(`lib/rows.ts` `docRow`). **Estimated new code: a second call site plus one inverted predicate. No
new retrieval, no new index, no server.**

The corpus is ready: **86 docs pages**, of which the eight `troubleshooting/*` pages map almost
one-to-one onto the ticket door's likely subjects — `attachments-skipped` · `backup-failed` ·
`connection-finds-nothing` · `connection-needs-reconnecting` · `missing-bases` · `restore-left-gaps`
· `run-slow-or-stuck` · `what-baseout-cannot-capture`.

**Placement — ruled.** B offers two proven renderings: Snowflake's right column beside the field
([Mobbin](https://mobbin.com/screens/49451731-8a5e-463e-b7ef-890af3d7978e)) and Teachable's inline
"Check out this article:" strip. **Take the inline strip.** `/contact` is a single-column form inside
Starlight's content column with the docs sidebar explicitly suppressed
(`support.css:355-372`); there is no right column, and manufacturing one would fight the portal's
own layout at every breakpoint. Cost: it pushes the body field down. Mitigated by capping at three
rows. **The strip must carry the escape hatch** — Teachable's "Can't find what you're looking for?"
— because a deflection with no exit is a wall.

**The trap that will make this look broken:** Pagefind indexes at **build** time and does not exist
under `astro dev` at all. `/pagefind/pagefind.js` 404s, `searchDocs` returns `[]`, and every
dependent feature silently shows nothing — stated three times in the repo (`pagefind.ts:3-6`,
`submit.ts:9-10`, `smoke-support.mjs:8-11`: *"which is exactly how 'search is broken' was reported
twice in one day when the dev server was what got tested"*). Verify against
`pnpm --filter @baseout/support build && pnpm smoke-support`, never the dev server.

**What the form must still not ask** (unchanged from `research-tickets.md` §2.3): priority /
severity / urgency (`design.md:50` non-goal; Supabase and Snowflake are the **named
counter-examples**, not models), a category beyond the door, and CSAT.

### 5.2 The done-state

**Slot, already located by C §2.8:** inside `data-step="done"`, between `[data-done-body]`
(`contact.astro:462`) and the "Nothing was sent" note (`:466`). `DONE[kind]` gains fields; the markup
gains no step.

| Element | Exists? |
|---|---|
| Kind-specific destination sentence — *"That would have gone to support"* | **Yes**, `DONE[kind]`, `submit.ts:345-373`. A shared "Thanks, we got it" is already explicitly rejected at `:354-356` |
| The address echoed back | Trivially available — the value is in hand at `submit.ts:416` |
| A quotable ref + copy control | **No component.** `pattern-copy-id` (`storybook.ts:2645-2680`) is the anatomy, but it is a Tailwind/daisyUI recipe in `apps/web`; the portal has no daisyUI and `icons.ts` has neither a `copy` nor a `check` glyph. §8 item 5 |
| "Reply to this email to add to it" | **No.** New copy, and it is the load-bearing sentence |
| The wait, honestly | **No.** §4.4's three lines |
| Deliverability recovery | **No.** Print the sending domain to allow and "check your spam folder", plus the plain support address as an unglamorous escape hatch — if the mail is filtered, an anonymous customer has **no other channel**. Mailchimp documents the sender-side convention ([safe sender lists](https://mailchimp.com/help/use-safe-sender-lists-to-stay-out-of-spam-folders/)); Microsoft documents the recipient-side mechanics ([create safe sender lists](https://learn.microsoft.com/en-us/defender-office-365/create-safe-sender-lists-in-office-365)). *(The specific Supabase deliverability string quoted in `research-tickets.md` §2.3 is behind an authenticated dashboard and **could not be verified** — treat as reported, not cited.)* |
| A way back that is not the roadmap | **No.** Today the only exit is `/roadmap/` (`:470`), which is wrong for `ticket`/`billing`/`sales` |

The un-removable *"**Nothing was sent.** This portal has no backend yet"* disclaimer (`:466-469`)
stays until there is a backend, and it is what keeps the rest of this honest.

### 5.3 `My requests`

**B recommended not building it. Ruled: build it, signed-in only.** B's argument — five of fifteen
portals publish no history destination, and every portal that does gates it behind an identity
Baseout lacks, so the page is "empty for the anonymous majority, for a reason the page cannot
explain" — was made about an **anonymous** audience. Bound decision 2 removes that audience
entirely: signed-out never reaches a list. What remains of B's warning is its strongest half, and it
stands: **the signed-out state must not be an empty list.**

**The signed-out state is `pattern-locked-tab` (`storybook.ts:4834`), rendered in place** — a calm
`lucide--lock` mark ("a lock, not a warning triangle"), the feature's name, one line on what it
does, one line on **why it is locked as a capability reason, not a bare upgrade**, and the
affordance. This is a deliberate divergence from the 302-to-sign-in that Zapier and Figma both do
(verified live: `help.zapier.com/hc/en-us/requests` → 302 → `zapier.zendesk.com/access?…&return_to=…`);
Baseout's catalog ruling is *render in place, never hide*, and the portal is a separate origin where
a redirect throws away the reason the person came.

**It earns no header NAV slot until sign-in exists.** `contact.astro:473-475` stands: *"a menu item
that leads to a locked door is worse than no menu item."* Until then the only doors are the
`.sb-signin` line and the done-state. When the slot is finally added it touches two places — the
`NAV` array (`Header.astro:37-41`) **and** the mobile top-level sidebar entries in
`astro.config.mjs`, which are declared separately.

**The row.** Card, not table: a customer holds 1–5 cases, the portal owns no table vessel, and
`RequestCard.astro:98-166` already has the right anatomy — context rail / body / record rail. Map:
rail = Space (and platform mark, if the case carries one); body = subject + last-message snippet;
foot = status badge + last activity. B's Snowflake finding — *"the 'your turn' marker belongs on the
row, next to the subject, not buried in a status column"*
([Mobbin](https://mobbin.com/screens/8077f169-1a2e-4437-92fc-3948bfbd49b5)) — **dissolves here
rather than being obeyed or rejected: there is no status column in a card layout.** The
`Awaiting your reply` badge is carried once, in the record rail, and it is the only warning-toned
thing on the page.

**States:** `Open (n) / Closed (n) / All (n)`, sorted by **last activity desc**. Per-tab empty
states, not one: "no **open** requests" is a different sentence from "you have never written in",
and the first-ever version points at the docs and the chat, which are free and already shipped
(`pattern-empty-state:4253` governs, and its **absence-naming titles are banned** — name the
mechanism). Carry Gusto's freshness footnote: *"It may take a few minutes for a new request to
appear"* — the line that prevents a support ticket about the support ticket.

`RequestCard` is `FeatureRequest`-typed and `StatusBadge` is `RequestStatus`-typed, so a ticket row
is a **sibling component on the same grid**, not a call into these. Same for the status table: the
`StatusMeta {slug,tone,icon,hint}` mechanism transfers verbatim; the six roadmap words do not.

### 5.4 The thread

**On a route, `/requests/:ref`** — linkable from the email, survives a cold load, imports no
panel-stack machinery. Ordering **oldest-first**: *"a conversation reads down, unlike the stream,
which is a feed"* (`RecordPanel.astro:39,46`).

The tree's only real two-party thread is `apps/web/src/components/data/RecordPanel.astro:907-953`
(`.rp-cm-*`), and **no catalog entry describes it**. Its anatomy is the build target: 24px initials
chip; `.rp-cm-noini` — an **empty 24px slot** when there is no name, because *"the chip is dropped,
the SLOT never is… losing the box would ragged the whole thread rather than just that one comment"*;
`.rp-cm-reply` indented 32px (= chip 24 + gap 8, so reply text lines up under the parent's);
13px/1.5 body at 85% with `pre-wrap` and `overflow-wrap: anywhere`; one-line file chips with **no
thumbnail**; a reduced-motion-guarded deep-link cue.

Rulings it inherits, quoted: *"Keep it dense + utility: label + subtle background + alignment for
sender, no avatars or gradient bubbles"* and *"anchor the assistant reply on a QUIET plate… soften
body text to ~85% base-content — pure white on the dark theme halates"*
(`pattern-schema-chat:5783-5784`); *"Don't render an absent identity in the same weight, size and
colour as a real one"* — chosen by an `isNamed()` predicate, **never by string-comparing the label
against the fallback** (`commentText.ts:44-71`); and honest edit markers only — "Edited" is honest,
a "view previous version" affordance would be a lie.

**What it must NOT inherit from `DataComments.astro`**: the flat one-line-per-message table row
(that is a cross-record *stream* — expressly *"the two are deliberately different shapes for the
same data"*), its status vocabulary (`deleted`/`recordDeleted`, which describe a captured artefact
leaving the source, not a case moving through a workflow), and its attachments-as-a-count-plus-
tooltip compromise, which was forced by a dense table's column budget. A thread has the panel's
room, so it takes the **chips** side of that trade — settled once from competitor evidence at
`storybook.ts:4870`: *"nobody puts filenames in a dense row; the most Mercury and ClickUp do is a
COUNT"*. **Chips in the thread, a count on the list row. Never both, never the other way round.**

**Metadata row:** the ref with a copy control, created, last activity, Space. Plus the standing
**"Start a new request"** door (§3.4).

### 5.5 Reply, close, reopen

**Reply reopens. One transition, not a second entity.** Zendesk's model mints a follow-up ticket for
a closed one
([creating a follow-up](https://support.zendesk.com/hc/en-us/articles/4408883882522-Creating-a-follow-up-for-a-closed-ticket))
— but that exists because Zendesk has two closed-ish states, *solved* (reopens) and *closed*
(spawns a follow-up), and the transition between them is time-driven: solved→closed defaults to 4
days and is capped at **28**, a system rule that "can't be changed"
([Zendesk](https://support.zendesk.com/hc/en-us/articles/4408885773338)). **Baseout has one
`Closed`, so A's flagged conflict does not arise and the standing rule wins**: replying flips
`closed` → `open` and says so inline. It needs no parent/child field in a data model that has none
and should not grow one. If a hard-close is ever added, the thread needs a **linked-predecessor
affordance** — file that as the condition, not as work.

**The customer can close their own case** (Base44's `Close Ticket` is a customer action) — someone
who fixed it themselves should be able to say so without writing "nvm, fixed it".

**No timed auto-close in v1.** A timed close needs a warning email, which is a whole flow. Dan
question 6.

**The composer exists only where a reply can actually be sent** — i.e. signed in. For the anonymous
lane the reply path is the email, and the thread says so rather than showing a disabled box.

---

## 6. Data-model gaps — file these now or pay a migration

`design.md:35` currently specifies: *"ticket (id, org/user refs, subject, status open|pending|closed),
messages thread"*. Everything below is absent from it. `design.md:63-66` (Backend handoff) adds the
email key, the `unauthenticated` flag, the acknowledgement email, one queue and rate limiting — that
part is already written and stands.

| # | Field | What breaks without it |
|---|---|---|
| 1 | **`spaceId`** (nullable — the anonymous lane has none) | The row cannot carry the object. Every peer in the sweep puts it there (Base44's `App: 69b7aaba…`, Supabase's project id, LangChain's product area), and for a backup tool the Space is half the diagnosis. Retro-fitting means a migration **and** re-asking every open case which Space it is about |
| 2 | **`runId`** + its status/error code (nullable) | The one ticket type Baseout exists to receive — "my backup failed" — cannot point at the run that failed. Support then asks for it in the first reply, which costs a full round-trip on **every** failure ticket. It is also the field the signed-in "attach the last run" toggle writes to, so its absence blocks that feature as well as this one |
| 3 | **An attachment concept on a message** — `{name, size, type, storageKey, scanState}` | `design.md:35` says "messages thread" with no attachment concept at all. Without it the thread cannot render file chips, the size/type/malware rejections have nowhere to be recorded, and a "dropped for size" artefact cannot exist — which forces the silent rejection §3.4 forbids. Note `requests.ts:93-98`'s `Attachment {src, alt, caption?}` is **not** reusable: it is a roadmap *image*, not an uploaded file |
| 4 | **Two ids** — `ref` (human, high-entropy, quotable) and `threadToken` (routing, rotatable, reply-to only) | One id is the Krebs hole (§3.4). If they are conflated, the string a customer pastes into a public forum becomes a write key into their own case; if the human one is sequential, it is enumerable. Adding the second id **after** cases exist means every live thread's reply-to changes, which breaks the 30-day header window at the same moment |
| 5 | **`unauthenticated: boolean`** (specified at `design.md:63-64`, rendered nowhere) | Agent-side, the record implies an account the person does not have. Customer-side it is the input to the merge rule below. It exists in the spec; what is missing is that **nothing consumes it** — the same failure as `provisional: true`, a declared field read by no component, every gate green |
| 6 | **`authorVerified`** per message, and **`kind: 'human' \| 'auto'`** | Without the first, a reply from an address we have not verified is silently attributed to the submitter — the spoofing case Zendesk flags explicitly. Without the second, an out-of-office bounce counts as "customer replied", flips the status out of `Awaiting your reply`, and bumps the sort. Detection **leaks** (Zendesk documents OOO replies that miss the suspended view), so the model must tolerate one arriving |
| 7 | **`lastActivityAt`**, distinct from `raised` | The list's single most consequential default (sort by last activity) cannot be computed without a scan of the message table, and the "which one moved" question the page exists to answer goes unanswered |
| 8 | **Raw MIME source retained per inbound message** | The "never discard, only collapse" rule (§3.3) has nothing to fall back on when the parser over-strips, and over-stripping is the documented failure direction. Cheap to store now, unrecoverable later |
| 9 | **The merge rule: prior anonymous cases attach to an account only if that case's submitter address was proven** | Without it, an unverified address follows someone into an account and hands them a stranger's case history. Help Scout's model is the useful precedent — a contact record "is created automatically the first time you receive an email from or send an email to an address" ([Help Scout](https://docs.helpscout.com/article/73-customer-profiles)), consolidated by explicit **merge** ([merging profiles](https://docs.helpscout.com/article/66-merge-duplicate-customer-profiles)). Baseout's proof of ownership, absent a code screen, is **an inbound reply from that address on that case** |
| 10 | Rate-limit + per-address acknowledgement counters | §3.2's abuse ruling is not implementable. Not a UI field; named here because it is the thing standing in for provisional verification |

---

## 7. Build-from map

UI element → what it is built from → `file:line`. From C, trimmed to the ticket surfaces.

| Element | Build from | File |
|---|---|---|
| Glyphs (`ticket`, `paperclip`, `send`, `lock`, `log-in`, `clock`, `triangle-alert`, `circle-check`, `arrow-left`) | `Icon.astro` / `iconHtml()` — `ticket` and `paperclip` already exist | `apps/support/src/components/Icon.astro:11-32` · `apps/support/src/lib/icons.ts:53,58,156-162` |
| Status pill (soft, glyph + word + colour) | `.bo-badge` + `.bo-tone-*` paint; `StatusBadge.astro` shape (sibling component — its prop is `RequestStatus`) | `apps/support/src/styles/support.css:287-340` · `apps/support/src/components/StatusBadge.astro:14-26` |
| Status table (mechanism, not the words) | `StatusMeta {slug,tone,icon,hint}` + `statusMeta()` + `statusBadgeHtml()`, with a **total-registry fallback** | `apps/support/src/lib/status.ts:36-114` · rulings at `storybook.ts:699,748,752` |
| List row (context rail / body / status+who rail) | `RequestCard.astro` anatomy | `apps/support/src/components/RequestCard.astro:98-166` |
| Detail page (back link, facts row, prose, aside, foot) | `roadmap/[slug].astro` `.rd-*` | `apps/support/src/pages/roadmap/[slug].astro:63-146,160-272` |
| Message thread (initials chip, empty slot, indented reply, edited marker, file chips, deep-link cue) | `.rp-cm-*` — the tree's only real thread, **undocumented** | `apps/web/src/components/data/RecordPanel.astro:907-953` · builder `recordReadBody.ts` |
| Identity fallback (name → email → worded absence, muted italic, chosen by predicate) | `authorLabel` / `authorIsNamed` | `apps/web/src/components/data/commentText.ts:44-71` |
| Two-facet filter / tabs over a list (AND, items by `[data-slug]`) | `wireBoard()`'s filter half | `apps/support/src/lib/board.ts:25-125` |
| Email identity store (ask once, remember, never render) | `readVoteEmail` / `writeVoteEmail` / `looksLikeEmail`; the `<dialog class="vote-dialog">` + its paint | `apps/support/src/lib/votes.ts:71-83` · `board.ts:167-214` · `support.css:175-266` |
| Step machine (fork → form → done, `?kind=`, title sharpening) | `wireSubmit()` + `show()` + `isKind` | `apps/support/src/lib/submit.ts:100-190` |
| Attachment picker (accept list, per-file cap, removable rows, live region, focus recovery) | `wireAttachments()` + `.sb-files` markup | `apps/support/src/lib/submit.ts:78-98,442-565` · `contact.astro:291-322` |
| Validation + failure region | `wireForm()` + `fail()` + `.sb-err` | `apps/support/src/lib/submit.ts:375-426` · `contact.astro:324,781-792` |
| Done-state | `DONE[kind]` + `data-step="done"`; new fields slot at `contact.astro:462-466` | `apps/support/src/lib/submit.ts:345-373` · `contact.astro:454-471` |
| Deflection (subject → articles) | `searchDocs` + `findSimilar`'s phrase-then-words ranking with the **inverted** `isDocsUrl` predicate | `apps/support/src/lib/pagefind.ts:73-94` · `submit.ts:294-341` · `search-modal.ts:57-66` |
| Result rows built at keystroke time | `askRow` / `docRow` / `linkRow` / `groupLabel` / `esc` (`esc` is not optional — these are `innerHTML`) | `apps/support/src/lib/rows.ts:17-69` |
| Escaping discipline for a message list | `paint()` — `textContent` for the body, `insertAdjacentHTML` only for the sources `<details>` | `apps/support/src/lib/chat-core.ts:123-133` |
| Two-step "answer, then qualify" (a close-out prompt) | `PageFeedback` `.fb-*` + `show(root, step)`. Its **"no email field"** ruling is a precedent against asking for an address twice | `apps/support/src/components/PageFeedback.astro` · `page-feedback.ts:55-59` |
| Platform field on a ticket | `RelatedToField.astro` (radios-as-chips, `allowNew`) — already on the ticket door at `contact.astro:270` | `apps/support/src/components/RelatedToField.astro:25-45` |
| Route reservation | `/tickets` redirects to `/contact`; a real page reclaims it by **deleting the redirect** | `apps/support/astro.config.mjs:19-21` |
| Sidebar opt-out for a new service page | extend **all three** `.rb`/`.sb` selectors; the specificity note at `:351-353` is load-bearing | `apps/support/src/styles/support.css:355-372` |
| Header destination + mobile equivalent | `NAV` array **and** the sidebar top-level entries (declared separately) | `Header.astro:37-41` · `astro.config.mjs:70+` |
| Render gate | `pnpm --filter @baseout/support build && pnpm smoke-support` | `.claude/hooks/smoke-support.mjs` |

**Gates, stated so nobody assumes green means checked.** `apps/support` is covered by **`typecheck`
(astro check) and `smoke-support` only**. Not `ds-lint`, not `ds-audit`, not `census`, not
`css-guard` — the last covers `brand/baseout-bridge.css` but **not** `apps/support/src/styles/support.css`
nor any `<style>` in the app. Lucide-only, soft+semantic badges, the SM/12px floor, token-only
colours, daisyUI tooltip over native `title=`, and the 4px grid are all held **by hand** here.
`astro check` is also blind to `.astro <script>` blocks, which is why `board.ts`, `submit.ts` and
`chat-core.ts` are extracted `.ts` files — a ticket surface must keep doing that.

**Traps that bite these files specifically:** scoped styles never reach a child component ·
`.parent > *` can match nothing across a component boundary (17 of 20 cards kept a margin the reset
was written to kill — `RequestCard.astro:174-185`) · a scoped `<style>` never reaches
`innerHTML`-built DOM · an Astro comment inside a template expression is an **SSR 500 with an empty
body**, and a `TICKETS.map(t => (...))` is exactly that shape (`contact.astro:246-248`) · a comment
that closes early because the prose merely **quotes** its terminator (`contact.astro:250-253`:
*"the remaining sentences rendered as visible text on the page, under a build that was green on
typecheck, build and smoke"*) · Starlight's prose rhythm is a general-sibling rule that reaches every
child of every nested flex/grid box, so any new gap-spaced box needs its own `> * { margin-top: 0 }`
· a `focusout` guard eats a `<label>` click and a synthetic `.click()` will not reproduce it.

---

## 8. What is genuinely missing, ranked

1. **A ticket record type and its fixtures.** Nothing in `apps/support/src/data/` models a case.
   `FeatureRequest` shares slug/title/status/platform/author/raised and nothing past that.
   **Cost:** one `data/tickets.ts` in the same "the shape is the point" register as
   `requests.ts:1-15`, plus 6–10 fixtures covering empty / one / many / awaiting-you / closed /
   unverified-sender / dropped-attachment. Half a day. **Blocks everything below.**
2. **`pattern-message-thread` — no catalog entry, full undocumented reference implementation.**
   `RecordPanel.astro:907-953` is the anatomy; `pattern-schema-chat:5774` the register;
   `commentText.ts:44-71` the identity rule. **Cost:** ~80 lines of `storybook.ts` — props, a
   `guides` table separating conversation / stream / AI chat, `usageDo` ×8, `usageDont` ×5. **This
   is THE SEQUENCE step 2 and must land before any thread markup exists.** Half a day.
3. **The customer-facing status rulings table.** The words are bound (decision 3); what is missing
   is the enforceable entry — one row per state (token · what it means to the **customer** · what
   it means internally · tone · glyph), the total-registry fallback row, and a `usageDont`
   forbidding internal workflow words (`Triaged`, `Escalated`, `P2`) on a customer surface. Half a
   day, and it no longer waits on a decision.
4. **Article suggestions under the subject field.** Highest leverage, no auth, no storage, no
   data-model decision, and it *reduces* the volume the deferred surfaces must carry. **Cost:** a
   second call site plus one inverted predicate (§5.1) — then verified against a **build**, because
   Pagefind does not exist under `astro dev`. Hours, not days.
5. **A ticket-reference display + copy control in the portal.** `pattern-copy-id:2645` is the
   anatomy but it is an `apps/web` Tailwind/daisyUI recipe; `icons.ts` has neither `copy` nor
   `check` among its 43 names. **Cost:** two Lucide paths, one ~40-line component with the
   check-pop, one `.bo-copyid` family in `support.css` (**global**, so it survives `innerHTML`).
   Two hours.
6. **`pattern-file-attach`.** The implementation exists and is good (`submit.ts:78-98,442-565`) and
   carries five arguments worth preserving; nothing documents it, so the next surface reinvents it.
   The catalog already holds the **verdict** it must obey (chips in a panel, a count in a dense
   row). **Cost:** ~60 lines. Ranked below #5 only because a thread can render read-only chips from
   `.rp-cm-att*` without a new upload control.
7. **The email templates themselves** — acknowledgement, reply, and the neutral-subject rule. There
   is no template anywhere in this repo, and in an email-first product **this is the primary
   surface**, not an afterthought to the pages. **Cost:** copy, not code, but it is the copy the
   whole model rests on and it needs the same review as a screen.
8. **A reply composer.** Nothing exists, and `ChatDock`'s composer is bound to the AI budget
   machinery (`chat-core.ts:140-146`) and must not be reused. **Cost: zero for v1** — with no
   anonymous access, the anonymous reply path *is* the email, and the copy that says so is the whole
   deliverable. It becomes real work only when the auth bridge lands.
9. **DS coverage for `apps/support`** (§7). Extending `ds-lint.mjs:40-62` to a second root is a
   nearly-one-line change that would light up all 20 existing components at once. Out of scope for
   this surface; named so nobody reads green as checked.
10. **Two live defects, cleanup not blockers.** `support.css:287-340` is **duplicated verbatim** at
    `:393-446` — 73 lines including the comment block; the second copy is identical, later, same
    specificity, therefore dead. It survived because `css-guard` does not read this file. And
    `chat-core.ts:196` still tells visitors to *"open a ticket if you're signed in"*, pointing at a
    surface that does not exist.

---

## 9. Open questions for Dan — each with our default

1. **Do we verify the address before the case enters the queue?** Zendesk did exactly this in March
   2026 and named spam as the reason. **Default if unanswered: no.** The spec says create; we ship
   the neutral acknowledgement subject, the per-address daily cap, and form rate limiting instead
   (§3.2).
2. **Does a case carry a Space reference and a run reference?** **Default: yes — file both fields
   now, nullable.** Discovering it later is a migration plus re-asking every open case.
3. **May the acknowledgement echo the submitted body?** **Default: yes in the body, never in the
   subject.** The customer needs their own record; the subject is what a mail bomb weaponises.
4. **Can the backend run plus-addressed or catch-all inbound routing** (`support+<token>@…`)?
   **Default: assume yes.** If not, threading falls back to the bracketed ref in the subject, and we
   accept the wrong-thread failure mode Zendesk documents — say so in the spec rather than
   discovering it.
5. **Is there object storage for attachments, so outbound replies carry expiring signed links?**
   **Default: assume yes.** If not, there are **no outbound attachments at all** and the thread says
   so — outbound mail caps are 7–10 MB everywhere, and a byte we mail can never be revoked.
6. **Who closes a case, and does silence close one?** **Default: support closes; the customer may
   close their own; no timed auto-close in v1** — a timed close needs a warning email, which is a
   whole flow.
7. **When sign-in lands, do prior anonymous cases attach to the account?** **Default: yes, but only
   for a case whose submitter address was proven by an inbound reply from that address.** An
   unverified address follows nobody.
8. **`apps/support` or `apps/web`?** `proposal.md:28` still says ticketing cannot ship before
   graduation. **Default: build the views in `apps/support`** — the design system is now here
   (§1.1b) and the intake already shipped here, so the port is a port of views. Revisit only if
   graduation is scheduled before these surfaces are.

---

## Appendix — adjudication log

Where the sources disagreed, and the ruling.

| # | Disagreement | Ruled |
|---|---|---|
| 1 | A §3.5 specifies a six-digit-code anonymous session; B §2.6 says build no history page; bound decision 2 forbids both anonymous browse and the code screen | **B + the bound decision.** A's parameters survive only as the argument for *why a code beats a link* if anonymous viewing ever returns |
| 2 | C's "missing #4" says an email-keyed anonymous portal **reverses** `contact.astro:473-475`; bound decision 2 says there is no anonymous portal | **The ruling is confirmed, not reversed.** Nothing in that comment needs editing, and `My requests` earns no NAV slot until sign-in exists |
| 3 | B §2.6 "do not build `/my-requests`"; PLAN.md and bound decision 4 build it | **Build it, signed-in only.** B's argument was about an anonymous audience the gate removes. Its surviving half — signed-out must never be an empty list — becomes `pattern-locked-tab` rendered in place, diverging deliberately from the industry 302 |
| 4 | A §1.5: replying to a closed ticket mints a follow-up (Zendesk); `research-tickets.md` §2.5: replying reopens | **Reopen.** Zendesk's follow-up exists only because it has two closed-ish states and a 4-to-28-day timer between them; Baseout has one `Closed`, so the conflict does not arise. Linked-predecessor affordance filed as a condition on a future hard-close |
| 5 | A §3.5 + B §2.6 recommend provisional submission (verify before the ticket is real); the client's spec says submit → email → create | **The spec wins, the abuse defence moves** — neutral acknowledgement subject + per-address daily cap + rate limiting. Escalated as Dan Q1 with the cost of each direction named |
| 6 | B §3 addendum: "Baseout's five doors currently share a body field" | **Wrong, and corrected in §5.1 with the five labels, five helpers and their line numbers.** Baseout already varies both, and uses a persistent `<small>` rather than a placeholder, which is better — a placeholder vanishes exactly when the person starts typing |
| 7 | A §4.4: no peer warns about third-party data at attach time — "a gap, not a consensus" | **Upgraded: Baseout already does it in one door.** The billing door's "Never send a full card number" (`contact.astro:94-99`) is the precedent; the screenshot sentence is the same move on the ticket door |
| 8 | B §2.3 labels Zendesk's 30-day threading window unverified (search snippet); A §1.5 cites the fetched article | **A wins — verified.** It is the fact that forces a durable id independent of headers |
| 9 | A §2.5 wants **View original email** on every thread message | **Agent-side only.** Raw MIME retention becomes a storage requirement (§6 #8); the customer-facing half is the labelled collapse control |
| 10 | B §3: the "your turn" marker belongs on the row, not in a status column (Snowflake) | **Dissolved.** A card layout has no status column; the badge is carried once in the record rail |
| 11 | B §3 offers Snowflake's side-column deflection vs Teachable's inline strip | **Inline strip.** `/contact` is single-column with the docs sidebar suppressed (`support.css:355-372`); a right column would fight the portal's layout at every breakpoint |
| 12 | B §1.6 labels the escalate `Ask a person`; the sweep's alternatives are `Talk to a human` / `Talk to a support specialist` | **`Ask a person`.** Both alternatives imply a live queue that bound decision 1 forbids |
| 13 | `research-tickets.md` §2.2 recommends Zendesk's `Solved`; bound decision 3 says `Closed` | **`Closed`**, and the divergence is argued: a case the customer closed, or one closed after silence, was not necessarily solved |
| 14 | `research-tickets.md` §2.3 recommends Supabase's machine-context toggles; open question 4 left them undecided | **Closed for v1.** No session on `/contact` means no run to attach; the anonymous equivalent already ships as the door's helper text |
| 15 | `research-tickets.md` §7 "do not design tickets now" | **Expired on two of three legs** (§1.1). What replaces it: contract the session-gated surfaces, build the sessionless one |
