# survey-resume — Proposal

## Why

The State of Airtable DevOps survey takes ~10–15 minutes; today answers live only in `sessionStorage`, so closing the tab, switching devices, or a browser crash loses everything — a real completion-rate risk for a survey whose respondent count is the credibility of the report. The prior `survey-app` change explicitly deferred partial-response capture and resume links; the owner has now reversed that: respondents must be able to leave and pick up exactly where they left off.

## What Changes

- **Email-first start (low friction):** the survey asks for the respondent's email before the first question. Entering it does **not** require verification or clicking a magic link — they proceed immediately. The email identifies the respondent's saved progress (and doubles as the report-delivery email collected today at the end).
- **Server-side progress autosave:** every answered step upserts the respondent's answers + position to D1, replacing sessionStorage-only persistence (sessionStorage remains as an offline/latency fallback).
- **Seamless same-browser resume:** a session cookie (better-auth) lets a returning respondent continue automatically within the session lifetime, no login step.
- **Magic-link resume (cold return):** with an expired session or a new device, the respondent enters their email, receives a better-auth magic-link email, and lands back on their saved step.
- **Splash page** gains a "Resume your survey" affordance.
- **Completion:** final submit marks the progress row completed and continues into the existing `/api/submit` → completion-token → thanks/sneak-peek flow.
- **Infra:** better-auth (anonymous + magic-link plugins) on the Cloudflare Worker with D1; D1 goes from declared-but-commented to provisioned-with-migrations (fulfills part of survey-app task 2.1); Resend for magic-link email with a dev fallback that logs the link; local dev switches from the Node adapter to the Cloudflare adapter with `platformProxy` (miniflare D1, still zero-setup).

## Capabilities

### New Capabilities

- `survey-resume`: email-first respondent identity, server-side progress autosave, session-based and magic-link-based resume for the survey app.

### Modified Capabilities

- `survey-app`: the "state is client-side only until a single submit" requirement is replaced — progress is captured server-side per respondent from the email step onward; splash gains the resume entry point; the email question moves from the end of the core bank to the start of the flow.

## Impact

- **App:** `apps/survey` only (`@baseout/survey`). Pages: `index.astro` (resume affordance), `survey.astro` (email-first step, autosave, resume hydration), new `auth`/`progress` API routes. `astro.config.mjs` (adapter), `wrangler.jsonc` (D1 binding, vars), new `migrations/`.
- **Dependencies:** adds `better-auth`, `drizzle-orm` (D1 adapter). Email via Resend HTTP API (no SDK — plain fetch).
- **Secrets (deploy-time, documented not committed):** `BETTER_AUTH_SECRET`, `RESEND_API_KEY`.
- **Ops:** D1 database must be provisioned (`wrangler d1 create baseout-survey`) — the same database survey-app task 2.1 needs; this change lands the migrations for both auth/progress tables and leaves `responses`/`partner_interest` to survey-app task 2.1.
- **Privacy note:** the start step stores an *unverified* email against progress data. Verified identity happens only on the magic-link path; the final report dataset keys off submitted responses, unchanged.
