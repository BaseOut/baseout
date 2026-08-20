## Status

PROPOSED — 0/18. Picks up the surface deliberately held back by the `ui-only@986f6c09` promotion (`2bb5b46a` Caveats: *"Login/Welcome NOT promoted — script-level conflicts on the sign-in flow; needs a real login smoke on deploy"*).

**Carries ship-order item 1** (`S36-F1`/`D35`) — the only row in the 514-row audit that makes a form unsubmittable. Phase 1 is that fix and can land alone.

**Verification is two-stage**: everything except the magic-link round trip is locally verifiable; the round trip is deploy-only (Miniflare cannot send mail). Do not report this change done on local checks alone.

---

## 1. The scroll contract — ship-order item 1 (can land alone, do it first)

- [ ] 1.1 `styles/components/auth.css` — `.auth-layout`: `@apply flex h-screen w-full overflow-hidden` → `@apply flex w-full` + `min-height: 100dvh`. Bring the fork's full explanatory comment across verbatim; it is the reason nobody re-breaks this.
- [ ] 1.2 Same file — `.auth-panel` loses `justify-center`; `.auth-card` gains `margin-block: auto`. **These three rules are ONE fix (design D1) — do not split them across commits.** Dropping `h-screen` alone leaves the leading end unreachable.
- [ ] 1.3 `.auth-brand` → `flex: 1 1 50%` (from `1 1 0`); keep its own `overflow-hidden` (it clips the rays, not the form).
- [ ] 1.4 **Verify by computed value, not screenshot**, at 844×390 using device-metrics emulation (**never** a window resize — macOS floors a window at ~500px, so a resized "390" is really 500 wide). Assert: `documentElement` scrolls, and `Continue`'s bottom is inside the viewport on `/welcome`.
- [ ] 1.5 Re-verify all **five** screens sharing the shell: `/login`, `/welcome`, `/2fa`, `/register`, and the association screen on `/welcome`. `/register` and `/2fa` are the easy ones to forget.
- [ ] 1.6 `S36-F3` — move the 390 floor gate into `layouts/Layout.astro` so `AuthLayout` inherits it and the next viewport regression is reported, not hidden.

## 2. Background asset

- [ ] 2.1 Add `public/images/auth-rays.webp` from `ui-only@252005be`; point `.auth-brand-mesh` at it; `background-position: top center`, `no-repeat`, `mix-blend-mode: screen`; **drop `opacity: 0.6`** (the art peaks at 73/255 — 0.6 erases it).
- [ ] 2.2 Retire `public/images/auth-bg.png`. Grep for other referents first — the never-sync list records this deletion as fork-local precisely because it was ambiguous once.
- [ ] 2.3 **Keep the flattening rationale in the comment** (design D2): the 1367 KB → 32 KB equivalence holds *only* under `mix-blend-mode: screen`. If that layer ever stops being `screen`, re-export from the RGBA original.
- [ ] 2.4 Confirm both themes render the panel correctly (the sheet is theme-sensitive and the asset is now opaque).

## 3. The two grown views — fork markup, our wiring

- [ ] 3.1 `views/LoginView.astro` — converge to `ui-only@252005be` markup. **Keep our `<script>` block** (real `authClient.signIn.magicLink`, `returnTo`, `?error` landing, `setButtonLoading`, `showFormError`). Do not take the fork's fixture script.
- [ ] 3.2 `views/WelcomeView.astro` — same: fork markup, keep our real `POST /api/onboarding/complete` + SSR domain-association fork via `resolveOrganizationsForEmail`.
- [ ] 3.3 Confirm the Airtable SSO button stays honestly gated on server-side provider config (`web-auth-airtable-sso` — the login app is still pending). Do not un-gate it here.
- [ ] 3.4 `RegisterView` NOT promoted — the fork's is a 602B stub delegating to LoginView; `pages/register.astro` stays. Re-confirm, do not revisit.

## 4. `welcomeForm.ts` + the refusal set (TDD)

- [ ] 4.1 Promote `views/welcomeForm.ts` from the fork. Keep its header: `astro check` does not walk `.astro` `<script>` blocks, and the required set is consumed twice (slot rendering + submit validation).
- [ ] 4.2 Unit tests for the required-set validator: each field's refusal message, checkbox-vs-text kinds, all-valid passes, blank-vs-whitespace.
- [ ] 4.3 `WelcomeView` renders one message slot per `welcomeForm` entry and validates against the **same** entries — one source, two consumers, no second hand-kept list.
- [ ] 4.4 **Email-format refusal in `LoginView`** before the `signIn.magicLink` call, so the product never confirms sending a link it could not send. Deliberately permissive shape check (design D3) — rejecting a real customer's real address is worse than accepting a typo. Annotate it as **UX, not a security boundary**; server-side validation is unchanged.
- [ ] 4.5 Copy: drop the pleading from the four `"Please enter your…"` strings and `"Please accept the terms to continue."`; match the product's existing *"Enter a valid email."* voice.

## 5. Gates

- [ ] 5.1 No change to `lib/auth*.ts`, `pages/api/auth/*`, `pages/api/onboarding/*`, `pages/api/organizations/join-requests/*`, or `middleware.ts`. **Assert this with a diff review, not a claim.**
- [ ] 5.2 `pnpm --filter @baseout/web audit:components` exit 0 (both files are views — already in the raw-markup allowlist; confirm no new entry is needed).
- [ ] 5.3 `typecheck` + `test:unit` (targeted: `welcomeForm`) + `build` green. No stray `console.*` / `debugger` (§3.5).

## 6. Verification

- [ ] 6.1 **Local (complete for phases 1–4):** all five screens at 844×390 and at <375 / <768 / <1024; `Continue` reachable and submittable; empty email refused; `not-an-email` refused *before* any network call; copy matches; both themes.
- [ ] 6.2 **Deploy-only (the reason this was deferred):** real magic-link round trip on `baseout-dev` — request a link, receive it, land signed-in, `returnTo` honoured. Then `/welcome` first-run completes and persists. **This gates "done"** — the commit's `Caveats` must say so if it has not been run.
- [ ] 6.3 Regression: `?error` landing still renders a non-technical message; 2FA challenge still verifies; the association screen still offers the matched org.
- [ ] 6.4 Update `shared/internal/ui-sync.md` §4 (auth row: shell scroll contract + the two grown views) in this change (§3.7).
