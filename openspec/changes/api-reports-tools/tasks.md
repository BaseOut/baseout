# Tasks — api-reports-tools

Depends on api-write-foundation (write plumbing + scopes). TDD (§3.4) throughout.

## 1. Server side

- [ ] 1.1 Broker cap enforcement (design D2): POST report path refuses over-cap with 403
      `report_cap_reached` {cap, current}. Red-first test at the broker; web proxy behavior
      unchanged (its pre-flight stays).
- [ ] 1.2 Verify broker contracts cover the API's needs (list/get/create/update/delete/
      generate/run/runs/resend) — no shape changes expected; document any found drift here.

## 2. apps/api operations

- [ ] 2.1 `server-client.ts` report fetchers (+timeout/502 posture tests).
- [ ] 2.2 `operations/reports.ts`: definitions CRUD (Zod body schemas mirroring broker
      contract; `reports:read`/`reports:write` scopes; tenant guards; 403/404 posture tests).
- [ ] 2.3 Run operations: generate (optional window), get run, list runs, resend.
- [ ] 2.4 Artifact capability URL (design D3): mint + redeem routes, HMAC + TTL tests
      (expired, tampered, cross-tenant), REST direct-bytes via Accept header.

## 3. MCP tools

- [ ] 3.1 ~10 tool entries with hand-written descriptions per design D5;
      readOnlyHint/destructiveHint correct (delete_report destructive).
- [ ] 3.2 Catalog tests: scope-elision (a reports:read-only token sees no write tools);
      schema-agreement test green across new tools.

## 4. Contract + verification

- [ ] 4.1 OpenAPI regen includes the new operations; diff reviewed.
- [ ] 4.2 Broker-contract pin test: fixture responses from the broker shapes asserted against
      the API's Zod (drift = red).
- [ ] 4.3 Tool copy reviewed against Features §1 naming.
- [ ] 4.4 Live demo smoke (the milestone): against the deployed worker with a reports:write
      token — create_report → run_report → get_report_run shows the rendered document →
      artifact URL downloads a PDF. Record the transcript here; this is the Dan demo.
- [ ] 4.5 Gates: apps/api typecheck+vitest, apps/server targeted broker tests, lat check.
