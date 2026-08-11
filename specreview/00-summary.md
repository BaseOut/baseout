## TL;DR — Where the two apps stand

> **Note (2026-05-13 update):** the pulled OpenSpec changes have moved several of the "decisions needed" items below. Read [05-update-2026-05-13b.md](./05-update-2026-05-13b.md) for the delta. The four decisions are revised at the bottom of this file.



### apps/server (backup/restore engine)

Scaffold + first cron + service-binding receiver are in. Real backup engine is **not yet built**. Recent shipped work: schema mirrors, INTERNAL_TOKEN gate, `whoami` probe, OAuth-refresh cron (Phases 1-5 done, staging verify pending), DO stubs, trigger.dev client + `backup-base` task scaffold.

**Next big block:** Phase 1 of `baseout-backup` proposal — Airtable client + schema discovery + record fetch + R2 stream + trial cap + `backup_runs` lifecycle.

### apps/web (Astro SSR customer app)

Ported from `baseout-starter` HEAD `29dfb5b` with engine wiring stripped. ~60% of v1 capabilities are partial-or-shipped on the **UI surface**; ~40% are deferred until `apps/server` gets further along (Run-Now, WebSocket progress, AI docs, BYOS storage, full Stripe, schema viz, restore UI).

**Recent shipped (autumn/server-setup branch):**
- Backup history live status (polling + ClientRouter lifecycle re-arm)
- Top-level `/backups` page with SSR run history
- Space-switch interior re-render via ClientRouter
- Live progress counter + 2s polling

### Decisions the user needs to make

1. **Spec drift on `baseout-backup`.** The proposal targets six independent Workers (`backup`, `webhook-ingestion`, `inbound-api`, `sql-rest-api`, `admin`, `web`). Reality per `CLAUDE.md` is two Workers (`apps/web` + `apps/server`, with `server` absorbing the backup engine, webhook-ingestion, inbound-api, cron). The proposal text needs rewrite — or break into smaller change-folders that match `apps/server`'s actual surface.
2. **Sequence for the next push.** The implementation plan + STATUS imply: build server backup MVP → wire web Run-Now → WebSocket progress → BYOS. Confirm or re-order.
3. **`web-client-isolation` adoption depth.** Whoami probe goes through service binding today. WebSocket / Run-Now / data-read proxies are still pending. Confirm we still want browser → only-`apps/web` → server, vs. accepting direct browser→server WebSocket as a shortcut.
4. **Migration package `@baseout/db-schema`.** Schema lives mirrored across both apps today (canonical owner = web). Extraction is gated on a second consumer (server) actually needing it — that's now. Extract before or after backup MVP?

See `04-recommendations.md` for the proposed answers.

## Revised decision points (post-2026-05-13 pull)

1. **Spec drift on `baseout-backup`** — partly resolved by the 9 new per-capability proposals targeting `apps/server` directly. Parent `baseout-backup` proposal should be marked superseded. The two-Worker collapse is now implicit in every new proposal.
2. **Sequence for the next push** — the new proposals enumerate the order. Open call: which to implement first. Recommend `trial-quota-enforcement` (small, mostly web, unlocks credit chain) OR the real Airtable record-fetch path (the missing Phase 1 of original `baseout-backup`).
3. **`web-client-isolation` adoption** — unchanged; archive as accepted-principle before Run-Now / WebSocket land.
4. **`@baseout/db-schema` extraction** — pressure increasing; migrations 0006 + 0007 added two more rows to the mirror.

### New decisions surfaced by the pulled changes

5. **R2 stays gone or returns?** Commit `8fc1f61` removed every R2 binding from `apps/server`. `attachments`, `byos-destinations`, and `retention-and-cleanup` proposals still assume R2 exists. Reconcile before any of those start implementation.
6. **`apps/hooks` + `apps/api` bootstrap timing.** Instant-webhook needs `apps/hooks`; automations needs `apps/api`. Both are skeleton stubs. File `baseout-hooks-bootstrap` + `baseout-api-bootstrap` ahead of those features.
7. **Email transport choice.** Three values referenced across specs: `baseout-backup` says Mailgun, `baseout-web/STATUS.md` says Resend, **actual code uses Cloudflare Email Workers `send_email` binding**. Pick one (recommend Cloudflare Email for MVP) and update the stale spec lines.
