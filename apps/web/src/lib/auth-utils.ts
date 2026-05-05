/** Show an inline error message in an auth form. */
export function showFormError(errorEl: HTMLElement, textEl: HTMLElement, message: string): void {
  textEl.textContent = message;
  errorEl.classList.remove('hidden');
}

/** Hide an inline error message. */
export function hideFormError(errorEl: HTMLElement): void {
  errorEl.classList.add('hidden');
}

/** Show an inline success message in a form. */
export function showFormSuccess(successEl: HTMLElement, textEl: HTMLElement, message: string): void {
  textEl.textContent = message;
  successEl.classList.remove('hidden');
}

/** Hide an inline success message. */
export function hideFormSuccess(successEl: HTMLElement): void {
  successEl.classList.add('hidden');
}
