## Why

The **State of Airtable DevOps survey** is the pre-launch play: it produces the report (the audience incentive), seeds the launch list, and recruits early-access users and founding partners. Third-party form tools can't deliver the branded, branching, stylish experience this deserves — and the survey **is** the first impression of Baseout. It needs its own app.

## What Changes

- **New app `apps/survey`** (`@baseout/survey`): Astro on Cloudflare Workers (SSR-capable for the submit endpoint), deployed for now at its own URL (e.g. survey.baseout.com); the prelaunch site's CTA points here.
- **Flow**:
  1. **Splash** — what the survey is (the first State of Airtable DevOps survey), time expectation, and the benefits: the findings **report first**, a **sneak peek at Baseout** after submitting, **early access** to Baseout, and — for agencies/consultants — **founding status in the partner program**. Sponsorship framing: **"Run by Baseout and BuiltOnAir — from the team behind On2Air"** (Baseout + BuiltOnAir are the sponsors; On2Air is the credibility anchor, never named as sponsor), with a sentence on each and links.
  2. **Survey** — multi-step, one section per screen, progress indicator, keyboard-friendly. **Placeholder questions for now** (the flow, not the content): demonstrating single-select, multi-select, short-text, long-text, and email inputs, plus **branching** (e.g. the role question routes consultants/agencies to an extra partner-interest step; a "do you back up?" answer skips or shows a follow-up). Real question bank lands later from `research/customers/survey-state-of-airtable-devops.md` (baseout repo).
  3. **Thank-you** — shows the respondent's **maturity band** computed on the spot from their answers (Ad hoc / Aware / Managed / Engineered, one-line description — instant payoff and shareable), confirms the report is coming, then the hero CTA: **"Get your sneak peek of Baseout — click here"** → the private sneak-peek page.
  4. **Sneak peek (private)** — unlisted, token-linked page (link only issued on completion; `noindex`): an **embedded video** of Baseout, plus — when the respondent identified as an agency/consultant — the **partner-program founding-status** block: perks summary + a confirm-interest action.
- **Persistence**: responses to the app's own **Cloudflare D1** via a Worker endpoint (per the standing decision for these public apps). Response row = survey version, answers JSON, email, audience flags, timestamps; partner-interest confirmations recorded on the response. Until D1 is provisioned, the endpoint stub accepts and logs nothing — the scaffold flow completes client-side.
- **Scaffold in this change**: the full four-step flow with fake questions and branching, the stub submit endpoint, D1 binding declared-but-commented, self-contained styling (stylish, mobile-first — this app sets the survey's visual bar).

## Capabilities

### New Capabilities
- `survey-app`: the survey experience — benefits splash with Baseout/On2Air attribution, branching multi-step survey (all five input kinds), D1-backed response capture, thank-you → private sneak-peek page with embedded video and agency partner-program founding confirmation.

## Impact

- New workspace app `apps/survey`; prelaunch's `SURVEY_URL` constant points here once deployed.
- **Content dependencies**: real questions from the benchmark instrument (baseout repo `research/customers/`); the sneak-peek video asset; partner-program perk copy. All are drop-in — the flow doesn't change.
- Security/privacy: responses contain emails — D1 access only via the Worker endpoint, no client-side reads; sneak-peek tokens are capability URLs, not auth; no third-party trackers beyond the analytics decision (PostHog per GTM §6.6).
- Graduation note: migrates to the Baseout monorepo with the other public apps once stable.
