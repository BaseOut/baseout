/**
 * Shared UI utilities — keeps component scripts DRY.
 */

/** Join class tokens, dropping falsy values (replaces `.filter(Boolean).join(' ')` everywhere). */
export function cn(...classes: (string | false | null | undefined | 0)[]): string {
  return classes.filter(Boolean).join(' ');
}

/** Derive a stable element ID from the first truthy value among id / name / label. */
export function inputId(id?: string, name?: string, label?: string): string | undefined {
  return id || name || label?.toLowerCase().replace(/\s+/g, '-');
}

/**
 * Escape a plain string for safe HTML interpolation, then promote `*…*` runs to
 * `<strong>…</strong>`. Lets copy-carrying modules (e.g. the connection-health
 * banner) mark emphasis inline without hand-writing markup or risking injection —
 * the escape runs first, so only our own asterisk markers become tags.
 */
export function emph(text: string): string {
  const escaped = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  return escaped.replace(/\*([^*]+)\*/g, '<strong>$1</strong>');
}

/**
 * Toggle a daisyUI loading spinner inside a submit button while waiting on the server.
 * Idempotent: safe to call repeatedly with the same value.
 * Call from a `finally` block so the spinner always clears on error or throw.
 */
export function setButtonLoading(btn: HTMLButtonElement, loading: boolean): void {
  btn.disabled = loading;
  btn.setAttribute('aria-busy', loading ? 'true' : 'false');
  const existing = btn.querySelector<HTMLElement>('[data-loading-spinner]');
  if (loading && !existing) {
    const span = document.createElement('span');
    span.dataset.loadingSpinner = '';
    span.className = 'loading loading-spinner loading-sm';
    btn.insertBefore(span, btn.firstChild);
  } else if (!loading && existing) {
    existing.remove();
  }
}

/**
 * Client-side file download via a Blob + a transient anchor (web-schema-export).
 * Used by the Schema tabs that answer the ExportControl's `schema:export` event
 * with a real CSV. The object URL is revoked immediately — Blob data stays alive
 * for the duration of the click it is dispatched from.
 */
export function downloadTextFile(filename: string, text: string, mime = 'text/csv'): void {
  const url = URL.createObjectURL(new Blob([text], { type: `${mime};charset=utf-8` }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
