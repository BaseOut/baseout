# web-actions — Promote the read-only "Actions" landing into the live app

## Status

PROPOSED — 2026-08-11 (pivoted from `web-agents`). Single-app (`apps/web`). A
Stage-2 promotion of the ui-only design fork's canonical work
(`ui-only@7502f81` "Airtable goes read-only, and writing gets its own section",
Oleh 2026-08-07). Pairs with `design-descriptions-readonly` (the harness-side
read-only removal — of which the fork's `7502f81` is the canonical superset) and
`system-sync-skills` (which surfaced that the fork had already built this).

## Why

~95–99% of Baseout's interaction with Airtable is read-only. The boss's
walkthrough asked to make that a hard, sellable boundary — *"we don't modify your
system"* — by pulling the one write affordance out into its own opt-in section.

Two facts set the shape of this change:

- **The designer already built it.** `system-sync-skills`' drift tool
  (`pnpm ui:sync-drift`) surfaced that `ui-only@7502f81` (Aug 7) already ships
  the exact feature: Airtable descriptions read-only, and a new **"Actions"**
  section as a landing page. Its `ActionsView.astro` is self-contained daisyUI
  (bespoke = 0), so the right move is to **promote it verbatim** — not to
  hand-roll a lesser duplicate. (An earlier draft of this change did exactly
  that, under the name "Agents"; it is replaced here.)
- **Name = "Actions", not "Agents".** The designer chose "Actions" with a written
  rationale; it is closest to the spec's "Schema Management Actions" and avoids
  "Workflow" (a banned alias) and the *inbound* sense of "agent" (PRD §11). This
  change adopts that name (one Features §1 dictionary line).

Write-back itself stays **V2/deferred** (PRD §10; Backlog V2.7/V2.10). The
landing is inert — no runtime, no write scope. It corrects a V2 scope leak (the
old harness Publish button needed `schema.bases:write`, which Baseout never
requests) and is the spec-sanctioned "coming soon" pattern (PRD §15.2).

## What Changes

- **`apps/web/src/views/ActionsView.astro`** — promoted verbatim from
  `ui-only@7502f81`. Self-contained daisyUI (`alert · badge · textarea · button ·
  card`): a "Planned"-badged header ("Operations that write to your Airtable"),
  an announce block naming the read-only boundary and its **two** write
  exceptions (Restore + Actions), the six drafted example operations, a
  write-scope explainer (`pattern-access-scope`: the read-only backup token
  cannot run an action), and a no-JS feedback form (GET → submitted state).
- **`apps/web/src/lib/actions.ts`** — the six example operations + the
  `ActionExample` type, promoted from the fork's `fixtures/actions.ts` into a real
  lib module (drafted proposals; "Nothing here runs today").
- **`apps/web/src/pages/actions.astro`** — the live route: `SidebarLayout`
  (`spaceScoped`, breadcrumbs) + `ActionsView`, fed `ACTION_EXAMPLES`, reading
  `?state=` from the URL. Auto-protected by middleware (`/actions` ∉
  `PUBLIC_PATHS`); no `[space]` segment.
- **Nav — `apps/web/app-config.json`** — one `navigation.top` entry (`Actions` →
  `/actions`, icon `lucide--square-pen`). Auto-appears in web + design sidebars;
  breadcrumbs auto-wire.
- **`shared/Baseout_Features.md` §1** — an **Action** dictionary row (the
  write-to-Airtable-operation sense; Restore is the other write exception;
  "Agent"/"Workflow"/"Automation" reserved). Flags (not fixes) the §7.3-vs-§10
  V2-status inconsistency.

## Capabilities

### New Capabilities

- `actions-landing`: an "Actions" nav destination whose page names the read-only
  boundary, lists the drafted write operations, states the separate write-scope
  token requirement, and collects one open question — no engine, no write scope,
  no data mutation.

## Non-Goals

- **No action runtime, no write OAuth scope, no per-action write logs** — V2.
- **No feedback persistence** — the form is the designer's no-JS placeholder
  (GET → "on the list"); wiring a POST + store is the immediate follow-up when
  persistence lands. (The designer deliberately omitted email capture — the
  reader is a logged-in customer.)
- **Not fetching the fork's read-only EntityPanel here** — that half of
  `7502f81` is the harness-side `design-descriptions-readonly` change (a diverged
  forward-sync); this change is only the live-app Actions landing.

## Impact

- **`apps/web`**: `src/views/ActionsView.astro` (new, verbatim promotion),
  `src/lib/actions.ts` (new), `src/pages/actions.astro` (new),
  `app-config.json` (one nav item), `src/lib/config.test.ts` (nav + breadcrumb
  assertion). `agents.astro` (the replaced draft) deleted.
- **`shared/Baseout_Features.md`**: one §1 dictionary line.
- No server/DB/secret change, no migration, **no new OAuth scope**. Security
  surface unchanged (the page adds no write path; the form is a GET placeholder).
- **Ledger:** record the ActionsView promotion in `shared/internal/ui-sync.md`
  §4 (promoted at `ui-only@7502f81`).
