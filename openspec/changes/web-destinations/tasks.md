# web-destinations — tasks

## Status

DONE (code) — re-landed 2026-08-20 on `autumn/cursor-ui-implementation-test`
(Phase 7.3; did **not** merge `web-ui-sync-promotion`). Reference promotion
`ecdde1d5` / ui-only@7c7202d7. Twin of Phase 7.2 Sources. BYOS detail Reconnect
grafted to real `api/connections/storage/<kebab>/authorize` (Sources twin).
Add create remains fork skeleton. Human browser smoke pending.

## 1. Promote the three views (verbatim; same path ⇒ no import rewrites)

- [x] 1.1 `src/views/DestinationsView.astro` — verbatim from `ui-only@7c7202d7`
      (daisyUI `table` + `alert`, ui Badge/Button, `schema/tableSort`, `Unknown`
      status fallback, `lastWriteRank` sort). Old view moved to
      `DestinationsView.legacy.astro` (rollback).
- [x] 1.2 `src/views/DestinationAddView.astro` — verbatim (type picker + real
      `<form>` create contract, ui TextInput, real Drive/Dropbox/S3 logos). Old
      view → `DestinationAddView.legacy.astro`.
- [x] 1.3 `src/views/DestinationDetailView.astro` — verbatim, NO cast needed
      (`DestinationStatus` already carries `connected | reconnect | connecting |
      needs_connection`, so every `statusBadge` branch is a legal comparison).
      Identity + status/reconnect + edit-in-place + in-use-by table + kind-aware
      copy + "Test connection" re-check + guarded Remove. Old view →
      `DestinationDetailView.legacy.astro`.

## 2. Promoted-alongside dependencies

- [x] 2.1 None new — every dependency the fork views import already landed with
      `web-sources`: `lib/registry/removal.ts` (already handles
      `kind: 'destination'` via `describeRegistryRemoval` + `wireRegistryRemove`),
      `lib/ui` `CONFIRM_DESTRUCTIVE`, `ConfirmModal` `value="confirm"`,
      `schema/tableSort`, and the shared `.tbl-frame` / `.page-head` /
      `.sch-slot(-in)` / `.sch-cap-mark` / `.sch-modeswitch` global classes.
      Verified each resolves (typecheck 0 errors).
- [x] 2.2 Brand logo assets (`/brands/google-drive.svg`, `/brands/dropbox.svg`,
      `/brands/aws.svg`) the fork AddView references — present in
      `apps/web/public/brands/`. Verified.

## 3. Data wiring (real data; honest gates)

- [x] 3.1 No store/type change — the existing `DestinationSummary`
      (`stores/destinations.ts`) already carries every field the redesign reads
      (`name`, `kind`, `provider`, `providerLabel`, `status`, `detail`,
      `inUseBy`, `lastWrite`, `addedAt`).
- [x] 3.2 No mapper change — `toDestinationSummaries` (`lib/registry-mappers.ts`)
      already populates all of the above from the real per-Space
      `storageDestinations` (+ provider-catalog meta). Unchanged.
- [x] 3.3 `src/pages/destinations.astro` — trimmed to the fork prop contract
      `<DestinationsView destinations notice />` (dropped `providers` / `spaceId`
      / `primaryType` + the `env` / provider-catalog imports). Doc comment notes
      the swap-primary deferral to the per-Space surface / `shared-destinations`.
- [x] 3.4 `src/pages/destinations/new.astro` — trimmed to
      `<DestinationAddView selectedType />` (dropped `providers` / `spaceId` /
      `connectedTypes` / `primaryType` + the state fetch). Doc comment notes the
      connect path lands with `shared-destinations`.
- [x] 3.5 `src/pages/destinations/detail.astro` — already passed the exact fork
      props `<DestinationDetailView destination reconnected />` (real data via
      `getIntegrationsState → toDestinationSummaries`, `?id=` selects the row).
      Unchanged.
- [x] 3.6 Connect / reconnect / disconnect keep pointing at the existing
      `pages/api/connections/storage/{box,dropbox,google-drive,onedrive,local-fs}/*`
      routes — contract untouched (not called from the promoted skeleton add
      view; preserved for the `shared-destinations` follow-up + per-Space config).

## 4. Governance

- [x] 4.1 `src/components/raw-markup-audit-allowlist.json` — entries for the 3
      new views, rationale naming the reused primitives (table / alert / badge /
      btn / input; one family with the Sources views).
- [x] 4.2 Legacy views (`*.legacy.astro`) do not match the raw-markup regex
      (they used ui/ components, not raw daisyUI class strings — 0 hits each), so
      no allowlist entries — verified by the exact-equality audit test.
- [x] 4.3 No `component-classification.json` change — the promotion adds no
      `src/components/**` file; the fork views live under `src/views/**` where
      scoped `<style>` is permitted (not tracked components).

## 5. Tests + gates

- [x] 5.1 `pnpm --filter @baseout/web typecheck` — 0 errors (597 files).
- [x] 5.2 `pnpm --filter @baseout/web test:unit` — 1510 passed (142 files).
- [x] 5.3 `pnpm --filter @baseout/web audit:components` — green (39/39
      classification + stories-coverage; storybook build completed).
- [x] 5.4 `pnpm --filter @baseout/web build` — Complete.
- [x] 5.5 Console-clean — grep of the 3 views + 3 pages + allowlist for
      `console.` / `debugger`: no matches.

## 6. Ledger

- [x] 6.1 `shared/internal/ui-sync.md` §4 — Destinations row → promoted
      (`web-destinations`, `ui-only@7c7202d7`; data wired: yes; legacy rollback:
      `*.legacy.astro`); §3 promotion note.

## 7. Human smoke

- [ ] 7.1 `pnpm --filter @baseout/web dev` → sign in → `/destinations` shows the
      Space's storage destinations in the redesigned registry (+ pending notice);
      a broken destination shows the reconnect banner naming affected Spaces;
      `/destinations/detail?id=<type>` shows the in-use-by table + edit-in-place +
      "Test connection" + guarded Remove; `/destinations/new` walks the type
      picker → validated create form. Check <375 / <768 / <1024 + theme swap.

## Deferred follow-ups

- [ ] Account-level multi-destination persistence + destination↔Space linking
      (`shared-destinations` "Engineer" handoff) — then `toDestinationSummaries`
      returns several account destinations with real `inUseBy` per-Space rows
      instead of the single-Space mapping.
- [ ] Re-home swap-primary / provider connect into the account-level registry (or
      keep it solely on the per-Space Backups config) once the account model
      lands — decision belongs to `shared-destinations`.
- [ ] A real relative last-write label ⇒ populated `lastWrite` (currently "—").
- [ ] Promote the `panRail` hook so `data-narrow-pan` gets the sticky top
      scrollbar (shared with `web-sources`).
