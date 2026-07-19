# Tasks

> Depends on `shared-embed-protocol` (package + web `/embed` entry) — built in the same session.
>
> **Status 2026-07-18:** all wrapper code built; chrome dist assembles and is
> loadable unpacked. Remaining: the three per-host dev smokes (human loop —
> Chrome unpacked walk-through; `block run` for both Airtable hosts needs an
> Airtable account with extension dev access) including the design-Q1 sandbox
> framing check, and the ops publication follow-ups.

## 1. Workspace + core

- [x] 1.1 `pnpm-workspace.yaml`: `apps/embed/*` added with the two Airtable hosts EXCLUDED (blocks CLI owns their lifecycle; React peer set stays out of the monorepo — design Decision 1 refined). Scaffolded `@baseout/embed-core` (DOM-only, happy-dom vitest).
- [x] 1.2 `mountEmbedHost({ container, appOrigin, hostKind, getInitialContext, onContextChange, openExternal })` — full-viewport iframe at `/embed?host=<kind>`, host bridge wiring, context forwarding, open-external delegation, `destroy()`. 6 tests green; typecheck + build clean.

## 2. Chrome host (apps/embed/chrome)

- [x] 2.1 Pure `parseAirtableUrl` — segment-scanning (id-prefix tolerant, not path-shape-locked), data + interface + partial paths, non-Airtable/unparseable → `{host:'chrome', url}`. 7 fixture tests.
- [x] 2.2 MV3 scaffold: manifest (sidePanel + tabs, airtable.com host permission), stateless background worker (tab watch → parse → runtime broadcast + context-request reply), side panel mounting core with `chrome.tabs.create` opener. tsup build with workspace deps INLINED (`noExternal` — extensions have no node_modules) + `scripts/assemble.mjs` → loadable `dist/`. `EMBED_APP_ORIGIN` baked at build (dev default baseout.local:4331).
- [ ] 2.3 Dev smoke: load unpacked, open panel on an Airtable tab → handshake + context navigation + tab-switch update + open-external. **Human loop.** Steps in apps/embed/README.md.

## 3. Airtable data-layer host (apps/embed/airtable-data)

- [x] 3.1 Blocks-SDK package scaffold (`block.json`, pinned `@airtable/blocks`, `file:../core` dep). Sandbox-framing check (design Q1) documented as the FIRST smoke step in the README — stop-and-surface if blocked.
- [x] 3.2 Wrapper: `initializeBlock` → absolute-inset container → core mount; context from `base.id` + cursor (activeTableId/activeViewId) via `useWatchable`; pushes on cursor change; `window.open` opener.
- [ ] 3.3 `block run` dev smoke against a dev base. **Human loop — needs Airtable extension dev access.** Steps in the package README (includes the one-time `.block/remote.json` bootstrap).

## 4. Airtable interface host (apps/embed/airtable-interface)

- [x] 4.1 Separate interface-extension package (own registration). Design-Q2 (exact interface context surface: pageId hook, record binding) recorded in the README for verification during the smoke; current mapping degrades per the default.
- [x] 4.2 Wrapper: same skeleton with `host:'airtable-interface'`; context maps `baseId` + `activeTableId` + single-selection `recordId`, omitting `pageId` until Q2 is verified.
- [ ] 4.3 `block run` dev smoke inside an interface. **Human loop.**

## 5. Verification + coordination

- [x] 5.1 Workspace members green: embed-core 6 tests + typecheck + build; embed-chrome 7 tests + typecheck + assembled dist. (Airtable hosts typecheck under their own npm install — blocks CLI flow, human loop with 3.3/4.3.)
- [x] 5.2 Web config coordinated: dev `PUBLIC_EMBED_ALLOWED_ANCESTORS` in `apps/web/wrangler.jsonc.example` covers airtable.com, *.airtableblocks.com, and any chrome-extension (dev only — production pins the published id + observed extension origins during the smokes).
- [ ] 5.3 File ops follow-ups for publication (Chrome Web Store listing, Airtable extension release/registration) once the smokes pass.
