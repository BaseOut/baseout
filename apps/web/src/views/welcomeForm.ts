/**
 * The required set of the first-run details form, and the refusal each field earns.
 *
 * It lives here, in a `.ts` sibling rather than in `WelcomeView.astro`'s `<script>`, for two
 * reasons the audit already wrote down: `astro check` walks `apps/design` only, so a type error in
 * an `.astro` `<script>` block is invisible to `pnpm typecheck` (infra note, 2026-08-12); and the
 * required set is consumed TWICE — the template renders one message slot per entry, the submit
 * handler validates against the same entries. Two hand-kept copies of "which fields are required"
 * is how a `*` marker and a validator drift apart.
 *
 * COPY (Oleh, batch D3): every message used to open with "Please" — "Please enter your job title."
 * The house voice is direct and second-person with no pleading (`specs/00-design-principles.md`),
 * and the rest of the product already says "Enter a valid email." (LoginView). The four "Please
 * enter your…" strings and "Please accept the terms to continue." are reconciled to that shape.
 */

export interface WelcomeRequiredField {
  /** The control's `name`, which is also the id `TextInput`/`Checkbox` derive (`lib/ui.ts:inputId`). */
  readonly name: string;
  /** What the field says when it refuses. Written into the slot below the control. */
  readonly message: string;
  /** A checkbox refuses on `checked`, a text field on a non-blank value. */
  readonly kind: 'text' | 'checkbox';
}

export const WELCOME_REQUIRED: readonly WelcomeRequiredField[] = [
  { name: 'firstName', message: 'Enter your first name.', kind: 'text' },
  { name: 'lastName', message: 'Enter your last name.', kind: 'text' },
  { name: 'jobTitle', message: 'Enter your job title.', kind: 'text' },
  { name: 'orgName', message: 'Enter your organization name.', kind: 'text' },
  { name: 'termsAccepted', message: 'Accept the terms to continue.', kind: 'checkbox' },
];

/** The id of a field's message slot — the target of the control's `aria-describedby`. */
export function welcomeErrorId(name: string): string {
  return `welcome-${name}-error`;
}

/**
 * Is this control satisfied? One predicate, used by BOTH the arming check that decides whether the
 * submit reads as ready and the refusal check that runs on an attempt — so the button cannot say
 * "ready" about a form the handler would then refuse.
 */
export function isFieldSatisfied(el: HTMLInputElement | null, kind: WelcomeRequiredField['kind']): boolean {
  if (!el) return false;
  return kind === 'checkbox' ? el.checked : el.value.trim().length > 0;
}

/**
 * The element that carries a text field's error LOOK, or `null` for a control that must not take
 * one.
 *
 * `TextInput` puts its `input`/`input-sm` classes on a wrapping `<label class="input">` when the
 * field has an icon, and on the `<input>` itself when it does not — so `input-error` has to land on
 * whichever of the two is actually the styled shell, or the red border silently does nothing on
 * three of the four text fields.
 *
 * A CHECKBOX GETS NOTHING. The house rule is one neutral checkbox (CLAUDE.md), so the terms box
 * does not turn red; `input-error` on a `.checkbox` would also be a class borrowed from a component
 * it does not belong to. Its refusal is carried by the message below it and by `aria-invalid`,
 * which is the part that actually reaches a screen reader.
 */
export function controlShell(
  el: HTMLInputElement,
  kind: WelcomeRequiredField['kind'],
): HTMLElement | null {
  if (kind === 'checkbox') return null;
  return el.closest<HTMLElement>('label.input') ?? el;
}
