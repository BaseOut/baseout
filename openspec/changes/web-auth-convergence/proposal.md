# web-auth-convergence — Proposal

## Why

The `ui-only@986f6c09` promotion ([`2bb5b46a`](../../..)) landed nine surfaces and **deliberately held back two**: its own Caveats read *"Login/Welcome NOT promoted (script-level conflicts on the sign-in flow — needs a real login smoke on deploy)."* That deferral was correct — the sign-in flow is the one surface where a bad promotion locks every user out, and it cannot be smoke-tested locally against a real magic link.

It also left the single most severe row in the design audit unfixed. **Ship-order item 1** (`S36-F1` / decision `D35`) is not a polish item:

> `apps/web/src/styles/components/auth.css:6` is `@apply flex h-screen w-full overflow-hidden` with a vertically-centred card — *the one combination that clips both ends and offers no scrollbar.* Measured on `/welcome` at **844×390**: `.auth-layout` scrollHeight 460 vs clientHeight 390, `documentElement` could not scroll, the card ran −0.25 → 459.75, and **`Continue`'s bottom sat at 459.75 in a 390 viewport.**

**A phone in landscape cannot submit the onboarding form.** Five screens share that shell. It is the only row in the 514-row audit that makes a form *unsubmittable*, and the fix is three coupled CSS rules that already exist, written and commented, in the fork.

The second reason: our tree is **ahead** of the fork on auth wiring and **behind** it on refusals. `web-login-methods` replaced the fork's fixture scripts with real better-auth calls, so `#login-error` has a writer here and empty submit is refused — the audit's `S36-F2` was filed against the fork's version. But `LoginView.astro:220-224` refuses only a *blank* email. `not-an-email` still passes through to `signIn.magicLink` and the user is told **"we sent a sign-in link"** for an address that cannot receive one.

## What Changes

- **`styles/components/auth.css` converged to the fork** — this is the substance of the change, and it carries item 1. The three coupled rules:
  - `.auth-layout` → `@apply flex w-full` + `min-height: 100dvh` (at *least* the viewport, growing past it). No `overflow` — the **document** scrolls, which is the one scroll model the browser already gives a scrollbar for.
  - Centring moves **off** `.auth-panel`'s `justify-center` and **onto** `margin-block: auto` on `.auth-card`. This half is easy to miss and dropping `h-screen` alone does not work: `justify-content: center` on an overflowing flex container distributes overflow to *both* ends and the leading end is unreachable — no scroll position can go above 0, which is where the −0.25 came from. Auto margins take *free* space, so they centre when there is room and resolve to 0 when there is not.
  - `.auth-brand` keeps its own `overflow-hidden` (it clips the decorative rays, not the form) and takes `flex: 1 1 50%`.
- **The background asset swaps to `auth-rays.webp`** — the source art was a cyan burst on transparent black, and under `mix-blend-mode: screen` a black pixel contributes nothing, making the alpha channel mathematically redundant. Flattened onto opaque black: **1367 KB of RGBA PNG → 32 KB of WebP, pixel-equivalent on screen.** The `opacity: 0.6` multiplier is dropped — the art peaks at 73/255 and 0.6 would erase it. `public/images/auth-bg.png` retires with it.
- **`LoginView.astro` + `WelcomeView.astro` markup converged to the fork, keeping our real better-auth wiring.** The fork's fixture `<script>` blocks are *not* taken; ours stay. This is the same shape `web-login-methods` used, applied to the grown versions.
- **`views/welcomeForm.ts` promoted** — the fork extracted Welcome's required-field set into a `.ts` sibling for two reasons worth keeping: `astro check` does not walk `<script>` blocks inside `.astro`, so a type error there is invisible to `pnpm typecheck`; and the required set is consumed **twice** (the template renders one message slot per entry, the submit handler validates against the same entries), so two hand-kept copies is how a `*` marker and a validator drift apart.
- **The email-format refusal is built** (audit item 6 residue): a malformed address is refused client-side *before* the magic-link call, so the product never confirms sending a link it could not send.
- **Copy reconciled to the house voice** — the four `"Please enter your…"` strings and `"Please accept the terms to continue."` drop the pleading; the product already says *"Enter a valid email."* elsewhere (`specs/00-design-principles.md`).
- **`S36-F3` — the 390 floor gate moves into `Layout.astro`**, which `AuthLayout` inherits, so the next viewport regression is reported instead of hidden.
- **`RegisterView` is NOT promoted.** The fork's version is a 602-byte stub delegating to LoginView; the working `pages/register.astro` stays. This confirms the `web-login-methods` decision rather than revisiting it.

## Capabilities

### Modified Capabilities

- `web-login-methods`: the auth family's shell gains a scroll contract, the two grown views land, and the refusal set is completed. **No auth logic, route, or contract changes** — `lib/auth*.ts`, `pages/api/auth/*`, `pages/api/onboarding/*`, and middleware are untouched.

## Impact

- **App:** `apps/web` only. `styles/components/auth.css` (the substance), `layouts/Layout.astro` (the 390 floor gate), `views/{LoginView,WelcomeView}.astro`, new `views/welcomeForm.ts` + tests, `public/images/auth-rays.webp` added / `auth-bg.png` retired.
- **`AuthLayout.astro` is byte-identical between fork and tree** and does not change. The whole shell fix is in CSS — verify by computed value, not by reading the layout.
- **Five screens share the shell**: `/login`, `/welcome`, `/2fa`, `/register`, and the association screen. All five must be re-verified at 844×390.
- **Security:** no new auth path, no new secret, no route change. The added email-format check is **UX, not security** — server-side validation is unchanged and remains the boundary (§3.3). Say so at the call site so nobody later treats it as a gate.
- **Governance:** no new `.astro` component (both files are views, governed by the raw-markup allowlist, already registered). `welcomeForm.ts` is a `.ts` helper — no story/classification entry.

## Open Questions

None blocking. One sequencing constraint, in the tasks: **this change cannot be verified locally end-to-end.** Magic-link email does not send from Miniflare, and the deferral that created this change was about exactly that. The CSS half (item 1) *is* locally verifiable by computed value at 844×390, and should be verified that way rather than by screenshot.
