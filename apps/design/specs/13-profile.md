# 13 — Profile (`/profile`)

The user's personal profile — avatar, name, email. Currently exists
as its own page; may eventually fold into `/settings` (see spec 12).

**Source:**
- `apps/design/src/pages/profile.astro`

**Layout:** `SidebarLayout`

**Live preview:** <http://localhost:4332/profile>

---

## Purpose

Let the user update what shows up in *their* profile, distinct from
their Organization or Space configuration.

This is *personal* config — fields that follow the user across
Organizations. Currently: name, avatar. Email is read-only (changing
it requires support; it's also the magic-link target).

---

## User goal

> "Update what other people see when they look at my account."

In practice this is set once at signup and rarely touched again.
Avatar updates are the most common visit.

---

## What's on the page today

A single Card with a two-pane layout (avatar on the left, form on
the right):

### Left pane

- **Avatar** — large (2xl). Shows uploaded image or initials
  fallback.
- **Display name** — below the avatar
- **Email** — below the name
- **"Member since"** — below the email (e.g. "Member since April
  2026")

### Right pane (the form)

- **Full Name** — required text input, autocomplete `name`,
  preserves leading icon (Material Symbols `person`)
- **Email Address** — read-only with a `hint` saying "Contact
  support to change your email address."
- **Inline error slot** — for validation failures
- **Inline success slot** — for "saved" confirmation
- **Save Changes button** — primary, with save icon

---

## States to design for

| State | What |
|---|---|
| **Default** | Existing avatar, name, email |
| **No avatar** | Initials placeholder in the circle |
| **Edited but unsaved** | Form is dirty; Save button is enabled |
| **Saving** | Spinner on Save |
| **Saved confirmation** | Green inline success message: "Profile updated" |
| **Error** | Red inline error: "Could not save changes. Please try again." |

---

## Notes for designer

### What's strong

- Two-pane layout (avatar + form) reads well; the visual identity
  (avatar) is anchored on one side, the editable text on the
  other.
- Read-only email with hint is the right call — changing the email
  has security implications (it's the magic-link target), so it's
  intentionally not self-serve in V1.

### What's weak / freedom

- **Avatar upload** — currently there's no upload affordance. The
  avatar just shows whatever was set elsewhere. Designer should
  add: hover state on the avatar that reveals "Change photo" CTA,
  a small modal for upload + crop + remove.
- **The "Member since" text** is a nice trust signal but
  visually flat. Could be a small chip or just better typography.
- **There's no way to delete the account from here.** That action
  lives in /settings → Account → Delete account. Don't add it to
  this page.
- The form is sparse. If profile grows to include things like
  "preferred theme override," "default Space," "default timezone,"
  this is the right home for them. Don't add them speculatively —
  but make sure the form's visual rhythm scales when 3 fields
  becomes 8.

### What to consider for the merge into `/settings`

If we decide to fold this into `/settings → Account`, the
two-pane layout still works inside the settings right-pane. The
"Member since" sub-info could move to a small footer chip rather
than a prominent label.

---

## Component reuse

- `Card`, `Avatar`, `TextInput`, `Button`
- `setButtonLoading` for the Save button
- Inline success / error pattern (currently inlined as
  `fieldset-label text-success` / `text-error` — fine as-is, or
  promote to a small reusable `<InlineStatus>` if you find
  yourself needing it in more places)

---

## What's NOT here

- Password change (no passwords)
- Two-factor auth setup (V1.5+ if at all)
- Connected devices / sessions (lives in /settings → Account)
- API tokens (lives in /settings → Developer)
- Billing / plan info (lives in /settings → Billing)
- Anything Org-scoped or Space-scoped (those have their own
  Settings sections)
