# @baseout/survey

**The State of DevOps for App Platforms survey (Airtable edition)** — splash → email-first start → branching multi-step survey with save-and-resume → thank-you → private sneak peek (video + agency founding-partner block). Specs: `openspec/changes/survey-app/` + `openspec/changes/survey-resume/`.

```bash
pnpm --filter @baseout/survey db:migrate  # once — creates auth/progress tables in the local D1
pnpm --filter @baseout/survey dev         # http://localhost:4344
pnpm --filter @baseout/survey typecheck   # regenerates worker-configuration.d.ts + astro check
pnpm --filter @baseout/survey build
pnpm --filter @baseout/survey deploy      # astro build + wrangler deploy
```

## Save & resume (survey-resume change)

- **Start:** respondents enter their email before question 1 — no verification gate; it issues an instant better-auth *anonymous* session and creates a `survey_progress` row. Every Next/Back autosaves answers + position to D1.
- **Same browser:** the 30-day session cookie resumes automatically at the saved step.
- **Cold return / new device:** `/survey?resume=1` (or "Resume your survey" on the splash) → better-auth **magic link** → verified session adopts the progress row matching the verified email (most-recent wins) → resumes in place.
- **Privacy:** an anonymous session can only read the row it created; email-matched rows are only served to sessions that verified that email. Unverified emails can never claim someone else's progress.
- **Dev email:** without `RESEND_API_KEY`, magic links are logged to the dev server console instead of emailed.

The adapter is `@astrojs/cloudflare` v13 (the Astro 6 line — v14 requires Astro 7) in dev *and* deploy: `astro dev` runs in workerd with the D1 binding from `wrangler.jsonc` served by local miniflare, zero external setup.

## Going live

1. `wrangler d1 create baseout-survey` → paste the real `database_id` into `wrangler.jsonc`.
2. `pnpm --filter @baseout/survey db:migrate:remote`.
3. `wrangler secret put BETTER_AUTH_SECRET` (long random string) and `wrangler secret put RESEND_API_KEY`; verify the from-domain at Resend (`src/lib/email.ts`). Optionally set `BETTER_AUTH_URL=https://survey.baseout.com`.
4. `pnpm --filter @baseout/survey deploy`; attach the survey.baseout.com route.

Remaining from **survey-app task 2**: real question bank (placeholders in `src/lib/questions.ts`), `responses`/`partner_interest` tables + real completion tokens in `/api/submit` (the D1 database itself is provisioned by the steps above), maturity band on the thank-you page, sneak-peek video embed, analytics/OG.
