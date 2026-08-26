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
  /** The `Email support` control. Optional so a surface without an exit still wires a chat. */
  escalate?: HTMLElement;
  /** The row that holds it — carries the promoted flag, so the weight change is one attribute. */
  foot?: HTMLElement;
  /** The one line that says why the control was promoted. Hidden until it has been. */
  why?: HTMLElement;
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

/* ── The exit to a person ──────────────────────────────────────────────────────────────────────
 *
 * The chat is AI and reaches nobody. The exit is a DESTINATION CHANGE — `/contact/?kind=ticket` —
 * and the whole job of this section is that the person does not have to say their question again
 * on the far side of it.
 *
 * WHY THE PAYLOAD TRAVELS IN `sessionStorage` AND NOT IN THE URL. Three reasons, in the order they
 * bite. A query string has a practical length limit, and a five-turn conversation carrying document
 * titles passes it — the failure is a truncated payload, which is worse than none because nobody
 * can see where it was cut. Everything in a URL is written to browser history, to any edge access
 * log in front of this site and into the `Referer` of the next request, and a Baseout chat about a
 * failing restore carries base names, table names and pasted error ids; the payload is the one
 * thing on this page that must not leak past the tab it was typed in. And `sessionStorage` is
 * per-TAB, which is exactly the lifetime of a draft nobody has sent: it survives the same-tab
 * navigation this is, and it dies with the tab rather than living on in a shareable link. (The
 * transcript itself stays in `localStorage` for the opposite reason — see the header.)
 *
 * The URL still carries `?kind=ticket&from=chat`. `kind` because `submit.ts` already reads it and
 * opens the right door; `from` because a payload left behind by an abandoned handoff must not be
 * picked up by somebody who typed the contact URL themselves — the arrival has to declare itself.
 */
const KEY_HANDOFF = 'support-handoff';

export interface Handoff {
  /** The person's own messages, VERBATIM. Never summarised — see `buildHandoff`. */
  question: string;
  /** Everything we collected ABOUT them, as editable plain text. */
  block: string;
  /** How many of their messages `question` carries, for the label on the other side. */
  asked: number;
}

export const readHandoff = (): Handoff | null => {
  try {
    const raw = sessionStorage.getItem(KEY_HANDOFF);
    return raw ? (JSON.parse(raw) as Handoff) : null;
  } catch {
    return null;
  }
};

export const clearHandoff = (): void => {
  try {
    sessionStorage.removeItem(KEY_HANDOFF);
  } catch {
    /* Private mode, or storage denied. Nothing was stored, so nothing has to be removed. */
  }
};

const writeHandoff = (h: Handoff): boolean => {
  try {
    sessionStorage.setItem(KEY_HANDOFF, JSON.stringify(h));
    return true;
  } catch {
    /* Storage denied. The handoff still navigates — the person lands on the right door and writes
       it themselves, which is where they were before this feature existed. Silently losing the
       context is a smaller failure than refusing to leave the chat. */
    return false;
  }
};

/**
 * How many answers IN A ROW cited nothing.
 *
 * THE COUNTER IS NOT INVENTED, and that matters: every bot turn already records the documents it
 * leaned on, because the answer renders them. A separate tally kept beside the log would be a
 * second version of the same fact, and the two would part company the first time a turn was
 * replayed from storage rather than added live. This reads the log itself, so a reload cannot
 * disagree with the session that produced it.
 */
export const PROMOTE_AT = 2;

export function noCiteStreak(log: Turn[]): number {
  let n = 0;
  for (let i = log.length - 1; i >= 0; i -= 1) {
    const t = log[i];
    if (!t || t.cls !== 'bot') continue;
    if (t.sources?.length) break;
    n += 1;
  }
  return n;
}

/** Up to three of the person's own messages, and up to three of the assistant's answers. */
const CARRY = 3;

/**
 * The assistant's side, SHORTENED — first sentence, capped.
 *
 * The rule is asymmetric on purpose and it is the load-bearing rule of the whole payload: the
 * person's words are carried verbatim and ours are not. Summarising the customer is how a handoff
 * loses the one fact the human needed; transcribing the machine is how the human ends up reading
 * the conversation instead of the problem.
 */
function condense(body: string): string {
  const first = body.split(/(?<=[.!?])\s/)[0] ?? body;
  const one = first.replace(/\s+/g, ' ').trim();
  return one.length > 160 ? `${one.slice(0, 157).trimEnd()}…` : one;
}

/**
 * Builds the two halves of the payload from the conversation as it stands.
 *
 * @param page  The title of the page the chat was opened on, when the visitor kept the chip.
 * @param path  The path they were on at press time — for a backup tool the surface someone was
 *              reading is half the diagnosis, and it is known even when the chip was dismissed.
 */
export function buildHandoff(log: Turn[], page: string | undefined, path: string): Handoff {
  const asked = log.filter((t) => t.cls === 'user').map((t) => t.body);
  const mine = asked.slice(-CARRY).reverse();

  const answers = log
    .filter((t) => t.cls === 'bot')
    .slice(-CARRY)
    .reverse()
    .map((t) => condense(t.body));

  /* One entry per document, however many answers reached for it. */
  const cited = new Map<string, string>();
  for (const t of log) for (const s of t.sources ?? []) cited.set(s.url, s.title);

  const streak = noCiteStreak(log);
  const why =
    streak >= PROMOTE_AT
      ? `the assistant answered ${streak} times in a row without finding a documentation page`
      : 'you asked for a person';

  const when = new Date().toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  const lines = [
    `From your chat, ${when}`,
    `Page you were on: ${page ? `${page} — ${path}` : path}`,
    '',
    'What the assistant answered:',
    ...(answers.length ? answers.map((a) => `- ${a}`) : ['- nothing yet']),
    '',
    'Pages it cited that did not help:',
    ...(cited.size
      ? [...cited].map(([url, title]) => `- ${title} — ${url}`)
      : ['- none; it found no page to cite']),
    '',
    `Why this is here: ${why}.`,
  ];

  return { question: mine.join('\n\n'), block: lines.join('\n'), asked: mine.length };
}

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
  const { messages, form, input, gate, left, escalate, foot, why } = els;
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

  /* ── The exit, and when it grows ────────────────────────────────────────────────────────────
     THE CONTROL IS THERE FROM THE FIRST TURN and it never goes away; what changes is its weight.
     Promotion is a data attribute on one row, so the change is a border and a fill rather than a
     new control appearing under the cursor — a popup at the moment somebody is losing patience is
     the doom loop with an interruption on top. The reason line is shown WITH the promotion,
     because a control that quietly got louder and said nothing reads as the page glitching.

     It sits OUTSIDE the form on purpose: when the free budget is spent the composer is hidden, and
     that is the moment the exit matters most. An affordance that disappears with the thing it was
     an escape from is not an escape. */
  const syncEscalation = () => {
    const promoted = noCiteStreak(log) >= PROMOTE_AT;
    if (foot) foot.dataset.promoted = promoted ? '1' : '';
    if (why) why.hidden = !promoted;
  };

  escalate?.addEventListener('click', () => {
    writeHandoff(buildHandoff(log, context(), location.pathname));
    /* ── CLOSE THE DRAWER ON THE WAY OUT (Oleh, 2026-08-26: "клікаю, нічого не відбувається") ────
       It navigated correctly the whole time — `/contact/?kind=ticket&from=chat`, handoff written,
       the `ticket` step open with its `From your chat` block rendered. What it did not do was LEAVE.
       The open flag is persisted, so `wirePanel` restored the drawer over the page it had just gone
       to, and the reader pressed a button and went on looking at the same conversation.

       Measured after the click: `html[data-chat]` still `open`, the panel visible at x=1072 (1440)
       and x=656 (1024). Harmless-looking on a desktop, where the page changes beside the dock and
       you can see it happen. Below 1280 it is a dead end and that is my doing: the drawer became a
       scrimmed overlay with the page behind it `inert`, so the form loaded completely hidden, three
       inert siblings deep, with no visible evidence anything had happened at all.

       ONE LINE, AND IT IS THE STATE RATHER THAN THE ELEMENT. `setOpen` is the flag `chat-panel.ts`
       reads on the next page to decide whether to restore, so writing it here means the destination
       renders closed rather than opening and then being dismissed. Hiding the panel instead would
       have fixed the frame we are leaving and not the one we are going to. */
    setOpen(false);
    location.href = '/contact/?kind=ticket&from=chat';
  });

  /* Replay before gating, so a reload does not charge for answers it then hides. */
  for (const t of log) paint(t);
  messages.scrollTop = messages.scrollHeight;
  gateIfSpent();
  syncEscalation();

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
      syncEscalation();
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
            : /* THE DEAD END USED TO BE PRINTED HERE as a path the reader had to retype into the
                 address bar. It is a control now, one row below this message, and it carries the
                 conversation with it — so this line states the fact and stops. */
              'The support assistant is coming online soon. Nothing in the docs matched that yet.',
        sources,
      });
      gateIfSpent();
    });
  });
}
