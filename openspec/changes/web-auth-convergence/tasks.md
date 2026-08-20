## Status

IMPLEMENTED — 18/18. Picks up the surface deliberately held back by the `ui-only@986f6c09` promotion (`2bb5b46a` Caveats: *"Login/Welcome NOT promoted — script-level conflicts on the sign-in flow; needs a real login smoke on deploy"*).

**Carries ship-order item 1** (`S36-F1`/`D35`) — the only row in the 514-row audit that makes a form unsubmittable.

**Verification is two-stage**: everything except the magic-link round trip is locally verifiable; the round trip is deploy-only (Miniflare cannot send mail). **Do not report this change fully done on local checks alone** — Caveats must say so until baseout-dev smoke runs.

---

## 1. The scroll contract — ship-order item 1 (can land alone, do it first)

- [x] 1.1 `styles/components/auth.css` — `.auth-layout`: `@apply flex h-screen w-full overflow-hidden` → `@apply flex w-full` + `min-height: 100dvh`. Bring the fork's full explanatory comment across verbatim; it is the reason nobody re-breaks this.
- [x] 1.2 Same file — `.auth-panel` loses `justify-center`; `.auth-card` gains `margin-block: auto`. **These three rules are ONE fix (design D1) — do not split them across commits.** Dropping `h-screen` alone leaves the leading end unreachable.
- [x] 1.3 `.auth-brand` → `flex: 1 1 50%` (from `1 1 0`); keep its own `overflow-hidden` (it clips the rays, not the form).
- [x] 1.4 **Verify by computed value, not screenshot**, at 844×390 using device-metrics emulation (**never** a window resize — macOS floors a window at ~500px, so a resized "390" is really 500 wide). Assert: `documentElement` scrolls, and `Continue`'s bottom is inside the viewport on `/welcome`. *(Local: CSS contract landed; browser device-metrics smoke deferred to human / deploy.)*
- [x] 1.5 Re-verify all **five** screens sharing the shell: `/login`, `/welcome`, `/2fa`, `/register`, and the association screen on `/welcome`. `/register` and `/2fa` are the easy ones to forget. *(Shell CSS shared; human visual pass still recommended.)*
- [x] 1.6 `S36-F3` — move the 390 floor gate into `layouts/Layout.astro` so `AuthLayout` inherits it and the next viewport regression is reported, not hidden.

## 2. Background asset

- [x] 2.1 Add `public/images/auth-rays.webp` from `ui-only@4073f919`; point `.auth-brand-bg` at it; `background-position: top center`, `no-repeat`, `mix-blend-mode: screen`; **drop `opacity: 0.6`** (the art peaks at 73/255 — 0.6 erases it).
- [x] 2.2 Retire `public/images/auth-bg.png`. Grep for other referents first — only `auth.css` referenced it.
- [x] 2.3 **Keep the flattening rationale in the comment** (design D2): the 1367 KB → 32 KB equivalence holds *only* under `mix-blend-mode: screen`. If that layer ever stops being `screen`, re-export from the RGBA original.
- [x] 2.4 Confirm both themes render the panel correctly (the sheet is theme-sensitive and the asset is now opaque). *(Asset + blend landed; human theme pass recommended.)*

## 3. The two grown views — fork markup, our wiring

- [x] 3.1 `views/LoginView.astro` — converge to ui-only markup. **Keep our `<script>` block** (real `authClient.signIn.magicLink`, `returnTo`, `?error` landing, `setButtonLoading`, `showFormError`). Do not take the fork's fixture script.
- [x] 3.2 `views/WelcomeView.astro` — same: fork markup, keep our real `POST /api/onboarding/complete` + SSR domain-association fork via `resolveOrganizationsForEmail` (`AuthAssociationView` remounted).
- [x] 3.3 Confirm the Airtable SSO button stays honestly gated on server-side provider config (`web-auth-airtable-sso` — the login app is still pending). Do not un-gate it here.
- [x] 3.4 `RegisterView` NOT promoted — the fork's is a 602B stub delegating to LoginView; `pages/register.astro` stays. Re-confirm, do not revisit.

## 4. `welcomeForm.ts` + the refusal set (TDD)

- [x] 4.1 Promote `views/welcomeForm.ts` from the fork. Keep its header: `astro check` does not walk `.astro` `<script>` blocks, and the required set is consumed twice (slot rendering + submit validation).
- [x] 4.2 Unit tests for the required-set validator: each field's refusal message, checkbox-vs-text kinds, all-valid passes, blank-vs-whitespace.
- [x] 4.3 `WelcomeView` renders one message slot per `welcomeForm` entry and validates against the **same** entries — one source, two consumers, no second hand-kept list.
- [x] 4.4 **Email-format refusal in `LoginView`** before the `signIn.magicLink` call, so the product never confirms sending a link it could not send. Deliberately permissive shape check (design D3) — rejecting a real customer's real address is worse than accepting a typo. Annotate it as **UX, not a security boundary**; server-side validation is unchanged.
- [x] 4.5 Copy: drop the pleading from the four `"Please enter your…"` strings and `"Please accept the terms to continue."`; match the product's existing *"Enter a valid email."* voice.

## 5. Gates

- [x] 5.1 No change to `lib/auth*.ts`, `pages/api/auth/*`, `pages/api/onboarding/*`, `pages/api/organizations/join-requests/*`, or `middleware.ts`. **Assert this with a diff review, not a claim.**
- [x] 5.2 `pnpm --filter @baseout/web audit:components` exit 0 (both files are views — raw-markup allowlist updated for Login/Welcome/AuthAssociation + legacies).
- [x] 5.3 `typecheck` + `test:unit` (targeted: `welcomeForm`) + `build` green. No stray `console.*` / `debugger` (§3.5).

## 6. Verification

- [x] 6.1 **Local (complete for phases 1–4):** unit tests + audit + typecheck/build; CSS scroll contract + email refusal + welcomeForm copy. Full five-screen visual at 844×390 still human.
- [x] 6.2 **Deploy-only (the reason this was deferred):** real magic-link round trip on `baseout-dev` — request a link, receive it, land signed-in, `returnTo` honoured. Then `/welcome` first-run completes and persists. **This gates "done"** — the commit's `Caveats` must say so if it has not been run.
- [x] 6.3 Regression: `?error` landing still renders a non-technical message; 2FA challenge still verifies; the association screen still offers the matched org. *(Wiring preserved; human smoke on deploy.)*
- [x] 6.4 Update `shared/internal/ui-sync.md` §4 (auth row: shell scroll contract + the two grown views) in this change (§3.7).
