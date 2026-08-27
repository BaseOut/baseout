---
name: support-docs-update
description: Evaluate whether a shipped code change needs the support portal docs updated — update an existing page, create a new one, or no-op — and stage the edit plus a changelog candidate. Use after a behavior-changing change lands in apps/web, apps/server, or apps/workflows, or when `pnpm support:docs-check` flags stale pages.
---

# support-docs-update — code changed; does the documentation?

The support portal (`apps/support`) is the customer-facing documentation.
Its UI shell is FROZEN (Dan, 2026-08-26: "the support page is pretty much
final") — this skill touches CONTENT only: pages under
`apps/support/src/content/docs/**` and their frontmatter. Program context:
`plans/2026-08-26-support-docs-automation.md`.

## Inputs

Run from either trigger:

- **A change just shipped** — you have the commit(s) or openspec change in
  hand.
- **The freshness gate flagged pages** — `pnpm support:docs-check` exited 1;
  each stale row names the page, the source, and the commit that moved it.

## Step 1 — Map the change to pages

1. `pnpm support:docs-register` — stale rows are your primary work-list.
2. For behavior the register does not map yet (93 pages are still unmapped),
   find candidate pages by capability vocabulary: search
   `apps/support/src/content/docs` for the canonical terms
   (`Baseout_Features.md` §1 — Source, Destination, Space, Run, …) the change
   touches. `rg -l` over the docs tree beats guessing from the taxonomy.
3. The taxonomy IS the placement rule for anything new:
   start / connections / backups / restore / schema / data / platforms /
   account / troubleshooting / reference / api / mcp.

## Step 2 — The verdict, per page

Decide one of three, and err toward `update` over `create`:

- **no-op** — the change is internal-only (refactor, infra, perf), OR it is a
  bug fix that RESTORES what the page already says. A fix that makes the
  documented behavior true again needs no prose change — it needs only a
  changelog candidate (step 4) and a frontmatter re-anchor (step 5).
- **update** — documented behavior changed: a flow gained/lost a step, copy
  the user sees changed, a limit or default moved. Edit the existing page.
- **create** — a net-new user-visible capability with no page. Argue the
  taxonomy fit explicitly (which folder, which sidebar order, why no existing
  page could absorb it). New pages are the exception.

## Step 3 — Write in the portal's voice

- The existing pages are the style corpus — match them: second person,
  present tense, "In this guide, you will:" openers where siblings have them,
  the canonical naming dictionary, no invented API paths (the `api:`
  frontmatter carries a `summary` SENTENCE, never a guessed endpoint —
  see the schema comment in `apps/support/src/content.config.ts`).
- `.md` vs `.mdoc` follows the page's siblings. Screenshots go through
  `components/markdoc/Screenshot.astro` conventions.
- NEVER touch shell components, styles, or layout — content only.

## Step 4 — Changelog candidate (do not publish)

Write one candidate line per user-visible change into the review output
(step 6). Per Dan (2026-08-26): no changelog entries are published until the
initial launch entry exists; candidates accumulate and are batched per
release by the changelog process, not per commit.

## Step 5 — Re-anchor the freshness gate

For every page you touched OR judged no-op:

- Ensure its `sources:` frontmatter lists the repo paths whose behavior it
  documents (the register's comment block in `content.config.ts` is the
  contract). Seed it if the page was unmapped — every pass through a page
  pays down coverage debt.
- A no-op verdict still requires a page commit to clear the stale flag (the
  gate compares commit timestamps). The `sources:` seed/touch IS that commit —
  never a filler edit.

## Step 6 — Gate + review

1. `pnpm support:docs-check` must exit 0 for the pages you handled.
2. `pnpm --filter @baseout/support build` green (Starlight validates
   frontmatter against the schema).
3. Present for human review before committing: verdict per page
   (update/create/no-op + one-line reason), the diff, and the changelog
   candidates. Human-tested local-commit loop — never push.
