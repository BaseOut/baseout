/**
 * Theme controller for the daisyUI [data-theme] swap.
 *
 * Single source of truth for the dark/light toggle. The inline FOUC script in
 * Layout.astro owns the very first paint; this module owns every subsequent
 * change. The swap is a plain, instant [data-theme] attribute set — daisyUI's
 * CSS variables repaint in one frame, so there is nothing to animate and
 * nothing to fall out of sync. (Mirrors apps/web's sibling `okb` project,
 * which is seamless precisely because it does no view-transition cross-fade.)
 */

export type ThemeMode = 'dark' | 'light';

const STORAGE_KEY = 'theme';
const DARK_THEME = 'baseout';
const LIGHT_THEME = 'baseout-light';
const CHANGE_EVENT = 'baseout:theme-change';
const WIRED_ATTR = 'data-theme-wired';

declare global {
  interface DocumentEventMap {
    'baseout:theme-change': CustomEvent<{ mode: ThemeMode }>;
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
  /** Persist the choice to localStorage. Default: true. */
  persist?: boolean;
}

/**
 * Apply `mode` to <html>'s [data-theme], optionally persisting. Instant — the
 * attribute set lets daisyUI swap every CSS variable in a single repaint.
 * Dispatches `baseout:theme-change` on document so sibling toggles re-reflect.
 */
export function applyTheme(mode: ThemeMode, options: ApplyThemeOptions = {}): void {
  const { persist = true } = options;
  document.documentElement.setAttribute('data-theme', mode === 'dark' ? DARK_THEME : LIGHT_THEME);
  if (persist) {
    try { localStorage.setItem(STORAGE_KEY, mode); } catch { /* private mode */ }
  }
  document.dispatchEvent(new CustomEvent(CHANGE_EVENT, { detail: { mode } }));
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
    applyTheme(input.checked ? 'dark' : 'light');
  });

  document.addEventListener(CHANGE_EVENT, (e) => {
    input.checked = e.detail.mode === 'dark';
  });
}
