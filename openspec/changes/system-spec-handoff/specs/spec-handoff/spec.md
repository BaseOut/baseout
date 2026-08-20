# spec-handoff

Package a UI/UX surface the `ui-only` fork **lacks** (the admin app; or a surface we implemented
before the designer designed it) as an OpenSpec implementation plan **that includes the relevant UI
code**, staged for a human to upload to a `ui-only` branch so the designer can apply it and design
around it. Tooling only; composes `opsx:propose` + `sync-reconcile`'s staging over the
`shared/internal/ui-sync.md` ledger. One skill, one direction; we never merge into `ui-only`, and the
skill never pushes.

## ADDED Requirements

### Requirement: Hand off only surfaces the fork lacks

The `spec-handoff` skill SHALL confirm the target surface is **absent from the fork** —
`git ls-tree -r ui-only/main -- <path>` returns nothing and there is no `ui-sync.md` §2 mapping row —
before authoring a handoff. It SHALL refuse when the fork already has the surface: directing an edited
surface to `sync-reconcile` and an in-sync surface to no action.

#### Scenario: A surface the fork lacks proceeds
- **WHEN** `spec-handoff` targets `apps/admin`, which `git ls-tree ui-only/main` shows is absent from the fork
- **THEN** it proceeds to author the handoff, reporting the absence as the reason

#### Scenario: A surface the fork already has is refused
- **WHEN** `spec-handoff` targets a surface present in `ui-only` that we have edited
- **THEN** it declines and directs the user to `sync-reconcile` (a patch up), authoring no handoff

### Requirement: Author a self-contained implementation plan the designer runs himself, with code and docs

For an absent surface the skill SHALL author an OpenSpec change under the fork's
`openspec/changes/<x>/` naming (inverting the ledger §2 `web-` prefix) with `proposal.md`,
`specs/<x>/spec.md` (`SHALL` + `WHEN/THEN`), a **self-contained, additive** `tasks.md` that applies
from the designer's current branch (assuming the surface is not yet present), **the relevant UI/UX
source** (views/components/styles/layouts — not backend/db/auth wiring), and a **`docs/` artifact
explaining the changes** for the designer to view after implementation. The plan SHALL be one the
designer applies himself when ready; the skill SHALL NOT implement it or merge it for him.

#### Scenario: The plan carries the code, not just pointers
- **WHEN** `spec-handoff` authors the handoff for an absent surface
- **THEN** the staged change bundles the surface's views/components/styles/layouts, not merely references to their paths

#### Scenario: The plan is additive and applies from the designer's current branch
- **WHEN** the `tasks.md` is authored for a surface the fork lacks
- **THEN** its steps add the surface (no "edit the existing file" steps) so they apply from wherever the designer's branch currently is

#### Scenario: Docs are included for post-implementation viewing
- **WHEN** the handoff is authored
- **THEN** it includes a `docs/` artifact explaining the changes, intended for the designer to read after he has successfully implemented the plan

#### Scenario: Only design-relevant code is included
- **WHEN** the surface has both UI and backend/auth code
- **THEN** the handoff includes the UI/UX source and omits the backend, database, and auth wiring

### Requirement: Staged for upload, never merged or auto-pushed

The skill SHALL emit the plan + code as a git-applyable artifact against `ui-only` (a `change/<x>`
branch or a `patches/ui-only/**` patch), inverting §2 import-path rewrites, and SHALL stop for a human
to upload a handoff branch. It SHALL NOT push to `ui-only`, SHALL NOT merge into the designer's working
branch, SHALL NOT open a pull request, SHALL NOT use `--force`, and SHALL NOT `git merge ui-only`.

#### Scenario: Handoff stops at an applyable artifact
- **WHEN** `spec-handoff` finishes authoring the plan + code
- **THEN** it produces the branch/patch, records the `ui-sync.md` §4/§7 handoff note, and stops — performing no push, merge, or PR

#### Scenario: The human uploads it
- **WHEN** the user later uploads the handoff branch to `ui-only` and tells the designer
- **THEN** that upload is the only step that reaches the fork, performed by the human, never by the skill, and never as a merge into the designer's working branch
