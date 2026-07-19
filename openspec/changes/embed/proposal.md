# embed — Proposal

## Why

PRD §6.7 requires Baseout to run embedded in Airtable extensions; the owner has confirmed three host environments: an Airtable **data-layer extension** (sidebar at the data layer), an Airtable **interface extension** (embedded inside an interface), and a **Chrome extension**. The messaging contract and the web app's child side land in the paired [`shared-embed-protocol`](../shared-embed-protocol/) change; this change builds the outer frames — three thin, no-UI wrappers that render the Baseout iframe, acquire per-host context, and speak the protocol. Airtable hosts the two extension wrappers (`block run`/`block release`); the Chrome extension ships via the Chrome Web Store — none deploy to our Cloudflare infrastructure.

## What Changes

- **New `apps/embed/` umbrella** housing the three host wrappers plus a shared core:
  - `apps/embed/core` (`@baseout/embed-core`) — the common no-UI wrapper: creates the full-viewport iframe of the configured Baseout `/embed?host=<kind>` URL, runs `createHostBridge` from `@baseout/embed-protocol` (hello retry, origin validation), pushes context updates, and handles `child:open-external` via an injected per-host opener. Everything host-specific is injected.
  - `apps/embed/chrome` (`@baseout/embed-chrome`) — Manifest V3 extension: side panel renders the iframe; a background service worker watches the active tab's URL, parses Airtable location (`appXXX`/`tblYYY`/`viwZZZ`/`pagXXX`) into `EmbedContext`, and streams updates to the panel. `open-external` → `chrome.tabs.create`.
  - `apps/embed/airtable-data` (`@baseout/embed-airtable-data`) — Airtable blocks-SDK extension: context from the SDK's base/cursor hooks (`baseId`, active `tableId`/`viewId`), updates pushed on cursor changes.
  - `apps/embed/airtable-interface` (`@baseout/embed-airtable-interface`) — Airtable interface-extension variant: context from the SDK's interface surface (`baseId`, `pageId`, record scope when element-bound).
- **No-UI rule:** wrappers render exactly one full-viewport iframe — every screen, prompt, and error UX lives in the Baseout app (including sign-in, which the child delegates back via `child:open-external`).
- **Workspace wiring:** `pnpm-workspace.yaml` gains `apps/embed/*` (the Airtable blocks CLI requires each extension to be its own package with its own `package.json`/`block.json`, so `apps/embed` is an umbrella directory of four packages rather than one app package — deviation from the one-dir-one-package convention documented in design).

## Capabilities

### New Capabilities

- `embed-host-wrappers`: the three thin host wrappers — shared no-UI wrapper behavior (iframe + host bridge + injected opener) and per-host context acquisition (Chrome tab-URL parsing; Airtable data-layer SDK hooks; Airtable interface SDK surface).

### Modified Capabilities

<!-- none — new app; the protocol/web capabilities live in shared-embed-protocol -->

## Impact

- New: `apps/embed/{core,chrome,airtable-data,airtable-interface}`; `pnpm-workspace.yaml`.
- Depends on [`shared-embed-protocol`](../shared-embed-protocol/) (`@baseout/embed-protocol`) — land that first.
- No Cloudflare deploys, no DB, no new secrets. Per-host config is the Baseout app origin (dev: `https://baseout.local:4331`; prod: the app URL) baked at build time.
- Distribution (not in this change's tasks beyond dev-mode verification): Chrome Web Store listing; Airtable extension registration per base/workspace via the blocks CLI (requires an Airtable account with extension dev access — human loop).
- `PUBLIC_EMBED_ALLOWED_ANCESTORS` (web side) must include the Airtable extension origins and the published Chrome extension id — coordination note for the paired change's config.
