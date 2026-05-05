# Split Auth Pages: Login, Register, Forgot Password, Reset Password

## Context

The project currently has a single `/login-register` page with tabbed sign-in/register forms. The `@opensided/theme` package includes reference auth pages (login, register, forgot-password, reset-password) built in React. The goal is to rebuild these as 4 separate Astro pages that reuse the project's existing layout, UI components, and styling conventions.

## File Changes Summary

| File | Action | Description |
|------|--------|-------------|
| `src/lib/auth-utils.ts` | **CREATE** | Shared password toggle + form error helpers |
| `src/styles/components/auth.css` | **MODIFY** | Remove fixed height + tab rules, add title/subtitle classes |
| `src/pages/login.astro` | **CREATE** | Email + password login, Google OAuth |
| `src/pages/register.astro` | **CREATE** | Full name, email, password, confirm, terms, Google OAuth |
| `src/pages/forgot-password.astro` | **CREATE** | Email field + send reset link |
| `src/pages/reset-password.astro` | **CREATE** | New password + confirm password |
| `src/components/layout/Sidebar.astro` | **MODIFY** | Line 268: change `href` from `/login-register` to `/login` |
| `src/pages/login-register.astro` | **DELETE** | Remove old combined page |

## Step 1: Create shared auth utilities

**New file: `src/lib/auth-utils.ts`**

Extract from the current `login-register.astro` script:
- `setupPasswordToggle(toggleId, inputId)` — toggles password visibility + swaps Material Symbol icon
- `showFormError(errorEl, textEl, message)` — unhides an error div and sets the message
- `hideFormError(errorEl)` — hides the error div

## Step 2: Update auth.css

**Modify: `src/styles/components/auth.css`**

- **Remove** fixed `height: min(580px, calc(100vh - 6rem))` from `.auth-card-inner` — let content dictate height, `.auth-panel` already centers vertically
- **Remove** tab-specific rules: `.auth-card-inner > .tabs`, `.auth-card-inner > .tabs > .tab-content`, `.auth-card-inner > .tab-panel` (lines 100-110)
- **Add** two new classes for standalone page headings:
  - `.auth-card-title` — `text-xl font-semibold text-base-content text-center`
  - `.auth-card-subtitle` — `text-sm text-base-content/60 text-center mt-1 mb-6`

## Step 3: Create the four auth pages

All pages follow this shared structure:
- Import `AuthLayout`, UI components, and config helpers
- Wrap content in `<AuthLayout title="...">` → `<div class="auth-card-inner">`
- Use `<h2 class="auth-card-title">` + `<p class="auth-card-subtitle">` for headings
- Use `<form class="auth-form">` with existing UI components
- Footer with cross-page links using `.auth-footer` classes
- Page-specific `<script>` importing from `auth-utils.ts`

### 3a: `/login` (`src/pages/login.astro`)
- **Heading**: "Sign In" / "Welcome back. Sign in to continue."
- **Fields**: TextInput (email, icon="mail") + manual password fieldset with toggle (icon="lock")
- **Links**: "Forgot Password?" → `/forgot-password` (using `.auth-form-link`)
- **Buttons**: "Sign In" (primary, icon="login") + Divider + SocialButton (Google)
- **Footer**: "Don't have an account?" → `/register`
- **Script**: `setupPasswordToggle` + owner-email mock auth (preserved from current page)

### 3b: `/register` (`src/pages/register.astro`)
- **Heading**: "Create Account" / "Get started with your free account."
- **Fields**: TextInput (full name, icon="person") + TextInput (email, icon="mail") + password fieldset with toggle + confirm password fieldset with toggle + Checkbox (terms)
- **Buttons**: "Create Account" (primary, icon="person_add") + Divider + SocialButton (Google)
- **Footer**: "Already have an account?" → `/login`
- **Script**: Two `setupPasswordToggle` calls + validation (name, email, password match, terms)

### 3c: `/forgot-password` (`src/pages/forgot-password.astro`)
- **Heading**: "Forgot Password?" / "Enter your email and we'll send you a reset link."
- **Fields**: TextInput (email, icon="mail")
- **Buttons**: "Send Reset Link" (primary, icon="mail")
- **No social buttons**
- **Footer**: "Remember your password?" → `/login`
- **Script**: Email validation, mock success message on submit

### 3d: `/reset-password` (`src/pages/reset-password.astro`)
- **Heading**: "Reset Password" / "Enter your new password below."
- **Fields**: New password fieldset with toggle + confirm password fieldset with toggle
- **Buttons**: "Change Password" (primary, icon="check")
- **No social buttons**
- **Footer**: "Back to" → `/login`
- **Script**: Two `setupPasswordToggle` calls + password match validation, redirect to `/login` on success

## Step 4: Update navigation references

- `src/components/layout/Sidebar.astro` line 268: change `href="/login-register"` → `href="/login"`

## Step 5: Delete old page

- Remove `src/pages/login-register.astro`

## Key Reuse

- **AuthLayout.astro** — existing split layout with brand panel (no changes needed)
- **TextInput.astro** — for email and text fields with icons
- **Button.astro** — for submit buttons (variant="primary", type="submit")
- **Checkbox.astro** — for terms agreement
- **Divider.astro** — for "or continue with" separator
- **SocialButton.astro** — for Google OAuth button
- **auth.css** — existing `.auth-form`, `.auth-footer`, `.auth-form-link`, `.auth-copyright` classes
- **Material Symbols** icons: `mail`, `lock`, `visibility`, `visibility_off`, `login`, `person_add`, `person`, `check`, `error`
- Password fieldset pattern from current `login-register.astro` lines 73-89

## Design Notes

- Password fields use manual fieldset markup (not TextInput) because TextInput's `iconRight` isn't interactive — this matches the existing pattern in the codebase
- The View Transitions (`ClientRouter`) will handle smooth page-to-page navigation automatically; scripts should use `document.addEventListener('astro:page-load', ...)` to ensure they re-bind after transitions
- Mock auth preserved: login checks owner email from config, other forms show placeholder success/redirect

## Verification

1. `npm run dev` and visit each route: `/login`, `/register`, `/forgot-password`, `/reset-password`
2. Test cross-page links: login ↔ register, login → forgot-password, forgot-password → reset-password, reset-password → login
3. Test password visibility toggles on login, register, and reset-password pages
4. Test form validation error states (empty fields, password mismatch)
5. Test mock login with the owner email from `app-config.json`
6. Test responsive layout: mobile (form only) vs desktop (brand panel + form)
7. Test dark mode toggle on each page
8. Verify sidebar logout link navigates to `/login`
9. Navigate between auth pages and verify View Transitions work (scripts re-bind correctly)
