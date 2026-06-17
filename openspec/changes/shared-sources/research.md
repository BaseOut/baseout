# Research — account-level Sources (what to build, what not, Airtable feasibility)

Three-agent pass (2026-06-11): data-tool source patterns, Airtable API feasibility (Context7 + docs), Mobbin UI. This is the build-decision doc for the Sources page.

## Model — validated
A **Source = a first-class, reusable account-level object** with its own list + detail page, referenced by N Spaces. This is the Airbyte / Fivetran / Census / Estuary camp (the founder's reference). Avoid the Stitch / Hevo model where source == pipeline (no reuse). The founder's "Sources page + per-Space usage table" maps exactly onto **Airbyte's source detail listing the connections that use it** (issue #582), and on **Retool's `Usage (N)` tab** (a table of everything using a resource).

## What we BUILD
- **Sources registry** in account Settings (next to Destinations, mirror `DestinationsView`). Columns: **Name · Account (Airtable email/id) · Status · In use by (N Spaces) · Bases available**. "Add source" button; a broken-source alert at top.
- **Source detail page** = identity + a **table of the Spaces using this source** (the founder's key ask). Spaces table columns: **Space · # bases · Destination(s) · Schedule · Last backup · Status**, each row → that Space. Plus **Reconnect** (independent of any Space, fans out to all), **Refresh bases** (poll for new), and **Remove** (guarded while in use).
- **Add-source flow**: type is fixed (Airtable, V1) → choose **OAuth or Personal Access Token** → name it → **Test & Create**. A source that isn't authorized yet lands as **"Needs connection"** (reuse the destinations lifecycle); managed/connected otherwise.
- **Multiple Airtable sources** per account, distinguished by **name + authorized account email**; each Space uses exactly one (founder).
- **Reconnect in two places**: list-level red "Reconnect" status + detail-level "Action required" banner + Re-authenticate CTA. One re-auth heals every Space using it.
- **Disconnect/remove states the blast radius** ("used by N Spaces") and prefers Edit-credential over delete.

## What we DON'T build (now)
- No node/graph dependency view — the founder asked for a **table** (and it fits the Linear/Vercel density). Avoid canvas.
- No marketplace/discovery wall — Airtable-only V1; the registry table is the hero.
- No used-by list / heavy config inside a modal as the primary surface — detail lives on a dedicated route.
- No source-level webhooks / real-time health (see feasibility).
- Multi-source-per-Space, org-vs-personal split, "Default" source — deferred (founder: "may evolve to be more complex over time").

## Airtable feasibility — what works / what doesn't (strict)
Assumes Baseout's confirmed grant = `data.records:read` + `schema.bases:read`.

**OBTAINABLE (safe to show):**
| Field | Endpoint / source |
|---|---|
| Airtable **user id** of the auth | `GET /v0/meta/whoami` |
| Owner **email** | `whoami` — **only if** `user.email:read` is requested (else only the `usr…` id) |
| **Auth type** (OAuth / PAT) | Baseout-internal (known at connect) |
| **# bases available** | `GET /v0/meta/bases` (paginated, count) |
| **Base list** (id, name, permission level) | `GET /v0/meta/bases` |
| Tables + fields (config, not the Source list) | `GET /v0/meta/bases/{id}/tables` |
| Per-Space usage meta (# bases, schedule, destinations, last backup, status) | **Baseout's own data** — fully available |
| OAuth token facts (access 60 min / refresh 60 days) | `oauth-reference` (advisory copy) |

**NOT OBTAINABLE (omit, or render "—"/"Not available from Airtable" — never fabricate):**
- Workspace / organization **grouping** (needs `workspacesAndBases:read`, not granted; true grouping = Enterprise Admin API)
- Org / account **name**, **billing / plan tier**
- Per-base **record counts**, **base size**, **last-activity / last-modified**, **collaborator counts**

**Important constraints for the UI:**
- **Status is "last-known-good", not live.** There is **no introspection endpoint and no revocation webhook** — Baseout only learns a source broke on the next `401` / `invalid_grant`. So tie the status chip to a **"last checked"** timestamp; don't imply continuous verification.
- **New-base detection is poll-only** (diff successive `meta/bases`); there is **no "base created" account event**. Copy: "Re-checked Airtable — N new base(s)", never real-time.
- **PAT scopes/resources are invisible** to the API — for a PAT source we can show the bases it resolves, not the token's config.
- **Engineer flag:** confirm whether the OAuth integration requests `user.email:read` (for a humane identity) — and that adding `workspacesAndBases:read` is the only path to ever showing workspace/collaborators (currently NOT requested → those stay out).

## UI patterns to steal (Mobbin, cited)
- Detail = **Details-rail + `Usage (N)` tab with a table** — [Retool](https://mobbin.com/screens/0be504bf-1e97-4f21-8b17-bdf61f09b4a3) (best analog), [Customer.io source detail](https://mobbin.com/screens/3aa98054-9243-4e7d-8d42-dc3af37e09e5), [Sana detail+summary card](https://mobbin.com/screens/cb148035-69d7-4c1b-ada8-a845fd5ef540).
- Per-row meta in the used-by table (last synced / ran) — [Airtable "Dependencies" panel](https://mobbin.com/screens/523d5712-3290-49ed-95b3-d37c8841db06) (same vendor).
- Registry table + used-by count — [Sana connected integrations](https://mobbin.com/screens/a8025776-b634-4667-a77c-6fa9b6638794), [Lindy `Used by` column](https://mobbin.com/screens/14e12711-0275-4fd3-af76-5d1b4ed83108).
- Add-source stepper + Test & Create + failure/retry — [Equals](https://mobbin.com/flows/014ff936-86b0-44aa-9316-fafbe9d522ed), [Steep](https://mobbin.com/flows/58e0b2a3-c944-482f-acb8-f8a0fc6a3e9d).
- Reconnect: list "Needs to be reconnected" ([Sana](https://mobbin.com/screens/0a4b2c9c-2e6c-4c8e-b773-4f67555a124c)) + detail "Action Required" + Re-Authenticate ([Klaviyo](https://mobbin.com/screens/d093ed4b-a5c5-464e-8e65-4628ef3939a3)).
- Multiple accounts by email + plan-cap — [Attio](https://mobbin.com/screens/822de670-3309-47d2-b073-e5c16e206cf0).
- Honest "may be additional uses you can't see" disclaimer — [Okta](https://mobbin.com/screens/8c75a2d6-bec3-4581-b9f4-c09f558f9d9a).

## Status vocabulary (small, Fivetran-style)
**Connected · Reconnect required · Needs connection** (a just-added, not-yet-authorized source). Red only for auth-broken; tie to "last checked".
