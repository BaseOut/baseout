# Field research — how documentation varies by connected platform (2026-08-20)

Companion to `research-multi-platform-2026-08-20.md`, which analysed Dan's video and the Slack
thread. This one is the sweep he asked for: **who has already solved this, and how.**

Three clusters were studied in parallel, plus two measurements taken on our own repo and our own
build. Sources are cited throughout. **Nothing is built.**

---

## 0 · The two measurements that frame everything

**Measured in this repo, 2026-08-20.** Across all 38 documentation pages, "Airtable" appears in
**60 sentences on 22 pages**. 15 pages never say it at all. But the distribution is the finding, not
the count. The sentences are of two kinds:

- **Noun-swap** — *"Baseout reads your Airtable and does not change it"*, *"connect an Airtable
  Source"*. Replace one word and the sentence is true of ClickUp. This is the large majority.
- **Genuinely platform-specific** — *"Airtable's API does not expose them"*, *"Airtable returns a
  view's id, name and type, and its visible field ids only for grid views"*, *"Airtable does not
  report when a file was attached"*, *"with limited access Airtable returns a workspace's ID but
  withholds its name"*, *"Continue with Airtable"*.

**The second kind concentrates in five pages**: `troubleshooting/what-baseout-cannot-capture`,
`troubleshooting/missing-bases`, `start/signing-in`, `start/how-baseout-is-organized`,
`connections/sources`. Everywhere else Airtable is a noun.

**Measured on our own build.** Pagefind **does index content inside `hidden` elements**. Verified:
`dist/contact/index.html` carries "Something I wish existed" inside `data-step="request" hidden`, and
that string is present in a `.pf_fragment` of the built index. Pagefind parses HTML and never runs
CSS, so anything server-rendered is indexed whether or not a reader can see it. This decides more
than it looks like it does; see §4.3.

---

## 1 · Cluster A — connector catalogs (Fivetran, Airbyte, Segment, n8n, Nango, Merge)

These are our shape at 10× to 100× the scale.

**The per-connector page carries only DEVIATIONS from a shared model, and the deviation set is
fixed.** Fivetran's connector page is a 12-row Features table (`Capture deletes`, `History mode`,
`Re-sync`, `Row filtering`…) with Supported / Not supported cells, each linking out to the concept
page. Airbyte's is sync modes, streams, data type map, IP allow list. Merge's per-integration page is
*two sections* — sync frequencies and accessed endpoints — because everything else lives in the
unified-model docs. **Nobody re-explains how a sync works on a connector page.**

**Navigation stops before the connector list.** Segment proves it in config: `src/_data/sidenav/main.yml`
lists five Connections entries and **none** of the hundreds of integrations. A catalog page is the
door. Fivetran does the opposite — all 700 connectors permanently in the sidebar — and has the worst
navigation of the six.

**Generation produces the boxes, never the prose.** Segment's `make catalog` pulls the Config API into
`_data/catalog/*.yml` and injects a dossier box and a connection-modes matrix; the Aircall page is
still ~85–90% hand-written. Airbyte generates from a per-connector `metadata.yaml`. Nango from
`providers.yaml`. In all three, the *explanations* stayed human.

**Shared pages rot through hardcoded exception lists.** Fivetran's sync-overview names ~26 connectors
in one exception list and ~30 in another. Segment's destinations overview hardcodes seven. Airbyte's
core-concepts names **zero** — the cleanest, and the most recently rewritten.

> **The sentence that lands hardest for us:** our 22 contaminated pages *are* a distributed exception
> list. Adding ClickUp without a mechanism doubles each **mention**, not each page — which is worse,
> because no page-level tool can see it.

**Negative finding, and it matters:** **none of the six uses a global platform dropdown that rewrites
shared pages.** Airbyte's in-page tabs switch *deployment* (Cloud vs Open Source), not connector. The
persistent-dropdown pattern belongs to framework docs, where the same task has N renderings, so
switching is lossless. Connectors differ in *what is possible*, not in phrasing — a dropdown would
hide capability differences the reader came to compare.

**Two scale traps, both directly ours:** don't put the classification in the URL (Fivetran's
`/connectors/applications/…` and n8n's `n8n-nodes-base.airtable` are permanent redirect debt); and a
client-rendered platform list is invisible to build-time search.

## 2 · Cluster B — the switcher itself (Clerk, Supabase, Stripe, Auth0, Docusaurus, Mintlify)

**Clerk is the closest match to our measurement**, because it is built on exactly our premise:
variance at paragraph granularity. One `.mdx` file carries `sdk: astro, expo, nextjs, react, vue…` in
frontmatter and wraps varying prose in `<If sdk="…">` / `<If notSdk="…">` — **222 occurrences** across
their repo. Shared prose lives in `_partials/` and is pulled in with `<Include />`. When variance
grows too large they escape to **doc variants by filename** (`quickstart.mdx`,
`quickstart.react.mdx`, `quickstart.expo.mdx`), and their own guidance names the threshold: *"Instead
of using a bunch of `<Tabs />` or `<If />` components, which would bloat the doc and make it harder to
maintain, you can create a doc variant."*

Two Clerk details are worth more than the rest:

1. **The unscoped URL still exists and renders a grid of the available variants.** Three states, not
   two: scoped page, undecided page, and absent-from-nav. Most implementations only have two and
   404 the third.
2. **The search damage, with a ticket number.** Once platform becomes a search filter, records
   matching zero boosts *structurally lose* to boosted ones: their exact-title universal pages
   ("How Clerk works") were buried under body-content matches from SDK-scoped pages (DOCS-11910).
   Their fix is to tag universal pages with *every* SDK rather than none.
   **For us: the 15 platform-neutral pages are the ones that would get buried, and they are the most
   important pages we have.**

**The documented anti-pattern is Next.js's router dropdown** ([vercel/next.js#72829](https://github.com/vercel/next.js/issues/72829),
still open): switching the variant does not move you to the equivalent page, so the switcher silently
asserts that the page you are on is valid for what you just picked. For us that assertion would be
false on 15 pages out of 38.

**Docusaurus settled the precedence question** in [PR #8486](https://github.com/facebook/docusaurus/pull/8486):
tabs sync by `groupId` in localStorage, `queryString` additionally writes the URL, and **the query
string wins over localStorage on load.** That order is correct and worth copying verbatim.

### What Starlight actually gives us

- **`<Tabs syncKey="…">` / `<TabItem>` is the whole native offering.** Storage is `localStorage` under
  `starlight-synced-tabs__<syncKey>`. Labels must be identical across groups or the sync silently
  breaks. **Nothing goes in the URL**, and **the server always renders the first `TabItem`** — so a
  ClickUp reader would load every page seeing Airtable, then a repaint.
- **`routeMiddleware`** (`defineRouteMiddleware`) can mutate route data including `sidebar`. This is
  the supported hook for per-request sidebar filtering — Clerk's `sdk?: string[]` compiles down to
  this. The docs give no sidebar example; we would be first.
- **i18n is the only native mechanism that already does variant-with-fallback, and it does it
  completely**: path prefixes, an unprefixed default locale, fallback to the default language for a
  missing page, **and a visible notice that the page is not translated**. That is exactly the
  missing-page behaviour this problem needs. Modelling platforms as locales would give us all of it
  free, at the cost of hijacking `hreflang` and `<html lang>` — a real cost, but worth naming.
- **Versions/variants are not native.** [Discussion #957](https://github.com/withastro/starlight/discussions/957)
  is open; `starlight-versions` is early; `starlight-sidebar-topics` is the off-the-shelf top-of-site
  tabs plugin.
- **Prior art on our exact stack: Arcjet.** They had pages replicated per framework and named three
  costs: unclear navigation, duplicate maintenance, and SEO damage from duplicate resources. They
  moved to a `frameworks:` frontmatter list plus variant components, state in nanostores, persisted in
  localStorage **plus URL params**. The trap they hit that nobody predicts: **the table of contents
  desynchronises when headings change client-side**, so they had to override `PageSidebar.astro` too.

## 3 · Cluster C — multi-platform backup products (our own market)

Six studied: Rewind, Keepit, **ProBackup**, CloudAlly, SysCloud, Druva.

**ProBackup is the closest analogue that exists** — it backs up Airtable, ClickUp, Notion, Trello,
Asana and monday, which is our roadmap with the serial numbers filed off, and it solved the split at
small scale.

- **Task at the top, platform as a thin band underneath.** Six task collections lead (`Getting
  started`, `Navigating your backups`, `Restore & Recovery`, `Security & Monitoring`, `Account &
  Billing`), then 29 per-app collections of **1–6 articles each**. Airtable has 4. ClickUp has 3.
- **The shared collection owns the concept; the app collection owns the delta.** `Restore & Recovery`
  is entirely platform-neutral — "How to recover deleted data", "What data can and cannot be
  restored?", "How to test the restore process". The Airtable collection is only: what data is backed
  up · how to restore Airtable data · how to back up with a personal access token · how to add or
  remove bases.
- **Exactly two templated per-platform article types**, and the template is the shared artefact:
  *"This article lists the data types that ProBackup backs up for **Airtable** and any known
  limitations… These data types are not available through **Airtable's** API. We will add them to the
  backup scope as soon as they become available."* The ClickUp page is the same sentence with the
  noun swapped. That is deliberate and it works.
- **Their restore-per-platform page is organised by DATA TYPE, not by click-steps**, because the
  click-steps are identical and live once in the shared collection.

**What the field has converged on, six for six:**

1. **Account, billing and sign-in are always a separate top-level category, and always early.** Nobody
   puts billing inside a platform. *(Rewind then breaks its own rule by also writing per-platform
   cancellation articles — and it is the messiest help centre of the six.)*
2. **Per-platform content is templated, not freely authored.** Keepit: Get started / Your X Backup /
   Recover Your X Data / Troubleshoot. CloudAlly: create → preferences → activate → restore.
3. **"What this platform cannot do" is per-platform, never a shared matrix.** Not one of the six
   publishes a coverage comparison table.
4. **The upstream API is named as the reason.** *"Due to API limitations…"* is the genre convention,
   and it reads as honest rather than defensive. We already write this way.

**Where they disagree:** whether task or platform owns the top level. ProBackup and CloudAlly say
task; Keepit, SysCloud and Druva say platform. And **only Keepit narrows the sidebar** when you enter
a platform — SysCloud verifiably does not, which is why its 19-card top level reads as a directory
rather than a place.

**The single biggest mistake in this cluster: writing a concept in both places and marking neither as
authoritative.** Rewind ships a generic `How to: Restore a backup` *and* "Restoring JIRA Data" and
"How to restore an entire Shopify store". SysCloud ships `/point-in-time-restore` *and* 35+ restore
articles under Google Workspace alone. The reader on the platform page never learns the shared page
exists; the reader on the shared page cannot tell whether it applies. Search ranks both.

> The failure is not duplication. ProBackup duplicates a **template** on purpose and it works. The
> failure is duplication **without a declared owner**.

**The terminal state, if you want to see where a per-platform tree ends:** Druva's `Knowledge Base`
silo holds **1,385 articles** — four times the largest real section — because cross-cutting
troubleshooting had nowhere else to go.

---

## 4 · What this adds up to

### 4.1 The unit of the switch

Every cluster answers the same way from a different direction. Connector catalogs: the per-connector
page states deviations, never concepts. Clerk: variance is per-paragraph, and page duplication is the
*escape hatch* for when that fails. ProBackup: 3–5 pages per platform beside a task trunk.

Our own measurement lands in the same place, and it is worth stating as a number: **the genuinely
Airtable-specific facts sit in five pages.** ProBackup's Airtable collection has four. The measurement
and the field converge on the same size, which is the strongest signal in this document.

**So: the page is the wrong unit for a global switch, and the paragraph is the wrong unit for
navigation.** The right structure has both, at different scales.

### 4.2 The proposed architecture

**Layer 1 — the trunk stays task-shaped.** `Backing up`, `Restoring`, `Sources and destinations`,
`Your schema`, `Your data`, `Troubleshooting`, `Account`. These own **the concept and the
click-steps**. Platform appears as a parameterised noun, never as a fork.

**Layer 2 — a thin per-platform band**, three to five pages each, mandatory shape:

| Page | Owns |
|---|---|
| `What Baseout backs up for X` | The backed-up list, the not-backed-up list, and one sentence naming X's API as the reason |
| `Restoring X data` | Organised **by data type** (Bases/Tables/Records/Fields/Attachments), not by click-steps |
| `Connecting X` | The auth story: OAuth vs personal access token for Airtable, whatever ClickUp needs |
| *(optional)* | The platform's own quirk — Airtable's Workspaces-vs-Spaces mapping, limited-access base visibility |

The five pages we measured migrate here almost exactly: `what-baseout-cannot-capture` becomes the
limits page, `missing-bases` folds into it or into `Connecting Airtable`,
`connections/sources` splits into a shared concept plus an Airtable auth page, and the vocabulary
mapping in `how-baseout-is-organized` becomes per-platform data.

**Layer 3 — in-page tabs, only where the steps genuinely differ**, using Starlight's
`<Tabs syncKey="platform">`. Not as the site's navigation. Clerk's own threshold applies: when a page
needs more than a couple of these, it wants to be two pages.

**Cross-cutting — one platform data file.** Display name, glyph, auth methods, object vocabulary
(Base/Table/Field/View ↔ whatever ClickUp calls them), rate limits, unsupported list. One component
renders it. This is Segment's dossier minus the API call, and it is what stops a paragraph-level fact
from being hand-typed in 22 places.

**The rule that must be written down before ClickUp lands:** *the shared page owns the concept and
the click-steps; the platform page owns the object list and the limits.* Plus the link discipline
ProBackup forgot: **every platform page opens with a line pointing up at the shared concept, and every
shared page carries a short "differences by platform" block pointing down.** That is the cheap
insurance against this cluster's biggest mistake.

### 4.3 What NOT to build, and why

- **No global platform dropdown that rewrites shared pages.** No connector catalog does it; Clerk's
  version cost them their universal pages in search; Next.js #72829 is the same mechanism failing in
  public. At two platforms it would change nothing a reader can see while costing the whole project.
- **No mirrored tree.** 38 × 2 = 76 URLs of largely identical prose. Arcjet named the three costs and
  moved away from it on our exact stack.
- **No platform catalog page.** A catalog exists because 500 connectors will not fit in a sidebar.
  Two will. Building one for two platforms is cargo cult.
- **No shared limits matrix, yet.** Nobody in our market has one. At two platforms it is a
  two-column table that lies the moment either API changes. Keep limits per platform in a fixed
  section so a matrix can be *generated* later from consistent source.
- **No market-segment grouping layer.** Rewind's `Ecommerce Integrations` / `All Other Integrations`
  exists to fit sixteen platforms on a screen, and forces a category called "All Other".

### 4.4 The search consequence, which is now measured rather than assumed

Pagefind indexes hidden content (§0). Three things follow, and they are the opposite of what you
would guess:

1. **In-page tabs are SAFE for findability** — both variants are in the built HTML, so both are in
   the index. Nothing disappears.
2. **In-page tabs are DANGEROUS for precision** — a search for a ClickUp term returns a page whose
   *visible* content is Airtable, because the index cannot tell which tab was showing. Combined with
   the known trap that **Pagefind ANDs its terms**, a reader searching "ClickUp attachments" gets a
   page that appears to be about neither.
3. **A platform filter would bury the 15 neutral pages**, exactly as it did at Clerk, unless neutral
   pages are tagged with *every* platform rather than none.

The mitigation for (2) is Pagefind's own filter API: tag each tab panel so a platform filter can
exclude the other one. That is a real piece of work and it should be priced with the tabs, not after.

---

## 5 · Sequencing, by ratio of what it settles to what it costs

1. **Write the ownership rule down** (§4.2). Free, and it is the thing that prevents the cluster's
   biggest mistake. It also has to exist before anyone writes a ClickUp page.
2. **The platform data file plus a page chip.** Half a day. Every later mechanism reads it.
3. **Pull the five contaminated pages into the per-platform band** and parameterise the noun-swap
   sentences everywhere else. This is the real work, and it is *writing*, not engineering.
4. **`<Tabs syncKey="platform">` where steps differ**, with a `?platform=` param that beats
   localStorage on load (Docusaurus's settled precedence), plus the Pagefind filter.
5. **Sidebar narrowing via `routeMiddleware`** when the second platform exists. Not before: it is
   much easier to design against two real trees than against one and a hypothesis.
6. **A shared limits matrix** only once three platforms make the table worth its maintenance.

## 6 · The roadmap side, where the field gives us nothing

Dan wants people voting on which platform we support next. **Not one of the six backup competitors
runs a public voting board.** Rewind's is a black-hole form: *"What applications would you like to
see us back up next?"* → product team, no public tally. Keepit's roadmap is a press release.

The two halves worth combining come from outside the cluster and from inside it:

- **Rewind's product grid is the half worth copying** — every app card carries a status badge, and
  unsupported platforms are **shown, named and joinable**: `Waitlist` for HubSpot, Zendesk, Figma,
  Slack, Asana, Notion, Microsoft 365; `Early access` for Okta and Entra ID. **Naming the platforms
  you do not support yet is what makes a vote possible** — an empty text field cannot aggregate.
- **Airbyte's mechanics are the other half**: GitHub Discussions `new-connector-request`, a fixed
  candidate list with visible per-request vote counts, sortable by Top, plus a free-text path that
  *creates a new candidate* rather than vanishing.

For our board that means: a platform is its own item kind, seeded with real candidate names, with the
same five statuses, sorted by count, and the "not listed" path feeding the same list rather than a
form. Given `VOTES_LIVE` is still false, the honest order is candidates and sorting first, counts when
the store exists.

A board with three named candidates and honest counts would put us ahead of every product in §3.
