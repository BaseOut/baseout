/**
 * Theme controller for the daisyUI [data-theme] swap.
 *
 * Single source of truth for the dark/light toggle. The inline FOUC script in
 * Layout.astro owns the very first paint; this module owns every subsequent
 * change. Wraps the mutation in document.startViewTransition() where supported
 * so the whole viewport cross-fades as one paint instead of trickling.
 */

export type ThemeMode = 'dark' | 'light';

const STORAGE_KEY = 'theme';
const DARK_THEME = 'baseout';
const LIGHT_THEME = 'baseout-light';
const CHANGE_EVENT = 'baseout:theme-change';
const SWAP_END_EVENT = 'baseout:theme-swap-end';
const WIRED_ATTR = 'data-theme-wired';
const SWAP_CLASS = 'theme-swapping';

declare global {
  interface DocumentEventMap {
    'baseout:theme-change': CustomEvent<{ mode: ThemeMode }>;
    'baseout:theme-swap-end': CustomEvent<{ mode: ThemeMode }>;
  }
}

function prefersDark(): boolean {
  return typeof window !== 'undefined'
    && typeof window.matchMedia === 'function'
    && window.matchMedia('(prefers-color-scheme: dark)').matches;
}

/** Stored preference wins; otherwise fall back to OS preference; otherwise light. */
export function getInitialTheme(): ThemeMode {
  let stored: string | null = null;
  try { stored = localStorage.getItem(STORAGE_KEY); } catch { /* private mode */ }
  if (stored === 'dark' || stored === 'light') return stored;
  return prefersDark() ? 'dark' : 'light';
}

export interface ApplyThemeOptions {
  /** Wrap the swap in document.startViewTransition() when available. Default: true. */
  animate?: boolean;
  /** Persist the choice to localStorage. Default: true. */
  persist?: boolean;
}

/**
 * Apply `mode` to <html>'s [data-theme], optionally persisting and animating.
 * Dispatches `baseout:theme-change` on document so sibling toggles can re-reflect.
 */
export function applyTheme(mode: ThemeMode, options: ApplyThemeOptions = {}): void {
  const { animate = true, persist = true } = options;
  const root = document.documentElement;

  // Suppressing per-element transitions during the swap is what makes the
  // view-transition cross-fade smooth. Without this, every element with its
  // own `transition-colors` keeps animating independently for 150–300 ms,
  // out of sync with the 220 ms root cross-fade.
  const swap = () => {
    root.classList.add(SWAP_CLASS);
    root.setAttribute('data-theme', mode === 'dark' ? DARK_THEME : LIGHT_THEME);
    if (persist) {
      try { localStorage.setItem(STORAGE_KEY, mode); } catch { /* private mode */ }
    }
    document.dispatchEvent(new CustomEvent(CHANGE_EVENT, { detail: { mode } }));
  };

  const startViewTransition = (document as Document & {
    startViewTransition?: (cb: () => void) => { finished: Promise<void> };
  }).startViewTransition;

  const finish = () => {
    root.classList.remove(SWAP_CLASS);
    document.dispatchEvent(new CustomEvent(SWAP_END_EVENT, { detail: { mode } }));
  };

  if (animate && typeof startViewTransition === 'function') {
    const transition = startViewTransition.call(document, swap);
    transition.finished.finally(finish);
  } else {
    swap();
    requestAnimationFrame(() => requestAnimationFrame(finish));
  }
}

/**
 * Wire a checkbox input to the theme system. Idempotent — repeat calls on the
 * same input (e.g. after astro:after-swap) reuse the existing listeners.
 */
export function wireThemeToggle(input: HTMLInputElement): void {
  if (input.hasAttribute(WIRED_ATTR)) {
    input.checked = getInitialTheme() === 'dark';
    return;
  }
  input.setAttribute(WIRED_ATTR, '');
  input.checked = getInitialTheme() === 'dark';

  input.addEventListener('change', () => {
    // Pin the parent daisyUI dropdown open across the swap. The dropdown's
    // visibility is driven by `:focus-within` + the 200 ms `@keyframes dropdown`
    // fade-in (see daisyUI v5 source). View transitions can perturb either of
    // those, making the menu visibly close-and-reopen during the cross-fade.
    // The `data-theme-swap-pin` attribute is paired with a CSS rule in
    // global.css that force-locks the dropdown-content to its visible state.
    const dropdown = input.closest<HTMLElement>('.dropdown');
    if (dropdown) {
      dropdown.setAttribute('data-theme-swap-pin', '');
      const unpin = () => {
        dropdown.removeAttribute('data-theme-swap-pin');
        document.removeEventListener(SWAP_END_EVENT, unpin);
      };
      document.addEventListener(SWAP_END_EVENT, unpin);
    }
    applyTheme(input.checked ? 'dark' : 'light');
  });

  document.addEventListener(CHANGE_EVENT, (e) => {
    input.checked = e.detail.mode === 'dark';
  });
}
