# web-destinations — Promote the redesigned account-level Destinations surface into the live app

## Status

PROPOSED — 2026-08-13. Single-app (`apps/web`). A Stage-2 ui-sync promotion of
the design fork's redesigned Destinations registry (`ui-only@7c7202d7`), wired to
the existing real per-Space storage-destination data. The direct twin of
`web-sources` (landed the same day) — the two registries are "one family".

Relates to (cross-reference, does not duplicate):

- **`shared-destinations`** — the account-level Destinations model (a destination
  is created once on the account and reused across Spaces; a Space's backup fans
  out to one file destination + optionally one database). That change owns the
  eventual real account-level persistence + destination↔Space linking (the
  monorepo "Engineer" handoff). This change promotes the *view layer* and wires
  it to what the backend supports **today** (per-Space storage destinations,
  mapped into the registry shape), gating the account-level gap honestly.
- **`shared-multi-destinations`** — the per-Space multi-destination model that
  shipped (`storage_destinations` UNIQUE(space_id, type); primary =
  `backup_configurations.storage_type`). It owns the swap-primary action and the
  `StoragePicker` in the per-Space Backups config. This change does NOT touch
  that contract; it drops the swap-primary control from the *account-level
  registry view* (it belongs to the per-Space surface, not the account registry)
  and keeps the `api/connections/storage/*` routes untouched.
- **`web-nav-ia-restructure`** — moves Sources/Destinations to top-level URLs
  (`/sources`, `/destinations`) under an Account nav group. `/destinations`
  already exists as a live route; this change replaces the view rendered there.

## Why

The design fork redesigned the three Destinations surfaces (registry list, add
form, destination detail/health) into "one family" with their Sources twins —
one `.reg-*` class vocabulary, one sort/keyboard controller, one create-form
contract, one remove-consequence derivation. The live `apps/web` still rendered
the older hand-built versions, which had already drifted from the Sources side
(the detail page drew inert "in use by" ghost chips instead of the Sources
page's table; its Edit link minted a duplicate instead of editing in place).
Promoting the fork's canonical redesign resolves that drift by construction and
pulls in the founder's convergences: the in-use-by **table**, kind-aware copy
(a Postgres destination no longer claims to write "subfolders"), a re-check
action, and a guarded Remove sharing the Sources derivation.

Per the ui-sync prime directive: repurpose the existing Storybook-cataloged
widgets, wire real data, gate the unbuilt honestly — never recreate.

## What Changes

- **`apps/web/src/views/DestinationsView.astro`** — promoted verbatim from
  `ui-only@7c7202d7`. daisyUI `table` + soft `alert`s composed with the ui
  Badge/Button primitives and the shared `schema/tableSort`. Dense status list
  (Name · Type · Status · In use by · Last write), reconnect banner, empty
  state, and an `Unknown`-status fallback so an unmapped status can never throw.
  Replaced the old view (→ `*.legacy.astro`).
- **`apps/web/src/views/DestinationAddView.astro`** — promoted verbatim. Step 1
  type picker (file storage `Required` + database `Recommended`), step 2 a real
  `<form>` create contract (ui TextInput + field-level errors, Cancel →
  registry, real service logos for Drive/Dropbox/S3). Replaced view →
  `*.legacy.astro`.
- **`apps/web/src/views/DestinationDetailView.astro`** — promoted verbatim (no
  strict-tsc cast needed — `DestinationStatus` already carries all four
  lifecycle states the badge branches on). Identity + status/reconnect +
  edit-in-place (`pattern-panel-edit-mode`) + the in-use-by Spaces table +
  kind-aware per-Space copy + a re-check ("Test connection") action + guarded
  Remove (`confirm-modal`, shared `describeRegistryRemoval`). Replaced view →
  `*.legacy.astro`.
- **Promoted-alongside dependencies:** none new. Every dependency the fork views
  import already landed with `web-sources` — `lib/registry/removal.ts` (already
  handles `kind: 'destination'`), `lib/ui.ts` `CONFIRM_DESTRUCTIVE`, the
  `ConfirmModal` `value="confirm"` behavior, `schema/tableSort`, and the shared
  `.tbl-frame` / `.page-head` / `.sch-slot(-in)` / `.sch-cap-mark` /
  `.sch-modeswitch` global classes. The per-view `.reg-*` vocabulary stays
  scoped in each view (views are not tracked components, so scoped `<style>` is
  allowed — same as SourcesView).
- **Data wiring (real).** The pages already load real data via
  `getIntegrationsState → toDestinationSummaries` over the
  `storageDestinations` / `dbClusters` / `spaceDatabases` tables. Every prop the
  redesign reads (`name`, `kind`, `provider`, `providerLabel`, `status`,
  `detail`, `inUseBy`, `lastWrite`, `addedAt`) is already populated by the
  existing mapper — no new prop, no mapper change, no schema change.

## Capabilities

### Modified Capabilities

- `destinations`: the account-level Destinations registry / add / detail **views**
  are the redesigned "one-family" surfaces, rendering the current Space's real
  storage destinations in the registry shape with an honest
  account-level-pending notice. (The account-level model itself remains
  `shared-destinations`; per-Space primary selection remains
  `shared-multi-destinations`.)

## Non-Goals

- **No account-level multi-destination persistence / destination↔Space linking**
  — that is `shared-destinations`' backend follow-up. Today the active Space's
  storage destinations are mapped into the registry.
- **Swap-primary is DROPPED from the account-level registry view** (deliberate,
  not a regression to fix here). The legacy view carried a per-Space "Set
  primary" control + a "what you can connect" provider grid; those belong to the
  per-Space Backups config (`StoragePicker` / `shared-multi-destinations`), not
  the account-level registry the redesign models. The working per-Space wiring is
  preserved on that surface and in `DestinationsView.legacy.astro` (rollback).
- **No new create/remove/edit backend.** The add form is the fork's client
  validation → `/destinations?status=added` navigation; Remove opens the confirm
  dialog and states removal is not simulated (no backend to call); Edit commits
  into the page as the fork designed; "Test connection" fakes the re-check. The
  connect / reconnect / disconnect actions keep the existing
  `apps/web/src/pages/api/connections/storage/{box,dropbox,google-drive,onedrive,local-fs}/*`
  routes — contract unchanged.
- **`lastWrite` renders "—"** where the mapper has no relative-write label yet
  (honest, not faked); the fork's `lastWriteRank` sorts real labels when present.
- **`data-narrow-pan` sticky pan-rail** — the fork's `panRail` hook is not
  promoted here; `overflow-x: auto` still gives horizontal scroll (graceful),
  same gate as `web-sources`.

## Impact

- **`apps/web`**: 3 views promoted (+ 3 `*.legacy.astro` rollback targets); 2
  pages trimmed to the fork's prop contract (`destinations.astro`,
  `destinations/new.astro`); `destinations/detail.astro` already passed the exact
  fork props — unchanged. 3 raw-markup allowlist entries.
- No new component, no new store field, no mapper change, no test change, no new
  secret, no new OAuth scope, no new SQL surface, no migration. Every dependency
  landed with `web-sources`.
- **Ledger:** `shared/internal/ui-sync.md` §4 Destinations row → promoted
  (`web-destinations`, `ui-only@7c7202d7`; data wired: yes; legacy rollback:
  `*.legacy.astro`); §3 gains the promotion note.
