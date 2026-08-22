/**
 * The one chat conversation. There is exactly one surface for it — the drawer.
 *
 * A `/chat/` page used to exist alongside it, and the two shared this file so a visitor could not
 * get a second free allowance by switching surface. The page is gone (Oleh, 2026-08-18): a second
 * place to hold the same conversation meant you could be reading the docs in one tab and talking
 * about them in another, with the page you were asking about no longer on screen — the exact thing
 * the drawer exists to prevent. Every ask affordance now opens the drawer instead.
 *
 * The transcript, the spend and the draft still live in `localStorage`, which is what carries the
 * conversation across Starlight's full-page navigations.
 *
 * WHY `localStorage` AND NOT `sessionStorage`: session storage is per-TAB. The budget reset in
 * every new tab, so a reviewer never met the gate at all, and it held the counter WITHOUT the
 * transcript, so a reload wiped the answers and kept the spend.
 *
 * This is still UX, not security — the real limit is enforced server-side in KV with the engine
 * (spec tasks 2.2 / 3.2). Anyone can clear storage. The job is to be honest to an honest visitor.
 *
 * ── SOURCES ARE REAL TODAY, AND THAT IS THE POINT ──────────────────────────────────────────────
 * There is no answering engine yet; the reply is a stub. Citing invented pages under it would be
 * the exact defect this repo keeps removing — a confident surface making a claim nothing backs.
 * So the sources are not invented: the question is run through the SAME Pagefind index the docs
 * search uses, and what gets cited is the set of pages that genuinely matched. That makes the stub
 * immediately useful — the visitor gets pages they can open — and when the engine lands it fills
 * the same slot with its own retrieval set without a UI change.
 *
 * Research called chat's dead end ("check the docs sidebar") the weakest join in the portal. This
 * is the join: an answer that hands back the documents it leaned on, as links.
 */
import { searchDocs, type DocHit } from './pagefind';

const KEY_USED = 'support-chat-used';
const KEY_LOG = 'support-chat-log';
const KEY_OPEN = 'support-chat-open';
const KEY_DRAFT = 'support-chat-draft';

const SOURCE_LIMIT = 6;

export interface Turn {
  cls: string;
  body: string;
  /** The page the question was asked from — present only when the visitor kept the page chip. */
  ctx?: string;
  /** Docs cited under an answer. Real matches, never fabricated — see the header note. */
  sources?: DocHit[];
}

export interface ChatEls {
  messages: HTMLElement;
  form: HTMLFormElement;
  input: HTMLInputElement;
  gate: HTMLElement;
  left: HTMLElement;
}

export const readLog = (): Turn[] => {
  try {
    return JSON.parse(localStorage.getItem(KEY_LOG) ?? '[]') as Turn[];
  } catch {
    return [];
  }
};
export const used = (): number => Number(localStorage.getItem(KEY_USED) ?? '0');

export const isOpen = (): boolean => localStorage.getItem(KEY_OPEN) === '1';
export const setOpen = (open: boolean): void => localStorage.setItem(KEY_OPEN, open ? '1' : '0');

export const readDraft = (): string => localStorage.getItem(KEY_DRAFT) ?? '';
export const writeDraft = (v: string): void => {
  if (v) localStorage.setItem(KEY_DRAFT, v);
  else localStorage.removeItem(KEY_DRAFT);
};

const esc = (s: string) =>
  s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

/** Lucide `file-text`, inlined — the portal has no icon runtime of its own. */
const ICON_DOC =
  '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M16 13H8"/><path d="M16 17H8"/></svg>';

/**
 * `<details>` rather than a scripted disclosure: the browser gives us the toggle, the keyboard
 * behaviour and the open state for free, and the list survives a transcript replay because it is
 * rebuilt from stored data rather than from a live component.
 */
function sourcesMarkup(sources: DocHit[]): string {
  if (!sources.length) return '';
  const items = sources
    .map(
      (s) =>
        `<li><a href="${esc(s.url)}">${ICON_DOC}<span>${esc(s.title)}</span></a></li>`,
    )
    .join('');
  const n = sources.length;
  return (
    `<details class="msg-sources"><summary>Used ${n} source${n === 1 ? '' : 's'}</summary>` +
    `<ul>${items}</ul></details>`
  );
}

/**
 * @param context Title of the page this surface is scoped to, or undefined when the visitor has
 *                dismissed the page chip, or there is no page to scope to. Read at SEND time, not
 *                at wire time, so dismissing the chip takes effect on the next question.
 */
/**
 * @param platforms The reader's platform scope, or undefined for all of them. Like `context` it is
 *                  read at SEND time: the answer cites the docs, so a chat that ignored the filter
 *                  would answer a Notion question out of Airtable's pages — a wrong answer, not a
 *                  cosmetic mismatch. That is why the scope belongs in retrieval and not only in
 *                  the chrome.
 */
export function wireChat(
  els: ChatEls,
  budget: number,
  context: () => string | undefined,
  platforms: () => string[] | undefined = () => undefined,
): void {
  const { messages, form, input, gate, left } = els;
  const log = readLog();

  const paint = (t: Turn) => {
    const el = document.createElement('div');
    el.className = `msg ${t.cls}`;
    const body = document.createElement('div');
    body.className = 'msg-body';
    body.textContent = t.body;
    el.append(body);
    if (t.sources?.length) el.insertAdjacentHTML('beforeend', sourcesMarkup(t.sources));
    messages.append(el);
    return el;
  };

  const showLeft = () => {
    const n = Math.max(0, budget - used());
    left.textContent = n === 0 ? '' : `${n} of ${budget} free messages left`;
  };

  const gateIfSpent = () => {
    if (used() >= budget) {
      form.hidden = true;
      gate.hidden = false;
    }
    showLeft();
  };

  /* Replay before gating, so a reload does not charge for answers it then hides. */
  for (const t of log) paint(t);
  messages.scrollTop = messages.scrollHeight;
  gateIfSpent();

  const draft = readDraft();
  if (draft && !form.hidden) input.value = draft;

  input.addEventListener('input', () => writeDraft(input.value));

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const text = input.value.trim();
    if (!text) return;

    const add = (t: Turn) => {
      paint(t).scrollIntoView({ block: 'end' });
      log.push(t);
      localStorage.setItem(KEY_LOG, JSON.stringify(log));
    };

    add({ cls: 'user', body: text, ctx: context() });
    input.value = '';
    writeDraft('');
    localStorage.setItem(KEY_USED, String(used() + 1));
    showLeft();

    /* The retrieval is real even though the answer is not. A page scope, when the visitor kept the
       chip, is folded into the query so the cited set leans towards what they were reading. */
    const scope = context();
    const query = scope ? `${text} ${scope}` : text;
    const narrowed = platforms();
    void searchDocs(query, SOURCE_LIMIT, narrowed).then(async (sources) => {
      /* AN EMPTY RESULT MUST NAME ITS OWN CAUSE. "Nothing in the docs matched that" is false when
         the platform scope is what hid the match, and it sends the reader to open a ticket about a
         question the documentation already answers. The count comes from a second, unfiltered
         search run only in this case, so the scope is blamed only when it is actually responsible —
         the same rule the search modal's empty state follows. */
      const hiddenByScope =
        narrowed && !sources.length ? (await searchDocs(query, SOURCE_LIMIT)).length : 0;
      add({
        cls: 'bot',
        body: sources.length
          ? 'The support assistant is coming online soon, so this is not an answer yet — but these are the pages that match what you asked.'
          : hiddenByScope > 0
            ? `Nothing matched in the platforms you picked, though ${hiddenByScope} page${
                hiddenByScope === 1 ? '' : 's'
              } match${hiddenByScope === 1 ? 'es' : ''} in the others — turn one back on above to see them.`
            : 'The support assistant is coming online soon. Nothing in the docs matched that yet; open a ticket if you’re signed in.',
        sources,
      });
      gateIfSpent();
    });
  });
}
