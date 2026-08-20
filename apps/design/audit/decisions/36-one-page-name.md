# D36 — One page name

**Rule in one sentence:** Every route opens with exactly one `<h1 class="text-title">` carrying the
**same string** the app bar paints below 1280, and the browser tab reads `<Page> — Baseout`.

## Why this option, not the alternative

`pattern-page-header` (authored 2026-08-13) already states the rule and names the mechanism:
`.text-title` is `--t-16` and then `display:none` below 1280, which is how the app bar takes over the
page name. Twenty-three of twenty-nine `<h1>`s carry it. The rejected alternative — fix each page's
heading where a scout found it — is what produced six exceptions in three different shapes, and each
one costs the same review as the sweep.

The user-visible symptom is that **at 390 several pages name themselves twice, in two different
words**. Measured on `/sources/new`: `.tb-title` paints *"Add source · Core CRM"* at 14px/y=11.5 and
the `<h1>` underneath paints *"Add an Airtable source"* at 20px/y=99.9; at 1440 `.tb-title` is
`display:none`. Destinations: *"Add destination"* against *"Add a destination"*. That is not a
typographic nit — a user reading two names for one screen has to work out whether they are on one
page or two.

The rest is the same rule failing in the other direction: `/settings`, `/settings/billing` and
`/help` render **zero** `h1` (Settings' page name is an `<h2>` at 20px, deliberately subordinate to a
page title that does not exist; the placeholders open at `<h3>`, so the document outline starts at
level 3). `/integrations/authorizing` has **no heading element at all**, so at 1440 the page is
nameless — its name exists only in `.tb-title`, which is hidden at that width. And the two
destination-flow headings are `text-2xl` / `text-xl` **literals**, which compute identically at 390
and 1440 while the same files' tokenised `.reg-section-title` correctly steps 16 → 14.

## Surfaces changed

| file | change |
|---|---|
| `SourceAddView.astro:35` · `DestinationAddView.astro:55,94` | `text-xl`/`text-2xl` literals → `.text-title`; the bar string and the h1 string become one sentence |
| `SettingsView.astro:132` | `.page-head` + `<h1 class="text-title">`; the pane title stays `<h2>` at 20px underneath |
| `PlaceholderView.astro:10` | `<h3>` → `<h1 class="text-title">` (both routes) — and see D08/D32, which remove the need for the component on `/help` and `/settings/billing` |
| new `AuthorizingView.astro` (D32) | ships with `.text-title`, as `IntegrationsManageBasesView.astro:34` already does and writes down why |
| `NotFoundView.astro:44` | the path branch's `<h3>` → `<h1>` — the *same component's* scoped branch already uses `<h1>` at `:33` |
| `AuthLayout.astro:14` | one `<title>` format (D35 carries the auth half) |

## storybook.ts

Amend `pattern-page-header`: state explicitly that **the `<h1>` string and the app-bar string are
the same string**, that the size is a token and never a literal, and that a page with no `<h1>` has
no name at all below 1280. Add the three routes above to its "surfaces" list so the next reader can
see the sweep was complete.

## Explicitly not changing

- The 1280 boundary itself and the `.tb-title` mechanism — that design is right and is what makes
  one string serve both tiers.
- `.reg-section-title` and the rest of the tokenised ladder on these files: measured stepping
  correctly 16 → 14 at 390. Only the literals are frozen, which is a clean demonstration of the
  [MINE] rule and should be cited when the sweep is reviewed.
- Settings' pane title staying at 20px. This is a hierarchy addition, not a promotion —
  `audit/PARKED.md:1173` rejected promoting a pane title into the 24px rung, and it was right.

## Members

S24-F1 (S2) · S24-F2 (S2) · S32-F7 (S2) · S28-F12 (S2) · S36-F8 (S2, path-404 half) ·
S36-F17 (S3) · S36-F7 (S2, the 404's type ladder — lands here with the same edit).
Extends **S22-F2** (the account cluster never adopted `text-title`), already ADOPTed as a sweep.
Supersedes the stale "Profile is the only surface without an `h1`" clause in **J08-F23**.

## How to verify done

`document.querySelectorAll('h1').length === 1` on every route in `apps/design/src/pages/**` ·
`grep -rn "text-2xl\|text-xl" apps/web/src/views` returns no page heading · at 390 the app-bar
string and the `<h1>` string are byte-identical on `/sources/new` and `/destinations/new` ·
`pnpm ds-lint` and `pnpm typecheck` green.
