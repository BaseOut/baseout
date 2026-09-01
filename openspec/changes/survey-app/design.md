# survey-app — Design

## Question model drives everything

The survey is data, not markup: a typed question list (`single | multi | short | long | email`, each with id, prompt, options, required, and an optional `showIf` predicate on prior answers). The renderer walks the list one step at a time; branching = `showIf`. Swapping fake questions for the real bank is a data change only. Question ids stay stable — they become the analysis keys (matching the research repo's ID discipline).

## Branching (scaffold demonstrates two shapes)

1. **Audience branch**: role = consultant/agency → an extra partner-interest step appears AND the sneak-peek page later shows the founding-partner block (the flag rides the stored response + the completion token).
2. **Skip branch**: "do you back up Airtable?" = "no" → the backup-detail follow-up is skipped.

## Steps, state, and honesty about persistence

- One question per screen (fast perceived progress), progress bar, back navigation preserves answers; state client-side (in-memory + sessionStorage survive reload) until the single submit at the end — no partial-response capture in v1.
- Submit posts `{surveyVersion, answers, email, audienceFlags}` to `POST /api/submit` (`prerender = false`). With D1 provisioned: insert + generate a completion token → redirect to `/thanks?t=<token>`. Until then the stub returns `{ok, token: 'preview'}` so the flow completes and the page states clearly it's a preview build.
- D1 schema (migration in-app): `responses` (id, survey_version, answers JSON, email, is_agency, created_at) + `partner_interest` (response_id, confirmed_at).

## Sneak peek privacy model

The sneak-peek URL carries the completion token (`/sneak-peek?t=…`): a capability link, deliberately not authentication — it gates casual access and keeps the page unlisted (`noindex`, unlinked). Token checked server-side against the response row when D1 is live; the video embed itself should also be unlisted at the provider. Agencies see the founding-partner block (perks + one-click "I'm interested" recorded onto their response).

## Visual bar

This app is the survey's brand moment: self-contained CSS (no product design-system dependency), one accent color shared with prelaunch, generous type, obvious focus states, mobile-first, zero framework JS — vanilla module scripts only. Attribution footer on every step: **"Run by Baseout × BuiltOnAir — from the team behind On2Air"** with one-line descriptions and links (Baseout + BuiltOnAir sponsor; On2Air is the credibility anchor, never the sponsor).

## Completion payoff

The thank-you page computes the **core maturity index** client-side from the answers already in hand (same rubric as report Appendix B) and shows the band — "You're at **Managed** — automated backups, but restore is untested" — before the sneak-peek CTA. Instant gratification, shareable, and the report gets a teaser stat ("only X% reach Engineered"). The **private tail** (Section P of the question bank) renders after the core with its own "optional, never published" intro; its answers carry a flag excluding them from the report dataset.

## Non-goals (v1)

Partial-response saving, resume links, i18n, an admin/results UI (analysis runs on D1 exports), rate limiting beyond Cloudflare defaults.
