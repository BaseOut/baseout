# Questions / Items Needing Resolution — 2026-07-20

The meeting-assigned list ("when I get finished with that, I'll go through and create a list of stuff that we need to figure out how we want to address" — Dan/Autumn sync, Jul 20). Grouped by who unblocks it. Sources cited per item.

## A. Product/spec decisions (Dan)

1. **Disposition of the `api` (inbound write API) change.** Under review since 2026-07-18 (`openspec/changes/api-rest-read/proposal.md` "What Changes"): its one-token-per-Space model is superseded by `api-rest-read`'s org-owned/Space-nullable tokens, and the owner note says ingestion likely belongs with `apps/hooks`-style patterns rather than `apps/api`. Decide: re-scope onto the new token model, fold into a future ingestion app, or archive until the write API is scheduled. Its tier rate limits + credit debiting also depend on pricing finalization (same blocker as item 3).
2. **`api_tokens` CRUD UI has no filed change.** `api-rest-read` assigns token create/revoke (plaintext-once display) to `apps/web`, but no `web-api-tokens` change exists under `openspec/changes/`. Without it the public API is unusable by customers. File it (small: settings page + POST/DELETE routes + hash-at-rest per PRD §21.3)? Sequencing: needed before `api-rest-read` ships publicly, not before implementation starts.
3. **Rate-limit tiers / quotas for the public API.** `api-rest-read` deliberately ships shadow-mode only ("tier quotas and blocking are deferred until plans/tiers are finalized"). Confirm the quota numbers land in `Baseout_Features.md` (per the §5.5 metadata-gating rule) before enforcement flips on. Same question covers the webhook **polling cadence per tier** (`airtable-webhook-polling` capability, `346fe46`).
4. **MCP for the claude.ai connector directory.** `api-mcp` defers OAuth 2.1 + dynamic client registration; bearer-header config works for Claude Code/Desktop/Cursor but NOT the claude.ai connector directory. Is directory listing a launch goal (pulls OAuth forward) or a fast-follow?
5. **Embed messaging phase 2 scope.** Transcript: "this phase is just to be able to get it to load. And then we'll implement the messaging and what we want it to do next." The load-only phase is code-complete (`embed` 10/14). Phase 2 per Dan's demo = shell proxies base schema + Airtable user identity → auto-login on email match → auto-create backup with the current base. Needs its own openspec change — file now or after the load smokes pass?
6. **Auto-login trust model (security-critical, decide before phase 2).** The auto-login flow treats "Airtable says this user has email X" as an authentication assertion. The message arrives from the host page — for the Airtable extensions the shell reads identity via Airtable's SDK, but the iframe cannot distinguish a genuine shell from a malicious page replaying the protocol unless the assertion is attestable. Origin-locking (in `packages/embed-protocol`) covers the Chrome-extension origin; Airtable-hosted extensions run on Airtable origins shared with *other* people's custom extensions. Proposal needed: signed handoff (shell fetches a short-lived token from our backend using its own credentials) vs. email-match auto-login limited to *linking* with an explicit confirm click. Flag per CLAUDE.md §3.3 (new auth path ⇒ explicit security review).
7. **Interfaces normalize open questions** (`server-interfaces-normalize/design.md` Q1/Q3): confirm the default that interface page listings UNION `bo_at_pages` + `bo_at_forms` (no stub rows), and whether `get_form_schema` exposes required/order — needs one sample capture against a real base to settle `bo_at_form_fields` shape.

## B. External access / accounts (Dan or boss)

8. **Public hostnames.** `api.baseout.com`, `hooks.baseout.com`, `docs.baseout.com` route bindings + DNS need Cloudflare dashboard access before either Worker can go public. Also decide the docs-hosting pipeline (OpenAPI publication target).
9. **Extension publication + test access.** Chrome Web Store developer account; Airtable extension developer access (needed even for the `block run` dev smoke on the two Airtable wrappers). Who owns these accounts? (Blocks `embed` tasks 11–14.)
10. **Comp AI (SOC 2/GDPR) blockers** (`shared/internal/comp-ai-status.md`): GitHub + Google Workspace integrations need boss/IT OAuth; People tab blocked on the employee roster; Dustin (Comp AI) expert call to schedule. Await Dan's auditor intro-call update (call is Jul 21; Autumn not needed on it).

## C. Engineering follow-ups surfaced by the spec review (Autumn/Claude, no decision needed — listed for visibility)

11. **`airtable_webhooks` table sequencing.** `hooks` needs the table (canonical migration owned by `apps/web`, specced in `server-instant-webhook` Phase A) before the receiver can land. Build order across the 5-change webhook suite: web migration (Phase A) → `hooks` receiver → `server-instant-webhook` polling → `workflows-instant-webhook` → `server-cron-webhook-renewal`.
12. **CLAUDE.md overstates shipped controls** (from `comp-ai-evidence-pack.md`): claims a pre-commit hook, an `api_tokens` table, and full auth/billing audit logging that don't exist in code yet. `api-rest-read` finally creates `api_tokens`; the audit-log gap (CC7.2, P0) and the doc corrections still need owners.
13. **Trigger.dev CLI version skew** in `apps/workflows/package.json`: dev script bumped to 4.5.1 while the deploy line stays 4.4.6 — align when next touching workflows.

## D. Resolved since the sync (no action)

- ~~Read-only REST + MCP sequencing~~ — confirmed in specs: `api-mcp` hard-depends on `api-rest-read`'s operation registry; REST first.
- ~~Forms scope~~ — backend storage only, no UI (meeting decision, matches `server-interfaces-normalize` non-goals).
- ~~server-interfaces-normalize + server-rest-read-support~~ — both completed 14/14 / all-checked on `autumn/june-ui-refactor` today (`32d5a86` + working tree).
