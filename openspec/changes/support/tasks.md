## Status

PROPOSED — 0/32. **Phases 1–4 are unblocked and locally verifiable. Phase 5 is BLOCKED on client question #6** (*does a support channel exist at all — address, status page, docs host?*), which has never been put to Dan (`apps/design/audit/CLIENT-QUESTIONS-PENDING.md`).

Governance exception (Starlight overrides vs the two-tier UI rule) needs sign-off before Phase 1 — see [`proposal.md`](./proposal.md).

Supersedes the reference-only import at [`support-portal`](../support-portal/) (fork research notes, `986f6c09`).

---

## 1. App scaffold + brand bridge

- [ ] 1.1 `brand/baseout-bridge.css` promoted verbatim from `ui-only@252005be`. **Keep its header comment intact** — it carries the "never point this at apps/web/src/styles/global.css" warning and the unlayered-on-purpose rationale.
- [ ] 1.2 `apps/support/package.json` (`@baseout/support`, astro `^6.1.2`, `@astrojs/starlight@^0.40.0`, wrangler, dev port 4342). Astro version already in the tree → no pairing risk; Starlight rides the `minimumReleaseAge` gate.
- [ ] 1.3 `apps/support/astro.config.mjs` verbatim (eight Starlight slot overrides + the job-organised sidebar IA + the `/submit`→`/contact`, `/tickets`→`/contact` redirects). **Do not simplify the override list** — each carries a header explaining what Starlight internal it works around.
- [ ] 1.4 `wrangler.jsonc.example` + `scripts/launch.mjs` (render-from-example convention, `wrangler.jsonc` gitignored). D1 + KV bindings **declared and commented until provisioned**.
- [ ] 1.5 Root `dev:support` script alongside its siblings; confirm `pnpm install` resolves and `pnpm --filter @baseout/support build` is green before importing content.
- [ ] 1.6 Decide `support.baseout.com` vs `.dev` (proposal open question 2 — the fork's own files disagree) and make `astro.config.mjs` `site` the single source of truth. Recommend `.com`.

## 2. Docs surface

- [ ] 2.1 Import `src/content/`, `src/content.config.ts`, and `src/styles/support.css` verbatim.
- [ ] 2.2 Import the Starlight override components verbatim: `Header`, `SiteTitle`, `SupportHero`, `Search`, `PageSidebar`, `DocsFooter`, `DraftBanner`, `BrandMark`, `Icon`, `StatusBadge`.
- [ ] 2.3 Import `public/images/` + `public/screens/` (14 binaries). **These DO cross** — unlike `research/**/shots/*.png` on the never-sync list, they are app assets the pages render. A missing picture is still a 200, so a render gate that only checks status codes will not catch a broken one (fork commit `4f20d184`).
- [ ] 2.4 Page feedback: `PageFeedback.astro` + `lib/page-feedback.ts`. Decide its sink — D1 table vs write-nowhere-yet. A rating widget that discards the rating is a lie; if there is no sink, do not ship the widget.
- [ ] 2.5 Pagefind search builds and returns results against the imported corpus (`lib/pagefind.ts`, `lib/search-modal.ts`).
- [ ] 2.6 Verify the docs IA renders in the fork's order — Troubleshooting reachable without scrolling past forty backup pages (fork commit `7c465110` exists because it was not).

## 3. Chat shell (responder stubbed)

- [ ] 3.1 Import `ChatDock.astro` + `lib/{chat-core,chat-panel,chat-resize}.ts` verbatim. One home only — the fork split it into two and had to merge them back (`3cd3d618`).
- [ ] 3.2 KV-backed anonymous message budget keyed on session cookie + IP hash. **Speed-bump, not a trust boundary** — document that at the call site; store no PII.
- [ ] 3.3 Out-of-budget affordance → "sign in to keep chatting", pointing at apps/web login. Out-of-messages line points at `/contact`, not `/tickets` (the redirect exists, but the copy should name the real destination).
- [ ] 3.4 Stubbed responder **says it is not yet answering.** It must not emit a plausible non-answer (design D3).

## 4. Requests board + contact door

- [ ] 4.1 Import `roadmap.astro`, `roadmap/[slug].astro`, `contact.astro`, `chat.astro`, `tickets.astro` + `lib/{board,rows,votes,questions,recent,status,submit,landing,landing-switch,toc-collapse,icons}.ts` + `data/requests.ts` verbatim.
- [ ] 4.2 D1 schema for requests + votes; migration in `apps/support`'s own drizzle/SQL (this app owns its storage — design D1; it does **not** touch the master DB or `packages/db-schema`).
- [ ] 4.3 Vote dedupe = cookie + IP hash, **best-effort and not a trust boundary** (§3.3 security callout). One vote per visitor per request; must not gate anything of value.
- [ ] 4.4 Duplicate-finding search that does not require every word at once (`a3b84773`).
- [ ] 4.5 Landing: keep the fork's cut of the A/B/C variants (each pair differs by exactly one thing — `98909a8a`); pick ONE for launch and delete the switch, or keep the switch behind a query param and say so.
- [ ] 4.6 Server-side validation on the request-create and vote handlers (§3.3 — client validation is UX, not security). Rate-limit both.

## 5. ⛔ GO-LIVE — BLOCKED on client #6. Do not start until answered.

- [ ] 5.1 Provision the D1 database + KV namespace; uncomment the bindings; deploy `baseout-support`.
- [ ] 5.2 DNS for the chosen hostname.
- [ ] 5.3 **apps/web:** retarget the eleven support CTAs at the portal (audit `S32-F2`, ship-order item 20 — one line each) and retire `pages/help.astro` + the **Help Center** nav entry in `app-config.json`. Reconcile with the existing [`web-support-bridge`](../web-support-bridge/) change rather than filing a third. **This is the only apps/web edit in this change** — if it lands separately it is a `web-*` follow-up, not a widening of this umbrella (design D4).
- [ ] 5.4 Status page: link it if one exists, omit the affordance if not. Do not ship a link to a page that does not exist.

## 6. Deferred pairings — file, do not build

- [ ] 6.1 File the **cross-domain auth bridge** change (verify an apps/web session from the portal so tickets can be per-customer). Touches apps/web + apps/support ⇒ `shared-*` prefix per §3.6. Real session verification, never a spoofable header.
- [ ] 6.2 File the **chat engine** change (doc-corpus indexing, model calls, hard limits, the first secret this app needs — via Cloudflare Secrets, never a committed `.dev.vars`).

## 7. Verification

- [ ] 7.1 `pnpm --filter @baseout/support build` + `typecheck` green; `pnpm build` at root still green (no workspace regression).
- [ ] 7.2 Demo: `pnpm dev:support` → `http://localhost:4342` → docs render on-brand in **both** themes, search returns results, a doc page's feedback control works, `/roadmap` lists requests and a vote persists, `/submit` and `/tickets` both 301 to `/contact`.
- [ ] 7.3 Assets: every imported screenshot actually paints (task 2.3 — a broken image is still a 200).
- [ ] 7.4 Mobile at <375 / <768 / <1024, including the chat drawer and the board's 235px column (`8cd2b7d1` exists because a full-width pattern was copied into it).
- [ ] 7.5 No stray `console.*` / `debugger` (§3.5). No secrets committed. Confirm nothing in this app reads the master DB.
- [ ] 7.6 Update `shared/internal/ui-sync.md` §3 (sync row for `252005be`) + §4 (new support row) and retire the "reference only" note in [`support-portal/README-IMPORT.md`](../support-portal/README-IMPORT.md) — same change (§3.7).
