# Engineering Principles

The non-negotiable rules for how work happens in this repo. Long-form rationale is in [CLAUDE.md](../CLAUDE.md) §3 — that file is the source of truth.

This section indexes the rules so agents and contributors can find them by name. When a rule is unclear, check CLAUDE.md.

## Senior Engineer Mindset

Understand the business context before writing code. Small reversible changes over clever sweeping ones. Use canonical naming ([[domain-model]]).

Surface trade-offs instead of silently picking. Open Questions in the PRD are explicit — flag missing requirements rather than inventing behaviour. Code for the next engineer; readability beats cleverness.

## Don't Refactor What Works

Working code stays as-is unless the task requires changing it. No drive-by refactors, no "while I'm here" cleanups, no preemptive abstraction.

**Match blast radius to problem size** — a 5-line fix doesn't get a 50-line restructure. Before editing a file, ask: *is this edit load-bearing for the task?* If no, don't make it. This applies to npm scripts, Vite config, `wrangler.jsonc`, and similar infra files just as much as to source code. Unrequested changes create review burden and regression surface.

## Security First

Security is a gate on every change, not an afterthought — see [[security-model]] for the full rules. The headline rules:

- Never hardcode secrets — Cloudflare Secrets only.
- AES-256-GCM at rest for OAuth tokens, refresh tokens, API keys.
- Magic-link auth only — no password flows in V1.
- API tokens stored as hashes (`api_tokens.token_hash`), never plaintext.
- Server-side validation on every mutating route. Client validation is UX.
- Parameterised SQL via Drizzle only. Never string-concatenate.
- `INTERNAL_TOKEN` gates `apps/server`'s `/api/internal/*`. Public surface is `/api/health`.

Any change introducing a new secret, auth path, SQL surface, internal-API surface, or external integration must explicitly call out security review points before approval.

## Test-Driven Development

Red → Green → Refactor for non-trivial code. Vitest is unit/integration; Playwright is end-to-end; msw mocks at the HTTP boundary.

Coverage targets per [shared/Baseout_PRD.md](../shared/Baseout_PRD.md) §14.4: **80% backend logic**, **60% UI**, critical flows under Playwright.

No implementation-without-test for: API route handlers, auth flows, billing/Stripe logic, backup/restore logic, capability resolution, trial enforcement, business-logic Drizzle queries, Durable Object state transitions, Trigger.dev task entry points.

Integration tests hit a **real local PostgreSQL** (Docker) and **real Miniflare bindings** — not mocks. Mocks are reserved for the HTTP boundary against external APIs (Stripe, Airtable, BYOS providers).

Regression-before-fix: reproduce every bug with a failing test before patching.

## No Stray Console Logs

Debug output never ships. `console.log/debug/info/warn/error/trace` and `debugger` statements may not be committed in `.ts/.tsx/.js/.mjs/.cjs/.astro/.svelte`.

Allowed exceptions: structured logging via the project logger, build/CLI scripts under `scripts/` or `bin/`, or a line annotated `// eslint-disable-next-line no-console` with a justification comment. Before committing, grep the staged diff for `console\.` and `debugger`. CI lint (`no-console`) must be green; do not disable the rule. Never `git commit --no-verify`.

## OpenSpec-Driven Changes

Per-app changes flow through `openspec/changes/<name>/` using `opsx:propose|apply|archive`, not free-form docs. Cross-cutting changes get no per-app symlink. Archived changes flow into `openspec/specs/`.

The complement is the lat.md knowledge graph — see [[openspec-vs-lat]] for the rule of thumb.

## Knowledge Graph Discipline

Persistent knowledge about the system goes into the lat.md graph (root or per-app). Proposed changes go into OpenSpec. Specifically:

- When you learn a load-bearing fact about how the system works, write it into the appropriate lat.md section — not into commit messages, not into the PR description, not into a one-off note in `shared/internal/`.
- When you propose a change to behaviour, that's an OpenSpec proposal. The lat.md graph is updated **after** the change ships, to reflect the new current state.
- `lat check` runs in CI and as a Stop hook. Don't claim work is complete until it's green.
- Cross-graph wiki refs (`[[../apps/server/lat.md/...]]`) are not supported by `lat check`. Use plain markdown links across graph boundaries — see [[openspec-vs-lat]].
- Symlinked dirs (`apps/*/openspec`, `apps/*/node_modules/@baseout/*`) currently emit non-fatal `EISDIR` warnings under `lat check` — to be excluded once a config mechanism exists.

## Frontend-Specific (apps/web)

State via nanostores in `apps/web/src/stores/`; hydrate server state with a JSON-script tag, not ad-hoc `window` globals. SSR by default; minimise client JS.

Theme primary is `@opensided/theme`, secondary is daisyUI, custom CSS is fallback. Mobile-first — design at <375 / <768 / <1024 px before desktop. Touch targets ≥44×44 px. Loading states for any server-waiting interaction must use `setButtonLoading` from `apps/web/src/lib/ui.ts` — `try { ... } finally { setButtonLoading(btn, false) }`. A disabled button alone is not sufficient.

## Asking, Confirming, Committing

Don't commit, push, or open a PR without explicit user approval. Approving a plan does not authorise individual git actions.

Create new commits rather than amending — when a pre-commit hook fails, the commit didn't happen. Stage specific files by name; avoid `git add -A`/`.`. For risky or hard-to-reverse actions (force-push, `reset --hard`, dropping tables, sending external messages, modifying CI/CD), confirm before acting.

## Where to Look

Pointers to authoritative sources for these rules.

- Long-form rules: [CLAUDE.md](../CLAUDE.md) §3
- Coverage targets: [shared/Baseout_PRD.md](../shared/Baseout_PRD.md) §14.4
- OpenSpec workflow: `opsx:propose|apply|archive` skills
- Knowledge graph rule of thumb: [[openspec-vs-lat]]
