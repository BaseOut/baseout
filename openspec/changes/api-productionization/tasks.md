# Tasks — api-productionization

TDD throughout (§3.4). Tasks 4.x are Dan-gated — each names its blocking decision.

## 1. Entitlements in apps/api (D1, D2)

- [x] 1.1 Mirror the entitlement tables (read-only, header-commented) + `resolveApiPlan`
      wrapper over `composeEntitlements` (tests: plan resolution, no-subscription null,
      allowance/access extraction — mocked db rows through the real pure composer).
- [x] 1.2 `get_org.plan` = resolved plan slug (test updated; null stays null).

## 2. Usage surface (D3)

- [x] 2.1 AE SQL read client (`src/lib/usage.ts`): optional `AE_ACCOUNT_ID`/`AE_API_TOKEN`,
      month-to-date call count per org; unconfigured/failed → null (tests: query shape,
      no-creds null, HTTP-failure null).
- [x] 2.2 `GET /v1/orgs/{orgId}/api-usage` + `get_api_usage` tool (+ EXPECTED_TOOLS,
      schema-agreement green; enforcement:"off" hardcoded).

## 3. Docs + close

- [x] 3.1 Support-portal `docs/api` + `docs/mcp` pages filled (via /support-docs-update:
      staged edit + changelog candidate).
- [x] 3.2 Deploy baseout-api-dev; live smoke: get_org.plan + get_api_usage against the dev
      DB (usageAvailable=false expected — no AE creds); gates (vitest/tsc/OpenAPI/lat).

## 4. Dan-gated (leave unchecked until the named decision lands)

- [ ] 4.1 Rate-limit enforcement: real per-tier numbers → wrangler `simple` limits +
      `RATE_LIMIT_ENFORCE=true`. **Blocked on Dan decision #2 (numbers).**
- [ ] 4.2 Quota enforcement: 429 when used ≥ allowance behind `QUOTA_ENFORCE`.
      **Blocked on the same decision.**
- [ ] 4.3 OAuth 2.1 + DCR + `mcp.baseout.com`. **Blocked on Dan decision #3
      (claude.ai connector-directory ambition).**
- [ ] 4.4 Production: `api.baseout.com` route, prod Hyperdrive in env.production, prod
      `PUBLIC_APP_URL`, secrets. **Blocked on Dan decision #1 (env lane).**

## Session notes (2026-08-27)

- Live: `get_org.plan` resolves ("core" for the Huh? org); `get_api_usage` returns
  allowance 50,000 from the entitlement catalog with `usageAvailable: false`
  (AE_ACCOUNT_ID/AE_API_TOKEN not provisioned — an account API token with Analytics
  read is needed; add to .dev.vars when minted, the secret sync ships it).
- Catalog tables come from @baseout/db-schema directly; only subscriptions/items/
  overrides/addon_purchases are mirrored. Web's internal-org enterprise shortcut is
  deliberately NOT ported (public API reports the actual subscription).
- Support docs: api/authentication.md + mcp/connecting.md CREATED (+ sidebar rows);
  mcp/index.md UPDATED (the "reads only" claim was now false — write scopes exist);
  api/index.md frontmatter status note updated. Per-tool + per-object reference pages
  remain follow-up docs work. docs-check green; support build green (136 pages).
  Changelog candidates (unpublished, per the batching rule):
    * "Public REST API + MCP server: drive Schema, Data, Documents, Views and Reports
       from your own code or an AI client, with per-token scopes."
    * "Search over records, documents, reports and attachments — results deep-link
       into the app."
- 37 OpenAPI operations / 36 MCP tools; apps/api 165/165 + tsc green; lat green.
