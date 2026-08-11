# shared-embed-protocol — Design

## Context

Baseout must run inside iframes controlled by outer frames it does not deploy alongside: Airtable data-layer extensions, Airtable interface extensions, and a Chrome extension (PRD §6.7). The outer frame knows *where the user is* (base, table, view, interface page); the inner Baseout app knows *what to show*. They communicate only via `window.postMessage`. Today: no protocol, no framing headers, `SameSite=Lax` session cookies (never sent cross-site in an iframe), and no embedded-mode concept in the web app. The wrappers land in the paired `embed` change; this change owns everything both sides must agree on plus the web (child) half.

## Goals / Non-Goals

**Goals:**
- One protocol package both frames import — types, handshake, origin validation — so host and child can never drift.
- Secure by default: origin-locked channels on both sides, framing restricted to a configured ancestor allowlist, no sensitive data before the handshake completes.
- Context-aware child: base/table/view context routes the app to the matching Space surface.
- A working auth story for iframes on Chromium, and an explicit degraded path elsewhere.

**Non-Goals:**
- The host wrappers themselves (paired `embed` change).
- Bidirectional RPC (request/response with replies) — the envelope reserves a correlation field, but V1 messages are fire-and-forget events.
- Deep-link context beyond navigation (e.g., filtering a schema view to one field) — the store makes context available; consuming it richly is per-surface follow-up work.
- Embedding hosts other than the three named kinds (protocol is extensible via the `host` enum).

## Decisions

1. **Protocol lives in a workspace package, not in either app.** `packages/embed-protocol`, pure TS, zero runtime deps, no DOM assumptions beyond `postMessage`/`MessageEvent`. Both `apps/web` (child bridge) and `apps/embed` (host bridge) import it at a pinned workspace version. Alternative — types duplicated per app — rejected: the whole failure mode of postMessage integrations is silent contract drift.

2. **Envelope: `{ proto: 'baseout-embed/1', type, id, payload }`.** Version rides in the `proto` string; receivers ignore any message whose `proto` doesn't match a supported version or whose `type` is unknown (forward compatibility — new message types are additive, breaking changes bump the version). `id` is a random correlation id, unused in V1 but reserved so RPC can be added without an envelope change.

3. **Handshake: child beacons, host answers, child locks.** The child cannot know its parent's origin up front (Airtable extension origins are per-install sandboxed domains), so:
   - Child sends `child:ready` to `window.parent` with `targetOrigin: '*'` — it carries **nothing** but the proto string (no session data, no context; broadcasting it is safe).
   - Host (which *does* know the exact child origin — it built the iframe URL) replies `host:hello` with `{ hostKind, context }`, targeted at the child's exact origin, retrying on an interval until acked (the child may still be booting when the iframe fires `load`).
   - Child validates `event.origin` against its ancestor allowlist; on match it **locks the bridge to that origin** (all subsequent sends target it; all receives require it) and replies `child:hello-ack { version, authenticated }`. Non-matching `hello`s are dropped and counted.
   - Host validates every inbound message's origin equals the configured child origin exactly.
4. **Ancestor allowlist is config, matched by pattern.** `PUBLIC_EMBED_ALLOWED_ANCESTORS` — comma-separated entries supporting exact origins (`https://airtable.com`), wildcard subdomains (`https://*.airtableblocks.com`), and extension schemes (`chrome-extension://<id>` — dev configs may use `chrome-extension://*`, production pins the published extension id). The same list feeds both the child bridge's handshake validation and the middleware's `frame-ancestors` directive, from one parser in the protocol package — two enforcement points, one source of truth.

5. **Message catalog (V1):**
   | Direction | Type | Payload | Purpose |
   |---|---|---|---|
   | child→host | `child:ready` | `{}` | handshake beacon (repeated until `hello` arrives) |
   | host→child | `host:hello` | `{ hostKind, context }` | identifies the host, delivers initial context |
   | child→host | `child:hello-ack` | `{ version, authenticated }` | completes handshake |
   | host→child | `host:context` | `{ context }` | context updates (user switched table/view/tab) |
   | child→host | `child:resize` | `{ height }` | content height; hosts with fixed viewports ignore it |
   | child→host | `child:open-external` | `{ url }` | ask the host to open a top-level tab (sign-in, upgrade, docs) — url MUST be same-origin with the Baseout app or an allowlisted marketing origin |
   | child→host | `child:status` | `{ authenticated }` | auth-state changes after handshake |

   `EmbedContext`: `{ host: 'airtable-data' | 'airtable-interface' | 'chrome', baseId?, tableId?, viewId?, pageId?, recordId?, url? }` — Airtable IDs verbatim; every field optional except `host` (a Chrome host on a non-Airtable tab sends only `host` + `url`).

6. **Embed entry is explicit: `/embed?host=<kind>`.** Wrappers always load this route; it boots the child bridge, then client-navigates once context arrives. In-iframe detection (`window.self !== window.top`) is a *signal* for layout, not the mechanism — an explicit entry point keeps standalone behavior untouched and gives the bridge a deterministic boot site. Embed-mode persists across client navigation via the `$embedContext` nanostore (session-scoped), not via query-param threading.

7. **`frame-ancestors 'self' <allowlist>` on every HTML response** — not just `/embed`. Once framed, every in-iframe navigation response needs the header or the browser blanks the frame mid-session. Sending it globally is also a hardening win: today the app sends nothing, meaning any site may frame any Baseout page (clickjacking surface). No `X-Frame-Options` (CSP supersedes it; XFO has no allowlist form).

8. **Context → navigation mapping is a pure function.** `resolveEmbedRoute(context, spaces)` → route string: `baseId` matched against the Spaces' backup-configured bases → that Space's base detail surface; base not found → Space list with a "this base isn't backed up" affordance; no `baseId` → dashboard. Table/view/page ids ride into the store for surfaces that can use them. Pure + unit-tested; the bootstrap just applies its output.

9. **Auth in the iframe: `SameSite=None; Secure` + top-level fallback.** The session cookie switches to `SameSite=None; Secure` (better-auth `advanced.defaultCookieAttributes`) so embedded Chromium sends it. Safari/Firefox block third-party cookies regardless of attributes — there the embed entry detects no session and renders a minimal prompt whose action sends `child:open-external` with the standalone sign-in URL; after top-level sign-in, Chromium iframes have the session on reload, and Safari users get a documented "Storage Access API" enhancement as V2. Alternatives rejected: token-in-URL handoff (leaks via referrer/history, new attack surface), silent OAuth popup (blocked popups, more moving parts). **Security review points (§3.3):** `SameSite=None` removes Lax's incidental CSRF shield — acceptable because better-auth's CSRF protection does not rely on SameSite and all mutating routes already pass through it; the OAuth-callback middleware path (which exists *because* Lax cookies go missing cross-site, see middleware.ts comments) is unaffected and slightly less needed; `Secure` is already required. No new redirect URIs (sign-in is always top-level) — oauth-setup.md consulted, no update needed.

10. **No sensitive payloads in the protocol, ever.** Messages carry Airtable entity IDs and booleans only — no tokens, no emails, no record data. The host learns `authenticated: true/false` and nothing else about the session. This keeps a compromised/spoofed host capped at learning IDs it already knows (it supplied them).

## Risks / Trade-offs

- [Extension origins change under us (Airtable moves off `airtableblocks.com`)] → allowlist is config, not code; ops updates the env var. Handshake failures are counted and visible in the child's console + `child:status` never fires — detectable in wrapper smoke tests.
- [`SameSite=None` on the session cookie weakens CSRF-by-accident] → mitigated per Decision 9; explicitly regression-test one mutating route with a forged cross-site POST in the web integration suite.
- [Global `frame-ancestors` breaks an unknown existing framing consumer] → none known (no header exists today, but also no known framer); staging soak before production.
- [Handshake races (host `hello` before child listener, child `ready` before host listener)] → both sides repeat: child re-beacons `ready` on an interval until `hello`; host re-sends `hello` until `hello-ack`. Idempotent by design; tested with delivery-order permutations.
- [Safari embedded UX is sign-in-in-new-tab every session] → accepted V1 cost; Storage Access API prompt is the V2 path; wrapper docs set expectations.

## Migration Plan

1. Land `packages/embed-protocol` + web changes together (child side is inert until something frames it).
2. Cookie attribute change deploys with a session-invalidation note: existing `Lax` cookies remain valid (attributes apply on set), rolling naturally.
3. Staging smoke: frame `/embed` from a local test harness page on an allowlisted origin; verify handshake, context navigation, header presence, and the forged-POST CSRF regression.
4. Rollback: revert web deploy (header + cookie attributes revert on next set); the package is inert without consumers.

## Open Questions

| # | Question | Default answer |
|---|---|---|
| Q1 | Should embedded mode hide the full app nav (kiosk-style single surface) or keep it? | Keep app nav, hide marketing chrome only; revisit per-host after first real usage. |
| Q2 | Do we need `host:navigate` (host-driven deep links beyond context)? | Not in V1 — `host:context` updates cover the known cases; additive later. |
| Q3 | Storage Access API prompt for Safari | V2; requires user-gesture plumbing in the embed entry. |
