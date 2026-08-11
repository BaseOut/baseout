# 04 — Register (`/register`)

Account creation. Also passwordless — same magic-link mechanism as
Login.

**Source:** `apps/design/src/pages/register.astro`

**Layout:** `AuthLayout` — same full-bleed centered card as Login.

**Live preview:** <http://localhost:4332/register>

---

## Purpose

Stand up a brand-new account from scratch. After the magic link is
clicked, the user lands on `/welcome` (the onboarding wizard — spec
05) where they tell us their name, job title, org name, and a
referral source.

The split between Register and Welcome is intentional: Register is
"prove you own an email"; Welcome is "tell us who you are." Don't
collapse the two — having Welcome as a separate step lets us send
the magic-link email *first*, which warms the email, validates the
address, and gives the user a tactile sense that signup is real.

---

## User goal

> "Create my account and start backing up my Airtable."

The user came from the marketing site (or a colleague's referral)
and clicked "Sign up." They expect:

1. Type an email,
2. Get a confirmation email,
3. Click the link,
4. Fill in a short form (Welcome page),
5. Land in the product, looking at their (empty) Dashboard with a
   clear "Next Step" CTA.

---

## What's on the page

Mirror of Login, with the strings flipped for "create":

1. **Brand mark**
2. **Headline** — "Create your account."
3. **Subhead** — "Start backing up your Airtable in minutes."
4. **Email input** — same component as Login
5. **Submit button** — "Send Sign-Up Link"
6. **Divider** — "or continue with"
7. **OAuth row** — Google button, disabled / "Coming soon"
8. **Footer** — "Already have an account? Sign in"

After submit, swap to the **"Check your email" panel** (same as
Login).

---

## Designer notes

- Should look near-identical to Login. Users move between them
  fluidly via the footer links — visual continuity reinforces
  "same flow, different intent."
- The headline / subhead is where the two pages differ most
  visibly. Resist the urge to add marketing copy here ("Join 10,000
  Airtable users!") — it cheapens the moment.
- Don't add a "Plan picker" here. Plan selection happens after
  onboarding (PRD §6.6 — "trial converts to paid plan" implies a
  Plans / Billing page surface, not in the auth flow).
- The free trial is automatic — no checkbox, no opt-in, no plan
  selection at signup. Don't surface that here either; it'd be
  asking the user to decide something they don't yet have context
  to decide.

## What's NOT here

- No password fields.
- No plan picker.
- No "I already have an account" inline-toggle widget — link to
  `/login` in the footer is enough.
- No CAPTCHA UI (rate-limiting is server-side and invisible).
- No terms-acceptance checkbox at this step (it's on `/welcome`
  instead, where the user fills in personal info).
