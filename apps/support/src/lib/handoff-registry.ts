// ─────────────────────────────────────────────────────────────────────────────
// HANDOFF REGISTRY — every scenario a person can walk in the support portal.
//
// A SIBLING OF `apps/design/src/lib/flow-registry.ts`, copied rather than
// invented because that shape has survived two months of use: the client opens
// `/handoff` and walks a flow; the engineer opens the same rows and reads a
// traceability table. Three things a flat list of states cannot express, and all
// three are why this shape exists (`openspec/changes/support-handoff/design.md`
// §2):
//
//   1 · ORDER — "what does the person see next" is the question a client asks,
//       and a state index answers everything except that.
//   2 · COMPLETENESS — `3 of 5 steps live` is a number. A list of built states
//       has no denominator, so nothing on it can ever look unfinished.
//   3 · WHERE THE EDGES HANG — an edge case belongs to a STEP, not to a page.
//       "The email never arrives" belongs to the last step of one flow and
//       nowhere else.
//
// THE RULE: a state is DATA, not a duplicated screen. A row here plus a URL that
// produces the state — never a new `.astro` page per variant. And the
// consequence to hold onto: if a state cannot be reached by a URL it does not
// get a row, it gets fixed. A state nobody can link to is a state nobody can
// report a bug against.
//
// ── `href` IS THE WHOLE CONTRACT ─────────────────────────────────────────────
// Every non-null `href` below was checked against the file that renders it, and
// every one of them is requested by `.claude/hooks/smoke-support.mjs`. A row
// whose URL stops reproducing its state fails a gate instead of ageing quietly.
//
// ── THE CONSTRAINT THAT SHAPES EVERY URL ─────────────────────────────────────
// `apps/support` declares no `output` and no adapter, so it is a STATIC BUILD.
// A query parameter cannot change what the server rendered. Every parameter
// below is read by a CLIENT controller over one render:
//
//   (`?shots=reactive|filter` was here until 2026-08-21. The two-treatment
//    landing switch it pinned is deleted — `reactive` won — and with it
//    `lib/shot-switch.ts`. A parameter no controller reads is a URL that
//    reproduces nothing.)
//   ?cards=1…8               `lib/card-count.ts`          — landing only; REVIEW ONLY, caps or
//                                                            pads the platform strip so the layout
//                                                            at N platforms can be seen. Writes
//                                                            nothing, reaches nothing below the
//                                                            strip, and goes out with the decision
//   ?platform=<id[,id…]>     `lib/platforms.ts:307`       — any page whose
//                                                            controller reads
//                                                            the preference
//   ?kind=ticket|request|billing|sales|other
//                            `lib/submit.ts:191`          — /contact/ only
//   ?about=new-platform      `lib/submit.ts:195`          — /contact/ only
//   ?from=chat               `lib/submit.ts:196`          — /contact/ only; gates reading the
//                                                            chat handoff out of sessionStorage
//   ?session=in|out          `lib/portal-session.ts:32`   — /requests/ and /requests/<ref>/
//   ?tab=open|closed|all     `lib/tickets-view.ts:56`     — /requests/ only
//   ?tickets=some|none       `lib/tickets-view.ts:53-55`  — /requests/ only
//
// `session` DEFAULTS TO `in` (Oleh, 2026-08-21), which inverts what an older reading of this file
// would assume: a bare `/requests/` is the SIGNED-IN list, and `?session=out` is the locked state.
// Three comment blocks elsewhere still claim the opposite and are wrong — `tickets-view.ts:13-15`,
// `ticket-case.ts:43-44`, `requests/index.astro:21-22`.
//
// A state with NO parameter is a state reached by a keystroke or a click
// (the search modal, the chat drawer, the free-message budget). Those steps
// carry the URL of the page that HOLDS the affordance and say so in the caption
// — never a URL that does not do what the row claims.
//
// Consumed by: `apps/support/src/pages/handoff.astro` (renders the index) and
// `.claude/hooks/smoke-support.mjs` (requests every non-null href).
// ─────────────────────────────────────────────────────────────────────────────

export type HandoffStatus = 'built' | 'planned' | 'discussion';

/**
 * Which systematic probe surfaced an edge case. `platform-count` and
 * `static-build` are probes of their own HERE, because both are specific to
 * this portal: a query parameter cannot change server-rendered output, and
 * every step has a different shape at 1 platform than at 5.
 */
export type EdgeProbe =
  | 'empty' | 'one' | 'many' | 'long' | 'broken' | 'limit' | 'partial'
  | 'cross-step' | 'entry' | 'exit' | 'stale' | 'identity'
  | 'platform-count' | 'static-build';

/**
 * HOW BADLY IT BITES, not how hard it is to fix. `high` breaks the flow, `medium` is real friction,
 * `low` is polish. A `handled` row that has nothing left to do carries no severity at all — the
 * absence is the statement, and giving every row a colour would flatten the twenty-two that matter.
 */
export type EdgeSeverity = 'high' | 'medium' | 'low';

export interface EdgeCase {
  case: string;                  // in the user's terms
  probe: EdgeProbe;
  disposition: 'handled' | 'decide' | 'defect';
  where?: string;                // file:line when handled
  href?: string | null;          // the URL that reproduces it
  severity?: EdgeSeverity;
  note?: string;                 // opens with the enumeration id (E1…E268), then the evidence
}

export interface HandoffStep {
  label: string;
  href: string | null;           // null = not built
  caption: string;               // what to look at, in the client's terms
  edges?: EdgeCase[];
}

/** OpenSpec change · capability · scenario — the contract a flow realizes. */
export interface SpecRef {
  change: string;
  capability: string;
  scenario: string;
}

/**
 * WHETHER THE STEPS ARE A SEQUENCE IN TIME OR THE STATES OF ONE SCREEN.
 *
 * The distinction is the whole reason this field exists, and it changes how `/handoff` draws a
 * flow. `sequence` steps are ordered and numbered, because step 3 is only reachable by having done
 * step 2 — filing a ticket, escalating out of the chat, voting. `states` steps are alternative
 * renderings of ONE screen, reachable directly and in any order: signed-out · signed-in · Open ·
 * Closed · never-written-in. Numbering those is a lie about causation, and stacking them as
 * full-width cards buries the one fact a reader wants, which is that they exist TOGETHER.
 *
 * THE TEST, applied in that order:
 *   1 · does every non-null `href` resolve to the same pathname? If no → `sequence`.
 *   2 · does any step require the step before it to have happened? If yes → `sequence`.
 *   3 · otherwise → `states`.
 *
 * DEFAULT IS `sequence` when the field is absent, and that default is deliberate: drawing a real
 * sequence as an unordered chip row destroys information, while drawing a set of states as a
 * numbered list only wastes space. The cheaper mistake is the default.
 */
export type HandoffShape = 'sequence' | 'states';

export interface HandoffFlow {
  id: string;                    // canonical, identical in the spec tag and the row
  /* `header` is the eighth and it is the odd one: the other seven are places a reader goes, and
     this one is on every page of all of them. It is a surface rather than a friction (`X1…X9`)
     because a friction is a PROBLEM that recurs, and this is a CONTROL that exists — with its own
     two states, its own panel and its own edges, which is exactly the shape a flow has. */
  surface: 'landing' | 'docs' | 'search' | 'chat' | 'contact' | 'roadmap' | 'tickets' | 'header';
  label: string;
  /**
   * WHAT HAPPENS HERE, IN ONE SENTENCE AND IN THE READER'S OWN WORDS. It names a person and what
   * they are trying to do — never a file, a parameter or a component. It is the first of the three
   * things `/handoff` renders per flow (the other two are the states you can open and the plain
   * list of what is wrong), and it is REQUIRED so that a flow added without one fails a type gate
   * rather than rendering a heading with nothing under it.
   */
  summary: string;
  status: HandoffStatus;
  shape?: HandoffShape;          // absent = 'sequence'
  steps: HandoffStep[];
  specs?: SpecRef[];             // OpenSpec change · capability · scenario
  source?: string[];             // the files that render it
  note?: string;
}

export interface HandoffComparison {
  id: string;
  question: string;              // 'What changes as platforms scale'
  /**
   * WHAT THE FOUR ADDRESSES BELOW ACTUALLY DO TO THIS SURFACE, stated once and honestly — including
   * "nothing", which is the true answer on two of the four. It is REQUIRED so that a comparison
   * added without one fails a type gate rather than shipping four cards that imply a difference
   * nobody checked for.
   */
  finding: string;
  /**
   * `what` is one or two sentences saying what you would see at that URL and what is different
   * about it. A reader who cannot open a tab has to learn the difference from this alone, which is
   * the whole reason the live frames were removed (Oleh, 2026-08-21).
   */
  columns: { label: string; href: string; what: string }[];
}

/**
 * A FRICTION IS WHAT AN EDGE ROW CANNOT BE. Every `EdgeCase` above hangs off one step, because
 * "the email never arrives" belongs to one step of one flow and nowhere else. The nine below are
 * the opposite shape: each one is present in THREE OR MORE flows, so hanging it off a step would
 * either pick a winner arbitrarily or repeat the same row nine times and let it drift nine ways.
 *
 * `flows` carries flow ids rather than prose, so the page can link each one into the catalogue
 * below it — which is the whole reason this is data and not a paragraph.
 */
export interface HandoffFriction {
  id: string;                    // X1…X9
  title: string;                 // in the user's terms, same voice as `EdgeCase.case`
  severity: EdgeSeverity;
  flows: string[];               // HandoffFlow ids — three or more, or it is not cross-cutting
  evidence: string[];            // file:line
  fix: string;
}

/**
 * A DECISION IS A QUESTION WITH TWO NAMED ANSWERS AND A RECOMMENDATION. It is not a defect and not
 * an edge: nothing is wrong until somebody picks, and the point of writing it down is that the pick
 * is cheap now and expensive after the surface ships.
 */
export interface HandoffDecision {
  id: string;                    // D1…D21
  question: string;
  options: [string, string];
  recommendation: string;
}

/* ═══════════════════════════════════════════════════════════════════════════
   THE EDGE CASES ARE IN. 268 states (E1–E268) across twenty walked flows,
   folded in on 2026-08-21: 149 `handled` each carrying the `file:line` that
   answers it, 58 `decide`, 61 `defect`.

   RE-READ AGAINST THE SOURCE LATE ON 2026-08-21, after the ticket surfaces
   shipped. That re-read is the reason those numbers moved and it is worth
   saying why rather than just restating them: this file had all six ticket and
   escalation flows at `status: 'planned'` with null hrefs for most of the day
   the surfaces were BUILT. A handoff index whose job is to be current is worse
   than useless when it is a day stale, because the reader cannot tell which
   rows to trust. Twenty-one rows moved `decide` → `handled` against a real
   `file:line`, and three moved the other way — E231, E242 and E259 are defects
   that only EXIST because something shipped. Counts are computed by the page
   from this array, never written down twice; the ones above are prose and the
   page is the authority.

   HOW TO READ A ZERO NOW. It no longer means "not yet enumerated" — five steps
   carry no edges and each says why in its flow's `note`. Every row's `note`
   opens with its enumeration id, so a row here and a row in the walk are the
   same row and can be argued about by number.

   THE PLACEMENT RULE, which is the whole argument of design.md §3: an edge
   belongs to a STEP, not to a page. Where a state genuinely belongs to a whole
   flow it sits on the step where the reader FIRST MEETS IT and the note says so
   — the contact fork (E99–E110) is on `file-a-ticket-while-signed-out`, not
   repeated on every door that shares it.

   ONE ROW DEPARTS FROM THE WALK. E14 is recorded there as "handled for
   reactive, defect for filter"; it is one row here and it is a `defect`,
   because half a control that does nothing without JavaScript is not handled.

   NOT VERIFIED IN A BROWSER, and each says so in place: every claim about paint
   order and reflow (E17, E100, E189), the Escape interaction between the chat
   drawer and an open `<dialog>` (E50, E212), and all responsive geometry (E65,
   E267). The walk was produced from source only.
   ═══════════════════════════════════════════════════════════════════════════ */

export const HANDOFF_FLOWS: HandoffFlow[] = [
  // ── Landing ───────────────────────────────────────────────────────────────
  {
    id: 'land-and-choose-a-platform',
    surface: 'landing',
    label: 'Land and choose a platform',
    status: 'built',
    summary:
      'Somebody arrives knowing nothing about the portal, picks the tool they actually use, and everything after this point reads in their own vocabulary.',
    source: [
      'apps/support/src/content/docs/index.mdx',
      'apps/support/src/components/SupportHero.astro',
      'apps/support/src/components/landing/LandingBody.astro',
      'apps/support/src/components/PlatformStart.astro',
      'apps/support/src/lib/landing-strip.ts',
      'apps/support/src/components/PlatformPicker.astro',
    ],
    steps: [
      {
        label: 'Arrive',
        href: '/',
        caption:
          'The dark band, the one search-or-ask input, and the three-step path below it. Nothing has been chosen yet, so every noun in the path reads in ordinary English rather than in one vendor\'s words.',
        edges: [
          {
            case: 'the page you first see is not the variant you chose',
            probe: 'static-build',
            disposition: 'handled',
            where: 'LandingBody.astro:162-215',
            href: '/',
            note:
              'E1 · An inline pre-paint script stamps `data-bo-platform` on `<html>` before the strip is parsed, so the correction lands before paint rather than after it. This is the only surface in the portal that pays for that fix. Its variant half (`data-shots`) went with the `filter` treatment on 2026-08-21; the attribute was renamed off the dead switch\'s vocabulary in the same pass.',
          },
          {
            case:
              'renaming one storage key would flash the wrong variant forever, and nothing would say so',
            probe: 'static-build',
            disposition: 'decide',
            href: null,
            severity: 'medium',
            note:
              'E2 · The pre-paint script duplicates `bo-platforms` verbatim, because an inline script cannot import. `LandingBody.astro` admits it; no gate catches the drift. Accept it, or add an assert. See D21. Halved on 2026-08-21: it used to duplicate `bo-landing-shots` too, and that key is gone.',
          },
          {
            case: 'you arrive from a search engine having chosen nothing',
            probe: 'entry',
            disposition: 'handled',
            where: 'PlatformStart.astro:10-12',
            href: '/',
            note: 'E3 · Full page, chooser at the top, nothing hidden behind a preference nobody set.',
          },
          {
            case: 'you search the portal for its own home page and never find it',
            probe: 'entry',
            disposition: 'handled',
            where: 'SupportLanding.astro:19',
            href: null,
            note:
              'E15 · The landing carries `data-pagefind-ignore` on purpose: a search result that lands you back on the home page is a result that failed. No URL reproduces a search, so this row carries none.',
          },
          {
            case: 'you press Cmd-K on the one page whose header hides the search pair',
            probe: 'identity',
            disposition: 'handled',
            where: 'Search.astro:88-91',
            href: '/',
            note:
              'E16 · The hero carries its own field, so the header pair is hidden here — and the search `<dialog>` is moved to `<body>` at hydration or the shortcut would be dead on the most likely first page.',
          },
        ],
      },
      {
        label: 'Say which platforms you work in',
        href: '/?platform=airtable,notion',
        caption:
          'The shared `PlatformPicker`, in the hero, directly above the search field it scopes. Oleh, 2026-08-21: the reader sees the search bar and must SEE the options for where they back up, rather than meet them hidden inside the modal. It writes the one `bo-platforms` preference, so the sidebar, the search modal, the chat and the directory below all follow — and this URL is that state, two platforms at once, which is the thing the deleted `filter` cards could not express.',
        edges: [
          {
            case: 'you tick two platforms and the three steps go back to ordinary English',
            probe: 'partial',
            disposition: 'handled',
            where: 'landing-strip.ts:41-43',
            href: '/?platform=airtable,clickup',
            note:
              'E37b · The same rule as E37 and reachable from the page now rather than only from a link: the strip re-labels at exactly one platform, because "which Bases or Spaces to back up" is not a sentence. The DIRECTORY still adds both platforms\' sub-blocks, so two ticks is never a state that shows less than one.',
          },
          {
            case: 'you press None and expect the documentation to empty out',
            probe: 'empty',
            disposition: 'handled',
            where: 'PlatformPicker.astro:33-44',
            href: '/',
            note:
              'E38b · Nothing ticked is nothing narrowed, which is what a checkbox filter means everywhere else; the trigger reads `All platforms` at both ends because both ends are the same view. The landing never subtracts in any case.',
          },
          {
            case: 'the same control is on the page and inside the search dialog on top of it',
            probe: 'cross-step',
            disposition: 'handled',
            where: 'Search.astro:63-92',
            href: '/',
            note:
              'E39b · One stored value, two places, never both reachable: the dialog is in the top layer, so the hero control is behind its backdrop while it is open. Suppressing the modal\'s copy would leave the reader in front of a search whose scope is stated nowhere — the exact defect the hero control was added to fix.',
          },
          {
            case: 'a first paint that shows every platform ticked when the reader had narrowed',
            probe: 'stale',
            disposition: 'decide',
            where: 'PlatformPicker.astro:175-186',
            href: null,
            severity: 'low',
            note:
              'E40b · Static build: the markup ships with everything on and the controller corrects it at hydration. Harmless for the TICKS (all-on and none-on are the same view) but the trigger\'s marks do appear. The landing pays for a pre-paint stamp already; whether this control joins it is open. UNVERIFIED — never measured in a browser.',
          },
        ],
      },
      {
        label: 'A card is a door',
        href: '/',
        caption:
          'The strip below the hero, and since 2026-08-21 the only landing there is. Clicking a platform card narrows the site-wide preference to that platform and takes the reader into its documentation. The second treatment — the same cards as in-place selectors — is deleted: Dan, on the live portal, said it will not work at three-plus platforms, and the measured reason is that it was a single-select control writing a multi-select preference, so the front page could state less than every other surface of the portal.',
        edges: [
          {
            case: 'with JavaScript off, a platform card does nothing at all',
            probe: 'broken',
            disposition: 'handled',
            where: 'platform-start.ts:33-48',
            href: '/',
            note:
              'E14 · No longer split. Every card is a real `<a href>`, so it navigates with the script blocked, opens in a new tab on a middle click and shows its target in the status bar; the handler only writes the preference on the way out. The `filter` treatment\'s `<button>` cards — inert without a script, and with no way out of whichever variant the stylesheet defaulted to — are deleted.',
          },
          {
            case: 'you chose a variant last week and the switch has since been deleted',
            probe: 'stale',
            disposition: 'handled',
            href: null,
            severity: 'low',
            note:
              'E5 · HAPPENED, 2026-08-21, exactly as written. `bo-landing-shots` is now orphaned garbage in the localStorage of everyone who touched the switch, nothing reads it, and nothing breaks. Not cleaned up deliberately: a one-shot deletion script would be more code, shipped to every visitor forever, than the string it removes.',
          },
          {
            case: 'a real visitor finds an unexplained Reactive / Filter toggle floating over the page',
            probe: 'exit',
            disposition: 'handled',
            href: '/',
            severity: 'medium',
            note:
              'E6 · RESOLVED 2026-08-21 by deletion rather than by decision. `ShotSwitch.astro` and `lib/shot-switch.ts` are gone, so the portal can go public without the question being answered. `?cards=` is now the only review parameter left on this page, and it is invisible to anyone who does not type it.',
          },
          {
            case: 'the way back to all platforms left with the variant that carried it',
            probe: 'cross-step',
            disposition: 'handled',
            where: 'PlatformPicker.astro:33-44',
            href: '/',
            note:
              'E36 · The `Show all three` control lived in the deleted variant\'s foot. Widening is now the picker\'s own `All` button — reachable from the hero here and from the sidebar on every documentation page, rather than from this one block. A card still does not deselect on a second press: it is a link, and it never did.',
          },
        ],
      },
      {
        label: 'The path in your own words',
        href: '/?platform=notion',
        caption:
          'Arriving with the choice already made — the state a reader is in on their second visit, or after a colleague sent them a link. Base becomes Teamspace, Record becomes Page, and step one points at Notion\'s own connecting page.',
        edges: [
          {
            case:
              'at five platforms the vocabulary cards stack four deep in one frame; at one there are none',
            probe: 'platform-count',
            disposition: 'defect',
            href: '/?platform=notion',
            severity: 'medium',
            note:
              'E9 · `GLOSSARY_PLATFORMS` is `PLATFORMS.filter(id !== \'airtable\')` (`LandingBody.astro:127`), so at one platform the step frames lose their vocabulary entirely and at five they gain four each. Neither end is handled.',
          },
          {
            case: 'you choose ClickUp and the screenshot above the words is still Airtable',
            probe: 'broken',
            disposition: 'handled',
            where: 'landing-steps.ts:147-154',
            href: '/?platform=notion',
            severity: 'medium',
            note:
              'E10 · Argued rather than fixed: the three product shots have Airtable nouns baked into the pixels, and the mitigation is the glossary card beside the shot, not a replacement image.',
          },
          {
            case: 'you pick two platforms and the path reads exactly as if you had picked none',
            probe: 'partial',
            disposition: 'handled',
            where: 'landing-strip.ts:41-43',
            href: '/?platform=airtable,clickup',
            note:
              'E37 · Deliberate — "which Bases or Spaces" is not a sentence, so the strip re-labels only at exactly one.',
          },
          {
            case: 'a Smartsheet or Monday reader gets no noun of their own in the path',
            probe: 'platform-count',
            disposition: 'handled',
            href: null,
              where: 'landing-steps.ts:140',
            severity: 'high',
            note:
              'E263 · REPAIRED 2026-08-21. The list now derives from `DOCUMENTED_PLATFORM_IDS`, so a noun span exists for exactly the platforms that have pages.',
          },
          {
            case: 'the pre-paint script never stamps the two newest platforms',
            probe: 'platform-count',
            disposition: 'handled',
            href: null,
              where: 'documented-platforms.ts:44',
            severity: 'medium',
            note:
              'E264 · NO LONGER REACHABLE, 2026-08-21. A Smartsheet reader cannot be stamped because Smartsheet is not offered on any documentation surface: those now render `DOCUMENTED_PLATFORMS`. Re-open this row the day a fourth platform gets pages, because the three-way test itself was never made general.',
          },
          {
            case:
              'two bugs cancel out, so the copy quietly reverts to neutral instead of showing a hole',
            probe: 'platform-count',
            disposition: 'handled',
              where: 'documented-platforms.ts:44',
            href: '/',
            severity: 'high',
            note:
              'E265 · NO LONGER REACHABLE, 2026-08-21 — and the warning was right, so they WERE fixed together. Every documentation surface now renders `DOCUMENTED_PLATFORMS`, so the stamp at `:167`, the reveal at `:687-689` and the noun spans from `landing-steps.ts` are the same three by construction rather than by three hand-kept lists agreeing. Verified in a browser at 1440, not reasoned: the neutral noun and the per-platform noun were read after picking a platform.',
          },
          {
            case: 'the newest platforms’ cards are in the page and no rule ever reveals them',
            probe: 'platform-count',
            disposition: 'handled',
            href: null,
              where: 'LandingBody.astro:130',
            severity: 'medium',
            note:
              'E266 · REPAIRED 2026-08-21. The glossary and the directory both read `DOCUMENTED_PLATFORMS`, so the DOM and the two reveals agree by construction instead of by three hand-kept lists.',
          },
          {
            case: 'four glossary cards now stack inside a frame drawn for two',
            probe: 'platform-count',
            disposition: 'defect',
            href: '/',
            severity: 'medium',
            note:
              'E267 · `LandingBody.astro:127`. Geometry UNVERIFIED — this needs a computed height read in a browser, which the enumeration could not take.',
          },
        ],
      },
      {
        label: 'Leave for the documentation',
        href: '/start/what-baseout-is/',
        caption:
          'Where the path lands. From here the header nav, the sidebar filter and the chat are all present, and the landing is not in the reading sequence behind them.',
        edges: [
          {
            case: 'a card promises a page that opens on "Not written yet"',
            probe: 'empty',
            disposition: 'decide',
            href: '/',
            severity: 'medium',
            note:
              'E7 · `SHOW_DRAFT_FLAGS = false` (`LandingBody.astro:62`), and `landing.ts:29-31` already carries a measured `written` flag that nothing renders. Ship with flags off (demo honesty) or on (reader honesty). See D9.',
          },
          {
            case: 'the directory keeps growing: 22 neutral cards plus one per topic per platform',
            probe: 'many',
            disposition: 'decide',
            href: '/',
            severity: 'medium',
            note:
              'E8 · Measured 2463px when the layout won, at three platforms. Five adds twenty more cards, unconditionally — nothing is hidden by a choice (`LandingBody.astro:34-37`). See D7.',
          },
          {
            case: 'the roadmap strip always finds three items, whatever the board holds',
            probe: 'stale',
            disposition: 'handled',
            where: 'landing.ts:335',
            href: '/',
            note:
              'E11 · `buildStrip` falls back to a repeated subject rather than short-changing the row, and the sub-line promises statuses rather than spread.',
          },
          {
            case: 'with nothing shipped, a heading promising three sits over two cards',
            probe: 'empty',
            disposition: 'defect',
            href: null,
            severity: 'low',
            note:
              'E12 · Latent. `landing.ts:334` `continue`s when a status has no candidate, and the sub-line is a static string. Not reachable with today’s fixtures, so no URL reproduces it.',
          },
          {
            case: 'you got to the bottom and still have not found it',
            probe: 'exit',
            disposition: 'handled',
            where: 'LandingBody.astro:115-120',
            href: '/',
            note:
              'E13 · "Still stuck?" offers the assistant and Contact us, both live. The Roadmap card was deliberately removed from that row.',
          },
        ],
      },
    ],
    note:
      'DONE, 2026-08-21. `ShotSwitch` and `lib/shot-switch.ts` said of themselves that they were built to be deleted, and Dan chose: the cards stay doors. The flow lost its second variant step and gained the one the choice created — the shared `PlatformPicker` in the hero, which is where scoping without leaving the page lives now.',
  },

  // ── Docs ──────────────────────────────────────────────────────────────────
  {
    id: 'read-documentation',
    surface: 'docs',
    label: 'Read documentation',
    status: 'built',
    summary:
      'Somebody reads one documentation page and finds their bearings on it — which chapter it belongs to, whose platform it is about, and what else is on the page.',
    source: [
      'apps/support/astro.config.mjs',
      'apps/support/src/components/DocsSidebar.astro',
      'apps/support/src/components/DocsPageTitle.astro',
      'apps/support/src/components/PageSidebar.astro',
      'apps/support/src/components/DocsFooter.astro',
    ],
    steps: [
      {
        label: 'A chapter, not a shelf',
        href: '/backups/how-backups-work/',
        caption:
          'The sidebar is organised by what a reader is trying to DO, so the platform pages sit inside the chapter they belong to rather than in a shelf of their own. Chapters are collapsed; the three-row subject groups inside them are not, because a filter whose effect happens inside a folded box has no visible effect.',
        edges: [
          {
            case: 'you reach the end of a page and it says "Not written yet"',
            probe: 'empty',
            disposition: 'handled',
            where: 'DraftBanner.astro:4-9',
            href: null,
            note:
              'E38 · Bound decision: every page must read as finished, so the `provisional` flag was removed from `content.config.ts:17-23` and no banner exists. 16 of 86 pages end this way.',
          },
          {
            case: 'five different doors all lead into the same unwritten page',
            probe: 'empty',
            disposition: 'decide',
            href: null,
            severity: 'medium',
            note:
              'E39 · The sidebar, search, the chat’s citations, a landing card and a request’s `docs` link all reach a stub. See D9.',
          },
          {
            case: 'you land mid-manual from a search engine with no idea what this page is',
            probe: 'entry',
            disposition: 'handled',
            where: 'DocsPageTitle.astro:29-37',
            href: '/backups/how-backups-work/',
            note: 'E40 · Every page carries a one-sentence lede rendered from `description`.',
          },
          {
            case: 'a URL from an old email points at a page that has since moved',
            probe: 'entry',
            disposition: 'handled',
            where: 'astro.config.mjs:19-28',
            href: '/start/what-baseout-is/',
            note:
              'E41 · `/submit`, `/tickets` and two platform pages all redirect rather than 404. A portal that 404s a URL it published is a portal people stop linking to.',
          },
          {
            case: 'you follow an old link to check on your case and get a blank new-case form',
            probe: 'entry',
            disposition: 'defect',
            href: '/tickets',
            severity: 'high',
            note:
              'E42 · `astro.config.mjs:20-21` sends `/tickets` to the contact FORM, not a list — and `/tickets` is the address the chat’s own out-of-messages line used to point at. See D2.',
          },
          {
            case: 'the header lights "Documentation" on a page that is not documentation',
            probe: 'identity',
            disposition: 'handled',
            where: 'src/components/Header.astro · isCurrent',
            href: null,
            note:
              'E53 · WAS a defect and is not one now, re-measured 2026-08-25. It read: `Header.astro:51-57` ' +
              'marks Documentation current for anything that is not `/`, `/roadmap*` or `/contact*`, so ' +
              '`/handoff` lights it. Two things ended it. `isCurrent` is a manual test now — `/api/` lights ' +
              '`API/MCP`, `/changelog/` lights `Changelog`, a docs page lights `Docs` — and `/handoff` no ' +
              'longer renders the portal header at all: 0 nav links in the built page. The row is kept ' +
              'rather than deleted because a reader who remembers the defect needs to find out it is gone.',
          },
          {
            case: 'a dead link from a month-old email gets a stranger’s 404',
            probe: 'entry',
            disposition: 'decide',
            href: null,
            severity: 'low',
            note:
              'E55 · There is no `src/pages/404.astro` in the tree, so Starlight’s default answers. Decide whether the portal writes its own.',
          },
        ],
      },
      {
        label: 'Whose platform this page is about',
        href: '/platforms/airtable/what-we-back-up/',
        caption:
          'The page says whose platform it is before its first sentence, with the brand mark so it is recognised before it is read. 15 of the pages carry no platform at all and deliberately show nothing here.',
        edges: [
          {
            case:
              'a chapter whose every page your filter hides folds away instead of opening onto nothing',
            probe: 'partial',
            disposition: 'handled',
            where: 'platform-filter.ts:122-128',
            href: '/platforms/airtable/what-we-back-up/',
            note: 'E44 · No caret that opens onto an empty group.',
          },
          {
            case:
              'an in-page tab strip with one live tab disappears rather than pretending to be a choice',
            probe: 'cross-step',
            disposition: 'handled',
            where: 'platform-filter.ts:132-151',
            href: '/platforms/airtable/what-we-back-up/',
            note: 'E45 · `PlatformTabs.astro:20-23`. The strip obeys the same filter as the sidebar.',
          },
          {
            case:
              'a tab block that does not cover your platform leaves the previous platform’s panel showing',
            probe: 'broken',
            disposition: 'defect',
            href: null,
            severity: 'medium',
            note:
              'E46 · `platform-filter.ts:141-146`: `live` is empty, the loop `continue`s, and the strip hides over a stale panel. Not reachable today because every block covers all three; latent the moment one does not.',
          },
          {
            case: 'a search hit whose matching words are in a tab you cannot see',
            probe: 'many',
            disposition: 'handled',
            where: 'PlatformTabs.astro:25-28',
            href: null,
            severity: 'low',
            note: 'E47 · Stated and accepted: Pagefind indexes every panel whether visible or not.',
          },
          {
            case: 'adding a platform fails the build until the tab component grows a slot for it',
            probe: 'platform-count',
            disposition: 'handled',
            where: 'PlatformTabs.astro:45-52',
            href: null,
            severity: 'medium',
            note:
              'E22 · By design — `slot[name]` must be a static string, so the component throws rather than silently dropping a platform. It is also a hard blocker on the five-platform comparison below.',
          },
          {
            case: 'the build throws today, because two platforms shipped without tab slots',
            probe: 'platform-count',
            disposition: 'handled',
            href: null,
              where: 'PlatformTabs.astro:59',
            severity: 'high',
            note:
              'E262 · REPAIRED 2026-08-21, and the repair changed the rule rather than the list. The throw fired, the MDX pipeline swallowed it, and the page served HTTP 200 with the whole block — label, strip and all three panels — silently absent. Tabs now derive from the slots the PAGE passes via `Astro.slots.has()`, which is dynamic where `slot[name]` is not, so a registry platform this page does not document simply gets no tab.',
          },
        ],
      },
      {
        label: 'The half no filter touches',
        href: '/account/billing/',
        caption:
          'Managing an account, signing in and being billed are identical whoever you back up. Not one page in this chapter carries a platform tag, which is what makes narrowing to Notion leave the whole chapter standing.',
        edges: [
          {
            case: 'ten chapters collapsed, and ten nested platform groups deliberately open',
            probe: 'many',
            disposition: 'handled',
            where: 'astro.config.mjs:91-95',
            href: '/account/billing/',
            note:
              'E43 · 86 pages. The per-platform groups are open on purpose so the filter’s effect is visible; at five platforms that is 50 rows in 10 always-open groups.',
          },
        ],
      },
      {
        label: 'Page contents, and the room they give up',
        href: '/backups/schedule-and-scope/',
        caption:
          'The right-hand contents list folds into a button when the chat drawer takes the width. The drawer reflows the page rather than overlaying it — the reader keeps reading while they ask.',
        edges: [
          {
            case: 'the chat opens over the table of contents',
            probe: 'exit',
            disposition: 'handled',
            where: 'PageSidebar.astro:4-13',
            href: '/backups/schedule-and-scope/',
            note: 'E48 · The TOC folds into a list button rather than vanishing.',
          },
          {
            case: 'Escape with two layers open closes the inner one only',
            probe: 'exit',
            disposition: 'handled',
            where: 'toc-collapse.ts:34-48',
            href: '/backups/schedule-and-scope/',
            note:
              'E49 · A capture-phase listener consumes the event; `chat-panel.ts:169-182` is the other half.',
          },
          {
            case: 'Escape out of a dialog also closes the chat behind it',
            probe: 'exit',
            disposition: 'defect',
            href: '/backups/schedule-and-scope/',
            severity: 'medium',
            note:
              'E50 · `chat-panel.ts:179-180` guards the TOC popover and the platform picker but not an open `<dialog>` — so Escape on the search or vote dialog takes the drawer with it. UNVERIFIED in a browser. See X7.',
          },
        ],
      },
    ],
  },
  {
    id: 'filter-the-documentation-to-my-platform',
    surface: 'docs',
    label: 'Filter the documentation to my platform',
    status: 'built',
    summary:
      'Somebody narrows the whole documentation down to the platforms they use, and can hand that narrowed view to a colleague as a link.',
    shape: 'states', // one page, four `?platform=` renderings — no step needs the one before it
    source: [
      'apps/support/src/components/PlatformFilter.astro',
      'apps/support/src/lib/platform-filter.ts',
      'apps/support/src/lib/platforms.ts',
    ],
    steps: [
      {
        label: 'Everything, because nothing was asked',
        href: '/start/getting-started/',
        caption:
          'No choice means everything — five platforms in the chips above the tree and every row of the tree standing. A reader who never touches this control never learns it exists.',
        edges: [
          {
            case: 'the sidebar paints every platform and then hides two-thirds of them',
            probe: 'static-build',
            disposition: 'decide',
            href: '/start/getting-started/',
            severity: 'medium',
            note:
              'E17 · `PlatformPicker.astro:126-129` says it out loud: rendering the stored value is not an option on a static build. The landing has a pre-paint fix; the docs pages have none. UNVERIFIED — the flash has never been measured. See D1 and X5.',
          },
          {
            case:
              'a stored preference that excludes everything would leave you a manual with nothing in it',
            probe: 'empty',
            disposition: 'handled',
            where: 'platforms.ts:231-233',
            href: '/start/getting-started/',
            note:
              'E29 · An empty set is treated as absent, in two places (`platforms.ts:279-280` is the other).',
          },
          {
            case: 'your browser refuses to remember anything',
            probe: 'broken',
            disposition: 'handled',
            where: 'platforms.ts:240-246',
            href: '/start/getting-started/',
            severity: 'low',
            note:
              'E30 · Writes are try/caught: the filter works for the page and does not survive navigation.',
          },
          {
            case: 'a shared or kiosk browser hands you the last person’s choice',
            probe: 'identity',
            disposition: 'decide',
            href: '/start/getting-started/',
            severity: 'low',
            note:
              'E31 · Nothing in the picker says "this is remembered on this browser". Decide whether it should.',
          },
          {
            case: 'a hand-edited platform id in the URL',
            probe: 'broken',
            disposition: 'handled',
            where: 'platforms.ts:222',
            href: '/start/getting-started/?platform=airtable',
            note:
              'E34 · A bad `?platform=` value is filtered out; a bad id in frontmatter throws loudly at build (`platforms.ts:147-153`). Both ends covered.',
          },
        ],
      },
      {
        label: 'Narrowed to one',
        href: '/start/getting-started/?platform=airtable',
        caption:
          'The page renders everything and the controller hides what the preference excludes. Each subject group keeps exactly one row, still in task order: that reshaping is the thing to be able to see.',
        edges: [
          {
            case: 'you try to switch off the last platform',
            probe: 'one',
            disposition: 'handled',
            where: 'platform-picker.ts:142-151',
            href: '/start/getting-started/?platform=airtable',
            note:
              'E18 · The surviving row is drawn inert, the checkbox is re-checked by hand after the browser flips it, and the live region names it: "Notion stays on. One platform always does."',
          },
          {
            case: 'at one platform the whole control is dead furniture',
            probe: 'platform-count',
            disposition: 'defect',
            href: null,
            severity: 'high',
            note:
              'E19 · `chosen.length === 1` always, so the single option is permanently `aria-disabled` and the reset permanently hidden (`platform-filter.ts:130`) under a heading that says "Show docs for". This is the one-platform column of the comparison below.',
          },
          {
            case: 'the control changes shape because a fifth platform shipped',
            probe: 'platform-count',
            disposition: 'handled',
            where: 'PlatformPicker.astro:124',
            href: '/start/getting-started/',
            note:
              'E20 · Presentation switches on a build-time `PLATFORMS.length > chipsUpTo`: sidebar 0, chat 2, search 4. Deliberate and argued at `PlatformPicker.astro:30-51`.',
          },
          {
            case: 'the same three logos subtract here and substitute on the board',
            probe: 'cross-step',
            disposition: 'handled',
            where: 'PlatformPicker.astro:15-28',
            href: '/start/getting-started/?platform=airtable',
            severity: 'medium',
            note:
              'E32 · Argued: `narrow` never hides untagged content, `scope` deliberately does (`board.ts:58-63`). Both are right in isolation, and it is the single most likely mental-model mismatch in the portal. See X6.',
          },
        ],
      },
      {
        label: 'Narrowed to two',
        href: '/start/getting-started/?platform=airtable,clickup',
        caption:
          'The filter is multi-select, not a radio group. Two platforms is the realistic case for anyone running a migration, and it is the count at which the chips stop reading as a segmented control.',
        edges: [
          {
            case: 'above four selected the trigger stops drawing marks and starts counting',
            probe: 'platform-count',
            disposition: 'handled',
            where: 'platform-picker.ts:162-166',
            href: '/start/getting-started/?platform=airtable,clickup',
            note:
              'E21 · At five with five on, `all` is true and it reads "All platforms"; with four of five on it draws four marks. Sound.',
          },
          {
            case: 'narrowing in one place repaints the other three',
            probe: 'cross-step',
            disposition: 'handled',
            where: 'platform-filter.ts:194-199',
            href: '/start/getting-started/?platform=airtable,clickup',
            note:
              'E24 · One store, one event, four subscribers — the sidebar behind an open dialog repaints, and the open search query re-runs (`search-modal.ts:100-105`).',
          },
          {
            case:
              'a scope changed mid-conversation applies to the next question, not the one already asked',
            probe: 'cross-step',
            disposition: 'handled',
            where: 'chat-core.ts:107-113',
            href: '/backups/reading-a-run/?platform=notion',
            note: 'E25 · The chat reads scope at send time (`chat-panel.ts:64-75`).',
          },
          {
            case: 'a platform with a long name is the case the count cannot see',
            probe: 'long',
            disposition: 'handled',
            where: 'platform-picker.ts:78-83',
            href: null,
            severity: 'low',
            note:
              'E35 · `listNames` spells out up to three and counts past that; `chipsUpTo` compares COUNT, never width. Stated at `PlatformPicker.astro:36-38`.',
          },
        ],
      },
      {
        label: 'The choice is in the address bar',
        href: '/start/getting-started/?platform=notion',
        caption:
          '`?platform=` mirrors the choice, so the address is always shareable and always says what it shows. It BEATS storage on read: a link someone sends carries the platforms it was written for, and a preference from last week must not silently rewrite it.',
        edges: [
          {
            case: 'the link a colleague sent narrows one page, then the site quietly widens back',
            probe: 'stale',
            disposition: 'decide',
            href: '/start/getting-started/?platform=notion',
            severity: 'medium',
            note:
              'E27 · `platforms.ts:219-224` reads the parameter per call and `platform-filter.ts:171-173` deliberately does not mirror it into storage on first paint. Decide whether one page is the intended lifetime of a shared narrowing.',
          },
        ],
      },
    ],
    note:
      'The URL is mirrored but not rewritten on first paint — doing so would overwrite a shared link before the reader had done anything. When the set is all five the parameter is deleted rather than spelled out, so "everything" has one representation, not two.',
  },
  {
    id: 'land-on-a-page-my-own-filter-hides',
    surface: 'docs',
    label: 'Land on a page my own filter hides',
    status: 'built',
    summary:
      'Somebody follows a link from outside onto a page their own filter is hiding, and has to be told that nothing is missing and how to widen it.',
    shape: 'states', // one page under two filter widths; the notice and the way out are the same render
    source: [
      'apps/support/src/components/DocsPageTitle.astro',
      'apps/support/src/lib/platform-filter.ts',
    ],
    steps: [
      {
        label: 'Arrive from outside',
        href: '/platforms/notion/connecting/?platform=airtable',
        caption:
          'A Notion page opened by a reader whose filter says Airtable — the case of somebody who followed a link from outside and has never seen the control that is confusing them. The page says so above the title: it is about Notion, your filter is hiding it, and nothing is missing.',
        edges: [
          {
            case: 'your own filter hides the page you deliberately searched for',
            probe: 'entry',
            disposition: 'handled',
            where: 'DocsPageTitle.astro:65-77',
            href: '/platforms/notion/connecting/?platform=airtable',
            note:
              'E26 · A per-page amber notice plus a one-click "Show Notion" (`platform-filter.ts:153-160,235-241`).',
          },
        ],
      },
      {
        label: 'The way out is on the notice',
        href: '/platforms/notion/connecting/?platform=airtable',
        caption:
          'The same screen, now use it: the notice carries the button that widens the filter. The explanation lives beside the thing it explains rather than in a band stacked over the page.',
        edges: [
          {
            case: 'a week-old choice hides a third of the manual and nothing on the page says so',
            probe: 'stale',
            disposition: 'decide',
            href: '/start/getting-started/?platform=airtable',
            severity: 'medium',
            note:
              'E28 · The sidebar’s amber "what is hidden" sentence was removed on 2026-08-21 (`PlatformFilter.astro:52-59` records the argument), so the only statement of state is the trigger’s marks. Accept (Dan’s call) or restore it for stale sets only.',
          },
        ],
      },
      {
        label: 'Widened',
        href: '/platforms/notion/connecting/',
        caption:
          'After widening. The notice is gone, the sidebar is whole again, and the reader is on the page they were sent.',
        edges: [
          {
            case: 'narrowing the docs does not narrow the board, and neither screen says so',
            probe: 'cross-step',
            disposition: 'decide',
            href: '/roadmap/',
            severity: 'low',
            note: 'E33 · Correct per the ruling behind E32 — but the rule is stated on the board only.',
          },
        ],
      },
    ],
  },
  {
    id: 'rate-a-documentation-page',
    surface: 'docs',
    label: 'Rate a documentation page',
    status: 'built',
    summary:
      'Somebody says whether the page they just read was useful, and optionally says why.',
    source: [
      'apps/support/src/components/PageFeedback.astro',
      'apps/support/src/components/DocsFooter.astro',
      'apps/support/src/lib/page-feedback.ts',
    ],
    steps: [
      {
        label: 'Was this page useful',
        href: '/troubleshooting/backup-failed/',
        caption:
          'Above Starlight\'s own footer, on documentation pages only. Two buttons and no stars: a rating scale asks a reader to calibrate, and the only answer worth acting on is whether the page did the job.',
        edges: [
          {
            case: 'a thumbs-up on its own produces a number nobody can act on',
            probe: 'empty',
            disposition: 'handled',
            where: 'PageFeedback.astro:11-12',
            href: '/troubleshooting/backup-failed/',
            note:
              'E219 · Two steps, never one: the reason list appears only after an answer, which is what turns a rating into a work item (`page-feedback.ts:5-8`).',
          },
          {
            case: '"Was this page helpful?" asked underneath "Not written yet"',
            probe: 'broken',
            disposition: 'defect',
            href: null,
            severity: 'medium',
            note:
              'E224 · `DocsFooter.astro:21-24` excludes splash and services only, so the widget appears at the foot of all 16 unwritten pages. The portal grading a reader for a page it did not write. See D9.',
          },
          {
            case: 'it says plainly that nothing is sent',
            probe: 'broken',
            disposition: 'handled',
            where: 'PageFeedback.astro:118-121',
            href: '/troubleshooting/backup-failed/',
            note:
              'E226 · One of the three surfaces that admits it; the vote dialog is the one that does not. See X9.',
          },
        ],
      },
      {
        label: 'Say why',
        href: '/troubleshooting/backup-failed/',
        caption:
          'A "no" opens one optional box. It is the second step rather than the first, because asking for prose before the verdict is what makes people skip both.',
        edges: [
          {
            case: 'Send with nothing chosen and Skip do the same thing',
            probe: 'empty',
            disposition: 'defect',
            href: '/troubleshooting/backup-failed/',
            severity: 'low',
            note:
              'E222 · `page-feedback.ts:92-108` writes a verdict with no reason either way; only the thank-you line differs. Two buttons, one outcome.',
          },
          {
            case: 'the hidden half of the reason list is never focusable',
            probe: 'partial',
            disposition: 'handled',
            where: 'PageFeedback.astro:213-222',
            href: '/troubleshooting/backup-failed/',
            note:
              'E223 · Both lists share one `<form>` and one `name="reason"`, written as a pair of rules rather than one with a negation, so neither list is ever both hidden and reachable by Tab.',
          },
          {
            case: 'there is no box to type the actual reason',
            probe: 'identity',
            disposition: 'handled',
            where: 'PageFeedback.astro:21-28',
            href: '/troubleshooting/backup-failed/',
            severity: 'medium',
            note:
              'E225 · Argued: `Another reason` exists so nobody is forced into a box that is not their answer, and so the missing free-text field is visibly missing rather than faked.',
          },
        ],
      },
      {
        label: 'Answered, and it stays answered',
        href: '/troubleshooting/backup-failed/',
        caption:
          'The verdict is stored per page, so returning does not ask again. Nothing is sent — there is no backend in this repo, and the shape stops where the vote button stops.',
        edges: [
          {
            case: 'you come back to a page you already rated',
            probe: 'stale',
            disposition: 'handled',
            where: 'page-feedback.ts:33-36',
            href: '/troubleshooting/backup-failed/',
            note:
              'E220 · You are shown the outcome, not the question: "Thanks. You already told us about this page." Keyed by pathname.',
          },
          {
            case: 'you press No by mistake and the widget thanks you forever',
            probe: 'exit',
            disposition: 'defect',
            href: '/troubleshooting/backup-failed/',
            severity: 'medium',
            note:
              'E221 · `page-feedback.ts:81-90`: `verdict` is set once and there is no return path to the question. Permanent for that page, in that browser.',
          },
          {
            case: 'focus lands on the step that just appeared, without a ring that looks like a click',
            probe: 'exit',
            disposition: 'handled',
            where: 'page-feedback.ts:86-89',
            href: '/troubleshooting/backup-failed/',
            note:
              'E227 · The ring is suppressed only for that programmatic case (`PageFeedback.astro:160-168`).',
          },
          {
            case: 'a page moves and every verdict ever recorded about it is silently orphaned',
            probe: 'stale',
            disposition: 'decide',
            href: null,
            severity: 'low',
            note: 'E228 · The key is `window.location.pathname` (`page-feedback.ts:34-36`).',
          },
          {
            case: 'nothing aggregates the answers, so no queue exists',
            probe: 'many',
            disposition: 'decide',
            href: null,
            severity: 'medium',
            note:
              'E229 · `page-feedback.ts:9-20` — no view, no export, no path from a stored verdict to a person. The queue is the widget’s whole justification. See D14.',
          },
        ],
      },
    ],
    note:
      'No URL opens the "why" or "done" step: the widget is a three-state client machine over one render, which is the static-build constraint showing through. Reproducing steps 2 and 3 means clicking on the page in step 1.',
  },

  // ── Search ────────────────────────────────────────────────────────────────
  {
    id: 'search-the-documentation',
    surface: 'search',
    label: 'Search the documentation',
    status: 'built',
    summary:
      'Somebody looks for a page by name, gets results narrowed to their platforms, and can ask the chat instead when nothing matches.',
    source: [
      'apps/support/src/components/Search.astro',
      'apps/support/src/lib/search-modal.ts',
      'apps/support/src/lib/pagefind.ts',
      'apps/support/src/lib/recent.ts',
      'apps/support/src/lib/questions.ts',
    ],
    steps: [
      {
        label: 'Open it',
        href: '/reference/faq/',
        caption:
          'Press `/` or Cmd-K anywhere on this page, or use the search control in the header. There is no URL that opens the modal — it is a dialog over one render.',
        edges: [
          {
            case: 'search returns nothing at all on a dev server, and says so',
            probe: 'static-build',
            disposition: 'handled',
            where: 'search-modal.ts:166-169',
            href: '/reference/faq/',
            note:
              'E56 · "Doc search runs on the built site." Pagefind is a build artefact (`pagefind.ts:41-61`), and this honesty is what stopped "search is broken" being reported twice in one day.',
          },
          {
            case: 'the index is deliberately broader than this search, and nothing on screen says why',
            probe: 'cross-step',
            disposition: 'handled',
            where: 'search-modal.ts:42-57',
            href: '/reference/faq/',
            severity: 'medium',
            note:
              'E63 · Request pages stay indexed because `/contact`’s duplicate detection queries the same index (`submit.ts:4-7`). Adding `data-pagefind-ignore` to them would silently kill duplicate detection — the single most fragile coupling in the app.',
          },
          {
            case: 'the slash shortcut fires while your focus is on a button',
            probe: 'identity',
            disposition: 'handled',
            where: 'search-modal.ts:261-273',
            href: '/contact/',
            severity: 'low',
            note:
              'E68 · It is suppressed inside inputs, textareas, selects and contenteditable — not on a button, e.g. a contact fork tile. Acceptable.',
          },
          {
            case: 'you hunt for a feature request in the search box and it is not there',
            probe: 'entry',
            disposition: 'decide',
            href: '/reference/faq/',
            severity: 'medium',
            note:
              'E70 · Documentation only, and both the button and the field say so (`search-modal.ts:18-19,57`). See D8.',
          },
        ],
      },
      {
        label: 'Before anything is typed',
        href: '/reference/faq/',
        caption:
          'The empty state is not empty: recent pages the reader actually opened, and a short list of popular questions. Both are filtered to documentation URLs, so the roadmap and the contact form cannot appear in a docs search.',
        edges: [
          {
            case: 'the modal before a character is typed',
            probe: 'empty',
            disposition: 'handled',
            where: 'search-modal.ts:120-146',
            href: '/reference/faq/',
            note:
              'E57 · Recently viewed, suggested questions, and "Or ask" — a resting state that is not blank.',
          },
          {
            case: '"Recently viewed" is empty for someone who has read four doc pages',
            probe: 'empty',
            disposition: 'defect',
            href: '/reference/faq/',
            severity: 'medium',
            note:
              'E58 · `recent.ts:10-11,28-32` records EVERY page including `/contact` and `/roadmap` and caps at four; `search-modal.ts:127` then filters to docs. The cap is applied before the filter, so two non-doc visits wipe the list. See X4.',
          },
          {
            case: 'you reopen the modal and your query is gone',
            probe: 'exit',
            disposition: 'decide',
            href: '/reference/faq/',
            severity: 'low',
            note:
              'E64 · `search-modal.ts:248-253` clears it on open. Restore the last query, or always start fresh.',
          },
        ],
      },
      {
        label: 'Results, narrowed to your platforms',
        href: '/reference/faq/?platform=notion',
        caption:
          'The modal reads the same platform preference the sidebar writes, and queries Pagefind for the reader\'s platforms plus `all`. A page with no platform is tagged `all` rather than left untagged, because a billing page is true of every platform, not of none.',
        edges: [
          {
            case: 'a query whose best hits are all outside the documentation',
            probe: 'many',
            disposition: 'handled',
            where: 'search-modal.ts:34-40',
            href: '/reference/faq/?platform=notion',
            note:
              'E59 · It asks the index for `MAX_RESULTS * 3` and drops non-docs afterwards, precisely so a "restore" query does not come back with two documents and four holes.',
          },
          {
            case: 'one failed query used to poison every later one on the page',
            probe: 'broken',
            disposition: 'handled',
            where: 'pagefind.ts:34-39',
            href: '/reference/faq/',
            note: 'E62 · Only success is cached now.',
          },
          {
            case: 'a slow keystroke landing after a newer one',
            probe: 'many',
            disposition: 'handled',
            where: 'search-modal.ts:181',
            href: '/reference/faq/',
            note:
              'E66 · Race-protected: an earlier request cannot overwrite a later one (`search-modal.ts:194`).',
          },
          {
            case: 'at five platforms the chip row collapses into a menu',
            probe: 'platform-count',
            disposition: 'handled',
            where: 'Search.astro:79',
            href: '/reference/faq/',
            note:
              'E69 · `chipsUpTo={4}`; the label "Search in" stays. Sound — and it is the surface where the count visibly changes the control.',
          },
        ],
      },
      {
        label: 'Nothing here, but something over there',
        href: '/reference/faq/?platform=notion',
        caption:
          'When the narrowed query finds nothing and the wide one would have, the modal says how many it is holding back and offers "search all platforms" — rather than reporting an empty result the reader\'s own filter caused.',
        edges: [
          {
            case: 'nothing matched, and it is your own filter that hid it',
            probe: 'empty',
            disposition: 'handled',
            where: 'search-modal.ts:161-178',
            href: '/reference/faq/?platform=notion',
            note:
              'E60 · A second unfiltered query counts what the filter hid, and "search all platforms" is offered only when the filter is genuinely responsible. The best empty state in the portal.',
          },
          {
            case: 'nothing matched and no filter is to blame',
            probe: 'empty',
            disposition: 'handled',
            where: 'search-modal.ts:175',
            href: '/reference/faq/',
            note:
              'E61 · "No page matches that — ask instead." The Ask row is always first, so it is also the answer when there is nothing.',
          },
        ],
      },
      {
        label: 'Ask instead',
        href: '/reference/faq/',
        caption:
          'A result row can hand the question to the chat. Asking is the same job as searching, one step further along, which is why the pair sits in the header rather than in a floating bubble.',
        edges: [
          {
            case: 'one strong result, and Enter opens the chat instead of it',
            probe: 'one',
            disposition: 'decide',
            href: '/reference/faq/',
            severity: 'medium',
            note:
              'E67 · `active` defaults to 0 and row 0 is always Ask (`rows.ts:45`, `search-modal.ts:107-118`). Decide whether Ask-first is right when there is exactly one strong doc hit.',
          },
          {
            case: 'a very long query printed in full inside the Ask row',
            probe: 'long',
            disposition: 'decide',
            href: '/reference/faq/',
            severity: 'low',
            note:
              'E65 · `rows.ts:48-49` prints it with quotes and no truncation in the markup. UNVERIFIED whether CSS clamps it — that needs a computed width read in a browser.',
          },
        ],
      },
    ],
    note:
      'PAGEFIND IS BUILD-TIME. On a dev server the module 404s and the modal returns nothing, which is how "search is broken" was reported twice in one day. Verify search against a real build served from `dist/` — `pnpm smoke-support` does exactly that, and asserts the index exists.',
  },

  // ── Chat ──────────────────────────────────────────────────────────────────
  {
    id: 'ask-the-ai-chat',
    surface: 'chat',
    label: 'Ask the AI chat',
    status: 'built',
    summary:
      'Somebody asks a question without leaving the page they are reading, and gets an answer that names the pages it came from.',
    source: [
      'apps/support/src/components/ChatDock.astro',
      'apps/support/src/components/DraftBanner.astro',
      'apps/support/src/lib/chat-panel.ts',
      'apps/support/src/lib/chat-core.ts',
      'apps/support/src/lib/chat-resize.ts',
    ],
    steps: [
      {
        label: 'Ask, from wherever you are',
        href: '/backups/reading-a-run/',
        caption:
          'The Ask AI button sits beside the header search on every page of the portal. The drawer is rendered by the site-wide banner slot, so there is no page where the reader has to go somewhere else to ask.',
        edges: [
          {
            case: 'no page to ask about, so it offers three questions instead',
            probe: 'empty',
            disposition: 'handled',
            where: 'ChatDock.astro:59-61',
            href: '/',
            note:
              'E71 · On the splash landing, or once the page chip is dismissed, starter questions take the chip’s place (`chat-panel.ts:52-56`).',
          },
          {
            case: 'a starter question fills the box rather than spending a message',
            probe: 'partial',
            disposition: 'handled',
            where: 'chat-panel.ts:84-93',
            href: '/backups/reading-a-run/',
            note:
              'E72 · The budget is five, and spending one on a click nobody confirmed is taking it unasked.',
          },
          {
            case: 'the answer is a stub; the sources are real',
            probe: 'broken',
            disposition: 'handled',
            where: 'chat-core.ts:20-30',
            href: '/backups/reading-a-run/',
            note:
              'E73 · Argued. There is no answering engine, but the question is genuinely run through Pagefind, so the cited pages actually matched (`chat-core.ts:188-200`).',
          },
          {
            case: 'the chat offers to answer questions "about this page" where the page is a form',
            probe: 'identity',
            disposition: 'defect',
            href: '/contact/',
            severity: 'low',
            note:
              'E85 · `ChatDock.astro:58-61` uses `route.entry.data.title` for everything that is not `splash`, so the chip reads "Contact us" on `/contact` and "Roadmap" on `/roadmap`.',
          },
          {
            case: 'opening the chat on a phone with the nav already expanded',
            probe: 'broken',
            disposition: 'handled',
            where: 'chat-panel.ts:134-145',
            href: '/backups/reading-a-run/',
            note:
              'E87 · It closes Starlight’s expanded nav first, so two full-screen layers never coexist.',
          },
          {
            case: 'a tab left open across a redeploy could not open the chat at all',
            probe: 'broken',
            disposition: 'handled',
            where: 'chat-panel.ts:8-15',
            href: null,
            note:
              'E54 · Explicitly fixed: the open flag is now set only by the module that also closes it, so a stale hashed bundle cannot leave the drawer unopenable.',
          },
        ],
      },
      {
        label: 'It reflows, it does not overlay',
        href: '/backups/reading-a-run/',
        caption:
          'The drawer takes width from the page rather than covering it, and the page contents list folds into a button to pay for it. The reader keeps the paragraph they were reading on screen while they ask about it.',
        edges: [
          {
            case: 'nothing above the drawer may become a containing block',
            probe: 'exit',
            disposition: 'handled',
            where: 'ChatDock.astro:47-51',
            href: '/backups/reading-a-run/',
            note:
              'E86 · The drawer is `position: fixed` and takes part in no layout, which is why the hero uses `overflow-x: clip` rather than `container-type`.',
          },
          {
            case: 'you drag the drawer wider and the picker inside does not change shape',
            probe: 'long',
            disposition: 'handled',
            where: 'ChatDock.astro:117-121',
            href: '/backups/reading-a-run/',
            note:
              'E88 · Argued: `chipsUpTo={2}` is decided before the page is served and cannot follow a drag. Min width 320px (`chat-resize.ts:29-34`).',
          },
          {
            case: 'you opened the chat once and now read every page with a drawer on the right',
            probe: 'stale',
            disposition: 'handled',
            where: 'chat-panel.ts:127-132',
            href: '/backups/reading-a-run/',
            severity: 'low',
            note: 'E51 · Deliberate — the drawer belongs to the visitor, not to the page.',
          },
          {
            case: 'a stored drawer width wider than the window you are now in',
            probe: 'long',
            disposition: 'handled',
            where: 'chat-resize.ts:28-34',
            href: '/backups/reading-a-run/',
            note: 'E52 · Clamped to `min(720, 70vw)` and re-clamped on window resize.',
          },
        ],
      },
      {
        label: 'Answers with their sources',
        href: '/backups/reading-a-run/',
        caption:
          'Every answer carries the documentation pages it came from, capped at six. An answer with no source is an answer nobody can check.',
        edges: [
          {
            case: 'on a dev server it cites nothing and always says nothing matched',
            probe: 'static-build',
            disposition: 'handled',
            where: 'pagefind.ts:3-7',
            href: null,
            severity: 'low',
            note: 'E74 · No index exists under `astro dev`.',
          },
          {
            case: 'an answer with more sources than the panel can hold',
            probe: 'many',
            disposition: 'handled',
            where: 'chat-core.ts:87-100',
            href: '/backups/reading-a-run/',
            note: 'E89 · A `<details>` "Used N sources" list, `SOURCE_LIMIT = 6`.',
          },
          {
            case: 'an answer with no sources at all',
            probe: 'empty',
            disposition: 'handled',
            where: 'chat-core.ts:88',
            href: '/backups/reading-a-run/',
            note: 'E90 · No `<details>` is rendered rather than an empty disclosure.',
          },
          {
            case: 'the conversation never ends, and there is no way to start a new one',
            probe: 'many',
            disposition: 'defect',
            href: '/backups/reading-a-run/',
            severity: 'medium',
            note:
              'E80 · `chat-core.ts:148-151` replays the entire stored log on every page load and scrolls to the bottom. No cap, no clear, no "new conversation". See D5.',
          },
          {
            case: 'a conversation from three weeks ago replays with no date on it',
            probe: 'stale',
            disposition: 'defect',
            href: '/backups/reading-a-run/',
            severity: 'medium',
            note:
              'E81 · `Turn` has no `at` field (`chat-core.ts:40-47`), so there is no timestamp and no separator to print. This is the state a reader reads as "this is broken".',
          },
        ],
      },
      {
        label: 'It knows which platform you are on',
        href: '/backups/reading-a-run/?platform=notion',
        caption:
          'The chat searches the same narrowed index the modal does. Without that it would answer a Notion question out of Airtable\'s pages, which is a wrong answer rather than a broad one.',
        edges: [
          {
            case: 'nothing matched because your own platform scope hid it',
            probe: 'empty',
            disposition: 'handled',
            where: 'chat-core.ts:180-198',
            href: '/backups/reading-a-run/?platform=notion',
            note:
              'E75 · A second unfiltered search counts the hidden pages and the reply says "turn one back on above" — the same repair as the search modal’s empty state.',
          },
          {
            case: 'you dismiss the page chip and the question already typed still carries it',
            probe: 'cross-step',
            disposition: 'handled',
            where: 'chat-panel.ts:48-50',
            href: '/backups/reading-a-run/?platform=notion',
            note:
              'E83 · Context is read at send time (`chat-core.ts:102-106`), so the dismissal takes effect on the next question.',
          },
          {
            case: 'you dismiss the chip, navigate, and it comes back',
            probe: 'cross-step',
            disposition: 'defect',
            href: '/backups/reading-a-run/',
            severity: 'medium',
            note:
              'E84 · There is only `[data-chat-chip-clear]` and no re-scope control (`chat-panel.ts:78-82`); the chip is server-rendered per page (`ChatDock.astro:99-109`), so the dismissal silently un-does itself on the next navigation.',
          },
        ],
      },
      {
        label: 'The draft survives the page',
        href: '/reference/glossary/',
        caption:
          'Open state, transcript and half-typed draft are all stored, so following a link out of an answer does not throw away the question. Reopen the drawer here and the conversation is still the one from the previous step.',
        edges: [
          {
            case: 'you type half a question, navigate, and it is still there',
            probe: 'partial',
            disposition: 'handled',
            where: 'chat-core.ts:69-73',
            href: '/reference/glossary/',
            note:
              'E82 · The pattern `/contact` needs and does not have — the draft survives navigation and reload (`chat-core.ts:153-156`). See X1.',
          },
        ],
      },
    ],
    note:
      'No URL opens the drawer. Every step above is the page that HOLDS it — press Ask AI to reach the state the caption describes. Making the drawer addressable is a change to `lib/chat-panel.ts`, not to this row.',
  },
  {
    id: 'run-out-of-free-messages',
    surface: 'chat',
    label: 'Run out of free messages',
    status: 'built',
    summary:
      'Somebody spends the free chat messages, meets the limit, and is offered a person instead.',
    shape: 'states', // the four readings of one message budget: stated · one left · exhausted · the way out
    source: [
      'apps/support/src/components/ChatDock.astro',
      'apps/support/src/lib/chat-core.ts',
    ],
    steps: [
      {
        label: 'The budget is stated up front',
        href: '/start/getting-started/',
        caption:
          'Five free messages, counted down in the drawer as "N of 5 free messages left". Stating the budget before it runs out is what stops the limit reading as a fault.',
        edges: [
          {
            case: 'clearing your browser gives you five more',
            probe: 'limit',
            disposition: 'handled',
            where: 'chat-core.ts:16-18',
            href: '/start/getting-started/',
            note:
              'E78 · The budget is `localStorage`, per browser, and the file states this as UX honesty rather than as security.',
          },
        ],
      },
      {
        label: 'The last one',
        href: '/start/getting-started/',
        caption:
          'At zero the line goes quiet rather than reading "0 of 5 left". A counter at zero is the same information as the gate below it, said twice.',
        edges: [
          {
            case: 'two tabs, and the second one keeps a live composer after the budget is spent',
            probe: 'stale',
            disposition: 'defect',
            href: '/start/getting-started/',
            severity: 'low',
            note:
              'E79 · The counter is shared but each tab reads it at wire time and there is no `storage` listener (`chat-core.ts:64,140-146`).',
          },
        ],
      },
      {
        label: 'The gate, and the way past it',
        href: '/start/getting-started/',
        caption:
          'The composer is replaced by a gate that names the two real routes: sign in, or describe it to a person. It is UX, not security — the real limit is enforced server-side in the engine.',
        edges: [
          {
            case: 'the composer is replaced by a gate rather than failing on send',
            probe: 'limit',
            disposition: 'handled',
            where: 'chat-core.ts:140-146',
            href: '/start/getting-started/',
            note:
              'E76 · "You have used your free messages. Write to us instead." (`ChatDock.astro:138-140`).',
          },
          {
            case: 'the way out of the gate loses the conversation it came from',
            probe: 'broken',
            disposition: 'defect',
            href: '/contact/',
            severity: 'high',
            note:
              'E92 · `ChatDock.astro:139` links `/contact/` with no `kind`, so the reader is dropped on the five-door fork and asked to choose again. With E91 these are the chat’s only two escalation paths: one un-clickable, one context-losing. See X3.',
          },
        ],
      },
      {
        label: 'Describe it to a person instead',
        href: '/contact/?kind=ticket',
        caption:
          'Where the gate points. It carries the kind, so the reader lands on the fault form rather than on a fork asking them to repeat the choice they just made.',
        edges: [
          {
            case: 'five messages of context, and then a fork asking what kind of thing this is',
            probe: 'limit',
            disposition: 'defect',
            href: '/contact/?kind=ticket',
            severity: 'medium',
            note: 'E77 · This step’s URL is what the gate SHOULD link to. Today it does not (E92).',
          },
        ],
      },
    ],
    note:
      'The count lives in `localStorage` under `support-chat-used`. There is no URL that sets it, so reaching steps 2 and 3 means sending five messages or clearing that key — which is the static-build constraint again, and the reason this row names the key.',
  },
  {
    id: 'escalate-from-chat-to-a-person',
    surface: 'chat',
    label: 'Escalate from chat to a person',
    status: 'built',
    summary:
      'Somebody the chat could not help hands the conversation over to a human without typing it all again.',
    source: [
      'apps/support/src/components/ChatDock.astro',
      'apps/support/src/lib/chat-core.ts',
      'apps/support/src/lib/chat-panel.ts',
      'apps/support/src/lib/submit.ts',
      'apps/support/src/pages/contact.astro',
    ],
    steps: [
      {
        label: 'The chat cannot answer',
        href: '/backups/reading-a-run/',
        caption:
          'Open the dock and ask twice. After two consecutive answers that cite nothing, the foot fills soft-primary and the reason unhides: "Two answers in a row found nothing in the documentation." A state reached by asking rather than by a parameter \u2014 so the URL is the page that HOLDS the dock.',
        edges: [
          {
            case: 'the assistant tells you where to go, and it is not a link',
            probe: 'broken',
            disposition: 'handled',
            where: 'ChatDock.astro:147',
            href: '/backups/reading-a-run/',
            note:
              'E91 · Was a defect while the only exit was a URL printed as prose inside a bubble. `Email support` is now a real control on the foot row, and it sits OUTSIDE `<form data-chat-form>` so the spent-budget gate cannot take it away with the composer. It read `Ask a person` until 2026-08-26; Dan ruled that nobody will reach a human in real time, and the present tense was promising exactly that. The control never did — it files a ticket and a person replies by email — so only the word changed.',
          },
          {
            case: 'you escalate from a page that was never written',
            probe: 'entry',
            disposition: 'decide',
            href: null,
            severity: 'low',
            note:
              'E96 · The handoff block does carry "Pages it cited that did not help", so an empty citation list travels. Nothing distinguishes "the docs were empty" from "the docs were wrong" in what support ends up reading.',
          },
        ],
      },
      {
        label: 'Hand the conversation over',
        href: '/backups/reading-a-run/',
        caption:
          'The transcript travels with the person. `Email support` writes the question, the page you were on, what the assistant answered and the pages it cited into `sessionStorage`, then navigates \u2014 nothing sensitive goes in the URL.',
        edges: [
          {
            case: 'nothing at all carries over: not the question, the page, the scope or the sources',
            probe: 'cross-step',
            disposition: 'handled',
            where: 'chat-core.ts:321-324',
            href: '/backups/reading-a-run/',
            note:
              'E93 · `buildHandoff` then `writeHandoff` into `sessionStorage[\'support-handoff\']`, read back by `wireHandoff` (`submit.ts:226-270`). Up to three of the person\u2019s own messages travel VERBATIM, plus the page, the assistant\u2019s answer and the citations. See X3.',
          },
          {
            case: 'the half-typed question you left in the chat is not offered to the form',
            probe: 'partial',
            disposition: 'decide',
            href: '/backups/reading-a-run/',
            severity: 'low',
            note:
              'E94 · Still true, and smaller than it was: SENT messages now travel, but the unsent draft in `localStorage[\'support-chat-draft\']` (`chat-core.ts:69-73`) is read by nothing on the far side. Decide whether an unsent sentence is part of the question or a private scratchpad.',
          },
          {
            case: 'the chat drawer stays open over the form you are now filling',
            probe: 'exit',
            disposition: 'defect',
            href: '/contact/?kind=ticket&from=chat',
            severity: 'medium',
            note:
              'E97 · The drawer is on every page (`DraftBanner.astro:22`) and `chat-panel.ts:118-132` restores its open state on every navigation, so it covers the right edge of the very form it just sent you to. Escalating is the one navigation that should close it.',
          },
          {
            case: 'contact offers to send you back to the chat you just left',
            probe: 'broken',
            disposition: 'decide',
            href: '/contact/',
            severity: 'low',
            note:
              'E98 · `contact.astro:157-159` and `submit.ts:162-165`: the loop is chat, contact, chat, with the fork in between. `?from=chat` now makes the outbound leg legible; the return leg still is not.',
          },
        ],
      },
      {
        label: 'The form arrives pre-filled',
        href: '/contact/?kind=ticket&from=chat',
        caption:
          'The ticket form with the conversation attached: a collapsible "From your chat" block carrying what the assistant tried and the pages it cited, a `Remove` control, and the body prefilled with the question if it was empty. `?from=chat` is what gates reading the payload.',
        edges: [
          {
            case: 'the form asks for your email as if you had never spoken',
            probe: 'identity',
            disposition: 'defect',
            href: '/contact/?kind=ticket&from=chat',
            severity: 'medium',
            note:
              'E95 · Sharpened by everything else landing. The conversation now travels and the identity does not: `submit.ts` never calls `readSession()` and never reads `?session`, so the only prefill is `readVoteEmail()` \u2014 an address remembered from the ROADMAP voting flow. Email is the identity key for the whole ticket system. See D3 and D12.',
          },
        ],
      },
      {
        label: 'Confirmation naming the conversation',
        href: null,
        caption:
          'A case that says which chat it came from, so the person answering does not open a ticket with no history behind it.',
        edges: [],
      },
    ],
    note:
      'BUILT 2026-08-21, and the registry called it planned for most of that day. Three of four steps are live; the last one is not, and it is not a stub \u2014 the confirmation reads "That would have gone to support" and names neither the conversation nor a case, because there is no case. Note also that this is PROMOTION rather than a second control: two consecutive uncited answers fill the foot, they do not add a button. And the thing underneath it all is still absent \u2014 every bot reply is one of three canned strings, so the escalation is real and the conversation it escalates is not.',
  },

  // ── Contact ───────────────────────────────────────────────────────────────
  {
    id: 'file-a-ticket-while-signed-out',
    surface: 'contact',
    label: 'File a ticket while signed out',
    status: 'built',
    summary:
      'Somebody with a broken thing describes it, attaches a screenshot and sends it, without having an account.',
    source: [
      'apps/support/src/pages/contact.astro',
      'apps/support/src/lib/submit.ts',
      'apps/support/src/components/RelatedToField.astro',
    ],
    steps: [
      {
        label: 'Choose a door',
        href: '/contact/',
        caption:
          'Five doors, and the deflection sits on the fork rather than on the page: search the documentation or ask the assistant, offered before anyone starts typing and never again once they have.',
        edges: [
          {
            case: 'a deep link opens one door directly, and an unknown one falls back to the fork',
            probe: 'entry',
            disposition: 'handled',
            where: 'submit.ts:49-53',
            href: '/contact/?kind=billing',
            note:
              'E99 · The guard reads the one `KINDS` list, so anything else falls through rather than erroring (`submit.ts:183-185`).',
          },
          {
            case:
              'a link straight to one door still flashes all five doors before the form appears',
            probe: 'static-build',
            disposition: 'defect',
            href: '/contact/?kind=billing',
            severity: 'medium',
            note:
              'E100 · The server always renders the fork; `submit.ts:185` runs from a bundled module `<script>` (`contact.astro:487-490`). The landing solved exactly this with a pre-paint inline script and `/contact` did not. UNVERIFIED in a browser. See D1 and X5.',
          },
          {
            case: 'the heading is rewritten by script and must match the one the server printed',
            probe: 'static-build',
            disposition: 'decide',
            href: '/contact/',
            severity: 'low',
            note:
              'E101 · `contact.astro:118-127` vs `submit.ts:109-136`. Both files state the rule; nothing enforces it. Add a gate, or accept.',
          },
          {
            case: 'Back from a form leaves the site entirely',
            probe: 'exit',
            disposition: 'defect',
            href: '/contact/?kind=ticket',
            severity: 'high',
            note:
              'E102 · `submit.ts:142-151` changes step without `pushState`, so the browser’s Back button has no step to go back to — including after submitting. See D4 and X1.',
          },
          {
            case: 'the new step starts at its own top, and a deep link deliberately does not scroll',
            probe: 'exit',
            disposition: 'handled',
            where: 'submit.ts:138-151',
            href: '/contact/?kind=ticket',
            note: 'E103 · `prefers-reduced-motion` is honoured.',
          },
          {
            case: 'five tiles in two rows that divide exactly',
            probe: 'one',
            disposition: 'handled',
            where: 'contact.astro:576-596',
            href: '/contact/',
            note: 'E104 · Six grid tracks so 3+2 divides, with the two common doors as the large pair.',
          },
          {
            case: 'a sixth door would break the grid the way the fifth broke the one before it',
            probe: 'many',
            disposition: 'decide',
            href: '/contact/',
            severity: 'low',
            note: 'E105 · `contact.astro:166-184` — the layout encodes "five".',
          },
          {
            case: 'with JavaScript off the whole contact page is inert',
            probe: 'broken',
            disposition: 'defect',
            href: '/contact/',
            severity: 'medium',
            note:
              'E106 · The fork tiles are `<button>`s with no `href` (`submit.ts:153-158`), and the only two real links on the page both point at `/` (`contact.astro:157-158`).',
          },
          {
            case: 'a "sign in to see your tickets" line under the sales door',
            probe: 'identity',
            disposition: 'defect',
            href: '/contact/?kind=sales',
            severity: 'medium',
            note:
              'E107 · `contact.astro:476-482` is a direct child of `.sb`, OUTSIDE every step, so it renders on all five forms and on the confirmation — including the door whose entire premise is that the reader has no account, and the public-request door, which has nothing to do with tickets.',
          },
          {
            case:
              'that link returns you to the form, not to your cases, and the address it returns to is mangled',
            probe: 'identity',
            disposition: 'defect',
            href: '/contact/',
            severity: 'medium',
            note:
              'E108 · `contact.astro:67` — `app.baseout.com/login?returnTo=https://support.baseout.com/contact`, unencoded, pointing at a form rather than at a list that does not exist.',
          },
          {
            case: 'the page says it is in the sidebar; it is not',
            probe: 'entry',
            disposition: 'defect',
            href: '/contact/',
            severity: 'low',
            note:
              'E109 · `contact.astro:134-139` carries `prev: false / next: false` with a comment explaining a sidebar entry that `astro.config.mjs:70-324` does not have. Harmless lines, stale comment.',
          },
          {
            case: 'the "search the docs instead" offer never appears over someone already typing',
            probe: 'cross-step',
            disposition: 'handled',
            where: 'contact.astro:145-153',
            href: '/contact/',
            note: 'E110 · Deflection lives inside the fork, not at page level.',
          },
        ],
      },
      {
        label: 'Describe the fault',
        href: '/contact/?kind=ticket',
        caption:
          'The private form. It says so above the fields — this goes privately to support, nothing here appears on the public board — because the page next door publishes what you write.',
        edges: [
          {
            case: 'you leave a required field blank',
            probe: 'empty',
            disposition: 'handled',
            where: 'submit.ts:405-410',
            href: '/contact/?kind=ticket',
            note:
              'E111 · "Your name is needed before this can be sent." The label text is read from the field’s own `<span>`, so the message cannot drift from the label.',
          },
          {
            case: 'you mistype your email address',
            probe: 'broken',
            disposition: 'handled',
            where: 'submit.ts:412-414',
            href: '/contact/?kind=ticket',
            note:
              'E112 · The regex is deliberately permissive — rejecting a valid address is the worse failure.',
          },
          {
            case: 'your address is already in the box and you never typed it here',
            probe: 'identity',
            disposition: 'decide',
            href: '/contact/?kind=ticket',
            severity: 'medium',
            note:
              'E113 · Pre-filled from the vote store (`submit.ts:384-385`, `votes.ts:72`). Convenience against surprise on a shared browser. See X2.',
          },
          {
            case: 'a billing question silently becomes the address used for your next vote',
            probe: 'identity',
            disposition: 'defect',
            href: '/contact/?kind=billing',
            severity: 'medium',
            note:
              'E114 · `submit.ts:416` runs `writeVoteEmail(email)` on every successful submit, with no dialog and nothing on screen. The other half of E113.',
          },
          {
            case: 'you refresh, and 600 words about a failed restore are gone',
            probe: 'exit',
            disposition: 'defect',
            href: '/contact/?kind=ticket',
            severity: 'high',
            note:
              'E115 · Nothing is written until submit (`submit.ts:398-425`). A refresh, a closed tab, an accidental Back, or clicking a duplicate suggestion all destroy the draft. The chat keeps one; this form does not. See D4 and X1.',
          },
          {
            case: 'Back to the fork keeps what you typed, and a different door starts empty',
            probe: 'partial',
            disposition: 'handled',
            where: 'submit.ts:156-158',
            href: '/contact/?kind=ticket',
            severity: 'low',
            note:
              'E116 · Accidentally correct: the section is only `hidden`, so the fields keep their values. Neither behaviour is announced.',
          },
          {
            case: 'a 40,000-character paste is accepted in silence',
            probe: 'long',
            disposition: 'decide',
            href: '/contact/?kind=ticket',
            severity: 'medium',
            note:
              'E120 · Subject and body have no cap and no counter (`contact.astro:281-289`); whatever backend lands will reject what this page accepted.',
          },
          {
            case: 'the hint tells you what to include, and what to leave out',
            probe: 'empty',
            disposition: 'handled',
            where: 'contact.astro:85-86',
            href: '/contact/?kind=ticket',
            note:
              'E121 · Run IDs, base names and error text — and "leave out anything you would not want support to read."',
          },
          {
            case: 'nothing suggests the article that answers your subject line',
            probe: 'partial',
            disposition: 'decide',
            href: '/contact/?kind=ticket',
            severity: 'medium',
            note:
              'E122 · `submit.ts:239-292` wires duplicate detection for `[data-dupe-input]` only, which exists once (`contact.astro:352`). The four commonest tickets are already written under `troubleshooting/*`. See D6.',
          },
          {
            case: 'a double-click files two tickets',
            probe: 'broken',
            disposition: 'defect',
            href: '/contact/?kind=ticket',
            severity: 'medium',
            note:
              'E123 · The button is never disabled and the handler is synchronous (`submit.ts:398-425`). Harmless while nothing is sent; a real backend gets two.',
          },
        ],
      },
      {
        label: 'Say what it is about',
        href: '/contact/?kind=ticket',
        caption:
          'The "related to" row, in the reader\'s own platform vocabulary. Fields are in the order a human asks the questions, not in the order a database wants them.',
        edges: [
          {
            case: 'you pick a platform and nothing downstream changes',
            probe: 'cross-step',
            disposition: 'handled',
            where: 'RelatedToField.astro:36-81',
            href: '/contact/?kind=ticket',
            severity: 'low',
            note:
              'E117 · Argued: it is collected for triage only. See D6 for the deflection this could drive.',
          },
          {
            case: 'there is no "a platform you do not support" option on this door',
            probe: 'one',
            disposition: 'handled',
            where: 'contact.astro:266-270',
            href: '/contact/?kind=ticket',
            note:
              'E118 · Deliberate — a fault always happened on a platform we run. `RelatedToField.astro:60-70`.',
          },
          {
            case: 'two of these fields in one form would share a name and answer for each other',
            probe: 'broken',
            disposition: 'defect',
            href: null,
            severity: 'low',
            note:
              'E119 · The computed group name at `RelatedToField.astro:33` is assigned and never used; all three instances render `name="about"` and stay independent only because they sit in separate `<form>` elements. Latent.',
          },
        ],
      },
      {
        label: 'Attach a screenshot',
        href: '/contact/?kind=ticket',
        caption:
          'Images and PDF, 10 MB per file, several files, each removable. The rule is stated before the picker opens, and the sentence the page shows is derived from the same constants the validator enforces.',
        edges: [
          {
            case: 'the rule is stated before the picker opens',
            probe: 'limit',
            disposition: 'handled',
            where: 'submit.ts:78-98',
            href: '/contact/?kind=ticket',
            note:
              'E159 · "PNG, JPG, GIF, WebP or PDF. Up to 5 files, 10.0 MB each." Derived from the same constants the validator enforces, so the prose cannot drift from the check (`contact.astro:300`).',
          },
          {
            case: 'one bad file in a good pick',
            probe: 'partial',
            disposition: 'handled',
            where: 'submit.ts:436-440',
            href: '/contact/?kind=ticket',
            note:
              'E160 · The acceptable files attach and the refused ones are named individually with what to do instead (`submit.ts:500-536`).',
          },
          {
            case: 'you pick a sixth file',
            probe: 'limit',
            disposition: 'handled',
            where: 'submit.ts:520-525',
            href: '/contact/?kind=ticket',
            note:
              'E161 · "5 files is the limit, so X was not added. Remove one first if you want to swap it."',
          },
          {
            case: 'a file over 10 MB',
            probe: 'limit',
            disposition: 'handled',
            where: 'submit.ts:514-519',
            href: '/contact/?kind=ticket',
            note: 'E162 · Names the actual size and suggests cropping or a link.',
          },
          {
            case: 'a second visit to the picker adds instead of replacing',
            probe: 'many',
            disposition: 'handled',
            where: 'submit.ts:72-76',
            href: '/contact/?kind=ticket',
            note:
              'E163 · Via `DataTransfer`, with the input left as the source of truth so a real submit is still `new FormData(form)` (`submit.ts:453-460`).',
          },
          {
            case: 'you re-pick the same screenshot and nothing happens at all',
            probe: 'broken',
            disposition: 'defect',
            href: '/contact/?kind=ticket',
            severity: 'low',
            note:
              'E164 · `submit.ts:507` ignores a duplicate (same name, size and mtime) with no message.',
          },
          {
            case: 'a file whose type the browser cannot name',
            probe: 'broken',
            disposition: 'handled',
            where: 'submit.ts:555-565',
            href: '/contact/?kind=ticket',
            note:
              'E165 · An empty MIME type falls back to an extension check. Explicitly not a security boundary.',
          },
          {
            case: 'you remove a row and focus does not fall to the floor',
            probe: 'exit',
            disposition: 'handled',
            where: 'submit.ts:547-551',
            href: '/contact/?kind=ticket',
            note:
              'E166 · Focus lands on the row that took its place, or the last row, or the picker button — never `<body>`.',
          },
          {
            case: 'you remove the only file',
            probe: 'empty',
            disposition: 'handled',
            where: 'submit.ts:480-486',
            href: '/contact/?kind=ticket',
            note: 'E167 · "X removed. Nothing attached." rather than going blank.',
          },
          {
            case: 'the count line does not say the same thing twice',
            probe: 'many',
            disposition: 'handled',
            where: 'submit.ts:531-535',
            href: '/contact/?kind=ticket',
            note:
              'E168 · The delta line is printed only when appending to files that were already there, because the count line is itself a live region.',
          },
          {
            case: 'you drag your screenshot onto the form and nothing happens',
            probe: 'broken',
            disposition: 'decide',
            href: '/contact/?kind=ticket',
            severity: 'medium',
            note:
              'E169 · No drag-and-drop is wired (`submit.ts:494-498`); the only route is the Choose files button. The single most expected gesture for "here is my screenshot".',
          },
          {
            case: 'you paste a clipboard screenshot and nothing happens',
            probe: 'broken',
            disposition: 'decide',
            href: '/contact/?kind=ticket',
            severity: 'medium',
            note: 'E170 · No paste handler exists — and pasting is how most people take a screenshot.',
          },
          {
            case: 'five files of ten megabytes each, accepted without a word',
            probe: 'limit',
            disposition: 'decide',
            href: '/contact/?kind=ticket',
            severity: 'low',
            note: 'E171 · `submit.ts:78-79` caps per file and not in total.',
          },
          {
            case: 'a screen recording is refused with advice that does not fit a video',
            probe: 'broken',
            disposition: 'defect',
            href: '/contact/?kind=ticket',
            severity: 'low',
            note:
              'E172 · The refusal is deliberate (`submit.ts:62-66`) but the message says "is not an image or a PDF… paste the text into the box above" (`submit.ts:509-513`), which is the wrong instruction for a `.mov`.',
          },
        ],
      },
      {
        label: 'Done — and what happens next',
        href: null,
        caption:
          'The confirmation. It exists as a step today and says the wrong thing for a signed-out person: there is no case number to give and no thread to return to, so it can only promise an email.',
        edges: [
          {
            case: 'the confirmation says the case is flagged as coming from someone not signed in',
            probe: 'identity',
            disposition: 'handled',
            where: 'submit.ts:346-349',
            href: null,
            note:
              'E124 · The one place the portal admits the anonymous/authenticated distinction to a user.',
          },
          {
            case: 'it says plainly that nothing was sent',
            probe: 'broken',
            disposition: 'handled',
            where: 'contact.astro:463-469',
            href: null,
            note:
              'E173 · "This portal has no backend yet — the form is complete and the submission is not."',
          },
          {
            case: 'each of the five confirmations names its own destination',
            probe: 'identity',
            disposition: 'handled',
            where: 'submit.ts:345-373',
            href: null,
            note:
              'E174 · Support, the board, billing, sales, the unsorted inbox — the one fact the person pressing submit is checking.',
          },
          {
            case: 'the only link out of the confirmation is "Back to the board"',
            probe: 'exit',
            disposition: 'defect',
            href: null,
            severity: 'high',
            note:
              'E175 · `contact.astro:470`, for all five doors. Four of the five have nothing to do with the board, and there is no "file another", no "back to the docs", no "here is what happens next".',
          },
          {
            case: 'no case number, no reference, and no copy of what you wrote',
            probe: 'partial',
            disposition: 'decide',
            href: null,
            severity: 'high',
            note:
              'E176 · `submit.ts:418-425`. The confirmation says a real submission "would send you a copy"; today the reader’s own words vanish the moment they press send. See D14 and X8.',
          },
          {
            case:
              'you refresh the confirmation and it is the fork again, with no evidence anything happened',
            probe: 'exit',
            disposition: 'defect',
            href: '/contact/',
            severity: 'medium',
            note: 'E183 · `submit.ts:183-185` reads `?kind=`, which the submit never sets.',
          },
          {
            case: 'nothing anywhere promises how long it will take',
            probe: 'broken',
            disposition: 'handled',
            where: 'submit.ts:345-373',
            href: null,
            note:
              'E184 · Bound decision honoured: the confirmations name a destination and an event, never a time. See X8 for the half that is missing.',
          },
        ],
      },
    ],
    note:
      'BUILT, WITH THE DONE-STATE STILL MOVING. Everything up to submit is real; the last step changes the moment the ticket surfaces land, because a case number is only meaningful when there is somewhere to type it.',
  },
  {
    id: 'file-a-ticket-while-signed-in',
    surface: 'contact',
    label: 'File a ticket while signed in',
    status: 'planned',
    summary:
      'Somebody we already know files the same ticket without re-typing who they are, and it lands in their own list.',
    source: ['apps/support/src/pages/contact.astro'],
    steps: [
      {
        label: 'Arrive already known',
        href: null,
        caption:
          'No email field, because we have it. The single row that separates this flow from the one above is the row that asks a customer who they are.',
        edges: [],
      },
      {
        label: 'Pick which Space it is about',
        href: null,
        caption:
          'A signed-in person can be asked which Space, which connection and which run — the three facts a support answer usually needs and a signed-out ticket usually lacks.',
        edges: [],
      },
      {
        label: 'Done — with a case in a list',
        href: '/requests/',
        caption:
          'The list a confirmation would point AT now exists — this is it. What does not exist is anything that puts a newly filed case into it: the reference printed on the confirmation is made up in the browser and matches nothing here.',
        edges: [],
      },
    ],
    note:
      'STILL PLANNED after 2026-08-21, and the distinction is worth reading rather than skipping: the ticket surfaces shipped that day and this flow did not. `/requests/` exists, so the destination of step 3 is real. But `contact.astro` and `lib/submit.ts` never call `readSession()` and never read `?session`, so there is NO signed-in composer — the form asks for name and email as free text on every visit, and the only prefill is `readVoteEmail()` from the roadmap. The sign-in note at the foot of `/contact/` still points at `https://app.baseout.com/login` rather than at `/requests/`, which is now a link the portal could make and does not. NO STEP HERE CARRIES AN EDGE ROW, deliberately: the walk probed the signed-in surfaces once, on `see-my-requests` and `read-and-answer-a-thread`, and duplicating those rows onto a third planned flow would make one question look like three. The identity rows that decide whether this flow can exist at all are E236, E244 and D12.',
  },
  {
    id: 'ask-about-billing-sales-or-something-else',
    surface: 'contact',
    label: 'Ask about billing · sales · something else',
    status: 'built',
    summary:
      'Somebody whose question is not a fault picks the right door — billing, sales or anything else — and gets a form shaped for it.',
    shape: 'states', // one `/contact/` in five `?kind=` doors, and nobody walks them in order
    source: [
      'apps/support/src/pages/contact.astro',
      'apps/support/src/lib/submit.ts',
    ],
    steps: [
      {
        label: 'The fork, all five doors',
        href: '/contact/',
        caption:
          'Position is the argument here. "Something else" is last in the list, last in the DOM, last in the tab order and last in the grid — a catch-all at equal weight collects everyone who would have chosen correctly.',
        edges: [],
      },
      {
        label: 'Account and billing',
        href: '/contact/?kind=billing',
        caption:
          'It exists because invoice questions were being mis-routed into the broken-thing door, which told the person writing that their problem was a fault. Private like a ticket, and it must never carry the public-board warning.',
        edges: [
          {
            case: 'no "which platform" question on this door',
            probe: 'cross-step',
            disposition: 'handled',
            where: 'contact.astro:266-270',
            href: '/contact/?kind=billing',
            note:
              'E143 · A billing question is not about a platform, and asking would be a required-looking control with no right answer.',
          },
          {
            case: 'anyone can file a billing ticket against anyone’s address',
            probe: 'identity',
            disposition: 'decide',
            href: '/contact/?kind=billing',
            severity: 'medium',
            note:
              'E144 · The reader almost certainly has an account and the form asks for their email so the case can be matched to it (`contact.astro:279`) — and cannot verify it. See D12.',
          },
          {
            case: 'a link straight from an invoice email',
            probe: 'entry',
            disposition: 'handled',
            where: 'submit.ts:175-182',
            href: '/contact/?kind=billing',
            note: 'E145 · The named use case, and it works.',
          },
          {
            case: 'a month-old invoice link pre-fills the wrong address into a billing ticket',
            probe: 'entry',
            disposition: 'defect',
            href: '/contact/?kind=billing',
            severity: 'medium',
            note:
              'E146 · E113 compounding: the vote email in the browser may belong to a different person entirely.',
          },
        ],
      },
      {
        label: 'The hint that stops a card number',
        href: '/contact/?kind=billing',
        caption:
          'The body hint names the last four digits as enough and says never send a full number — before the box, not after. Once a card number is in a ticket it is in a mailbox, a database and a backup.',
        edges: [
          {
            case: 'the unsafe field is named before the box, not after it',
            probe: 'identity',
            disposition: 'handled',
            where: 'contact.astro:95-99',
            href: '/contact/?kind=billing',
            note:
              'E141 · "the last four digits of the card if a payment failed. Never send a full card number." The single best copy decision on the page.',
          },
          {
            case: 'the warning is copy only, and a full card number goes through',
            probe: 'broken',
            disposition: 'decide',
            href: '/contact/?kind=billing',
            severity: 'medium',
            note:
              'E142 · Nothing detects or refuses 16 digits in the body (`submit.ts:398-425`) and nothing scrubs an attachment (`submit.ts:555-565`). See D11.',
          },
        ],
      },
      {
        label: 'A pre-customer question',
        href: '/contact/?kind=sales',
        caption:
          'The one door that does not assume an account already exists behind it, and the one whose confirmation does not reuse the support wording — because its destination is not support.',
        edges: [
          {
            case:
              'the platform question comes first, because it is the one answer that changes everything under it',
            probe: 'one',
            disposition: 'handled',
            where: 'contact.astro:416-423',
            href: '/contact/?kind=sales',
            note: 'E147 · "Do you support Notion yet" is the shape of most pre-sales questions.',
          },
          {
            case: 'the email hint here does not offer to find an account you do not have',
            probe: 'identity',
            disposition: 'handled',
            where: 'contact.astro:432-435',
            href: '/contact/?kind=sales',
            note:
              'E148 · "We reply here. You do not need an account." — different from the other three doors on purpose.',
          },
          {
            case: 'and the foot of the same page tells you to sign in to see your tickets',
            probe: 'identity',
            disposition: 'defect',
            href: '/contact/?kind=sales',
            severity: 'medium',
            note:
              'E149 · `contact.astro:476-482`. The one door built on the premise that there is no account carries a sign-in prompt under it. The sales instance of E107.',
          },
          {
            case: 'no attachments on this door',
            probe: 'partial',
            disposition: 'handled',
            where: 'contact.astro:388-397',
            href: '/contact/?kind=sales',
            note:
              'E150 · Argued rather than omitted: a person who has not used the product has no artefact to attach.',
          },
          {
            case: 'the confirmation must not say "support", and does not',
            probe: 'cross-step',
            disposition: 'handled',
            where: 'submit.ts:361-368',
            href: null,
            note: 'E151 · The desk it names is sales.',
          },
          {
            case: 'a prospect who asked about pricing is sent to a feature-request board',
            probe: 'exit',
            disposition: 'defect',
            href: '/contact/?kind=sales',
            severity: 'medium',
            note:
              'E152 · `contact.astro:470` — "Back to the board" is the only link on every confirmation. See E175.',
          },
          {
            case:
              'the door most likely to be found by a stranger links to no pricing and no product site',
            probe: 'entry',
            disposition: 'decide',
            href: '/contact/?kind=sales',
            severity: 'medium',
            note:
              'E153 · The meta description enumerates the doors (`contact.astro:129-132`), and this is the only one whose reader has never seen the product.',
          },
          {
            case: 'the one place a platform outside the list is captured, and it goes nowhere',
            probe: 'empty',
            disposition: 'decide',
            href: '/contact/?kind=sales',
            severity: 'low',
            note:
              'E154 · `RelatedToField.astro:73-80`. Should a sales answer of "a platform you do not support" seed a roadmap candidate, as the request door’s does?',
          },
        ],
      },
      {
        label: 'Something else',
        href: '/contact/?kind=other',
        caption:
          'The catch-all, and its promise: if it turns out to be a fault or an idea, we move it to the right place rather than asking the reader to file it again.',
        edges: [
          {
            case: 'the catch-all is last everywhere it appears',
            probe: 'partial',
            disposition: 'handled',
            where: 'submit.ts:44-47',
            href: '/contact/?kind=other',
            note:
              'E155 · Last in the list, in the DOM, in the tab order and in the grid — deliberately, so it collects only the people who genuinely could not choose.',
          },
          {
            case: 'the hint promises a human will move it to the right place',
            probe: 'empty',
            disposition: 'decide',
            href: '/contact/?kind=other',
            severity: 'medium',
            note:
              'E156 · `contact.astro:107-109` and `submit.ts:369-372` commit to a triage process with no owner named anywhere. See D13.',
          },
          {
            case: 'a triager moves your private message onto the public board',
            probe: 'cross-step',
            disposition: 'defect',
            href: null,
            severity: 'high',
            note:
              'E157 · The public warning is on one door only (`contact.astro:336-342`), so a submitter here never consented to publication.',
          },
          {
            case: 'no "which platform" question on the door where a platform oddity most often lands',
            probe: 'cross-step',
            disposition: 'decide',
            href: '/contact/?kind=other',
            severity: 'low',
            note:
              'E158 · Same argument as billing (`contact.astro:266-270`), with the opposite consequence.',
          },
        ],
      },
    ],
    note:
      'The first step carries no edge rows because the fork is ONE screen shared by five doors, and the twelve rows that probe it (E99–E110) sit on the step where a reader first meets it, in `file-a-ticket-while-signed-out`. Repeating them here would be the same defect written twice and corrected once.',
  },
  {
    id: 'submit-a-public-feature-request',
    surface: 'contact',
    label: 'Submit a public feature request',
    status: 'built',
    summary:
      'Somebody asks for something the product does not do yet, in public, where other people can vote for it.',
    source: [
      'apps/support/src/pages/contact.astro',
      'apps/support/src/lib/submit.ts',
      'apps/support/src/data/requests.ts',
    ],
    steps: [
      {
        label: 'The public door',
        href: '/contact/?kind=request',
        caption:
          'The one form on this page that publishes. It says so before the first field — the private doors say the opposite, and the difference has to be visible without reading either.',
        edges: [
          {
            case: 'you are told what will be public before you type anything',
            probe: 'identity',
            disposition: 'handled',
            where: 'contact.astro:336-342',
            href: '/contact/?kind=request',
            note:
              'E136 · "This will be visible to everyone… Your email never does." Four of five doors are private; only this one warns, and the warning is pre-emptive rather than a footnote (`contact.astro:22-27`).',
          },
          {
            case:
              'no attachments here, because a screenshot is how customer data reaches a public board',
            probe: 'identity',
            disposition: 'handled',
            where: 'contact.astro:39-44',
            href: '/contact/?kind=request',
            note: 'E137 · A privacy safeguard, not a UX omission.',
          },
        ],
      },
      {
        label: 'One line, as you would say it',
        href: '/contact/?kind=request',
        caption:
          'A title, not a summary field. The board is read by other customers, and a request titled like a bug report gets no votes.',
        edges: [
          {
            case: 'a 200-character display name collapses the card it lands on',
            probe: 'long',
            disposition: 'defect',
            href: '/contact/?kind=request',
            severity: 'medium',
            note:
              'E138 · "Name to show on the board" has no length limit (`contact.astro:367-370`), and `RequestCard.astro:127-134` records that unbounded text in that slot once collapsed the reading column from 293px to 173px.',
          },
        ],
      },
      {
        label: 'Which platform, if any',
        href: '/contact/?kind=request',
        caption:
          'The "related to" row allows a value that is not on the list, which is how a request for a platform we do not support yet gets filed at all.',
        edges: [
          {
            case: 'a stale or hand-edited about= value',
            probe: 'broken',
            disposition: 'handled',
            where: 'submit.ts:220-232',
            href: '/contact/?kind=request',
            note:
              'E126 · Falls through to the default rather than leaving the radio group with nothing selected.',
          },
          {
            case: 'the "which platform?" box is required only while it is the answer',
            probe: 'partial',
            disposition: 'handled',
            where: 'submit.ts:209-216',
            href: '/contact/?kind=request&about=new-platform',
            note:
              'E127 · A hidden required field would block submit with a message pointing at an invisible control.',
          },
        ],
      },
      {
        label: 'Suggest a platform',
        href: '/contact/?kind=request&about=new-platform',
        caption:
          'The board\'s own "suggest a platform" tile lands here with the first two questions already answered. Asking again after somebody walked through a door is the same discourtesy as asking which door they wanted.',
        edges: [
          {
            case: 'the board’s own tile pre-selects the radio and focuses the only unanswered box',
            probe: 'entry',
            disposition: 'handled',
            where: 'submit.ts:203-235',
            href: '/contact/?kind=request&about=new-platform',
            note: 'E125 · `roadmap.astro:273` links it. The best micro-interaction in the portal.',
          },
        ],
      },
      {
        label: 'Done — and where it went',
        href: null,
        caption:
          'The confirmation. There is no backend, so nothing is sent and nothing appears on the board; what a real one has to say is which public page the request now lives on.',
        edges: [
          {
            case: 'the confirmation promises a status the board’s own vocabulary forbids',
            probe: 'cross-step',
            disposition: 'defect',
            href: null,
            severity: 'high',
            note:
              'E139 · `submit.ts:350-352` says it would post as Planned for a moderator to review. The board’s intake state is Suggested, and `requests.ts:25-41` is explicit that Planned means we agreed.',
          },
          {
            case: 'it says it would count your vote, and no count exists',
            probe: 'cross-step',
            disposition: 'decide',
            href: null,
            severity: 'low',
            note:
              'E140 · `submit.ts:352` against `votes.ts:15` — `VOTES_LIVE = false`. Acceptable as a statement about the future, if that is the ruling.',
          },
        ],
      },
    ],
  },
  {
    id: 'hit-a-duplicate-while-submitting-a-request',
    surface: 'contact',
    label: 'Hit a duplicate while submitting a request',
    status: 'built',
    summary:
      'Somebody starts typing a request that already exists and is shown it before they finish writing.',
    source: [
      'apps/support/src/lib/submit.ts',
      'apps/support/src/lib/pagefind.ts',
      'apps/support/src/pages/roadmap/[slug].astro',
    ],
    steps: [
      {
        label: 'Start typing a title',
        href: '/contact/?kind=request',
        caption:
          'Duplicate detection runs off the title as it is typed. It queries the docs index, not a second search: every request has its own page under `/roadmap/`, so Pagefind already holds them.',
        edges: [
          {
            case: 'duplicate detection is dead on a dev server and says nothing',
            probe: 'static-build',
            disposition: 'handled',
            where: 'submit.ts:9-11',
            href: '/contact/?kind=request',
            severity: 'medium',
            note:
              'E128 · Documented: `pagefind.ts:41-61` returns nothing without a build. Verifying it means a real build served from `dist/`.',
          },
          {
            case: 'fewer than four characters asks nothing',
            probe: 'empty',
            disposition: 'handled',
            where: 'submit.ts:25',
            href: '/contact/?kind=request',
            note: 'E129 · The box stays hidden and no query runs (`submit.ts:286-289`).',
          },
          {
            case: 'a whole-phrase query that would otherwise match nothing',
            probe: 'many',
            disposition: 'handled',
            where: 'submit.ts:294-341',
            href: '/contact/?kind=request',
            note:
              'E130 · Pagefind ANDs its terms, so the fallback asks per meaningful word and requires TWO hits before interrupting anyone. A repaired defect, not a feature.',
          },
        ],
      },
      {
        label: 'Something like this already exists',
        href: '/contact/?kind=request',
        caption:
          'The suggestions appear under the field, each a link to the request\'s own page. Two shared words is the floor — one is a coincidence, because "backup" appears on nearly every page we own.',
        edges: [
          {
            case: 'exactly one similar request',
            probe: 'one',
            disposition: 'handled',
            where: 'submit.ts:260-263',
            href: '/contact/?kind=request',
            note: 'E131 · "One request looks similar — is it yours?", correctly singular.',
          },
          {
            case: 'three suggestions, each wearing its status',
            probe: 'limit',
            disposition: 'handled',
            where: 'submit.ts:265-280',
            href: '/contact/?kind=request',
            note:
              'E132 · `MAX_DUPES` is 3, and the status badge is what makes "Already exists" pay for the interruption immediately.',
          },
          {
            case: 'delete the request pages and detection returns nothing, forever, silently',
            probe: 'broken',
            disposition: 'handled',
            where: 'submit.ts:4-7',
            href: '/roadmap/restore/',
            severity: 'medium',
            note:
              'E135 · Documented in three files (`[slug].astro:9-12`, `search-modal.ts:42-52`). Nothing in `submit.ts` could see it happen.',
          },
        ],
      },
      {
        label: 'Go and vote on it instead',
        href: '/roadmap/restore/',
        caption:
          'Where a suggestion goes. The detail pages are load-bearing beyond being nice to read: delete them and duplicate detection silently returns nothing.',
        edges: [
          {
            case: 'you click a suggestion to check it and your half-written request is gone',
            probe: 'exit',
            disposition: 'defect',
            href: '/roadmap/restore/',
            severity: 'high',
            note:
              'E133 · `submit.ts:274` renders a plain same-tab link — no `target`, no confirmation, no draft. The feature designed to save the reader work is the fastest way to lose theirs. See X1.',
          },
        ],
      },
      {
        label: 'Or file it anyway',
        href: '/contact/?kind=request',
        caption:
          'The suggestions never block submission. A reader who has read the near-match and still thinks theirs is different is usually right, and interrupting them twice is how a suggestion box becomes noise.',
        edges: [
          {
            case:
              'a request filed since the last deploy is invisible to the next person’s duplicate check',
            probe: 'stale',
            disposition: 'decide',
            href: '/contact/?kind=request',
            severity: 'medium',
            note:
              'E134 · `[slug].astro:23-25` is `getStaticPaths` over a fixture array, so a new request has no page until the next build. On a live board that is the difference between "no duplicates" and "no duplicates yet". See D10.',
          },
        ],
      },
    ],
    note:
      'A TITLE IS A PHRASE AND PAGEFIND ANDs. Querying "restore data from a backup" whole asks for a page containing every word and matched nothing, while the index plainly held `/roadmap/restore/`. So: try the phrase, then ask about each meaningful word and rank by overlap. On a dev server this whole flow silently does nothing, because Pagefind is build-time.',
  },
  {
    id: 'follow-up-on-a-case-i-filed',
    surface: 'contact',
    label: 'Follow up on a case I filed',
    status: 'planned',
    summary:
      'Somebody comes back to a case they already filed, from the email we sent them, and adds what they forgot.',
    source: ['apps/support/src/pages/contact.astro'],
    steps: [
      {
        label: 'The email arrives',
        href: null,
        caption:
          'Whatever we send has to carry a way back in. A confirmation with no return address makes the reply the only channel, and a reply lands in a mailbox nobody has built.',
        edges: [
          {
            case: 'the email never arrives',
            probe: 'broken',
            disposition: 'decide',
            href: null,
            severity: 'high',
            note:
              'E177 · Spam, a typo, or a corporate filter. There is no address confirmation, no "check your spam", no way to re-send — and per the bound decision no portal view to fall back on. The case is unreachable. See D14 and X8.',
          },
          {
            case: 'you typed the wrong address, and the case exists against one you do not own',
            probe: 'identity',
            disposition: 'decide',
            href: null,
            severity: 'high',
            note:
              'E178 · `submit.ts:412-414` validates shape only; there is no verification and no correction path. See D12.',
          },
        ],
      },
      {
        label: 'Open the case from the email',
        href: '/requests/BO-7QX9-K4TD/?session=out',
        caption:
          'A signed-out person following a link from their own inbox. The case URL now exists and the locked panel returns them to THAT case after sign-in — what does not exist is the email that would carry the link.',
        edges: [
          {
            case: 'you half-remember a page for your tickets and get the contact form',
            probe: 'entry',
            disposition: 'defect',
            href: '/tickets',
            severity: 'high',
            note:
              'E181 · The reader-facing face of E42, and WORSE since 2026-08-21 rather than better: `astro.config.mjs:22` still sends `/tickets` to `/contact`, and there is now a real list at `/requests/` for it to have gone to instead. Open the link — it is a one-click bug report. See E242.',
          },
          {
            case: 'you write in from a different address and are simply not shown the case',
            probe: 'identity',
            disposition: 'decide',
            href: null,
            severity: 'medium',
            note: 'E180 · With no list to explain it on, there is nowhere to state the rule.',
          },
          {
            case: 'a reply link that is a month old',
            probe: 'stale',
            disposition: 'decide',
            href: null,
            note:
              'E182 · Nothing in the portal is addressable per case, so there is no link to age — which is the finding, not the mitigation. See D14.',
          },
        ],
      },
      {
        label: 'Add what you forgot',
        href: '/requests/BO-7QX9-K4TD/?session=in',
        caption:
          'The commonest follow-up is a screenshot the person did not have when they wrote. The composer on the case now takes it — the same 5 \u00d7 10 MB rule as `/contact` — so a second ticket is no longer the only route, for anybody who can reach the case.',
        edges: [
          {
            case: 'the page promises a merge that nothing implements',
            probe: 'identity',
            disposition: 'decide',
            href: '/contact/',
            severity: 'medium',
            note:
              'E179 · `contact.astro:476-482`: "One opened without an account is still yours — sign in later with the same address and it will be there." That is a specification, written on a live page. See D12.',
          },
        ],
      },
    ],
    note:
      'The email itself is the undesigned half. Everything above depends on a decision nobody has taken: whether a signed-out person gets a link with a token in it, or has to sign in.',
  },

  // ── Roadmap ───────────────────────────────────────────────────────────────
  {
    id: 'browse-the-roadmap',
    surface: 'roadmap',
    label: 'Browse the roadmap',
    status: 'built',
    summary:
      'Somebody looks at what is being built, narrows it to what concerns them, and opens one item.',
    source: [
      'apps/support/src/pages/roadmap.astro',
      'apps/support/src/lib/board.ts',
      'apps/support/src/components/RequestCard.astro',
      'apps/support/src/data/requests.ts',
    ],
    steps: [
      {
        label: 'The board',
        href: '/roadmap/',
        caption:
          'Position encodes kind: the status columns, then the platform section, then what has been suggested. The filter bar is two named tiers separated by a rule, because scope and status are different questions and a single row of chips says they are the same one.',
        edges: [
          {
            case: 'you click the chip that says "Planned 6" and count five cards',
            probe: 'many',
            disposition: 'defect',
            href: '/roadmap/',
            severity: 'high',
            note:
              'E185 · The chips count all 27 requests (`requests.ts:583-584`); the column heads count feature requests only (`roadmap.astro:86-89`). Measured: chip Planned 6 over head Planned 5, chip In progress 4 over head 3, chip Suggested 10 over section head 7. The difference is the five platform candidates, which live in their own section. See X4.',
          },
          {
            case: 'a column with nothing in it',
            probe: 'empty',
            disposition: 'handled',
            where: 'roadmap.astro:231',
            href: '/roadmap/',
            note:
              'E187 · "Nothing here yet." rather than collapsing, so the shape of the board does not change under a filter.',
          },
          {
            case: 'the intake list is one full-width column because it is the one with no ceiling',
            probe: 'many',
            disposition: 'handled',
            where: 'roadmap.astro:283-304',
            href: '/roadmap/',
            note:
              'E195 · `requests.ts:51-57`. A column of three beside a column of forty breaks in the first week.',
          },
          {
            case: 'a visibly stale intake list reads as "nobody works here"',
            probe: 'stale',
            disposition: 'decide',
            href: '/roadmap/',
            severity: 'high',
            note:
              'E196 · `requests.ts:31-37` says Suggested is a commitment to triage — a person, a cadence, and a rule for when a row leaves the list — and "Do not ship it without one." See D13.',
          },
          {
            case: 'no sort, no search and no pagination, and nothing says what order a column is in',
            probe: 'many',
            disposition: 'decide',
            href: '/roadmap/',
            severity: 'medium',
            note:
              'E197 · 27 rows today, in fixture order (`roadmap.astro:301-303`). At 200 the Suggested list is a wall. See D15.',
          },
        ],
      },
      {
        label: 'Narrow the scope',
        href: '/roadmap/',
        caption:
          'The platform segments above the status chips. A platform choice is as deliberate as picking a status, which is why it gets its own tier rather than a sixth chip.',
        edges: [
          {
            case: 'two cards appear in a fourth column with nothing naming it',
            probe: 'partial',
            disposition: 'defect',
            href: '/roadmap/?platform=airtable',
            severity: 'medium',
            note:
              'E188 · Four of the five groups wear the one head system (`roadmap.astro:59-64`); `rb-col-terminal` has none (`:237-239`).',
          },
          {
            case: 'filter to "Already exists" and the whole board is one unheaded card',
            probe: 'partial',
            disposition: 'defect',
            href: '/roadmap/',
            severity: 'medium',
            note:
              'E189 · `board.ts:69-86` — one row, terminal, every column and section hidden. UNVERIFIED visually.',
          },
          {
            case: 'the terminal group is revealed by either facet, not only by status',
            probe: 'cross-step',
            disposition: 'handled',
            where: 'board.ts:72-85',
            href: '/roadmap/?platform=airtable',
            note:
              'E190 · A repaired defect: a platform chip saying "Airtable 5" that revealed 3 is a count that lies about what clicking it shows.',
          },
          {
            case:
              'a platform choice here hides untagged items, which is the opposite of the docs filter',
            probe: 'cross-step',
            disposition: 'handled',
            where: 'board.ts:58-65',
            href: '/roadmap/?platform=airtable',
            note:
              'E191 · An amber notice says so and offers "Show all" (`roadmap.astro:211-217`). It is the only one of the two controls that explains itself. See X6.',
          },
          {
            case: '"Not seeing your platform?" jumps to a section the current filter has hidden',
            probe: 'broken',
            disposition: 'defect',
            href: '/roadmap/',
            severity: 'medium',
            note:
              'E193 · `roadmap.astro:185` targets `#rb-platforms`; under a status filter that empties it, `board.ts:85` hides the target and the jump does nothing visible.',
          },
          {
            case: 'a filtered board cannot be shared, bookmarked, or returned to',
            probe: 'exit',
            disposition: 'defect',
            href: '/roadmap/',
            severity: 'medium',
            note:
              'E194 · `board.ts:44-45` holds the filter in plain locals with no `replaceState` — in an app where the docs filter is mirrored to `?platform=` on every change. See D15.',
          },
          {
            case: 'the scope control wraps to two rows at five platforms',
            probe: 'platform-count',
            disposition: 'defect',
            href: '/roadmap/',
            severity: 'medium',
            note:
              'E23 · `roadmap.astro:151-186` is a hand-rolled segmented row, not `PlatformPicker`, and it grows one button per platform with no collapse. The exact failure `PlatformPicker` was built to end, still present on this one surface. See D19.',
          },
          {
            case: 'two platform chips that count nothing, beside a candidate for each',
            probe: 'platform-count',
            disposition: 'defect',
            href: '/roadmap/',
            severity: 'high',
            note:
              'E268 · `platform-smartsheet` and `platform-monday` are exactly the candidates `requests.ts:114-126` says must carry no `platform` id, on the argument that "we do not ship its mark because we do not ship it" — and both now ship marks. `countByPlatform` (`requests.ts:596-597`) therefore renders Smartsheet 0 and Monday 0. See D20.',
          },
        ],
      },
      {
        label: 'Narrowed to nothing',
        href: '/roadmap/',
        caption:
          'When a scope leaves the board empty the page says which choice did it and offers "Show all", rather than rendering three empty columns. Two of them reads as two errors and a result.',
        edges: [
          {
            case: 'both facets true of nothing',
            probe: 'empty',
            disposition: 'handled',
            where: 'roadmap.astro:306-310',
            href: '/roadmap/',
            note:
              'E186 · "No requests match both filters. Widen one of them to see the rest." (`board.ts:88`).',
          },
        ],
      },
      {
        label: 'One request',
        href: '/roadmap/schema-map/',
        caption:
          'Every request has its own page — for reading, for linking, and because duplicate detection on the request form is built on their being indexed.',
        edges: [
          {
            case: 'a long title or a long author name',
            probe: 'long',
            disposition: 'handled',
            where: 'RequestCard.astro:36-42',
            href: '/roadmap/schema-map/',
            note:
              'E198 · A repaired defect: the author sits in its own `auto` grid track so unbounded text cannot collapse the reading column, and the vote button is the only thing allowed in the corner (`RequestCard.astro:127-134`).',
          },
          {
            case: 'untagged means Baseout itself, and the card says "ALL PLATFORMS"',
            probe: 'platform-count',
            disposition: 'decide',
            href: '/roadmap/schema-map/',
            severity: 'low',
            note:
              'E199 · `RequestCard.astro:24-28,110-113` prints it behind a globe so the subject slot is never empty — but `requests.ts:114-126` gives the absent field two different meanings spoken as one label.',
          },
          {
            case: 'every request has a real page, and that is what makes duplicate detection possible',
            probe: 'entry',
            disposition: 'handled',
            where: '[slug].astro:9-12',
            href: '/roadmap/two-way-sync/',
            note: 'E200 · Deleting them breaks detection silently. See E135.',
          },
          {
            case: 'a link from an old email after a slug rename',
            probe: 'stale',
            disposition: 'decide',
            href: null,
            severity: 'low',
            note:
              'E201 · A hard 404: `[slug].astro:23-25` has no redirect table, unlike the docs (`astro.config.mjs:22-27`).',
          },
          {
            case: 'dates in US format on a site with a language selector in its header',
            probe: 'broken',
            disposition: 'defect',
            href: '/roadmap/schema-map/',
            severity: 'low',
            note:
              'E202 · `[slug].astro:49-53` hard-codes `toLocaleDateString(\'en-US\', …)`; `Header.astro:100-102` offers a `LanguageSelect`.',
          },
          {
            case: 'a rejected request explains itself, and "Already exists" must prove it',
            probe: 'empty',
            disposition: 'handled',
            where: '[slug].astro:115-120',
            href: '/roadmap/schema-map/',
            note:
              'E203 · `Not planned` carries a `reason` block; `Already exists` is REQUIRED to carry a `docs` link, because the page that proves it is the whole answer (`requests.ts:18-23`).',
          },
        ],
      },
      {
        label: 'Suggest a platform',
        href: '/contact/?kind=request&about=new-platform',
        caption:
          'The platform section\'s own door out. It pre-answers the two questions the request form would otherwise ask.',
        edges: [
          {
            case:
              'narrow to any platform and three of the five candidates vanish, taking the tile with them',
            probe: 'many',
            disposition: 'defect',
            href: '/roadmap/?platform=airtable',
            severity: 'medium',
            note:
              'E192 · `requests.ts:540-577` — `monday`, `trello` and `smartsheet` carry no `platform` id, so every chip hides them; `.rb-newp` has no `data-slug` (`roadmap.astro:264-279`) so it is only ever hidden with its section.',
          },
        ],
      },
    ],
    note:
      'The board\'s scope control does NOT read `?platform=` — `lib/board.ts` collects its facets from `data-plat-filter` and starts at "all" on every load. It is the one platform surface in the portal whose state is not shareable, and the comparison below is what shows that.',
  },
  {
    id: 'vote-on-a-request',
    surface: 'roadmap',
    label: 'Vote on a request',
    status: 'built',
    summary:
      'Somebody backs a request so that we know how many people want it.',
    source: [
      'apps/support/src/lib/votes.ts',
      'apps/support/src/lib/board.ts',
      'apps/support/src/components/RequestCard.astro',
      'apps/support/src/pages/roadmap/[slug].astro',
    ],
    steps: [
      {
        label: 'A card with a vote control',
        href: '/roadmap/',
        caption:
          'The control is live and the COUNT is not. `VOTES_LIVE = false` gates the number, not the feature: a board showing 3 votes on everything says the product has no users, which is a worse thing to publish than no number at all.',
        edges: [
          {
            case: 'the button works and no count appears anywhere',
            probe: 'broken',
            disposition: 'handled',
            where: 'votes.ts:15',
            href: '/roadmap/',
            note:
              'E204 · `VOTES_LIVE = false`. The vote is remembered locally and the board says so in a note (`roadmap.astro:127-132`, `board.ts:139`).',
          },
          {
            case: 'a shipped item still offers you a vote',
            probe: 'empty',
            disposition: 'defect',
            href: '/roadmap/',
            severity: 'medium',
            note:
              'E218 · The spec says shipped items do not vote (`support-portal/specs/support-portal/spec.md:32`); `RequestCard.astro:135-148` renders the button for every status without exception. See X4.',
          },
          {
            case: 'the same request carries a vote button on three different screens',
            probe: 'cross-step',
            disposition: 'defect',
            href: '/roadmap/',
            severity: 'low',
            note:
              'E216 · `wireBoard()` runs on the landing, the board and the detail page (`LandingBody.astro:387-396`, `roadmap.astro:314-317`, `[slug].astro:150-153`) and the vote is keyed by slug, so the three agree — but calling it twice on one page would double-toggle and nothing prevents it (`board.ts:147-160`).',
          },
          {
            case: 'nothing stops you voting for all 27',
            probe: 'limit',
            disposition: 'decide',
            href: '/roadmap/',
            severity: 'low',
            note: 'E217 · No per-person cap, no ranking, no "you have five votes".',
          },
        ],
      },
      {
        label: 'Vote from the detail page',
        href: '/roadmap/two-way-sync/',
        caption:
          'The same control, the same gate. A request\'s own page and its card must never disagree about whether voting is possible.',
        edges: [
          {
            case: 'the vote button once died silently on nine detail pages',
            probe: 'broken',
            disposition: 'handled',
            where: 'board.ts:19-27',
            href: '/roadmap/two-way-sync/',
            note:
              'E208 · A repaired defect: an early return on a missing `[data-board]` disabled it. Filtering is now conditional and voting unconditional.',
          },
          {
            case: 'you misclick and can take it back',
            probe: 'partial',
            disposition: 'handled',
            where: 'votes.ts:52-69',
            href: '/roadmap/two-way-sync/',
            note:
              'E207 · A repaired defect: the first board wrote the vote once and returned early ever after, so a misclick was permanent.',
          },
        ],
      },
      {
        label: 'Say who you are',
        href: null,
        caption:
          'One vote per email. The email step is a privacy safeguard as much as a de-duplicator, and it is the fork where an anonymous board becomes an identified one.',
        edges: [
          {
            case: 'the first vote of a session asks for an email',
            probe: 'identity',
            disposition: 'handled',
            where: 'board.ts:167-213',
            href: '/roadmap/',
            note:
              'E205 · A real `<dialog>`, so focus containment, Escape and the backdrop come from the platform rather than from us.',
          },
          {
            case: 'it promises to tell you when this moves, and nothing is recorded anywhere',
            probe: 'identity',
            disposition: 'defect',
            href: '/roadmap/',
            severity: 'high',
            note:
              'E209 · `board.ts:176-185`. Unlike `/contact` and the page-rating widget, this dialog carries no "nothing is sent" note — the address goes to `localStorage` (`votes.ts:72-79`) and is read by nothing except the contact form’s pre-fill (`submit.ts:385`). See X2 and X9.',
          },
          {
            case: 'the address is asked once and reused forever, with no way to see or change it',
            probe: 'identity',
            disposition: 'defect',
            href: '/roadmap/',
            severity: 'medium',
            note: 'E210 · `votes.ts:71-79` — `readVoteEmail` and nothing else.',
          },
          {
            case: 'Escape or Cancel casts no vote, including the click that opened the dialog',
            probe: 'exit',
            disposition: 'handled',
            where: 'board.ts:190-209',
            href: '/roadmap/',
            note: 'E211 · Resolves `null` and unwinds cleanly.',
          },
          {
            case: 'Escape out of this dialog also closes the chat behind it',
            probe: 'exit',
            disposition: 'defect',
            href: '/roadmap/',
            severity: 'medium',
            note:
              'E212 · `chat-panel.ts:169-182` has no guard for an open `<dialog>`. The vote-dialog face of E50. See X7.',
          },
          {
            case: 'an invalid address keeps the dialog open and keeps what you typed',
            probe: 'broken',
            disposition: 'handled',
            where: 'board.ts:172-175',
            href: '/roadmap/',
            note:
              'E213 · A named error rather than a native bubble, which is why the form is `novalidate` (`board.ts:194-204`).',
          },
        ],
      },
      {
        label: 'Voted',
        href: null,
        caption:
          'What a voted card looks like once counts are live, and what it says on a second visit from the same person.',
        edges: [
          {
            case: 'withdrawing a vote needs no address',
            probe: 'identity',
            disposition: 'handled',
            where: 'board.ts:150-155',
            href: '/roadmap/',
            note: 'E206 · Asking again to take a vote back would be a toll on changing your mind.',
          },
          {
            case: 'your browser refuses to remember the vote',
            probe: 'broken',
            disposition: 'handled',
            where: 'votes.ts:63-67',
            href: '/roadmap/',
            note: 'E214 · The toggle still paints for the session and the write is swallowed.',
          },
          {
            case:
              'the day counting goes live, a browser holding twelve local votes paints twelve as cast',
            probe: 'stale',
            disposition: 'decide',
            href: null,
            severity: 'medium',
            note:
              'E215 · `votes.ts:39-50` — local votes never expire and are never reconciled with a server. See D16.',
          },
        ],
      },
    ],
    note:
      'Flip `VOTES_LIVE` in `apps/support/src/lib/votes.ts:15` and three surfaces change at once — the card, the detail page and the board header. That is deliberate: it is one decision, not three.',
  },

  // ── Tickets (the surfaces this page indexes but does not contain) ─────────
  {
    id: 'find-my-own-things-in-the-header',
    surface: 'header',
    label: 'Find my own things, or sign in',
    summary:
      'A reader wants the one thing on this site that is theirs rather than the site’s: the requests ' +
      'they have written. It is behind their own name in the top right, together with the address ' +
      'they are signed in as and the light-or-dark choice. Signed out, the same corner is a way in.',
    status: 'built',
    /* Two renderings of one corner, reachable directly and in either order, and neither needs the
       other to have happened. Rule 3 of the shape test. */
    shape: 'states',
    steps: [
      {
        label: 'Signed in',
        href: '/start/what-baseout-is/?session=in',
        caption:
          'The name in the top right is a button. It opens a panel holding three things: `My requests`, ' +
          'the address you are signed in as, and the theme. Nothing else, because there is nothing ' +
          'else that belongs to you here.',
        edges: [
          {
            case: 'the panel opens underneath the page-contents card and looks half-drawn',
            probe: 'cross-step',
            disposition: 'handled',
            where: 'src/styles/support.css · html[data-account-open] .header',
            href: '/start/what-baseout-is/?session=in',
            note:
              'E269 · The header is `--sl-z-index-navbar` (10) and `.right-sidebar-container` is 30, so a ' +
              '`z-index` on the panel competes only INSIDE the header and can never beat a 30 outside it. ' +
              'Measured: the panel painted at 1196,54 with every row correct and the contents card over the ' +
              'top of it. Fixed by raising the header to 40 for the lifetime of one open panel, rather than ' +
              'editing the ladder — `--sl-z-index-skiplink` (20) sits between the two numbers, so a permanent ' +
              'raise would also put the header over the skip link.',
          },
          {
            case: 'pressing a row in the panel does nothing, because the panel closed under the finger',
            probe: 'cross-step',
            disposition: 'handled',
            where: 'src/lib/account-menu.ts · pop.addEventListener(\'mousedown\')',
            href: '/start/what-baseout-is/?session=in',
            note:
              'E270 · A panel that closes on `focusout` destroys itself BETWEEN mousedown and mouseup: the ' +
              'press moves focus to `<body>`, the panel hides, and there is nothing left under the pointer to ' +
              'receive the mouseup. `preventDefault` on mousedown holds the focus. THE TEST IS THE TRAP: a ' +
              'synthetic `.click()` moves no focus and passes on the broken code, so this is only provable ' +
              'with a trusted click. The same failure is written up on the platform picker.',
          },
          {
            case: 'Escape closes the panel and the search dialog behind it at the same time',
            probe: 'cross-step',
            disposition: 'handled',
            where: 'src/lib/account-menu.ts · keydown, stopPropagation',
            href: '/start/what-baseout-is/?session=in',
            note:
              'E271 · The search dialog and the chat drawer both listen for Escape on `document`. Handled on ' +
              'the menu and stopped from travelling, the same shape `platform-picker.ts` already uses.',
          },
          {
            case: 'there is no way to sign out',
            probe: 'exit',
            disposition: 'decide',
            href: null,
            severity: 'low',
            note:
              'E272 · Deliberate, not missing. The portal shares the app’s session, so there is nothing here ' +
              'to end, and the URL that would end it lives in a product this repo does not contain. Inventing ' +
              '`app.baseout.com/logout` would be inventing product surface to make a menu look complete. One ' +
              'line when the address is known.',
          },
        ],
      },
      {
        label: 'Signed out',
        href: '/start/what-baseout-is/?session=out',
        caption:
          'No name, no panel. The corner is the theme control and a `Sign in` button, which carries ' +
          '`returnTo` so signing in lands you back on the page you were reading.',
        edges: [
          {
            case: 'the theme control is in the header here and inside the panel when signed in',
            probe: 'identity',
            disposition: 'decide',
            href: '/start/what-baseout-is/?session=out',
            severity: 'low',
            note:
              'E273 · The one inconsistency in this corner, and it is forced. Dan asked for a BUTTON when ' +
              'signed out, so the signed-out state has no panel to hold the theme, and a theme control that ' +
              'only existed for people with accounts would be worse than one that moves. `apps/web` never ' +
              'faces this because it has no signed-out state.',
          },
          {
            case: 'nothing tells a signed-out visitor that a requests area exists',
            probe: 'entry',
            disposition: 'decide',
            href: '/start/what-baseout-is/?session=out',
            severity: 'low',
            note:
              'E274 · The price of moving `My requests` out of the nav row on 2026-08-25. Nothing is lost ' +
              'functionally: the page was behind sign-in anyway and the button beside this leads to the same ' +
              'place. What is lost is the discovery, and what partly covers it is that `/contact/` links the ' +
              'case after a submission and the acknowledgement email carries it too.',
          },
        ],
      },
    ],
    source: [
      'apps/support/src/components/SessionControl.astro',
      'apps/support/src/components/ThemeToggle.astro',
      'apps/support/src/lib/account-menu.ts',
      'apps/support/src/lib/theme-toggle.ts',
      'apps/support/src/data/viewer.ts',
    ],
    note:
      'The name is Dana Keller because `data/tickets.ts` prints her messages as “You:” on `/requests/`, ' +
      'so she is the reader. `data/viewer.ts` asserts that against the fixture at build time: rename the ' +
      'customer there and the build stops rather than putting one person’s name over another’s messages.',
  },
  {
    id: 'see-my-requests',
    surface: 'tickets',
    label: 'See my requests',
    status: 'built',
    summary:
      'Somebody opens the list of everything they have ever sent us and sees where each one stands.',
    shape: 'states', // one `/requests/` in six renderings; nobody walks signed-out → Closed in order
    source: [
      'apps/support/src/pages/requests/index.astro',
      'apps/support/src/lib/portal-session.ts',
      'apps/support/src/lib/tickets-view.ts',
      'apps/support/src/lib/ticket-status.ts',
      'apps/support/src/components/TicketRow.astro',
      'apps/support/src/components/LockedCapability.astro',
      'apps/support/src/data/tickets.ts',
    ],
    steps: [
      {
        label: 'Signed out',
        href: '/requests/?session=out',
        caption:
          'The list is keyed to an email address, so with no session it shows none rather than somebody else\'s. `LockedCapability` states what the page does and why it is closed, and the way back to `/contact/` is on it.',
        edges: [
          {
            case: 'a signed-in list cannot exist in a static build at all',
            probe: 'static-build',
            disposition: 'handled',
            where: 'requests/index.astro:73',
            href: '/requests/?session=out',
            note:
              'E244 · Answered by building it: both halves are in ONE static render and `lib/portal-session.ts:32` selects between them from `?session`. No adapter, no `output: \'server\'`, no second origin — which also means the prerendered case pages are readable by anyone holding the URL (E259).',
          },
          {
            case: 'an email link lands on a case while you are signed out',
            probe: 'entry',
            disposition: 'handled',
            where: 'requests/[ref].astro:61',
            href: '/requests/BO-7QX9-K4TD/?session=out',
            note:
              'E241 · The locked case carries `returnTo=…/requests/BO-7QX9-K4TD`, so sign-in returns to THAT case and not to the list. This is the row that E108 said `returnTo` could not do; on this surface it now does.',
          },
          {
            case: 'you sign in with a different address from the one that filed',
            probe: 'identity',
            disposition: 'decide',
            href: '/requests/?session=out',
            note:
              'E237 · The locked panel now states the rule once — "A request is keyed to an email address" — which is half the recommendation. What is still undecided is what the SIGNED-IN list says when a case is missing for that reason, because there is nowhere to say it.',
          },
          {
            case: 'the case you filed anonymously, with the same address',
            probe: 'identity',
            disposition: 'decide',
            href: null,
            note:
              'E236 · `contact.astro:568-573` still promises the merge in writing and still points at `app.baseout.com`, not at `/requests/`. Recommendation: merge on a verified address at sign-in and show a one-time note naming what was adopted. See D12.',
          },
          {
            case: 'two people in one organization',
            probe: 'identity',
            disposition: 'decide',
            href: null,
            note:
              'E238 · Recommendation: v1 is strictly per address. Zendesk\u2019s organization view is a later axis.',
          },
          {
            case: 'the session expires while the list is open',
            probe: 'broken',
            disposition: 'decide',
            href: null,
            note:
              'E240 · Recommendation: re-auth in place; never drop the reader on the marketing site. `portal-session.ts:13-18` reads the session from the URL on every load and persists nothing, so there is no expiry to model yet.',
          },
          {
            case: 'the address people already type is a redirect to a form',
            probe: 'entry',
            disposition: 'defect',
            href: '/tickets',
            severity: 'medium',
            note:
              'E242 · `astro.config.mjs:22` still sends `/tickets` to `/contact`, and that was the honest answer only while no list existed. The list exists. Re-point it at `/requests/` and drop `tickets` from `search-modal.ts:57` NOT_DOCS in the same edit, or the one surface a reader guesses at stays hidden from search.',
          },
        ],
      },
      {
        label: 'The list',
        href: '/requests/',
        caption:
          'The signed-in default \u2014 `session` defaults to `in` (`portal-session.ts:32`), so the bare URL is the list. Most recently active first, never by creation date, and each row says where it stands and when it last moved.',
        edges: [
          {
            case: 'forty cases',
            probe: 'many',
            disposition: 'handled',
            where: 'ticket-status.ts:123-133',
            href: '/requests/',
            note:
              'E233 · Tabs Open / Closed / All with counts, sorted by `lastActivityAt` descending (`data/tickets.ts:451-452`). Counts are recomputed from the rows actually present rather than trusted from the markup (`tickets-view.ts:72-80`), so they cannot disagree with what is on screen.',
          },
          {
            case: 'a 200-character subject in a dense row',
            probe: 'long',
            disposition: 'handled',
            where: 'TicketRow.astro:152',
            href: '/requests/',
            note:
              'E234 · `-webkit-line-clamp: 2`. The walk recommended one line; two shipped, because the row carries the object beside the subject and a single line clipped the distinguishing half of the two Space-scoped cases.',
          },
          {
            case: 'a case with attachments',
            probe: 'partial',
            disposition: 'handled',
            where: 'TicketRow.astro:81-85',
            href: '/requests/',
            note:
              'E235 · Paperclip plus a count, summed across every message on the case (`TicketRow.astro:54`). `BO-4K2M-P8RV` is the row with two. Filenames are on the detail as chips, not in a hover \u2014 the portal carries no tooltip primitive.',
          },
          {
            case: 'the case you just filed is not in the list yet',
            probe: 'stale',
            disposition: 'handled',
            where: 'requests/index.astro:163-166',
            href: '/requests/',
            note:
              'E239 · The footnote under the list: "A request you have just sent may not be listed yet. The acknowledgement email is the receipt until it is." A caveat, not a duration promise \u2014 which is what stops a support request about the support request.',
          },
          {
            case: 'the row says what the case is ABOUT, not just what it is called',
            probe: 'platform-count',
            disposition: 'handled',
            where: 'TicketRow.astro:73-79',
            href: '/requests/',
            note:
              'E243 · `about` renders as a glyph plus a label on the row and again on the detail rail. `BO-7QX9-K4TD` carries Space Ops and `BO-1RB8-N7EK` Space Finance. The run id is not carried yet \u2014 nothing in the fixture has one.',
          },
          {
            case: 'exactly one case',
            probe: 'one',
            disposition: 'decide',
            href: '/requests/',
            note:
              'E232 · The build took the other side: the tab row is unconditional, so a person with one case sees `Open 1 · Closed 0 · All 1`. Defensible, and it is a decision rather than an oversight \u2014 decide whether the row hides below a threshold, or stays because a disappearing control is worse than an idle one.',
          },
        ],
      },
      {
        label: 'Open',
        href: '/requests/?session=in&tab=open',
        caption:
          'The default tab. `open` means `status !== \'closed\'`, so **Awaiting your reply** lives here too \u2014 a case waiting on the customer is not a finished case (`ticket-status.ts:132-133`).',
        edges: [],
      },
      {
        label: 'Closed',
        href: '/requests/?session=in&tab=closed',
        caption:
          'One row today, `BO-1RB8-N7EK`. Closed is a state and not a deletion, which is what makes `reopen-something-closed` possible at all.',
        edges: [
          {
            case: 'you have cases, but not in the tab you are looking at',
            probe: 'empty',
            disposition: 'defect',
            href: '/requests/?session=in&tab=closed',
            severity: 'medium',
            note:
              'E231 · The per-tab empty states WERE built \u2014 `.rq-empty-open` and `.rq-empty-closed` (`requests/index.astro:131-149`) carry their own sentences \u2014 and with the shipped fixture no URL reaches either one: Open holds 4 rows, Closed 1, All 5, so `shown` is never 0 while the population is `some`. `?tickets=none` wins over the lane branch (`tickets-view.ts:100`), so even the declared `…&tickets=none&tab=closed` paints the NEVER state. Two states that exist in the CSS and in no reachable render.',
          },
        ],
      },
      {
        label: 'All',
        href: '/requests/?session=in&tab=all',
        caption:
          'Five cases, one of each thing the row has to survive: a Space-scoped fault, an out-of-office, two attachments, an unverified sender, and a closed case.',
        edges: [],
      },
      {
        label: 'Never written in',
        href: '/requests/?session=in&tickets=none',
        caption:
          'The state most customers are in, and it offers the doors rather than apologising: a mark, one factual sentence, and two exits \u2014 the documentation and `/contact/`.',
        edges: [
          {
            case: 'you have never written in',
            probe: 'empty',
            disposition: 'handled',
            where: 'requests/index.astro:150-161',
            href: '/requests/?session=in&tickets=none',
            note:
              'E230 · "You have not written yet. The documentation and the chat answer most questions without a request \u2014 and when they do not, a request keeps the whole thread in one place." Two exits shipped where the walk recommended one; the second is the docs, which is free and already built, so it is not a competing call to action.',
          },
        ],
      },
    ],
    note:
      'BUILT 2026-08-21, and the registry called it planned for most of that day \u2014 which is the failure mode this page exists to prevent. The remaining rows are the identity questions (D12), not the surface. Note the default flip: `session` now defaults to `in` (`portal-session.ts:32`), so a bare `/requests/` is the SIGNED-IN list and `?session=out` is the locked state. Three comment blocks still claim the opposite and are wrong: `tickets-view.ts:13-15`, `ticket-case.ts:43-44`, `requests/index.astro:21-22`.',
  },
  {
    id: 'read-and-answer-a-thread',
    surface: 'tickets',
    label: 'Read and answer a thread',
    status: 'built',
    summary:
      'Somebody reads the conversation on one of their cases and answers it.',
    source: [
      'apps/support/src/pages/requests/[ref].astro',
      'apps/support/src/lib/ticket-case.ts',
      'apps/support/src/lib/ticket-status.ts',
      'apps/support/src/lib/ticket-time.ts',
      'apps/support/src/components/TicketMessage.astro',
      'apps/support/src/components/TicketComposer.astro',
      'apps/support/src/components/FileChip.astro',
      'apps/support/src/data/tickets.ts',
    ],
    steps: [
      {
        label: 'Open a case',
        href: '/requests/BO-7QX9-K4TD/',
        caption:
          'The whole exchange in order, ours and theirs, with the attachments where they were sent. The rail beside it carries the copyable reference, when it was created, when it last moved and which Space it is about.',
        edges: [
          {
            case: 'one reply, and you can tell at a glance who wrote it',
            probe: 'one',
            disposition: 'handled',
            where: 'TicketMessage.astro:23,71',
            href: '/requests/BO-7QX9-K4TD/',
            note:
              'E246 · Sender by label, alignment and a quiet plate. NO avatars, no gradients, no tails \u2014 the product\u2019s own `pattern-schema-chat` ruling transferred verbatim, as recommended.',
          },
          {
            case: 'the reply carries no agent name',
            probe: 'identity',
            disposition: 'handled',
            where: 'TicketMessage.astro:71',
            href: '/requests/BO-7QX9-K4TD/',
            note:
              'E249 · `senderName === null` on our side renders `Baseout Support` in the worded-absence register, never a fabricated first name \u2014 the same rule that made `DataComments` print "Author not captured".',
          },
          {
            case: 'a pasted stack trace, or five thousand words',
            probe: 'long',
            disposition: 'handled',
            where: 'TicketMessage.astro:116-123',
            href: '/requests/BO-7QX9-K4TD/',
            note:
              'E248 · A `<details>` reading `Show quoted text \u00b7 N lines`, and N is DERIVED from the text rather than declared beside it. The quote is not stripped: there is no standard for quote markers, so a stripper tuned on Gmail over-strips on Outlook and eats the sentence the customer typed underneath.',
          },
          {
            case: 'a case with no reply yet',
            probe: 'empty',
            disposition: 'handled',
            where: 'ticket-status.ts:63-98',
            href: '/requests/BO-2H5T-W3LC/?session=in',
            note:
              'E245 · One message, status `Open`, hint "With us. Nothing is needed from you." No SLA and no response-time estimate of any kind, which was bound.',
          },
          {
            case: 'two cases about two different Spaces',
            probe: 'many',
            disposition: 'handled',
            where: 'requests/[ref].astro:109-140',
            href: '/requests/BO-1RB8-N7EK/?session=in',
            note:
              'E261 · The rail carries a short copyable reference, created, last activity and the Space. `BO-7QX9-K4TD` is Ops and `BO-1RB8-N7EK` is Finance, which is the pair this row was written against.',
          },
          {
            case: 'a deep link to a case that is not yours',
            probe: 'entry',
            disposition: 'defect',
            href: '/requests/BO-9DN4-QZ6B/?session=in',
            severity: 'medium',
            note:
              'E259 · A static build prerenders every case from `getStaticPaths`, so all five HTML files are served to anybody holding the URL and `?session=in` is a query parameter, not a credential. There is no ownership check to return a 404 with. Accepted for a fixture-backed preview and NOT accepted the day a real case sits behind one of these paths \u2014 the row is here so that day is not a surprise. See D17.',
          },
          {
            case: 'a case filed anonymously, then adopted, then read',
            probe: 'identity',
            disposition: 'decide',
            href: '/requests/BO-9DN4-QZ6B/?session=in',
            note:
              'E258 · `BO-9DN4-QZ6B` is the unauthenticated case and its first message carries an `Unverified sender` mark (`TicketMessage.astro:102`), so the thread does show the original message rather than starting at adoption. What is undecided is the adoption EVENT: nothing marks where it happened. See D12.',
          },
          {
            case: 'a thirty-message thread',
            probe: 'many',
            disposition: 'decide',
            href: null,
            note:
              'E247 · Newest last and a composer at the foot shipped; the fixture tops out at three messages, so neither a sticky composer nor jump-to-latest has been designed against a thread long enough to need one.',
          },
        ],
      },
      {
        label: 'Reply',
        href: '/requests/BO-2H5T-W3LC/?session=in',
        caption:
          'A reply box that is a reply box, not a new-ticket form wearing a different heading. Nothing is sent \u2014 the composer says so in its own failure text rather than in a banner somewhere else.',
        edges: [
          {
            case: 'send fails',
            probe: 'broken',
            disposition: 'handled',
            where: 'ticket-case.ts:84-106',
            href: '/requests/BO-2H5T-W3LC/?session=in',
            note:
              'E255 · The draft is deliberately NOT cleared on failure: "Nothing was sent \u2014 this portal has no mail behind it yet. Your reply is still in the field." A support thread is the last surface allowed to lose a person\u2019s words. See X1.',
          },
          {
            case: 'the form itself is broken',
            probe: 'broken',
            disposition: 'decide',
            href: '/requests/BO-2H5T-W3LC/?session=in',
            severity: 'low',
            note:
              'E256 · Half of the recommendation shipped: the failure names the email route ("Replying to the email we sent about this request reaches the same case") and the reference has a copy button (`data-copy-ref`). The address itself is neither printed nor copyable, so the escape is a description of a route rather than the route.',
          },
          {
            case: 'support closed the case while you were typing',
            probe: 'stale',
            disposition: 'decide',
            href: null,
            note:
              'E253 · Recommendation: reconcile at send \u2014 accept the reply and reopen, rather than refusing it. The local half of this is built (E251); the half where the state changed on OUR side mid-compose has no server to change it.',
          },
          {
            case: 'a reply arrived since you loaded the page, or you have two tabs open',
            probe: 'stale',
            disposition: 'decide',
            href: null,
            note: 'E254 · Recommendation: refresh at the decision point, not only on load.',
          },
        ],
      },
      {
        label: 'Attach something else',
        href: '/requests/BO-4K2M-P8RV/?session=in',
        caption:
          'The same rules the contact form states, stated again before the picker rather than after the failure \u2014 which is what stops the two surfaces drifting.',
        edges: [
          {
            case: 'attachments on a reply',
            probe: 'limit',
            disposition: 'handled',
            where: 'TicketComposer.astro:60-63',
            href: '/requests/BO-4K2M-P8RV/?session=in',
            note:
              'E257 · "PNG, JPG, GIF, WebP or PDF \u00b7 up to 10 MB each \u00b7 5 files" \u2014 the same 5 \u00d7 10 MB rule as `/contact` (`submit.ts:78-79`), printed before the picker as recommended. The constants are still declared twice, and that is the drift risk this row keeps open.',
          },
        ],
      },
      {
        label: 'Waiting on us \u00b7 waiting on you',
        href: '/requests/BO-7QX9-K4TD/?session=in',
        caption:
          'The one status a customer actually wants: whose turn it is. `BO-7QX9-K4TD` is the case that is waiting on THEM.',
        edges: [
          {
            case: 'the case is waiting on you',
            probe: 'partial',
            disposition: 'handled',
            where: 'ticket-status.ts:63-98',
            href: '/requests/BO-7QX9-K4TD/?session=in',
            note:
              'E250 · `pending` renders as **Awaiting your reply** with the hint "We have replied and are waiting on you." It is the only one of the three with a task on it, and the only one that takes `warning`; `Open` and `Closed` are both stated in the neutral register.',
          },
        ],
      },
    ],
    note:
      'BUILT 2026-08-21 as its own ROUTE, not as a state of an existing one \u2014 the third mechanism in design.md \u00a75. Every reply is faked and the page says so in its own footer ("Preview: nothing on this page is sent, and any change you make here resets on reload"), which is why the send-side rows read `handled` on the words and not on the delivery.',
  },
  {
    id: 'reopen-something-closed',
    surface: 'tickets',
    label: 'Reopen something closed',
    status: 'built',
    summary:
      'Somebody whose problem came back reopens the closed case instead of starting a new one.',
    source: [
      'apps/support/src/pages/requests/[ref].astro',
      'apps/support/src/lib/ticket-case.ts',
      'apps/support/src/components/TicketComposer.astro',
    ],
    steps: [
      {
        label: 'A closed case',
        href: '/requests/BO-1RB8-N7EK/?session=in',
        caption:
          'Closed is a state, not a deletion. The thread stays readable and the composer stays under it, which is what makes the next step possible at all.',
        edges: [
          {
            case: 'you solved it yourself',
            probe: 'cross-step',
            disposition: 'handled',
            where: 'ticket-case.ts:58-62',
            href: '/requests/BO-2H5T-W3LC/?session=in',
            note:
              'E252 · `Close this request` sits in the rail of any case that is not already closed, so nobody has to write "nvm, fixed it". On a closed case the whole action row is hidden (`requests/[ref].astro:362-364`) rather than shown disabled.',
          },
        ],
      },
      {
        label: 'It happened again',
        href: '/requests/BO-1RB8-N7EK/?session=in',
        caption:
          'Reopening rather than filing a second ticket. The composer IS the reopen control: the button reads `Send and reopen` and the line above it says so before you type.',
        edges: [
          {
            case: 'you reply to a case that is closed',
            probe: 'cross-step',
            disposition: 'handled',
            where: 'ticket-case.ts:84-106',
            href: '/requests/BO-1RB8-N7EK/?session=in',
            note:
              'E251 · The Plain / Help Scout model, as recommended: the composer stays, replying reopens, and the thread says it inline \u2014 "This request is closed. Sending a reply reopens it." One state transition and no follow-up-ticket entity. The status flips BEFORE the (faked) send resolves, so the reopen is visible even though nothing is delivered. See D18.',
          },
          {
            case: 'you closed it and now want it back',
            probe: 'exit',
            disposition: 'handled',
            where: 'TicketComposer.astro',
            href: '/requests/BO-1RB8-N7EK/?session=in',
            note:
              'E260 · Reopen is the same action as replying and there is no separate control \u2014 exactly the recommendation. The submit button carries both labels, `Send` and `Send and reopen`, and CSS picks between them by `data-case-closed`.',
          },
        ],
      },
      {
        label: 'Or file it as new',
        href: '/contact/?kind=ticket',
        caption:
          'Still reachable, and no longer the only route. It throws the history away, which is now a choice the reader makes rather than the only thing the portal offers.',
        edges: [],
      },
    ],
    note:
      'BUILT 2026-08-21. Every row on this flow closed in one edit, because reopen turned out to be one state transition rather than a feature \u2014 which is what D18 predicted and the reason it was worth deciding before building.',
  },
];

/* ═══════════════════════════════════════════════════════════════════════════
   CROSS-CUTTING FRICTIONS — the half of the walk that has no step to hang on.

   WHY THIS IS A SECTION AND NOT MORE EDGE ROWS. An `EdgeCase` earns its place
   by being attached to one step: that placement is what makes it reproducible,
   arguable and fixable. These nine fail that test by construction — each is
   present in three or more flows, so attaching one would mean either picking a
   host arbitrarily or writing the same row up to six times and watching the
   copies drift. They are also, for the client, the more valuable half: a defect
   in one step is a bug, and a friction in six flows is a design decision that
   was never taken.

   THE SHAPE. Each row names the flows it appears in BY ID, so `/handoff` can
   link them into the catalogue below rather than describing where to look. Read
   a friction, click a flow, land on the step, read the edge rows that are its
   local instances — X4 is `Planned 6` over a column of five (E185), the empty
   recents list (E58) and the vote button on a shipped item (E218), and the
   class is one class even though the three fixes are three fixes.
   ═══════════════════════════════════════════════════════════════════════════ */

export const HANDOFF_FRICTIONS: HandoffFriction[] = [
  {
    id: 'X1',
    title: 'work is destroyed with no draft, no warning and no history',
    severity: 'high',
    flows: [
      'file-a-ticket-while-signed-out',
      'submit-a-public-feature-request',
      'hit-a-duplicate-while-submitting-a-request',
      'ask-about-billing-sales-or-something-else',
      'follow-up-on-a-case-i-filed',
      'read-and-answer-a-thread',
    ],
    evidence: ['submit.ts:398-425', 'submit.ts:142-151', 'submit.ts:274', 'chat-core.ts:69-73'],
    fix: 'Persist a draft per door under `bo-contact-draft:<kind>`, `pushState` per step, and open duplicate suggestions in a new tab. The pattern already exists in this codebase — the chat keeps its draft across navigation and reload — and it is not applied on the one surface where losing it costs the reader 600 words.',
  },
  {
    id: 'X2',
    title: 'the portal collects an identity it never uses, and promises things it cannot do with it',
    severity: 'high',
    flows: [
      'file-a-ticket-while-signed-out',
      'ask-about-billing-sales-or-something-else',
      'submit-a-public-feature-request',
      'vote-on-a-request',
      'rate-a-documentation-page',
      'follow-up-on-a-case-i-filed',
    ],
    evidence: ['votes.ts:72-79', 'submit.ts:416', 'submit.ts:385', 'board.ts:176-185', 'page-feedback.ts:47-53'],
    fix: 'Give the vote dialog the same "nothing is sent" sentence the contact form and the page rating already carry, and make the pre-filled address visible and clearable. One identity currently leaks between two unrelated surfaces on a shared browser: the contact form silently READS the vote address and silently WRITES it back.',
  },
  {
    id: 'X3',
    title: 'every escalation loses its context at the boundary',
    severity: 'high',
    flows: [
      'ask-the-ai-chat',
      'run-out-of-free-messages',
      'escalate-from-chat-to-a-person',
      'file-a-ticket-while-signed-out',
      'rate-a-documentation-page',
    ],
    evidence: ['chat-core.ts:196-198', 'ChatDock.astro:139', 'submit.ts:100-190', 'search-modal.ts:235-238'],
    fix: 'One convention: every escalation link carries `?kind=` plus a prefill token, and the receiving surface says what it inherited. Search to chat already carries the query — that is the portal’s one working hand-off, and there are four broken ones beside it.',
  },
  {
    id: 'X4',
    title: 'counts and labels disagree with what clicking them shows',
    severity: 'high',
    flows: ['browse-the-roadmap', 'vote-on-a-request', 'search-the-documentation'],
    evidence: ['roadmap.astro:192-206', 'roadmap.astro:220-233', 'recent.ts:11', 'search-modal.ts:127', 'RequestCard.astro:135-148'],
    fix: 'Compute every count from the same predicate that produces the rows, in one place. Each instance is a different bug and the class is one: a number or an affordance computed over a different set from the one it is drawn beside.',
  },
  {
    id: 'X5',
    title: 'the state arrives after paint, and only the landing pays for a fix',
    severity: 'medium',
    flows: [
      'land-and-choose-a-platform',
      'filter-the-documentation-to-my-platform',
      'read-documentation',
      'file-a-ticket-while-signed-out',
    ],
    evidence: ['LandingBody.astro:141-172', 'PlatformPicker.astro:126-129', 'submit.ts:183-185'],
    fix: 'One shared pre-paint stamp in the head, or an explicit ruling that the reflow is accepted. UNVERIFIED — the flash has never been measured on either surface, and the mechanism is identical to the one the landing was fixed for.',
  },
  {
    id: 'X6',
    title: 'one filter, two meanings, one set of logos',
    severity: 'medium',
    flows: [
      'filter-the-documentation-to-my-platform',
      'land-on-a-page-my-own-filter-hides',
      'read-documentation',
      'search-the-documentation',
      'browse-the-roadmap',
    ],
    evidence: ['PlatformPicker.astro:15-28', 'board.ts:58-63', 'roadmap.astro:211-217'],
    fix: 'Keep the semantics and differentiate the control’s SHAPE everywhere — the roadmap already does — and say the rule once in the docs sidebar too. Both behaviours are argued and correct in isolation; to a reader they are the same three brand marks doing opposite things on adjacent pages, and only one of the two explains itself.',
  },
  {
    id: 'X7',
    title: 'the Escape stack is incomplete, so leaving one layer takes another with it',
    severity: 'medium',
    flows: ['read-documentation', 'ask-the-ai-chat', 'vote-on-a-request', 'search-the-documentation'],
    evidence: ['toc-collapse.ts:34-48', 'platform-picker.ts:281-286', 'chat-panel.ts:169-182'],
    fix: 'Add `document.querySelector(\'dialog[open]\')` to the chat’s guard, matching the pattern already used for the TOC popover and the platform picker. Three layers are guarded; the search dialog and the vote dialog are not.',
  },
  {
    id: 'X8',
    title: 'no duration is promised, and no ending is named either',
    severity: 'medium',
    flows: [
      'file-a-ticket-while-signed-out',
      'ask-about-billing-sales-or-something-else',
      'follow-up-on-a-case-i-filed',
      'escalate-from-chat-to-a-person',
    ],
    evidence: ['submit.ts:345-373', 'submit.ts:418-425'],
    fix: 'The confirmation prints the address it will reply to, the fact that replying to that email adds to the case, and a case reference. The bound decision is honoured — no screen promises a time — but it asks for the channel, the address AND the event that ends the wait, and today only the channel is named.',
  },
  {
    id: 'X9',
    title: 'five surfaces admit that nothing is sent; the vote dialog and the chat do not',
    severity: 'medium',
    flows: ['vote-on-a-request', 'ask-the-ai-chat', 'submit-a-public-feature-request'],
    evidence: ['contact.astro:466-469', 'PageFeedback.astro:118-121', 'roadmap.astro:127-132', 'board.ts:178'],
    fix: 'Given the demo ruling that there are no "not built yet" banners, the honest line is the one already in use on three surfaces: state the DESTINATION, not the readiness.',
  },
];

/* ═══════════════════════════════════════════════════════════════════════════
   DECISIONS TO LOCK — twenty-one questions, each answerable by picking one of
   two named options. A recommendation is carried because a decision list with
   no recommendation is a list nobody reads twice; the recommendation is not the
   decision, and the two options are stated so the other one can be chosen
   without re-deriving it.

   These sit beside the frictions rather than inside a flow for the same reason:
   most of them are what a friction resolves to, and several (D12, D17, D20)
   decide whether a whole planned flow can exist in this app at all.
   ═══════════════════════════════════════════════════════════════════════════ */

export const HANDOFF_DECISIONS: HandoffDecision[] = [
  {
    id: 'D1',
    question: 'Does `/contact` get a pre-paint stamp for `?kind=`, matching the landing’s?',
    options: [
      'Add an `is:inline` head script that hides the fork when `?kind=` is a known value',
      'Accept the flash',
    ],
    recommendation: 'The first. The mechanism already exists twenty lines away in `LandingBody.astro:141-172`, and `?kind=` is the parameter every outbound email will carry. Measure first — the flash is unverified.',
  },
  {
    id: 'D2',
    question: 'Where does `/tickets` point?',
    options: ['Keep redirecting to `/contact` until the list ships', 'Point it at a signed-out explainer now'],
    recommendation: 'The second. Today the redirect answers "where is my case?" with a blank new-case form, which is the worst possible answer and the one the chat’s own old copy taught people to expect.',
  },
  {
    id: 'D3',
    question: 'Does the chat-to-contact escalation carry context?',
    options: ['A link only', 'The link plus the last question, the page and the platform scope, prefilled and labelled as inherited'],
    recommendation: 'The second. Without it the chat is a dead end wearing a link, which the research already named the portal’s weakest join.',
  },
  {
    id: 'D4',
    question: 'Does `/contact` persist a draft and push history per step?',
    options: ['Neither', 'Both'],
    recommendation: 'Both. One `localStorage` key per door and one `pushState` per step closes the highest-severity friction in the catalogue.',
  },
  {
    id: 'D5',
    question: 'Does the chat conversation ever end?',
    options: ['Unbounded, as today', 'A "New conversation" control plus a per-turn date and a log cap'],
    recommendation: 'The second. An undated three-week-old transcript replaying on arrival is the state a reader reads as "this is broken".',
  },
  {
    id: 'D6',
    question: 'Does the fault-report door get deflection at the subject field, as the request door has?',
    options: ['No', 'Yes, querying `troubleshooting/*` from the same Pagefind index'],
    recommendation: 'Yes. The corpus, the index and the query function all exist — `submit.ts:239-292` is one selector away from reuse — and the research calls it the highest-leverage thing on the whole ticket surface, at no auth cost.',
  },
  {
    id: 'D7',
    question: 'Does the landing directory show every platform’s pages, or only the reader’s?',
    options: ['All, as today — "nothing is hidden by a choice"', 'Narrow to the chosen platform'],
    recommendation: 'All. The law is stated and argued at `LandingBody.astro:34-37`. But it needs a companion decision at five platforms — see D19.',
  },
  {
    id: 'D8',
    question: 'Does portal search cover requests as well as documentation?',
    options: ['Docs only, as today', 'Two result groups'],
    recommendation: 'Docs only, with one change: the empty state should offer "search the roadmap" when the query matched request pages that were filtered out. The count is already computed one line away.',
  },
  {
    id: 'D9',
    question: 'Do the sixteen unwritten pages carry any signal?',
    options: ['Nothing, as ruled', 'Suppress the page-rating widget on them only'],
    recommendation: 'Suppress the widget. Not a banner — the ruling stands. But asking "was this page helpful?" under "Not written yet" is the portal grading a reader for a page it did not write, and it is one predicate in `DocsFooter.astro:21-24`.',
  },
  {
    id: 'D10',
    question: 'Does duplicate detection need to see requests filed since the last deploy?',
    options: ['Build-time index only', 'A runtime request index'],
    recommendation: 'Build-time for now, but say so: the confirmation should not imply a live board. Revisit when submissions are real.',
  },
  {
    id: 'D11',
    question: 'Does the billing door detect card numbers in the body?',
    options: ['Copy warning only, as today', 'A client-side Luhn check'],
    recommendation: 'The check, as a WARNING and not a block. The existing warning is excellent, and warnings are ignored under stress. One line that says "that looks like a full card number — the last four are enough" prevents the one irreversible mistake on the page.',
  },
  {
    id: 'D12',
    question: 'How is an email proved?',
    options: ['Not proved — anyone can file against any address (today)', 'A magic-link confirmation before the case is created'],
    recommendation: 'Confirm it for the ticket, billing and other doors; leave sales and the public request unproved. The bound decision makes the address the key to everything, and an unverified key is not a key.',
  },
  {
    id: 'D13',
    question: 'Who triages `Suggested`, and on what cadence?',
    options: ['Unnamed', 'A named person, a stated cadence, and a rule for when a row leaves the list'],
    recommendation: 'Name them, before the board is public. `requests.ts:31-37` says "Do not ship it without one", and the catch-all door makes the same promise in copy — two surfaces are now committed to a process that has no owner.',
  },
  {
    id: 'D14',
    question: 'What does a submitter get to hold on to?',
    options: ['A confirmation screen only (today)', 'A case reference on screen, the reply address printed, and "reply to that email to add to this"'],
    recommendation: 'The second. A reference is not a portal view and does not violate the no-six-digit-code ruling — it is what the reader quotes in the email thread.',
  },
  {
    id: 'D15',
    question: 'Does the board’s filter state live in the URL?',
    options: ['No, as today', '`?status=` and `?platform=`, mirrored like the docs filter'],
    recommendation: 'Mirror it. The docs filter already does, a filtered board is the thing people paste into Slack, and a refresh currently discards it.',
  },
  {
    id: 'D16',
    question: 'What happens to local votes when counting goes live?',
    options: ['Trust the local record', 'Reconcile against the server on first load and let the server win'],
    recommendation: 'Let the server win. A browser with twelve local votes will otherwise paint twelve buttons as cast against a store that has none of them.',
  },
  {
    id: 'D17',
    question: 'Does `apps/support` stay a static build?',
    options: ['Yes, and the ticket surfaces live in `apps/web` behind the existing session', 'No, `apps/support` gains an adapter and a session'],
    recommendation: 'Stay static. Every constraint in this catalogue exists because the portal is static, and the portal is better for it; the signed-in surfaces belong where a session already exists. The list is then a link from `/contact`, not a page of the portal.',
  },
  {
    id: 'D18',
    question: 'Does replying to a closed case reopen it?',
    options: ['Yes, one state transition (Plain / Help Scout)', 'No, a reply mints a follow-up case (Zendesk)'],
    recommendation: 'Reopen. It needs no parent/child field in the data model, and it matches how the customer already thinks — continuing a conversation, not filing a sequel.',
  },
  {
    id: 'D19',
    question: 'At five platforms, does the roadmap scope control adopt `PlatformPicker`?',
    options: ['Keep the hand-rolled row and add a breakpoint', 'Extend `PlatformPicker` with a `scope` presentation and use it'],
    recommendation: 'Use the picker. It already implements `mode="scope"` end to end and NOTHING IN THE TREE USES IT — the one surface it was written for still runs the hand-rolled control it was meant to replace.',
  },
  {
    id: 'D20',
    question: 'Does an id in `platforms.ts` mean "Baseout supports this", or "we hold a mark and a vocabulary for this"?',
    options: [
      'Supported — then the Smartsheet and Monday candidates must be retagged and the "no mark because we do not ship it" convention rewritten',
      'Catalogued — then the docs filter, the board facet and the landing chooser each need a second predicate for SUPPORTED',
    ],
    recommendation: 'Catalogued, and say it in the type. `PlatformId` is doing two jobs; split it, or the board renders `Smartsheet 0` beside a Smartsheet candidate. This is the decision the five-platform column forces, and it is not a layout question.',
  },
  {
    id: 'D21',
    question: 'Do the six hand-written three-platform lists get derived, or asserted?',
    options: ['Leave them and fix by hand each time', 'Derive the CSS reveal rules and the pre-paint guard from `PLATFORM_IDS`, and assert the rest at build'],
    recommendation: 'Derive and assert. Six surfaces drifted at once when a platform was added and five gates stayed green; only the one with an explicit `throw` caught it.',
  },
];

/* ═══════════════════════════════════════════════════════════════════════════
   THE PLATFORM COMPARISON

   IT IS CARDS NOW, NOT LIVE FRAMES — Oleh, 2026-08-21: "ці всі скріншоти не
   мають сенсу… просто не використовувати прев'ю." Four `<iframe>` cells per row
   were the design until today and the reason they went is stronger than "hard
   to see": THE COMPARISON COULD NOT WORK.

     · The subject was never in frame. The landing's platform strip sits ~657px
       down the page and a cell was 560px tall, so every cell showed the site
       header. That is why all four looked identical to the eye.
     · Two of the four surfaces do not answer to `?platform=` at all. The
       roadmap's picker is `state="local"` and reads neither the URL nor the
       stored preference (`roadmap.astro:197`, `board.ts:81`), and the search
       modal changes nothing until the dialog is open.
     · The filter is applied client-side, so the served HTML of all four URLs in
       a row is byte-identical by design.

   So each column is a CARD: its label, its URL as a link, and one or two
   sentences saying what you would see there and what is different about it —
   written from the source. Where an address genuinely changes nothing, the card
   says so and says why, which is a more useful sentence than a picture of two
   identical headers. `finding` carries the same verdict once, above the row.

   FIVE IDENTITIES, THREE DOCUMENTATION TREES. `platforms.ts` holds five, and
   only Airtable, ClickUp and Notion have a `platforms/<id>/connecting.md`, so
   `documented-platforms.ts` gives every visitor-facing filter three rows. The
   old column labelled "All 5" therefore promised a state no documentation
   surface can be in; the axis below is 1 · 2 · 3 · no-parameter.
   ═══════════════════════════════════════════════════════════════════════════ */

export const HANDOFF_COMPARISONS: HandoffComparison[] = [
  {
    id: 'landing-card-count',
    question: 'The landing platform strip — what does it look like when there are more or fewer platforms?',
    finding:
      'Until 2026-08-21 there was no way to find out, and that is the gap this row closes. The strip draws one card per platform with a `platforms/<id>/connecting.md`, `documented-platforms.ts` derives that from the filesystem, and no URL, preference or parameter moves the number — so the layout at one platform and at eight was unreviewable without writing or deleting documentation trees. `?cards=N` (`lib/card-count.ts`) is a REVIEW INSTRUMENT and nothing else: it caps or pads what the strip draws, in the browser, over one static render. It writes no preference, rewrites no address, and changes nothing below the strip — so the steps, the documentation directory and the sidebar on every one of these addresses are the same as on a bare `/`. It is unreachable except by typing it, and it is deleted with the layout decision it exists to serve. THE RULE IT SHOWS: one row of equal cards up to five, a stack of compact rows from six. That threshold is arithmetic, not taste — the landing measure is 1152px, the gap 12px and the card floor 220px, so floor((1152 + 12) / (220 + 12)) = 5 columns fit and the sixth would draw a 182px card. A horizontal scroller was rejected: this is the one control whose whole job is to show every platform there is, and a reader whose platform is missing has to be able to conclude that.',
    columns: [
      {
        label: 'One platform',
        href: '/?cards=1',
        what: 'The day Airtable is the only thing Baseout backs up. One card, held at 376px — the same card as at three, not a 1152px banner — left-aligned under the heading. Worth deciding out loud: at one platform the question “Which platform are you backing up?” answers itself, and the block may want to become the first step of the path instead of a chooser.',
      },
      {
        label: 'Two',
        href: '/?cards=2',
        what: 'Two 376px cards, the row 764px wide and the right half of the measure empty. Nothing shrinks: one, two and three all draw the identical card and only the row gets longer, which is what the `max-width` cap on `.ps-grid` is for.',
      },
      {
        label: 'Three — the real state',
        href: '/?cards=3',
        what: 'The control column, and it must look exactly like a bare `/`. Three 376px cards filling the 1152px measure. If this address differs from `/` in any way, the parameter has leaked out of the strip and the other columns are not telling the truth about anything.',
      },
      {
        label: 'Five',
        href: '/?cards=5',
        what: 'Still one row, and the arithmetic says it just fits: five 220.8px cards, 180.8px inside the 20px padding, the exact floor the layout is written against. The two extra cards are the real Smartsheet and monday.com identities from `platforms.ts` — real marks, real names, real nouns — drawn INERT, because neither has a page to open or a preference worth writing. This is the widest the row ever gets.',
      },
      {
        label: 'Eight',
        href: '/?cards=8',
        what: 'Past the threshold, so the cards become a stacked list of compact rows: mark, name and nouns on one line, the state on the right, about 48px each. Every platform is on screen and none is behind a swipe. Cards six to eight are ANONYMOUS placeholders — “Platform six”, a dashed glyph, “Not a real product” — because no sixth brand was invented to fill a layout study.',
      },
    ],
  },
  {
    id: 'landing-strip',
    question: 'The landing platform strip — what does `?platform=` actually change?',
    finding:
      'The chooser never narrows, and it must not: it is the control you pick FROM, so it always draws every platform that has a documentation tree — three today. `documented-platforms.ts` derives that set from which `platforms/<id>/connecting.md` exists, so five identities and three sets of pages give three cards, and no URL moves that number. What the parameter does move is everything the choice governs below it, and only when it names exactly ONE platform: the pre-paint script at `LandingBody.astro:172` compares the raw parameter against a single id, so `airtable` stamps `html[data-bo-platform]` and `airtable,clickup` stamps nothing. The hero picker above the strip is where a reader SETS two at once, and the directory below adds a sub-block per platform for each of them.',
    columns: [
      {
        label: 'One platform named',
        href: '/?platform=airtable',
        what: 'Three cards, exactly as on every other address here. What changes is underneath them: the path steps take Airtable’s nouns — Base, Table, Record — the Airtable glossary row is the one revealed, and step 1 re-points at `/platforms/airtable/connecting/`.',
      },
      {
        label: 'Two named',
        href: '/?platform=airtable,clickup',
        what: 'The same page as no parameter at all. Two platforms is not one, so nothing is stamped and every noun below stays neutral — a reader with two on has not told us whose vocabulary is theirs.',
      },
      {
        label: 'All three named',
        href: '/?platform=airtable,clickup,notion',
        what: 'Also identical to no parameter, because three is not one either. Worth opening beside the card above only to confirm that “all of them” and “more than one” are one state here rather than two.',
      },
      {
        label: 'No parameter',
        href: '/',
        what: 'The neutral reading, and what a first-time visitor gets: three cards, neutral nouns, no glossary row open. A RETURNING reader is the exception — with nothing in the URL the stored preference wins, so this address can render as the first card above.',
      },
    ],
  },
  {
    id: 'docs-sidebar-filter',
    question: 'The docs sidebar filter — what does `?platform=` hide, and what does the control say as the count moves?',
    finding:
      'This is the one comparison of the four where the parameter genuinely changes the page. `platform-filter.ts` reads `?platform=` ahead of the stored preference and hides the sidebar row of every page tagged with a platform it does not name — 30 of the 86 documentation files carry a `platform` field, ten for each of the three — then folds away any group left with nothing in it. The CONTROL’s width is no longer part of the question: the inline chip row was deleted and every surface now draws the collapsed `PlatformPicker` trigger, which is one button whatever the count.',
    columns: [
      {
        label: 'One platform',
        href: '/start/getting-started/?platform=airtable',
        what: 'The tightest state. Twenty rows go, any group emptied by that folds with them, each surviving Airtable row carries the Airtable mark, and the trigger reads `Airtable` with that mark beside it. `Show all` appears next to the trigger.',
      },
      {
        label: 'Two platforms',
        href: '/start/getting-started/?platform=airtable,clickup',
        what: 'Ten rows go. The trigger drops the single name for `2 of 3` and draws both marks — marks only give way to a bare count above four selected, which three platforms cannot reach.',
      },
      {
        label: 'All three platforms',
        href: '/start/getting-started/?platform=airtable,clickup,notion',
        what: 'Nothing is hidden: this is the whole manual, reached from the other end. Two controls disagree about that — the picker says `All platforms` because all three of its rows are ticked, while `Show all` stays visible beside it, because `platform-filter.ts:130` compares the choice against the five platform IDENTITIES rather than the three that have pages. A reset offering to undo a filter that is not narrowing anything.',
      },
      {
        label: 'No parameter',
        href: '/start/getting-started/',
        what: 'Every row visible, each platform row still wearing its mark, the trigger reading `All platforms`, `Show all` hidden. For a returning reader this address is not a fixed state: with no parameter the stored preference wins, so it can render as any of the three cards above.',
      },
    ],
  },
  {
    id: 'search-modal',
    question: 'The search modal — does `?platform=` reach it, and is there still a chip row to measure?',
    finding:
      'Nothing on any of these four pages differs until the dialog is open, which is precisely why four live frames of them showed four identical documentation pages. The parameter is read at the moment the modal runs a query: `search-modal.ts:105` takes `currentPlatforms()` — URL first, storage second — and Pagefind is asked for the chosen platforms plus `all`, the value every platform-neutral page carries, so narrowing removes other platforms’ pages and never the neutral ones. The row this comparison was named after is also gone: search draws the same collapsed trigger the sidebar does, so the count changes a label rather than a width.',
    columns: [
      {
        label: 'One platform',
        href: '/reference/faq/?platform=airtable',
        what: 'Press `/` once the page is open. The trigger under `Search in` reads `Airtable`, and results are Airtable pages plus every page that names no platform. An empty result says so in those terms and offers one button back to all of them.',
      },
      {
        label: 'Two platforms',
        href: '/reference/faq/?platform=airtable,clickup',
        what: 'Press `/`. The trigger reads `2 of 3` and draws both marks. The result set is the union of the two platforms and the neutral pages — the filter ORs its values, it does not intersect them.',
      },
      {
        label: 'All three platforms',
        href: '/reference/faq/?platform=airtable,clickup,notion',
        what: 'Press `/`. The trigger reads `All platforms`, and a filter naming all three is still SENT rather than dropped, because `activeFilter()` compares against the five identities. It is harmless — three platforms plus `all` is every indexed page — but it is the same off-by-catalogue comparison that keeps `Show all` on screen in the sidebar.',
      },
      {
        label: 'No parameter',
        href: '/reference/faq/',
        what: 'Press `/`. No filter is sent at all. For a returning reader the stored preference decides which of the three states above they actually get, which is the one thing no address on this row can pin.',
      },
    ],
  },
  {
    id: 'roadmap-scope',
    question: 'The roadmap scope control — does it follow the reader’s filter at all?',
    finding:
      'No, and that is a decision rather than a gap. The board’s picker is `state="local"` with `catalogue="all"` (`roadmap.astro:197`): it holds its set on its own element, announces it with `pk:change`, and never reads or writes the shared preference. So all four addresses below render one board, and the board always loads with nothing narrowed. `board.ts:81` states the cost in a line — a `/roadmap/?platform=notion` link cannot exist. The reason is a vocabulary mismatch: this board draws all five identities because here a platform is the SUBJECT of a request, and writing a Smartsheet choice into the shared preference would set a docs filter the sidebar’s own control renders no row to switch back off.',
    columns: [
      {
        label: '?platform=airtable',
        href: '/roadmap/?platform=airtable',
        what: 'The same board as every other address here. The parameter survives in the address bar and is read by nothing on this page.',
      },
      {
        label: '?platform=airtable,clickup',
        href: '/roadmap/?platform=airtable,clickup',
        what: 'Identical again. Worth opening beside the card above only to see that two ids and one behave the same way, which is to say not at all.',
      },
      {
        label: '?platform=airtable,clickup,notion',
        href: '/roadmap/?platform=airtable,clickup,notion',
        what: 'Identical. What is worth noticing on the board itself is that its picker offers five rows and not three: Smartsheet and monday.com are votable subjects here precisely because nothing is built for them.',
      },
      {
        label: 'No parameter',
        href: '/roadmap/',
        what: 'The only address of the four that describes what the reader actually sees: every request, nothing narrowed, the platform picker resting at `All platforms`.',
      },
    ],
  },
];
