# Tickets — research

Surface: `support.baseout.com/tickets` — customer help-ticketing, gated on a real Baseout session.
Status of the surface today: **signed-out state only** (`apps/support/src/pages/tickets.astro`, 25 lines,
Starlight-styled, one bespoke `<style>` block).

This is the first research done for this change. It exists to answer three things before anyone draws a
screen: what a customer's ticket surface actually contains, which of the spec's three ticket decisions
survive contact with evidence, and whether the page is worth designing at all this week.

---

## 1. What I looked at

### Mobbin (`mcp__mobbin__*`, web platform)

Coverage of the **customer-facing** side is thinner than of the agent console — most "support" results are
inboxes for the person answering, not the person asking. Three queries, 24 screens, of which 8 are genuinely
customer-side. Named honestly: the agent-console screens (Featurebase, Hootsuite, ManyChat, Whop, Lindy,
Ferndesk) were **discarded**, not read as references.

| Screen | Why it matters |
| --- | --- |
| [Base44 — My Support Tickets (list)](https://mobbin.com/screens/20b9440b-cc9c-4c30-9500-9baa5facb0c8) | The closest whole-surface analogue: dev-tool audience, `Open (1) / Closed (1) / All (2)` tabs with counts, card rows, `New Ticket` primary + `Refresh`, per-row context chip (`App: 69b7aaba…`) |
| [Base44 — ticket thread (drawer)](https://mobbin.com/screens/395389df-bb57-46b6-bb2d-db2a19696b8e) | Thread opens **beside** the list, not on its own route. Header = subject + `×`; meta row = short id `#69ce8af8` · relative time · category chip · deep link to the object. `Close Ticket` is a **customer** action. Composer has a 500-char counter and an escalation link |
| [Supabase — support request form](https://mobbin.com/screens/8f63d469-dc92-4d20-a743-0edc3e80324f) | The best form in the set, and the nearest peer (infra tool, technical user). See §2.3 — attachments capped at 5, two consent toggles that attach machine context, and an explicit *"if this form fails, email us and include your project ID"* escape card |
| [Gusto — Track your support tickets (empty)](https://mobbin.com/screens/df196d83-cf1f-468e-8a66-c5d5b2a99ab5) | Best empty state: `Open / Closed` tabs, headset mark, *"You don't have any open support tickets at the moment"*, one `Contact us` button, and a footnote — *"It may take a few minutes for new tickets to appear"* — that pre-empts the "I just wrote in and it's not here" panic |
| [OKX — My tickets](https://mobbin.com/screens/5a9d498b-f262-4fa0-983f-9c0104af1ba1) | The table alternative to cards: `Created at · Last updated · Subject · Ticket ID`, **sorted by Last updated descending**, breadcrumb `Support center › My tickets` |
| [LangChain — Report a bug](https://mobbin.com/screens/667836b7-39e3-4762-9213-6ff1e5b0d74c) | `Product area` select + description + attachments with *"Screenshots and/or HAR files are often helpful"* |
| [Etsy — help request](https://mobbin.com/screens/b49d37b5-d908-42f2-868c-d6b02978fe20) | Intent-first triage: *"What do you need help with?"* radios, then *"How do you want this resolved?"* — routing before prose |
| [Zoho CRM — My Requests (empty)](https://mobbin.com/screens/a14bbeef-7c76-417b-a38a-deb5cde223f1) | Counter-example: an empty state that explains an internal permission model instead of offering an action |

### Web (customer-facing docs only)

- Zendesk — [What are the customer portal ticket statuses](https://support.zendesk.com/hc/en-us/articles/4408825864858-What-are-the-customer-portal-ticket-statuses) — **the single most load-bearing source in this file**
- Zendesk — [Submitting and tracking requests in the Customer Portal](https://support.zendesk.com/hc/en-us/articles/4408846805530-Submitting-and-tracking-requests-in-the-help-center-Customer-Portal)
- Zendesk — [The new request list experience](https://support.zendesk.com/hc/en-us/articles/4628113350170-Using-the-new-request-list-experience-in-the-help-center-customer-portal-Beta) + [GA announcement](https://support.zendesk.com/hc/en-us/articles/10262442568218-Announcing-general-availability-of-the-new-request-list-experience)
- Help Scout — [Set up and manage Customer Portal](https://docs.helpscout.com/article/1777-set-up-and-manage-customer-portal)
- Help Scout — [Beacon cross-device history security options](https://docs.helpscout.com/article/1229-support-history-security-options)
- Plain — [Changing thread status](https://www.plain.com/docs/graphql/threads/status-changes.md), [Thread fields](https://www.plain.com/docs/graphql/threads/thread-fields.md), [Autoresponders](https://www.plain.com/docs/graphql/threads/autoresponders.md) (Plain publishes **no** customer-portal UI docs — its customer surface is an in-app chat, not a portal; noted so nobody looks again)

### Repo

- `openspec/changes/support-portal/design.md`, `proposal.md`, `tasks.md`, `specs/support-portal/spec.md`
- `apps/support/src/pages/tickets.astro`, `apps/support/astro.config.mjs`, `apps/support/package.json`
- `apps/design/src/lib/storybook.ts` (6768 lines, 119 entries)
- `apps/web/src/components/layout/Inbox.astro` · `inbox.ts` · `inbox-client.ts`; catalog entry `pattern-inbox` (`storybook.ts:6662`)
- `apps/web/src/components/data/DataComments.astro` (1316 lines — the only two-party message feed in the tree)

---

## 2. Patterns, with sources

### 2.1 The list

**What every customer list shows.** Subject, a status, and a timestamp. Beyond that they diverge, and the
divergence is informative:

| Product | Columns / row content | Sort | Filters |
| --- | --- | --- | --- |
| Zendesk (new request list) | Subject · ID · Created · Updated · Status · Requester, columns user-configurable | Updated | Creation date, Updated date, Status, Requester |
| OKX | Created at · Last updated · Subject · Ticket ID | **Last updated, desc** | none |
| Base44 | subject (heading) · status badge · category chip · body preview · absolute + relative date · object chip | recency | tabs `Open / Closed / All` with counts |
| Gusto | (empty) | — | tabs `Open / Closed` |
| Help Scout portal | table of conversations, optionally company-wide | recency | none |

Three things are unanimous and should be treated as settled:

1. **Sort by last activity, never by creation.** OKX defaults its sort arrow to *Last updated*; Zendesk's
   redesigned list does the same. A customer opens this page to find the ticket that moved.
2. **Two-or-three tabs, not a facet bar.** `Open / Closed / All` (Base44), `Open / Closed` (Gusto). A
   customer has 1–5 tickets, not 300. A `FacetFilter` here would be furniture.
3. **Counts on the tabs.** Base44 and Gusto both carry them; it is how the customer learns there is nothing
   in Closed without clicking.

**Row must carry the object, not just the subject.** Base44 puts `App: 69b7aaba8224b2262c756071` on every
row; Supabase's form collects the project id; LangChain asks for a *Product area*. For Baseout the equivalent
is the **Space** (and, where the ticket came from a failure, the **run id**). This is the one row element that
is Baseout-specific rather than copied.

### 2.2 Status wording — the decision with the largest UX consequence

Zendesk publishes the mapping, and it is the reason the spec's `open|pending|closed` is a trap:

| Agent-side (internal) | Shown to the customer | What it means to the customer |
| --- | --- | --- |
| New, Open, On-hold | **Open** | "the support team is working to resolve the request" |
| **Pending** | **Awaiting your reply** | "the support team is waiting for a reply from an end-user" |
| Solved, Closed | **Solved** | "the request was resolved" |

Source: [Zendesk, customer portal ticket statuses](https://support.zendesk.com/hc/en-us/articles/4408825864858-What-are-the-customer-portal-ticket-statuses).

Read the second row carefully. `pending` internally means **the ball is in the customer's court** — and the
word "Pending" rendered literally to a customer says the *opposite*: it reads as "pending on our side, we're
getting to it". A customer who sees "Pending" does nothing and waits. A customer who sees "Awaiting your
reply" answers the question, and the ticket moves. Zendesk did not rename this for elegance; it renamed it
because the literal word inverted the meaning of the state.

Help Scout goes further and reduces the customer-visible vocabulary to two words: **New Response** and
**Closed** ([source](https://docs.helpscout.com/article/1777-set-up-and-manage-customer-portal)). That is a
different and defensible framing — it answers *"is there something here for me to read?"* rather than
*"where is this in your workflow?"*, which is arguably the only question a list-level status has to answer.

Plain, for contrast, keeps three statuses that are purely operator-facing — `Todo / Snoozed / Done`, where
*any* activity by either party returns the thread to `Todo`
([source](https://www.plain.com/docs/graphql/threads/status-changes.md)) — and never shows them to a
customer at all. Its customer surface is a chat, so the state is implicit in who spoke last.

**The lesson across all three: the storage enum and the rendered label are different things, and every mature
product separates them.** The spec's `open|pending|closed` is fine as storage. It must not reach a screen.

Recommended rendering, in Baseout's copy register (direct, second-person, no exclamation marks —
`specs/00-design-principles.md`):

| stored | badge label | badge variant |
| --- | --- | --- |
| `open` | `Open` | `default` (soft neutral) |
| `pending` | `Awaiting your reply` | `warning` — it is the only row with a task on it |
| `closed` | `Closed` | `default`, quieter |

`warning` on exactly one state is what makes the list scannable, and it is consistent with the Inbox's
"Needs attention above Activity" logic (`storybook.ts:6662`): the row that needs a human is the loud one.
Note `Badge / Status` has **no `info` variant** and that is a ruling, not an omission (`storybook.ts:707`),
so do not reach for a fourth colour.

### 2.3 The create form — and what it must not ask

**What the peers ask.** Zendesk: Subject (with **article suggestions appearing as you type**), Description,
Organization (only if you belong to several), Attachments (≤50 MB), CC. LangChain: Product area, Description,
Attachments. Supabase: subject, description, attachments (*"Optionally upload up to 5 relevant images or HAR
files"*), plus two consent toggles.

**Supabase's two toggles are the pattern worth stealing**, because they are the technical-tool answer to "we
can't reproduce it":

- *Include dashboard activity log — Share sanitized logs of recent dashboard actions to help reproduce the
  issue* · with a `Preview log` disclosure
- *Allow support access to your project* · marked **RECOMMENDED** · *Human support and AI diagnostic
  access* · with `More information`

Baseout's equivalents are exact: **attach the last backup run** (its id, status, and error code) and
**attach the Space's connection health**. Both are things Baseout already renders and can therefore honestly
offer. The `Preview log` disclosure is non-negotiable if a toggle is on by default — an attachment the
customer cannot inspect is not consent.

**What it must NOT ask.** Every one of these is either derivable from the session or a lie:

- **Email / name** — the session has them. Supabase instead *states* it: *"We will contact you at
  alexsmith…@gmail.com. Please ensure emails from supabase.com are allowed."* Print the address, don't ask
  for it, and take the deliverability warning with it.
- **Organization / Space** — derive it. Offer a picker **only** if the account has more than one Space, which
  is exactly Zendesk's rule ("if you belong to multiple organizations").
- **Priority / severity / urgency** — `design.md:33` already lists SLAs and priority as v1 non-goals. A
  priority field the support process does not honour trains customers to always pick High and then distrust
  the field. No peer in this set asks for one.
- **Category / product area** — Base44 shows a category (`Other`, `Billing`) so it clearly *has* one, and
  LangChain asks for it. But it only pays for itself if it routes something. With one support inbox at
  launch, it is a dropdown that changes nothing. **Defer.**
- **CSAT, "how did we do"** — a post-close concern, not a v1 field.

**Deflect before you accept.** Zendesk shows suggested articles as the subject is typed. Baseout has the
corpus for this already, sitting in the same app: `apps/support/astro.config.mjs` declares
`troubleshooting/backup-failed`, `troubleshooting/connection-needs-reconnecting`,
`troubleshooting/missing-bases`, `troubleshooting/what-baseout-cannot-capture` and a
`reference/statuses` page. Starlight ships Pagefind. The four most common tickets a backup tool receives are
already written down, one client-side index away from the composer. **This is the highest-leverage thing on
the whole ticket surface, and it costs no auth bridge.**

**Give the form a failure escape.** Supabase's card — *"Having trouble submitting the form? Please email us
directly. Include your project ID and as much information as possible."* with copy-buttons on both the email
and the project id — is the pattern for "the surface for reporting that things are broken is itself a thing
that can break". `Copyable id` already exists in the catalog (`storybook.ts:2647`).

### 2.4 The thread

- **Distinguish sender by label + alignment + a quiet plate, not avatars.** Base44: customer right-aligned on
  a darker fill, support left-aligned on a light one, timestamps under each. Baseout's own catalog already
  ruled this exact question for `pattern-schema-chat` (`storybook.ts:5776`): *"user vs assistant by label +
  subtle background + alignment, no avatars/bubbles-decoration"*, and *"anchor the reply on a QUIET plate
  (weaker fill than the user bubble, no border)"*. **That ruling transfers verbatim.** Support has no avatar
  to show anyway, exactly as Airtable ships no profile picture — the reason `DataComments` uses initials
  chips.
- **A named human, or nothing.** `DataComments` was made to render *"Author not captured"* in muted italic
  rather than invent *"Airtable user"* (`storybook.ts:4870`), because a generic label in the same weight as a
  real name asserts a person. Same rule here: if the reply carries an agent name, show it; if it does not,
  the label is `Baseout Support`, not a fabricated person.
- **Where the thread lives.** Base44 opens it **beside** the list in a drawer; Zendesk and OKX give it a
  route. For Baseout, a route (`/tickets/:id`) is the right call: it is linkable from an email notification
  (`tasks.md:19` puts ticket email in the paired change), survives a cold load, and does not import the
  panel-stack machinery — and the panel-stack law (*one stack · one entity · one drawer*) is an `apps/web`
  law about a page that already has a stack. `/tickets` has none.
- **Metadata row.** Short copyable id, created, last activity, Space. Base44's `#69ce8af8` is the model — a
  customer quoting a ticket id in a chat or email is the cheapest cross-referencing there is.
- **Expectation-setting is a first-class element, and the honest version is not a number.** Nobody in this
  set promises a duration in the UI except by inference (Etsy's *"Typically responds within a few hours"* is
  seller-level). Two things carry the weight instead: Gusto's *"It may take a few minutes for new tickets to
  appear"* (a freshness caveat that prevents a support ticket about the support ticket), and the
  `Awaiting your reply` state, which is the real "who owes whom" signal. **Do not print an SLA the business
  has not agreed to** — `design.md:33` makes SLAs a non-goal, so a "we reply within 24h" line in the UI would
  be UI inventing a commitment.
- **Attachments** — Supabase caps at 5 and names the types; Base44 puts a `+` in the composer; Zendesk allows
  50 MB and shows attachments in the thread. On the row: no filenames. The changelog family already settled
  this from competitor evidence (Mobbin: Notion · Circle · Twist · Mercury · Twenty · ClickUp) —
  *"nobody puts filenames in a dense row; the most Mercury and ClickUp do is a COUNT"*, so the listing gets a
  **paperclip + count** with the names in the tooltip, and the detail surface gets **file chips** (type glyph
  + filename + size on one line) — `storybook.ts:4870`. Reuse that verdict rather than re-deciding it.

### 2.5 Closed, and reopening

Three distinct models, and the difference matters:

- **Zendesk**: the customer can *"withdraw a request by marking it as solved"*, and a solved request cannot
  truly be reopened — the customer *"click[s] the link to create a follow-up request"*, which **mints a new
  ticket** ([source](https://support.zendesk.com/hc/en-us/articles/4408846805530-Submitting-and-tracking-requests-in-the-help-center-Customer-Portal)).
- **Help Scout**: replying reopens, unless the conversation is *locked*, in which case *"the reply box is
  replaced with a New Conversation button"* ([source](https://docs.helpscout.com/article/1777-set-up-and-manage-customer-portal)).
- **Plain**: any activity from either side flips `Done` → `Todo`; reopening is not a concept
  ([source](https://www.plain.com/docs/graphql/threads/status-changes.md)).
- **Base44**: `Close Ticket` is a button the **customer** presses, in the thread header.

**Recommendation: Plain/Help Scout's model.** A closed ticket keeps its composer; sending a reply reopens it
(`closed` → `open`) and says so inline. It is one state transition instead of a second entity, it needs no
"follow-up ticket" concept in the data model (`design.md:18` has no parent/child field and should not grow
one), and it matches how the customer already thinks — they are continuing a conversation, not filing a
sequel. Give the customer a `Close ticket` action too (Base44) — a customer who solved it themselves should
be able to say so without writing "nvm, fixed it".

### 2.6 Empty state

Gusto is the reference: mark, one factual sentence, **one action**, and a freshness footnote. Note it is a
*per-tab* empty state — "no **open** tickets" is a different sentence from "you have never written in", and
the first-ever-visit version should point at the docs and chat, which are free and already shipped. The
catalog's `Empty state` entry (`storybook.ts:4255`) governs.

Zoho is the anti-pattern to avoid ([screen](https://mobbin.com/screens/a14bbeef-7c76-417b-a38a-deb5cde223f1)):
*"You have not been added as a requester for any team module"* — an empty state that explains an internal
permission model and offers no action.

### 2.7 The signed-out state — the only part shipping now

This is what I was asked to study specifically, so it gets its own treatment.

**What the peers do.** Nothing in the set designs this page, and that is itself the finding. Help Scout's
portal puts a **magic-link sign-in** in front of the list — email, then a *"single-use, six-digit code valid
for five minutes"*, no password
([source](https://docs.helpscout.com/article/1777-set-up-and-manage-customer-portal)). Zendesk's docs decline
to describe an unauthenticated visitor at all. Help Scout's Beacon takes the third route: with Basic
security, history is scoped to the browser session/device and there is no sign-in
([source](https://docs.helpscout.com/article/1229-support-history-security-options)). Base44 and Gusto reach
their ticket lists from *inside* the signed-in product, so the state never occurs.

**The pattern that does exist, and it is not "sign in" — it is "you can get help right now".** Every one of
these products offers a logged-out visitor a route that does not require an account: the docs, and a chat or
an email address. Baseout has both shipped (`/chat`, the whole docs tree). The current page has this the
right way round in structure but the wrong way round in emphasis: `tickets.astro:12` makes
*"Sign in to Baseout"* the primary button, and pushes *"No account yet? The support chat and docs are open to
everyone"* into a `0.85rem`, `opacity: 0.75` afterthought at `tickets.astro:17`.

For a visitor who cannot sign in — which, before launch, is **every** visitor — the useful action is the
demoted one.

**Its catalog answer already exists.** `pattern-locked-tab` — *Locked capability state (in place)*
(`storybook.ts:4836`) — is this page's shape exactly: a `lucide--lock` mark (*"calm, not alarming — a lock,
not a warning triangle"*), the feature's name, **one line on what it does**, **one line on why it is
locked** (*"a capability reason, not a bare upgrade"*), and the affordance. The only adaptation is that the
reason is "tickets are tied to your account" instead of "needs a dynamic backup". No new entry required for
the state that is shipping.

---

## 3. Against the spec — agreements, contradictions, silences

| Pattern | Spec position | Verdict |
| --- | --- | --- |
| Auth = verified app session, server-side, never client-asserted | `design.md:16`, `spec.md:23` | **Required.** Correct and unambiguous |
| Signed-out only until the bridge lands; no fake creation | `design.md:17`, `tasks.md:8`, `tasks.md:19`, `spec.md:23`, `spec.md:27-28` | **Required.** Correct — see §5, I would go further |
| Storage enum `open \| pending \| closed` | `design.md:18` | **Contradicted as UI.** Fine as storage; `pending` must render as *Awaiting your reply* (§2.2). The spec conflates the two |
| `list / create / thread only` | `design.md:18` | **Under-specified, not wrong** (§4.1) — but it silently omits the reply composer, which is not "thread view", it is a fourth verb |
| Sort by last activity | silent | **Unmentioned.** Add it — it is the list's single most consequential default (§2.1) |
| Object context on the row (Space, run id) | silent | **Unmentioned.** `design.md:18` gives the ticket `org/user refs` but **no Space or run reference**. This is the one data-model gap in the spec, and it must be fixed in the paired monorepo change or the field will not exist to render |
| Attach machine context (last run, connection health) with a preview | silent | **Unmentioned.** Needs a data-model field too. Flag now for the same reason |
| Attachments on a message | silent | **Unmentioned.** `design.md:18` says "messages thread" with no attachment concept. Storage + size cap belong to the paired change |
| Article suggestions in the create form (deflection) | silent | **Unmentioned, and buildable today** — Pagefind and the troubleshooting pages already exist (§2.3) |
| Reopen a closed ticket by replying | silent | **Unmentioned.** Recommend the transition, not a follow-up entity (§2.5) |
| Customer can close their own ticket | silent | **Unmentioned.** Cheap, and Base44 + Zendesk both offer it |
| Priority / severity | `design.md:33` — non-goal | **Contradicted, and rightly.** Do not add the field |
| Email notification on reply | `design.md:33`, `tasks.md:19` — deferred to the paired change | **Agreed.** Consequence: until it lands the portal is the *only* place a reply appears, which raises the cost of a bad list (§5) |
| "Custom pages keep Starlight's header/theme; **no second design system**" | `design.md:5` | **Directly contradicted by Oleh's ruling of 2026-08-17** ("built from Baseout's own elements and styles; Starlight's look is not acceptable as-is"). `design.md:5` is now stale and must be amended in the same pass that touches these pages. It is not a tickets-only problem — it governs `/chat` and `/roadmap` equally, and it is the real blocker (§4.2) |
| Graduation to the monorepo, ticketing "cannot ship before then" | `proposal.md:28` | **Agreed** — and it strengthens the case for deferring the design (§5) |

---

## 4. Two structural problems

### 4.1 `list / create / thread` is nearly enough — but name the fourth verb

Tested against every screen in §1, `list / create / thread` covers the surface with **one omission and two
sub-states the phrase hides**:

- **Reply.** A thread the customer cannot answer is a receipt. Every peer has a composer in the thread; Help
  Scout treats the *removal* of the composer as the exceptional case. Call it four verbs:
  **list / create / thread / reply**.
- **Close / reopen** are state transitions on `reply`, not verbs of their own (§2.5) — but they must be
  written down, because "thread view" reads as read-only and someone will build it that way.
- **Deflect** is not a ticket verb at all, and it can ship without the auth bridge. Keep it out of the
  ticket contract and put it in the create form's spec.

So: the phrase is defensible, and I would rewrite `design.md:18` as
`list / create / thread + reply, with close and reopen as transitions on the thread`.

### 4.2 `apps/support` has no design system, and that is the actual blocker

Measured: `apps/support/package.json` has exactly three runtime-relevant deps — `astro`, `@astrojs/starlight`,
`wrangler`. **No Tailwind, no daisyUI, no `@opensided/theme`, no CSS file anywhere under `apps/support`**
(`find apps/support -name '*.css'` → nothing). `apps/web` needs `tailwindcss@^4.2.2`, `@tailwindcss/vite`,
`daisyui@^5.5.19`, `@iconify/tailwind4` and the vendored `@opensided/theme`, plus
`apps/web/src/styles/global.css` (3,306 lines) and `styles/themes/`. All three custom pages are styled by
hand today (`roadmap.astro` 91 lines, `chat.astro` 81, `tickets.astro` 25 — each with its own `<style>`
block and its own hard-coded `#2563eb` accent).

Consequences that must be named before anyone opens a page:

1. **Oleh's ruling cannot be satisfied per-page.** "Built from Baseout's own elements" means the token +
   Tailwind + daisyUI layer lands in `apps/support` **once**, as its own task, before any of the three pages
   is redrawn. Doing it inside a tickets change would smuggle a platform change into a screen change.
2. **`apps/support` is in no gate** — `pnpm ds-lint` and `pnpm ds-audit` read `apps/web` only, `pnpm smoke`
   derives its routes from `apps/design/src/pages/**`, `css-guard` parses `apps/web/src` only. So the moment
   the catalog exists over there, **nothing enforces it**. Extending `ds-lint`'s scope to `apps/support` is
   part of the port, not a follow-up — otherwise the portal drifts from day one, and the census will find it
   in three months.
3. **Or: don't port — graduate.** `proposal.md:28` already expects `apps/support` to migrate into the
   monorepo `apps/*` and says *"ticketing in particular cannot ship before then"*. If tickets are going to
   live next to `apps/web` anyway, building them in `apps/support` means building them twice. This is a real
   fork and it is Oleh's to call (§7 Q1).

---

## 5. The Inbox question, argued

**Should tickets live in the Inbox's language, reuse it, or stay separate?**

The adjacency is real. `pattern-inbox` (`storybook.ts:6662`) is a two-lane list of rows that each carry an
icon chip, a bolded entity, terse copy, a right-aligned stamp, and sometimes one inline action — which is,
structurally, a ticket list row. And its state model is unusually well-argued: `read` ≠ `done` ≠ `resolved` ≠
`snoozed`, with the explicit note that *"keeping read separate from done is what lets an inbox behave as a
task list rather than a feed"*.

**Verdict: separate surfaces, borrow the vocabulary, share no code.** Three reasons, in order of weight.

1. **Direction of ownership.** The Inbox's own routing guide is mechanical: *"Inbox · Needs attention"* is for
   *"backup failed · connection needs reconnect · breaking schema change"* — things **the system** did that
   **the user** must now act on. A ticket is the mirror image: something **the user** started that **Baseout**
   must act on. The two lanes are defined by who owes whom, and tickets invert it. Filing tickets into
   *Needs attention* would put "we owe you an answer" in the lane that means "you owe the system a fix"; the
   guide's own test would reject it.
2. **The Inbox is account-scoped and lives in `apps/web`; tickets are a different origin.** `pattern-inbox`
   opens from the sidebar item above the Space groups and overlays the work area with measured geometry
   (256 + 352 = 608px of chrome; a pushing panel hid 339px of the Backups table at 1280). None of that
   travels to `support.baseout.com`, which has no sidebar, no panel host, and no Space context. And the
   catalog explicitly forecloses the shape someone will reach for: *"Don't add an expand-to-two-pane reading
   view or a separate /inbox page. Both were built and cut."* A ticket list with a thread pane is precisely
   the two-pane reading view that was cut — because there, the deep-link target was the detail view. Here
   there is no other detail view, so the two-pane is legitimate, which proves the two surfaces are governed
   by different reasoning and should not share a component.
3. **What *should* cross the boundary is one row.** When the paired change lands ticket email
   (`tasks.md:19`), *"Support replied to your ticket"* is exactly an Inbox **Activity** row: FYI,
   deep-linked, never rolled up (a reply is not a success), and it self-resolves when read. That is a
   one-line addition to `KIND_META` in `inbox.ts` and it is the right amount of coupling. It belongs in the
   paired monorepo change, not here.

**Borrow, explicitly:** the read/done split (a read reply is not a closed ticket — this is the same insight as
*"a read 'reconnect!' is still broken"*), the "one action only where the user can resolve it from here" rule,
and the ban on minting a row when something recovers. **Do not borrow:** the two-lane split (tickets have one
lane), the roll-up (never roll up a customer's own tickets), or the component.

---

## 6. Catalog gap

`storybook.ts` has **119 entries** and covers most of this surface. Feature → entry, honestly mapped:

| Element | Catalog entry | Verdict |
| --- | --- | --- |
| Page frame | `Page header` (`:3371`), `Breadcrumbs` (`:1687`) | covered |
| Ticket list | `Table` (`:1550`) — `growth: 'paged'` only past `PAGER_ROWS = 25`; a customer list is `fixed` | covered |
| Row → thread | `Clickable row (chevron + hover actions)` (`:2859`) | covered |
| `Open / Closed / All` with counts | `Segmented control` (`:3541`) or `Section tabs` (`:2005`) | covered |
| Status label | `Badge / Status` (`:701`) — soft + semantic, no `info` | covered; **the customer-facing wording is the gap**, see below |
| Timestamps | `Time` (`:4203`) — `fmtTime` / `fmtDayLong`, nothing formats a date itself | covered |
| Ticket id | `Copyable id` (`:2647`) | covered |
| Space reference on a row | `Entity chip` (`:664`) | covered |
| Empty state | `Empty state` (`:4255`) | covered |
| Signed-out / gated state | `Locked capability state (in place)` (`:4836`) | covered — see §2.7 |
| Create form fields | `Input` (`:882`), `Textarea` (`:960`, `helper` + `maxLength`), `Select` (`:1024`) | covered |
| Consent toggles (attach run / health) | `Checkbox & Toggle` (`:1079`) — has `description` | covered |
| Submit failure | `Form-level failure region` (`:3323`) | covered |
| Freshness / deliverability note | `Alert` (`:1752`) — `severity` + `trigger: 'static'` required | covered |
| **Message thread (two humans)** | nearest = `Schema chat` (`:5776`) | **GAP** |
| **Reply composer** | nearest = `Schema chat`'s composer | **GAP** (folded into the above) |
| **Attachment upload field + file chip row** | `Media thumbnail` (`:4974`) / `Media gallery` (`:5022`) are the **retrieval** contract for backed-up Airtable files | **GAP** — there is no upload control anywhere in the catalog |
| **Status-over-time timeline** | `Changelog timeline` (`:4867`), `Record history` (`:4739`), `Status rail` (`:2582`), `Steps` (`:1879`) | **not needed** — see below |

### Entries that would have to be added

1. **`pattern-message-thread`** — a two-party conversation with a composer. Sender by **label + alignment +
   quiet plate, no avatars** (inherited from `pattern-schema-chat`), a named agent or `Baseout Support` and
   never an invented person (inherited from the `DataComments` "Author not captured" ruling), per-message
   timestamp, attachment chips, and the composer's states (empty / sending / failed / **closed-thread reopen
   notice**). This is the one genuinely new pattern, and it is worth noting the tree already has an
   uncatalogued precedent: `apps/web/src/components/data/DataComments.astro` is 1,316 lines of two-party
   message feed with **no `storybook.ts` entry of its own** — it is described only as a row body inside
   `pattern-changelog-timeline` (`:4870`). Whoever writes this entry should read that file first.
2. **`pattern-file-attach`** — the upload field (drop zone + `click to browse`, a stated cap and accepted
   types per Supabase's "up to 5 images or HAR files") and the **file chip** row (type glyph + filename +
   size on one line). The chip half is already *decided* — `:4870` settled it from competitor evidence and it
   ships in `RecordPanel` — it has simply never been lifted into its own entry. The upload half is new to the
   product, and it will be needed again the moment anything else accepts a file.
3. **A `guides` table for customer-facing status wording.** Not a component — a rulings table, of the kind
   `pattern-inbox` carries for "which surface does a signal go to". Three rows: stored value → rendered label
   → why. It is where §2.2 stops being a research note and becomes enforceable. Sensible home: inside
   `pattern-message-thread`, or an `Alert`-style addition to `Badge / Status`.

**No status-over-time timeline is needed, and asking for one is the trap.** Four existing entries are shaped
like a timeline and every one has the wrong semantics: `Changelog timeline` and `Record history` are
data-diff feeds; `Status rail`, `Backup pipeline` and `Steps` model a process with known stages. A ticket has
no stages — it has a conversation, and the conversation *is* the history. Base44, Zendesk and Help Scout all
show status as one badge plus the message list; not one of them draws a status timeline. Building one would
be inventing a component to render a fact the messages already carry.

---

## 7. Recommendation on sequencing

**Do not design the tickets surface now. Do three smaller things instead.**

The reasoning, plainly:

- The page that can ship is a page with **no ticket UI on it** (`spec.md:23`, `design.md:17`). Designing
  list / create / thread now produces artefacts that cannot be rendered, cannot be Playwright-verified,
  cannot be reviewed against a real state, and will be re-decided when the paired change fixes the data model
  — which it must, because the spec is currently missing the Space reference, the run reference, and any
  attachment concept (§3).
- The design system it would be built from **does not exist in `apps/support`** (§4.2), and it is not
  tickets' job to bring it there.
- `proposal.md:28` says ticketing *"cannot ship before"* the graduation to the monorepo. Designing against
  `apps/support` may be designing against the wrong app (§7 Q1).

**What to do instead, in order:**

1. **Fix the signed-out page's emphasis — small, and it ships.** Today `tickets.astro:12` makes
   *Sign in to Baseout* primary and demotes the docs + chat routes to a `0.85rem / opacity 0.75` line
   (`tickets.astro:17`). Before launch, **every** visitor is one who cannot sign in. Recompose it on
   `pattern-locked-tab`: lock mark, *"Tickets are tied to your Baseout account"*, one line on why (we need
   your Spaces and run history to help), then **two peer routes** — *Ask support chat* and *Search the docs*
   — with sign-in as the tertiary. That is a copy-and-hierarchy change to one 25-line file, and it is the
   whole honest scope of the surface today.
2. **Build the deflection, not the ticket.** Article suggestions from the subject field (§2.3) are the
   highest-value ticket feature in this document and the only one that needs no auth bridge, no storage, and
   no data-model decision. The corpus, the four troubleshooting pages, the status reference and Pagefind all
   already exist in this app. It also *reduces* the ticket volume the deferred surface will have to carry.
3. **Amend the spec while the reasoning is fresh** — five edits, no code: strike "no second design system"
   at `design.md:5` (superseded 2026-08-17); add the customer-facing status mapping to `design.md:18` and
   keep the enum as storage; add Space ref + run ref + attachments to the ticket model at `design.md:18` so
   the paired change carries them; rewrite the verb list as list/create/thread/reply with close+reopen as
   transitions; add "sort by last activity" as a stated default.

Then, when the auth bridge is a real thing and the DS is present in whichever app owns the page, do the
design in one pass with the two catalog entries written first, per THE SEQUENCE.

**What I am arguing against:** a full ticket design produced this week. It would be a good document about a
page nobody can load, and its most likely fate is to be re-litigated after the paired change reshapes the
data model. I would rather hand over three shipped improvements and an amended spec.

---

## 8. Open questions for Oleh

1. **`apps/support` or `apps/web`?** `proposal.md:28` says ticketing cannot ship before graduating to the
   monorepo, and `apps/support` has no design system. Do we (a) port Tailwind + daisyUI + `@opensided/theme`
   + the token layer into `apps/support` and extend `ds-lint`/`smoke` to cover it, or (b) accept that
   `/tickets` is the first page to graduate, and design it as an `apps/web` view served under the support
   domain? This changes which repo the work lands in and is the only question blocking everything else.
2. **Status wording — three labels or two?** Zendesk's `Open / Awaiting your reply / Solved` (workflow
   position) or Help Scout's `New Response / Closed` (is there something for me to read)? I recommend
   Zendesk's three because `Awaiting your reply` is the one label that makes a customer act, but Help Scout's
   two are the smaller vocabulary and Baseout's copy register prefers fewer words. Both are defensible; they
   produce different lists.
3. **Does the ticket carry a Space?** `design.md:18` gives the ticket `org/user refs` and nothing else. Every
   peer in §2.1 puts the object on the row. Confirming this now is what lets the paired monorepo change ship
   the field; discovering it later means a migration.
4. **Are the machine-context toggles acceptable?** Supabase's *"Allow support access to your project"* is
   marked RECOMMENDED and is a genuine trust decision, not a UI flourish — Baseout's version would attach
   the last run's error and the connection health. Worth deciding as a product stance before it is a
   checkbox, and it interacts with `research/access-scope` (the catalog's
   *Access scope — what Baseout can and cannot do*, `storybook.ts:6161`) which currently states what Baseout
   *cannot* do.
