# 05 — Welcome / Onboarding (`/welcome`)

The one-and-only onboarding form. Runs immediately after a brand-new
user clicks their magic link. Asks for the minimum data we need to
create their Organization and Space.

**Source:** `apps/design/src/pages/welcome.astro`

**Layout:** `AuthLayout` — still full-bleed (no sidebar yet — the
user isn't fully "in" until this form is submitted).

**Live preview:** <http://localhost:4332/welcome>
(use `?fixture=trial` to see it for a brand-new user)

---

## Purpose

Get the user from "verified email" to "ready to connect Airtable"
in one screen. This is the only chance we have to learn:

- Their real name (for greetings, attribution, billing)
- Their job title (for cohort analysis — designer, ops, founder)
- Their Organization name (the first Space gets created under this Org)
- How they heard about us (referral source — light marketing
  attribution)

PRD §6.6 frames this as the *single* form that gates the rest of
the product. Once submitted, they land on the Dashboard with a
"Next Step: Connect Airtable" CTA (spec 06) and the rest of the
onboarding is driven by their own clicks on the Integrations page
(spec 07).

---

## User goal

> "Tell them the few things they need so I can get to the actual
> backup setup."

The user just clicked an email link. They're motivated but not
patient. Each field they fill is friction; each field we ask for is
revenue or product clarity. The current set (first/last/title/org +
referral + 2 checkboxes) is the negotiated minimum — don't add to
it without a clear reason.

---

## What's on the page

1. **Headline** — "Welcome, *email@domain.com*" (uses the email
   they signed up with — personalization grounded in a fact they
   just verified).
2. **Subhead** — "A few quick details and you're in."
3. **First name + Last name** — side-by-side on desktop, stacked on
   mobile. Both required, autocomplete `given-name` / `family-name`.
4. **Job Title** — required. Free text. (We *don't* offer a
   dropdown of titles — too many edge cases. Free text + light
   normalization downstream is fine.)
5. **Organization Name** — required. Becomes the Org name shown
   throughout the app. The user can rename it later in Settings.
6. **How did you hear about us?** — optional dropdown: Google /
   Twitter / Friend / Podcast / Other.
7. **Marketing opt-in checkbox** — "I'd like to receive product
   updates and announcements." Defaults unchecked.
8. **Terms checkbox** — "I agree to the terms and privacy policy."
   Required. Defaults unchecked.
9. **Continue button** — primary, full width, "Continue →"

After submit: 500ms spinner, then redirect to `/` (Dashboard).

---

## States to design for

| State | How to see it |
|---|---|
| **Default** | `/welcome?fixture=trial` |
| **Form-error inline** | Submit with any required field empty — inline error appears |
| **Submitting** | Brief loading state on the Continue button |

---

## What we considered and rejected

These are intentional negatives — don't reintroduce them:

- **A multi-step wizard.** Tried; too many users abandoned step 2.
  One screen + one button.
- **Plan picker on this screen.** The user has no context yet to
  pick a plan. Plan picking happens later on a dedicated
  Billing/Plans page once they understand the product.
- **Connect Airtable inline.** Putting the OAuth dance here adds
  failure modes to the most fragile point in the funnel. Better to
  land on the Dashboard with a clean "Next Step" CTA and let them
  initiate the OAuth from the Integrations page.
- **Asking for company size, industry, use case.** Out of scope for
  V1. We can A/B test adding one back later if we need it for
  pricing / sales.

---

## Designer notes

- This page only happens *once* per user, but it's the highest-
  intent moment of their lifetime with the product. Worth making
  it feel polished and confident.
- Don't try to be funny here. "Almost there!" / "Just one more
  step!" / progress bars implying more steps come — all out of
  voice. The form is short; let it speak for itself.
- The Org name field is doing double duty: it's the name we'll show
  in the sidebar Org switcher and on invoices. That's why the
  placeholder is "Acme Corp" not "My Team" — it's a business
  entity, not a personal vibe.
- The "How did you hear about us" dropdown is the one place
  marketing data sneaks in. Keep it optional. If it makes the form
  feel longer, it might be the field to drop entirely.

## Gaps / freedom

- The current layout is honest but bland. Tightening the visual
  language, adding a subtle wordmark in the corner, treating the
  card with more deliberate type / spacing — all in scope.
- The "Welcome, email" headline gets long fast. Consider truncating
  or moving the email to a subhead.
- Mobile layout collapses the first/last name to stacked — fine,
  but the whole card gets tall on small screens. Worth a look.
