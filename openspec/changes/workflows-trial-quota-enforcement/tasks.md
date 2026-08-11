# Implementation tasks

## 1. Trial-email cron task

- [ ] 1.1 New `apps/workflows/trigger/tasks/trial-email-cron.task.ts`. Pure module + wrapper. Daily cron (e.g. `0 15 * * *`).
- [ ] 1.2 Engine-callback to enumerate orgs needing a reminder: `GET /api/internal/trials/expiring?in={7,3,1,0}`.
- [ ] 1.3 For each row, POST `/api/internal/orgs/:id/trial-email` with `{ daysRemaining }`. Server side renders the template + dispatches via the Cloudflare Workers `send_email` binding.
- [ ] 1.4 Re-export from `apps/workflows/trigger/tasks/index.ts`.

## 2. Tests

- [ ] 2.1 `apps/workflows/tests/trial-email-cron.test.ts` — happy path (one email per org per threshold), empty list, engine 5xx (surface as task failure).

## 3. Verification

- [ ] 3.1 `pnpm --filter @baseout/workflows typecheck && test` — green.
