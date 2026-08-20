# Design — system-spec-handoff

## Context

Baseout's UI lives in two places: Oleg iterates designs in the `ui-only` fork; Autumn ships them in
`apps/web`. The pipeline already moves work fork → web (`ui-sync`) and patches edits back up for
surfaces the fork already has (`sync-reconcile`), over the `shared/internal/ui-sync.md` ledger. The
uncovered case is the rare inverse: **we build a UI/UX surface the fork has no counterpart for** (the
admin app; or we implement before the designer designs). The designer then needs to **design around
our implementation**, so he needs the **actual code** — handed to him as something he can apply into
his branch. We must not merge into `ui-only` directly.

This skill packages that surface as an OpenSpec implementation plan **bundled with the relevant UI
code**, staged for a human to upload.

## Where it sits (so it doesn't overlap the others)

| case | fork has the surface? | tool |
|---|---|---|
| pull/promote a fork design | yes (fork-origin) | `/ui-sync` |
| an edit to a surface the fork already has | yes | `/sync-reconcile` (patch up) |
| **a surface the fork LACKS** (admin app; implement-before-design) | **no** | **`/spec-handoff` (plan + code up)** |

The **fork-presence check** (step 1) is the guard that keeps these apart.

## The procedure (`/spec-handoff <surface>`)

1. **Confirm absence from the fork.** `git ls-tree -r ui-only/main -- <path>` + `ui-sync.md` §2/§4.
   Absent → proceed. Present-and-edited → `sync-reconcile`. Present-and-in-sync → nothing. Announce
   the verdict with the `ls-tree` evidence.
2. **Author the implementation plan, with the code.** Under the fork's `openspec/changes/<x>/` name
   (invert §2 `web-` prefix): `proposal.md` (what/why at design level), `specs/<x>/spec.md`
   (`SHALL` + `WHEN/THEN`), `tasks.md` (his-repo steps), **plus the relevant UI/UX source**
   (views/components/styles/layouts — the design-relevant code, not backend/db/auth), placed per §2
   where a mapping exists or bundled with a proposed location where it doesn't (admin). Cite
   `ui-sync.md §N` (§6).
3. **Stage for upload (never merge).** A `change/<x>` branch (v1 default) or a `patches/ui-only/**`
   patch that ADDS the plan + code into a `ui-only` checkout, inverting §2 import rewrites. STOP; a
   **human** uploads the handoff branch and notifies the designer. Never push/merge from the skill;
   never `git merge ui-only`.
4. **Record it.** A `ui-sync.md` §4/§7 handoff note; a §3 row once the human confirms the upload.

## What the designer receives — and who implements it

He receives an **OpenSpec implementation plan he runs himself**, and it **carries the relevant UI
code** plus **docs explaining the changes**. Three properties matter:

- **He implements it, on his timeline.** The plan is his to apply (his `opsx:apply`) when he is ready
  — we never implement it for him and never merge it. We only stage it for upload.
- **It applies from wherever his branch is.** The `tasks.md` is additive and self-contained — it
  assumes no prior state beyond his current branch (the surface isn't there yet, so nothing to "edit"
  — only add). This is what "handle the implementation from wherever his branch currently is" means.
- **It carries the code + docs.** He is **designing around an implementation that already exists**, so
  a behavioral spec alone is insufficient: he needs the actual views/components/styles to render,
  refine, and design against (the code ships with the plan — backend/db/auth wiring does not), plus a
  **`docs/` artifact explaining the changes** he can read **after he's successfully implemented** it.

## Reuse map

| Concern | Owner | This change |
| --- | --- | --- |
| Author an OpenSpec change | `opsx:propose` | the authoring step (2) |
| Stage a change **up** to the fork | `sync-reconcile` | staging discipline (3) |
| Fork-presence / drift check | `ui-sync.md` ledger + `git ls-tree ui-only/main` | the guard (1) |
| Ledger of record | `ui-sync.md` | read for the guard, updated in (4) |
| **Surface the fork lacks → plan + code, staged up** | — | **new: `spec-handoff`** |

## Security & guardrails

- No new secrets, auth, SQL, or external surface.
- **Staged only** — a human uploads a handoff branch; never `--force`; never a merge into his working
  branch; never `git merge ui-only` (unrelated history, §1); never a PR.
- Only the **design-relevant UI code** ships (views/components/styles/layouts) — not backend, db, or
  auth wiring.
- Never hand-edit a synced file beyond the §2 import-rewrite inversion.

## Scope & non-goals (v1)

- **In:** on-demand, one absent surface at a time; author-and-stage only (plan + code).
- **Out:** the inbound direction (auto-planning incoming fork changes); any status reporter; a
  `STATUS.md` state machine; autonomous push/merge; batching / parallel fan-out; GitHub PR automation.

## Open questions

1. **Where a brand-new surface's code lands in the fork.** `apps/admin` has no §2 mapping. v1 has the
   skill propose a fork location in the handoff for the designer to confirm; codify it as a §2 row
   after the first admin handoff.
2. **Branch vs. patch** for the upload. v1 defaults to a `change/<x>` branch (carries code + plan
   cleanly); the `patches/ui-only/**` patch is the fallback. Confirm after the first dry-run.
3. **How much code is "design-relevant."** The line between UI to include and wiring to omit is a
   judgment call; the first admin handoff sets the precedent, recorded in §7.
