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
