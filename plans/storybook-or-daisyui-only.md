# Plan: Storybook or daisyUI Only (No Custom Components)

**Status:** Implemented on branch `autumn/design-to-web` (uncommitted at time of writing)  
**OpenSpec:** Not used — do not pursue `openspec/changes/system-component-governance/`  
**Audience:** Paste this entire doc into Claude for context on what was decided, what shipped, and how to verify or extend it.

---

## 1. Problem

The repo had a **four-tier** UI model that conflicted with product/design direction:

| Tier (old) | Issue |
|---|---|
| `ui-primitive-storybook` | OK |
| `pattern-in-design-app` | Allowed Astro wrappers **without** requiring Storybook stories |
| `custom-exception-approved` | Permitted hand-rolled CSS (`FeatureBadge`, `SocialButton`, `DocNav`) |
| Raw view markup (allowlisted) | 18 views with bespoke CSS or inline daisyUI outside components |

**New rule (authoritative):** Every Astro component under `apps/web/src/components/` must be **Storybook-cataloged** (`ui/*` or `patterns/*` with a sibling `*.stories.ts`). Anything else must be **raw daisyUI markup in views** — no custom Astro wrappers, no scoped `<style>` in components, no exception tier.

**Confirmed scope decision:** Keep `patterns/*` with Storybook stories. Do **not** eliminate the patterns folder.

---

## 2. Target model

```
Need UI markup
  ├─ Storybook story exists? → import ui/* or patterns/*
  └─ No story? → inline daisyUI classes in view/layout (document in apps/design /styleguide)
```

**Allowed:**
- `ui-primitive-storybook` — daisyUI-backed primitives in `components/ui/*.astro` + story
- `storybook-pattern` — product compositions in `components/patterns/*.astro` + story + styleguide pattern entry + design harness path

**Not allowed:**
- `custom-exception-approved`
- `pattern-in-design-app` (without mandatory story)
- Non-story Astro wrappers in `backups/`, `layout/`, `integrations/` (those folders were removed)
- Component-level `<style>` blocks
- View-level bespoke CSS where a Storybook component or daisyUI utility covers the need

---

## 3. Implementation phases (completed)

### Phase 1 — Policy + tests

**Docs updated:**
- [`CLAUDE.md`](../CLAUDE.md) §4.2 — binary Storybook / daisyUI rule
- [`apps/web/.claude/CLAUDE.md`](../apps/web/.claude/CLAUDE.md) §2.5 — same; removed FeatureBadge/SocialButton exceptions
- [`.cursor/skills/daisyui-storybook-audit/SKILL.md`](../.cursor/skills/daisyui-storybook-audit/SKILL.md)

**Classification schema** ([`component-classification.json`](../apps/web/src/components/component-classification.json)):
- `pattern-in-design-app` → **`storybook-pattern`**
- **`custom-exception-approved`** deleted
- `ui/CreateSpaceModal.astro` → `storybook-pattern` (styleguide group is Patterns)

**Tests hardened** ([`component-classification.test.ts`](../apps/web/src/components/component-classification.test.ts)):
1. Every tracked `*.astro` has sibling `*.stories.ts`
2. Forbid legacy classification strings in registry JSON
3. `storybook-pattern` entries require `styleguideId`, `designHarnessPath`, and fixture import in story
4. Forbid `<style>` in any classified component
5. Raw view markup allowlist must match auto-detected views (target: `{}`)

**Stories coverage** ([`stories-coverage.test.ts`](../apps/web/src/components/ui/stories-coverage.test.ts)):
- Enumerates `ui/*.astro` from filesystem (not git index) so deleted files don't linger

**Verification:**
```bash
pnpm --filter @baseout/web exec vitest run \
  src/components/component-classification.test.ts \
  src/components/ui/stories-coverage.test.ts
```

---

### Phase 2 — Remove custom exceptions

| Removed | Replacement |
|---|---|
| `ui/FeatureBadge.astro` + `feature-badge.css` | daisyUI `badge` examples in styleguide |
| `ui/SocialButton.astro` + `social-button.css` | `Button` + FontAwesome brand icon (`btn btn-outline`) |
| `docs/DocNav.astro` | Deleted (docs-only; not in product UI) |

**Also:** Dropped CSS imports from [`apps/web/src/styles/global.css`](../apps/web/src/styles/global.css).

**Styleguide:** Removed `feature-badge` and `social-button` primitive entries; added usage notes on `badge` and `button` entries for tier labels and auth provider buttons.

---

### Phase 3 — Move non-story wrappers into `patterns/` + stories

| Old path | New path |
|---|---|
| `layout/Header.astro` | `patterns/AppShellHeader.astro` |
| `layout/Sidebar.astro` | `patterns/AppShellSidebar.astro` |
| `backups/BackupHistoryWidget.astro` | `patterns/BackupHistoryWidget.astro` |
| `backups/RunBackupButton.astro` | `patterns/RunBackupButton.astro` |
| `backups/FrequencyPicker.astro` | `patterns/FrequencyPicker.astro` |
| `backups/StoragePicker.astro` | `patterns/StoragePicker.astro` |
| `integrations/BaseSelectionTable.astro` | `patterns/BaseSelectionTable.astro` |
| `integrations/SpacePipelineHero.astro` | `patterns/SpacePipelineHero.astro` |

**New story files:** sibling `*.stories.ts` for each, importing shared fixtures from [`apps/design/src/fixtures/component-catalog.ts`](../apps/design/src/fixtures/component-catalog.ts).

**Scoped CSS extracted** (components stay `<style>`-free):
- `apps/web/src/styles/components/space-pipeline-hero.css`
- `apps/web/src/styles/components/base-selection.css`

**Import updates:** [`SidebarLayout.astro`](../apps/web/src/layouts/SidebarLayout.astro), all views, [`apps/design/src/lib/flow-registry.ts`](../apps/design/src/lib/flow-registry.ts), [`apps/design/src/lib/storybook.ts`](../apps/design/src/lib/storybook.ts) pattern references.

---

### Phase 4 — View migration

All 18 previously allowlisted views migrated off raw daisyUI class strings in `class="..."` attributes:
- Use `Button`, `Badge`, `Alert`, `Card`, `TextInput`, `Select`, `SectionPanel`, pattern components, etc.
- `SourcesView` / `DestinationsView`: inline Tailwind grid (RegistryTable pattern), removed scoped `<style>`
- Renamed classes that falsely matched audit regex substrings (e.g. `src-table` contains `table`)

**Result:** [`raw-markup-audit-allowlist.json`](../apps/web/src/components/raw-markup-audit-allowlist.json) = `{}`

**View import rule:** Only `components/ui/*` or `components/patterns/*` — no `backups/`, `layout/`, `integrations/`.

---

### Phase 5 — Styleguide alignment

- Pattern entries reference `components/patterns/*.astro` (not old folder paths)
- `pattern-app-shell` → `AppShellHeader` + `AppShellSidebar`
- `pattern-pipeline` → `BackupPipeline` + `SpacePipelineHero`
- Tier/auth guidance lives on `badge` and `button` primitives (daisyUI HTML examples)

---

## 4. Final inventory

**34 tracked Astro components**, all with stories:

- **19 ui primitives:** Alert, Avatar, BackLink, Badge, Breadcrumbs, Button, Card, Checkbox, Divider, EmptyState, Modal, PageHeader, ProgressBar, SectionPanel, Select, Tabs, TextInput, Toggle, (+ CreateSpaceModal classified as pattern but lives in `ui/`)
- **15 patterns:** AppShellHeader, AppShellSidebar, BackupHistoryWidget, BackupPipeline, BaseSelectionTable, DefinitionList, EntityDetailHeader, FrequencyPicker, MetaBlock, RegistryTable, RunBackupButton, SelectableConnectorRow, SpacePipelineHero, StoragePicker, WizardStepper

**Key governance files:**
- [`apps/web/src/components/component-classification.json`](../apps/web/src/components/component-classification.json)
- [`apps/web/src/components/component-classification.test.ts`](../apps/web/src/components/component-classification.test.ts)
- [`apps/web/src/components/raw-markup-audit-allowlist.json`](../apps/web/src/components/raw-markup-audit-allowlist.json)
- [`apps/web/src/components/ui/stories-coverage.test.ts`](../apps/web/src/components/ui/stories-coverage.test.ts)
- [`apps/design/src/lib/storybook.ts`](../apps/design/src/lib/storybook.ts)
- [`apps/design/src/fixtures/component-catalog.ts`](../apps/design/src/fixtures/component-catalog.ts)

---

## 5. Verification checklist

Run after any UI change:

```bash
pnpm --filter @baseout/web audit:components   # classification tests + Storybook build
pnpm --filter @baseout/web test:unit
pnpm --filter @baseout/web typecheck
pnpm --filter @baseout/web build
pnpm --filter @baseout/design typecheck
```

**Done criteria:**
- [ ] Registry has only `ui-primitive-storybook` and `storybook-pattern`
- [ ] Every `components/**/*.astro` has sibling `*.stories.ts`
- [ ] No component contains `<style>`
- [ ] `raw-markup-audit-allowlist.json` is `{}`
- [ ] No `FeatureBadge`, `SocialButton`, `DocNav`, or old folder imports
- [ ] Docs/skill/CLAUDE.md all state the same binary rule

**Responsive smoke (optional, after view changes):**
```bash
pnpm --filter @baseout/design dev   # port 4334
# Hit /, /sources, /destinations, /backups, /integrations/configure at 360/768/1280px
```

---

## 6. How to add new UI (operating procedure)

1. **Check Storybook** — `pnpm --filter @baseout/web storybook`; search `ui/` and `patterns/`
2. **Check styleguide** — `apps/design/src/lib/storybook.ts` + `/styleguide` in design app
3. **If reusing a component** — import it; extend its story for new props/states
4. **If no component exists** — inline daisyUI in the view; add/update a styleguide entry
5. **If promoting to a component** (2nd call site or clear API):
   - Add `ui/*.astro` or `patterns/*.astro`
   - Add sibling `*.stories.ts` with shared fixture import
   - Register in `component-classification.json`
   - Link styleguide entry bidirectionally
   - For patterns: set `designHarnessPath` to an `apps/design` flow page
6. **Never** add scoped `<style>` to components; use daisyUI utilities or approved global CSS in `apps/web/src/styles/components/` only when utilities cannot express layout (e.g. pipeline hero animations)

---

## 7. Known caveats / follow-ups

- **Global CSS for two patterns:** `space-pipeline-hero.css` and `base-selection.css` remain in global stylesheet — not daisyUI-only at the CSS-file level, but components themselves have no `<style>` blocks (test-enforced).
- **CreateSpaceModal location:** File stays in `ui/` but classification is `storybook-pattern` because styleguide groups it under Patterns.
- **Git index:** Deleted `FeatureBadge`/`SocialButton` may still appear in `git ls-files` until deletions are staged/committed.
- **StoragePicker story:** Renders via Astro Container; uses `cloudflare:workers` `env` at SSR — Storybook build passes but behavior is validated in `apps/design`, not Storybook scripts.
- **Commit not made:** Work was implemented but not committed in the implementing session — stage and commit with conventional message + Verification section per CLAUDE.md §3.8 before PR.

---

## 8. Suggested commit message (when ready)

```
refactor(web): enforce Storybook-or-daisyUI-only component governance

Collapse UI policy to two tiers (ui primitives + storybook patterns),
delete custom-exception components, move shell/backup/integration
wrappers into patterns/ with stories, and migrate all allowlisted
views off raw daisyUI markup.

Verification:
- Demo: pnpm --filter @baseout/web audit:components && pnpm --filter @baseout/web typecheck
- Test: pnpm --filter @baseout/web test:unit
- Checks: pnpm --filter @baseout/design typecheck green
- Caveats: pipeline/base-selection layout CSS lives in global stylesheets
```

---

## 9. If extending this work

**Low-risk next slices:**
- Wire Google OAuth on login/register using `Button` + FontAwesome (replacing deleted SocialButton)
- Extend `RegistryTable` if Sources/Destinations need Badge slots instead of inline grid markup
- Add Playwright smoke for backup history accordion (noted TODO in BackupHistoryWidget)
- Update deferred openspec/docs that still cite `components/backups/` or `components/layout/` paths

**Do not:**
- Reintroduce `custom-exception-approved` or non-story Astro wrappers
- Add component `<style>` blocks (CI will fail)
- Add raw daisyUI to views without updating allowlist audit (allowlist must stay empty)
