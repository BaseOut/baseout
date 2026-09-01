# Tasks

## 1. Scaffold (this change)

- [x] 1.1 `apps/survey` (`@baseout/survey`): Astro + Cloudflare adapter, tsconfig, wrangler.jsonc (D1 declared, commented), README.
- [x] 1.2 Question model (`src/lib/questions.ts`): typed kinds (single/multi/short/long/email), `showIf` branching; fake questions covering all five kinds + the audience branch + a skip branch.
- [x] 1.3 Splash page: what the survey is, time expectation, the four benefits (report first, sneak peek, early access, agency founding-partner status), Baseout × On2Air attribution with links.
- [x] 1.4 Multi-step survey renderer: one question per screen, progress bar, back navigation, sessionStorage persistence, client-side required validation.
- [x] 1.5 Thank-you page with the "Get your sneak peek of Baseout — click here" CTA; private `/sneak-peek` page (`noindex`, token param): embedded-video placeholder + agency founding-partner block with confirm-interest action (stubbed).
- [x] 1.6 `POST /api/submit` stub (`prerender = false`) returning `{ok, token}`.

## 2. Make it real (before send)

- [ ] 2.1 Provision D1; `responses` + `partner_interest` migrations; submit endpoint writes + issues real completion tokens; sneak-peek + partner-confirm validate tokens server-side.
- [ ] 2.2 Replace fake questions with the real bank from baseout `research/customers/survey-state-of-airtable-devops.md` (stable IDs, branching per its builder notes — incl. the **private validation tail** Section P: rendered with its "optional, never published" intro, stored flagged so it's excluded from the report dataset).
- [ ] 2.2b **On-screen maturity band** on the thank-you page: compute the core maturity index client-side from the answers (scoring rubric = report Appendix B) and show the band (Ad hoc / Aware / Managed / Engineered) with a one-line description before the sneak-peek CTA.
- [ ] 2.2c Sponsorship copy check everywhere the survey renders: "Run by Baseout and BuiltOnAir — from the team behind On2Air" (Baseout + BuiltOnAir sponsor; On2Air is credibility only).
- [ ] 2.3 Sneak-peek video embed (unlisted at provider) + final partner-program perk copy.
- [ ] 2.4 Analytics (PostHog per GTM §6.6), OG meta, favicon; deploy (e.g. survey.baseout.com); update prelaunch's `SURVEY_URL`.
- [ ] 2.5 Walk the full flow at three breakpoints incl. both branches; verify a submitted response lands in D1 with correct flags.
