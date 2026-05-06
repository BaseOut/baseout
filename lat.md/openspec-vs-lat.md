# OpenSpec vs lat.md

The two systems are complementary, not redundant. **OpenSpec captures deltas; lat.md captures current state.** This file is the rule of thumb when an agent or contributor is unsure where a piece of knowledge belongs.

## Rule of Thumb

If the answer to "is this changing?" is **yes** — OpenSpec. If "is this how it currently works?" — lat.md.

| Question | Goes in |
|---|---|
| What are we proposing to change about backup retention? | `openspec/changes/<name>/proposal.md` |
| Why does retention currently top out at 24 months? | `lat.md/pricing-tiers.md` (or wherever the rule lives) |
| What's the new schema column for credit overage? | `openspec/changes/<name>/specs/...` |
| What's the convention for encrypted columns? | `lat.md/db-schema-overview.md` and `lat.md/security-model.md` |
| What's the migration order for the auth refactor? | `openspec/changes/<name>/tasks.md` |
| Where does customer auth currently live? | `apps/web/lat.md/auth.md` |

## Lifecycle

A change starts as an OpenSpec proposal, gets approved and applied, then ships.

**Once it ships**, the lat.md graph is updated to reflect the new "current state" — the OpenSpec change moves into `openspec/specs/` (archive) and the persistent knowledge lives in lat.md going forward.

```
idea → openspec/changes/<name>/  →  apply tasks  →  ship  →  lat.md updated
                                                              ↓
                                                openspec/specs/<archived>
```

The lat.md graph is **not** the place to write "we're going to do X next month." That belongs in OpenSpec or in a plan under `plans/`.

## Hybrid Layout

The repo runs **one root graph + six per-app graphs**. Each is a separate `lat.md/` directory that `lat check` validates independently.

- `lat.md/` — cross-cutting: domain model, naming, monorepo layout, security, tech stack, cross-app comms, pricing, schema overview, engineering principles.
- `apps/web/lat.md/` — frontend internals: routes, auth flow, state management, theme, loading states.
- `apps/server/lat.md/` — backend internals: surface contract, Durable Objects, Trigger.dev tasks, db mirror, R2 streaming.
- `apps/admin/lat.md/`, `apps/api/lat.md/`, `apps/sql/lat.md/`, `apps/hooks/lat.md/` — each app's internal graph.

## Cross-Graph Linking Convention

`lat check` validates one graph at a time. Section-to-section wiki links (`[[file#heading]]`) only resolve within the same graph. Code refs (`[[src/file.ts#symbol]]`) work to any source file in the repo because they reference paths that lat reads.

The convention this repo follows:

- **Within a graph** — use wiki refs freely. `[[domain-model#Domain Model#Space]]` from any other root file.
- **Across graphs** — use plain markdown links, not wiki refs. From a root file: `[apps/server lat graph](../apps/server/lat.md/)`. From an app file to root: `[../lat.md/security-model.md](../../../lat.md/security-model.md)` (path depth depends on the file).
- **To source code** — wiki ref with file extension. `[[apps/web/src/middleware.ts#authGuard]]`. lat parses the file and resolves the symbol.
- **From source to lat sections** — `// @lat: [[section-id]]` at the top of the function or file. lat's `lat refs` then surfaces the back-reference.

Don't try `[[../apps/server/lat.md/...]]` — `lat check` fails on the unknown extension.

## When in Doubt

A simple test for where a piece of information belongs.

- If it's a **rule** that should be enforced going forward → lat.md.
- If it's a **change** to that rule → OpenSpec.
- If it's a **plan** for a multi-step task → `plans/<topic>.md`.
- If it's an in-conversation note → keep it in conversation; don't pollute either system.

## Where to Look

Pointers to authoritative sources for this rule.

- OpenSpec config and skills: [openspec/config.yaml](../openspec/config.yaml); skills `opsx:propose`, `opsx:apply`, `opsx:archive`
- Engineering rules around this split: [[engineering-principles]]
- Long-form: [CLAUDE.md](../CLAUDE.md) §3.6 (OpenSpec) — and §3.7 (this rule of thumb) once added
