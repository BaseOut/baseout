# admin-support-search — design

## Context

`apps/admin` is a read-mostly Astro SSR staff console (Cloudflare Workers, Hyperdrive → master PG, Drizzle over a partial schema mirror). Every surface is a `.astro` page backed by a pure lib module in `src/lib/` with Vitest coverage (`tracker.ts`, `org-detail.ts`, `run-detail.ts`, …). Chrome is `SidebarLayout.astro`, a self-contained copy of web's sidebar shell. Staff gating is middleware-wide; the schema mirror never contains `*_enc` columns.

Support workflows start from one identifier (email, org name, `appXXX` base ID, run UUID, `cus_…`). Nothing today maps identifier → entity page.

## Goals / Non-Goals

**Goals:**
- One search box, always visible, that turns any staff-held identifier into the right entity page in ≤2 clicks.
- Pure, unit-testable detection + lookup planning; thin page glue.
- Zero infrastructure: exact/ILIKE SQL only, bounded result counts.

**Non-Goals:**
- Fuzzy/typo-tolerant search, relevance ranking, pg_trgm/tsvector indexes (future option, deliberately deferred).
- Searching per-Space databases or any customer content (names/IDs in the master DB only).
- New detail pages — link targets come from existing pages plus sibling change `admin-entity-linking`.

## Decisions

### D1: Shape detection as a pure function, lookups as a plan

`src/lib/search.ts` exports `detectQuery(q: string): QueryPlan` — a pure function returning `{ kind, normalized, lookups: EntityLookup[] }` — and `runSearch(db, plan, limit)` executing the plan. Detection is testable without a DB; execution is thin Drizzle.

Detection precedence (first match wins):

| Shape test (on trimmed input) | kind | Lookups |
|---|---|---|
| UUID regex (`8-4-4-4-12` hex, case-insensitive) | `uuid` | PK equality on `backup_runs`, `restore_runs`, `connections`, `spaces`, `organizations` |
| `^cus_[A-Za-z0-9]+$` | `stripe-customer` | `organizations.stripe_customer_id =` |
| `^sub_[A-Za-z0-9]+$` | `stripe-subscription` | `subscriptions.stripe_subscription_id =` |
| `^app[A-Za-z0-9]{10,}$` | `at-base` | `at_bases.at_base_id =` |
| contains `@` | `email` | `lower(users.email) =` then `lower(users.email) LIKE lower(q) || '%'` |
| otherwise (≥2 chars) | `text` | ILIKE `%q%` on `organizations.name/slug`, `spaces.name`, `users.name` |

Rationale: precedence-ordered shape tests keep every lookup exact-indexed except the deliberate ILIKE fallback; running only shape-relevant lookups keeps worst case at 5 cheap PK probes. Alternative considered — always query everything with `OR` — rejected: unindexable, noisy results.

ILIKE special characters in user input (`%`, `_`, `\`) are escaped before interpolation into the pattern.

### D2: Exact-match redirect, list otherwise

`runSearch` returns `{ redirect?: string, groups: ResultGroup[] }`. When `kind` is exact (`uuid`, `stripe-*`, `at-base`, exact-email) and total matches === 1, the page issues `Astro.redirect(target, 302)`. Free-text never redirects (spec requirement). Rationale: pasting a run UUID is the hottest path — landing directly on `/backups/[id]` beats a one-row list. Multi-match UUIDs (collision across tables) fall through to the list.

### D3: Link targets with graceful fallback

| Entity | Target | Fallback until `admin-entity-linking` lands |
|---|---|---|
| Organization | `/organizations/[id]` | — (exists) |
| Backup run | `/backups/[id]` | — (exists) |
| Restore run | `/restores` (list; no detail page) | — |
| Space | `/spaces/[id]` | `/organizations/[orgId]` (owning org detail) |
| User | `/users/[id]` | `/organizations/[orgId]` of first membership; membership-less user renders unlinked |
| Base | owning Space's target | same fallback chain |
| Connection | `/connections` (list) | — |

Encoded as a small `linkFor(entity)` helper with a build-time constant flag flipped when the sibling change lands (single-line diff). Soft dependency only — no import coupling.

### D4: Search box lives in the sidebar, plain GET form

A `<form action="/search" method="get">` with one input, placed under the brand block in `SidebarLayout.astro` (hidden in rail-collapsed mode like the other labels; on mobile it appears in the off-canvas sidebar). GET = idempotent read, no CSRF surface, URL shareable between staff. Alternative — a topbar with ⌘K palette — rejected for V1: requires client JS + an endpoint returning JSON; the GET page delivers the same capability with zero islands.

### D5: Mirror addition: `at_bases`

Add to `apps/admin/src/db/schema/core.ts` (partial, no FKs, header comment citing the canonical apps/web migration): `id`, `space_id`, `at_base_id`, `name`. `users` already re-exports from `@baseout/db-schema` (email, name, role — all we need). No other mirror changes.

### D6: Context enrichment in one round trip per group

Each result group's disambiguating context (org tier/status for orgs; memberships for users; owning org for spaces/bases/runs) is fetched with a join in the same query, not N+1 follow-ups. Per-group `LIMIT 10`; `LIMIT 11` fetched to detect truncation.

## Risks / Trade-offs

- [ILIKE `%q%` on names is a seq scan] → tables are small at current scale (hundreds of orgs); per-group LIMIT bounds cost; pg_trgm is the named future fix if this ever slows.
- [UUID probe across 5 tables costs 5 queries] → all PK lookups; executed concurrently via `Promise.all`; acceptable.
- [Sibling-change link targets may not exist yet] → `linkFor` fallbacks (D3) keep every rendered link valid at all times.
- [Email prefix match could enumerate users] → surface is already staff-gated and read-only; no new exposure beyond existing org-detail member lists.

## Testing

Vitest on the pure module (house pattern): `detectQuery` shape table (every row above + whitespace, case, ILIKE-escape cases), redirect decision (exact single / exact multi / text single), `linkFor` fallback matrix, truncation flag. Page smoke stays manual per existing convention (no Playwright in admin).

## Open Questions

- None blocking. ⌘K palette + JSON endpoint is the natural phase-2 if staff ask for it.
