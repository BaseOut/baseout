---
name: baseout-engineering-standards
description: "Baseout engineering + UI/UX standards — Applies project-wide. Source-of-truth specs live in docs/ (PRD, Features, Implementation Plan). Enforces senior-engineer mindset, security-first, test-driven development, nanostores for Astro state, and the existing UI/UX rules below."
---

# Engineering Principles (Apply Before Anything Else)

## 0. Source of Truth: Product Specs

Before generating any code, always reconcile the work against these three canonical documents in [docs/](../docs/):

- [docs/Baseout_PRD.md](../docs/Baseout_PRD.md) — Product requirements, scope, MoSCoW, V1 vs V2, open questions
- [docs/Baseout_Features.md](../docs/Baseout_Features.md) — Pricing tiers, capability matrix, naming conventions, quotas, Stripe architecture
- [docs/Baseout_Implementation_Plan.md](../docs/Baseout_Implementation_Plan.md) — Phased build order, repo map, parallel work streams

**Rules:**
- Every feature, field, table name, tier limit, capability gate, and API surface **must** match these specs. If the user asks for something that conflicts, flag the conflict and cite the spec section.
- Use the canonical naming dictionary from `Baseout_Features.md` §1 (Organization, Space, Platform, Connection, Base, etc.) in all code and copy. Never invent synonyms.
- Gate capabilities and quotas from Stripe product metadata (`platform` + `tier`) per `Baseout_Features.md` §5.5 — never from product name strings.
- V2-only capabilities (MCP server, RAG, Governance, third-party connectors, multi-platform Spaces) are **out of scope** unless the user explicitly asks to prototype them.

## 0.5. Repo Split: This Repo Is the Frontend

Baseout is a **multi-repo product**, not a single Astro app. Per [docs/Baseout_Implementation_Plan.md](../docs/Baseout_Implementation_Plan.md) §Repo Map, the product spans five repos. The two that matter for almost every change:

- **This repo** (`baseout-web` / `baseout-starter`) — **the frontend application.** User-facing Astro SSR app, auth + magic-link, OAuth Connect flows (the browser redirect dance and token exchange), the integrations dashboard, settings, marketing pages, middleware, and the API routes that serve those views.
- **`baseout-backup-engine`** — **the backend/server.** Backup and restore engine, Durable Objects per Space, scheduled cron work, R2 storage destinations, schema discovery, attachment download pipeline, SQL REST API, Trigger.dev jobs.

(The other three — `baseout-background-services`, `baseout-admin`, `baseout-ui` — exist per the Repo Map; consult it directly when work touches them.)

**Rules:**
- **Belongs in this repo (frontend):** UI components, pages, layouts, auth flows, OAuth Connect (browser flow + token exchange + persisting connections), integrations dashboard, settings, middleware, API routes that serve UI, nanostores hydration.
- **Belongs in `baseout-backup-engine` (backend), NOT here:** backup/restore logic, R2 bindings + writes, Durable Objects, Trigger.dev jobs, scheduled cron workers, schema discovery against Airtable/external APIs, attachment storage, SQL REST API, capability resolver when used for backup gating.
- **Before adding any new `wrangler.jsonc` binding, cron trigger, Durable Object class, or worker-level infra**, verify per the Implementation Plan which repo owns it. Don't add bindings to this repo's `wrangler.jsonc` as a "for now" workaround.
- **If `baseout-backup-engine` doesn't yet exist in the workspace and the work belongs there, defer rather than misattribute.** Flag the dependency to the user instead of putting backend logic in the frontend repo.
- **When citing a roadmap item or planning future work, name the target repo explicitly** (e.g., "B3 belongs in `baseout-backup-engine`"). Don't say "we" or "this codebase" ambiguously when the item lives elsewhere.

**Backend conventions live in the engine's CLAUDE.md.** Trigger.dev v3 task structure, Durable Object lifecycle/state patterns, R2 streaming for backup output, the `INTERNAL_TOKEN`-gated `/api/internal/*` wire protocol, and Worker-runtime constraints (`cloudflare:workers`, per-request Postgres) are canonical in [`../baseout-backup-engine/.claude/CLAUDE.md`](../../baseout-backup-engine/.claude/CLAUDE.md). When this file and the engine's appear to disagree on a backend concern, the engine wins. The engine has no UI; nothing about UI components, themes, customer auth, or `/ops` page UI belongs there — those live here.

## 1. Senior Software Engineer Mindset

Code and communicate like a senior engineer on this team:
- Understand the business context before writing code. Read the relevant PRD/Features section first.
- Prefer small, reversible, well-tested changes over clever sweeping ones.
- Name things precisely. Use the canonical dictionary.
- Explain trade-offs and surface alternatives when a decision is non-obvious. Don't silently pick.
- Flag missing requirements rather than inventing behavior. Open Questions in the PRD are explicit — use them.
- Code for the next engineer. Readability > cleverness.

## 1.5. Don't Refactor What Works (Scope Discipline)

**Working code stays as-is unless the task requires changing it.** If existing code already does its job and isn't part of the current ask, leave it alone.

- **No drive-by refactors.** Don't rename, reshape, extract, inline, or "tidy up" code that wasn't broken and isn't in scope for the task.
- **No "while I'm here" cleanups.** If you spot something you'd improve, flag it as a follow-up — file it in a TODO or mention it in the PR description. Do not land it in this change.
- **No pre-emptive abstraction.** Don't extract helpers, hoist types, or introduce new modules for hypothetical future use. YAGNI. Wait until a second real call site exists.
- **Match the blast radius of the fix to the size of the problem.** A 5-line bug fix does not need a 50-line restructure. A config change does not need a module split.
- **Preserve working config and scripts.** Don't "improve" npm scripts, Vite config, wrangler.jsonc, launch.mjs, or similar infrastructure unless the task explicitly requires it. Infrastructure churn breaks developer workflows in surprising ways.
- **Before editing a file, ask: is this edit load-bearing for the task?** If no, don't make it. If yes, make the minimum edit that solves the task.

**Why:** Unrequested changes create review burden, introduce regression surface, and waste the user's time re-verifying behavior that already worked. The user has repeatedly flagged this as a failure mode — treat it as a hard rule.

## 2. Security First (Non-Negotiable)

Security is a gate on every change, not an afterthought. Apply these by default:

- **Secrets:** Never hardcode. All secrets via Cloudflare Secrets or `.env` (never committed). See PRD §20.
- **Encryption at rest:** OAuth tokens, refresh tokens, and API keys encrypted with AES-256-GCM in the master DB (PRD §20.2). Never store plaintext tokens.
- **Passwords:** Baseout is passwordless (magic-link via `better-auth`). Do not add password inputs, password hashing code, or "forgot password" flows to any surface. If a requirement implies passwords, surface it as a scope conflict before implementing.
- **API tokens:** Store hashes, not plaintext. See `api_tokens.token_hash` in PRD §21.3.
- **Input validation:** Server-side validation on every API route and form handler. Client validation is UX, not security.
- **Auth enforcement:** Route protection lives in [src/middleware.ts](../src/middleware.ts). Every protected page and API route must pass through it. No ad-hoc checks.
- **CSRF:** Use `better-auth` CSRF helpers on mutating forms. No raw POST handlers without a token.
- **SQL:** Parameterized queries via Drizzle only. Never string-concatenate SQL.
- **Direct SQL API (Business+):** Read-only by default (PRD §10 / Features §14.2). Write access is an explicit opt-in.
- **Output:** Rely on Astro auto-escaping. Never use `set:html` on user-supplied data.
- **Principle of least privilege:** OAuth scopes, DB roles, and API tokens scoped to the narrowest viable set.
- **Audit:** Every auth and billing state change writes a record to the appropriate log table.

If a change introduces a new secret, a new auth path, a new SQL surface, or a new external integration, explicitly call out the security review points before requesting approval.

## 3. Test-Driven Development

Follow the red-green-refactor loop for all non-trivial code. Use [Vitest](https://vitest.dev) (per PRD §14).

**The loop:**
1. **Red** — Write a failing test that expresses the desired behavior.
2. **Green** — Write the minimum code to make it pass.
3. **Refactor** — Improve the implementation with tests green.

**Coverage targets (PRD §14.4):**
- Backend logic (API handlers, Workers, jobs, services): **80% unit**
- UI components: **60% unit**
- Critical flows: covered by Playwright E2E

**Rules:**
- No implementation without a test first for: API route handlers, auth flows, billing/Stripe logic, backup/restore logic, capability resolution, trial enforcement, Drizzle queries with business logic.
- Integration tests hit a real local PostgreSQL (Docker) and real Miniflare D1 — not mocks. External APIs mocked at the HTTP boundary with [msw](https://mswjs.io).
- Every PR must include tests for the change. CI blocks merge on failing tests.
- Regression before fix: reproduce every bug with a failing test before patching.

## 4. State Management: `nanostores`

For all cross-component reactive state in the Astro app, use [`nanostores`](https://github.com/nanostores/nanostores). There is no official `@nanostores/astro` package — hydrate server state into the store via a `<script type="application/json">` tag and a small module script that calls `$store.set(...)` on the client. For framework-specific hooks inside an island, install the matching adapter (`@nanostores/react`, `@nanostores/preact`, `@nanostores/solid`, `@nanostores/vue`, or `@nanostores/lit`) as needed.

**Use nanostores for:**
- Current Organization, current Space, current user session hydrated to the client
- Real-time backup status (driven by WebSocket from the Durable Object)
- Notification/toast queue
- UI state that must survive client-side navigation (selected filters, sidebar collapsed, etc.)

**Rules:**
- Store files live in [src/stores/](../src/stores/) — one file per logical store. Export the `atom`/`map`/`computed` from the file.
- Hydrate server state via the JSON-script pattern (see [src/pages/index.astro](../src/pages/index.astro) + [src/stores/account.ts](../src/stores/account.ts) for the canonical example). Do not mix with ad-hoc `window` globals.
- In non-Astro islands (React/Vue/Solid/etc.), use the matching `@nanostores/<framework>` hook (e.g. `useStore($account)`). In vanilla `<script>` blocks, import the atom directly and use `.subscribe()` / `.get()` / `.set()`.
- Keep stores small and serializable. Derive composite values via `computed`.
- Never store secrets, auth tokens, or sensitive PII in a client-side store. Server-only state stays server-only.
- Reset stores on logout. The logout handler must clear every user-scoped store (see [src/components/layout/Sidebar.astro](../src/components/layout/Sidebar.astro)'s logout handler for the pattern).

## 5. Commit Hygiene: No Stray Console Logs

Debug output must not ship. Before any commit — especially anything destined for `origin/main` — strip debug logging.

**Rules:**
- **No `console.log`, `console.debug`, `console.info`, `console.warn`, `console.error`, `console.trace`, or `debugger` statements** may be committed. This applies to `.ts`, `.tsx`, `.js`, `.mjs`, `.cjs`, `.astro`, and `.svelte` files — both client and server code.
- **Allowed exceptions** (must be explicit and intentional):
  - Structured logging via the project's logger utility (not raw `console.*`).
  - Build/CLI scripts under `scripts/` or `bin/` where stdout is the product.
  - A `console.*` line annotated with `// eslint-disable-next-line no-console` **and** a short justification comment on the line above.
- **Before committing:** grep the staged diff for `console\.` and `debugger` and remove anything that isn't in the allowed list above.
- **Pushing to `origin/main`:** Never push to `main` without explicit user approval. If any `console.*` survived review, stop and surface each occurrence (file + line) to the user before the push — do not proceed until the user explicitly approves each one or asks you to remove it.
- **PRs:** CI lint (`no-console` ESLint rule) must be green. A failing `no-console` check blocks merge — do not disable the rule to get green.
- **Never** use `git commit --no-verify` to bypass the pre-commit hook that checks for console statements.

---

# UI/UX Frontend Development Standards

When building UI/UX components and pages in this Astro project, follow these standards to ensure consistency, security, performance, and maintainability.

## Design & Theming

### 1. Theme Stack (Priority Order)
- **Primary**: `@opensided/theme` — Use first for all styling needs
- **Secondary**: `daisyUI` — Use for components not covered by @opensided/theme
- **Fallback**: Custom CSS only when neither theme provides the required component
- Do not mix theme approaches within a single component

### 2. Component Structure
- Follow **Astro component best practices**: separate markup, styles, and scripts
- Keep components single-responsibility (DRY principle)
- Reuse existing UI components from `src/components/ui/` before creating new ones
- Use design tokens from @opensided/theme instead of hardcoded values

### 3. Mobile-First Approach
- Design and build for mobile devices first
- Use responsive classes and mobile breakpoints from daisyUI/theme
- Test component behavior on small screens (< 375px) before desktop
- Ensure touch targets are minimum 44x44px (WCAG guidelines)
- Use `astro:media` for responsive optimizations

## Code Quality

### 4. DRY Software Practices
- Extract repeated logic into reusable utility functions in `src/lib/ui.ts`
- Create shared component variants instead of duplicating markup
- Use Astro layouts for page structure duplication
- Implement component props for configuration rather than hardcoding values
- Consolidate styles in theme tokens; avoid duplicate style definitions

### 5. Astro Best Practices
- Use server-side rendering by default (no unnecessary island directives)
- Minimize client-side JavaScript with `client:idle` or `client:visible` when needed
- Leverage Astro's static generation for better performance
- Organize component props with clear TypeScript interfaces
- Use Astro's built-in CSS scoping (avoid global CSS unless necessary)
- Import images through `import` statements for optimization

### 6. TypeScript & Type Safety
- Define prop interfaces for all components that accept props
- Use strict null checks (`// @ts-check` or tsconfig strict mode)
- Create types in `src/lib/types.ts` for shared interfaces
- Avoid `any` type; use `unknown` with proper type guards if needed

## Security

### 7. Security Standards
- Sanitize user input before rendering (use Astro's auto-escaping)
- Validate form inputs server-side, never trust client validation alone
- Use HTTPS for all external resources
- Implement CSRF protection on forms (via existing `auth.ts` utilities)
- Store sensitive data only in server-side routes (`src/pages/api/`)
- Use `better-auth` for all authentication flows
- Never expose API keys or secrets in client-side code

## Authentication & Design

### 8. Better Auth Integration
- Use `src/lib/auth-client.ts` for client-side auth helpers
- Implement auth pages from `src/pages/auth/` pattern
- Follow existing auth layouts in `src/layouts/AuthLayout.astro`
- Protect routes server-side via middleware in `src/middleware.ts`
- Use session data from `src/lib/account.ts` for user context

### 9. Design Reference (Dribble)
- Reference Dribble designs in component planning documents
- Implement pixel-perfect layouts using @opensided/theme spacing system
- Maintain visual consistency with approved design system
- Document design decisions in component comments if deviating from theme defaults

## Performance & Accessibility

### 10. Performance Optimization
- Image optimization: use Astro's Image component with proper sizing
- Asset minification handled automatically by Astro build
- Lazy-load non-critical scripts and components
- Monitor bundle size; prioritize tree-shaking unused theme utilities

### 11. Accessibility (A11y)
- Use semantic HTML elements (`<button>`, `<nav>`, `<section>`, etc.)
- Include alt text for all images
- Maintain color contrast ratios (WCAG AA minimum 4.5:1)
- Test keyboard navigation for interactive components
- Use ARIA labels when semantic HTML is insufficient

### 12. Loading States for Server Waits

Any client-side interaction that waits on the server **must** show a visible loading spinner. A disabled button alone is not sufficient — users need clear feedback that something is happening.

- **Every form submit, button click, or interaction that triggers a network round-trip must show a spinner** while the request is in flight. This includes `fetch`, `better-auth` client calls, and any other async server calls.
- **Use `setButtonLoading` from [src/lib/ui.ts](../src/lib/ui.ts)** as the canonical helper for button-scoped spinners. It injects the daisyUI `loading loading-spinner loading-sm` span, toggles `disabled`, and sets `aria-busy`.
- **Always clear the spinner in a `finally` block** so unexpected throws (e.g. network drop) don't leave the UI stuck:
  ```ts
  setButtonLoading(submitBtn, true);
  try {
    const res = await fetch('/api/...');
    // …handle response…
  } finally {
    setButtonLoading(submitBtn, false);
  }
  ```
- **Set `aria-busy="true"`** on the waiting element for screen-reader users (handled automatically by `setButtonLoading`).
- For multi-second operations (e.g. Stripe provisioning), consider also disabling other interactive controls on the page to prevent double-submission.
- For waits that aren't button-scoped (page loads, data refreshes), use a daisyUI `loading` component appropriate to the context and follow the same `finally`-clears-state discipline.

## Workflow

### 13. Development Checklist
- [ ] Component follows @opensided/theme styling approach
- [ ] Mobile responsiveness tested (< 768px, < 1024px, > 1024px)
- [ ] Reused existing UI components or created new ones following DRY
- [ ] No hardcoded values; uses theme tokens and design system
- [ ] TypeScript types defined for component props
- [ ] Server-side security checks in place for sensitive operations
- [ ] Auth integration uses `better-auth` patterns
- [ ] Accessibility best practices followed (semantic HTML, alt text, ARIA)
- [ ] Every server-waiting interaction shows a spinner via `setButtonLoading` (see §12)
- [ ] No console errors or warnings
- [ ] No stray `console.*` or `debugger` statements in the diff (see §5 Commit Hygiene)
- [ ] Astro build completes without errors (`npm run build`)

### 14. File Organization
```
src/
  components/
    ui/          # Reusable styled components from @opensided/theme
    layout/      # Page layout components
    docs/        # Documentation-specific components
  pages/         # Route pages (astro.js)
  layouts/       # Shared page layouts
  lib/           # Utilities including ui.ts, auth-client.ts
  styles/        # Global styles (minimal; prefer component-scoped)
```

## Questions or Clarification?
- Check `@opensided/theme` documentation for available components and tokens
- Review `src/components/ui/` for existing component examples
- Consult `src/lib/auth-utils.ts` for auth-related utilities
- Refer to Astro docs: https://docs.astro.build
- Design reference: Check associated Dribble project
- Always cross-check UI work against [docs/Baseout_PRD.md](../docs/Baseout_PRD.md) §6 (UX & design direction) and [docs/Baseout_Features.md](../docs/Baseout_Features.md) §1 (naming conventions)
- Test strategy reference: [docs/Baseout_PRD.md](../docs/Baseout_PRD.md) §14
- State management: store files live in [src/stores/](../src/stores/) and use `@nanostores/astro`
