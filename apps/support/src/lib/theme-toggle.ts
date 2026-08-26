/**
 * The two-state theme control's behaviour. Separated from the component for one reason: `astro check`
 * does not walk `<script>` inside an `.astro` file, so logic left there is unchecked by every gate
 * this repo has. A `.ts` module beside it is read.
 *
 * IT WRITES WHAT STARLIGHT READS. The key, the values and the `<html>` attribute are Starlight's own
 * (`components/ThemeSelect.astro`, `components/ThemeProvider.astro`): `starlight-theme` in
 * `localStorage`, an empty string meaning "follow the system", and `dataset.theme` set to a resolved
 * `light` or `dark`. Writing anywhere else would leave the pre-paint script reading a preference the
 * control never set, and the page would flash the other theme on every load.
 */
type Resolved = 'light' | 'dark';

const STORAGE_KEY = 'starlight-theme';

/** What the document is showing right now, which is the only thing the button needs to know. */
function current(): Resolved {
  const attr = document.documentElement.dataset.theme;
  if (attr === 'light' || attr === 'dark') return attr;
  /* No attribute yet means the provider has not resolved one, so ask the system the same way it
     would. `matchMedia` on light rather than dark to match Starlight's own expression exactly. */
  return matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}

function apply(theme: Resolved): void {
  document.documentElement.dataset.theme = theme;
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    /* Private mode. The theme still changes for this page; it just will not survive a reload, which
       is a better outcome than a control that throws and does nothing. */
  }
}

/** The label is the ACTION, not the state, so it has to move with the theme rather than be written
 *  once into the markup. Kept beside the icon rule in the component: both answer "which way now". */
function label(el: HTMLElement, showing: Resolved): void {
  el.setAttribute('aria-label', showing === 'dark' ? 'Switch to light theme' : 'Switch to dark theme');
}

export function wireThemeToggle(): void {
  for (const el of document.querySelectorAll<HTMLButtonElement>('[data-theme-toggle]')) {
    label(el, current());
    el.addEventListener('click', () => {
      const next: Resolved = current() === 'dark' ? 'light' : 'dark';
      apply(next);
      for (const other of document.querySelectorAll<HTMLElement>('[data-theme-toggle]')) {
        label(other, next);
      }
    });
  }
}
