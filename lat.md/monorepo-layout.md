# Monorepo Layout

`pnpm@9.12.0` workspaces. Two conceptual halves over one shared Postgres: **frontend** (`apps/web`) and **backend / backup engine** (`apps/server`). Other apps are smaller surfaces around the same data plane. Long form lives in [CLAUDE.md](../CLAUDE.md) §2.

## Workspaces

The directory map. Each `apps/*` is independently versioned and deployed; `packages/*` are consumed at pinned versions across the apps.

```
apps/
  web/      Customer Astro SSR app + /api/* — auth, OAuth Connect, dashboard, settings, /ops console
  server/   Backup/restore engine. Headless Worker. Durable Objects + Trigger.dev. Only /api/health + /api/internal/*.
  admin/    Internal admin Astro SSR app, Google SSO. Cloudflare Workers.
  api/      Public versioned inbound API at api.baseout.com.
  sql/      Public read-only SQL API at sql.baseout.com (Pro+).
  hooks/    Airtable webhook receiver at webhooks.baseout.com.

packages/
  db-schema/  @baseout/db-schema — Drizzle schema + migrations. Consumed by all apps at a pinned version.
  shared/     @baseout/shared    — AES-256-GCM encryption, HMAC service tokens, error types, Zod helpers, logging.
  ui/         @baseout/ui        — shared Astro/React UI primitives.

openspec/   Change proposals (opsx:propose|apply|archive). Specs (current state) live in openspec/specs/.
lat.md/     Knowledge graph (this directory). Hybrid layout: root + per-app graphs.
shared/     Canonical product specs (PRD, Features, Implementation Plan, Backlog). Markdown only.
brand/      Brand assets and guidelines.
scripts/    Repo automation, including the postinstall fix-symlinks.js that mirrors openspec/ + packages/* into each app dir.
```

## Naming Conventions

Names are short and predictable. The same word identifies the directory, the package, and the worker — no synonyms.

- App directory: short single word (`web`, `server`, `admin`, `api`, `sql`, `hooks`).
- Package name: `@baseout/<dir>`.
- Worker name (wrangler): `baseout-<dir>`.

All backend apps run on Cloudflare Workers. Tooling needs Node ≥20 (lat.md itself requires Node ≥22 — see [[monorepo-layout#Monorepo Layout#Toolchain]]).

## Frontend / Backend Split

Per [CLAUDE.md](../CLAUDE.md) §2, Baseout is conceptually two Workers + one shared Postgres. Each owns a strict slice of the responsibility surface; cross-contamination is treated as a design error.

- **Frontend (`apps/web`)** owns: customer auth (better-auth, magic-link), OAuth Connect, settings, `/ops` console, **master-DB schema** ownership.
- **Backend (`apps/server`)** owns: backup/restore execution, Durable Objects (per-Connection rate-limit gateway, per-Space scheduler), Trigger.dev tasks, R2/BYOS streaming.

The backend has **no** UI, **no** `/login`, **no** `/api/auth/*`, **no** better-auth, **no** per-engine user identity. It sees only `INTERNAL_TOKEN` from the frontend.

Mirrored DB tables in `apps/server` carry header comments naming the canonical migration source in the frontend. Anchor: [apps/server lat graph](../apps/server/lat.md/) `db-mirror.md`.

If you find yourself adding a UI, an `/ops` page, or `better-auth` to `apps/server` — **stop**, you're proposing the wrong split.

## Toolchain

Pinned versions and their rationale. Newer is fine for non-Workers tooling (e.g. Node 24 locally) but the lower bound is load-bearing for `lat.md`.

| Tool | Version |
|---|---|
| Node | ≥20 for Workers tooling; **≥22 for lat.md** |
| pnpm | 9.12.0 (pinned in [package.json](../package.json)) |
| TypeScript | strict, ESNext, verbatimModuleSyntax |
| Astro | SSR adapter for Cloudflare |
| Wrangler | per-app `wrangler.jsonc` |

## Symlink Mirroring

`scripts/fix-symlinks.js` (postinstall) mirrors `openspec/` and `packages/*` into each `apps/<name>/` so per-app tooling sees them. This is invisible to most workflows but matters for `lat check`.

- `lat check` follows symlinks and emits non-fatal `EISDIR` warnings on these. To be excluded once lat config supports it (see [[engineering-principles#Engineering Principles#Knowledge graph discipline]]).
- Do not commit changes that bypass the mirror — anything in `apps/<name>/openspec/` is a symlink, not source of truth.

## Where to Look

Pointers to the underlying specs and config. This section summarises; those files remain authoritative.

- Workspace declaration: [pnpm-workspace.yaml](../pnpm-workspace.yaml)
- Full layout text: [CLAUDE.md](../CLAUDE.md) §2
- OpenSpec context (canonical workspace summary for AI): [openspec/config.yaml](../openspec/config.yaml)
- Implementation phasing across these apps: [shared/Baseout_Implementation_Plan.md](../shared/Baseout_Implementation_Plan.md)
