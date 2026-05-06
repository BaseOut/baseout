# Loading States

Any client-side interaction that waits on the server **must** show a visible loading spinner. A disabled button alone is not sufficient — users need clear feedback that something is happening.

The canonical helper is `setButtonLoading` in [src/lib/ui.ts](../src/lib/ui.ts). Use it everywhere a button triggers a network round-trip.

## The Rule

Every form submit, button click, or interaction that triggers a network call must show a spinner while in flight. This includes `fetch`, better-auth client calls, and any other async server call.

`setButtonLoading` injects the daisyUI `loading loading-spinner loading-sm` span, toggles `disabled`, and sets `aria-busy="true"` for screen-reader users. Always pair it with a `try/finally` so unexpected throws don't leave the UI stuck.

## Pattern

The required shape:

```ts
import { setButtonLoading } from '../lib/ui'

const submitBtn = form.querySelector('button[type=submit]') as HTMLButtonElement

setButtonLoading(submitBtn, true)
try {
  const res = await fetch('/api/...')
  // ...handle response...
} finally {
  setButtonLoading(submitBtn, false)
}
```

Anti-patterns to avoid:

- Setting `disabled = true` without a spinner.
- Clearing the loading state inside the try block (a throw will leak it).
- Using a custom spinner span when `setButtonLoading` would do — keep one helper, one shape.

## Multi-Second Operations

For operations that routinely take several seconds (Stripe provisioning, OAuth Connect, large form submits), also disable surrounding interactive controls to prevent double-submission.

The user should see "this is happening" and have no way to start it again. This is in addition to the spinner, not a replacement.

## Non-Button Waits

For waits that aren't button-scoped (full-page loads, data refreshes, polling), use a daisyUI `loading` component appropriate to the context.

Available variants: `loading loading-dots`, `loading loading-spinner`, `loading loading-bars`, etc. Apply the same `try/finally`-clears-state discipline as the button helper.

## Where to Look

Pointers to source and rules.

- Helper: [src/lib/ui.ts](../src/lib/ui.ts)
- Per-app rules: [.claude/CLAUDE.md](../.claude/CLAUDE.md) §12
- daisyUI loading components: <https://daisyui.com/components/loading/>
