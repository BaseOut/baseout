## Status

IN PROGRESS — local app tree is in the workspace (`apps/support`, `pnpm dev:support`). Phases 1–4 content is present and locally runnable. **Phase 5 remains blocked on DNS + D1/KV provision + PUBLIC_SUPPORT_URL on the web Worker.** Help in apps/web now offers a Help Center CTA when that var is set.

Governance exception (Starlight overrides vs the two-tier UI rule) needs sign-off before treating this as shipped — see [`proposal.md`](./proposal.md).

Supersedes the reference-only import at [`support-portal`](../support-portal/) (fork research notes, `986f6c09`).

---

## 1. App scaffold + brand bridge

- [x] 1.1 `brand/baseout-bridge.css` present at repo `brand/baseout-bridge.css`.
- [x] 1.2 `apps/support/package.json` (`@baseout/support`, astro `^6.1.2`, `@astrojs/starlight@^0.40.0`, wrangler, dev port 4342).
- [x] 1.3 `apps/support/astro.config.mjs` present with Starlight slot overrides + job-organised sidebar + `/submit`→`/contact`, `/tickets`→`/contact`.
- [x] 1.4 `wrangler.jsonc.example` + live `wrangler.jsonc`. D1 + KV bindings declared and commented until provisioned.
- [x] 1.5 Root `dev:support` script exists. `pnpm install` resolves `@baseout/support`.
- [x] 1.6 `astro.config.mjs` `site` is `https://support.baseout.com` (single source of truth). DNS not live until Phase 5.

## 2. Docs surface

- [x] 2.1 `src/content/`, `src/content.config.ts`, and `src/styles/support.css` are in the tree.
- [x] 2.2 Starlight override components are in `src/components/` (Header, SiteTitle, SupportHero, Search, PageSidebar, DocsFooter, DraftBanner, BrandMark, Icon, StatusBadge).
- [x] 2.3 `public/images/` + `public/screens/` present.
- [ ] 2.4 Page feedback UI is present; persistence sink is still write-nowhere until D1. Do not claim ratings persist.
- [x] 2.5 Pagefind search builds against the imported corpus (`pnpm --filter @baseout/support build` — 120 HTML files indexed).
- [x] 2.6 Troubleshooting is its own docs section (not buried under backups).

## 3. Chat shell (responder stubbed)

- [x] 3.1 `ChatDock.astro` + `lib/{chat-core,chat-panel,chat-resize}.ts` present.
- [ ] 3.2 KV-backed anonymous message budget keyed on session cookie + IP hash. **Blocked on Phase 5 KV provision.**
- [x] 3.3 Out-of-budget copy points at `/contact` (redirect from `/tickets` exists).
- [x] 3.4 Stubbed responder says it is not yet answering (`chat-core.ts`: "this is not an answer yet") and cites real Pagefind hits.

## 4. Requests board + contact door

- [x] 4.1 Roadmap, contact, and request-board pages + libs are in the tree.
- [ ] 4.2 D1 schema for requests + votes — **blocked on Phase 5 provision.** Local voting is fixture/cookie-only.
- [ ] 4.3 Vote dedupe against D1 — blocked on 4.2.
- [x] 4.4 Duplicate-finding search helpers present (`lib/questions.ts` / board search).
- [ ] 4.5 Landing variant switch: keep or delete — not decided.
- [ ] 4.6 Server-side validation + rate-limit on create/vote — blocked on D1 handlers.

## 5. ⛔ GO-LIVE — DNS + Worker bindings. Help CTAs retarget when `PUBLIC_SUPPORT_URL` is set.

Client #6 is answered for product purposes: the Help Center **is** `apps/support` at `support.baseout.com`. Remaining go-live is infra (D1, KV, DNS, deploy), not "does a channel exist."

- [ ] 5.1 Provision the D1 database + KV namespace; uncomment the bindings; deploy `baseout-support`.
- [ ] 5.2 DNS for `support.baseout.com`.
- [x] 5.3 **apps/web:** `/help` offers "Open Help Center" when `PUBLIC_SUPPORT_URL` is set (mailto remains). Sidebar still lands on `/help` so deploys without the var stay a working door. Do not delete `/help` until DNS is live.
- [ ] 5.4 Status page: omit until one exists.

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
