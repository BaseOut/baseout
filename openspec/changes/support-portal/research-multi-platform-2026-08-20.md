# Analysis — organising docs and roadmap by platform (2026-08-20)

**Source:** Dan's video *"Docs & Roadmap Organization by Platform (Airtable Now, Future Platforms
Later)"*, 5:19, transcribed locally (whisper.cpp, nothing uploaded), plus the Slack thread of
2026-08-19 between Oleh and Dan (`fellars`).

**Status: analysis. Nothing built.** The decision this ends on is Oleh's.

---

## 1 · What Dan asked for, in his order

| # | Ask | Timestamp |
|---|---|---|
| 1 | Mark what is **Airtable-specific**. Split all documentation into **Baseout-platform** content (account, login, forgot password, billing) and **platform-relative** content (everything else) | 0:21 – 1:51 |
| 2 | Mechanism: **"tabs or tagging or both"**, and *"maybe everything's tagged with an icon of what platform it's related to"* | 1:52 – 2:10 |
| 3 | **The roadmap splits the same way**: tabs for *Baseout general / Baseout platform*, then Airtable, then others as they arrive | 2:10 – 2:29 |
| 4 | **Future platforms on the roadmap**: which platforms are being considered, in development, shipped. *"Same planned, in progress, shipped"* | 2:29 – 2:45 |
| 5 | **A new level above Planned: `Suggested`.** Laid out **across** rather than as a column, *"because there's going to be a lot more of those"* | 2:46 – 3:16 |
| 6 | **Add-a-request forks on new-platform vs existing.** A new-platform request asks different questions, starting with *"what platform do you want us to support?"* Getting people to vote on the next platform is *"a big one"* | 3:24 – 3:49 |
| 7 | **Rename `Report a problem`** to `Contact support`, *"and then it could just be contact us"* | 3:50 – 4:03 |
| 8 | **More groupings in that form**: something is broken · something I wish existed · **account / billing** · **other**, a catch-all | 4:03 – 4:28 |
| 9 | **Attachments on the form**, to upload screenshots | 4:29 – 4:37 |

He opens with *"Yeah, I like this. This is looking better."* The frames show him on the live deploy
with **variant A** selected (path over screenshots, documentation as tiles); the A/B/C pill is
visible bottom-left throughout. He never names a variant, so this is a signal and not a ruling, but
the one he sat on while saying it looks better is A.

His closing line is the priority: *"the tricky one is how to support multiple platforms. I think it
is worth getting that right now."*

## 2 · What the Slack thread adds

- **Oleh** proposed horizontal tabs to separate content between connected products, with Zapier's
  developer docs as the reference: a row of tabs above the sidebar (Home · Install · API Reference ·
  Integrations · Powered by Zapier · White Label · MCP · SDK · Connectors). Then: *"we can have a
  common 'backup setup' chapter with horizontal tabs for each unique product like Airtable, ClickUp
  etc."*
- **Dan** named the real cost: *"the tricky part is the sidebar as that will need to be dynamic
  based on which platform, or have a large menu to support all platforms, so maybe a dropdown
  selector to pick a platform to display or something."*
- **Oleh:** *"agree, will try all options."*

So there are three candidate mechanisms on the table: **horizontal tabs**, a **dynamic sidebar**,
and a **platform dropdown**. They are not alternatives at the same scale, which is the point of §4.

## 3 · The measurement that decides it

Nobody has asked how much of this documentation is actually platform-specific. Counted over all 38
pages, by mentions of "Airtable":

- **15 pages never say Airtable at all** — every `account/*`, `reports`, `notifications/inbox`,
  `reference/statuses`, `connections/reconnecting`, `connections/destinations`,
  `restore/restoring-a-base`, `backups/retention-and-cleanup`, and four of the six `data/*` pages.
- Of the 23 that do, most say it **1 to 5 times in 150 to 900 words**. The platform appears in a
  clause, not as the subject: "the Airtable connection your Spaces share", "what Airtable shares
  with it".
- Only a handful are genuinely platform-heavy: `reference/glossary` (9), `start/what-baseout-is` (6),
  and the five-mention group (`getting-started`, `how-baseout-is-organized`, `schema/browse`,
  `troubleshooting/missing-bases`, `what-baseout-cannot-capture`).

**The platform is a property of paragraphs, not of pages.** That single fact rules out the most
expensive option and rescues the cheapest.

## 4 · Recommendation

### 4.1 Do not mirror the tree per platform

Zapier's tabs work because each tab is a genuinely different product with a genuinely different
tree: the SDK docs and the MCP docs share almost nothing. Ours would share almost everything. A
mirrored tree means `Backing up → Schedule and scope` exists once per platform, 90% identical, and
every future edit is made N times or drifts N ways. That is the version of this that is expensive,
and it is expensive forever rather than once.

It also answers Dan's sidebar worry directly: the sidebar only has to be dynamic if the tree is
duplicated. Keep one tree and the problem does not arise.

### 4.2 Three mechanisms, three different scales

| Scale | Mechanism | What it is for |
|---|---|---|
| **The page** | A **platform tag** in frontmatter, rendered as a chip with the platform's mark | Says "this page is about working with Airtable" or "this is Baseout itself". Dan's own suggestion, and the cheapest thing on this list |
| **The section inside a page** | **Horizontal tabs** (Starlight ships `<Tabs>`) | Where the STEPS genuinely differ: "Connect your source" is one paragraph for Airtable and another for ClickUp. This is where Oleh's Zapier idea belongs, and it belongs here rather than at the top of the site |
| **The chrome** | A **platform selector** in the header, filtering the sidebar to `Baseout + the chosen platform` | Dan's dropdown. One tree, filtered, never duplicated. It is also the only one of the three that can be added later without rewriting anything |

The sharp version: **tabs belong inside a page; the selector belongs in the chrome.** Putting tabs
at the top of the site is what forces the mirrored tree.

### 4.3 The split Dan is drawing already exists in the product

He describes it as *"Baseout platform"* versus *"platforms we support"*. That is not a new taxonomy
for the docs to invent: the product model already says **a Space is bound to exactly one platform**
(`specs/00-design-principles.md` §5, `product-model-authoritative`). Account, billing and sign-in
sit above the Space; everything about backing up sits inside one. The docs should mirror that
boundary rather than draw a second one beside it, because two taxonomies for one idea is how a
reader learns to trust neither.

Concretely: `platform: baseout` for the 15 pages that never mention a platform plus `account/*`, and
`platform: [airtable]` for the rest, with the value becoming a list the day ClickUp arrives.

## 5 · The roadmap side

**Platform is a facet, not a tab.** The board already has a filter chip row across the top
(All · Planned · In progress · Shipped · Already exists · Not planned). A second row, or a second
group in the same row, filtering by platform, costs one array and reuses a control people have
already learned. Tabs would put platform above status in the hierarchy, which is wrong: someone
scanning the board is asking "what is happening", not "what is happening to Airtable".

**A platform is not a feature request** (ask #4). "Support ClickUp" has a different shape from
"Point-in-time restore": no `docs` link when shipped, a different question when raised, and it is
the thing Dan most wants voted on. It should be its own item kind on the same board, with the same
five statuses, shown as its own section rather than mixed into the columns. That also gives the
add-a-request fork (#6) a real destination.

**`Suggested` is an intake state, and Dan is right that it cannot be a column.** Today `Planned`
means *"agreed, not started"* — a judgement has already been made. `Suggested` means *"asked for,
not yet judged"*, and it is unbounded: one column of three cards beside a column of forty is a
broken layout the first week anyone uses the board. His own instinct in the video is the fix, *"maybe
like across"*: three columns for the live states, and a **wide list underneath** for what has been
asked but not yet triaged. Rows, not cards, because the list is long and each row carries one line
and a vote.

One caution worth stating: adding `Suggested` means a public queue of unjudged requests, and every
item sitting there is a small promise that someone will look. `research-roadmap.md` §P6 already
prices the moderation. It is worth it, but it is a commitment to triage, not just a status.

## 6 · The contact side (asks #7, #8, #9)

- **The rename is already half-done and half-blocked.** As of `252005b` the page title follows the
  fork (`Write to us` → `Report a problem` / `Suggest an improvement`), but the header nav item
  still says `Report a problem`. Dan's `Contact us` resolves it: the door gets a neutral name and
  the step names itself. This is the cheapest item in the whole video.
- **Two more forks.** `Account and billing` is clearly right: it is neither broken nor a wish, and
  today it lands in the broken form, which mis-routes it. `Other` as a catch-all is a fair escape
  hatch, though it will attract everything that does not want to think, so it should sit last and
  read as last.
- **Attachments** are the only ask here with real backend weight: an upload needs storage, a size
  cap, a type allow-list and a virus posture. In this repo it can be built to the shape and stop at
  the boundary, the same way the vote button and the feedback widget already do.

## 7 · What I would do first, and why

Ordered by ratio of what it settles to what it costs.

1. **`Contact us` rename plus the two extra forks.** An afternoon, no new concepts, and it removes a
   contradiction a visitor meets before they type anything.
2. **The `platform` frontmatter field and the page chip.** Half a day. It is reversible, it makes
   the split visible immediately, and every later mechanism reads the same field. Nothing else here
   should be built before this one, because the selector and the tabs both depend on the data
   existing.
3. **`Suggested` as a wide section under the board**, plus a platform facet in the filter row.
4. **Platforms as their own item kind**, with the new-platform fork in the add-a-request flow. This
   is the one Dan called *"a big one"* and it is the one that produces information we do not have.
5. **The platform selector in the chrome.** Deliberately last: with one platform live it changes
   nothing a reader can see, and it is much easier to design against two real platform trees than
   against one and a hypothesis.
6. **In-page tabs**, when the second platform gives us a page whose steps actually differ. Building
   the tab component before there is a second column to put in it is building a fixture.

## 8 · Where I would push back

- **"Getting it right now" is right about the DATA and wrong about the CHROME.** Tagging every page
  now costs almost nothing and is what makes the later choice cheap. Building the selector, the
  tabs and a mirrored tree now means designing three mechanisms against a single platform, and the
  second platform will not be shaped the way we guessed. Tag now, navigate later.
- **The docs are still 25 pages of "not written yet".** Platform structure over unwritten pages is
  scaffolding around an empty building. The tagging is worth doing because it is nearly free; the
  navigation work is worth less than the same days spent writing `Restoring` and `Sources`.
- **`Other` in a support form is where routing goes to die.** Worth having, worth putting last, and
  worth reviewing after a month to see what it actually caught, because whatever it catches most is
  a fork that should have existed.
