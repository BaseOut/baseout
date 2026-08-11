# embed — Design

## Context

Paired with `shared-embed-protocol` (the message contract + web child side). This change builds the three outer frames. Constraints that shape everything: the two Airtable wrappers run inside Airtable's own extension sandbox (their iframe, their SDK, their hosting — we ship source through the blocks CLI); the Chrome wrapper runs in browser extension contexts (side panel + service worker, MV3 restrictions); and per the owner, wrappers are **thin and UI-less** — one iframe, zero widgets — so all product UX stays in one codebase (the web app).

## Goals / Non-Goals

**Goals:**
- One shared wrapper core so the three hosts differ only in context acquisition and an `open-external` opener.
- Each host boots, frames `/embed?host=<kind>`, completes the handshake, and streams context updates as the user moves around (tab/table/view/page changes).
- Dev-mode verification for all three without store/marketplace publication.

**Non-Goals:**
- Any wrapper UI (loading states, errors, sign-in — all delegated to the child app).
- Store/marketplace publication and review processes (Chrome Web Store listing, Airtable marketplace) — dev-mode only here; publication is an ops follow-up.
- Safari/Firefox extensions (Chrome only, per owner).
- Two-way control (host driving arbitrary child navigation beyond context) — protocol V1 has no such message.

## Decisions

1. **Umbrella directory of four workspace packages, not one package.** The Airtable blocks CLI requires each extension to be a self-contained package (own `package.json`, `block.json`, entry file) — two extensions can't share one. So: `apps/embed/{core,chrome,airtable-data,airtable-interface}`, all registered via `apps/embed/*` in `pnpm-workspace.yaml`. This deviates from "one app dir = one `@baseout/<dir>` package"; the deviation is contained (nothing imports these except each other) and documented here. Alternative — three top-level apps — rejected: they'd scatter what is conceptually one surface and triple the convention noise.

2. **`core` is dependency-injected, DOM-only, and SDK-free.** `mountEmbedHost({ appOrigin, hostKind, getInitialContext, onContextChange(cb), openExternal })`: creates the full-viewport iframe at `${appOrigin}/embed?host=${hostKind}`, wires `createHostBridge` (hello retry, exact-origin inbound validation, open-external allowlist refusal per the protocol spec), subscribes `onContextChange` → `host:context`. No React, no chrome.* / blocks imports — those live in each host package. This keeps core testable with a mock iframe/window and keeps host packages at ~a screenful each.

3. **Chrome: side panel + service-worker context watcher.** MV3, `sidePanel` + `tabs` permissions with `host_permissions` on `https://airtable.com/*`. The service worker listens to `tabs.onActivated`/`tabs.onUpdated`, parses the URL into `EmbedContext` with a pure `parseAirtableUrl` (recognizes `/appXXX/tblYYY/viwZZZ` data-layer paths and `/appXXX/pagXXX` interface paths; non-Airtable tabs → `{host:'chrome', url}`), and forwards via `chrome.runtime` messaging to the panel, which feeds the bridge. `open-external` → `chrome.tabs.create`. Side panel over popup: it persists while the user works in Airtable, matching the sidebar posture of the other two hosts. `parseAirtableUrl` is pure and unit-tested; the SW/panel glue is smoke-tested by loading unpacked.

4. **Airtable data-layer wrapper: blocks SDK, cursor-driven.** `initializeBlock` renders core's mount inside a full-size container; context from the SDK: `base.id`, cursor's active table/view; cursor-change events → `onContextChange`. `open-external` → `window.open` (permitted in the blocks sandbox). The SDK is React-based, so this package carries the SDK's React — core stays framework-free.

5. **Airtable interface wrapper: same skeleton, interface surface.** Separate package (not a flag on the data one) because Airtable treats interface extensions as a distinct extension type with its own registration and its own context surface (`pageId`, record scope when the element is record-bound). Where the SDK exposes equivalents, context maps `{baseId, pageId, recordId?}`; the exact hook surface is confirmed against the SDK version at implementation time (interface extensions are a newer SDK surface — pinned SDK version + a compat note in the package README).

6. **App origin is build-time config per host.** `EMBED_APP_ORIGIN` env at build (`https://baseout.local:4331` dev, production app URL for releases). Not runtime-configurable — a wrapper that can be pointed at an arbitrary origin is a phishing primitive. The child origin the host bridge validates against is derived from this same value.

7. **`child:resize` is ignored by all three hosts (V1).** All three viewports are host-fixed (extension pane, interface element bounds, side panel). The iframe is always 100%×100% of whatever the host gives us. The protocol keeps the message; hosts drop it.

## Risks / Trade-offs

- [Airtable blocks SDK / interface-extension API surface shifts under us] → thin wrappers by design (context mapping is the only SDK contact); SDK versions pinned per package; core and protocol are SDK-independent.
- [Airtable extension iframe CSP might block framing arbitrary origins] → verified in dev-mode smoke before any deeper work (task-ordered first for the data wrapper); if blocked, the fallback posture is the Chrome extension + a documented limitation — surfaced to the owner, not silently worked around.
- [Chrome URL parsing misreads Airtable's URL shapes (they're not a public contract)] → pure parser with a fixture table; unknown shapes degrade to `{host:'chrome', url}` (the child just shows the dashboard); parser fixtures updated as shapes are observed.
- [Sandboxed extension origins vary per install (`*.airtableblocks.com`)] → handled protocol-side by wildcard allowlist entries; the wrappers themselves need no origin knowledge beyond the app origin.
- [MV3 service worker sleeps between tab events] → context derivation is stateless per event (parse-on-event, no SW state), so worker restarts are harmless.

## Migration Plan

1. Land after `shared-embed-protocol` (build-depends on the package + the web `/embed` entry).
2. Dev verification per host: Chrome unpacked load; `block run` against a dev base for both Airtable wrappers (human loop — needs an Airtable account with extension dev access).
3. Publication (Chrome Web Store, Airtable release) is deliberately out of scope; tracked as ops follow-ups.
4. Rollback: wrappers are leaf artifacts; unpublish/stop distributing. Nothing else depends on them.

## Open Questions

| # | Question | Default answer |
|---|---|---|
| Q1 | Does the Airtable extension sandbox permit framing external origins at all? | Verified first in dev smoke (risk #2); assumed yes (extensions embed external content today). |
| Q2 | Interface-extension SDK context surface (exact hooks for pageId/record scope) | Confirm against pinned SDK at implementation; degrade to `{baseId}` if page/record scope is unavailable. |
| Q3 | One Chrome extension or per-env builds? | One extension, app origin baked per build; dev builds loaded unpacked only. |
