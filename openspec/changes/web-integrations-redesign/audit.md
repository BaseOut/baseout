# Integrations redesign — conformance audit (2026-06-09)

Cross-check of **what the client/spec asked for** vs **what is built** in the redesign
(`IntegrationsView.redesign.astro`, `IntegrationsConfigureView.astro`, the harness
`apps/design/src/pages/integrations*`). Sources: `specs/integrations/spec.md`,
`design.md` (deltas + open questions), product-model notes, and the live client decisions.

Legend: ✅ done · 🟡 partial · ❌ missing · 🔵 deferred (by decision)

## A. Spec requirements → status

| Requirement / scenario | Status | Note |
|---|---|---|
| **Connect** — No connection yet (focused CTA, read-only promise, no other platform cards) | ✅ | Empty provider card + read-only scope column |
| Connect via OAuth | ✅ | → `/start` → Authorizing → setup |
| Connect via API key | 🟡→✅* | UI present; **harness stub was missing → showed raw JSON. Fixed in this pass** (`/api-key` → setup) |
| Connection succeeds → report N bases | 🟡 | Confirmation exists for `status=connected` but is now **orphaned**: the happy path goes Connect → Configure and never lands on the overview "We found N bases" note. Not surfaced to the user. |
| Connection fails → human-readable reason | ✅ | `errorLabels` map, inline error in the Connect card |
| **Recover** — Reconnect required (pending_reauth, amber, paused) | ✅ | |
| Disconnected (invalid, red, won't run) | ✅ | |
| Refreshing tokens (transient amber, keeps working) | ❌ | Badge logic exists (`statusBadgeMap.refreshing`) but **no fixture/scenario to preview it** |
| **Bases** — importance cues | ✅ | name + tables · records · changed |
| Tier limit visible | ✅ | "N of M allowed" counter |
| Selecting beyond tier limit (block + deselect-N + upgrade) | ✅ | live error, save blocked, blocked rows dimmed + "Upgrade to include" |
| No bases selected → not-protected warning | ✅ | |
| New bases discovered → dismissible banner (auto-added / blocked-by-tier) | ❌ | `state.unreadEvents` exists and was rendered in old/v2, **not rendered in the redesign** |
| **Schedule** — pick frequency | 🟡 | Radio list present; **presentational only** — "Save changes" persists base selection, not frequency |
| Frequency locked by plan (shown locked + upgrade, not hidden) | ✅ | disabled rows + "Upgrade" badge |
| **Destinations** — static | ✅ | R2 + Google Drive (others "coming soon" line) |
| Dynamic | ✅ | Baseout PG / Neon / Supabase / D1 / BYODB |
| Both in parallel | 🟡 | Both sections selectable; the Dynamic "Not set" badge is static text, doesn't reflect a selection |
| Destination needs **authentication + a folder** | 🟡 | **Described in copy only** — no Connect/Authenticate button, no folder picker interaction (static Google Drive); dynamic says "authenticated in a follow-up step" |
| Managed vs bring-your-own clearly distinguished | ✅ | "managed" vs "connect your account" / BYODB |
| **Layers** — schema always / data default / attachments billed opt-in | ✅ | present (presentational) |
| **Run first backup** — run now | ✅ | reframed as "Save & run first backup" at end of setup |
| Run disabled on broken connection | ✅* | enforced by hiding Configure on broken states (Reconnect only), not a disabled Run-with-reason |
| First backup succeeds → "you're protected" summary | ✅ | final `status=running`: "connected, first backup running" + "Protected · bases · schedule · destination" |
| **Status / progressive disclosure** — protected & settled | ✅* | summary + Configure **on a dedicated route** (we pivoted away from inline "Edit settings"/expand-in-place) |
| Connected but not configured (expanded setup) | ✅ | "Finish setup" → setup route |
| Returning user edits one setting | ✅* | route-based edit ("Save changes"), not inline expand |

## B. Gaps & problems (prioritized)

**Critical (functional)**
1. ✅ FIXED THIS PASS — **API-key connect** posted to an unhandled harness stub → browser showed raw `{ok:true}` JSON. Added `/api/connections/airtable/api-key` → `/integrations/configure?first=1` (API key has no OAuth redirect, so it skips the Authorizing screen).

**Notable (asked-for, not built)**
2. ✅ FIXED — **"New bases discovered" banner** added to the redesign overview (reuses `state.unreadEvents`, dismissible; renders both the auto-add hint and the blocked-by-tier "Upgrade" variant).
3. ✅ FIXED — **"Auto-add new bases" toggle** added to Configure → Bases (`policy.autoAddFutureBases`).
4. ✅ FIXED — **Authenticate + pick folder sub-step** now interactive: selecting Google Drive reveals a "Connect Google Drive" button + folder line; selecting BYODB reveals a connection-string field (managed/hosted authenticated in a follow-up step).
5. ✅ FIXED — **Manage-connection** added to Configure: a "Connection" section with Rescan workspace + Disconnect (confirm → back to empty).
6. ✅ FIXED — **Refreshing** state previewable: `FIXTURE_INTEGRATIONS_STATE_REFRESHING` + a Recovery chip; renders amber "Refreshing" badge with the protected summary unchanged.

**Minor / polish**
7. 🟡 "Connection succeeds → reports N bases" not surfaced in the live flow (orphaned overview note). Could move to the Authorizing handoff or the setup header.
8. 🟡 **Reconnect** (broken state) reuses `/start` → lands in first-time setup (`?first=1`) instead of returning a returning user to a healthy overview.
9. 🟡 Schedule / destinations / layers are **presentational** — only base selection is persisted on Save. Acceptable for a design candidate; flag for the engineer.

**Doc drift (our own spec/tasks out of sync with the built reality)**
10. ✅ SYNCED — `spec.md` Requirement renamed "Show protection status, **with configuration on a dedicated route**"; scenarios updated (Configure route, no inline "Edit settings", never "connected" before a valid config).
11. ✅ SYNCED — `tasks.md` rewritten to the built model (deltas + audit follow-ups checked off; route model / walk-the-flow / Authorizing reflected).
12. ✅ SYNCED — `spec.md` "Run the first backup" updated to "Save & run first backup" in setup, progress on the Backups page.

## C. Client asks → status (explicit instructions)

| Client instruction | Status |
|---|---|
| Remove Notion/HubSpot/Salesforce "coming soon" cards | ✅ (redesign shows only Airtable) |
| Backup history NOT on Integrations (lives on Backups) | ✅ removed |
| "Run backup" only contextually (first-time), not always | ✅ now in setup; overview has none |
| No "connected" screen before a valid config exists | ✅ Connect → Authorizing → Setup (no premature connected overview) |
| Redesign is the working default; old screen as "View Old" reference | ✅ |
| Movable scenario panel + per-state legend + collapse | ✅ |
| Intermediate "Authorizing…" screen | ✅ |
| Two connect methods (OAuth + API key) | ✅ (API-key harness now fixed) |
| Static + dynamic destinations in parallel | ✅ |
| Backup layers (schema/data/attachments) | ✅ |
| Plan-locked frequency upgrade affordance | ✅ |
| Open questions raised, not guessed (naming · scope · auto-add default) | ✅ in `design.md` |

## D. Recommended next actions (in order)

1. (done) Fix the API-key harness stub.
2. Add the **"New bases discovered" banner** to the redesign overview (reuse `state.unreadEvents`).
3. Add the **"Auto-add new bases" toggle** (Configure → Bases or a small Connection area) — pairs with the auto-add open question.
4. Add a **manage-connection** affordance: Disconnect + Rescan (and decide where Reconnect-as-escape-hatch lives).
5. Make the **auth + folder** sub-step interactive (at least a "Connect Google Drive" button + a folder line) for the static BYOS path.
6. Add a **Refreshing** fixture + scenario chip.
7. Polish: surface "found N bases" in the flow; fix Reconnect → healthy overview; dynamic "Not set" badge reflects selection.
8. **Sync the OpenSpec docs** to the built model: update `spec.md` Req 7/8 (route model, run-in-setup) and check off `tasks.md`.
