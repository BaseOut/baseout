# Support docs automation — strategy (Dan sync, 2026-08-26)

## What Dan asked for (transcript, support section)

1. **"The support page is pretty much final."** Get familiar with it; no more UI churn expected,
   and he is "less worried about trying to keep the UI in sync over time with that one."
   → Done: final sync of `apps/support` at `ui-only@af6d4b27` (this change). The surface exits
   the ui-sync loop; from here the *content* is ours and the *shell* is frozen.
2. **The main ask:** "Can we auto-create our documentation pages — at least a strategy. I would
   probably have Fable 5 create a strategy and then create skills of: when things are changed,
   here's a skill to evaluate if it needs to update an existing documentation page or create a
   new one."
3. **Changelog:** "There's a changelog that we should be able to auto-update. Not now — we don't
   need to add every little thing we're doing now. We'll just have an initial launch entry and
   from there do changelogs."
4. **Snapshots/screenshots:** mimic the screenshot style already in the portal docs. The portal
   is public (no login), so screenshots of *it* are trivial; for authed `apps/web` screenshots
   Dan offered his weekend project — Cloudflare Browser Rendering with the password injected as
   a Worker secret (never copy-pasted). SOC 2-friendly.
5. **Roadmap:** `/roadmap` feature content is part of the same content program.

## What the synced portal already gives us (don't rebuild)

- **86+ doc pages** under `apps/support/src/content/docs/**` organized by product area
  (start / connections / backups / restore / schema / data / platforms / account /
  troubleshooting / reference / api / mcp) — the taxonomy IS the routing decision for new pages.
- **Machine-readable corpus:** `llms.txt` + `llms-full.txt` routes and per-page raw `.md`
  endpoints (`[...slug].md.ts`). An agent can diff "what the docs say" against "what the code
  does" without scraping HTML.
- **Changelog framework:** `lib/changelog.ts` (month grouping, dates, reading time) + one page
  per entry under `docs/changelog/<year>/<slug>`. Adding an entry = adding one markdown file.
  The five existing entries are the style guide.
- **Screenshot component:** `components/markdoc/Screenshot.astro` — the "snapshots" Dan wants to
  mimic already have a rendering slot; the automation only has to produce the image files.
- **A generated-register precedent:** the fork's `edge-register.mjs` pattern (generate from a
  single source, `--check` fails when the committed artifact drifts). Same pattern applies to
  docs freshness.

## Strategy: three skills + one freshness gate

### Skill 1 — `support-docs-update` (the evaluator Dan described)
Trigger: after a behavior-changing feature lands in `apps/web` / `apps/server` / `apps/workflows`
(invoked manually at first; later a candidate for a repo rule/CI hint).
1. Read the diff / openspec change that shipped.
2. Map it to the docs taxonomy: query `llms-full.txt` + Pagefind index for pages citing the
   touched capability (canonical dictionary terms from Features §1 are the join key).
3. Decide per page: **update existing** (behavior a page documents changed), **create new**
   (net-new capability with no page; place it by taxonomy folder + sidebar order), or
   **no-op** (internal-only change). The skill errs to update-existing — new pages need the
   taxonomy fit argued explicitly.
4. Write in the portal's established voice (existing pages are the style corpus), `.md` or
   `.mdoc` matching siblings; never touch the shell components.
5. Output includes a proposed changelog line (consumed by Skill 2, not published immediately).

### Skill 2 — `support-changelog`
Not wired to every commit (Dan: explicitly not now). Two modes:
- **Launch mode (first run):** one "initial launch" entry summarizing the product at go-live.
- **Steady state:** batch accumulated Skill-1 changelog lines into per-change entries under
  `docs/changelog/2026/<slug>.md`, month grouping comes free from `lib/changelog.ts`.
  Cadence: on release/deploy, not on merge.

### Skill 3 — `support-snapshots`
Produce the screenshots the docs embed:
- **Portal + public surfaces:** headless browser against the deployed public URL — no auth
  needed, no secrets involved.
- **Authed `apps/web` screens:** Dan's Cloudflare Browser Rendering worker (password as Worker
  secret, injected at login — nothing pasted). Decision needed from Dan: hand over that project
  or we rebuild the ~50-line pattern in-repo.
- Output goes through `Screenshot.astro`'s existing conventions (naming, sizing); a manifest maps
  doc page → screenshots → the app route + state that produced them, so a re-run refreshes stale
  shots after UI changes.

### Freshness gate (the edge-register trick, applied to docs)
A generated `docs-register` mapping each docs page → the code/spec surfaces it documents (files,
openspec capabilities). `--check` mode lists pages whose sources changed since the page was last
touched. This is what makes "auto-updater" honest: the gate finds stale pages; Skill 1 fixes them.

## Sequencing

1. **Now (this change):** final UI sync ✅, this strategy doc, ledger updated.
2. **Next:** write Skill 1 + the docs-register generator; dry-run it against one recently shipped
   change (e.g. the D1 Browse reads) and hand-review the proposed page edits.
3. **Then:** Skill 3 portal screenshots (public, zero-secret) + the launch changelog entry
   (timed with go-live, per Dan).
4. **Later / needs Dan:** authed-screenshot path (his Browser Rendering project), CI wiring of the
   freshness gate, and any GitHub rules that flag docs-affecting merges (Dan deferred rules until
   the environment split settles).

## Out of scope here

Ticket backend / auth bridge / chat engine / D1-KV provisioning / production DNS for the portal —
all still deferred (see `openspec/changes/support-portal` pairings). The environment separation and
`.dev.vars` handoff from the same meeting are separate work items, not part of this program.
