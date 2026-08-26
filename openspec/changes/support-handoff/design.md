# support-handoff — Design

## 1. One principle, inherited

A state is **data**, not a duplicated screen. A row in `handoff-registry.ts` plus a URL that
produces the state — never a new `.astro` page per variant. This is the rule that stopped
`apps/design` growing a million screens, and it is the only thing keeping this page from becoming
the thing it documents.

The consequence to hold onto: **if a state cannot be reached by a URL, it does not get a row — it
gets fixed.** A state you cannot link to is a state nobody can report a bug against, and a state
nobody can report a bug against is one that rots.

## 2. The shape: flow → ordered steps → live URL

This is the shape `apps/design/src/pages/handoff.astro` already has, and the reason to copy it
rather than invent is that it has survived two months of use: the client opens it and walks a flow;
the engineer opens it and reads the same rows as a traceability table.

```
FLOW  "File a ticket while signed out"            status: built · 3 of 5 steps live
  step 1  Choose a door          /contact/                        ✓
  step 2  Describe the fault     /contact/?kind=ticket            ✓
  step 3  Suggested articles     —                                planned
  step 4  Attach a screenshot    /contact/?kind=ticket            ✓
  step 5  Done — case number     —                                planned
  EDGE    12 states · 3 unresolved                                ▸
  spec    support-ticket-portal · tickets · "Anonymous submission"
  source  contact.astro · submit.ts
```

Three things a flat list of states cannot express, and all three are why Oleh asked for this shape:

1. **Order.** "What does the person see next" is the question a client actually asks, and a flat
   state index answers everything except that.
2. **Completeness.** `3 of 5 steps live` is a number. A list of built states is a list with no
   denominator, so nothing on it can ever look unfinished.
3. **Where the edges hang.** An edge case belongs to a *step*, not to a page. `The email never
   arrives` belongs to step 5 of this flow and nowhere else, and that placement is the whole
   argument for hanging them off steps.

## 3. Edge cases are first-class content, not an appendix

The reason this page exists rather than a screenshot folder: it enumerates **what can go wrong**,
not what we built. Every step carries zero or more edge rows, each one of:

| field | meaning |
| --- | --- |
| `case` | the state, in the user's terms — *"the email never arrives"*, not *"delivery failure"* |
| `probe` | which systematic probe surfaced it: empty · one · many · long · broken · limit · partial · cross-step · entry · exit · stale · identity · platform-count · static-build |
| `disposition` | `handled` (with `file:line`) · `decide` (a named question) · `defect` (it is wrong today) |
| `href` | the URL that reproduces it, when one exists |
| `severity` | `high` breaks the flow · `medium` is real friction · `low` is polish. Absent where a `handled` row has nothing left to do |
| `note` | opens with the enumeration id, then the evidence — so a row here and a row in the walk are the same row and can be argued about by number |

A `defect` row is the page earning its keep. It is also the reason the page must never be
hand-maintained prose: a defect row with a URL is a bug report anyone can confirm in one click, and
a defect row in a document is a sentence somebody will disagree with.

**The nine cross-cutting frictions (X1–X9) and the twenty-one decisions (D1–D21) are a section of
their own**, not more edge rows. An `EdgeCase` earns its place by hanging off one step; each of
these is present in three or more flows, so attaching one would mean picking a host arbitrarily or
writing the same row up to six times and watching the copies drift. They render above the flow
catalogue, because a defect in one step is a bug and a friction in six flows is a decision nobody
took — and each names its flows by id, so the section links down into the rows that are its local
instances.

**Static-build and platform-count are probes of their own here**, because both are specific to this
portal: a query parameter cannot change server-rendered output in `apps/support`, and every step has
a different shape at 1 platform than at 5.

## 4. Where it lives, and what it must be excluded from

`apps/support/src/pages/handoff.astro` + `apps/support/src/lib/handoff-registry.ts`.

It is a meta page about the portal, not a page of it, and four places will otherwise absorb it:

| Exclusion | Mechanism | Why |
| --- | --- | --- |
| Header nav | simply not added to `Header.astro`'s list | three items is the measured budget at 390 |
| Docs sidebar | it is not a content-collection entry, so it never appears | — |
| Search | `search-modal.ts` already excludes a path string (`tickets`); add this one | a reader searching "ticket" must not land in a spec index |
| Sitemap + robots | `noindex` meta + sitemap filter | it will be public; it should not be *found* |

**It deploys publicly and there is no auth on this app.** Anyone with the URL can open it. That is
accepted rather than solved: it carries no credentials, and the portal it indexes is itself a
pre-launch demo. If that stops being true, the page moves behind whatever gate tickets end up using.

## 5. How a variant is produced in a STATIC app — the constraint that shapes everything

`apps/support/astro.config.mjs` declares no `output` and no adapter, so the whole portal is a static
build. **A query parameter cannot change what the server rendered.** `apps/design`'s `/handoff` can
link `?fixture=empty` and get a different page; this app cannot. Three mechanisms exist here, each
with a precedent already in the tree:

1. **Render every variant, let the client choose.** `shot-switch.ts`: both landing variants are
   server-rendered and an attribute on `<html>` decides which is seen — stamped by a pre-paint
   script so the page cannot flash the other one. Cost: page weight. Use for two or three variants
   of one block.
2. **Client-side narrowing over one render.** `platform-filter.ts`: the page renders everything and
   the controller hides what the preference excludes, precedence **URL beats storage** — because a
   link someone shares carries the platforms it was written for. Use for the platform axis;
   `?platform=airtable` already works on every docs page today.
3. **A real built page.** Only when the variant differs structurally — the ticket thread is a
   different route, not a different state of an existing one.

**~~The handoff page composes, it does not re-implement.~~ REVERSED 2026-08-21 (Oleh).** Each
comparison cell WAS an `<iframe>` whose `src` was the real portal URL carrying the real parameter,
on the argument that nothing mocked can drift from what a visitor gets. The argument was sound and
the premise was not, on three counts measured before the change:

- **The subject was never in frame.** The landing's platform strip sits ~657px down the page and a
  cell was 560px tall, so every cell showed the site header — which is why all four looked
  identical.
- **Two of the four surfaces do not read `?platform=` at all.** The roadmap's picker is
  `state="local"` (`roadmap.astro:197`, `board.ts:81`), and the search modal changes nothing until
  the dialog is open.
- **The filter is applied client-side**, so the served HTML of all four URLs in a row is
  byte-identical by design.

**Each column is a CARD instead**: its label, its URL as a link, and one or two sentences saying
what you would see there and what is different about it, written from the source. Where an address
genuinely changes nothing the card says so and says why — a more useful sentence than a picture of
two identical headers. `HandoffComparison` grows a required `finding` (the verdict for the whole
row, stated once) and a required `what` per column, so a comparison added without them fails a type
gate rather than shipping four cards that imply a difference nobody checked for. The width control
(`Fit / 30rem / 50rem / 72rem`) existed to hold a live cell at a portal breakpoint and went with the
frames; nothing left on the page measures anything.

**The axis is 1 · 2 · 3 · no-parameter, not "All 5".** `platforms.ts` holds five identities and only
three have a `platforms/<id>/connecting.md`, so every visitor-facing filter draws three rows
(`documented-platforms.ts`). A column labelled "All 5" promised a state no documentation surface can
be in.

## 6. The platform axis

The comparison Dan's doubt actually asks for is **1 · 2 · 3 · 5**, on the four surfaces where the
platform count changes the geometry: the landing's platform strip, the docs sidebar's filter, the
search modal, and the roadmap's scope control.

`platforms.ts` holds three identities today — `airtable | clickup | notion` — each with a name, a
brand mark with documented provenance, vendor-published colours, and **a vocabulary**: what that
platform calls the thing you are choosing between. The vocabulary is the reason the file exists; a
platform without one is a chip, not a platform.

**Decided (Oleh, 2026-08-21): the fourth and fifth are Smartsheet and Monday.com.** They are the
closest competitors in the same market, so the demo stays honest and the vocabulary is real —
Smartsheet: Sheet · Column · Row · View; Monday: Board · Group · Item · Column. Marks are sourced
with the same provenance discipline as the existing three, and colours are the vendors' own; nothing
is invented. Placeholder platforms were rejected: a grey mark labelled "Platform 4" understates the
design by exactly the property that lets a chip be recognised without being read.

## 7. The flow catalogue

Every flow a person can walk in the portal. `built` rows have live URLs today; `planned` rows carry
the same fields minus `href`, which is deliberate — the moment the URL exists, one field changes and
the index is current. Step lists and edge rows are filled from the enumeration produced alongside
this change.

| Flow | Surface | Status |
| --- | --- | --- |
| Land and choose a platform | landing | built (two variants, `?shots=`) |
| Read documentation | docs | built |
| Filter the documentation to my platform | docs | built |
| Land on a page my own filter hides | docs | built |
| Search the documentation | search | built |
| Ask the AI chat | chat | built |
| Run out of free messages | chat | built |
| Escalate from chat to a person | chat → contact | planned |
| File a ticket while signed out | contact | built, done-state changes |
| File a ticket while signed in | contact | planned |
| Ask about billing · sales · something else | contact | built |
| Submit a public feature request | contact → roadmap | built |
| Hit a duplicate while submitting a request | contact | built |
| Browse the roadmap | roadmap | built |
| Vote on a request | roadmap | built (`VOTES_LIVE = false`) |
| Follow up on a case I filed | email → contact | planned |
| See my requests | tickets | planned |
| Read and answer a thread | tickets | planned |
| Reopen something closed | tickets | planned |
| Rate a documentation page | docs | built |

## 8. Registry shape

```ts
export type HandoffStatus = 'built' | 'planned' | 'discussion';
export type EdgeProbe =
  | 'empty' | 'one' | 'many' | 'long' | 'broken' | 'limit' | 'partial'
  | 'cross-step' | 'entry' | 'exit' | 'stale' | 'identity'
  | 'platform-count' | 'static-build';

export type EdgeSeverity = 'high' | 'medium' | 'low';

export interface EdgeCase {
  case: string;                  // in the user's terms
  probe: EdgeProbe;
  disposition: 'handled' | 'decide' | 'defect';
  where?: string;                // file:line when handled
  href?: string | null;          // the URL that reproduces it
  severity?: EdgeSeverity;       // only where something is left to do
  note?: string;                 // opens with the enumeration id (E1…E268)
}

export interface HandoffStep {
  label: string;
  href: string | null;           // null = not built
  caption: string;               // what to look at, in the client's terms
  edges?: EdgeCase[];
}

export interface HandoffFlow {
  id: string;                    // canonical, identical in the spec tag and the row
  surface: 'landing' | 'docs' | 'search' | 'chat' | 'contact' | 'roadmap' | 'tickets';
  label: string;
  status: HandoffStatus;
  steps: HandoffStep[];
  specs?: SpecRef[];             // OpenSpec change · capability · scenario
  source?: string[];             // the files that render it
  note?: string;
}

export interface HandoffComparison {
  id: string;
  question: string;              // 'What changes as platforms scale'
  finding: string;               // what these URLs actually do to this surface — including "nothing"
  columns: { label: string; href: string; what: string }[];
}

// A friction is what an EdgeCase cannot be: present in three or more flows, so it has no one step
// to hang off. `flows` carries flow ids so the page links each one into the catalogue.
export interface HandoffFriction {
  id: string;                    // X1…X9
  title: string;                 // same voice as EdgeCase.case
  severity: EdgeSeverity;
  flows: string[];               // HandoffFlow ids
  evidence: string[];            // file:line
  fix: string;
}

export interface HandoffDecision {
  id: string;                    // D1…D21
  question: string;
  options: [string, string];
  recommendation: string;
}
```

**`severity` was added when the enumeration landed** (2026-08-21). The walk graded every row it
found and the type had nowhere to put it, and a catalogue of 268 states with no ranking is a list
nobody can start on. It is optional because a `handled` row with nothing left to do carries none —
the absence is the statement, and colouring all 268 would flatten the 22 that break a flow.

`href` is the whole contract. A row whose URL does not reproduce its state is a lie the page tells
with a straight face, so **every non-null `href` is added to `pnpm smoke-support`** — a row that
stops reproducing its state fails a gate instead of ageing quietly.

## 9. Open decisions

1. **Does the page stay after launch, or is it built to be deleted** — as `shot-switch.ts` says of
   itself in its own header? Recommendation: it stays. The catalogue is worth more once real
   customers are filing tickets, not less.

## 10. Non-goals

Screenshots or a static gallery (it must show the live portal or it is worthless) · authentication ·
an editor for the registry · anything under `apps/web` · the ticket surfaces themselves, which are a
separate change this page only indexes.
