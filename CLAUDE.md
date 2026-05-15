# Baseout monorepo

The unified repo for Baseout — Airtable backup, restore, and data intelligence. This file is the standards source-of-truth for the whole repo. Once the `apps/*` migration completes, frontend-specific and backend-specific sections below split out into per-app `CLAUDE.md` files.

---

# 1. Source of Truth: Product Specs

Canonical specs live in [shared/](shared/):

- [shared/Baseout_PRD.md](shared/Baseout_PRD.md) — Product requirements, **v1.1 (March 25, 2026)**, scope-locked. Authoritative current PRD.
- [shared/Baseout_Features.md](shared/Baseout_Features.md) — Pricing tiers, capability matrix, naming dictionary, quotas, Stripe metadata schema.
- [shared/Baseout_Implementation_Plan.md](shared/Baseout_Implementation_Plan.md) — Phased build order, repo map, parallel work streams.
- [shared/Baseout_Backlog.md](shared/Baseout_Backlog.md) / [shared/Baseout_Backlog_MVP.md](shared/Baseout_Backlog_MVP.md) — Prioritized backlog.
- [shared/internal/](shared/internal/) — Internal working notes (ops-setup, refactor-roadmap).

**Rules:**

- Every feature, field, table name, tier limit, and capability gate **must** match these specs. If a request conflicts, flag the conflict and cite the spec section — don't silently pick.
- Use the canonical naming dictionary from `Baseout_Features.md` §1 (Organization, Space, Platform, Connection, Base, etc.) in all code and copy. Never invent synonyms.
- Gate capabilities and quotas from Stripe product metadata (`platform` + `tier`) per `Baseout_Features.md` §5.5 — never from product name strings.
- V2-only capabilities (MCP server, RAG, Governance, third-party connectors, multi-platform Spaces) are out of scope unless explicitly requested.

The older [product/info/](product/info/) overview predates the v1.1 PRD — treat the v1.1 PRD as authoritative when the two disagree.

---

# 2. Repo Layout

## Target

Per [shared/Baseout_Implementation_Plan.md](shared/Baseout_Implementation_Plan.md):

```
apps/
  web/        Frontend Astro SSR app — auth, OAuth Connect, dashboard, settings
  server/     Backup/restore engine Worker — Durable Objects, schema discovery, enqueues Trigger.dev tasks
  workflows/  Trigger.dev v3 task project — backup-base + other long-running task definitions (Node runner)
  admin/      Admin / observability surfaces
  api/        Public + internal API layer
  sql/        Direct SQL access (Business+ tier)
  hooks/      Webhooks
packages/
  db-schema/  Drizzle schema (shared)
  shared/     Shared types + utilities
  ui/         Shared UI primitives
openspec/     OpenSpec changes + specs (driven by opsx:propose|apply|archive)
shared/       Product-spec docs (PRD, Features, Implementation Plan, Backlog)
brand/        Brand assets + guidelines
scripts/      Repo automation (incl. fix-symlinks.js postinstall)
references/   Third-party reference material
```

Package manager pinned at `pnpm@9.12.0`. New apps go in `apps/<name>/` with package name `@baseout/<name>`. New shared utilities go in `packages/<name>/`.

## Current

`brand/`, `shared/`, `product/info/` (older marketing overview), `product/website/` (Astro marketing site — not yet relocated to `apps/web/`). The full frontend implementation and backup engine each live in their own repos today and will migrate into `apps/web/` and `apps/server/` respectively.

## Repo Split: Frontend vs Backend vs Workflows

Baseout is conceptually two Workers + one Trigger.dev task project + one shared Postgres, regardless of where the code currently lives:

- **Frontend (eventual `apps/web/`)** — Astro SSR app, auth + magic-link, OAuth Connect flows, integrations dashboard, settings, marketing pages, middleware, `/ops` staff console, master-DB schema ownership.
- **Backend / backup engine (`apps/server/`)** — Headless Cloudflare Worker. Exposes only `/api/health` (public probe) and `/api/internal/*` (`INTERNAL_TOKEN`-gated). Hosts Durable Objects (per-Connection rate-limit gateway, per-Space scheduler), enqueues Trigger.dev tasks via `@trigger.dev/sdk`. Cron-only background work that fits inside Worker wall-clock budget runs here too.
- **Workflows (`apps/workflows/`)** — Trigger.dev v3 task project. Tasks run on Trigger.dev's **Node** runner (unlimited concurrency, no Worker time limit) and are enqueued from the Backend Worker. Houses the per-base backup task and any future long-running async work. Writes backup output to local disk (R2 was removed) — eventually BYOS.

**Rules:**

- The backend has no UI, no `/login`, no `/api/auth/*`, no better-auth, no per-engine user identity. Auth, login, settings, and `/ops` UI all live in the frontend. The backend sees only `INTERNAL_TOKEN` from the frontend.
- Backend reads OAuth tokens written by the frontend; both must agree on the master encryption key.
- If you find yourself adding a UI component, an `/ops` page, or a `better-auth` instance to the backend, you're proposing the wrong split — surface it before coding.
- Master-DB schema migrations are owned by the frontend. The backend mirrors specific tables (e.g. `backup_runs`, `backup_configuration_bases`) with header comments naming the canonical migration source.
- Workflows is Node-only: never import `cloudflare:workers`, never assume workerd globals. The Backend Worker bundle stays SDK-only — task references are `import type { … } from "@baseout/workflows"` so task bodies don't leak into the Worker bundle.

---

# 3. Engineering Principles (Apply Everywhere)

## 3.1 Senior Software Engineer Mindset

- Understand the business context before writing code. Read the relevant PRD/Features section first.
- Prefer small, reversible, well-tested changes over clever sweeping ones.
- Name things precisely using the canonical dictionary.
- Surface trade-offs and alternatives when a decision is non-obvious. Don't silently pick.
- Flag missing requirements rather than inventing behavior. Open Questions in the PRD are explicit — use them.
- Code for the next engineer. Readability > cleverness.

## 3.2 Don't Refactor What Works

Working code stays as-is unless the task requires changing it.

- **No drive-by refactors.** Don't rename, reshape, extract, inline, or "tidy up" code that wasn't broken and isn't in scope.
- **No "while I'm here" cleanups.** If you spot something to improve, file a TODO or mention it in the PR description — do not land it in this change.
- **No pre-emptive abstraction.** YAGNI. Wait until a second real call site exists.
- **Match blast radius to problem size.** A 5-line bug fix doesn't need a 50-line restructure.
- **Preserve working config and scripts.** Don't "improve" npm scripts, Vite config, `wrangler.jsonc`, or similar infrastructure unless the task explicitly requires it.
- **Before editing a file, ask: is this edit load-bearing for the task?** If no, don't make it.

Unrequested changes create review burden, introduce regression surface, and waste time re-verifying behavior that already worked.

## 3.3 Security First

Security is a gate on every change, not an afterthought.

- **Secrets:** Never hardcode. All secrets via Cloudflare Secrets or `.env` (never committed). See PRD §20.
- **Encryption at rest:** OAuth tokens, refresh tokens, and API keys encrypted with AES-256-GCM in the master DB (PRD §20.2). Never store plaintext.
- **Passwords:** Baseout is passwordless (magic-link via `better-auth`). No password inputs, hashing, or "forgot password" flows anywhere. If a requirement implies passwords, surface as a scope conflict.
- **API tokens:** Store hashes, not plaintext (see `api_tokens.token_hash` in PRD §21.3).
- **Input validation:** Server-side on every API route and form handler. Client validation is UX, not security.
- **Auth enforcement:** Frontend route protection lives in middleware. Every protected page and API route passes through it — no ad-hoc checks.
- **CSRF:** Use `better-auth` CSRF helpers on mutating frontend forms. No raw POST handlers without a token.
- **Service-to-service auth (backend):** `/api/internal/*` is gated by the `x-internal-token` header (`INTERNAL_TOKEN`). Match the value the frontend holds in `BACKUP_ENGINE_INTERNAL_TOKEN`. Never widen to public.
- **SQL:** Parameterized queries via Drizzle only. Never string-concatenate SQL.
- **Direct SQL API (Business+):** Read-only by default (PRD §10 / Features §14.2). Write access is an explicit opt-in.
- **Output:** Rely on Astro auto-escaping. Never `set:html` on user-supplied data.
- **Principle of least privilege:** OAuth scopes, DB roles, and API tokens scoped to the narrowest viable set.
- **Audit:** Auth and billing state changes write to the appropriate log table (frontend). Backup runs write rows to `baseout.backup_runs` (backend).
- **Fontawesome auth tokens** must use `${FONTAWESOME_TOKEN}` env-var form in `.npmrc` — never commit a literal token.

If a change introduces a new secret, a new auth path, a new SQL surface, a new internal-API surface, or a new external integration, explicitly call out the security review points before requesting approval.

## 3.4 Test-Driven Development

Follow red-green-refactor for non-trivial code. [Vitest](https://vitest.dev) per PRD §14.

**The loop:**

1. **Red** — Write a failing test that expresses the desired behavior.
2. **Green** — Write the minimum code to make it pass.
3. **Refactor** — Improve the implementation with tests green.

**Coverage targets (PRD §14.4):**

- Backend logic (API handlers, Workers, jobs, services, Trigger.dev tasks): **80% unit**
- UI components: **60% unit**
- Critical flows: covered by Playwright E2E

**Rules:**

- No implementation without a test first for: API route handlers, auth flows, billing/Stripe logic, backup/restore logic, capability resolution, trial enforcement, Drizzle queries with business logic, Durable Object state transitions, Trigger.dev task entry points.
- Integration tests hit a real local PostgreSQL (Docker) and real Miniflare bindings — not mocks. External APIs (Stripe, Airtable, BYOS providers) mocked at the HTTP boundary with [msw](https://mswjs.io). Backend integration tests use [@cloudflare/vitest-pool-workers](https://www.npmjs.com/package/@cloudflare/vitest-pool-workers).
- Every PR must include tests for the change. CI blocks merge on failing tests.
- Regression before fix: reproduce every bug with a failing test before patching.

## 3.5 Commit Hygiene: No Stray Console Logs

Debug output must not ship.

- **No `console.log`, `console.debug`, `console.info`, `console.warn`, `console.error`, `console.trace`, or `debugger` statements** may be committed. Applies to `.ts`, `.tsx`, `.js`, `.mjs`, `.cjs`, `.astro`, `.svelte` — both client and server.
- **Allowed exceptions** (must be explicit and intentional):
  - Structured logging via the project's logger utility (not raw `console.*`).
  - Build/CLI scripts under `scripts/` or `bin/` where stdout is the product.
  - A `console.*` line annotated with `// eslint-disable-next-line no-console` **and** a short justification comment.
- **Before committing:** grep the staged diff for `console\.` and `debugger`.
- **Pushing to `origin/main`:** never push without explicit user approval. If any `console.*` survived review, surface each occurrence (file + line) before the push.
- **PRs:** CI lint (`no-console` ESLint rule) must be green. Don't disable the rule to get green.
- **Never** `git commit --no-verify` to bypass the pre-commit hook.

## 3.6 OpenSpec-Driven Changes

Per-app changes flow through `openspec/changes/<changename>/` using `opsx:propose|apply|archive`, not free-form docs. Cross-cutting changes (e.g. `web-client-isolation`) get no per-app symlink. Archived changes flow into `openspec/specs/`.

---

# 4. Frontend Standards (eventual `apps/web/`)

## 4.1 State Management: nanostores

For all cross-component reactive state in the Astro app, use [`nanostores`](https://github.com/nanostores/nanostores). There is no official `@nanostores/astro` package — hydrate server state into the store via a `<script type="application/json">` tag and a small module script that calls `$store.set(...)` on the client. For framework-specific hooks inside an island, install the matching adapter (`@nanostores/react`, `@nanostores/preact`, `@nanostores/solid`, `@nanostores/vue`, or `@nanostores/lit`).

**Use for:** current Organization / Space / user session hydrated to the client; real-time backup status (driven by WebSocket from the Durable Object); notification/toast queue; UI state that survives client-side navigation.

**Rules:**

- Store files live in `src/stores/` — one file per logical store. Export the `atom`/`map`/`computed` from the file.
- Hydrate server state via the JSON-script pattern. Don't mix with ad-hoc `window` globals.
- In non-Astro islands, use the matching `@nanostores/<framework>` hook (e.g. `useStore($account)`). In vanilla `<script>` blocks, import the atom directly and use `.subscribe()` / `.get()` / `.set()`.
- Keep stores small and serializable. Derive composite values via `computed`.
- Never store secrets, auth tokens, or sensitive PII client-side. Server-only state stays server-only.
- Reset stores on logout. The logout handler must clear every user-scoped store.

## 4.2 Theme & Design System

**Priority order:**

- **Primary:** `@opensided/theme` — first choice for all styling.
- **Secondary:** `daisyUI` — for components not covered by `@opensided/theme`.
- **Fallback:** Custom CSS only when neither covers the requirement.
- Don't mix theme approaches within a single component.

**Rules:**

- Follow Astro component best practices: separate markup, styles, scripts.
- Single-responsibility components (DRY).
- Reuse from `src/components/ui/` before creating new ones.
- Use design tokens from `@opensided/theme` instead of hardcoded values.
- Cross-check UI work against PRD §6 (UX & design direction) and Features §1 (naming).

## 4.3 Mobile-First

- Design and build for mobile first.
- Test at <375px, <768px, <1024px before desktop.
- Touch targets minimum 44×44px (WCAG).
- Use `astro:media` for responsive optimizations.

## 4.4 TypeScript & Astro

- SSR by default. Minimize client JS (`client:idle` / `client:visible` only when needed).
- Define prop interfaces for all components that accept props.
- Strict null checks. Avoid `any` — use `unknown` with type guards.
- Shared interfaces in `src/lib/types.ts`.
- Import images through `import` statements for optimization.
- Astro's built-in CSS scoping; avoid global CSS unless necessary.

## 4.5 Loading States for Server Waits

Any client-side interaction that waits on the server **must** show a visible loading spinner. A disabled button alone is not sufficient.

- Every form submit, button click, or interaction triggering a network round-trip shows a spinner while in flight.
- Use `setButtonLoading` from `src/lib/ui.ts` as the canonical helper. It injects the daisyUI `loading loading-spinner loading-sm` span, toggles `disabled`, and sets `aria-busy`.
- Always clear the spinner in a `finally` block:
  ```ts
  setButtonLoading(submitBtn, true);
  try {
    const res = await fetch('/api/...');
    // …handle response…
  } finally {
    setButtonLoading(submitBtn, false);
  }
  ```
- For multi-second operations (Stripe provisioning), disable other interactive controls to prevent double-submission.
- For non-button waits (page loads, data refreshes), use a daisyUI `loading` component appropriate to context with the same `finally`-clears-state discipline.

## 4.6 Auth Integration

- Use `src/lib/auth-client.ts` for client-side auth helpers.
- Implement auth pages from the `src/pages/auth/` pattern.
- Follow existing layouts in `src/layouts/AuthLayout.astro`.
- Protect routes server-side via `src/middleware.ts`.
- Use session data from `src/lib/account.ts` for user context.

## 4.7 Accessibility

- Semantic HTML (`<button>`, `<nav>`, `<section>`, etc.).
- Alt text on all images.
- Color contrast WCAG AA minimum 4.5:1.
- Keyboard navigation tested for interactive components.
- ARIA labels only when semantic HTML is insufficient.

## 4.8 Frontend File Organization

```
src/
  components/
    ui/          Reusable styled components from @opensided/theme
    layout/      Page layout components
    docs/        Documentation-specific components
  pages/         Route pages (Astro)
  layouts/       Shared page layouts
  lib/           Utilities (ui.ts, auth-client.ts, types.ts)
  stores/        nanostores
  styles/        Global styles (minimal; prefer component-scoped)
```

---

# 5. Backend Standards (eventual `apps/server/`)

## 5.1 Cloudflare Workers Runtime

- **`cloudflare:workers` import is workerd-only.** Works in `wrangler dev` and deployed Workers, but not under `astro dev` or pure-Node tooling. Engine dev script is `npm run dev` → `astro build && wrangler dev`. Don't reintroduce `astro dev` without a plan for `cloudflare:workers`.
- **Per-request Postgres clients.** `createMasterDb()` MUST be called per-request — postgres-js holds TCP sockets and workerd forbids reusing I/O objects across requests. Wrap teardown with `ctx.waitUntil(sql.end({ timeout: 5 }))` on response.
- **Hyperdrive vs direct connection.** Middleware uses `env.HYPERDRIVE.connectionString` in deployed envs and `process.env.DATABASE_URL` in local `wrangler dev` (under `import.meta.env.DEV` branch — Vite tree-shakes the dead branch from the deployed bundle). Don't hardcode connection strings.
- **Durable Object exports.** When DOs are wired into wrangler config, the worker entry must re-export `ConnectionDO` and `SpaceDO` alongside the Astro handler — the bare `@astrojs/cloudflare` adapter output does not.
- **R2 streaming for backup output.** Use the streaming patterns in PRD §7.2 — never buffer a whole base in memory.

## 5.2 Backend Surface Contract

- Public: `/api/health` (liveness probe).
- Internal: `/api/internal/*` gated by `x-internal-token` header. Frontend reaches these via the `BACKUP_ENGINE` Cloudflare Worker service binding (declared in `apps/web/wrangler.jsonc.example`), not over public HTTP. The token gate stays as defense-in-depth alongside the binding's network-level isolation.
- No other public surface. No customer auth. No UI.

## 5.3 Backend File Organization

```
src/
  middleware.ts           INTERNAL_TOKEN gate + per-request masterDb on context.locals
  env.d.ts                App.Locals = { masterDb }; ProvidedEnv from worker-configuration.d.ts
  db/
    worker.ts             createMasterDb() — per-request postgres-js + drizzle
    node.ts               masterDb singleton — for scripts/* only
    schema/
      index.ts            barrel
      backup-runs.ts      MIRROR of frontend (header comment names canonical migration)
      backup-configuration-bases.ts  MIRROR of frontend (same rule)
  durable-objects/
    ConnectionDO.ts       per-Connection rate-limit gateway
    SpaceDO.ts            per-Space scheduler
  lib/
    trigger-client.ts     Helpers for enqueuing Trigger.dev tasks (type-only `import type` from @baseout/workflows)
  pages/
    api/
      health.ts           Public liveness probe
      internal/           INTERNAL_TOKEN-gated routes
drizzle/                  Engine-owned migrations (none yet — backup_runs migration lives in frontend)
scripts/
  launch.mjs              Renders wrangler.jsonc + .dev.vars from .env, then runs astro
  migrate.mjs             Wrapper for drizzle-kit migrate against master DB
```

There is intentionally no `src/components/`, `src/layouts/`, `src/pages/login.astro`, `src/pages/ops/`, `src/pages/api/auth/`, `src/lib/auth-factory.ts`, `src/lib/authz.ts`, `src/lib/email/`, `src/lib/ui.ts`, `src/styles/`, or `vendor/@opensided/` in the backend. All of that is frontend. Trigger.dev task **bodies** live in `apps/workflows/` — never reintroduce a `trigger/` directory or `trigger.config.ts` here.

---

# 6. Workflows Standards (`apps/workflows/`)

Trigger.dev v3 task project. Runs on the Trigger.dev cloud's **Node** runner — NOT inside workerd. The Backend Worker enqueues via `@trigger.dev/sdk`.

- **Runtime: Node only.** Never import `cloudflare:workers`. `process.env` is the source of truth for runtime config (`BACKUP_ENGINE_URL`, `INTERNAL_TOKEN`, `AIRTABLE_*`, BYOS provider keys), populated from the Trigger.dev env-vars UI per environment.
- **Pure orchestration is separated from the task wrapper.** Each task has a pure-async-function module (`backup-base.ts`) that takes injected deps, and a thin wrapper (`backup-base.task.ts`) that adapts the JSON payload, reads env vars, and calls the pure function. Tests target the pure module.
- **Type-only exports.** `trigger/tasks/index.ts` re-exports task references as `export type` so the Backend Worker can `tasks.trigger<typeof X>(...)` without bundling the task body.
- **Engine callback contract.** Tasks POST per-table progress and a final completion to `/api/internal/runs/:runId/{progress,complete}`. Transport errors are fire-and-forget — the run-row state machine + DO lock alarm are the safety nets.
- **Test runner.** Plain Vitest with `environment: "node"` — no `@cloudflare/vitest-pool-workers`. External APIs (Airtable, R2/BYOS, engine HTTP) mocked at the boundary.
- **File layout.**

```
trigger/
  tasks/
    index.ts              Type-only re-exports for Worker consumers
    _ping.ts              Smoke task
    backup-base.task.ts   Trigger.dev wrapper
    backup-base.ts        Pure orchestration (testable)
    _lib/                 Pure helpers — airtable client, csv stream, field normalizer, fs writer, path layout
trigger.config.ts         Trigger.dev project config (maxDuration: 600 default; per-task overrides allowed)
tests/                    Vitest (Node) — one file per pure module + task wrapper
```

There is intentionally no `src/`, no UI, no DB layer here — the workflows app holds task code, helpers, and tests only.

---

# 7. Development Checklist

Before requesting review:

- [ ] Change reconciled against the relevant PRD/Features section
- [ ] Naming uses the canonical dictionary (Features §1)
- [ ] Server-side validation on every mutating route
- [ ] Auth enforcement via middleware (frontend) or `INTERNAL_TOKEN` gate (backend) — no ad-hoc checks
- [ ] Tests written first for non-trivial logic; CI green
- [ ] No stray `console.*` or `debugger` in the diff (§3.5)
- [ ] `npm run typecheck` passes
- [ ] `npm run build` completes without errors
- [ ] Mobile responsiveness tested at three breakpoints (frontend UI work)
- [ ] Loading state via `setButtonLoading` for any server-waiting interaction (frontend)
- [ ] No hardcoded values; uses theme tokens (frontend UI work)
- [ ] If touching mirrored DB schema, the canonical migration in the frontend is updated to match
- [ ] If touching auth, secrets, or external integrations — security review points called out
- [ ] If touching a Trigger.dev task body, change lives in `apps/workflows/`. If touching the enqueue path, change lives in `apps/server/`. Cross-app contract (payload shape, callback shape) updated on both sides if it shifts.

---

# 8. Asking, Confirming, Committing

- Don't commit, push, or open a PR without explicit user approval. Approving a plan does not authorize individual git actions.
- Create new commits rather than amending — when a pre-commit hook fails, the commit didn't happen, so `--amend` would modify the previous commit.
- Stage specific files by name; avoid `git add -A` / `git add .` so secrets and large binaries don't slip in.
- For risky or hard-to-reverse actions (force-push, reset --hard, dropping tables, sending external messages, modifying CI/CD), confirm before acting.
