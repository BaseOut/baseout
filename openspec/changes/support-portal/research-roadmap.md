# Research — ROADMAP (public roadmap with per-feature voting)

Surface: `apps/support/src/pages/roadmap.astro` → `support.baseout.com/roadmap`.
Spec under test: `openspec/changes/support-portal/design.md` §"Roadmap + voting" (lines 20–25).
Status before this file: **no research had ever been done for this change.** This is the first.

Two standing constraints frame everything below.

1. **Oleh, 2026-08-17** — the portal must be built from Baseout's own elements and styles.
   Starlight's look is not acceptable as-is.
2. **`apps/support` has no design system and is in no gate.** Measured, not assumed:
   `/usr/bin/grep -ran "tailwind|@web/|opensided|daisyui" apps/support/` → **zero hits**
   (excluding `node_modules`). `apps/support/package.json` deps are `@astrojs/starlight` +
   `astro` only. `apps/support/astro.config.mjs` declares **no `@web/*` alias**, no vite
   aliasing, no Tailwind integration. `ds-lint` / `ds-audit` / `css-guard` / `smoke` all scope
   to `apps/web/src` (`CLAUDE.md` "Design-system discipline"), so **nothing on this page is
   checked by anything.**

---

## 1 · What I looked at

**Mobbin (`mcp__mobbin__search_screens`, web platform, two queries).** Coverage for genuinely
*public* roadmap portals is **thin, and I am saying so rather than padding it.** Two queries
("public product roadmap page with feature cards grouped by status column and upvote button",
"feature request board list with upvote count per request and submit idea button") returned 14
distinct screens, of which **only Featurebase is a public-facing portal.** Everything else is an
*internal* PM/kanban tool — the search matched the column shape, not the audience:

- [Featurebase — public roadmap board](https://mobbin.com/screens/6d7dadc1-bb7e-450c-8417-fc1d3957c168) ← the one on-target reference
- [Featurebase — public feedback/voting board](https://mobbin.com/screens/929b32f4-745c-4b09-99c7-96193e6555d5) ← the second half of the same product, and the most useful single finding
- [Productboard — roadmap columns](https://mobbin.com/screens/3816d5c9-420c-407b-a39f-5bdbbc2ebd17) · [Productboard — feature board with user-impact score](https://mobbin.com/screens/d892adaa-8f7a-499a-9c40-4a5c0ed29adf) (internal)
- [Plane](https://mobbin.com/screens/69990ffa-9153-4bf1-bb53-87317f9e040f) · [GitLab issue boards](https://mobbin.com/screens/b4dea897-559e-4cd4-8ca4-f3f63aaaa9c0) · [GitHub Projects roadmap view](https://mobbin.com/screens/42d39e62-e7bc-4240-afa0-f3577a0468a3) · [Trello](https://mobbin.com/screens/4c8ce179-fef2-4827-b8c7-6c5c7bdcba1d) · [Basecamp Card Table](https://mobbin.com/screens/4cec00d4-6951-4527-ae44-443dacb67df3) · [Slack Lists](https://mobbin.com/screens/fd9a81ad-6a72-4916-8eed-5092bd02ad17) · [Dovetail](https://mobbin.com/screens/f3888b80-d858-417f-bdea-f37c53e044de) · [ClickUp](https://mobbin.com/screens/bb527cbb-7b61-4c99-8535-1ddb82157a83) (all internal)

**Web.**

- [Featurebase — 15 public roadmap examples](https://www.featurebase.app/blog/public-roadmap-examples) (vendor, but the only source with a *layout × columns × voting × submission × dates* matrix over 15 named real portals)
- [Canny — public product roadmap examples](https://canny.io/blog/public-product-roadmap/) (vendor)
- [Sleekplan — roadmap use case](https://sleekplan.com/use-cases/roadmap-tool/) (vendor; the only one that states its anonymous-voting position outright)
- [ProductLift — best public roadmap tools](https://www.productlift.dev/best-public-roadmap-tool/) and [best feature-voting tools](https://www.productlift.dev/best-feature-voting-tool/) (vendor; source of the login-vs-participation claim)
- [github/roadmap](https://github.com/github/roadmap) — a real read-only public roadmap with an explicit non-commitment disclaimer
- [Linear changelog](https://linear.app/changelog) — a real shipped-only surface with **no roadmap and no voting at all**
- [Features.Vote — Now / Next / Later](https://features.vote/now-next-later-roadmap) — the argument against date-shaped and commitment-shaped column names
- [Jason Evanish — Why feature voting creates poor products](https://jasonevanish.com/2021/04/23/why-feature-voting-creates-poor-products-and-what-to-do-instead/) — the strongest published critique; the only non-vendor voice on voting
- [ProdPad — feature voting](https://www.prodpad.com/glossary/feature-voting/) · [Canny — feature voting best practices](https://canny.io/blog/feature-voting-best-practices/) (vendor counterpoint)

**Cal.com** was on the brief. `https://cal.com/roadmap` **308-redirects to
`github.com/calcom/cal.com/milestones`** — i.e. Cal.com's public roadmap *is* GitHub milestones:
a list of named milestones with an open/closed issue count and a percent-complete bar, no votes,
no submission surface of its own. That is a data point, not a miss. **Raycast** has no public
voting roadmap either — it ships `raycast.com/changelog` (dated, shipped-only) and routes wants
into GitHub/Slack. Both belong in §4's argument.

---

## 2 · Patterns extracted, with sources

### P1 · Three columns vs a list vs a timeline — and when each wins

The Featurebase pair is the finding that matters. **The same vendor ships both shapes, for two
different jobs:**

- its **roadmap** is columns (`Backlog · Next up · In Progress · Done`, each header carrying an
  item count) — job: *"what is the shape of the pipeline"*
  ([screen](https://mobbin.com/screens/6d7dadc1-bb7e-450c-8417-fc1d3957c168))
- its **feedback/voting board** is a **flat list** (status badge above title, author + relative
  time, body snippet, chevron+count hard right, `New / Top / Trending` sort tabs, search, filter,
  and a `Create A New Post` primary) — job: *"is my thing here, and can I back it"*
  ([screen](https://mobbin.com/screens/929b32f4-745c-4b09-99c7-96193e6555d5))

**Voting lives on the list. The columns are the status view.** Our spec (design.md:22) fuses the
two into one three-column board and puts the vote button on the cards.

Across the 15 named portals in the Featurebase matrix: Kanban dominates for tools whose roadmap
*is* the feedback board (Featurebase, Buffer, Trello, Ahrefs, CoffeeCup, Rolla); **filtered lists**
are what large vendors use (Atlassian Cloud, Microsoft 365 — both `Status`-filtered lists, both
vote-less); **quarter columns** are GitHub's; **release timelines** are Rust's. Linear uses none of
them — reverse-chronological dated entries, no status labels, no votes.

**The test, stated so it can be applied:** columns earn their keep when each column holds enough
items that the *distribution* is the information (≈5+ per column), and when the reader's job is
to read the pipeline. A list wins when *n* is small and the reader's job is to find one item.
**Our fixture is 3 / 2 / 2** (`roadmap.astro:5-28`). At that size three columns are mostly
whitespace, and at 390 they stack into a list anyway (`roadmap.astro:59-60`) — so the list is the
shape the page already becomes at the width where most people will read it.

### P2 · What the vote control actually is

Every voting portal in the sample uses the **same physical control: a small vertical stack of a
chevron/caret over a number**, right-aligned in the card or row — *not* a labelled button, *not*
the word "Vote". Featurebase does it on both its board and its roadmap cards. Productboard's
internal equivalent is a numeric "user impact score" column, not an arrow.

Consequences worth naming: the control is a **toggle**, not a fire-once action — the voted state
is painted (accent fill/border) and clicking again withdraws. Our skeleton is a labelled
`▲ 42` button with a **one-way, irreversible** localStorage latch (`roadmap.astro:79-90`:
`if (localStorage.getItem(key)) return;`). A misclick is permanent, with no affordance saying so.

`+1 / me too` (as distinct from an arrow) appears in the sample only as GitHub-issue 👍 reactions —
which is how Cal.com and Raycast actually collect demand.

### P3 · Whether a vote requires identity, and what identity buys

- **Requires an account:** Canny, Productboard, Aha!, UserVoice.
- **Configurable, anonymous allowed:** Sleekplan ("Anonymous, registered, or SSO: your choice"),
  ProductLift, Upvoty (behind a paid tier).
- **Vendor claim, flagged as vendor claim:** anonymous voting draws "50–70% more participation."
  Neither ProductLift nor anyone else publishes the method behind that number. Treat it as
  marketing, not as evidence.

What identity buys, and this is the part the participation number hides:

1. **A dedupe that actually holds.** One vote per account is enforceable. Cookie+IP is not — see §4.
2. **Weighting.** Every serious source says raw counts mislead because a vote from a free user and
   a vote from a paying ops team are counted the same (ProductLift; ProdPad; Canny's own best-
   practices post recommends segmenting by tier).
3. **A return channel.** This is the one nobody lists and it is decisive for us. Sleekplan's
   status-change model is *"every subscriber gets an email and an in-app notification"*; Canny's is
   *"as soon as the status changes, everyone who interacted with it gets notified automatically."*
   **Both require knowing who voted.** An anonymous vote is structurally a dead end: you click,
   and nothing ever comes back to you. The loop that makes a roadmap feel honest cannot close.

### P4 · How requests are submitted — or deliberately are not

Two coherent postures, and both are defensible:

- **Portal-with-submission** (Featurebase, Canny, Sleekplan, Buffer, Trello, Ahrefs, Loom): a
  primary `Create a new post` / `Submit idea`, plus AI duplicate detection shown *before* posting
  (Featurebase, Canny, ProductLift) because the submission surface's real cost is duplicates.
- **Read-only roadmap, feedback routed elsewhere** (GitHub, Atlassian, Microsoft 365, Unity, Rust,
  Cal.com, Raycast, Linear): the roadmap makes no promises *and* accepts no input; wants go to
  discussions/issues/support. GitHub locks conversations on roadmap items on purpose.

There is no third posture in the sample. **A board that shows a vote button but has nowhere to
type is not one of the two** — it is the only combination nobody ships, because it invites
participation and then refuses the participation people actually have (a sentence, not a click).
Evanish, on exactly this: *"The number of upvotes does not mean every upvote wants the same
thing."*

### P5 · How a status change gets back to the person who voted

Sleekplan and Canny: email + in-app to everyone who interacted; Sleekplan additionally
**auto-publishes to the changelog on `Released`**. GitHub: nothing — items move and you re-read
the board. Linear: the changelog *is* the notification.

The spec has no mechanism here at all, and cannot have one while votes are anonymous (P3.3).

### P6 · Comments, and what they cost

Present in every submission-bearing portal (Featurebase shows a comment-count glyph on cards).
Absent from every read-only one. Cost is not the UI — it is **moderation of an unauthenticated
public write surface on `support.baseout.com`, forever**, plus the expectation that someone
replies. Anonymous comments on a portal with no admin surface (design.md:24) is an unmoderatable
spam target. This is the one non-goal in the spec I fully endorse.

### P7 · Sorting and filtering

Featurebase roadmap: search · `Filters` · **`Top upvoted` sort select**, plus a count in each
column header. Featurebase board: `New / Top / Trending` tabs. Atlassian and Microsoft: filtered
lists as the whole interaction. Our page has none of these — no sort, no filter, no count.

Note the trap: **a `Top upvoted` sort makes the vote count load-bearing for ordering**, which
means the count has to be trustworthy before the sort can exist.

### P8 · Shipped → changelog

Sleekplan auto-publishes on Released. Linear's changelog *is* the shipped surface: dated entries,
narrative + screenshots, `Fixes` / `Improvements` / `API` subsections, no version numbers, no
status chips. Rust groups by release. **A shipped card whose only content is the same one-liner it
carried while planned is the weakest cell in a three-column board** — it has stopped being
information and become a trophy. Every strong example links Shipped out to a dated release note.

### P9 · The two named failure modes, and what the field does about them

**Stale roadmap.** *"A public roadmap full of items that never ship erodes trust faster than
having no roadmap at all."* Devices in use: item **counts per column** so a bloated Later is
visible; a **cap on the Now column** (Now/Next/Later prescribes 3–5, explicitly *"you can't hide
behind a 50-item backlog"*); **monthly cadence commitments** (SE Ranking); and a **last-updated
stamp** — the cheapest and the one our page lacks entirely.

**A vote count becoming a promise.** Devices: never sorting the roadmap by votes by default; a
**hidden count** (CoffeeCup ships votes with counts hidden); **weighted/impact scores instead of
raw counts** (Productboard's user-impact score); and an explicit non-commitment disclaimer.
GitHub's, verbatim: *"The forward-looking product roadmap does not represent a commitment,
guarantee, obligation or promise to deliver any product or feature, or to deliver any product and
feature by any particular date… customers should not rely on this roadmap to make any purchasing
decision."*

---

## 3 · Against the spec — agreements, contradictions, silences

| # | Pattern (from §2) | Spec position | Verdict |
|---|---|---|---|
| 1 | Columns = the status view, list = the voting surface (P1) | one three-column board carries both — `design.md:22` | **Contradicted.** No sampled portal fuses them. |
| 2 | Column header carries an item count (P1, P9) | silent | **Unmentioned.** Cheap; it is the anti-bloat device. |
| 3 | Vote = chevron+count, toggleable (P2) | "vote count, vote button" — `design.md:22` | **Partially required.** "Button" ≠ the shape everyone ships; reversibility is silent. `roadmap.astro:79-90` is irreversible. |
| 4 | Anonymous voting allowed | required, with dedupe conceded as best-effort — `design.md:23` | **Required, and it is the decision I most want to reopen.** See §4. |
| 5 | Identity buys dedupe + weighting + a return channel (P3) | deferred to "later via the same auth bridge as tickets" — `design.md:25` | **Contradicted in sequencing.** Tickets already *hard-require* the bridge (`design.md:16-17`); votes take the same bridge but ship before it. |
| 6 | A submission surface, or a deliberate absence (P4) | absent, and not named as a decision anywhere | **Silent — the largest gap.** Voting without submission is the one posture nobody ships. |
| 7 | Duplicate detection before posting (P4) | n/a (no submission) | Unmentioned. Moot unless #6 changes. |
| 8 | Status change notified back to the voter (P5) | silent | **Silent, and blocked by #4.** Anonymous ⇒ no channel exists. |
| 9 | No comments | non-goal, implicitly — `design.md:33` names only an admin UI; comments are absent | **Agreed.** Endorse and make it explicit. |
| 10 | Shipped links to a dated release note (P8) | silent; shipped cards just lose their button — `design.md:22` | **Silent.** And there is no changelog page in the portal IA (`astro.config.mjs` sidebar: no changelog entry). |
| 11 | Sort / filter (P7) | silent | **Unmentioned.** Fine to defer at n=7 — but say so. |
| 12 | A non-commitment disclaimer (P9) | silent | **Silent.** GitHub, Atlassian and Microsoft all carry one. |
| 13 | A last-updated stamp (P9) | silent | **Silent.** The cheapest anti-stale device on the list. |
| 14 | A way to say **no** to an item | silent — the three statuses have no terminal-decline state | **Silent, and it is a trust hole.** Canny has `Closed`; without it, items silently vanish, which is exactly how a roadmap loses credibility. |
| 15 | No admin UI; content-managed via seed/D1 | `design.md:24` | **Agreed** — see §4. |
| 16 | Built from Baseout's own elements | `design.md:5` says the opposite: *"Custom pages keep Starlight's header/theme; no second design system."* | **Directly contradicted by Oleh's 2026-08-17 ruling.** `design.md:5` is now stale and must be rewritten as part of this change. |

### The six decisions, tested

**(a) Three fixed columns → CHALLENGE.** Ship a **single list grouped by status**, or keep three
columns and cap `Shipped` to the most recent N with a link out. Reasons, in order of weight:
(1) at 3/2/2 items the columns carry no distribution to read; (2) `Shipped` is **unbounded** — it
grows forever and will eventually be the whole board, and it is the changelog's job, not a peer
column's; (3) columns are a Kanban affordance that promises left-to-right movement through a
WIP-bounded process we do not run; (4) at 390 the board *is* a grouped list already
(`roadmap.astro:59-60`), so the list is the honest primitive and the columns are the special case;
(5) **decisive for the DS**: a grouped list resolves entirely onto documented catalog entries
(§5), while peer columns do not exist in the catalog at all and would need a new entry for a
layout whose value we cannot yet demonstrate.

**(b) Anonymous voting → CHALLENGE, hard.** The brief's own question is the right one, and the
answer is: **an anonymous vote count should not be shown.** `voter_hash = HMAC(cookie id + IP)`
(`design.md:23`) fails in *both* directions, and the direction that matters most for Baseout is
the under-count. A clearable cookie plus a rotating mobile/CGNAT address lets one person vote
repeatedly (over-count). But an Airtable ops team behind one office NAT — **exactly the buyer this
product is built for** (`CLAUDE.md`: "the user is a technical ops / power-user") — resolves to one
`voter_hash` and casts **one** vote between them. So the number systematically under-counts the
accounts with the most revenue behind them, on top of the generic problem that a raw count is
unweighted (§P3.2) and context-free. Three alternatives, ranked:

1. **Collect the vote, do not publish the count.** The button becomes a state, not a scoreboard:
   `Vote` → `Voted` (or better, `I want this`). D1 keeps the number; the team reads it; the page
   never asserts it. Removes the trust dependency entirely, keeps the signal, and CoffeeCup
   already ships this. **This is my recommendation for v1.**
2. **Require identity, then show the count.** Vote only when signed in to Baseout, via the bridge
   `design.md:16-17` already makes a hard requirement for tickets. Real dedupe, per-account
   attribution (which `design.md:25` wants anyway), and a return channel for §P5. Cost: signed-out
   visitors cannot vote, and until the bridge lands the surface has no voting at all.
   **This is the target state**, and it makes the vote count publishable.
3. **Replace the click with a sentence.** One `Textarea` — *"what would you want us to build?"* —
   which the catalog already documents as a pattern (`storybook.ts:6255`). For a 7-item roadmap in
   a utility admin tool, a typed sentence is worth more than a click, and it is the one thing
   Evanish's critique does not undercut.

Whatever else is decided: **`roadmap.astro:33` must not ship.** *"Voting goes live shortly —
counts below are illustrative until then"* publishes invented numbers (42, 38, 55, 61, 29, 88, 47)
on a trust surface. That is the single worst line on this page. Print no number until a real one
exists.

**(c) No submission surface → CHALLENGE.** Pick a posture (§P4) and say which. Cheapest coherent
v1: read-only board + the one-textarea ask from `pattern-upcoming-section` — a form that collects
prose without creating a public write surface to moderate.

**(d) No admin UI → AGREE.** At ~7 features edited a few times a quarter, a migration/seed edit is
correct and an admin CRUD screen is waste. But name the operational cost in the spec: **every
status change is a deploy**, so the last-updated stamp (§3 #13) is derivable from the seed and
free.

**(e) No comments → AGREE.** §P6. Make it an explicit non-goal in `design.md:33` rather than an
omission, with the moderation reason stated.

**(f) Shipped cards don't vote → AGREE, but incomplete.** Right decision, wrong empty half: a
shipped card should *gain* something (a dated release-note link, §P8), not merely lose its button.
`roadmap.astro:48` currently substitutes the literal string `Shipped ✓` — which restates the
column heading it already sits under, and does it with a Unicode dingbat.

---

## 4 · The trust question the spec does not address

A public roadmap is a promise surface, and `design.md` treats it as a data-display problem.
Three things follow.

**1 · "Planned" is the only column name that makes a promise.** "In progress" is a fact.
"Shipped" is a fact in the past tense. **"Planned" asserts that a decision has been taken and the
thing will happen** — and it is the column that will hold items longest, so it is the one that
rots. That is precisely the failure Now/Next/Later was invented to avoid: it *"separates priority
communication from date commitments."* Now/Next/Later itself is wrong for us — it is PM jargon and
Baseout's copy voice is direct and concrete (`specs/00-design-principles.md:141`) — but its
diagnosis holds. Two replacements worth Oleh's eye, both keeping "Shipped":

- `Considering · Building · Shipped` — plainest, most second-person, states confidence not schedule
- `Exploring · In progress · Shipped` — smallest edit from what exists

**2 · The house catalog has already ruled on over-promising, and this page breaks it.**
`pattern-upcoming-section` (`storybook.ts:6239-6307`) is the existing Baseout answer to "a thing
that isn't built yet," and it is explicit:

- `storybook.ts:6263` — *"Don't print a date, a countdown, or 'launching soon'. A date we miss
  costs more than the anticipation it buys."*
- `storybook.ts:6245` — *"Four to six is the right number: three reads as an afterthought,
  **ten reads as a roadmap we are committing to**."* The catalog treats *length itself* as a
  promise. A board that grows to 30 planned items has made 30 promises.
- `storybook.ts:6248` — *"Say what it will cost, not just what it will do… that is the difference
  between an announcement and a promise."*
- `storybook.ts:6246,6260-6261` — no hero band, no illustration, no gradient, **no email capture**;
  *"the user is inside a utility tool, not on a landing page."*

That last one is a real tension to resolve, not a rule to copy: `pattern-upcoming-section` bans
email capture because it addresses a *signed-in customer*. A public roadmap addresses an
*anonymous visitor*, and an email is the only return channel available to them (§P5). Either
identity comes from the auth bridge (option (b)2) or the loop stays open. **Do not resolve it by
adding an email field to an anonymous vote** — that is a waitlist, and it is what the entry bans
in spirit.

**3 · Copy audit of what is on the page today, against
`specs/00-design-principles.md:139-152`.**

| Line | Text | Verdict |
|---|---|---|
| `roadmap.astro:31` | *"What's coming to Baseout — vote on what matters to you."* | Passes. Direct, second-person, no schedule claim. |
| `roadmap.astro:32` | *"Vote for the features you want most. **Votes directly shape what we build next.**"* | **Fails `:144`** ("descriptive of state, not promotional"). "Directly shape" is a governance promise the product cannot keep — no serious team ships by vote rank (§P3.2), and `design.md` describes no mechanism by which votes bind anything. Replace with what is true: *"Voting tells us what to weigh. It doesn't set the order on its own."* |
| `roadmap.astro:33` | *"Voting goes live shortly — counts below are illustrative until then."* | **Fails twice.** "Shortly" is the "launching soon" the catalog bans (`storybook.ts:6263`), and the sentence admits the numbers above it are fabricated while displaying them. Delete the numbers, not the disclaimer. |
| `roadmap.astro:48` | `Shipped ✓` | Redundant under a `Shipped` heading; the `✓` is a dingbat where the DS mandates Lucide. |
| — | no non-commitment line anywhere | **Missing** (§P9). One quiet sentence, in Baseout's voice rather than GitHub's legalese: *"This is what we're working on, not a delivery schedule. Items move, and some don't ship."* |
| — | no last-updated stamp | **Missing** (§P9). And per `pattern-time` / D01 (`storybook.ts:4201`), print no stamp over nothing — derive it from the seed. |

No exclamation marks anywhere on the page. That much is clean.

**4 · One more precedent worth putting in front of Oleh.** `specs/07-integrations.md:216-219`
originally proposed exactly this feature: *"Either lean into them as a tease ('**vote for what we
build next**') or shrink them so they don't compete visually with the Airtable card."* The recorded
ruling was **remove the coming-soon cards** (`decision-remove-coming-soon-cards` — Airtable-only
for now). The house has already declined a vote-on-the-future affordance once, inside the product.
That does not settle the portal case — a public roadmap has a different audience and a real job —
but it means "shrink the promise" is the direction Oleh has previously chosen, and a maximal
board is the direction he previously rejected.

---

## 5 · Catalog gap, and what is reusable first

Read: `apps/design/src/lib/storybook.ts` (6768 lines, 116 entries — full id list enumerated via
`/usr/bin/grep -an "^    id: '"`).

**There is no entry for a vote control, no entry for a peer-column / kanban layout, and no entry
for a status-over-time chip.** A "feature card" needs no new entry — `card` covers it. Confirmed by
enumeration, not by keyword luck: `/usr/bin/grep -ani "vote|kanban"` over the catalog → zero hits.

### Reusable today — before anything new is proposed

| Need | Entry | Line | Note |
|---|---|---|---|
| Page title + one-line description | `pattern-page-header` | 3369 | Description left, at most **one** primary, short button hard right. |
| The feature card shell | `card` | 1320 | `variant: 'default'` = border-first, no shadow. `hover` only if the card is clickable. |
| Status label per feature | `badge` | 699 | **Soft + semantic, leading dot when standalone.** Mapping is already documented: `In progress` → `primary` (line 720 names "Running (primary)"); `Shipped` → `success`; `Considering`/`Planned` → **`default`/`tertiary`**, the documented idle register for states carrying "neither alarm nor achievement" (line 725). **Do not reach for a fourth colour** — `badge` has no `info` variant, and line 707 records that as a *ruling*, not an omission. |
| The vote **count**, if a count is shown at all | `badge` solid | 739 | *"Reach for a solid fill only for numeric counts"* — the catalog already assigns numeric counts to a solid badge. |
| The vote **button** | `button` | 484 | `btn-sm` (the default; the md carve-out is one page-header CTA per surface). `secondary` = soft, per `decision-button-system`. Voted state must not invent a third look — cf. line 551 on `aria-disabled`. |
| The non-commitment line, and the "voting isn't live" notice | `alert` | 1750 | Soft alert with a leading icon; `severity` required, `trigger: 'static'` → `role="note"`. `storybook.ts` overview: *"any user hint is a soft alert with a leading icon, not a bare tinted line"* — which is what `roadmap.astro:33` currently is. |
| A column/group with nothing in it | `pattern-empty-state` | 4253 | Condition 2 (a live section, one empty group) — 48px `base-200` tile, title, one mechanism sentence ≤46ch, `btn-sm` exit only if one exists. Replaces Featurebase's illustration. |
| "Show N more" in a long group | `pattern-node-showmore` | 3469 | Chunked reveal. **Not** `TablePager` — a roadmap group is not a paged table. |
| Sort / filter, if added | `pattern-faceted-filter` · `pattern-toolbar` | 3991 · 5920 | `decision-filter-controls-toggles`: facets are **multi-select toggles, never radios**. A single-choice sort (`Top voted` / `Newest`) is `pattern-segmented-control` (3539) or `select`. |
| Board ↔ list view switch, if both ship | `pattern-segmented-control` | 3539 | One documented way to show which is chosen. |
| Group headings at narrow widths | `pattern-mobile-group` · `pattern-responsive` · `pattern-breakpoints` | 3873 · 3673 · 3636 | The 390 stack is a grouped list — already governed. |
| The "what would you want" ask | `textarea` + `pattern-upcoming-section` | 958 · 6239 | The whole ask/submitted-state pair is written out at `storybook.ts:6290-6305`. One textarea, one button, a persisting submitted state, **no email field**. |
| Shipped → release note | `pattern-changelog-timeline` | 4865 | The house grouped-timeline pattern, if a changelog page is added. |
| Icon-only affordance hints | `tooltip` | 810 | daisyUI `tooltip` / `data-tip`, never native `title=`. |

### Genuine gaps

- **GAP-1 · Vote control.** Composable from `button` + solid `badge`, but the semantics are
  undocumented: one-per-visitor, a **voted/withdraw** state, and the not-yet-live state. **If a
  count is shown, this needs a `storybook.ts` entry before any code** (THE SEQUENCE step 2). If §4(b)1
  is adopted and no count is published, the control collapses to a documented `button` with a
  toggled label and **GAP-1 closes without a new entry.** That is a second reason to prefer it.
- **GAP-2 · Peer-column board.** Nothing in the catalog lays out equal-width peer columns of cards.
  **Choosing the grouped list (§4a) closes this gap outright** — grouped list = `card` + `badge` +
  `pattern-empty-state` + `pattern-mobile-group`, all documented. Choosing columns means a new
  entry for a layout we cannot yet justify at n=7. This is the cleanest DS argument in the file.
- **GAP-3 · Status-over-time chip.** Absent, and **not needed** — v1 has no transition history and
  `badge` states the current status. Recorded so it is not re-discovered as a gap later.
- **GAP-4 · The infrastructural one, and the real blocker.** Oleh's 2026-08-17 ruling cannot be
  satisfied at all until `apps/support` can *reach* Baseout's elements. Today it has no Tailwind,
  no daisyUI, no `@opensided/theme`, no `@web/*` alias (measured, §preamble). Every entry above is
  an `apps/web` Astro component or a class family defined in `apps/web/src/styles`. **That wiring
  is a decision `design.md` does not contain, it flatly contradicts `design.md:5`, and it is
  bigger than the roadmap page** — it governs Chat and Tickets identically. Raise it before any
  roadmap markup is written; building the page twice is the alternative.

---

## 6 · Open questions for Oleh

Only forks where the two answers produce different UI.

1. **List or columns?** My recommendation: grouped list (§4a), which also closes GAP-2.
   Counter-case: if the roadmap is expected to hold 20+ items within a quarter, columns start
   paying for themselves.
2. **Publish the vote count, or collect it silently?** My recommendation: collect silently now,
   publish only once identity is real (§4b). This changes what the button says and whether GAP-1
   needs a catalog entry.
3. **Do votes wait for the auth bridge?** Tickets already do (`design.md:16-17`). If votes wait
   too, v1 roadmap is read-only + one textarea, and the whole D1 `votes` table (`design.md:23`)
   defers with it.
4. **Column names.** Keep `Planned / In progress / Shipped`, or move to
   `Considering / Building / Shipped`? Only "Planned" is at issue (§4.1).
5. **Is there a terminal "we're not doing this" state?** Without one, items vanish silently
   (§3 #14). Adding it means a fourth status in the D1 seed.
6. **Does the portal get a changelog page?** Required if a shipped card is to link anywhere
   (§P8). Not in the sidebar IA today.
7. **How does `apps/support` reach the design system** (GAP-4), and who rewrites `design.md:5`?
   Nothing about the visual result of this change is decidable before this one is.

---

## 7 · Suggested step order (for whoever implements, once §6 is answered)

1. **Resolve GAP-4 first** — Tailwind + daisyUI + `@opensided/theme` + a `@web/*` alias in
   `apps/support/astro.config.mjs`, and bring `apps/support/src` into the `ds-lint` / `css-guard`
   scope. Without this, step 3 cannot be built from the catalog and nothing checks it.
2. **Amend `design.md`**: rewrite `:5` against Oleh's ruling; record the §6 answers at `:20-25`;
   move comments and (if chosen) submission into the `:33` non-goals with their reasons.
3. **Rebuild `apps/support/src/pages/roadmap.astro`** from the §5 table. Delete the fabricated
   counts (`:9-25`), the promise copy (`:32`), the "shortly" notice (`:33`), the `✓` dingbat
   (`:48`), the raw hex fallbacks (`:63,69,72`), and the irreversible localStorage latch
   (`:79-90`). Add the non-commitment line and the last-updated stamp.
4. **States to cover, and to verify in a browser at 1440 and at a real 390** (`emulate`, not
   `resize_page`): every group populated · one group empty · a group over the show-more threshold ·
   voting-not-yet-live · voted · vote-failed · a shipped item with a release link and one without.
5. **Gates**: `pnpm typecheck` must be green. `ds-lint` / `css-guard` are only meaningful over this
   file *after* step 1 — until then, a green run over `apps/support` proves **nothing**, and
   `CLAUDE.md`'s warning applies literally: read the inspected-file count, not the tick.

---

*Read-only research. No file under `apps/` was modified. No gate was run (four agents concurrent).
Vendor-marketing claims are labelled as such where they could not be independently corroborated —
notably the "50–70% more participation" figure for anonymous voting, which has no published method
behind it and should not be treated as evidence.*
