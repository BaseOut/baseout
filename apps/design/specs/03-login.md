# 03 — Login (`/login`)

The sign-in page. Passwordless: enter an email, get a magic link.

**Source:** `apps/design/src/pages/login.astro` (full file is the
design — this page is its own surface, not assembled from a shared
view).

**Layout:** `AuthLayout` — full-bleed, no sidebar, no top bar.
Centered card on a marketing-y background.

**Live preview:** <http://localhost:4332/login>

---

## Purpose

Sign an existing user back into the app. That's it.

This is the first thing a returning user sees if their session has
expired. It must feel safe, fast, and obviously not a phishing page.

---

## User goal

> "Get me back into my dashboard with the least friction."

The user already has an account. They forgot to stay signed in (or
their session expired). They open `baseout.app/login` from a bookmark
or email and expect:

1. To type their email,
2. To be told "we sent you a link",
3. To click that link in their email,
4. To land on their Dashboard.

No password to remember. No "forgot password" flow because there's
nothing to forget.

---

## What's on the page

1. **Brand mark** — wordmark logo at the top of the card. Light /
   dark variants already wired.
2. **Headline** — "Welcome back."
3. **Subhead** — "Sign in to your account to continue."
4. **Email input** — labeled "Work Email", placeholder
   "name@company.com", autocomplete `email`. Material `mail` icon
   prefix.
5. **Submit button** — "Send Sign-In Link". Full width, primary
   variant. Shows spinner + `aria-busy` while sending.
6. **Divider** — "or continue with"
7. **OAuth row** — Google button. **Currently disabled / "Coming
   soon".** Don't design any other providers unless asked.
8. **Footer (inside card)** — "Don't have an account? Register" link
   + copyright.

After submit, the form swaps to a **"Check your email" panel**:

- "Check your email"
- "If an account exists for *name@company.com*, we sent a sign-in
  link. The link expires in 5 minutes."
- "Didn't receive it? Try a different email" (resets the form)

---

## States to design for

| State | How to see it |
|---|---|
| **Default** | Land on `/login` |
| **Loading** | Click "Send Sign-In Link" — spinner shown for 600ms in design preview |
| **Sent confirmation** | After the spinner — second panel visible |
| **Try again** | Click "Try a different email" — first panel restored |
| **Error** (real auth) | Not previewed in design app, but the page has a `#login-error` slot ready. Error styling matches inline form-error pattern used elsewhere |

---

## Notes for designer

- The email check is **deliberately privacy-preserving**: the
  message says "*if* an account exists for that email" — never
  confirms whether the address is real. Don't change that wording.
- The 5-minute link expiration is a real constraint (Better Auth
  default we use). Surfacing the time helps users not waste a click
  on an expired link.
- The Google button is a placeholder. Either keep it disabled with
  "Coming soon", or remove it entirely until OAuth login lands —
  designer's call.
- Don't add password fields. Adding "or sign in with password"
  would imply we store passwords; we don't.
- This is one of two surfaces where prospective customers see the
  brand. Make it look trustworthy enough that someone entering an
  email feels okay doing so.

## Today's gaps / freedom

- The background/canvas behind the card is bland — full design
  freedom there. References: Linear's auth pages, Vercel's auth
  pages, Resend's auth pages. Stay restrained.
- The OAuth row design (one disabled Google button) is awkward
  visually because it's the only one. Either remove or pre-design
  for "Google + GitHub + SSO" landing later.
- No social proof / "trusted by" / marketing on this page — and
  that's a deliberate choice. This is the *return* sign-in, not the
  landing page. Don't sneak marketing in here.
