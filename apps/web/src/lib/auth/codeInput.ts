/**
 * codeInput — paints the cells of a `CodeInput.astro` from its ONE real input.
 *
 * The control is a single <input> laid over N presentational cells (see
 * components/code-input.css). All this does is mirror the value into the cells,
 * keep the caret at the end, and strip non-digits. Auto-advance, paste and
 * backspace are the browser's own behaviour — there is deliberately no key
 * handling for them, because every bespoke six-input implementation loses paste
 * or gets stuck on an empty box.
 */

export type CodeInputChange = { value: string; complete: boolean };

function mount(root: HTMLElement): void {
  if (root.dataset.codeInputReady === '1') return;
  root.dataset.codeInputReady = '1';

  const field = root.querySelector<HTMLInputElement>('[data-code-field]');
  const cells = Array.from(root.querySelectorAll<HTMLElement>('[data-code-cell]'));
  if (!field || cells.length === 0) return;

  const caretToEnd = () => {
    const n = field.value.length;
    try {
      field.setSelectionRange(n, n);
    } catch {
      /* type=text always supports selection; guard is for exotic UAs */
    }
  };

  const paint = () => {
    const value = field.value;
    const focused = document.activeElement === field;
    const active = Math.min(value.length, cells.length - 1);
    root.classList.toggle('code-input-focused', focused);
    cells.forEach((cell, i) => {
      const ch = value[i] ?? '';
      cell.textContent = ch;
      cell.classList.toggle('code-cell-filled', ch !== '');
      cell.classList.toggle('code-cell-active', focused && i === active);
    });
  };

  field.addEventListener('input', () => {
    const digits = field.value.replace(/\D/g, '').slice(0, cells.length);
    if (digits !== field.value) field.value = digits;
    caretToEnd();
    paint();
    const detail: CodeInputChange = { value: digits, complete: digits.length === cells.length };
    root.dispatchEvent(new CustomEvent<CodeInputChange>('code-input:change', { bubbles: true, detail }));
  });

  field.addEventListener('focus', () => {
    caretToEnd();
    paint();
  });
  field.addEventListener('blur', paint);
  field.addEventListener('click', caretToEnd);
  // Arrow keys would move the caret into the middle of an invisible field, so the
  // ring and the typing position would disagree. Keep it at the end.
  field.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight' || e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      e.preventDefault();
      caretToEnd();
    }
  });
  // The cells sit above the field visually; a click on one must still land on it.
  root.addEventListener('mousedown', (e) => {
    if (e.target !== field && !field.disabled) {
      e.preventDefault();
      field.focus();
    }
  });

  paint();
}

/** Mount every un-mounted code input under `scope` (idempotent). */
export function initCodeInputs(scope: ParentNode = document): void {
  scope.querySelectorAll<HTMLElement>('[data-code-input]').forEach(mount);
}
