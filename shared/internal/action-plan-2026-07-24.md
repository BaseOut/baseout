# Action Plan — Jul 24 Sync (Dan/Autumn)

Meeting-notes → actions, grounded in repo state as of 2026-07-24 (branch `autumn/june-ui-refactor`). Companion to [questions-2026-07-20.md](questions-2026-07-20.md); per-item owners and sources cited. Items landed the same day as this doc are marked ✅.

## 1. Airtable OAuth connection limits (incident, self-resolved)

**What happened:** Dan's Airtable account maxed out its allowed OAuth connections, causing app errors on Connect; the problem cleared on its own as older grants expired. This is an **Airtable-side per-user grant limit** — distinct from our own dead-connection handling (`pending_reauth` grace → auto-invalidate, `openspec/changes/server-cron-dead-connection-cadence/`), which manages our rows, not Airtable's grant slots.

- ✅ **Document the failure mode** — row added to [oauth-setup.md §8](oauth-setup.md) (same-change rule per CLAUDE.md §3.7) so the symptom is recognizable next time.
- [ ] **Investigate proactive grant revocation** (Autumn/Claude): when a Connection is disconnected or marked `invalid`, we only flip our row — the Airtable grant slot stays consumed until it expires. Check whether Airtable's OAuth supports token/grant revocation and whether disconnect should call it. Small server/web change if so; file after the check.
- [ ] **Reproduce the limit** on the new test workspaces (§4) to learn the actual cap + exact error shape, so we can surface a friendly message instead of a generic Connect failure.

## 2. Automations + comments backup (specced ✅)

Airtable's MCP server recently added **automations support** — this partially falsifies PRD §2.9's "Automations … cannot be automatically backed up" premise (manual intake only). Comments were never covered anywhere. Four paired changes filed today:

| Change | What |
|---|---|
| [`server-mcp-automations`](../../openspec/changes/server-mcp-automations/proposal.md) | Persist/diff MCP-captured automations into per-Space `bo_at_automations` + changelog; reconcile with manual intake. Lands first (owns the wire contract). |
| [`workflows-mcp-automations`](../../openspec/changes/workflows-mcp-automations/proposal.md) | Capture step in `backup-base` reusing the proven `mcp-client.ts` (spike gates: tool name/envelope/scopes unverified for the new automations tool). |
| [`server-comments`](../../openspec/changes/server-comments/proposal.md) | New `comments-sync` internal route + per-Space `bo_at_comments` with edit/delete visibility; retention rides record retention. Lands first. |
| [`workflows-comments`](../../openspec/changes/workflows-comments/proposal.md) | REST comment capture with commentCount-driven fan-out (spike gates `recordMetadata=commentCount`). |

Notable: `data.recordComments:read` is **already in the OAuth grant** ([apps/web/src/lib/airtable/config.ts](../../apps/web/src/lib/airtable/config.ts)) — comments need no re-consent. The MCP interface-pages spike (2026-07-14) already proved the standard grant authenticates against `mcp.airtable.com`.

**Status (same day):** the automations pair is **BUILT** — spike re-ran `tools/list` (41 tools now; `list_automations`/`get_automation` accepted with the standard grant), both halves implemented + tested (server: 21 new tests; workflows: 20 new, suite 297 green). Two findings: `bo_at_automations` already existed with a wired changelog reader (**no migration needed** — the `system-per-space-db` sequencing concern is moot), and V1 captures `list_automations` only (`get_automation` fan-out deferred). Remaining: seed an automation on a test-workspace base (§4) → dev deploy (held while another session's per-Space work is in-flight on the tree) → smoke.mjs + E2E. The comments pair remains **spec-only, blocked on task 0.1** (PRD/Features amendment §6 + Dan's tier decision).

- [ ] **Dan:** tier decision for comment backup (recommendation in `server-comments` design: ride the record-backup tier). Blocks implementation, not further speccing.
- [ ] **Sequencing:** both server changes build atop the in-flight `system-per-space-db` migration machinery on this branch — coordinate per-Space schema-version bumps at implementation time.
- [ ] **PRD/Features amendment** — see §6.

## 3. Digital asset management (DAM) interface for media — needs definition

Discussed, not committed. Backend raw material exists (attachment backup + dedup: `openspec/changes/server-attachments/`, `workflows-attachments`); **no browsing/media UI exists anywhere** and nothing DAM-shaped is in the PRD. Before filing a change, resolve:

1. **Scope:** browse/preview backed-up attachments per Space (modest, backup-adjacent) vs. a real DAM (tagging, search, collections — a product pillar, PRD-level decision).
2. **Tier gating** + where it sits in the Space-view IA (PRD §6/§469 tab list has no Media tab).
3. **Relationship to the attachment dedup store** — serving previews means a read path over stored attachment blobs (local-fs today, R2/BYOS per `system-r2-launch`); egress and auth for blob reads need design.
4. **Naming** per Features §1 before any code.

- [ ] **Dan:** answer 1–2 (product scope + tier) → then Autumn/Claude file `web-media-…`/`server-…` change(s) accordingly.

## 4. Dedicated Airtable test/demo workspaces

Agreed at the sync; nothing exists in-repo about test workspaces today.

- [ ] **Dan (or Autumn with the right Airtable account):** create two workspaces — `Baseout Test` (churn freely: automations, comments, interfaces, deletions) and `Baseout Demo` (stable, presentable data).
- [ ] **Autumn/Claude:** connect them to a dev Org (openside.com staff orgs auto-resolve to enterprise capabilities — no manual tier bump needed), then seed: ≥1 automation + commented records + ≥1 interface page (unblocks `workflows-mcp-automations` spike 1.2, `workflows-comments` spike 1.1, and the still-pending mcp-interface-pages "base WITH interfaces" E2E half).
- [ ] Consider a seed script under `scripts/` if hand-seeding proves repetitive; don't pre-build it.

## 5. SOC 2 / Comp AI

Status ledger is [comp-ai-status.md](comp-ai-status.md) (updated today ✅ with the items below):

- [ ] **Audit partner selection (Dan/boss):** two audit partners met; decide which to proceed with. Decision inputs worth capturing when comparing: price, Type I→II timeline, and whether they accept Comp AI evidence exports natively.
- [ ] **2FA / policy-failure error messages (Autumn/Claude):** intermittent errors in the Comp AI portal around two-factor auth and policy checks — capture screenshots + timestamps as they occur and raise with Dustin (Comp AI) rather than debugging blind.
- [ ] **Question tracking:** meeting floated Google Docs/Sheets. The repo already keeps [comp-ai-onboarding-questions.md](comp-ai-onboarding-questions.md) as the running list — proposal: keep the repo file canonical, mirror to a Sheet for the boss/auditor call rather than forking the list. (Needs a one-word OK from Dan.)
- [ ] **Required software downloads (device agent) + employee security-training modules:** both are roster-scoped rollouts — still blocked on the employee roster (known blocker #1 in the status doc). Once the roster lands, assign training + device-agent install per person.
- [ ] **Evidence collection + policy drafting:** continue as owned (Autumn/Claude) — unchanged from the Jul 16 plan.

## 6. Weekend documentation / spec updates

Committed at the sync (Speaker 1 → updates for Baseout and OKB):

- [ ] **Baseout PRD §2.9:** amend the collection-method table — Automations: "Manual (user-submitted via intake)" → "MCP capture + manual intake"; **add a Comments row** (REST API; tier from Dan's §2 decision). Resolve or re-flag the §2.9-vs-Features-§4.2 tier discrepancy while in there (already flagged in `server-automations-interfaces-docs`).
- [ ] **Baseout Features:** capability-matrix + naming-dictionary entries for comment backup (canonical name needed before any code per §1) and the automations collection-method note.
- [ ] **OKB:** out of this repo (per the Jul 15 sync note) — tracked here only as an external commitment; no in-repo action.
