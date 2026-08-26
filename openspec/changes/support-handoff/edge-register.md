# Edge register — the engineering companion to `/handoff`

**What this is.** Every edge state enumerated across the walked flows of the support portal, with the probe that surfaced it, what was decided about it, the
`file:line` that answers it where one does, and the note that carries the evidence. Nothing here was
deleted from anywhere — it changed address. It is GENERATED, and since 2026-08-25 that is true rather than aspirational: run
`node .claude/hooks/edge-register.mjs`, and `--check` fails when the committed file no longer matches.
The source is `apps/support/src/lib/handoff-registry.ts`,
which remains the single source: the flows, the steps, the URLs and the edges all still live in that file
and the `edges` field is still on the type.

**Why it is not on the page any more.** `/handoff` was built as an engineering defect register and
labelled a design handoff, and the two audiences want opposite documents. Two measurements made the case,
both taken on the rendered page on 2026-08-21:

- **222 links labelled `reproduce` pointed at 45 distinct URLs**, 28 of them at `/contact/?kind=ticket`.
  The label promised a state and delivered a page. `design.md` §8 of this change says a row whose URL does
  not reproduce its state is a lie told with a straight face; at that ratio the label was the lie.
- **268 probe badges plus 139 severity badges = 407 badges on one page**, two competing taxonomies fighting
  for the same glance. In the designer’s words, *"все зливається в купу"* — it all runs together.

So `/handoff` now renders three things per flow and nothing else: what happens here, the states you can
open, and what is missing or wrong in plain sentences. The probe names, the severities, the dispositions,
the `file:line` evidence and the open engineering questions are here instead. One audience per document.

**Who this is for.** Whoever builds. If you are reading this to decide what a screen should look like, you
want `/handoff` — this file will not help you and will actively slow you down.

## How to read a row

- **case** — the state, in the user’s terms. Identical to what the walk recorded.
- **probe** — which systematic probe surfaced it: empty · one · many · long · broken · limit · partial ·
  cross-step · entry · exit · stale · identity · platform-count · static-build. The last two are specific
  to this portal: a query parameter cannot change a static render, and every step has a different shape at
  one platform than at five.
- **disposition** — `handled` (answered by code, and `where` carries the line), `defect` (wrong today),
  `decide` (an open question — nothing is wrong until somebody picks).
- **severity** — how badly it bites, not how hard it is to fix. `high` breaks the flow, `medium` is real
  friction, `low` is polish. A `handled` row with nothing left to do carries none.
- **note** — opens with the enumeration id (E1, E2, …), then the evidence. The ids are stable: a row
  keeps its number when others are added, so a note that cites `E53` still points at the same row.

**Not verified in a browser**, and each says so in place: every claim about paint order and reflow (E17,
E100, E189), the Escape interaction between the chat drawer and an open `<dialog>` (E50, E212), and all
responsive geometry (E65, E267). The walk was produced from source only.

**Do not hand-edit anything below `## Totals

| | count |
| --- | --- |
| flows walked | 21 |
| steps | 86 |
| edge states | 277 |
| · handled | 157 |
| · defect (wrong today) | 59 |
| · decide (open question) | 61 |
| · of those, breaks the flow | 20 |
| cross-cutting frictions | 9 |
| decisions to lock | 21 |

---

## Edge states, by flow and step

### Landing

#### Land and choose a platform

`land-and-choose-a-platform` · built · sequence · 26 edge states

> Somebody arrives knowing nothing about the portal, picks the tool they actually use, and everything after this point reads in their own vocabulary.

**Flow note.** DONE, 2026-08-21. `ShotSwitch` and `lib/shot-switch.ts` said of themselves that they were built to be deleted, and Dan chose: the cards stay doors. The flow lost its second variant step and gained the one the choice created — the shared `PlatformPicker` in the hero, which is where scoping without leaving the page lives now.

**Renders it.** `apps/support/src/content/docs/index.mdx` · `apps/support/src/components/SupportHero.astro` · `apps/support/src/components/landing/LandingBody.astro` · `apps/support/src/components/PlatformStart.astro` · `apps/support/src/lib/landing-strip.ts` · `apps/support/src/components/PlatformPicker.astro`

##### Arrive — `/`

The dark band, the one search-or-ask input, and the three-step path below it. Nothing has been chosen yet, so every noun in the path reads in ordinary English rather than in one vendor's words.

| case | probe | disposition | severity | where | reproduces at | note |
| --- | --- | --- | --- | --- | --- | --- |
| the page you first see is not the variant you chose | `static-build` | `handled` | — | `LandingBody.astro:162-215` | `/` | E1 · An inline pre-paint script stamps `data-bo-platform` on `<html>` before the strip is parsed, so the correction lands before paint rather than after it. This is the only surface in the portal that pays for that fix. Its variant half (`data-shots`) went with the `filter` treatment on 2026-08-21; the attribute was renamed off the dead switch's vocabulary in the same pass. |
| renaming one storage key would flash the wrong variant forever, and nothing would say so | `static-build` | `decide` | medium | — | — | E2 · The pre-paint script duplicates `bo-platforms` verbatim, because an inline script cannot import. `LandingBody.astro` admits it; no gate catches the drift. Accept it, or add an assert. See D21. Halved on 2026-08-21: it used to duplicate `bo-landing-shots` too, and that key is gone. |
| you arrive from a search engine having chosen nothing | `entry` | `handled` | — | `PlatformStart.astro:10-12` | `/` | E3 · Full page, chooser at the top, nothing hidden behind a preference nobody set. |
| you search the portal for its own home page and never find it | `entry` | `handled` | — | `SupportLanding.astro:19` | — | E15 · The landing carries `data-pagefind-ignore` on purpose: a search result that lands you back on the home page is a result that failed. No URL reproduces a search, so this row carries none. |
| you press Cmd-K on the one page whose header hides the search pair | `identity` | `handled` | — | `Search.astro:88-91` | `/` | E16 · The hero carries its own field, so the header pair is hidden here — and the search `<dialog>` is moved to `<body>` at hydration or the shortcut would be dead on the most likely first page. |

##### Say which platforms you work in — `/?platform=airtable,notion`

The shared `PlatformPicker`, in the hero, directly above the search field it scopes. Oleh, 2026-08-21: the reader sees the search bar and must SEE the options for where they back up, rather than meet them hidden inside the modal. It writes the one `bo-platforms` preference, so the sidebar, the search modal, the chat and the directory below all follow — and this URL is that state, two platforms at once, which is the thing the deleted `filter` cards could not express.

| case | probe | disposition | severity | where | reproduces at | note |
| --- | --- | --- | --- | --- | --- | --- |
| you tick two platforms and the three steps go back to ordinary English | `partial` | `handled` | — | `landing-strip.ts:41-43` | `/?platform=airtable,clickup` | E37b · The same rule as E37 and reachable from the page now rather than only from a link: the strip re-labels at exactly one platform, because "which Bases or Spaces to back up" is not a sentence. The DIRECTORY still adds both platforms' sub-blocks, so two ticks is never a state that shows less than one. |
| you press None and expect the documentation to empty out | `empty` | `handled` | — | `PlatformPicker.astro:33-44` | `/` | E38b · Nothing ticked is nothing narrowed, which is what a checkbox filter means everywhere else; the trigger reads `All platforms` at both ends because both ends are the same view. The landing never subtracts in any case. |
| the same control is on the page and inside the search dialog on top of it | `cross-step` | `handled` | — | `Search.astro:63-92` | `/` | E39b · One stored value, two places, never both reachable: the dialog is in the top layer, so the hero control is behind its backdrop while it is open. Suppressing the modal's copy would leave the reader in front of a search whose scope is stated nowhere — the exact defect the hero control was added to fix. |
| a first paint that shows every platform ticked when the reader had narrowed | `stale` | `decide` | low | `PlatformPicker.astro:175-186` | — | E40b · Static build: the markup ships with everything on and the controller corrects it at hydration. Harmless for the TICKS (all-on and none-on are the same view) but the trigger's marks do appear. The landing pays for a pre-paint stamp already; whether this control joins it is open. UNVERIFIED — never measured in a browser. |

##### A card is a door — `/`

The strip below the hero, and since 2026-08-21 the only landing there is. Clicking a platform card narrows the site-wide preference to that platform and takes the reader into its documentation. The second treatment — the same cards as in-place selectors — is deleted: Dan, on the live portal, said it will not work at three-plus platforms, and the measured reason is that it was a single-select control writing a multi-select preference, so the front page could state less than every other surface of the portal.

| case | probe | disposition | severity | where | reproduces at | note |
| --- | --- | --- | --- | --- | --- | --- |
| with JavaScript off, a platform card does nothing at all | `broken` | `handled` | — | `platform-start.ts:33-48` | `/` | E14 · No longer split. Every card is a real `<a href>`, so it navigates with the script blocked, opens in a new tab on a middle click and shows its target in the status bar; the handler only writes the preference on the way out. The `filter` treatment's `<button>` cards — inert without a script, and with no way out of whichever variant the stylesheet defaulted to — are deleted. |
| you chose a variant last week and the switch has since been deleted | `stale` | `handled` | low | — | — | E5 · HAPPENED, 2026-08-21, exactly as written. `bo-landing-shots` is now orphaned garbage in the localStorage of everyone who touched the switch, nothing reads it, and nothing breaks. Not cleaned up deliberately: a one-shot deletion script would be more code, shipped to every visitor forever, than the string it removes. |
| a real visitor finds an unexplained Reactive / Filter toggle floating over the page | `exit` | `handled` | medium | — | `/` | E6 · RESOLVED 2026-08-21 by deletion rather than by decision. `ShotSwitch.astro` and `lib/shot-switch.ts` are gone, so the portal can go public without the question being answered. `?cards=` is now the only review parameter left on this page, and it is invisible to anyone who does not type it. |
| the way back to all platforms left with the variant that carried it | `cross-step` | `handled` | — | `PlatformPicker.astro:33-44` | `/` | E36 · The `Show all three` control lived in the deleted variant's foot. Widening is now the picker's own `All` button — reachable from the hero here and from the sidebar on every documentation page, rather than from this one block. A card still does not deselect on a second press: it is a link, and it never did. |

##### The path in your own words — `/?platform=notion`

Arriving with the choice already made — the state a reader is in on their second visit, or after a colleague sent them a link. Base becomes Teamspace, Record becomes Page, and step one points at Notion's own connecting page.

| case | probe | disposition | severity | where | reproduces at | note |
| --- | --- | --- | --- | --- | --- | --- |
| at five platforms the vocabulary cards stack four deep in one frame; at one there are none | `platform-count` | `defect` | medium | — | `/?platform=notion` | E9 · `GLOSSARY_PLATFORMS` is `PLATFORMS.filter(id !== 'airtable')` (`LandingBody.astro:127`), so at one platform the step frames lose their vocabulary entirely and at five they gain four each. Neither end is handled. |
| you choose ClickUp and the screenshot above the words is still Airtable | `broken` | `handled` | medium | `landing-steps.ts:147-154` | `/?platform=notion` | E10 · Argued rather than fixed: the three product shots have Airtable nouns baked into the pixels, and the mitigation is the glossary card beside the shot, not a replacement image. |
| you pick two platforms and the path reads exactly as if you had picked none | `partial` | `handled` | — | `landing-strip.ts:41-43` | `/?platform=airtable,clickup` | E37 · Deliberate — "which Bases or Spaces" is not a sentence, so the strip re-labels only at exactly one. |
| a Smartsheet or Monday reader gets no noun of their own in the path | `platform-count` | `handled` | high | `landing-steps.ts:140` | — | E263 · REPAIRED 2026-08-21. The list now derives from `DOCUMENTED_PLATFORM_IDS`, so a noun span exists for exactly the platforms that have pages. |
| the pre-paint script never stamps the two newest platforms | `platform-count` | `handled` | medium | `documented-platforms.ts:44` | — | E264 · NO LONGER REACHABLE, 2026-08-21. A Smartsheet reader cannot be stamped because Smartsheet is not offered on any documentation surface: those now render `DOCUMENTED_PLATFORMS`. Re-open this row the day a fourth platform gets pages, because the three-way test itself was never made general. |
| two bugs cancel out, so the copy quietly reverts to neutral instead of showing a hole | `platform-count` | `handled` | high | `documented-platforms.ts:44` | `/` | E265 · NO LONGER REACHABLE, 2026-08-21 — and the warning was right, so they WERE fixed together. Every documentation surface now renders `DOCUMENTED_PLATFORMS`, so the stamp at `:167`, the reveal at `:687-689` and the noun spans from `landing-steps.ts` are the same three by construction rather than by three hand-kept lists agreeing. Verified in a browser at 1440, not reasoned: the neutral noun and the per-platform noun were read after picking a platform. |
| the newest platforms’ cards are in the page and no rule ever reveals them | `platform-count` | `handled` | medium | `LandingBody.astro:130` | — | E266 · REPAIRED 2026-08-21. The glossary and the directory both read `DOCUMENTED_PLATFORMS`, so the DOM and the two reveals agree by construction instead of by three hand-kept lists. |
| four glossary cards now stack inside a frame drawn for two | `platform-count` | `defect` | medium | — | `/` | E267 · `LandingBody.astro:127`. Geometry UNVERIFIED — this needs a computed height read in a browser, which the enumeration could not take. |

##### Leave for the documentation — `/start/what-baseout-is/`

Where the path lands. From here the header nav, the sidebar filter and the chat are all present, and the landing is not in the reading sequence behind them.

| case | probe | disposition | severity | where | reproduces at | note |
| --- | --- | --- | --- | --- | --- | --- |
| a card promises a page that opens on "Not written yet" | `empty` | `decide` | medium | — | `/` | E7 · `SHOW_DRAFT_FLAGS = false` (`LandingBody.astro:62`), and `landing.ts:29-31` already carries a measured `written` flag that nothing renders. Ship with flags off (demo honesty) or on (reader honesty). See D9. |
| the directory keeps growing: 22 neutral cards plus one per topic per platform | `many` | `decide` | medium | — | `/` | E8 · Measured 2463px when the layout won, at three platforms. Five adds twenty more cards, unconditionally — nothing is hidden by a choice (`LandingBody.astro:34-37`). See D7. |
| the roadmap strip always finds three items, whatever the board holds | `stale` | `handled` | — | `landing.ts:335` | `/` | E11 · `buildStrip` falls back to a repeated subject rather than short-changing the row, and the sub-line promises statuses rather than spread. |
| with nothing shipped, a heading promising three sits over two cards | `empty` | `defect` | low | — | — | E12 · Latent. `landing.ts:334` `continue`s when a status has no candidate, and the sub-line is a static string. Not reachable with today’s fixtures, so no URL reproduces it. |
| you got to the bottom and still have not found it | `exit` | `handled` | — | `LandingBody.astro:115-120` | `/` | E13 · "Still stuck?" offers the assistant and Contact us, both live. The Roadmap card was deliberately removed from that row. |

### Documentation

#### Read documentation

`read-documentation` · built · sequence · 17 edge states

> Somebody reads one documentation page and finds their bearings on it — which chapter it belongs to, whose platform it is about, and what else is on the page.

**Renders it.** `apps/support/astro.config.mjs` · `apps/support/src/components/DocsSidebar.astro` · `apps/support/src/components/DocsPageTitle.astro` · `apps/support/src/components/PageSidebar.astro` · `apps/support/src/components/DocsFooter.astro`

##### A chapter, not a shelf — `/backups/how-backups-work/`

The sidebar is organised by what a reader is trying to DO, so the platform pages sit inside the chapter they belong to rather than in a shelf of their own. Chapters are collapsed; the three-row subject groups inside them are not, because a filter whose effect happens inside a folded box has no visible effect.

| case | probe | disposition | severity | where | reproduces at | note |
| --- | --- | --- | --- | --- | --- | --- |
| you reach the end of a page and it says "Not written yet" | `empty` | `handled` | — | `DraftBanner.astro:4-9` | — | E38 · Bound decision: every page must read as finished, so the `provisional` flag was removed from `content.config.ts:17-23` and no banner exists. 16 of 86 pages end this way. |
| five different doors all lead into the same unwritten page | `empty` | `decide` | medium | — | — | E39 · The sidebar, search, the chat’s citations, a landing card and a request’s `docs` link all reach a stub. See D9. |
| you land mid-manual from a search engine with no idea what this page is | `entry` | `handled` | — | `DocsPageTitle.astro:29-37` | `/backups/how-backups-work/` | E40 · Every page carries a one-sentence lede rendered from `description`. |
| a URL from an old email points at a page that has since moved | `entry` | `handled` | — | `astro.config.mjs:19-28` | `/start/what-baseout-is/` | E41 · `/submit`, `/tickets` and two platform pages all redirect rather than 404. A portal that 404s a URL it published is a portal people stop linking to. |
| you follow an old link to check on your case and get a blank new-case form | `entry` | `defect` | high | — | `/tickets` | E42 · `astro.config.mjs:20-21` sends `/tickets` to the contact FORM, not a list — and `/tickets` is the address the chat’s own out-of-messages line used to point at. See D2. |
| the header lights "Documentation" on a page that is not documentation | `identity` | `handled` | — | `src/components/Header.astro · isCurrent` | — | E53 · WAS a defect and is not one now, re-measured 2026-08-25. It read: `Header.astro:51-57` marks Documentation current for anything that is not `/`, `/roadmap*` or `/contact*`, so `/handoff` lights it. Two things ended it. `isCurrent` is a manual test now — `/api/` lights `API/MCP`, `/changelog/` lights `Changelog`, a docs page lights `Docs` — and `/handoff` no longer renders the portal header at all: 0 nav links in the built page. The row is kept rather than deleted because a reader who remembers the defect needs to find out it is gone. |
| a dead link from a month-old email gets a stranger’s 404 | `entry` | `decide` | low | — | — | E55 · There is no `src/pages/404.astro` in the tree, so Starlight’s default answers. Decide whether the portal writes its own. |

##### Whose platform this page is about — `/platforms/airtable/what-we-back-up/`

The page says whose platform it is before its first sentence, with the brand mark so it is recognised before it is read. 15 of the pages carry no platform at all and deliberately show nothing here.

| case | probe | disposition | severity | where | reproduces at | note |
| --- | --- | --- | --- | --- | --- | --- |
| a chapter whose every page your filter hides folds away instead of opening onto nothing | `partial` | `handled` | — | `platform-filter.ts:122-128` | `/platforms/airtable/what-we-back-up/` | E44 · No caret that opens onto an empty group. |
| an in-page tab strip with one live tab disappears rather than pretending to be a choice | `cross-step` | `handled` | — | `platform-filter.ts:132-151` | `/platforms/airtable/what-we-back-up/` | E45 · `PlatformTabs.astro:20-23`. The strip obeys the same filter as the sidebar. |
| a tab block that does not cover your platform leaves the previous platform’s panel showing | `broken` | `defect` | medium | — | — | E46 · `platform-filter.ts:141-146`: `live` is empty, the loop `continue`s, and the strip hides over a stale panel. Not reachable today because every block covers all three; latent the moment one does not. |
| a search hit whose matching words are in a tab you cannot see | `many` | `handled` | low | `PlatformTabs.astro:25-28` | — | E47 · Stated and accepted: Pagefind indexes every panel whether visible or not. |
| adding a platform fails the build until the tab component grows a slot for it | `platform-count` | `handled` | medium | `PlatformTabs.astro:45-52` | — | E22 · By design — `slot[name]` must be a static string, so the component throws rather than silently dropping a platform. It is also a hard blocker on the five-platform comparison below. |
| the build throws today, because two platforms shipped without tab slots | `platform-count` | `handled` | high | `PlatformTabs.astro:59` | — | E262 · REPAIRED 2026-08-21, and the repair changed the rule rather than the list. The throw fired, the MDX pipeline swallowed it, and the page served HTTP 200 with the whole block — label, strip and all three panels — silently absent. Tabs now derive from the slots the PAGE passes via `Astro.slots.has()`, which is dynamic where `slot[name]` is not, so a registry platform this page does not document simply gets no tab. |

##### The half no filter touches — `/account/billing/`

Managing an account, signing in and being billed are identical whoever you back up. Not one page in this chapter carries a platform tag, which is what makes narrowing to Notion leave the whole chapter standing.

| case | probe | disposition | severity | where | reproduces at | note |
| --- | --- | --- | --- | --- | --- | --- |
| ten chapters collapsed, and ten nested platform groups deliberately open | `many` | `handled` | — | `astro.config.mjs:91-95` | `/account/billing/` | E43 · 86 pages. The per-platform groups are open on purpose so the filter’s effect is visible; at five platforms that is 50 rows in 10 always-open groups. |

##### Page contents, and the room they give up — `/backups/schedule-and-scope/`

The right-hand contents list folds into a button when the chat drawer takes the width. The drawer reflows the page rather than overlaying it — the reader keeps reading while they ask.

| case | probe | disposition | severity | where | reproduces at | note |
| --- | --- | --- | --- | --- | --- | --- |
| the chat opens over the table of contents | `exit` | `handled` | — | `PageSidebar.astro:4-13` | `/backups/schedule-and-scope/` | E48 · The TOC folds into a list button rather than vanishing. |
| Escape with two layers open closes the inner one only | `exit` | `handled` | — | `toc-collapse.ts:34-48` | `/backups/schedule-and-scope/` | E49 · A capture-phase listener consumes the event; `chat-panel.ts:169-182` is the other half. |
| Escape out of a dialog also closes the chat behind it | `exit` | `defect` | medium | — | `/backups/schedule-and-scope/` | E50 · `chat-panel.ts:179-180` guards the TOC popover and the platform picker but not an open `<dialog>` — so Escape on the search or vote dialog takes the drawer with it. UNVERIFIED in a browser. See X7. |

#### Filter the documentation to my platform

`filter-the-documentation-to-my-platform` · built · states · 14 edge states

> Somebody narrows the whole documentation down to the platforms they use, and can hand that narrowed view to a colleague as a link.

**Flow note.** The URL is mirrored but not rewritten on first paint — doing so would overwrite a shared link before the reader had done anything. When the set is all five the parameter is deleted rather than spelled out, so "everything" has one representation, not two.

**Renders it.** `apps/support/src/components/PlatformFilter.astro` · `apps/support/src/lib/platform-filter.ts` · `apps/support/src/lib/platforms.ts`

##### Everything, because nothing was asked — `/start/getting-started/`

No choice means everything — five platforms in the chips above the tree and every row of the tree standing. A reader who never touches this control never learns it exists.

| case | probe | disposition | severity | where | reproduces at | note |
| --- | --- | --- | --- | --- | --- | --- |
| the sidebar paints every platform and then hides two-thirds of them | `static-build` | `decide` | medium | — | `/start/getting-started/` | E17 · `PlatformPicker.astro:126-129` says it out loud: rendering the stored value is not an option on a static build. The landing has a pre-paint fix; the docs pages have none. UNVERIFIED — the flash has never been measured. See D1 and X5. |
| a stored preference that excludes everything would leave you a manual with nothing in it | `empty` | `handled` | — | `platforms.ts:231-233` | `/start/getting-started/` | E29 · An empty set is treated as absent, in two places (`platforms.ts:279-280` is the other). |
| your browser refuses to remember anything | `broken` | `handled` | low | `platforms.ts:240-246` | `/start/getting-started/` | E30 · Writes are try/caught: the filter works for the page and does not survive navigation. |
| a shared or kiosk browser hands you the last person’s choice | `identity` | `decide` | low | — | `/start/getting-started/` | E31 · Nothing in the picker says "this is remembered on this browser". Decide whether it should. |
| a hand-edited platform id in the URL | `broken` | `handled` | — | `platforms.ts:222` | `/start/getting-started/?platform=airtable` | E34 · A bad `?platform=` value is filtered out; a bad id in frontmatter throws loudly at build (`platforms.ts:147-153`). Both ends covered. |

##### Narrowed to one — `/start/getting-started/?platform=airtable`

The page renders everything and the controller hides what the preference excludes. Each subject group keeps exactly one row, still in task order: that reshaping is the thing to be able to see.

| case | probe | disposition | severity | where | reproduces at | note |
| --- | --- | --- | --- | --- | --- | --- |
| you try to switch off the last platform | `one` | `handled` | — | `platform-picker.ts:142-151` | `/start/getting-started/?platform=airtable` | E18 · The surviving row is drawn inert, the checkbox is re-checked by hand after the browser flips it, and the live region names it: "Notion stays on. One platform always does." |
| at one platform the whole control is dead furniture | `platform-count` | `defect` | high | — | — | E19 · `chosen.length === 1` always, so the single option is permanently `aria-disabled` and the reset permanently hidden (`platform-filter.ts:130`) under a heading that says "Show docs for". This is the one-platform column of the comparison below. |
| the control changes shape because a fifth platform shipped | `platform-count` | `handled` | — | `PlatformPicker.astro:124` | `/start/getting-started/` | E20 · Presentation switches on a build-time `PLATFORMS.length > chipsUpTo`: sidebar 0, chat 2, search 4. Deliberate and argued at `PlatformPicker.astro:30-51`. |
| the same three logos subtract here and substitute on the board | `cross-step` | `handled` | medium | `PlatformPicker.astro:15-28` | `/start/getting-started/?platform=airtable` | E32 · Argued: `narrow` never hides untagged content, `scope` deliberately does (`board.ts:58-63`). Both are right in isolation, and it is the single most likely mental-model mismatch in the portal. See X6. |

##### Narrowed to two — `/start/getting-started/?platform=airtable,clickup`

The filter is multi-select, not a radio group. Two platforms is the realistic case for anyone running a migration, and it is the count at which the chips stop reading as a segmented control.

| case | probe | disposition | severity | where | reproduces at | note |
| --- | --- | --- | --- | --- | --- | --- |
| above four selected the trigger stops drawing marks and starts counting | `platform-count` | `handled` | — | `platform-picker.ts:162-166` | `/start/getting-started/?platform=airtable,clickup` | E21 · At five with five on, `all` is true and it reads "All platforms"; with four of five on it draws four marks. Sound. |
| narrowing in one place repaints the other three | `cross-step` | `handled` | — | `platform-filter.ts:194-199` | `/start/getting-started/?platform=airtable,clickup` | E24 · One store, one event, four subscribers — the sidebar behind an open dialog repaints, and the open search query re-runs (`search-modal.ts:100-105`). |
| a scope changed mid-conversation applies to the next question, not the one already asked | `cross-step` | `handled` | — | `chat-core.ts:107-113` | `/backups/reading-a-run/?platform=notion` | E25 · The chat reads scope at send time (`chat-panel.ts:64-75`). |
| a platform with a long name is the case the count cannot see | `long` | `handled` | low | `platform-picker.ts:78-83` | — | E35 · `listNames` spells out up to three and counts past that; `chipsUpTo` compares COUNT, never width. Stated at `PlatformPicker.astro:36-38`. |

##### The choice is in the address bar — `/start/getting-started/?platform=notion`

`?platform=` mirrors the choice, so the address is always shareable and always says what it shows. It BEATS storage on read: a link someone sends carries the platforms it was written for, and a preference from last week must not silently rewrite it.

| case | probe | disposition | severity | where | reproduces at | note |
| --- | --- | --- | --- | --- | --- | --- |
| the link a colleague sent narrows one page, then the site quietly widens back | `stale` | `decide` | medium | — | `/start/getting-started/?platform=notion` | E27 · `platforms.ts:219-224` reads the parameter per call and `platform-filter.ts:171-173` deliberately does not mirror it into storage on first paint. Decide whether one page is the intended lifetime of a shared narrowing. |

#### Land on a page my own filter hides

`land-on-a-page-my-own-filter-hides` · built · states · 3 edge states

> Somebody follows a link from outside onto a page their own filter is hiding, and has to be told that nothing is missing and how to widen it.

**Renders it.** `apps/support/src/components/DocsPageTitle.astro` · `apps/support/src/lib/platform-filter.ts`

##### Arrive from outside — `/platforms/notion/connecting/?platform=airtable`

A Notion page opened by a reader whose filter says Airtable — the case of somebody who followed a link from outside and has never seen the control that is confusing them. The page says so above the title: it is about Notion, your filter is hiding it, and nothing is missing.

| case | probe | disposition | severity | where | reproduces at | note |
| --- | --- | --- | --- | --- | --- | --- |
| your own filter hides the page you deliberately searched for | `entry` | `handled` | — | `DocsPageTitle.astro:65-77` | `/platforms/notion/connecting/?platform=airtable` | E26 · A per-page amber notice plus a one-click "Show Notion" (`platform-filter.ts:153-160,235-241`). |

##### The way out is on the notice — `/platforms/notion/connecting/?platform=airtable`

The same screen, now use it: the notice carries the button that widens the filter. The explanation lives beside the thing it explains rather than in a band stacked over the page.

| case | probe | disposition | severity | where | reproduces at | note |
| --- | --- | --- | --- | --- | --- | --- |
| a week-old choice hides a third of the manual and nothing on the page says so | `stale` | `decide` | medium | — | `/start/getting-started/?platform=airtable` | E28 · The sidebar’s amber "what is hidden" sentence was removed on 2026-08-21 (`PlatformFilter.astro:52-59` records the argument), so the only statement of state is the trigger’s marks. Accept (Dan’s call) or restore it for stale sets only. |

##### Widened — `/platforms/notion/connecting/`

After widening. The notice is gone, the sidebar is whole again, and the reader is on the page they were sent.

| case | probe | disposition | severity | where | reproduces at | note |
| --- | --- | --- | --- | --- | --- | --- |
| narrowing the docs does not narrow the board, and neither screen says so | `cross-step` | `decide` | low | — | `/roadmap/` | E33 · Correct per the ruling behind E32 — but the rule is stated on the board only. |

#### Rate a documentation page

`rate-a-documentation-page` · built · sequence · 11 edge states

> Somebody says whether the page they just read was useful, and optionally says why.

**Flow note.** No URL opens the "why" or "done" step: the widget is a three-state client machine over one render, which is the static-build constraint showing through. Reproducing steps 2 and 3 means clicking on the page in step 1.

**Renders it.** `apps/support/src/components/PageFeedback.astro` · `apps/support/src/components/DocsFooter.astro` · `apps/support/src/lib/page-feedback.ts`

##### Was this page useful — `/troubleshooting/backup-failed/`

Above Starlight's own footer, on documentation pages only. Two buttons and no stars: a rating scale asks a reader to calibrate, and the only answer worth acting on is whether the page did the job.

| case | probe | disposition | severity | where | reproduces at | note |
| --- | --- | --- | --- | --- | --- | --- |
| a thumbs-up on its own produces a number nobody can act on | `empty` | `handled` | — | `PageFeedback.astro:11-12` | `/troubleshooting/backup-failed/` | E219 · Two steps, never one: the reason list appears only after an answer, which is what turns a rating into a work item (`page-feedback.ts:5-8`). |
| "Was this page helpful?" asked underneath "Not written yet" | `broken` | `defect` | medium | — | — | E224 · `DocsFooter.astro:21-24` excludes splash and services only, so the widget appears at the foot of all 16 unwritten pages. The portal grading a reader for a page it did not write. See D9. |
| it says plainly that nothing is sent | `broken` | `handled` | — | `PageFeedback.astro:118-121` | `/troubleshooting/backup-failed/` | E226 · One of the three surfaces that admits it; the vote dialog is the one that does not. See X9. |

##### Say why — `/troubleshooting/backup-failed/`

A "no" opens one optional box. It is the second step rather than the first, because asking for prose before the verdict is what makes people skip both.

| case | probe | disposition | severity | where | reproduces at | note |
| --- | --- | --- | --- | --- | --- | --- |
| Send with nothing chosen and Skip do the same thing | `empty` | `defect` | low | — | `/troubleshooting/backup-failed/` | E222 · `page-feedback.ts:92-108` writes a verdict with no reason either way; only the thank-you line differs. Two buttons, one outcome. |
| the hidden half of the reason list is never focusable | `partial` | `handled` | — | `PageFeedback.astro:213-222` | `/troubleshooting/backup-failed/` | E223 · Both lists share one `<form>` and one `name="reason"`, written as a pair of rules rather than one with a negation, so neither list is ever both hidden and reachable by Tab. |
| there is no box to type the actual reason | `identity` | `handled` | medium | `PageFeedback.astro:21-28` | `/troubleshooting/backup-failed/` | E225 · Argued: `Another reason` exists so nobody is forced into a box that is not their answer, and so the missing free-text field is visibly missing rather than faked. |

##### Answered, and it stays answered — `/troubleshooting/backup-failed/`

The verdict is stored per page, so returning does not ask again. Nothing is sent — there is no backend in this repo, and the shape stops where the vote button stops.

| case | probe | disposition | severity | where | reproduces at | note |
| --- | --- | --- | --- | --- | --- | --- |
| you come back to a page you already rated | `stale` | `handled` | — | `page-feedback.ts:33-36` | `/troubleshooting/backup-failed/` | E220 · You are shown the outcome, not the question: "Thanks. You already told us about this page." Keyed by pathname. |
| you press No by mistake and the widget thanks you forever | `exit` | `defect` | medium | — | `/troubleshooting/backup-failed/` | E221 · `page-feedback.ts:81-90`: `verdict` is set once and there is no return path to the question. Permanent for that page, in that browser. |
| focus lands on the step that just appeared, without a ring that looks like a click | `exit` | `handled` | — | `page-feedback.ts:86-89` | `/troubleshooting/backup-failed/` | E227 · The ring is suppressed only for that programmatic case (`PageFeedback.astro:160-168`). |
| a page moves and every verdict ever recorded about it is silently orphaned | `stale` | `decide` | low | — | — | E228 · The key is `window.location.pathname` (`page-feedback.ts:34-36`). |
| nothing aggregates the answers, so no queue exists | `many` | `decide` | medium | — | — | E229 · `page-feedback.ts:9-20` — no view, no export, no path from a stored verdict to a person. The queue is the widget’s whole justification. See D14. |

### Search

#### Search the documentation

`search-the-documentation` · built · sequence · 15 edge states

> Somebody looks for a page by name, gets results narrowed to their platforms, and can ask the chat instead when nothing matches.

**Flow note.** PAGEFIND IS BUILD-TIME. On a dev server the module 404s and the modal returns nothing, which is how "search is broken" was reported twice in one day. Verify search against a real build served from `dist/` — `pnpm smoke-support` does exactly that, and asserts the index exists.

**Renders it.** `apps/support/src/components/Search.astro` · `apps/support/src/lib/search-modal.ts` · `apps/support/src/lib/pagefind.ts` · `apps/support/src/lib/recent.ts` · `apps/support/src/lib/questions.ts`

##### Open it — `/reference/faq/`

Press `/` or Cmd-K anywhere on this page, or use the search control in the header. There is no URL that opens the modal — it is a dialog over one render.

| case | probe | disposition | severity | where | reproduces at | note |
| --- | --- | --- | --- | --- | --- | --- |
| search returns nothing at all on a dev server, and says so | `static-build` | `handled` | — | `search-modal.ts:166-169` | `/reference/faq/` | E56 · "Doc search runs on the built site." Pagefind is a build artefact (`pagefind.ts:41-61`), and this honesty is what stopped "search is broken" being reported twice in one day. |
| the index is deliberately broader than this search, and nothing on screen says why | `cross-step` | `handled` | medium | `search-modal.ts:42-57` | `/reference/faq/` | E63 · Request pages stay indexed because `/contact`’s duplicate detection queries the same index (`submit.ts:4-7`). Adding `data-pagefind-ignore` to them would silently kill duplicate detection — the single most fragile coupling in the app. |
| the slash shortcut fires while your focus is on a button | `identity` | `handled` | low | `search-modal.ts:261-273` | `/contact/` | E68 · It is suppressed inside inputs, textareas, selects and contenteditable — not on a button, e.g. a contact fork tile. Acceptable. |
| you hunt for a feature request in the search box and it is not there | `entry` | `decide` | medium | — | `/reference/faq/` | E70 · Documentation only, and both the button and the field say so (`search-modal.ts:18-19,57`). See D8. |

##### Before anything is typed — `/reference/faq/`

The empty state is not empty: recent pages the reader actually opened, and a short list of popular questions. Both are filtered to documentation URLs, so the roadmap and the contact form cannot appear in a docs search.

| case | probe | disposition | severity | where | reproduces at | note |
| --- | --- | --- | --- | --- | --- | --- |
| the modal before a character is typed | `empty` | `handled` | — | `search-modal.ts:120-146` | `/reference/faq/` | E57 · Recently viewed, suggested questions, and "Or ask" — a resting state that is not blank. |
| "Recently viewed" is empty for someone who has read four doc pages | `empty` | `defect` | medium | — | `/reference/faq/` | E58 · `recent.ts:10-11,28-32` records EVERY page including `/contact` and `/roadmap` and caps at four; `search-modal.ts:127` then filters to docs. The cap is applied before the filter, so two non-doc visits wipe the list. See X4. |
| you reopen the modal and your query is gone | `exit` | `decide` | low | — | `/reference/faq/` | E64 · `search-modal.ts:248-253` clears it on open. Restore the last query, or always start fresh. |

##### Results, narrowed to your platforms — `/reference/faq/?platform=notion`

The modal reads the same platform preference the sidebar writes, and queries Pagefind for the reader's platforms plus `all`. A page with no platform is tagged `all` rather than left untagged, because a billing page is true of every platform, not of none.

| case | probe | disposition | severity | where | reproduces at | note |
| --- | --- | --- | --- | --- | --- | --- |
| a query whose best hits are all outside the documentation | `many` | `handled` | — | `search-modal.ts:34-40` | `/reference/faq/?platform=notion` | E59 · It asks the index for `MAX_RESULTS * 3` and drops non-docs afterwards, precisely so a "restore" query does not come back with two documents and four holes. |
| one failed query used to poison every later one on the page | `broken` | `handled` | — | `pagefind.ts:34-39` | `/reference/faq/` | E62 · Only success is cached now. |
| a slow keystroke landing after a newer one | `many` | `handled` | — | `search-modal.ts:181` | `/reference/faq/` | E66 · Race-protected: an earlier request cannot overwrite a later one (`search-modal.ts:194`). |
| at five platforms the chip row collapses into a menu | `platform-count` | `handled` | — | `Search.astro:79` | `/reference/faq/` | E69 · `chipsUpTo={4}`; the label "Search in" stays. Sound — and it is the surface where the count visibly changes the control. |

##### Nothing here, but something over there — `/reference/faq/?platform=notion`

When the narrowed query finds nothing and the wide one would have, the modal says how many it is holding back and offers "search all platforms" — rather than reporting an empty result the reader's own filter caused.

| case | probe | disposition | severity | where | reproduces at | note |
| --- | --- | --- | --- | --- | --- | --- |
| nothing matched, and it is your own filter that hid it | `empty` | `handled` | — | `search-modal.ts:161-178` | `/reference/faq/?platform=notion` | E60 · A second unfiltered query counts what the filter hid, and "search all platforms" is offered only when the filter is genuinely responsible. The best empty state in the portal. |
| nothing matched and no filter is to blame | `empty` | `handled` | — | `search-modal.ts:175` | `/reference/faq/` | E61 · "No page matches that — ask instead." The Ask row is always first, so it is also the answer when there is nothing. |

##### Ask instead — `/reference/faq/`

A result row can hand the question to the chat. Asking is the same job as searching, one step further along, which is why the pair sits in the header rather than in a floating bubble.

| case | probe | disposition | severity | where | reproduces at | note |
| --- | --- | --- | --- | --- | --- | --- |
| one strong result, and Enter opens the chat instead of it | `one` | `decide` | medium | — | `/reference/faq/` | E67 · `active` defaults to 0 and row 0 is always Ask (`rows.ts:45`, `search-modal.ts:107-118`). Decide whether Ask-first is right when there is exactly one strong doc hit. |
| a very long query printed in full inside the Ask row | `long` | `decide` | low | — | `/reference/faq/` | E65 · `rows.ts:48-49` prints it with quotes and no truncation in the markup. UNVERIFIED whether CSS clamps it — that needs a computed width read in a browser. |

### Chat

#### Ask the AI chat

`ask-the-ai-chat` · built · sequence · 19 edge states

> Somebody asks a question without leaving the page they are reading, and gets an answer that names the pages it came from.

**Flow note.** No URL opens the drawer. Every step above is the page that HOLDS it — press Ask AI to reach the state the caption describes. Making the drawer addressable is a change to `lib/chat-panel.ts`, not to this row.

**Renders it.** `apps/support/src/components/ChatDock.astro` · `apps/support/src/components/DraftBanner.astro` · `apps/support/src/lib/chat-panel.ts` · `apps/support/src/lib/chat-core.ts` · `apps/support/src/lib/chat-resize.ts`

##### Ask, from wherever you are — `/backups/reading-a-run/`

The Ask AI button sits beside the header search on every page of the portal. The drawer is rendered by the site-wide banner slot, so there is no page where the reader has to go somewhere else to ask.

| case | probe | disposition | severity | where | reproduces at | note |
| --- | --- | --- | --- | --- | --- | --- |
| no page to ask about, so it offers three questions instead | `empty` | `handled` | — | `ChatDock.astro:59-61` | `/` | E71 · On the splash landing, or once the page chip is dismissed, starter questions take the chip’s place (`chat-panel.ts:52-56`). |
| a starter question fills the box rather than spending a message | `partial` | `handled` | — | `chat-panel.ts:84-93` | `/backups/reading-a-run/` | E72 · The budget is five, and spending one on a click nobody confirmed is taking it unasked. |
| the answer is a stub; the sources are real | `broken` | `handled` | — | `chat-core.ts:20-30` | `/backups/reading-a-run/` | E73 · Argued. There is no answering engine, but the question is genuinely run through Pagefind, so the cited pages actually matched (`chat-core.ts:188-200`). |
| the chat offers to answer questions "about this page" where the page is a form | `identity` | `defect` | low | — | `/contact/` | E85 · `ChatDock.astro:58-61` uses `route.entry.data.title` for everything that is not `splash`, so the chip reads "Contact us" on `/contact` and "Roadmap" on `/roadmap`. |
| opening the chat on a phone with the nav already expanded | `broken` | `handled` | — | `chat-panel.ts:134-145` | `/backups/reading-a-run/` | E87 · It closes Starlight’s expanded nav first, so two full-screen layers never coexist. |
| a tab left open across a redeploy could not open the chat at all | `broken` | `handled` | — | `chat-panel.ts:8-15` | — | E54 · Explicitly fixed: the open flag is now set only by the module that also closes it, so a stale hashed bundle cannot leave the drawer unopenable. |

##### It reflows, it does not overlay — `/backups/reading-a-run/`

The drawer takes width from the page rather than covering it, and the page contents list folds into a button to pay for it. The reader keeps the paragraph they were reading on screen while they ask about it.

| case | probe | disposition | severity | where | reproduces at | note |
| --- | --- | --- | --- | --- | --- | --- |
| nothing above the drawer may become a containing block | `exit` | `handled` | — | `ChatDock.astro:47-51` | `/backups/reading-a-run/` | E86 · The drawer is `position: fixed` and takes part in no layout, which is why the hero uses `overflow-x: clip` rather than `container-type`. |
| you drag the drawer wider and the picker inside does not change shape | `long` | `handled` | — | `ChatDock.astro:117-121` | `/backups/reading-a-run/` | E88 · Argued: `chipsUpTo={2}` is decided before the page is served and cannot follow a drag. Min width 320px (`chat-resize.ts:29-34`). |
| you opened the chat once and now read every page with a drawer on the right | `stale` | `handled` | low | `chat-panel.ts:127-132` | `/backups/reading-a-run/` | E51 · Deliberate — the drawer belongs to the visitor, not to the page. |
| a stored drawer width wider than the window you are now in | `long` | `handled` | — | `chat-resize.ts:28-34` | `/backups/reading-a-run/` | E52 · Clamped to `min(720, 70vw)` and re-clamped on window resize. |

##### Answers with their sources — `/backups/reading-a-run/`

Every answer carries the documentation pages it came from, capped at six. An answer with no source is an answer nobody can check.

| case | probe | disposition | severity | where | reproduces at | note |
| --- | --- | --- | --- | --- | --- | --- |
| on a dev server it cites nothing and always says nothing matched | `static-build` | `handled` | low | `pagefind.ts:3-7` | — | E74 · No index exists under `astro dev`. |
| an answer with more sources than the panel can hold | `many` | `handled` | — | `chat-core.ts:87-100` | `/backups/reading-a-run/` | E89 · A `<details>` "Used N sources" list, `SOURCE_LIMIT = 6`. |
| an answer with no sources at all | `empty` | `handled` | — | `chat-core.ts:88` | `/backups/reading-a-run/` | E90 · No `<details>` is rendered rather than an empty disclosure. |
| the conversation never ends, and there is no way to start a new one | `many` | `defect` | medium | — | `/backups/reading-a-run/` | E80 · `chat-core.ts:148-151` replays the entire stored log on every page load and scrolls to the bottom. No cap, no clear, no "new conversation". See D5. |
| a conversation from three weeks ago replays with no date on it | `stale` | `defect` | medium | — | `/backups/reading-a-run/` | E81 · `Turn` has no `at` field (`chat-core.ts:40-47`), so there is no timestamp and no separator to print. This is the state a reader reads as "this is broken". |

##### It knows which platform you are on — `/backups/reading-a-run/?platform=notion`

The chat searches the same narrowed index the modal does. Without that it would answer a Notion question out of Airtable's pages, which is a wrong answer rather than a broad one.

| case | probe | disposition | severity | where | reproduces at | note |
| --- | --- | --- | --- | --- | --- | --- |
| nothing matched because your own platform scope hid it | `empty` | `handled` | — | `chat-core.ts:180-198` | `/backups/reading-a-run/?platform=notion` | E75 · A second unfiltered search counts the hidden pages and the reply says "turn one back on above" — the same repair as the search modal’s empty state. |
| you dismiss the page chip and the question already typed still carries it | `cross-step` | `handled` | — | `chat-panel.ts:48-50` | `/backups/reading-a-run/?platform=notion` | E83 · Context is read at send time (`chat-core.ts:102-106`), so the dismissal takes effect on the next question. |
| you dismiss the chip, navigate, and it comes back | `cross-step` | `defect` | medium | — | `/backups/reading-a-run/` | E84 · There is only `[data-chat-chip-clear]` and no re-scope control (`chat-panel.ts:78-82`); the chip is server-rendered per page (`ChatDock.astro:99-109`), so the dismissal silently un-does itself on the next navigation. |

##### The draft survives the page — `/reference/glossary/`

Open state, transcript and half-typed draft are all stored, so following a link out of an answer does not throw away the question. Reopen the drawer here and the conversation is still the one from the previous step.

| case | probe | disposition | severity | where | reproduces at | note |
| --- | --- | --- | --- | --- | --- | --- |
| you type half a question, navigate, and it is still there | `partial` | `handled` | — | `chat-core.ts:69-73` | `/reference/glossary/` | E82 · The pattern `/contact` needs and does not have — the draft survives navigation and reload (`chat-core.ts:153-156`). See X1. |

#### Run out of free messages

`run-out-of-free-messages` · built · states · 5 edge states

> Somebody spends the free chat messages, meets the limit, and is offered a person instead.

**Flow note.** The count lives in `localStorage` under `support-chat-used`. There is no URL that sets it, so reaching steps 2 and 3 means sending five messages or clearing that key — which is the static-build constraint again, and the reason this row names the key.

**Renders it.** `apps/support/src/components/ChatDock.astro` · `apps/support/src/lib/chat-core.ts`

##### The budget is stated up front — `/start/getting-started/`

Five free messages, counted down in the drawer as "N of 5 free messages left". Stating the budget before it runs out is what stops the limit reading as a fault.

| case | probe | disposition | severity | where | reproduces at | note |
| --- | --- | --- | --- | --- | --- | --- |
| clearing your browser gives you five more | `limit` | `handled` | — | `chat-core.ts:16-18` | `/start/getting-started/` | E78 · The budget is `localStorage`, per browser, and the file states this as UX honesty rather than as security. |

##### The last one — `/start/getting-started/`

At zero the line goes quiet rather than reading "0 of 5 left". A counter at zero is the same information as the gate below it, said twice.

| case | probe | disposition | severity | where | reproduces at | note |
| --- | --- | --- | --- | --- | --- | --- |
| two tabs, and the second one keeps a live composer after the budget is spent | `stale` | `defect` | low | — | `/start/getting-started/` | E79 · The counter is shared but each tab reads it at wire time and there is no `storage` listener (`chat-core.ts:64,140-146`). |

##### The gate, and the way past it — `/start/getting-started/`

The composer is replaced by a gate that names the two real routes: sign in, or describe it to a person. It is UX, not security — the real limit is enforced server-side in the engine.

| case | probe | disposition | severity | where | reproduces at | note |
| --- | --- | --- | --- | --- | --- | --- |
| the composer is replaced by a gate rather than failing on send | `limit` | `handled` | — | `chat-core.ts:140-146` | `/start/getting-started/` | E76 · "You have used your free messages. Write to us instead." (`ChatDock.astro:138-140`). |
| the way out of the gate loses the conversation it came from | `broken` | `defect` | high | — | `/contact/` | E92 · `ChatDock.astro:139` links `/contact/` with no `kind`, so the reader is dropped on the five-door fork and asked to choose again. With E91 these are the chat’s only two escalation paths: one un-clickable, one context-losing. See X3. |

##### Describe it to a person instead — `/contact/?kind=ticket`

Where the gate points. It carries the kind, so the reader lands on the fault form rather than on a fork asking them to repeat the choice they just made.

| case | probe | disposition | severity | where | reproduces at | note |
| --- | --- | --- | --- | --- | --- | --- |
| five messages of context, and then a fork asking what kind of thing this is | `limit` | `defect` | medium | — | `/contact/?kind=ticket` | E77 · This step’s URL is what the gate SHOULD link to. Today it does not (E92). |

#### Escalate from chat to a person

`escalate-from-chat-to-a-person` · built · sequence · 7 edge states

> Somebody the chat could not help hands the conversation over to a human without typing it all again.

**Flow note.** BUILT 2026-08-21, and the registry called it planned for most of that day. Three of four steps are live; the last one is not, and it is not a stub — the confirmation reads "That would have gone to support" and names neither the conversation nor a case, because there is no case. Note also that this is PROMOTION rather than a second control: two consecutive uncited answers fill the foot, they do not add a button. And the thing underneath it all is still absent — every bot reply is one of three canned strings, so the escalation is real and the conversation it escalates is not.

**Renders it.** `apps/support/src/components/ChatDock.astro` · `apps/support/src/lib/chat-core.ts` · `apps/support/src/lib/chat-panel.ts` · `apps/support/src/lib/submit.ts` · `apps/support/src/pages/contact.astro`

##### The chat cannot answer — `/backups/reading-a-run/`

Open the dock and ask twice. After two consecutive answers that cite nothing, the foot fills soft-primary and the reason unhides: "Two answers in a row found nothing in the documentation." A state reached by asking rather than by a parameter — so the URL is the page that HOLDS the dock.

| case | probe | disposition | severity | where | reproduces at | note |
| --- | --- | --- | --- | --- | --- | --- |
| the assistant tells you where to go, and it is not a link | `broken` | `handled` | — | `ChatDock.astro:147` | `/backups/reading-a-run/` | E91 · Was a defect while the only exit was a URL printed as prose inside a bubble. `Ask a person` is now a real control on the foot row, and it sits OUTSIDE `<form data-chat-form>` so the spent-budget gate cannot take it away with the composer. |
| you escalate from a page that was never written | `entry` | `decide` | low | — | — | E96 · The handoff block does carry "Pages it cited that did not help", so an empty citation list travels. Nothing distinguishes "the docs were empty" from "the docs were wrong" in what support ends up reading. |

##### Hand the conversation over — `/backups/reading-a-run/`

The transcript travels with the person. `Ask a person` writes the question, the page you were on, what the assistant answered and the pages it cited into `sessionStorage`, then navigates — nothing sensitive goes in the URL.

| case | probe | disposition | severity | where | reproduces at | note |
| --- | --- | --- | --- | --- | --- | --- |
| nothing at all carries over: not the question, the page, the scope or the sources | `cross-step` | `handled` | — | `chat-core.ts:321-324` | `/backups/reading-a-run/` | E93 · `buildHandoff` then `writeHandoff` into `sessionStorage['support-handoff']`, read back by `wireHandoff` (`submit.ts:226-270`). Up to three of the person’s own messages travel VERBATIM, plus the page, the assistant’s answer and the citations. See X3. |
| the half-typed question you left in the chat is not offered to the form | `partial` | `decide` | low | — | `/backups/reading-a-run/` | E94 · Still true, and smaller than it was: SENT messages now travel, but the unsent draft in `localStorage['support-chat-draft']` (`chat-core.ts:69-73`) is read by nothing on the far side. Decide whether an unsent sentence is part of the question or a private scratchpad. |
| the chat drawer stays open over the form you are now filling | `exit` | `defect` | medium | — | `/contact/?kind=ticket&from=chat` | E97 · The drawer is on every page (`DraftBanner.astro:22`) and `chat-panel.ts:118-132` restores its open state on every navigation, so it covers the right edge of the very form it just sent you to. Escalating is the one navigation that should close it. |
| contact offers to send you back to the chat you just left | `broken` | `decide` | low | — | `/contact/` | E98 · `contact.astro:157-159` and `submit.ts:162-165`: the loop is chat, contact, chat, with the fork in between. `?from=chat` now makes the outbound leg legible; the return leg still is not. |

##### The form arrives pre-filled — `/contact/?kind=ticket&from=chat`

The ticket form with the conversation attached: a collapsible "From your chat" block carrying what the assistant tried and the pages it cited, a `Remove` control, and the body prefilled with the question if it was empty. `?from=chat` is what gates reading the payload.

| case | probe | disposition | severity | where | reproduces at | note |
| --- | --- | --- | --- | --- | --- | --- |
| the form asks for your email as if you had never spoken | `identity` | `defect` | medium | — | `/contact/?kind=ticket&from=chat` | E95 · Sharpened by everything else landing. The conversation now travels and the identity does not: `submit.ts` never calls `readSession()` and never reads `?session`, so the only prefill is `readVoteEmail()` — an address remembered from the ROADMAP voting flow. Email is the identity key for the whole ticket system. See D3 and D12. |

##### Confirmation naming the conversation — not built

A case that says which chat it came from, so the person answering does not open a ticket with no history behind it.

### Contact

#### File a ticket while signed out

`file-a-ticket-while-signed-out` · built · sequence · 46 edge states

> Somebody with a broken thing describes it, attaches a screenshot and sends it, without having an account.

**Flow note.** BUILT, WITH THE DONE-STATE STILL MOVING. Everything up to submit is real; the last step changes the moment the ticket surfaces land, because a case number is only meaningful when there is somewhere to type it.

**Renders it.** `apps/support/src/pages/contact.astro` · `apps/support/src/lib/submit.ts` · `apps/support/src/components/RelatedToField.astro`

##### Choose a door — `/contact/`

Five doors, and the deflection sits on the fork rather than on the page: search the documentation or ask the assistant, offered before anyone starts typing and never again once they have.

| case | probe | disposition | severity | where | reproduces at | note |
| --- | --- | --- | --- | --- | --- | --- |
| a deep link opens one door directly, and an unknown one falls back to the fork | `entry` | `handled` | — | `submit.ts:49-53` | `/contact/?kind=billing` | E99 · The guard reads the one `KINDS` list, so anything else falls through rather than erroring (`submit.ts:183-185`). |
| a link straight to one door still flashes all five doors before the form appears | `static-build` | `defect` | medium | — | `/contact/?kind=billing` | E100 · The server always renders the fork; `submit.ts:185` runs from a bundled module `<script>` (`contact.astro:487-490`). The landing solved exactly this with a pre-paint inline script and `/contact` did not. UNVERIFIED in a browser. See D1 and X5. |
| the heading is rewritten by script and must match the one the server printed | `static-build` | `decide` | low | — | `/contact/` | E101 · `contact.astro:118-127` vs `submit.ts:109-136`. Both files state the rule; nothing enforces it. Add a gate, or accept. |
| Back from a form leaves the site entirely | `exit` | `defect` | high | — | `/contact/?kind=ticket` | E102 · `submit.ts:142-151` changes step without `pushState`, so the browser’s Back button has no step to go back to — including after submitting. See D4 and X1. |
| the new step starts at its own top, and a deep link deliberately does not scroll | `exit` | `handled` | — | `submit.ts:138-151` | `/contact/?kind=ticket` | E103 · `prefers-reduced-motion` is honoured. |
| five tiles in two rows that divide exactly | `one` | `handled` | — | `contact.astro:576-596` | `/contact/` | E104 · Six grid tracks so 3+2 divides, with the two common doors as the large pair. |
| a sixth door would break the grid the way the fifth broke the one before it | `many` | `decide` | low | — | `/contact/` | E105 · `contact.astro:166-184` — the layout encodes "five". |
| with JavaScript off the whole contact page is inert | `broken` | `defect` | medium | — | `/contact/` | E106 · The fork tiles are `<button>`s with no `href` (`submit.ts:153-158`), and the only two real links on the page both point at `/` (`contact.astro:157-158`). |
| a "sign in to see your tickets" line under the sales door | `identity` | `defect` | medium | — | `/contact/?kind=sales` | E107 · `contact.astro:476-482` is a direct child of `.sb`, OUTSIDE every step, so it renders on all five forms and on the confirmation — including the door whose entire premise is that the reader has no account, and the public-request door, which has nothing to do with tickets. |
| that link returns you to the form, not to your cases, and the address it returns to is mangled | `identity` | `defect` | medium | — | `/contact/` | E108 · `contact.astro:67` — `app.baseout.com/login?returnTo=https://support.baseout.com/contact`, unencoded, pointing at a form rather than at a list that does not exist. |
| the page says it is in the sidebar; it is not | `entry` | `defect` | low | — | `/contact/` | E109 · `contact.astro:134-139` carries `prev: false / next: false` with a comment explaining a sidebar entry that `astro.config.mjs:70-324` does not have. Harmless lines, stale comment. |
| the "search the docs instead" offer never appears over someone already typing | `cross-step` | `handled` | — | `contact.astro:145-153` | `/contact/` | E110 · Deflection lives inside the fork, not at page level. |

##### Describe the fault — `/contact/?kind=ticket`

The private form. It says so above the fields — this goes privately to support, nothing here appears on the public board — because the page next door publishes what you write.

| case | probe | disposition | severity | where | reproduces at | note |
| --- | --- | --- | --- | --- | --- | --- |
| you leave a required field blank | `empty` | `handled` | — | `submit.ts:405-410` | `/contact/?kind=ticket` | E111 · "Your name is needed before this can be sent." The label text is read from the field’s own `<span>`, so the message cannot drift from the label. |
| you mistype your email address | `broken` | `handled` | — | `submit.ts:412-414` | `/contact/?kind=ticket` | E112 · The regex is deliberately permissive — rejecting a valid address is the worse failure. |
| your address is already in the box and you never typed it here | `identity` | `decide` | medium | — | `/contact/?kind=ticket` | E113 · Pre-filled from the vote store (`submit.ts:384-385`, `votes.ts:72`). Convenience against surprise on a shared browser. See X2. |
| a billing question silently becomes the address used for your next vote | `identity` | `defect` | medium | — | `/contact/?kind=billing` | E114 · `submit.ts:416` runs `writeVoteEmail(email)` on every successful submit, with no dialog and nothing on screen. The other half of E113. |
| you refresh, and 600 words about a failed restore are gone | `exit` | `defect` | high | — | `/contact/?kind=ticket` | E115 · Nothing is written until submit (`submit.ts:398-425`). A refresh, a closed tab, an accidental Back, or clicking a duplicate suggestion all destroy the draft. The chat keeps one; this form does not. See D4 and X1. |
| Back to the fork keeps what you typed, and a different door starts empty | `partial` | `handled` | low | `submit.ts:156-158` | `/contact/?kind=ticket` | E116 · Accidentally correct: the section is only `hidden`, so the fields keep their values. Neither behaviour is announced. |
| a 40,000-character paste is accepted in silence | `long` | `decide` | medium | — | `/contact/?kind=ticket` | E120 · Subject and body have no cap and no counter (`contact.astro:281-289`); whatever backend lands will reject what this page accepted. |
| the hint tells you what to include, and what to leave out | `empty` | `handled` | — | `contact.astro:85-86` | `/contact/?kind=ticket` | E121 · Run IDs, base names and error text — and "leave out anything you would not want support to read." |
| nothing suggests the article that answers your subject line | `partial` | `decide` | medium | — | `/contact/?kind=ticket` | E122 · `submit.ts:239-292` wires duplicate detection for `[data-dupe-input]` only, which exists once (`contact.astro:352`). The four commonest tickets are already written under `troubleshooting/*`. See D6. |
| a double-click files two tickets | `broken` | `defect` | medium | — | `/contact/?kind=ticket` | E123 · The button is never disabled and the handler is synchronous (`submit.ts:398-425`). Harmless while nothing is sent; a real backend gets two. |

##### Say what it is about — `/contact/?kind=ticket`

The "related to" row, in the reader's own platform vocabulary. Fields are in the order a human asks the questions, not in the order a database wants them.

| case | probe | disposition | severity | where | reproduces at | note |
| --- | --- | --- | --- | --- | --- | --- |
| you pick a platform and nothing downstream changes | `cross-step` | `handled` | low | `RelatedToField.astro:36-81` | `/contact/?kind=ticket` | E117 · Argued: it is collected for triage only. See D6 for the deflection this could drive. |
| there is no "a platform you do not support" option on this door | `one` | `handled` | — | `contact.astro:266-270` | `/contact/?kind=ticket` | E118 · Deliberate — a fault always happened on a platform we run. `RelatedToField.astro:60-70`. |
| two of these fields in one form would share a name and answer for each other | `broken` | `defect` | low | — | — | E119 · The computed group name at `RelatedToField.astro:33` is assigned and never used; all three instances render `name="about"` and stay independent only because they sit in separate `<form>` elements. Latent. |

##### Attach a screenshot — `/contact/?kind=ticket`

Images and PDF, 10 MB per file, several files, each removable. The rule is stated before the picker opens, and the sentence the page shows is derived from the same constants the validator enforces.

| case | probe | disposition | severity | where | reproduces at | note |
| --- | --- | --- | --- | --- | --- | --- |
| the rule is stated before the picker opens | `limit` | `handled` | — | `submit.ts:78-98` | `/contact/?kind=ticket` | E159 · "PNG, JPG, GIF, WebP or PDF. Up to 5 files, 10.0 MB each." Derived from the same constants the validator enforces, so the prose cannot drift from the check (`contact.astro:300`). |
| one bad file in a good pick | `partial` | `handled` | — | `submit.ts:436-440` | `/contact/?kind=ticket` | E160 · The acceptable files attach and the refused ones are named individually with what to do instead (`submit.ts:500-536`). |
| you pick a sixth file | `limit` | `handled` | — | `submit.ts:520-525` | `/contact/?kind=ticket` | E161 · "5 files is the limit, so X was not added. Remove one first if you want to swap it." |
| a file over 10 MB | `limit` | `handled` | — | `submit.ts:514-519` | `/contact/?kind=ticket` | E162 · Names the actual size and suggests cropping or a link. |
| a second visit to the picker adds instead of replacing | `many` | `handled` | — | `submit.ts:72-76` | `/contact/?kind=ticket` | E163 · Via `DataTransfer`, with the input left as the source of truth so a real submit is still `new FormData(form)` (`submit.ts:453-460`). |
| you re-pick the same screenshot and nothing happens at all | `broken` | `defect` | low | — | `/contact/?kind=ticket` | E164 · `submit.ts:507` ignores a duplicate (same name, size and mtime) with no message. |
| a file whose type the browser cannot name | `broken` | `handled` | — | `submit.ts:555-565` | `/contact/?kind=ticket` | E165 · An empty MIME type falls back to an extension check. Explicitly not a security boundary. |
| you remove a row and focus does not fall to the floor | `exit` | `handled` | — | `submit.ts:547-551` | `/contact/?kind=ticket` | E166 · Focus lands on the row that took its place, or the last row, or the picker button — never `<body>`. |
| you remove the only file | `empty` | `handled` | — | `submit.ts:480-486` | `/contact/?kind=ticket` | E167 · "X removed. Nothing attached." rather than going blank. |
| the count line does not say the same thing twice | `many` | `handled` | — | `submit.ts:531-535` | `/contact/?kind=ticket` | E168 · The delta line is printed only when appending to files that were already there, because the count line is itself a live region. |
| you drag your screenshot onto the form and nothing happens | `broken` | `decide` | medium | — | `/contact/?kind=ticket` | E169 · No drag-and-drop is wired (`submit.ts:494-498`); the only route is the Choose files button. The single most expected gesture for "here is my screenshot". |
| you paste a clipboard screenshot and nothing happens | `broken` | `decide` | medium | — | `/contact/?kind=ticket` | E170 · No paste handler exists — and pasting is how most people take a screenshot. |
| five files of ten megabytes each, accepted without a word | `limit` | `decide` | low | — | `/contact/?kind=ticket` | E171 · `submit.ts:78-79` caps per file and not in total. |
| a screen recording is refused with advice that does not fit a video | `broken` | `defect` | low | — | `/contact/?kind=ticket` | E172 · The refusal is deliberate (`submit.ts:62-66`) but the message says "is not an image or a PDF… paste the text into the box above" (`submit.ts:509-513`), which is the wrong instruction for a `.mov`. |

##### Done — and what happens next — not built

The confirmation. It exists as a step today and says the wrong thing for a signed-out person: there is no case number to give and no thread to return to, so it can only promise an email.

| case | probe | disposition | severity | where | reproduces at | note |
| --- | --- | --- | --- | --- | --- | --- |
| the confirmation says the case is flagged as coming from someone not signed in | `identity` | `handled` | — | `submit.ts:346-349` | — | E124 · The one place the portal admits the anonymous/authenticated distinction to a user. |
| it says plainly that nothing was sent | `broken` | `handled` | — | `contact.astro:463-469` | — | E173 · "This portal has no backend yet — the form is complete and the submission is not." |
| each of the five confirmations names its own destination | `identity` | `handled` | — | `submit.ts:345-373` | — | E174 · Support, the board, billing, sales, the unsorted inbox — the one fact the person pressing submit is checking. |
| the only link out of the confirmation is "Back to the board" | `exit` | `defect` | high | — | — | E175 · `contact.astro:470`, for all five doors. Four of the five have nothing to do with the board, and there is no "file another", no "back to the docs", no "here is what happens next". |
| no case number, no reference, and no copy of what you wrote | `partial` | `decide` | high | — | — | E176 · `submit.ts:418-425`. The confirmation says a real submission "would send you a copy"; today the reader’s own words vanish the moment they press send. See D14 and X8. |
| you refresh the confirmation and it is the fork again, with no evidence anything happened | `exit` | `defect` | medium | — | `/contact/` | E183 · `submit.ts:183-185` reads `?kind=`, which the submit never sets. |
| nothing anywhere promises how long it will take | `broken` | `handled` | — | `submit.ts:345-373` | — | E184 · Bound decision honoured: the confirmations name a destination and an event, never a time. See X8 for the half that is missing. |

#### File a ticket while signed in

`file-a-ticket-while-signed-in` · planned · sequence · 0 edge states

> Somebody we already know files the same ticket without re-typing who they are, and it lands in their own list.

**Flow note.** STILL PLANNED after 2026-08-21, and the distinction is worth reading rather than skipping: the ticket surfaces shipped that day and this flow did not. `/requests/` exists, so the destination of step 3 is real. But `contact.astro` and `lib/submit.ts` never call `readSession()` and never read `?session`, so there is NO signed-in composer — the form asks for name and email as free text on every visit, and the only prefill is `readVoteEmail()` from the roadmap. The sign-in note at the foot of `/contact/` still points at `https://app.baseout.com/login` rather than at `/requests/`, which is now a link the portal could make and does not. NO STEP HERE CARRIES AN EDGE ROW, deliberately: the walk probed the signed-in surfaces once, on `see-my-requests` and `read-and-answer-a-thread`, and duplicating those rows onto a third planned flow would make one question look like three. The identity rows that decide whether this flow can exist at all are E236, E244 and D12.

**Renders it.** `apps/support/src/pages/contact.astro`

##### Arrive already known — not built

No email field, because we have it. The single row that separates this flow from the one above is the row that asks a customer who they are.

##### Pick which Space it is about — not built

A signed-in person can be asked which Space, which connection and which run — the three facts a support answer usually needs and a signed-out ticket usually lacks.

##### Done — with a case in a list — `/requests/`

The list a confirmation would point AT now exists — this is it. What does not exist is anything that puts a newly filed case into it: the reference printed on the confirmation is made up in the browser and matches nothing here.

#### Ask about billing · sales · something else

`ask-about-billing-sales-or-something-else` · built · states · 18 edge states

> Somebody whose question is not a fault picks the right door — billing, sales or anything else — and gets a form shaped for it.

**Flow note.** The first step carries no edge rows because the fork is ONE screen shared by five doors, and the twelve rows that probe it (E99–E110) sit on the step where a reader first meets it, in `file-a-ticket-while-signed-out`. Repeating them here would be the same defect written twice and corrected once.

**Renders it.** `apps/support/src/pages/contact.astro` · `apps/support/src/lib/submit.ts`

##### The fork, all five doors — `/contact/`

Position is the argument here. "Something else" is last in the list, last in the DOM, last in the tab order and last in the grid — a catch-all at equal weight collects everyone who would have chosen correctly.

##### Account and billing — `/contact/?kind=billing`

It exists because invoice questions were being mis-routed into the broken-thing door, which told the person writing that their problem was a fault. Private like a ticket, and it must never carry the public-board warning.

| case | probe | disposition | severity | where | reproduces at | note |
| --- | --- | --- | --- | --- | --- | --- |
| no "which platform" question on this door | `cross-step` | `handled` | — | `contact.astro:266-270` | `/contact/?kind=billing` | E143 · A billing question is not about a platform, and asking would be a required-looking control with no right answer. |
| anyone can file a billing ticket against anyone’s address | `identity` | `decide` | medium | — | `/contact/?kind=billing` | E144 · The reader almost certainly has an account and the form asks for their email so the case can be matched to it (`contact.astro:279`) — and cannot verify it. See D12. |
| a link straight from an invoice email | `entry` | `handled` | — | `submit.ts:175-182` | `/contact/?kind=billing` | E145 · The named use case, and it works. |
| a month-old invoice link pre-fills the wrong address into a billing ticket | `entry` | `defect` | medium | — | `/contact/?kind=billing` | E146 · E113 compounding: the vote email in the browser may belong to a different person entirely. |

##### The hint that stops a card number — `/contact/?kind=billing`

The body hint names the last four digits as enough and says never send a full number — before the box, not after. Once a card number is in a ticket it is in a mailbox, a database and a backup.

| case | probe | disposition | severity | where | reproduces at | note |
| --- | --- | --- | --- | --- | --- | --- |
| the unsafe field is named before the box, not after it | `identity` | `handled` | — | `contact.astro:95-99` | `/contact/?kind=billing` | E141 · "the last four digits of the card if a payment failed. Never send a full card number." The single best copy decision on the page. |
| the warning is copy only, and a full card number goes through | `broken` | `decide` | medium | — | `/contact/?kind=billing` | E142 · Nothing detects or refuses 16 digits in the body (`submit.ts:398-425`) and nothing scrubs an attachment (`submit.ts:555-565`). See D11. |

##### A pre-customer question — `/contact/?kind=sales`

The one door that does not assume an account already exists behind it, and the one whose confirmation does not reuse the support wording — because its destination is not support.

| case | probe | disposition | severity | where | reproduces at | note |
| --- | --- | --- | --- | --- | --- | --- |
| the platform question comes first, because it is the one answer that changes everything under it | `one` | `handled` | — | `contact.astro:416-423` | `/contact/?kind=sales` | E147 · "Do you support Notion yet" is the shape of most pre-sales questions. |
| the email hint here does not offer to find an account you do not have | `identity` | `handled` | — | `contact.astro:432-435` | `/contact/?kind=sales` | E148 · "We reply here. You do not need an account." — different from the other three doors on purpose. |
| and the foot of the same page tells you to sign in to see your tickets | `identity` | `defect` | medium | — | `/contact/?kind=sales` | E149 · `contact.astro:476-482`. The one door built on the premise that there is no account carries a sign-in prompt under it. The sales instance of E107. |
| no attachments on this door | `partial` | `handled` | — | `contact.astro:388-397` | `/contact/?kind=sales` | E150 · Argued rather than omitted: a person who has not used the product has no artefact to attach. |
| the confirmation must not say "support", and does not | `cross-step` | `handled` | — | `submit.ts:361-368` | — | E151 · The desk it names is sales. |
| a prospect who asked about pricing is sent to a feature-request board | `exit` | `defect` | medium | — | `/contact/?kind=sales` | E152 · `contact.astro:470` — "Back to the board" is the only link on every confirmation. See E175. |
| the door most likely to be found by a stranger links to no pricing and no product site | `entry` | `decide` | medium | — | `/contact/?kind=sales` | E153 · The meta description enumerates the doors (`contact.astro:129-132`), and this is the only one whose reader has never seen the product. |
| the one place a platform outside the list is captured, and it goes nowhere | `empty` | `decide` | low | — | `/contact/?kind=sales` | E154 · `RelatedToField.astro:73-80`. Should a sales answer of "a platform you do not support" seed a roadmap candidate, as the request door’s does? |

##### Something else — `/contact/?kind=other`

The catch-all, and its promise: if it turns out to be a fault or an idea, we move it to the right place rather than asking the reader to file it again.

| case | probe | disposition | severity | where | reproduces at | note |
| --- | --- | --- | --- | --- | --- | --- |
| the catch-all is last everywhere it appears | `partial` | `handled` | — | `submit.ts:44-47` | `/contact/?kind=other` | E155 · Last in the list, in the DOM, in the tab order and in the grid — deliberately, so it collects only the people who genuinely could not choose. |
| the hint promises a human will move it to the right place | `empty` | `decide` | medium | — | `/contact/?kind=other` | E156 · `contact.astro:107-109` and `submit.ts:369-372` commit to a triage process with no owner named anywhere. See D13. |
| a triager moves your private message onto the public board | `cross-step` | `defect` | high | — | — | E157 · The public warning is on one door only (`contact.astro:336-342`), so a submitter here never consented to publication. |
| no "which platform" question on the door where a platform oddity most often lands | `cross-step` | `decide` | low | — | `/contact/?kind=other` | E158 · Same argument as billing (`contact.astro:266-270`), with the opposite consequence. |

#### Submit a public feature request

`submit-a-public-feature-request` · built · sequence · 8 edge states

> Somebody asks for something the product does not do yet, in public, where other people can vote for it.

**Renders it.** `apps/support/src/pages/contact.astro` · `apps/support/src/lib/submit.ts` · `apps/support/src/data/requests.ts`

##### The public door — `/contact/?kind=request`

The one form on this page that publishes. It says so before the first field — the private doors say the opposite, and the difference has to be visible without reading either.

| case | probe | disposition | severity | where | reproduces at | note |
| --- | --- | --- | --- | --- | --- | --- |
| you are told what will be public before you type anything | `identity` | `handled` | — | `contact.astro:336-342` | `/contact/?kind=request` | E136 · "This will be visible to everyone… Your email never does." Four of five doors are private; only this one warns, and the warning is pre-emptive rather than a footnote (`contact.astro:22-27`). |
| no attachments here, because a screenshot is how customer data reaches a public board | `identity` | `handled` | — | `contact.astro:39-44` | `/contact/?kind=request` | E137 · A privacy safeguard, not a UX omission. |

##### One line, as you would say it — `/contact/?kind=request`

A title, not a summary field. The board is read by other customers, and a request titled like a bug report gets no votes.

| case | probe | disposition | severity | where | reproduces at | note |
| --- | --- | --- | --- | --- | --- | --- |
| a 200-character display name collapses the card it lands on | `long` | `defect` | medium | — | `/contact/?kind=request` | E138 · "Name to show on the board" has no length limit (`contact.astro:367-370`), and `RequestCard.astro:127-134` records that unbounded text in that slot once collapsed the reading column from 293px to 173px. |

##### Which platform, if any — `/contact/?kind=request`

The "related to" row allows a value that is not on the list, which is how a request for a platform we do not support yet gets filed at all.

| case | probe | disposition | severity | where | reproduces at | note |
| --- | --- | --- | --- | --- | --- | --- |
| a stale or hand-edited about= value | `broken` | `handled` | — | `submit.ts:220-232` | `/contact/?kind=request` | E126 · Falls through to the default rather than leaving the radio group with nothing selected. |
| the "which platform?" box is required only while it is the answer | `partial` | `handled` | — | `submit.ts:209-216` | `/contact/?kind=request&about=new-platform` | E127 · A hidden required field would block submit with a message pointing at an invisible control. |

##### Suggest a platform — `/contact/?kind=request&about=new-platform`

The board's own "suggest a platform" tile lands here with the first two questions already answered. Asking again after somebody walked through a door is the same discourtesy as asking which door they wanted.

| case | probe | disposition | severity | where | reproduces at | note |
| --- | --- | --- | --- | --- | --- | --- |
| the board’s own tile pre-selects the radio and focuses the only unanswered box | `entry` | `handled` | — | `submit.ts:203-235` | `/contact/?kind=request&about=new-platform` | E125 · `roadmap.astro:273` links it. The best micro-interaction in the portal. |

##### Done — and where it went — not built

The confirmation. There is no backend, so nothing is sent and nothing appears on the board; what a real one has to say is which public page the request now lives on.

| case | probe | disposition | severity | where | reproduces at | note |
| --- | --- | --- | --- | --- | --- | --- |
| the confirmation promises a status the board’s own vocabulary forbids | `cross-step` | `defect` | high | — | — | E139 · `submit.ts:350-352` says it would post as Planned for a moderator to review. The board’s intake state is Suggested, and `requests.ts:25-41` is explicit that Planned means we agreed. |
| it says it would count your vote, and no count exists | `cross-step` | `decide` | low | — | — | E140 · `submit.ts:352` against `votes.ts:15` — `VOTES_LIVE = false`. Acceptable as a statement about the future, if that is the ruling. |

#### Hit a duplicate while submitting a request

`hit-a-duplicate-while-submitting-a-request` · built · sequence · 8 edge states

> Somebody starts typing a request that already exists and is shown it before they finish writing.

**Flow note.** A TITLE IS A PHRASE AND PAGEFIND ANDs. Querying "restore data from a backup" whole asks for a page containing every word and matched nothing, while the index plainly held `/roadmap/restore/`. So: try the phrase, then ask about each meaningful word and rank by overlap. On a dev server this whole flow silently does nothing, because Pagefind is build-time.

**Renders it.** `apps/support/src/lib/submit.ts` · `apps/support/src/lib/pagefind.ts` · `apps/support/src/pages/roadmap/[slug].astro`

##### Start typing a title — `/contact/?kind=request`

Duplicate detection runs off the title as it is typed. It queries the docs index, not a second search: every request has its own page under `/roadmap/`, so Pagefind already holds them.

| case | probe | disposition | severity | where | reproduces at | note |
| --- | --- | --- | --- | --- | --- | --- |
| duplicate detection is dead on a dev server and says nothing | `static-build` | `handled` | medium | `submit.ts:9-11` | `/contact/?kind=request` | E128 · Documented: `pagefind.ts:41-61` returns nothing without a build. Verifying it means a real build served from `dist/`. |
| fewer than four characters asks nothing | `empty` | `handled` | — | `submit.ts:25` | `/contact/?kind=request` | E129 · The box stays hidden and no query runs (`submit.ts:286-289`). |
| a whole-phrase query that would otherwise match nothing | `many` | `handled` | — | `submit.ts:294-341` | `/contact/?kind=request` | E130 · Pagefind ANDs its terms, so the fallback asks per meaningful word and requires TWO hits before interrupting anyone. A repaired defect, not a feature. |

##### Something like this already exists — `/contact/?kind=request`

The suggestions appear under the field, each a link to the request's own page. Two shared words is the floor — one is a coincidence, because "backup" appears on nearly every page we own.

| case | probe | disposition | severity | where | reproduces at | note |
| --- | --- | --- | --- | --- | --- | --- |
| exactly one similar request | `one` | `handled` | — | `submit.ts:260-263` | `/contact/?kind=request` | E131 · "One request looks similar — is it yours?", correctly singular. |
| three suggestions, each wearing its status | `limit` | `handled` | — | `submit.ts:265-280` | `/contact/?kind=request` | E132 · `MAX_DUPES` is 3, and the status badge is what makes "Already exists" pay for the interruption immediately. |
| delete the request pages and detection returns nothing, forever, silently | `broken` | `handled` | medium | `submit.ts:4-7` | `/roadmap/restore/` | E135 · Documented in three files (`[slug].astro:9-12`, `search-modal.ts:42-52`). Nothing in `submit.ts` could see it happen. |

##### Go and vote on it instead — `/roadmap/restore/`

Where a suggestion goes. The detail pages are load-bearing beyond being nice to read: delete them and duplicate detection silently returns nothing.

| case | probe | disposition | severity | where | reproduces at | note |
| --- | --- | --- | --- | --- | --- | --- |
| you click a suggestion to check it and your half-written request is gone | `exit` | `defect` | high | — | `/roadmap/restore/` | E133 · `submit.ts:274` renders a plain same-tab link — no `target`, no confirmation, no draft. The feature designed to save the reader work is the fastest way to lose theirs. See X1. |

##### Or file it anyway — `/contact/?kind=request`

The suggestions never block submission. A reader who has read the near-match and still thinks theirs is different is usually right, and interrupting them twice is how a suggestion box becomes noise.

| case | probe | disposition | severity | where | reproduces at | note |
| --- | --- | --- | --- | --- | --- | --- |
| a request filed since the last deploy is invisible to the next person’s duplicate check | `stale` | `decide` | medium | — | `/contact/?kind=request` | E134 · `[slug].astro:23-25` is `getStaticPaths` over a fixture array, so a new request has no page until the next build. On a live board that is the difference between "no duplicates" and "no duplicates yet". See D10. |

#### Follow up on a case I filed

`follow-up-on-a-case-i-filed` · planned · sequence · 6 edge states

> Somebody comes back to a case they already filed, from the email we sent them, and adds what they forgot.

**Flow note.** The email itself is the undesigned half. Everything above depends on a decision nobody has taken: whether a signed-out person gets a link with a token in it, or has to sign in.

**Renders it.** `apps/support/src/pages/contact.astro`

##### The email arrives — not built

Whatever we send has to carry a way back in. A confirmation with no return address makes the reply the only channel, and a reply lands in a mailbox nobody has built.

| case | probe | disposition | severity | where | reproduces at | note |
| --- | --- | --- | --- | --- | --- | --- |
| the email never arrives | `broken` | `decide` | high | — | — | E177 · Spam, a typo, or a corporate filter. There is no address confirmation, no "check your spam", no way to re-send — and per the bound decision no portal view to fall back on. The case is unreachable. See D14 and X8. |
| you typed the wrong address, and the case exists against one you do not own | `identity` | `decide` | high | — | — | E178 · `submit.ts:412-414` validates shape only; there is no verification and no correction path. See D12. |

##### Open the case from the email — `/requests/BO-7QX9-K4TD/?session=out`

A signed-out person following a link from their own inbox. The case URL now exists and the locked panel returns them to THAT case after sign-in — what does not exist is the email that would carry the link.

| case | probe | disposition | severity | where | reproduces at | note |
| --- | --- | --- | --- | --- | --- | --- |
| you half-remember a page for your tickets and get the contact form | `entry` | `defect` | high | — | `/tickets` | E181 · The reader-facing face of E42, and WORSE since 2026-08-21 rather than better: `astro.config.mjs:22` still sends `/tickets` to `/contact`, and there is now a real list at `/requests/` for it to have gone to instead. Open the link — it is a one-click bug report. See E242. |
| you write in from a different address and are simply not shown the case | `identity` | `decide` | medium | — | — | E180 · With no list to explain it on, there is nowhere to state the rule. |
| a reply link that is a month old | `stale` | `decide` | — | — | — | E182 · Nothing in the portal is addressable per case, so there is no link to age — which is the finding, not the mitigation. See D14. |

##### Add what you forgot — `/requests/BO-7QX9-K4TD/?session=in`

The commonest follow-up is a screenshot the person did not have when they wrote. The composer on the case now takes it — the same 5 × 10 MB rule as `/contact` — so a second ticket is no longer the only route, for anybody who can reach the case.

| case | probe | disposition | severity | where | reproduces at | note |
| --- | --- | --- | --- | --- | --- | --- |
| the page promises a merge that nothing implements | `identity` | `decide` | medium | — | `/contact/` | E179 · `contact.astro:476-482`: "One opened without an account is still yours — sign in later with the same address and it will be there." That is a specification, written on a live page. See D12. |

### Roadmap

#### Browse the roadmap

`browse-the-roadmap` · built · sequence · 21 edge states

> Somebody looks at what is being built, narrows it to what concerns them, and opens one item.

**Flow note.** The board's scope control does NOT read `?platform=` — `lib/board.ts` collects its facets from `data-plat-filter` and starts at "all" on every load. It is the one platform surface in the portal whose state is not shareable, and the comparison below is what shows that.

**Renders it.** `apps/support/src/pages/roadmap.astro` · `apps/support/src/lib/board.ts` · `apps/support/src/components/RequestCard.astro` · `apps/support/src/data/requests.ts`

##### The board — `/roadmap/`

Position encodes kind: the status columns, then the platform section, then what has been suggested. The filter bar is two named tiers separated by a rule, because scope and status are different questions and a single row of chips says they are the same one.

| case | probe | disposition | severity | where | reproduces at | note |
| --- | --- | --- | --- | --- | --- | --- |
| you click the chip that says "Planned 6" and count five cards | `many` | `defect` | high | — | `/roadmap/` | E185 · The chips count all 27 requests (`requests.ts:583-584`); the column heads count feature requests only (`roadmap.astro:86-89`). Measured: chip Planned 6 over head Planned 5, chip In progress 4 over head 3, chip Suggested 10 over section head 7. The difference is the five platform candidates, which live in their own section. See X4. |
| a column with nothing in it | `empty` | `handled` | — | `roadmap.astro:231` | `/roadmap/` | E187 · "Nothing here yet." rather than collapsing, so the shape of the board does not change under a filter. |
| the intake list is one full-width column because it is the one with no ceiling | `many` | `handled` | — | `roadmap.astro:283-304` | `/roadmap/` | E195 · `requests.ts:51-57`. A column of three beside a column of forty breaks in the first week. |
| a visibly stale intake list reads as "nobody works here" | `stale` | `decide` | high | — | `/roadmap/` | E196 · `requests.ts:31-37` says Suggested is a commitment to triage — a person, a cadence, and a rule for when a row leaves the list — and "Do not ship it without one." See D13. |
| no sort, no search and no pagination, and nothing says what order a column is in | `many` | `decide` | medium | — | `/roadmap/` | E197 · 27 rows today, in fixture order (`roadmap.astro:301-303`). At 200 the Suggested list is a wall. See D15. |

##### Narrow the scope — `/roadmap/`

The platform segments above the status chips. A platform choice is as deliberate as picking a status, which is why it gets its own tier rather than a sixth chip.

| case | probe | disposition | severity | where | reproduces at | note |
| --- | --- | --- | --- | --- | --- | --- |
| two cards appear in a fourth column with nothing naming it | `partial` | `defect` | medium | — | `/roadmap/?platform=airtable` | E188 · Four of the five groups wear the one head system (`roadmap.astro:59-64`); `rb-col-terminal` has none (`:237-239`). |
| filter to "Already exists" and the whole board is one unheaded card | `partial` | `defect` | medium | — | `/roadmap/` | E189 · `board.ts:69-86` — one row, terminal, every column and section hidden. UNVERIFIED visually. |
| the terminal group is revealed by either facet, not only by status | `cross-step` | `handled` | — | `board.ts:72-85` | `/roadmap/?platform=airtable` | E190 · A repaired defect: a platform chip saying "Airtable 5" that revealed 3 is a count that lies about what clicking it shows. |
| a platform choice here hides untagged items, which is the opposite of the docs filter | `cross-step` | `handled` | — | `board.ts:58-65` | `/roadmap/?platform=airtable` | E191 · An amber notice says so and offers "Show all" (`roadmap.astro:211-217`). It is the only one of the two controls that explains itself. See X6. |
| "Not seeing your platform?" jumps to a section the current filter has hidden | `broken` | `defect` | medium | — | `/roadmap/` | E193 · `roadmap.astro:185` targets `#rb-platforms`; under a status filter that empties it, `board.ts:85` hides the target and the jump does nothing visible. |
| a filtered board cannot be shared, bookmarked, or returned to | `exit` | `defect` | medium | — | `/roadmap/` | E194 · `board.ts:44-45` holds the filter in plain locals with no `replaceState` — in an app where the docs filter is mirrored to `?platform=` on every change. See D15. |
| the scope control wraps to two rows at five platforms | `platform-count` | `defect` | medium | — | `/roadmap/` | E23 · `roadmap.astro:151-186` is a hand-rolled segmented row, not `PlatformPicker`, and it grows one button per platform with no collapse. The exact failure `PlatformPicker` was built to end, still present on this one surface. See D19. |
| two platform chips that count nothing, beside a candidate for each | `platform-count` | `defect` | high | — | `/roadmap/` | E268 · `platform-smartsheet` and `platform-monday` are exactly the candidates `requests.ts:114-126` says must carry no `platform` id, on the argument that "we do not ship its mark because we do not ship it" — and both now ship marks. `countByPlatform` (`requests.ts:596-597`) therefore renders Smartsheet 0 and Monday 0. See D20. |

##### Narrowed to nothing — `/roadmap/`

When a scope leaves the board empty the page says which choice did it and offers "Show all", rather than rendering three empty columns. Two of them reads as two errors and a result.

| case | probe | disposition | severity | where | reproduces at | note |
| --- | --- | --- | --- | --- | --- | --- |
| both facets true of nothing | `empty` | `handled` | — | `roadmap.astro:306-310` | `/roadmap/` | E186 · "No requests match both filters. Widen one of them to see the rest." (`board.ts:88`). |

##### One request — `/roadmap/schema-map/`

Every request has its own page — for reading, for linking, and because duplicate detection on the request form is built on their being indexed.

| case | probe | disposition | severity | where | reproduces at | note |
| --- | --- | --- | --- | --- | --- | --- |
| a long title or a long author name | `long` | `handled` | — | `RequestCard.astro:36-42` | `/roadmap/schema-map/` | E198 · A repaired defect: the author sits in its own `auto` grid track so unbounded text cannot collapse the reading column, and the vote button is the only thing allowed in the corner (`RequestCard.astro:127-134`). |
| untagged means Baseout itself, and the card says "ALL PLATFORMS" | `platform-count` | `decide` | low | — | `/roadmap/schema-map/` | E199 · `RequestCard.astro:24-28,110-113` prints it behind a globe so the subject slot is never empty — but `requests.ts:114-126` gives the absent field two different meanings spoken as one label. |
| every request has a real page, and that is what makes duplicate detection possible | `entry` | `handled` | — | `[slug].astro:9-12` | `/roadmap/two-way-sync/` | E200 · Deleting them breaks detection silently. See E135. |
| a link from an old email after a slug rename | `stale` | `decide` | low | — | — | E201 · A hard 404: `[slug].astro:23-25` has no redirect table, unlike the docs (`astro.config.mjs:22-27`). |
| dates in US format on a site with a language selector in its header | `broken` | `defect` | low | — | `/roadmap/schema-map/` | E202 · `[slug].astro:49-53` hard-codes `toLocaleDateString('en-US', …)`; `Header.astro:100-102` offers a `LanguageSelect`. |
| a rejected request explains itself, and "Already exists" must prove it | `empty` | `handled` | — | `[slug].astro:115-120` | `/roadmap/schema-map/` | E203 · `Not planned` carries a `reason` block; `Already exists` is REQUIRED to carry a `docs` link, because the page that proves it is the whole answer (`requests.ts:18-23`). |

##### Suggest a platform — `/contact/?kind=request&about=new-platform`

The platform section's own door out. It pre-answers the two questions the request form would otherwise ask.

| case | probe | disposition | severity | where | reproduces at | note |
| --- | --- | --- | --- | --- | --- | --- |
| narrow to any platform and three of the five candidates vanish, taking the tile with them | `many` | `defect` | medium | — | `/roadmap/?platform=airtable` | E192 · `requests.ts:540-577` — `monday`, `trello` and `smartsheet` carry no `platform` id, so every chip hides them; `.rb-newp` has no `data-slug` (`roadmap.astro:264-279`) so it is only ever hidden with its section. |

#### Vote on a request

`vote-on-a-request` · built · sequence · 15 edge states

> Somebody backs a request so that we know how many people want it.

**Flow note.** Flip `VOTES_LIVE` in `apps/support/src/lib/votes.ts:15` and three surfaces change at once — the card, the detail page and the board header. That is deliberate: it is one decision, not three.

**Renders it.** `apps/support/src/lib/votes.ts` · `apps/support/src/lib/board.ts` · `apps/support/src/components/RequestCard.astro` · `apps/support/src/pages/roadmap/[slug].astro`

##### A card with a vote control — `/roadmap/`

The control is live and the COUNT is not. `VOTES_LIVE = false` gates the number, not the feature: a board showing 3 votes on everything says the product has no users, which is a worse thing to publish than no number at all.

| case | probe | disposition | severity | where | reproduces at | note |
| --- | --- | --- | --- | --- | --- | --- |
| the button works and no count appears anywhere | `broken` | `handled` | — | `votes.ts:15` | `/roadmap/` | E204 · `VOTES_LIVE = false`. The vote is remembered locally and the board says so in a note (`roadmap.astro:127-132`, `board.ts:139`). |
| a shipped item still offers you a vote | `empty` | `defect` | medium | — | `/roadmap/` | E218 · The spec says shipped items do not vote (`support-portal/specs/support-portal/spec.md:32`); `RequestCard.astro:135-148` renders the button for every status without exception. See X4. |
| the same request carries a vote button on three different screens | `cross-step` | `defect` | low | — | `/roadmap/` | E216 · `wireBoard()` runs on the landing, the board and the detail page (`LandingBody.astro:387-396`, `roadmap.astro:314-317`, `[slug].astro:150-153`) and the vote is keyed by slug, so the three agree — but calling it twice on one page would double-toggle and nothing prevents it (`board.ts:147-160`). |
| nothing stops you voting for all 27 | `limit` | `decide` | low | — | `/roadmap/` | E217 · No per-person cap, no ranking, no "you have five votes". |

##### Vote from the detail page — `/roadmap/two-way-sync/`

The same control, the same gate. A request's own page and its card must never disagree about whether voting is possible.

| case | probe | disposition | severity | where | reproduces at | note |
| --- | --- | --- | --- | --- | --- | --- |
| the vote button once died silently on nine detail pages | `broken` | `handled` | — | `board.ts:19-27` | `/roadmap/two-way-sync/` | E208 · A repaired defect: an early return on a missing `[data-board]` disabled it. Filtering is now conditional and voting unconditional. |
| you misclick and can take it back | `partial` | `handled` | — | `votes.ts:52-69` | `/roadmap/two-way-sync/` | E207 · A repaired defect: the first board wrote the vote once and returned early ever after, so a misclick was permanent. |

##### Say who you are — not built

One vote per email. The email step is a privacy safeguard as much as a de-duplicator, and it is the fork where an anonymous board becomes an identified one.

| case | probe | disposition | severity | where | reproduces at | note |
| --- | --- | --- | --- | --- | --- | --- |
| the first vote of a session asks for an email | `identity` | `handled` | — | `board.ts:167-213` | `/roadmap/` | E205 · A real `<dialog>`, so focus containment, Escape and the backdrop come from the platform rather than from us. |
| it promises to tell you when this moves, and nothing is recorded anywhere | `identity` | `defect` | high | — | `/roadmap/` | E209 · `board.ts:176-185`. Unlike `/contact` and the page-rating widget, this dialog carries no "nothing is sent" note — the address goes to `localStorage` (`votes.ts:72-79`) and is read by nothing except the contact form’s pre-fill (`submit.ts:385`). See X2 and X9. |
| the address is asked once and reused forever, with no way to see or change it | `identity` | `defect` | medium | — | `/roadmap/` | E210 · `votes.ts:71-79` — `readVoteEmail` and nothing else. |
| Escape or Cancel casts no vote, including the click that opened the dialog | `exit` | `handled` | — | `board.ts:190-209` | `/roadmap/` | E211 · Resolves `null` and unwinds cleanly. |
| Escape out of this dialog also closes the chat behind it | `exit` | `defect` | medium | — | `/roadmap/` | E212 · `chat-panel.ts:169-182` has no guard for an open `<dialog>`. The vote-dialog face of E50. See X7. |
| an invalid address keeps the dialog open and keeps what you typed | `broken` | `handled` | — | `board.ts:172-175` | `/roadmap/` | E213 · A named error rather than a native bubble, which is why the form is `novalidate` (`board.ts:194-204`). |

##### Voted — not built

What a voted card looks like once counts are live, and what it says on a second visit from the same person.

| case | probe | disposition | severity | where | reproduces at | note |
| --- | --- | --- | --- | --- | --- | --- |
| withdrawing a vote needs no address | `identity` | `handled` | — | `board.ts:150-155` | `/roadmap/` | E206 · Asking again to take a vote back would be a toll on changing your mind. |
| your browser refuses to remember the vote | `broken` | `handled` | — | `votes.ts:63-67` | `/roadmap/` | E214 · The toggle still paints for the session and the write is swallowed. |
| the day counting goes live, a browser holding twelve local votes paints twelve as cast | `stale` | `decide` | medium | — | — | E215 · `votes.ts:39-50` — local votes never expire and are never reconciled with a server. See D16. |

### The header

#### Find my own things, or sign in

`find-my-own-things-in-the-header` · built · states · 6 edge states

> A reader wants the one thing on this site that is theirs rather than the site’s: the requests they have written. It is behind their own name in the top right, together with the address they are signed in as and the light-or-dark choice. Signed out, the same corner is a way in.

**Flow note.** The name is Dana Keller because `data/tickets.ts` prints her messages as “You:” on `/requests/`, so she is the reader. `data/viewer.ts` asserts that against the fixture at build time: rename the customer there and the build stops rather than putting one person’s name over another’s messages.

**Renders it.** `apps/support/src/components/SessionControl.astro` · `apps/support/src/components/ThemeToggle.astro` · `apps/support/src/lib/account-menu.ts` · `apps/support/src/lib/theme-toggle.ts` · `apps/support/src/data/viewer.ts`

##### Signed in — `/start/what-baseout-is/?session=in`

The name in the top right is a button. It opens a panel holding three things: `My requests`, the address you are signed in as, and the theme. Nothing else, because there is nothing else that belongs to you here.

| case | probe | disposition | severity | where | reproduces at | note |
| --- | --- | --- | --- | --- | --- | --- |
| the panel opens underneath the page-contents card and looks half-drawn | `cross-step` | `handled` | — | `src/styles/support.css · html[data-account-open] .header` | `/start/what-baseout-is/?session=in` | E269 · The header is `--sl-z-index-navbar` (10) and `.right-sidebar-container` is 30, so a `z-index` on the panel competes only INSIDE the header and can never beat a 30 outside it. Measured: the panel painted at 1196,54 with every row correct and the contents card over the top of it. Fixed by raising the header to 40 for the lifetime of one open panel, rather than editing the ladder — `--sl-z-index-skiplink` (20) sits between the two numbers, so a permanent raise would also put the header over the skip link. |
| pressing a row in the panel does nothing, because the panel closed under the finger | `cross-step` | `handled` | — | `src/lib/account-menu.ts · pop.addEventListener('mousedown')` | `/start/what-baseout-is/?session=in` | E270 · A panel that closes on `focusout` destroys itself BETWEEN mousedown and mouseup: the press moves focus to `<body>`, the panel hides, and there is nothing left under the pointer to receive the mouseup. `preventDefault` on mousedown holds the focus. THE TEST IS THE TRAP: a synthetic `.click()` moves no focus and passes on the broken code, so this is only provable with a trusted click. The same failure is written up on the platform picker. |
| Escape closes the panel and the search dialog behind it at the same time | `cross-step` | `handled` | — | `src/lib/account-menu.ts · keydown, stopPropagation` | `/start/what-baseout-is/?session=in` | E271 · The search dialog and the chat drawer both listen for Escape on `document`. Handled on the menu and stopped from travelling, the same shape `platform-picker.ts` already uses. |
| there is no way to sign out | `exit` | `decide` | low | — | — | E272 · Deliberate, not missing. The portal shares the app’s session, so there is nothing here to end, and the URL that would end it lives in a product this repo does not contain. Inventing `app.baseout.com/logout` would be inventing product surface to make a menu look complete. One line when the address is known. |

##### Signed out — `/start/what-baseout-is/?session=out`

No name, no panel. The corner is the theme control and a `Sign in` button, which carries `returnTo` so signing in lands you back on the page you were reading.

| case | probe | disposition | severity | where | reproduces at | note |
| --- | --- | --- | --- | --- | --- | --- |
| the theme control is in the header here and inside the panel when signed in | `identity` | `decide` | low | — | `/start/what-baseout-is/?session=out` | E273 · The one inconsistency in this corner, and it is forced. Dan asked for a BUTTON when signed out, so the signed-out state has no panel to hold the theme, and a theme control that only existed for people with accounts would be worse than one that moves. `apps/web` never faces this because it has no signed-out state. |
| nothing tells a signed-out visitor that a requests area exists | `entry` | `decide` | low | — | `/start/what-baseout-is/?session=out` | E274 · The price of moving `My requests` out of the nav row on 2026-08-25. Nothing is lost functionally: the page was behind sign-in anyway and the button beside this leads to the same place. What is lost is the discovery, and what partly covers it is that `/contact/` links the case after a submission and the acknowledgement email carries it too. |

### Tickets

#### See my requests

`see-my-requests` · built · states · 15 edge states

> Somebody opens the list of everything they have ever sent us and sees where each one stands.

**Flow note.** BUILT 2026-08-21, and the registry called it planned for most of that day — which is the failure mode this page exists to prevent. The remaining rows are the identity questions (D12), not the surface. Note the default flip: `session` now defaults to `in` (`portal-session.ts:32`), so a bare `/requests/` is the SIGNED-IN list and `?session=out` is the locked state. Three comment blocks still claim the opposite and are wrong: `tickets-view.ts:13-15`, `ticket-case.ts:43-44`, `requests/index.astro:21-22`.

**Renders it.** `apps/support/src/pages/requests/index.astro` · `apps/support/src/lib/portal-session.ts` · `apps/support/src/lib/tickets-view.ts` · `apps/support/src/lib/ticket-status.ts` · `apps/support/src/components/TicketRow.astro` · `apps/support/src/components/LockedCapability.astro` · `apps/support/src/data/tickets.ts`

##### Signed out — `/requests/?session=out`

The list is keyed to an email address, so with no session it shows none rather than somebody else's. `LockedCapability` states what the page does and why it is closed, and the way back to `/contact/` is on it.

| case | probe | disposition | severity | where | reproduces at | note |
| --- | --- | --- | --- | --- | --- | --- |
| a signed-in list cannot exist in a static build at all | `static-build` | `handled` | — | `requests/index.astro:73` | `/requests/?session=out` | E244 · Answered by building it: both halves are in ONE static render and `lib/portal-session.ts:32` selects between them from `?session`. No adapter, no `output: 'server'`, no second origin — which also means the prerendered case pages are readable by anyone holding the URL (E259). |
| an email link lands on a case while you are signed out | `entry` | `handled` | — | `requests/[ref].astro:61` | `/requests/BO-7QX9-K4TD/?session=out` | E241 · The locked case carries `returnTo=…/requests/BO-7QX9-K4TD`, so sign-in returns to THAT case and not to the list. This is the row that E108 said `returnTo` could not do; on this surface it now does. |
| you sign in with a different address from the one that filed | `identity` | `decide` | — | — | `/requests/?session=out` | E237 · The locked panel now states the rule once — "A request is keyed to an email address" — which is half the recommendation. What is still undecided is what the SIGNED-IN list says when a case is missing for that reason, because there is nowhere to say it. |
| the case you filed anonymously, with the same address | `identity` | `decide` | — | — | — | E236 · `contact.astro:568-573` still promises the merge in writing and still points at `app.baseout.com`, not at `/requests/`. Recommendation: merge on a verified address at sign-in and show a one-time note naming what was adopted. See D12. |
| two people in one organization | `identity` | `decide` | — | — | — | E238 · Recommendation: v1 is strictly per address. Zendesk’s organization view is a later axis. |
| the session expires while the list is open | `broken` | `decide` | — | — | — | E240 · Recommendation: re-auth in place; never drop the reader on the marketing site. `portal-session.ts:13-18` reads the session from the URL on every load and persists nothing, so there is no expiry to model yet. |
| the address people already type is a redirect to a form | `entry` | `defect` | medium | — | `/tickets` | E242 · `astro.config.mjs:22` still sends `/tickets` to `/contact`, and that was the honest answer only while no list existed. The list exists. Re-point it at `/requests/` and drop `tickets` from `search-modal.ts:57` NOT_DOCS in the same edit, or the one surface a reader guesses at stays hidden from search. |

##### The list — `/requests/`

The signed-in default — `session` defaults to `in` (`portal-session.ts:32`), so the bare URL is the list. Most recently active first, never by creation date, and each row says where it stands and when it last moved.

| case | probe | disposition | severity | where | reproduces at | note |
| --- | --- | --- | --- | --- | --- | --- |
| forty cases | `many` | `handled` | — | `ticket-status.ts:123-133` | `/requests/` | E233 · Tabs Open / Closed / All with counts, sorted by `lastActivityAt` descending (`data/tickets.ts:451-452`). Counts are recomputed from the rows actually present rather than trusted from the markup (`tickets-view.ts:72-80`), so they cannot disagree with what is on screen. |
| a 200-character subject in a dense row | `long` | `handled` | — | `TicketRow.astro:152` | `/requests/` | E234 · `-webkit-line-clamp: 2`. The walk recommended one line; two shipped, because the row carries the object beside the subject and a single line clipped the distinguishing half of the two Space-scoped cases. |
| a case with attachments | `partial` | `handled` | — | `TicketRow.astro:81-85` | `/requests/` | E235 · Paperclip plus a count, summed across every message on the case (`TicketRow.astro:54`). `BO-4K2M-P8RV` is the row with two. Filenames are on the detail as chips, not in a hover — the portal carries no tooltip primitive. |
| the case you just filed is not in the list yet | `stale` | `handled` | — | `requests/index.astro:163-166` | `/requests/` | E239 · The footnote under the list: "A request you have just sent may not be listed yet. The acknowledgement email is the receipt until it is." A caveat, not a duration promise — which is what stops a support request about the support request. |
| the row says what the case is ABOUT, not just what it is called | `platform-count` | `handled` | — | `TicketRow.astro:73-79` | `/requests/` | E243 · `about` renders as a glyph plus a label on the row and again on the detail rail. `BO-7QX9-K4TD` carries Space Ops and `BO-1RB8-N7EK` Space Finance. The run id is not carried yet — nothing in the fixture has one. |
| exactly one case | `one` | `decide` | — | — | `/requests/` | E232 · The build took the other side: the tab row is unconditional, so a person with one case sees `Open 1 · Closed 0 · All 1`. Defensible, and it is a decision rather than an oversight — decide whether the row hides below a threshold, or stays because a disappearing control is worse than an idle one. |

##### Open — `/requests/?session=in&tab=open`

The default tab. `open` means `status !== 'closed'`, so **Awaiting your reply** lives here too — a case waiting on the customer is not a finished case (`ticket-status.ts:132-133`).

##### Closed — `/requests/?session=in&tab=closed`

One row today, `BO-1RB8-N7EK`. Closed is a state and not a deletion, which is what makes `reopen-something-closed` possible at all.

| case | probe | disposition | severity | where | reproduces at | note |
| --- | --- | --- | --- | --- | --- | --- |
| you have cases, but not in the tab you are looking at | `empty` | `defect` | medium | — | `/requests/?session=in&tab=closed` | E231 · The per-tab empty states WERE built — `.rq-empty-open` and `.rq-empty-closed` (`requests/index.astro:131-149`) carry their own sentences — and with the shipped fixture no URL reaches either one: Open holds 4 rows, Closed 1, All 5, so `shown` is never 0 while the population is `some`. `?tickets=none` wins over the lane branch (`tickets-view.ts:100`), so even the declared `…&tickets=none&tab=closed` paints the NEVER state. Two states that exist in the CSS and in no reachable render. |

##### All — `/requests/?session=in&tab=all`

Five cases, one of each thing the row has to survive: a Space-scoped fault, an out-of-office, two attachments, an unverified sender, and a closed case.

##### Never written in — `/requests/?session=in&tickets=none`

The state most customers are in, and it offers the doors rather than apologising: a mark, one factual sentence, and two exits — the documentation and `/contact/`.

| case | probe | disposition | severity | where | reproduces at | note |
| --- | --- | --- | --- | --- | --- | --- |
| you have never written in | `empty` | `handled` | — | `requests/index.astro:150-161` | `/requests/?session=in&tickets=none` | E230 · "You have not written yet. The documentation and the chat answer most questions without a request — and when they do not, a request keeps the whole thread in one place." Two exits shipped where the walk recommended one; the second is the docs, which is free and already built, so it is not a competing call to action. |

#### Read and answer a thread

`read-and-answer-a-thread` · built · sequence · 14 edge states

> Somebody reads the conversation on one of their cases and answers it.

**Flow note.** BUILT 2026-08-21 as its own ROUTE, not as a state of an existing one — the third mechanism in design.md §5. Every reply is faked and the page says so in its own footer ("Preview: nothing on this page is sent, and any change you make here resets on reload"), which is why the send-side rows read `handled` on the words and not on the delivery.

**Renders it.** `apps/support/src/pages/requests/[ref].astro` · `apps/support/src/lib/ticket-case.ts` · `apps/support/src/lib/ticket-status.ts` · `apps/support/src/lib/ticket-time.ts` · `apps/support/src/components/TicketMessage.astro` · `apps/support/src/components/TicketComposer.astro` · `apps/support/src/components/FileChip.astro` · `apps/support/src/data/tickets.ts`

##### Open a case — `/requests/BO-7QX9-K4TD/`

The whole exchange in order, ours and theirs, with the attachments where they were sent. The rail beside it carries the copyable reference, when it was created, when it last moved and which Space it is about.

| case | probe | disposition | severity | where | reproduces at | note |
| --- | --- | --- | --- | --- | --- | --- |
| one reply, and you can tell at a glance who wrote it | `one` | `handled` | — | `TicketMessage.astro:23,71` | `/requests/BO-7QX9-K4TD/` | E246 · Sender by label, alignment and a quiet plate. NO avatars, no gradients, no tails — the product’s own `pattern-schema-chat` ruling transferred verbatim, as recommended. |
| the reply carries no agent name | `identity` | `handled` | — | `TicketMessage.astro:71` | `/requests/BO-7QX9-K4TD/` | E249 · `senderName === null` on our side renders `Baseout Support` in the worded-absence register, never a fabricated first name — the same rule that made `DataComments` print "Author not captured". |
| a pasted stack trace, or five thousand words | `long` | `handled` | — | `TicketMessage.astro:116-123` | `/requests/BO-7QX9-K4TD/` | E248 · A `<details>` reading `Show quoted text · N lines`, and N is DERIVED from the text rather than declared beside it. The quote is not stripped: there is no standard for quote markers, so a stripper tuned on Gmail over-strips on Outlook and eats the sentence the customer typed underneath. |
| a case with no reply yet | `empty` | `handled` | — | `ticket-status.ts:63-98` | `/requests/BO-2H5T-W3LC/?session=in` | E245 · One message, status `Open`, hint "With us. Nothing is needed from you." No SLA and no response-time estimate of any kind, which was bound. |
| two cases about two different Spaces | `many` | `handled` | — | `requests/[ref].astro:109-140` | `/requests/BO-1RB8-N7EK/?session=in` | E261 · The rail carries a short copyable reference, created, last activity and the Space. `BO-7QX9-K4TD` is Ops and `BO-1RB8-N7EK` is Finance, which is the pair this row was written against. |
| a deep link to a case that is not yours | `entry` | `defect` | medium | — | `/requests/BO-9DN4-QZ6B/?session=in` | E259 · A static build prerenders every case from `getStaticPaths`, so all five HTML files are served to anybody holding the URL and `?session=in` is a query parameter, not a credential. There is no ownership check to return a 404 with. Accepted for a fixture-backed preview and NOT accepted the day a real case sits behind one of these paths — the row is here so that day is not a surprise. See D17. |
| a case filed anonymously, then adopted, then read | `identity` | `decide` | — | — | `/requests/BO-9DN4-QZ6B/?session=in` | E258 · `BO-9DN4-QZ6B` is the unauthenticated case and its first message carries an `Unverified sender` mark (`TicketMessage.astro:102`), so the thread does show the original message rather than starting at adoption. What is undecided is the adoption EVENT: nothing marks where it happened. See D12. |
| a thirty-message thread | `many` | `decide` | — | — | — | E247 · Newest last and a composer at the foot shipped; the fixture tops out at three messages, so neither a sticky composer nor jump-to-latest has been designed against a thread long enough to need one. |

##### Reply — `/requests/BO-2H5T-W3LC/?session=in`

A reply box that is a reply box, not a new-ticket form wearing a different heading. Nothing is sent — the composer says so in its own failure text rather than in a banner somewhere else.

| case | probe | disposition | severity | where | reproduces at | note |
| --- | --- | --- | --- | --- | --- | --- |
| send fails | `broken` | `handled` | — | `ticket-case.ts:84-106` | `/requests/BO-2H5T-W3LC/?session=in` | E255 · The draft is deliberately NOT cleared on failure: "Nothing was sent — this portal has no mail behind it yet. Your reply is still in the field." A support thread is the last surface allowed to lose a person’s words. See X1. |
| the form itself is broken | `broken` | `decide` | low | — | `/requests/BO-2H5T-W3LC/?session=in` | E256 · Half of the recommendation shipped: the failure names the email route ("Replying to the email we sent about this request reaches the same case") and the reference has a copy button (`data-copy-ref`). The address itself is neither printed nor copyable, so the escape is a description of a route rather than the route. |
| support closed the case while you were typing | `stale` | `decide` | — | — | — | E253 · Recommendation: reconcile at send — accept the reply and reopen, rather than refusing it. The local half of this is built (E251); the half where the state changed on OUR side mid-compose has no server to change it. |
| a reply arrived since you loaded the page, or you have two tabs open | `stale` | `decide` | — | — | — | E254 · Recommendation: refresh at the decision point, not only on load. |

##### Attach something else — `/requests/BO-4K2M-P8RV/?session=in`

The same rules the contact form states, stated again before the picker rather than after the failure — which is what stops the two surfaces drifting.

| case | probe | disposition | severity | where | reproduces at | note |
| --- | --- | --- | --- | --- | --- | --- |
| attachments on a reply | `limit` | `handled` | — | `TicketComposer.astro:60-63` | `/requests/BO-4K2M-P8RV/?session=in` | E257 · "PNG, JPG, GIF, WebP or PDF · up to 10 MB each · 5 files" — the same 5 × 10 MB rule as `/contact` (`submit.ts:78-79`), printed before the picker as recommended. The constants are still declared twice, and that is the drift risk this row keeps open. |

##### Waiting on us · waiting on you — `/requests/BO-7QX9-K4TD/?session=in`

The one status a customer actually wants: whose turn it is. `BO-7QX9-K4TD` is the case that is waiting on THEM.

| case | probe | disposition | severity | where | reproduces at | note |
| --- | --- | --- | --- | --- | --- | --- |
| the case is waiting on you | `partial` | `handled` | — | `ticket-status.ts:63-98` | `/requests/BO-7QX9-K4TD/?session=in` | E250 · `pending` renders as **Awaiting your reply** with the hint "We have replied and are waiting on you." It is the only one of the three with a task on it, and the only one that takes `warning`; `Open` and `Closed` are both stated in the neutral register. |

#### Reopen something closed

`reopen-something-closed` · built · sequence · 3 edge states

> Somebody whose problem came back reopens the closed case instead of starting a new one.

**Flow note.** BUILT 2026-08-21. Every row on this flow closed in one edit, because reopen turned out to be one state transition rather than a feature — which is what D18 predicted and the reason it was worth deciding before building.

**Renders it.** `apps/support/src/pages/requests/[ref].astro` · `apps/support/src/lib/ticket-case.ts` · `apps/support/src/components/TicketComposer.astro`

##### A closed case — `/requests/BO-1RB8-N7EK/?session=in`

Closed is a state, not a deletion. The thread stays readable and the composer stays under it, which is what makes the next step possible at all.

| case | probe | disposition | severity | where | reproduces at | note |
| --- | --- | --- | --- | --- | --- | --- |
| you solved it yourself | `cross-step` | `handled` | — | `ticket-case.ts:58-62` | `/requests/BO-2H5T-W3LC/?session=in` | E252 · `Close this request` sits in the rail of any case that is not already closed, so nobody has to write "nvm, fixed it". On a closed case the whole action row is hidden (`requests/[ref].astro:362-364`) rather than shown disabled. |

##### It happened again — `/requests/BO-1RB8-N7EK/?session=in`

Reopening rather than filing a second ticket. The composer IS the reopen control: the button reads `Send and reopen` and the line above it says so before you type.

| case | probe | disposition | severity | where | reproduces at | note |
| --- | --- | --- | --- | --- | --- | --- |
| you reply to a case that is closed | `cross-step` | `handled` | — | `ticket-case.ts:84-106` | `/requests/BO-1RB8-N7EK/?session=in` | E251 · The Plain / Help Scout model, as recommended: the composer stays, replying reopens, and the thread says it inline — "This request is closed. Sending a reply reopens it." One state transition and no follow-up-ticket entity. The status flips BEFORE the (faked) send resolves, so the reopen is visible even though nothing is delivered. See D18. |
| you closed it and now want it back | `exit` | `handled` | — | `TicketComposer.astro` | `/requests/BO-1RB8-N7EK/?session=in` | E260 · Reopen is the same action as replying and there is no separate control — exactly the recommendation. The submit button carries both labels, `Send` and `Send and reopen`, and CSS picks between them by `data-case-closed`. |

##### Or file it as new — `/contact/?kind=ticket`

Still reachable, and no longer the only route. It throws the history away, which is now a choice the reader makes rather than the only thing the portal offers.

## Cross-cutting frictions

### X1 · work is destroyed with no draft, no warning and no history

**Severity.** high · **Appears in.** file-a-ticket-while-signed-out · submit-a-public-feature-request · hit-a-duplicate-while-submitting-a-request · ask-about-billing-sales-or-something-else · follow-up-on-a-case-i-filed · read-and-answer-a-thread

**Evidence.** `submit.ts:398-425` · `submit.ts:142-151` · `submit.ts:274` · `chat-core.ts:69-73`

**Fix.** Persist a draft per door under `bo-contact-draft:<kind>`, `pushState` per step, and open duplicate suggestions in a new tab. The pattern already exists in this codebase — the chat keeps its draft across navigation and reload — and it is not applied on the one surface where losing it costs the reader 600 words.

### X2 · the portal collects an identity it never uses, and promises things it cannot do with it

**Severity.** high · **Appears in.** file-a-ticket-while-signed-out · ask-about-billing-sales-or-something-else · submit-a-public-feature-request · vote-on-a-request · rate-a-documentation-page · follow-up-on-a-case-i-filed

**Evidence.** `votes.ts:72-79` · `submit.ts:416` · `submit.ts:385` · `board.ts:176-185` · `page-feedback.ts:47-53`

**Fix.** Give the vote dialog the same "nothing is sent" sentence the contact form and the page rating already carry, and make the pre-filled address visible and clearable. One identity currently leaks between two unrelated surfaces on a shared browser: the contact form silently READS the vote address and silently WRITES it back.

### X3 · every escalation loses its context at the boundary

**Severity.** high · **Appears in.** ask-the-ai-chat · run-out-of-free-messages · escalate-from-chat-to-a-person · file-a-ticket-while-signed-out · rate-a-documentation-page

**Evidence.** `chat-core.ts:196-198` · `ChatDock.astro:139` · `submit.ts:100-190` · `search-modal.ts:235-238`

**Fix.** One convention: every escalation link carries `?kind=` plus a prefill token, and the receiving surface says what it inherited. Search to chat already carries the query — that is the portal’s one working hand-off, and there are four broken ones beside it.

### X4 · counts and labels disagree with what clicking them shows

**Severity.** high · **Appears in.** browse-the-roadmap · vote-on-a-request · search-the-documentation

**Evidence.** `roadmap.astro:192-206` · `roadmap.astro:220-233` · `recent.ts:11` · `search-modal.ts:127` · `RequestCard.astro:135-148`

**Fix.** Compute every count from the same predicate that produces the rows, in one place. Each instance is a different bug and the class is one: a number or an affordance computed over a different set from the one it is drawn beside.

### X5 · the state arrives after paint, and only the landing pays for a fix

**Severity.** medium · **Appears in.** land-and-choose-a-platform · filter-the-documentation-to-my-platform · read-documentation · file-a-ticket-while-signed-out

**Evidence.** `LandingBody.astro:141-172` · `PlatformPicker.astro:126-129` · `submit.ts:183-185`

**Fix.** One shared pre-paint stamp in the head, or an explicit ruling that the reflow is accepted. UNVERIFIED — the flash has never been measured on either surface, and the mechanism is identical to the one the landing was fixed for.

### X6 · one filter, two meanings, one set of logos

**Severity.** medium · **Appears in.** filter-the-documentation-to-my-platform · land-on-a-page-my-own-filter-hides · read-documentation · search-the-documentation · browse-the-roadmap

**Evidence.** `PlatformPicker.astro:15-28` · `board.ts:58-63` · `roadmap.astro:211-217`

**Fix.** Keep the semantics and differentiate the control’s SHAPE everywhere — the roadmap already does — and say the rule once in the docs sidebar too. Both behaviours are argued and correct in isolation; to a reader they are the same three brand marks doing opposite things on adjacent pages, and only one of the two explains itself.

### X7 · the Escape stack is incomplete, so leaving one layer takes another with it

**Severity.** medium · **Appears in.** read-documentation · ask-the-ai-chat · vote-on-a-request · search-the-documentation

**Evidence.** `toc-collapse.ts:34-48` · `platform-picker.ts:281-286` · `chat-panel.ts:169-182`

**Fix.** Add `document.querySelector('dialog[open]')` to the chat’s guard, matching the pattern already used for the TOC popover and the platform picker. Three layers are guarded; the search dialog and the vote dialog are not.

### X8 · no duration is promised, and no ending is named either

**Severity.** medium · **Appears in.** file-a-ticket-while-signed-out · ask-about-billing-sales-or-something-else · follow-up-on-a-case-i-filed · escalate-from-chat-to-a-person

**Evidence.** `submit.ts:345-373` · `submit.ts:418-425`

**Fix.** The confirmation prints the address it will reply to, the fact that replying to that email adds to the case, and a case reference. The bound decision is honoured — no screen promises a time — but it asks for the channel, the address AND the event that ends the wait, and today only the channel is named.

### X9 · five surfaces admit that nothing is sent; the vote dialog and the chat do not

**Severity.** medium · **Appears in.** vote-on-a-request · ask-the-ai-chat · submit-a-public-feature-request

**Evidence.** `contact.astro:466-469` · `PageFeedback.astro:118-121` · `roadmap.astro:127-132` · `board.ts:178`

**Fix.** Given the demo ruling that there are no "not built yet" banners, the honest line is the one already in use on three surfaces: state the DESTINATION, not the readiness.

## Decisions to lock

### D1 · Does `/contact` get a pre-paint stamp for `?kind=`, matching the landing’s?

- Add an `is:inline` head script that hides the fork when `?kind=` is a known value
- Accept the flash

**Recommended.** The first. The mechanism already exists twenty lines away in `LandingBody.astro:141-172`, and `?kind=` is the parameter every outbound email will carry. Measure first — the flash is unverified.

### D2 · Where does `/tickets` point?

- Keep redirecting to `/contact` until the list ships
- Point it at a signed-out explainer now

**Recommended.** The second. Today the redirect answers "where is my case?" with a blank new-case form, which is the worst possible answer and the one the chat’s own old copy taught people to expect.

### D3 · Does the chat-to-contact escalation carry context?

- A link only
- The link plus the last question, the page and the platform scope, prefilled and labelled as inherited

**Recommended.** The second. Without it the chat is a dead end wearing a link, which the research already named the portal’s weakest join.

### D4 · Does `/contact` persist a draft and push history per step?

- Neither
- Both

**Recommended.** Both. One `localStorage` key per door and one `pushState` per step closes the highest-severity friction in the catalogue.

### D5 · Does the chat conversation ever end?

- Unbounded, as today
- A "New conversation" control plus a per-turn date and a log cap

**Recommended.** The second. An undated three-week-old transcript replaying on arrival is the state a reader reads as "this is broken".

### D6 · Does the fault-report door get deflection at the subject field, as the request door has?

- No
- Yes, querying `troubleshooting/*` from the same Pagefind index

**Recommended.** Yes. The corpus, the index and the query function all exist — `submit.ts:239-292` is one selector away from reuse — and the research calls it the highest-leverage thing on the whole ticket surface, at no auth cost.

### D7 · Does the landing directory show every platform’s pages, or only the reader’s?

- All, as today — "nothing is hidden by a choice"
- Narrow to the chosen platform

**Recommended.** All. The law is stated and argued at `LandingBody.astro:34-37`. But it needs a companion decision at five platforms — see D19.

### D8 · Does portal search cover requests as well as documentation?

- Docs only, as today
- Two result groups

**Recommended.** Docs only, with one change: the empty state should offer "search the roadmap" when the query matched request pages that were filtered out. The count is already computed one line away.

### D9 · Do the sixteen unwritten pages carry any signal?

- Nothing, as ruled
- Suppress the page-rating widget on them only

**Recommended.** Suppress the widget. Not a banner — the ruling stands. But asking "was this page helpful?" under "Not written yet" is the portal grading a reader for a page it did not write, and it is one predicate in `DocsFooter.astro:21-24`.

### D10 · Does duplicate detection need to see requests filed since the last deploy?

- Build-time index only
- A runtime request index

**Recommended.** Build-time for now, but say so: the confirmation should not imply a live board. Revisit when submissions are real.

### D11 · Does the billing door detect card numbers in the body?

- Copy warning only, as today
- A client-side Luhn check

**Recommended.** The check, as a WARNING and not a block. The existing warning is excellent, and warnings are ignored under stress. One line that says "that looks like a full card number — the last four are enough" prevents the one irreversible mistake on the page.

### D12 · How is an email proved?

- Not proved — anyone can file against any address (today)
- A magic-link confirmation before the case is created

**Recommended.** Confirm it for the ticket, billing and other doors; leave sales and the public request unproved. The bound decision makes the address the key to everything, and an unverified key is not a key.

### D13 · Who triages `Suggested`, and on what cadence?

- Unnamed
- A named person, a stated cadence, and a rule for when a row leaves the list

**Recommended.** Name them, before the board is public. `requests.ts:31-37` says "Do not ship it without one", and the catch-all door makes the same promise in copy — two surfaces are now committed to a process that has no owner.

### D14 · What does a submitter get to hold on to?

- A confirmation screen only (today)
- A case reference on screen, the reply address printed, and "reply to that email to add to this"

**Recommended.** The second. A reference is not a portal view and does not violate the no-six-digit-code ruling — it is what the reader quotes in the email thread.

### D15 · Does the board’s filter state live in the URL?

- No, as today
- `?status=` and `?platform=`, mirrored like the docs filter

**Recommended.** Mirror it. The docs filter already does, a filtered board is the thing people paste into Slack, and a refresh currently discards it.

### D16 · What happens to local votes when counting goes live?

- Trust the local record
- Reconcile against the server on first load and let the server win

**Recommended.** Let the server win. A browser with twelve local votes will otherwise paint twelve buttons as cast against a store that has none of them.

### D17 · Does `apps/support` stay a static build?

- Yes, and the ticket surfaces live in `apps/web` behind the existing session
- No, `apps/support` gains an adapter and a session

**Recommended.** Stay static. Every constraint in this catalogue exists because the portal is static, and the portal is better for it; the signed-in surfaces belong where a session already exists. The list is then a link from `/contact`, not a page of the portal.

### D18 · Does replying to a closed case reopen it?

- Yes, one state transition (Plain / Help Scout)
- No, a reply mints a follow-up case (Zendesk)

**Recommended.** Reopen. It needs no parent/child field in the data model, and it matches how the customer already thinks — continuing a conversation, not filing a sequel.

### D19 · At five platforms, does the roadmap scope control adopt `PlatformPicker`?

- Keep the hand-rolled row and add a breakpoint
- Extend `PlatformPicker` with a `scope` presentation and use it

**Recommended.** Use the picker. It already implements `mode="scope"` end to end and NOTHING IN THE TREE USES IT — the one surface it was written for still runs the hand-rolled control it was meant to replace.

### D20 · Does an id in `platforms.ts` mean "Baseout supports this", or "we hold a mark and a vocabulary for this"?

- Supported — then the Smartsheet and Monday candidates must be retagged and the "no mark because we do not ship it" convention rewritten
- Catalogued — then the docs filter, the board facet and the landing chooser each need a second predicate for SUPPORTED

**Recommended.** Catalogued, and say it in the type. `PlatformId` is doing two jobs; split it, or the board renders `Smartsheet 0` beside a Smartsheet candidate. This is the decision the five-platform column forces, and it is not a layout question.

### D21 · Do the six hand-written three-platform lists get derived, or asserted?

- Leave them and fix by hand each time
- Derive the CSS reveal rules and the pre-paint guard from `PLATFORM_IDS`, and assert the rest at build

**Recommended.** Derive and assert. Six surfaces drifted at once when a platform was added and five gates stayed green; only the one with an explicit `throw` caught it.
