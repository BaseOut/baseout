# Design — api-productionization

> Split posture: this change is HALF buildable now, half Dan-gated. The buildable half
> (D1–D4) ships in this session; the gated half (D5) stays as unchecked tasks with the
> blocking decision named — flipping any of it is config/small-code once Dan answers.

## D1 — Entitlements resolve in apps/api through the same pure rule

apps/api mirrors the entitlement tables read-only (plans, subscriptions, subscription_items,
features, plan_features, account_feature_overrides, addon_catalog, addon_purchases — canonical:
core.ts / migration 0034) and calls the SAME `composeEntitlements` from `@baseout/db-schema`
that web/server/admin use (shared-entitlements D9: one choke point, per-app query halves).
`src/lib/entitlements.ts` exposes `resolveApiPlan(db, orgId, now)` → `{ planSlug,
monthlyCallAllowance, apiAccess, mcpAccess } | null`. Deliberately NOT ported: web's
internal-org enterprise shortcut (that's a console courtesy keyed off staff emails; the public
API reports the org's actual subscription — an internal org without one reads `plan: null`).

## D2 — `get_org.plan` stops lying

The documented follow-up on the org read: `plan` = the resolved plan slug (null when no
active/trialing subscription). No other read changes.

## D3 — Usage surface now, enforcement later

New operation `GET /v1/orgs/{orgId}/api-usage` (scope `org:read`) + MCP tool `get_api_usage`:
`{ plan, monthlyCallAllowance, used, remaining, periodStart, usageAvailable, enforcement }`.
`used` comes from the Analytics Engine dataset via its SQL-over-HTTP API — an OPTIONAL
credential pair (`AE_ACCOUNT_ID` + `AE_API_TOKEN` secrets; the dataset is already written by
the Phase-0 metering). Unconfigured → `usageAvailable: false, used: null` — the same
failure-isolated posture metering itself has. `enforcement: "off"` is hardcoded until D5.
The AE query counts current-calendar-month rows for the org (UTC month = the documented
period until billing anchors are wired).

## D4 — Support-portal API/MCP manual pages

The deliberate template pages under `apps/support/src/content/docs/{api,mcp}/` get real
content: authentication (bearer tokens, the ten scopes, write-scopes warning), the REST
resource map, the MCP endpoint + tool catalog, deep links, and error contract. Run through
the `/support-docs-update` flow (stage + changelog candidate) per the docs-automation program.

## D5 — Dan-gated remainder (tasks stay open, decision named per task)

- Rate-limit enforcement flip + real per-tier numbers (Dan decision #2). Code path exists
  (`RATE_LIMIT_ENFORCE`); this is numbers + config.
- Quota ENFORCEMENT (429 when `used ≥ allowance`) — same decision; the D3 surface makes the
  flip a ~20-line change behind a `QUOTA_ENFORCE` var.
- OAuth 2.1 + DCR + `mcp.baseout.com` — Dan decision #3 (connector-directory ambition).
- Production deploy: `api.baseout.com` route + prod Hyperdrive + a real `PUBLIC_APP_URL` —
  Dan's env lane (decision #1).
