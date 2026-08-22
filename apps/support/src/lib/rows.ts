/**
 * The one row vocabulary for every result list in the portal.
 *
 * Three surfaces show the same kinds of row — the hero's search-or-ask field, the ⌘K modal, and the
 * chat's citations. They were drifting into separate copies of the same markup and the same
 * escaping, which is how two of them end up with different keyboard behaviour and one ends up with
 * an injection. One definition, three callers.
 *
 * Rows are HTML strings rather than components because they are rebuilt on every keystroke from
 * data the server never saw; `innerHTML` on a container is the right tool for that, and it is why
 * `esc` is not optional. Pagefind's `excerpt` is the deliberate exception: it arrives with `<mark>`
 * around the matched terms and is inserted as markup, which is safe because it is the index's own
 * output over our own build.
 */
import type { DocHit } from './pagefind';

export const esc = (s: string): string =>
  s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

export const ICON_ASK =
  '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"/></svg>';

export const ICON_DOC =
  '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M10 9H8"/><path d="M16 13H8"/><path d="M16 17H8"/></svg>';

export const ICON_CLOCK =
  '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>';

/**
 * Asking is a DRAWER, never a destination.
 *
 * These rows used to be links to a `/chat/` page. That page is gone (Oleh, 2026-08-18): a second
 * place to hold the same conversation meant a visitor could be reading the docs in one tab and
 * talking about them in another, with the page they were asking about no longer on screen. The
 * drawer keeps the question and its subject together, which was the whole argument for it.
 *
 * So an ask row carries `data-open-chat` and its query, and whoever owns the list dispatches
 * `support:open-chat`. It stays an `<a href="#">` rather than a `<button>` so it keeps its place in
 * a `role="listbox"` beside real links — same keyboard, same Enter, one row vocabulary.
 */
export const OPEN_CHAT_EVENT = 'support:open-chat';

/** Always first, and therefore also the answer when there are no documents at all. */
export const askRow = (q: string): string =>
  `<a class="sh-row sh-row-ask" role="option" aria-selected="true" href="#" data-open-chat data-q="${esc(q)}">` +
  `<span class="sh-row-icon">${ICON_ASK}</span>` +
  `<span class="sh-row-body">` +
  `<span class="sh-row-title">Ask Baseout</span>` +
  `<span class="sh-row-sub">“${esc(q)}”</span>` +
  `</span><span class="sh-row-hint">Enter</span></a>`;

export const docRow = (r: DocHit): string =>
  `<a class="sh-row" role="option" aria-selected="false" href="${esc(r.url)}">` +
  `<span class="sh-row-icon">${ICON_DOC}</span>` +
  `<span class="sh-row-body">` +
  `<span class="sh-row-title">${esc(r.title)}</span>` +
  `<span class="sh-row-sub">${r.excerpt}</span>` +
  `</span></a>`;

/** A plain link row: no excerpt, an icon that says what kind of thing it is. */
export const linkRow = (label: string, href: string, icon: string, sub?: string): string =>
  `<a class="sh-row" role="option" aria-selected="false" href="${esc(href)}"${href === '#' ? ' data-open-chat data-q=""' : ''}>` +
  `<span class="sh-row-icon">${icon}</span>` +
  `<span class="sh-row-body">` +
  `<span class="sh-row-title">${esc(label)}</span>` +
  (sub ? `<span class="sh-row-sub">${esc(sub)}</span>` : '') +
  `</span></a>`;

export const groupLabel = (text: string): string => `<p class="sh-group">${esc(text)}</p>`;
