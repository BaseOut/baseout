/**
 * Shared view helpers for the report-detail layouts. Extracted so both layout bodies
 * (ReportBodyKpi = KPI-band + tables, ReportBodyLedger = one unified ledger) render the same
 * badges/deltas/formatters without duplicating them, and so the .astro frontmatter stays thin.
 */
import type { Delta } from './types';
import { fmtDay } from '../time';

export const nf = new Intl.NumberFormat('en-US');
export function docWhen(iso: string): string {
  return fmtDay(iso);
}

/** Delta colour: an "up" that is good (more backups) is success; a bad "up" (more failures) is error. */
export function deltaClass(d?: Delta): string {
  if (!d || d.dir === 'flat') return 'text-base-content/65';
  const good = d.dir === 'up' ? d.goodWhenUp : !d.goodWhenUp;
  return good ? 'text-success' : 'text-error';
}

/**
 * THE REPORTS BADGE VOCABULARY, as `Badge.astro` variants rather than daisyUI class strings.
 *
 * Every one of these maps used to hand out a class list ('badge-soft badge-warning'), and every
 * call site pasted it next to a literal `badge badge-sm`. That is the catalog primitive rebuilt by
 * hand at twenty sites: it is how `badge-soft badge-neutral` reaches a screen (1.34:1 in dark —
 * X08-F6), and it is why a rule change has to be applied twenty times instead of once. The maps now
 * name a VARIANT, the views pass it to `<Badge>`, and no report file spells a daisyUI badge class.
 *
 * `neutral` deliberately resolves to the primitive's `default`, which is `badge-ghost` (17.40:1 dark
 * / 16.29:1 light) — the neutral that is actually readable. It is also the D43 fallback for a tone
 * nobody recognises: a badge that asserts nothing is honest, a badge that borrows green is not.
 */
export type ReportBadgeVariant = 'default' | 'primary' | 'success' | 'warning' | 'error';

export const toneBadge: Record<string, ReportBadgeVariant> = {
  success: 'success',
  warning: 'warning',
  error: 'error',
  neutral: 'default',
  primary: 'primary',
};
export const toneBadgeOf = (t: string): ReportBadgeVariant => toneBadge[t] ?? 'default';

/**
 * X08-F7 — the KPI status dot's fill, as FIVE STATIC LITERALS.
 *
 * `ReportBodyKpi.astro` built this class by interpolation:
 * `` `bg-${s.tone === 'neutral' ? 'base-content/40' : s.tone}` ``. Tailwind scans SOURCE TEXT; it
 * never sees a string assembled at runtime, so the utility was never emitted and the `neutral`
 * branch painted an 8px hole. Measured on `/reports/run/r-2026-07-13`: the computed fill for
 * `bg-base-content/40` came back fully TRANSPARENT, while `bg-warning` and `bg-success` returned real
 * amber and green on the same host in the same call — the semantic branches only worked because those
 * exact strings happen to appear literally elsewhere in the tree.
 *
 * A map is the fix rather than `@source inline(...)`: the safelist makes the class exist but leaves
 * the call site still doing string arithmetic, so the next tone added is broken again in the same
 * way and silently. Here the literal IS the value, and this file is inside
 * `@source "../**\/*.{astro,ts,tsx,html,mdx}"` (`global.css:14`) — the same scan that already emits
 * `toneBadge` above.
 *
 * `neutral` is also the fallback, and that is not a D43 violation: neutral is the paint that asserts
 * NOTHING, so an unrecognised tone reads as "no verdict" instead of borrowing green or amber. A dot
 * carries no word, so `Unknown` has nowhere to go — the honest option is the colourless one.
 */
export const toneDot: Record<string, string> = {
  success: 'bg-success',
  warning: 'bg-warning',
  error: 'bg-error',
  primary: 'bg-primary',
  neutral: 'bg-base-content/40',
};
export const toneDotOf = (t: string): string => toneDot[t] ?? toneDot.neutral;

export const sectionEmptyAlert: Record<string, string> = {
  success: 'alert-success',
  warning: 'alert-warning',
  error: 'alert-error',
};

export const changeTone: Record<string, ReportBadgeVariant> = {
  neutral: 'default',
  warning: 'warning',
  error: 'error',
};
export const changeToneOf = (t: string): ReportBadgeVariant => changeTone[t] ?? 'default';

export const backupBadge: Record<string, { label: string; badge: ReportBadgeVariant }> = {
  ok: { label: 'Backed up', badge: 'success' },
  partial: { label: 'Partial', badge: 'warning' },
  failed: { label: 'Failed', badge: 'error' },
};

export const connBadge: Record<string, { label: string; badge: ReportBadgeVariant }> = {
  connected: { label: 'Connected', badge: 'success' },
  auth_failed: { label: 'Auth failed', badge: 'error' },
  broken: { label: 'Broken', badge: 'error' },
};

/**
 * D43 — an unrecognised outcome/status gets its OWN word, never an alias.
 *
 * `backupBadge[x] || backupBadge.failed` would have painted every unknown outcome red and called it
 * Failed, which is a claim about a run nobody made. `Unknown` in the readable neutral says exactly
 * what is true: the registry does not recognise this value.
 */
export const UNKNOWN_BADGE: { label: string; badge: ReportBadgeVariant } = { label: 'Unknown', badge: 'default' };

/** Source/Destination detail link for a connection row (C4), or null if the id is missing. */
export function connUrl(kind: 'source' | 'destination', id?: string): string | null {
  return id ? `${kind === 'source' ? '/sources/detail' : '/destinations/detail'}?id=${id}` : null;
}

/**
 * RECIPIENT CHIP PAINT — the one Reports badge that is built at RUNTIME.
 *
 * `RecipientInput` creates its chips with `document.createElement` as the user types, so no Astro
 * component can render them and the class string has to exist somewhere. It lives HERE, next to the
 * rest of the badge vocabulary, rather than inline in the component: a class list typed inside a
 * `<script>` is invisible to every reader looking for how this app paints a badge, and it is where
 * `badge-soft badge-neutral` gets in unnoticed.
 *
 * `external` is the neutral case and takes `badge-ghost` (17.40:1 dark / 16.29:1 light) — never the
 * soft neutral, which measures 1.34:1 dark. Each value is a whole LITERAL, not `badge-soft badge-${…}`:
 * Tailwind scans source text and never sees a string assembled at runtime, which is how an
 * interpolated badge class reads 0 in a verify grep while every route serves it.
 */
export const RECIPIENT_CHIP_BADGE: Record<'member' | 'external' | 'invalid', string> = {
  member: 'badge-soft badge-primary',
  external: 'badge-ghost',
  invalid: 'badge-soft badge-error',
};
