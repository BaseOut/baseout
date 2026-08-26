# Research — the support home below the hero (2026-08-19)

**Status: research only. Nothing is built. Oleh decides the shape before any code.**

Oleh, 2026-08-19: _"the start screen is just blocks of text thrown together — we do not onboard
the user through it at all, and there is no way to see the roadmap or report a problem from it.
The hero stays. The body should read like a landing page: something useful offered, not a wall of
text and links."_ He named three references — Vercel (typed cards, split by kind), Retool (category
LABELS beside cards: BUILD / AUTOMATE / GOVERN), and Retool again for **What's new + Latest
releases** on the home. His own bridge: _"we have no changelog, but we could use roadmap tiles."_

Dan has now said the portal is bland **three times** ("pretty generic, pretty bland" → "hard to
engage with, text heavy, maybe the font"). Two visual iterations did not move him. This document
exists so the third attempt is not blind.

---

## 1 · What the page is today — measured, not remembered

Measured in Chrome at 1440px against the dev server on :4342, 2026-08-19.

|                                                       |                                                                         |
| ----------------------------------------------------- | ----------------------------------------------------------------------- |
| Hero band (`.sh`)                                     | **421px**, starting under a 64px header                                 |
| Body (`.sl-landing`) starts at                        | **533px** — on a 900px screen the reader sees the eyebrow and one group |
| Body height                                           | **1538px**                                                              |
| Full page                                             | **2287px** (~2.5 screens at 900px)                                      |
| Links inside the body                                 | **25** (22 doc links + 3 "Still stuck?" cards)                          |
| Words on the whole page                               | **344**                                                                 |
| Product screenshots, illustrations or video in `main` | **0**                                                                   |
| Vector marks in `main`                                | 6 — all three of them are the "Still stuck?" card icons                 |
| Body type                                             | 16px / 28px                                                             |

The body is six topic groups (`Start here · Backing up · Restoring · Sources and destinations ·
Your schema and data · When something is wrong`), each a label + hairline + a three-column grid of
`link + one-line blurb`, then a three-card "Still stuck?" row (Ask the assistant · Report a problem
· Roadmap).

**So the diagnosis "blocks of text thrown together" is literally correct**: after the hero, the
page is 25 blue links and 22 grey sentences, 0 images, one visual device (a hairline) repeated six
times. Nothing on it is larger than a line of text.

## 2 · The constraint no amount of styling can cover

`grep -rl "Not written yet" src/content/docs` → **25 of 38 pages**.

Of the **22 doc links on the home page, 16 land on a page whose last section says "Not written
yet."** Broken down by the group as it renders today:

| Group on the home        | links | land on a written page            |
| ------------------------ | ----- | --------------------------------- |
| Start here               | 4     | **0**                             |
| Backing up               | 5     | 5                                 |
| Restoring                | 2     | 0                                 |
| Sources and destinations | 3     | 0                                 |
| Your schema and data     | 4     | 0                                 |
| When something is wrong  | 4     | 1 (`what-baseout-cannot-capture`) |

The **first group on the page — the one Oleh asked to lead with, the one a new user is aimed at —
is four dead ends in a row.** `Backing up` (5 real pages, ~3,900 words) is the only section that
pays out, and it is the second group.

This reframes Dan's complaint. "Text heavy and hard to engage with" is what a directory feels like
when six sevenths of its destinations are a summary and a list of questions the page _will_ answer.
No card grid, icon set or font fixes that. **Any option below has to state which links it exposes
and whether those pages are written.**

Two more supply facts the design has to respect:

- **There is no changelog.** Deferred; Oleh is asking Dan.
- **The roadmap has 9 fixture items**: 3 Planned, 2 In progress, 2 Shipped, 1 Already exists,
  1 Not planned. The two Shipped carry `shipped: 'Jun 2026'` and `'Jul 2026'` — **two and three
  months old**. `VOTES_LIVE` is still `false`, so counts are not rendered.

## 3 · The reference sweep

Fetched and read on 2026-08-19. Ordered by how close each is to our problem.

### 3.1 Retool — Oleh's reference (docs.retool.com)

Home body, in order: **What's new** (dated list, 5 rows — Aug 18, Aug 17, Aug 17, Aug 13, Aug 5,
i.e. all inside two weeks) **beside Latest releases** (3 version cards: `4.0.10-stable`, released
date) → **Explore the platform**: a category LABEL as a filled chip (`BUILD`, `AUTOMATE`, `GOVERN`)
with one sentence beside it, then **2 cards per label**, each card = icon + title + one line, one
carrying a `NEW` badge.

What actually does the work there: the label chip is a _typed_ heading — it says what the two cards
below have in common as a **verb**, and it costs one line of height. The What's new column is
credible because the newest row is **yesterday**.

### 3.2 Vercel — Oleh's reference (vercel.com/docs)

Body = **8 verb-headed sections** (`Build with AI`, `Build your applications`, `Use Vercel's AI
infrastructure`, `Secure your applications`, `Collaborate with your team`, `Deploy and scale`,
`Guides and tutorials`), each a 3-column grid of bordered cards: **outline icon top-left, title,
2-line blurb**. No images, no dates, no badges. It is our page's information exactly — a directory
of links — but every destination is a _card with an icon_ under a _sentence-shaped heading_, and
the headings are verbs, not nouns.

**This is the cheapest structural upgrade available to us**, and it is worth naming why it works:
a bordered card with an icon gives the eye a target that is not a word. Our page has 25 targets and
all of them are words.

### 3.3 Stripe — the shape our page was copied from (docs.stripe.com)

Body: a **"Start here"** block first (three columns of task links: _Accept payments online · Sell
subscriptions · Set up your development environment_), then **Browse by product** — noun groups
(`Payments`, `Revenue`, `Platforms and marketplaces`, `Money management`, `Prebuilt components`),
each a plain link list, no icons, no blurbs.

Note what we copied and what we dropped: Stripe leads with **tasks**, and only then lists products.
We kept the product directory and put a _product_ group ("Start here" = four pages about what
Baseout is) in the task slot.

### 3.4 Supabase (supabase.com/docs)

Body: **Connect a framework** (17 logo cards) → **Build your backend** (5 icon cards with 2-line
blurbs) → **Extend your database** (6 links) → **Use a client library** (6) → **Migrate to
Supabase** (11 logo cards) → **Explore more** (7) → **Self-host** (4). Density is the point: the
top block is one click from "I have a project" to "code that runs".

### 3.5 Airtable Support — our users' other help centre (support.airtable.com)

**Hero graphic → 17 category cards, each showing an ARTICLE COUNT ("Airtable Automations · 47
articles") → Popular articles: 5 links with arrows → contact support in the top nav.** No what's
new, no images inside cards.

The article count is the interesting device: it is an honesty signal that also sets expectation. It
would read very badly for us right now (`Restoring · 2 articles`), which is itself a finding.

### 3.6 Notion Help (notion.com/help)

Hero search + 4 popular-topic chips → **Popular topics: 6 cards, each with a THUMBNAIL IMAGE** →
Browse by team (6 links) → Notion Academy (one illustrated feature block with a button) → **What's
new: 2 items, full-width thumbnails** → three contact blocks (support · hire an expert · webinars).

This is the most "landing page" of the help centres, and the difference is entirely **pictures**.
Six thumbnails and two wide images across a page that otherwise holds the same links we hold.

### 3.7 Linear docs (linear.app/docs)

**Popular: 4 cards. Linear Basics: 8 links with one-line descriptors. Nothing else.** No icons, no
images, no changelog. Linear puts its changelog on a separate, heavily illustrated page
(`linear.app/changelog`: reverse-chronological, **every entry carries a screenshot or a video**,
grouped into Fixes / Improvements / API, filter tabs across the top).

Worth holding as the counter-example: a docs home _can_ be 12 links and read as confident — but
Linear's twelve all pay out, and the visual weight lives one click away on the changelog.

### 3.8 Mintlify (mintlify.com/docs) — the tool Dan compares us to

Hero + **4 cards in a 2×2 grid, each carrying its own image (light and dark variants), hover-scale**
→ a 3-link "related" list. That is the whole home. Four choices, four pictures.

### 3.9 Visual references pulled from Mobbin

- [OpenAI Platform docs home](https://mobbin.com/screens/1b39571a-c929-4ba6-934c-9786fc50681d) —
  **"Start building": a 2-column grid of icon + verb-phrase rows** with a one-line blurb, then a
  quiet 4-up footer row (Help center · Developer forum · Cookbook · Status) as icon + label +
  caption. This is the _dense, utility-tool_ reading of Vercel's card idea — no borders, just an
  icon column. Closest thing in the sweep to Baseout's own density target.
- [Amazon help](https://mobbin.com/screens/29ee3038-b4ed-4679-b1b8-8effef391215) — left rail of
  topics + **verb-led task cards** ("Track your package", "Check status of a refund").
- [Navan help centre](https://mobbin.com/screens/94d03315-33e4-40c2-8e4e-27d2d8852e32) — category
  cards with **full-bleed photography**; the opposite pole from us, and wrong for an admin tool,
  but it shows how much of "engaging" is just image area.
- [Base44 Help & Support](https://mobbin.com/screens/ca48e5b6-af35-4479-b931-1b498fac9f73) — three
  coloured destination cards (Documentation · Community · Open a ticket) then a "Quick actions" row
  — the same three-card idea as our "Still stuck?", given the top of the page instead of the foot.
- [Webflow updates](https://mobbin.com/screens/e3459bdb-c87e-4603-97d4-15b5865629ca) — dated update
  rows with a **type badge** (`Feature` / `Light feature`) and relative dates ("6 days ago").
- [Visual Electric what's new](https://mobbin.com/screens/d9619b46-9e89-4981-bef1-ad85c5074d79) —
  date, title, paragraph, **screenshot per entry**.

### 3.10 What the help-centre literature says (userpilot, 13 help centre examples, 2026)

Search first · **featured/popular articles** second · **verb-led categories, not internal jargon**
("Report an issue", "Connect an integration") · the path to a human stays **visible but quiet** ·
never end a page in a dead end.

Our category names are already verb-led (`Backing up`, `Restoring`, `When something is wrong`) —
that part of the IA survived the 08-19 rebuild and should not be re-litigated.

## 4 · The patterns worth stealing, and what each costs us

| #   | Pattern                                          | Who                                                 | What it needs from us                                                        | Verdict                                                           |
| --- | ------------------------------------------------ | --------------------------------------------------- | ---------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| P1  | **Verb label + sentence, then 2–3 cards**        | Retool, Vercel                                      | Nothing new — our sections are already verbs                                 | **Take.** Cheapest structural change with the biggest read        |
| P2  | **Icon per destination**                         | Vercel, Supabase, OpenAI                            | One Lucide glyph per section (we own `entityIcon` conventions in `apps/web`) | **Take.** Gives the eye a non-word target                         |
| P3  | **A task path before the directory**             | Stripe "Start here", Supabase "Connect a framework" | The 3–4 pages it points at must be WRITTEN                                   | **Take, conditionally** — see §2                                  |
| P4  | **Thumbnails / product screenshots**             | Notion, Mintlify, Linear changelog                  | Real screenshots of the product (we can capture from the preview app)        | **Take — this is the untested hypothesis for "bland"**            |
| P5  | **What's new, dated**                            | Retool, Notion, Webflow                             | Fresh entries. Ours would be Jun/Jul 2026                                    | **Do not take as "What's new"** — see §5                          |
| P6  | **Roadmap tiles on the home**                    | Oleh's own bridge; Canny/Productboard portals       | The board exists; 9 items; votes not live                                    | **Take, renamed** — "From the roadmap"                            |
| P7  | **Article counts per category**                  | Airtable Support                                    | Honest counts                                                                | **Reject for now** — `Restoring · 2 articles` advertises the hole |
| P8  | **Popular articles list**                        | Airtable, Notion, Figma                             | Knowing what is actually read — we have no analytics                         | **Defer.** The hero's five questions already do a version of this |
| P9  | **Destination cards near the TOP, not the foot** | Base44, Teachable                                   | Nothing                                                                      | **Consider** — our three ways out sit at 1900px                   |

## 5 · The one place Oleh's own bridge needs an edit

Oleh: _"we have no changelog, but we could theoretically use some roadmap tiles."_ Right instinct,
wrong label. Retool's What's new works because the top row is **yesterday**. Our Shipped items are
**Jun 2026 and Jul 2026**. A block titled _What's new_ whose newest row is two months old does not
read as new — it reads as abandoned, which is the exact impression a support portal for a _backup
product_ can least afford.

Fix: title the strip after the board, not after time — **"From the roadmap"** — and show a MIX
(what is in progress · what shipped · one route to add your own). Progress and intent do not go
stale on a monthly clock the way a changelog does. If Dan later gives us a real changelog, the
strip splits in two, exactly as Retool's does.

## 6 · Three composed options for the body

All three keep the hero unchanged (Oleh: _"the hero is okay, we keep it"_).

### Option A — "Jobs, labelled" (Vercel/Retool, minimum change)

```
BROWSE THE DOCS
[BACK UP]      Get your Airtable data out, on a schedule.
  ▸ 3 cards, icon + title + one line
[GET IT BACK]  Put it back when something goes wrong.
  ▸ 2 cards
[LOOK INSIDE]  Read what a backup captured.
  ▸ 3 cards
[WHEN IT BREAKS] The four things that actually go wrong.
  ▸ 4 cards
STILL STUCK?  (unchanged 3 cards)
```

Same links, same order, +icons, +label chips, +card borders. **Cost: ~1 day.** **What it does not
fix:** 16 of those cards still open a page that says "Not written yet" — and a card promises _more_
than a link does, so the let-down is bigger. Buys visual weight, adds no substance.

### Option B — "Path first, directory second" (recommended spine)

```
1. START HERE — a numbered 3-step strip, each step with a REAL SCREENSHOT
   ① Connect your Airtable  ② Run your first backup  ③ Read the run
2. BROWSE THE DOCS — the labelled job bands from Option A, tightened to ~12 destinations
3. FROM THE ROADMAP — 3 tiles: one In progress, one recently Shipped, one "Add a request"
4. STILL STUCK? — the three ways out, unchanged
```

Answers all three of Oleh's asks (onboarding · roadmap reachable · a reason to engage) and P4, the
untested "bland" hypothesis. **Cost: ~2–3 days**, and a hard prerequisite: **the three pages the
step strip points at must be written first** — today all of `start/*` say "Not written yet". A
numbered path into three empty pages is a worse first impression than the wall of links.

### Option C — "Two rails" (Retool's home literally)

Body splits: left ~2/3 = the labelled directory; right ~1/3 = a stack of _From the roadmap_ tiles +
_Report a problem_ + _Ask the assistant_. **Cost: ~1.5 days.** Keeps the ways-out visible from the
first screen (P9). **Risk:** below 60rem it stacks, and the roadmap rail lands at the very bottom —
the position it already occupies today, so the mobile reading is unchanged.

### Recommendation

**Option B's spine with Option A's bands** — and B's step strip shipped _only_ after the three
`start/*` pages are written. If those pages are not being written this week, ship A + the roadmap
strip now and hold the step strip. Do not ship a path into empty rooms.

## 7 · Where I would push back on the brief

- **"Make it a landing page" is the right diagnosis and a risky prescription.** `specs/00-design-principles.md`
  is explicit: utility admin tool, functional over decorative, no hero illustrations, no decorative
  gradients. Notion's help centre gets its warmth from stock illustration; if we copy the _feeling_
  we break our own standard. The version of "engaging" that is legal for us is **product
  screenshots and real numbers**, not artwork.
- **The cheapest fix is content, not layout.** 25 of 38 pages unwritten is the load-bearing fact of
  this whole complaint. If exactly one thing happens this week, writing `start/getting-started`
  moves Dan more than any block on the home.
- **Beware fixing "bland" with more surface.** Options A–C all make the page taller. It is already
  2287px with 344 words. If the body grows to 3000px and still holds 22 unwritten destinations, the
  next round of feedback will be the same sentence with more scrolling behind it.

## 8 · Decisions needed from Oleh before anything is built

1. **Which option** — A, B, C, or B-gated-on-content?
2. **Screenshots: yes or no?** They are the strongest lever we have not pulled, and they are the
   one thing in the sweep that separates "engaging" from "a directory". If yes: may I capture them
   from the preview app at :4332, and which surfaces (backup run detail · schedule · restore)?
3. **"From the roadmap" rather than "What's new"** — agreed? (§5)
4. **Do home cards point at section overviews or at leaf pages?** Overviews would need 4–6 new
   pages written but would end the dead-end problem in one move.
5. **Are the four `start/*` pages being written now?** Option B's step strip is blocked on them.
6. **Does the home keep a FULL directory at all**, or does it show ~12 destinations and let the
   sidebar and search carry the rest? (Linear shows 12; Vercel shows 40.)
