## Why

The **Aug 17, 2026 Dan/Autumn sync** and the follow-up Slack set the scope. The normal flow is
fork → web: Oleg designs in the [`ui-only`](https://github.com/BaseOut/ui-only) fork, we implement in
`apps/web` ([`ui-sync`](../../../.claude/skills/ui-sync/)). **Occasionally it flips** — we develop a
feature/change whose **UI/UX does not exist in the `ui-only` branch at all**, and the designer needs
it so he can **design around what we built**. This is rare, but real:

- a whole surface he has never had — e.g. the **admin app** (`apps/admin`), which is not in the fork;
- cases where we **implement before he has designed** the surface.

We **must not merge into `ui-only` directly**. Instead — per Dan's instruction — we create an
**OpenSpec implementation plan** that **includes the relevant UI code**, upload it to a `ui-only`
branch, tell the designer, and he **applies it into his branch** and designs around it. The existing
skills don't cover this: `ui-sync` is fork → web, and
[`sync-reconcile`](../../../.claude/skills/sync-reconcile/) patches surfaces the fork **already has**.
Nothing hands off a surface the fork **lacks** — with the code the designer needs. This change adds
one skill for exactly that.

## What Changes

- **`spec-handoff` skill** — `.claude/skills/spec-handoff/`. Given a surface we built (e.g.
  `apps/admin`), it:
  1. **Confirms the surface is absent from the fork** — `git ls-tree -r ui-only/main -- <path>` +
     `ui-sync.md` §2/§4. If the fork already has it, it **stops**: an edit → `sync-reconcile`; an
     import → `ui-sync`. Only genuinely-absent surfaces flow here.
  2. **Authors a self-contained OpenSpec implementation plan the designer runs himself** under the
     fork's naming (invert the §2 `web-` prefix) — `proposal + specs + tasks`, additive so it applies
     **from wherever his branch currently is** — **including the relevant UI/UX code** (the actual
     views/components/styles/layouts he implements + designs around) **and a `docs/` artifact
     explaining the changes** for him to view **after successful implementation**.
  3. **Stages it for upload** — a `change/<x>` branch (or `patches/ui-only/**` patch) that ADDS the
     plan + code + docs into a `ui-only` checkout — then **stops for a human to upload** (a handoff
     branch, never a merge). **The designer implements it, when he is ready — we never implement it
     for him.** Updates the ledger §4/§7.
- **Docs** — a "Handoff" section in `shared/internal/ui-sync.md` §7 + pointers in CLAUDE.md §3.7 and
  `openspec/AGENTS.md`.

**Out of scope** (dropped from earlier drafts): the inbound auto-plan skill, the relay-status
reporter, any `STATUS.md` state machine, and the "spec + pointers only" framing (**the code ships
with the plan**). One skill, one direction.

## Capabilities

### New Capabilities

- `spec-handoff`: package a UI/UX surface the fork lacks as an OpenSpec implementation plan **that
  includes the relevant UI code**, staged for a human to upload to a `ui-only` branch so the designer
  can apply it and design around it.

### Modified Capabilities

<!-- Reuses opsx:propose, sync-reconcile's staging, and the ui-sync ledger as-is; changes no existing
     skill's behavior. -->

## Impact

- **Tooling only (`system-*`, §3.6)** — `.claude/skills/spec-handoff/` + doc pointers
  (`shared/internal/ui-sync.md`, CLAUDE.md §3.7, `openspec/AGENTS.md`). No `apps/*` or `packages/*`
  runtime code.
- **Reuses** — `opsx:propose` (author the plan), `sync-reconcile` (staging discipline: stage **up**,
  invert §2 rewrites, human uploads), the `ui-sync.md` ledger (fork-presence check + §4/§7 note).
- **Security** — no new secrets, auth path, SQL surface, or external integration. Staged-only: a human
  uploads a handoff branch (never `--force`, never a merge to his working branch); **never**
  `git merge ui-only` (unrelated history — §1); never a PR.
- **Tests** — the skill produces docs + code files staged for the fork, so there is no runtime unit to
  test; it is validated by a **dry-run** against a real absent surface (the admin app) that yields an
  applyable branch/patch and touches neither our app code nor `ui-only`.
- **Scope boundary (v1)** — on-demand, one surface at a time; **rare by design**; author-and-stage
  only; no auto-push, no inbound direction, no reporter.

## Open questions

1. **Where a brand-new surface's code lands in the fork.** `apps/admin` has no `ui-sync.md` §2
   mapping — the handoff must propose a fork location for the designer to confirm. Establish it with
   the first real admin handoff.
2. **Branch vs. patch** for staging the upload. v1 defaults to a `change/<x>` branch (carries code +
   plan cleanly); revisit after the first dry-run.
