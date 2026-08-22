/**
 * "Recently viewed", for the ⌘K modal's resting state.
 *
 * Before anyone types, a docs site's best suggestion is usually a page they were already on — the
 * half-read guide they navigated away from. Stripe opens its modal with exactly that, and it costs
 * one write per page load.
 *
 * The landing is excluded: it is where you search FROM, not somewhere you return to.
 */
const KEY = 'support-recent';
const CAP = 4;

export interface Recent {
  title: string;
  url: string;
}

export const readRecent = (): Recent[] => {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? '[]') as Recent[];
    return Array.isArray(v) ? v.filter((r) => r && typeof r.url === 'string' && typeof r.title === 'string') : [];
  } catch {
    return [];
  }
};

/** Most recent first, de-duplicated by url, capped. */
export function recordVisit(title: string, url: string): void {
  if (url === '/' || !title) return;
  const rest = readRecent().filter((r) => r.url !== url);
  try {
    localStorage.setItem(KEY, JSON.stringify([{ title, url }, ...rest].slice(0, CAP)));
  } catch {
    /* Storage can be full or blocked. A missing suggestion list is not worth an exception. */
  }
}
