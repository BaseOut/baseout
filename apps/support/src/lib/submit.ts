/**
 * The submit form: the fork, live duplicate detection, attachments, and validation.
 *
 * DUPLICATE DETECTION USES THE DOCS INDEX, not a second search. Every request has its own page at
 * `/roadmap/[slug]`, so Pagefind indexes each one as a document; querying it and keeping the hits
 * whose URL starts with `/roadmap/` gives back requests. That is why the detail pages are load
 * bearing beyond being nice to read — delete them and this silently returns nothing.
 *
 * Pagefind is BUILD-TIME. On a dev server the module 404s and `searchDocs` returns `[]`, so the
 * suggestions simply do not appear. Verifying this feature means a real build served from `dist/`.
 *
 * THE ATTACHMENT RULES LIVE HERE, NOT IN THE MARKUP, and the sentence the page shows is derived
 * from the same constants the validator enforces. Written twice — once as prose in the template and
 * once as a number in a check — they drift, and the version a person believes is the prose one.
 */
import { bySlug } from '../data/requests';
import { spaceById } from '../data/spaces';
import { clearHandoff, readHandoff } from './chat-core';
import { ICON_DOC, OPEN_CHAT_EVENT, linkRow } from './rows';
import { iconHtml } from './icons';
import { searchDocs } from './pagefind';
import { esc } from './rows';
import { readSession } from './portal-session';
import { isDocsUrl } from './search-modal';
import { statusBadgeHtml } from './status';
import { looksLikeEmail, readVoteEmail, writeVoteEmail } from './votes';

const DEBOUNCE_MS = 200;
const MIN_QUERY = 4;
const MAX_DUPES = 3;
/* THREE, AND THE CAP IS THE WHOLE MITIGATION. This strip sits between the subject field and the
   body field, so every row it draws pushes the thing the person came to write further down the
   page. Three rows is what the deflection is worth; a fourth is a tax on someone who has already
   decided the answer is not here. */
const MAX_ARTICLES = 3;

/* ── The five doors ───────────────────────────────────────────────────────────────────────────
 *
 * `billing` EXISTS BECAUSE IT WAS BEING MIS-ROUTED (Dan, 2026-08-20). An invoice question is
 * neither broken nor a wish, and with two doors it landed in the broken one, which sent an account
 * question to whoever reads bug reports and told the person writing it that their problem was a
 * fault. It is private like a ticket and it must never carry the public-board warning.
 *
 * `sales` IS THE ONLY DOOR FOR SOMEONE WHO IS NOT A CUSTOMER (Dan, 2026-08-21: "one new bucket
 * item to add - Sales Question (for pre-customer questions)"). Every other door on this page
 * assumes an account exists somewhere behind it: a ticket is filed against one, an invoice belongs
 * to one, and the sign-in note at the foot offers to show you the ones you opened. A person
 * deciding whether to start has none of that, and the four existing doors each told them they had
 * a fault, a wish, a bill or nothing in particular. It is private, and it is the one door whose
 * destination is not support — which is why its confirmation says so rather than reusing the
 * support wording.
 *
 * `other` IS LAST AND READS AS LAST. A catch-all collects everyone who does not want to choose,
 * which is the point of having one — but it also collects everyone who would have chosen correctly
 * if it had not been sitting there at equal weight. Position is what says so: it is last in this
 * list, last in the DOM, last in the tab order and last in the grid.
 */
export type Kind = 'ticket' | 'request' | 'billing' | 'sales' | 'other';

const KINDS: Kind[] = ['ticket', 'request', 'billing', 'sales', 'other'];

const isKind = (v: string | null): v is Kind => v !== null && (KINDS as string[]).includes(v);

/* ── Attachments ──────────────────────────────────────────────────────────────────────────────
 *
 * NOTHING IS SENT. There is no backend in this repo, and the shape stops where the vote button and
 * the feedback widget stop. What the shape has to carry is what the real one will need: an accept
 * list, a cap stated BEFORE the picker opens, several files, and a list of what is attached with a
 * way to take one back out.
 *
 * IMAGES AND PDF, AND NOTHING ELSE. A screenshot is what Dan asked for and a PDF is what an
 * exported view or an invoice arrives as. Video is the thing people would reach for next and it is
 * refused deliberately: a screen recording is tens of megabytes on a good day, no ticket system
 * carries one by mail, and the real answer for it is a link. Refusing it here is cheaper than
 * accepting it and failing at the far end.
 *
 * THE CAP IS PER FILE, 10 MB. A full-screen retina screenshot lands around 2 to 5 MB and a PDF
 * export of a large view can pass 8, so anything under 10 rejects the ordinary case; much above it
 * and the first thing through the door is the video we just refused.
 *
 * THE MODEL IS THE INPUT'S OWN `files`, rebuilt through `DataTransfer` on every change. A parallel
 * array beside the input would mean the real submit is no longer `new FormData(form)` — it would be
 * a form plus a thing the backend has to be told about, and the second picker click would silently
 * replace the first selection instead of adding to it, which is the complaint this list exists to
 * answer.
 */
const ATTACH_MAX_FILES = 5;
const ATTACH_MAX_BYTES = 10 * 1024 * 1024;

const ATTACH_TYPES = new Set(['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'application/pdf']);
const ATTACH_EXTS = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.pdf']);

/** The `accept` attribute. Both halves on purpose: some file dialogs filter by extension only. */
export const ATTACH_ACCEPT = [...ATTACH_EXTS, ...ATTACH_TYPES].join(',');

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  const kb = n / 1024;
  if (kb < 1024) return `${Math.round(kb)} KB`;
  const mb = kb / 1024;
  return `${mb >= 10 ? Math.round(mb) : mb.toFixed(1)} MB`;
}

/** Said before the picker opens, not after it rejects something. Derived, so it cannot lie. */
export const ATTACH_HINT =
  `PNG, JPG, GIF, WebP or PDF. Up to ${ATTACH_MAX_FILES} files, ` +
  `${formatBytes(ATTACH_MAX_BYTES)} each.`;

export function wireSubmit(): void {
  const root = document.querySelector<HTMLElement>('[data-submit]');
  if (!root) return;

  const steps = new Map<string, HTMLElement>();
  for (const el of root.querySelectorAll<HTMLElement>('[data-step]')) {
    steps.set(el.dataset.step ?? '', el);
  }

  /* THE PAGE TITLE IS PART OF THE STEP. `Report a problem` sat above `Something I wish existed`
     for anyone who took the request fork, which tells a person bringing an idea that they have a
     fault. Starlight renders the h1 from frontmatter, so the static one is the neutral `Contact us`
     and this sharpens it once a fork is chosen and blunts it again on the way back.
     `document.title` follows, because a browser tab is where this page most often waits.

     `Contact us` rather than `Contact support`, and rather than the `Write to us` it carried until
     now (Dan, 2026-08-20: "it could just be contact us"). Three of the five doors do not go to
     support — a feature request goes to a public board, a billing question goes to whoever holds
     the account, and a sales question goes to whoever answers those — so naming the desk in the
     neutral title would be wrong on most of the page.
     The static string in `pages/contact.astro` has to match this one: it is what renders before
     this script runs, and a title that changes on hydration is a flicker. */
  const TITLES: Record<string, string> = {
    fork: 'Contact us',
    ticket: 'Report a problem',
    request: 'Suggest an improvement',
    billing: 'Account and billing',
    sales: 'Sales question',
    other: 'Something else',
  };
  const heading = document.querySelector<HTMLElement>('h1#_top') ?? document.querySelector('h1');
  const setTitle = (name: string) => {
    const title = TITLES[name];
    if (!title || !heading) return;
    heading.textContent = title;
    document.title = `${title} | Baseout Support`;
  };

  /* `scroll` is false for the one call that is NOT a step change: the deep link, which is the page
     arriving. Scrolling there fights the browser's own restoration and reads as the page jumping
     under you. A "first call" guard would have been wrong — without a deep link the first call IS
     a click, and it would have swallowed exactly the scroll that matters. */
  const show = (name: string, scroll = true) => {
    for (const [key, el] of steps) el.hidden = key !== name;
    setTitle(name);
    if (!scroll) return;
    /* A step change is a navigation in everything but the URL, so put the reader at the top of what
       just replaced the page rather than leaving them mid-form — but honour the OS setting, because
       a smooth scroll is exactly the motion `prefers-reduced-motion` exists to suppress. */
    const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
    steps.get(name)?.scrollIntoView({ block: 'start', behavior: still ? 'auto' : 'smooth' });
  };

  for (const btn of root.querySelectorAll<HTMLButtonElement>('[data-choose]')) {
    btn.addEventListener('click', () => show(btn.dataset.choose ?? 'fork'));
  }
  for (const btn of root.querySelectorAll<HTMLButtonElement>('[data-restart]')) {
    btn.addEventListener('click', () => show('fork'));
  }

  /* Both triggers are ANCHORS with a real `href` — see the note in `pages/contact.astro`. The
     preventDefault is what turns the fallback into the enhancement. */
  root.querySelector<HTMLAnchorElement>('[data-ask]')?.addEventListener('click', (e) => {
    e.preventDefault();
    document.dispatchEvent(new CustomEvent(OPEN_CHAT_EVENT, { detail: {} }));
  });

  /* The header's own search trigger, clicked rather than re-implemented. The modal's open path
     already handles the resting state, the recents and the keyboard — a second entry point into it
     would be a second thing to keep in step, and this one is the same door. */
  root.querySelector<HTMLAnchorElement>('[data-search]')?.addEventListener('click', (e) => {
    e.preventDefault();
    document.querySelector<HTMLButtonElement>('[data-search-open]')?.click();
  });

  /* A LINK THAT ALREADY KNOWS DOES NOT ASK AGAIN. `Add a request` and `Report a problem` are the
     answer to the fork's question, so arriving through one of them opens its form directly. The
     step still names itself and still carries the way back, so nothing is hidden — only the second
     asking is. All five kinds deep-link the same way, so a billing link in an invoice email opens
     the billing form. Anything else in `kind` falls through to the fork rather than erroring, which
     is why this is a guard over the one list of kinds and not a hand-written pair of comparisons —
     the fifth door would have been added to the chooser and forgotten here, and `sales` is that
     fifth door: it cost nothing to reach `/contact/?kind=sales` because this reads the one list. */
  const params = new URLSearchParams(location.search);
  const kind = params.get('kind');
  if (isKind(kind)) show(kind, false);

  wireDuplicates(root);
  wireRelated(root, params.get('about'));
  wireSpace(root);
  wireHandoff(root, params.get('from') === 'chat');
  wireReceipt(root);
  for (const k of KINDS) wireForm(root, steps, k);
}

/* ── The chat handoff ────────────────────────────────────────────────────────────────────────── */

/**
 * The receiving half of `Email support` (labelled `Ask a person` until 2026-08-26; the control and
 * this handler never changed, only the word — see `ChatDock.astro` for Dan's ruling).
 *
 * THE PAYLOAD ARRIVES IN `sessionStorage`, NOT IN THE URL, and the reasoning is written once at the
 * sending end (`chat-core.ts`). What matters here is the consequence: this runs on a page that may
 * have been reached in three ways — the handoff, a hand-typed `/contact/?kind=ticket`, or a reload
 * of either — and only the first may consume a payload. `?from=chat` is what tells them apart.
 *
 * THE SPLIT BETWEEN THE TWO HALVES IS THE DESIGN, and it is not cosmetic. What the PERSON wrote
 * goes into the body field, verbatim, because it is theirs and because the whole point of the
 * handoff is that nobody says the same thing a third time; it lands in the box they were going to
 * edit anyway. What we COLLECTED ABOUT THEM goes into the block, because that is the half they have
 * to be shown and allowed to delete — and `Remove` cannot mean "select nine lines out of a textarea
 * and press backspace", which is what burying it in the body would have made it.
 *
 * OPT-OUT, NOT OPT-IN. It is attached on arrival and removed in one press. Opt-in loses the context
 * for nearly everyone, which is the failure the vendor documentation names; the collapsed-but-
 * described rendering and the `Remove` control are what buy that back.
 *
 * NOTHING IS SENT — there is no backend here. `Remove` clears the stored payload as well as the
 * block, so a reload cannot resurrect something the person deleted, and a submit clears it so the
 * next visit to this page does not open holding a case that has already gone.
 */
function wireHandoff(root: HTMLElement, arrived: boolean): void {
  const box = root.querySelector<HTMLElement>('[data-hand]');
  const toggle = root.querySelector<HTMLButtonElement>('[data-hand-toggle]');
  const body = root.querySelector<HTMLElement>('[data-hand-body]');
  const text = root.querySelector<HTMLTextAreaElement>('[data-hand-text]');
  const remove = root.querySelector<HTMLButtonElement>('[data-hand-remove]');
  const asked = root.querySelector<HTMLTextAreaElement>('[data-form="ticket"] textarea[name=body]');
  if (!box || !toggle || !body || !text || !remove) return;

  toggle.addEventListener('click', () => {
    const open = toggle.getAttribute('aria-expanded') === 'true';
    toggle.setAttribute('aria-expanded', String(!open));
    body.hidden = open;
    if (!open) text.focus();
  });

  remove.addEventListener('click', () => {
    clearHandoff();
    box.hidden = true;
    /* The control that had focus has just gone. Put it on the field the block was attached to
       rather than letting focus fall to `<body>` in the middle of a form. */
    asked?.focus();
  });

  if (!arrived) return;
  const held = readHandoff();
  if (!held) return;

  text.value = held.block;

  /* A DECLARED FIELD THAT NOTHING RENDERS IS A FACT NOBODY CAN SEE — the failure this repo has
     already shipped once. `asked` is on the payload because the label is the one place the closed
     block can say how much of the conversation it came out of. */
  const n = root.querySelector<HTMLElement>('[data-hand-n]');
  if (n) n.textContent = held.asked ? ` · ${held.asked} question${held.asked === 1 ? '' : 's'}` : '';

  /* THE QUESTION IS NOT RE-ASKED. It goes in verbatim and stays editable, so the person continues
     rather than restarts — and it is deliberately NOT copied into the subject line, which drives
     the article suggestions: offering the documentation to somebody who has just been failed by the
     documentation is the loop this control exists to break. */
  if (asked && !asked.value && held.question) asked.value = held.question;

  box.hidden = false;
}

/* ── "What is this about?" ───────────────────────────────────────────────────────────────────── */

/**
 * Reveals the platform-name box, and pre-answers the question for a link that already knows it.
 *
 * `?about=new-platform` IS THE BOARD'S "SUGGEST A PLATFORM" TILE. Somebody who clicked that has
 * already told us what this is about, and asking again in the first row of the form is the same
 * discourtesy as asking which door they wanted after they walked through one. The value is checked
 * against the radios actually rendered rather than trusted, so a stale or hand-edited link falls
 * through to the default instead of leaving the group with nothing selected.
 */
function wireRelated(root: HTMLElement, about: string | null): void {
  for (const set of Array.from(root.querySelectorAll<HTMLElement>('[data-related]'))) {
    const opts = Array.from(set.querySelectorAll<HTMLInputElement>('[data-related-opt]'));
    const name = set.querySelector<HTMLElement>('[data-related-newname]');
    const nameInput = name?.querySelector<HTMLInputElement>('input');

    const sync = () => {
      const isNew = !!set.querySelector<HTMLInputElement>('[data-related-new]')?.checked;
      if (!name) return;
      name.hidden = !isNew;
      /* Required only while it is the answer — a hidden required field blocks a submit with a
         message pointing at a control nobody can see. */
      if (nameInput) nameInput.required = isNew;
    };

    for (const o of opts) o.addEventListener('change', sync);

    if (about) {
      const match = opts.find((o) => o.value === about);
      if (match) {
        match.checked = true;
        /* Focus the box it revealed rather than the radio: for this visitor the platform name is
           the only thing still unanswered. */
        if (match.dataset.relatedNew !== undefined) {
          sync();
          nameInput?.focus();
          continue;
        }
      }
    }
    sync();
  }
}

/* ── "Which Space is this about?" ────────────────────────────────────────────────────────────── */

/**
 * The optional Space selection, and the one thing this controller actually has to do.
 *
 * Dan, asked whether a ticket should say which Space it is about: "Yes, good idea — allow that as a
 * selection, but not required." `data/tickets.ts` has declared `spaceId` since the first case and
 * nothing has ever filled it, so today the value can only be assigned by us at triage — which makes
 * the first reply on a failed backup a question the person could have answered before sending.
 *
 * ── IT IS A NATIVE `select`, AND THAT IS A DECISION ABOUT A BUG, NOT ONLY ABOUT TASTE ──────────
 * A chip group like `RelatedToField` is the form's other one-of-N control, and it does not scale:
 * the platform list is five and closed, a person's Space roster is unbounded. The next reach is a
 * custom popover, and this repo has already paid for one — a popover that closed on `focusout`
 * destroyed itself between mousedown and mouseup, because a `<label>` is not focusable, and four
 * synthetic `.click()` checks passed on the broken code. A `select` opens and closes without any of
 * ours, gets the keyboard, the type-ahead and the mobile sheet for nothing, and `optgroup` gives the
 * organisation grouping that stops two Spaces called `Ops` reading as one line typed twice.
 *
 * ── NOTHING IS WIRED FOR THE SIGNED-IN CASE, AND THAT IS THE POINT ────────────────────────────
 * The resting option carries `value=""`, it is first and it is selected, so `new FormData(form)`
 * already sends `spaceId=""` for "not about a particular Space" and the id for anything else. The
 * validator walks `[required]` and this control has none, so it cannot block a submit. An optional
 * field that needed a controller to stay optional would be one bug away from being required.
 *
 * ── SIGNED OUT, IT IS DISABLED — NOT MERELY HIDDEN ────────────────────────────────────────────
 * The sheet hides it (`html[data-portal-session]`, the same mechanism as the sign-in line), and this
 * is a static build so the markup ships in both states. A control that is only invisible is STILL IN
 * `new FormData(form)`, and a roster the visitor never saw must not contribute a value to a case
 * raised anonymously. `disabled` removes it from the form entirely, which is the honest statement:
 * for this visitor the field does not exist. It also drops it from the tab order, so the picker
 * cannot be reached by keyboard on a page that does not show it.
 *
 * THE SESSION IS READ, NEVER PERSISTED — `portal-session.ts` is the one authority, and this reads it
 * rather than sniffing the attribute, so a page that stamps the attribute differently cannot make
 * this disagree with the rest of the portal.
 */
function wireSpace(root: HTMLElement): void {
  if (readSession() === 'in') return;
  for (const sel of root.querySelectorAll<HTMLSelectElement>('[data-space]')) {
    sel.disabled = true;
    /* Back to the resting value as well as out of the form. `disabled` is enough for this submit;
       resetting the value is what makes it enough for the next one, since a browser restoring form
       state on a back-navigation would otherwise leave a selection standing in a disabled control. */
    sel.value = '';
  }
}

/* ── Duplicate detection ─────────────────────────────────────────────────────────────────────── */

function wireDuplicates(root: HTMLElement): void {
  const input = root.querySelector<HTMLInputElement>('[data-dupe-input]');
  const box = root.querySelector<HTMLElement>('[data-dupes]');
  const head = root.querySelector<HTMLElement>('[data-dupes-h]');
  const list = root.querySelector<HTMLElement>('[data-dupes-list]');
  if (!input || !box || !head || !list) return;

  let timer: ReturnType<typeof setTimeout> | undefined;
  let seq = 0;

  const run = async (q: string) => {
    const mine = ++seq;
    const hits = await findSimilar(q);
    if (mine !== seq) return; // A slower earlier keystroke must not overwrite a newer one.

    const top = hits.slice(0, MAX_DUPES);
    if (!top.length) {
      box.hidden = true;
      return;
    }

    head.textContent =
      top.length === 1
        ? 'One request looks similar — is it yours?'
        : `${top.length} requests look similar — is one of them yours?`;

    /* THE STATE IS THE ANSWER, not the title. Someone about to ask for point-in-time restore needs
       to know it is already In progress, and someone about to ask for configurable retention needs
       to know it Already exists — at which point the interruption has paid for itself and they can
       stop typing. A row that shows only a title makes them open three tabs to find that out. */
    list.innerHTML = top
      .map((h) => {
        const req = bySlug(h.url.replace(/^\/roadmap\/|\/$/g, ''));
        return (
          `<div class="sb-dupe">` +
          `<span class="sb-dupe-title"><a href="${esc(h.url)}">${esc(h.title)}</a></span>` +
          (req ? statusBadgeHtml(req.status) : '') +
          `</div>`
        );
      })
      .join('');
    box.hidden = false;
  };

  input.addEventListener('input', () => {
    const q = input.value.trim();
    clearTimeout(timer);
    if (q.length < MIN_QUERY) {
      box.hidden = true;
      return;
    }
    timer = setTimeout(() => void run(q), DEBOUNCE_MS);
  });
}

/**
 * A TITLE IS A PHRASE, AND PAGEFIND ANDs. Querying "restore data from a backup" whole asks for a
 * page containing every one of those words and matched nothing — while the index plainly holds
 * `/roadmap/restore/`. An AND search is the wrong instrument for "is something like this already
 * here", which is a question about overlap, not about containment.
 *
 * So: try the phrase, and if it finds nothing, ask about each meaningful word separately and rank by
 * how many of them a page answers. Two hits is the floor — one shared word is a coincidence
 * ("backup" appears on nearly every page we own), two is a resemblance worth interrupting someone
 * for. Anything less and the suggestion box becomes noise people learn to scroll past, which is
 * worse than not having it.
 */
const STOPWORDS = new Set([
  'a', 'an', 'the', 'and', 'or', 'of', 'to', 'in', 'on', 'for', 'from', 'with', 'my', 'our',
  'your', 'it', 'is', 'be', 'can', 'i', 'we', 'want', 'would', 'like', 'able', 'please', 'add',
  'support', 'feature', 'request', 'baseout',
]);

const isRequestUrl = (u: string) => u.startsWith('/roadmap/') && u !== '/roadmap/';

/**
 * THE RANKING IS ONE FUNCTION AND THE CORPUS IS AN ARGUMENT, which is the whole reason article
 * suggestions cost a call site rather than a feature. `keep` is the only thing that differs between
 * "is somebody already asking for this" (`isRequestUrl`, the public board) and "is this already
 * written down" (`isDocsUrl`, the 86 documentation pages) — same index, same phrase-then-words
 * fallback, same overlap floor, opposite halves of the same index.
 */
async function findRelated(
  query: string,
  keep: (url: string) => boolean,
): Promise<{ url: string; title: string }[]> {
  const isRequest = keep;

  const whole = (await searchDocs(query, 12)).filter((h) => isRequest(h.url));
  if (whole.length) return whole;

  const words = query
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length > 3 && !STOPWORDS.has(w))
    .slice(0, 4);
  if (words.length < 2) return [];

  const perWord = await Promise.all(words.map((w) => searchDocs(w, 12)));

  const score = new Map<string, { url: string; title: string; n: number }>();
  for (const hits of perWord) {
    for (const h of hits) {
      if (!isRequest(h.url)) continue;
      const seen = score.get(h.url);
      if (seen) seen.n += 1;
      else score.set(h.url, { url: h.url, title: h.title, n: 1 });
    }
  }

  return [...score.values()]
    .filter((h) => h.n >= 2)
    .sort((a, b) => b.n - a.n)
    .map(({ url, title }) => ({ url, title }));
}

const findSimilar = (query: string) => findRelated(query, isRequestUrl);

/* ── Suggested articles ──────────────────────────────────────────────────────────────────────── */

/**
 * The same machinery as duplicate detection, pointed at the subject field and at the other half of
 * the index.
 *
 * IT NEVER BLOCKS AND IT NEVER RE-ASKS. The person came to report something; a deflection that gets
 * in the way is a tax on the very case we most want written down. So: no focus is taken, no field
 * is disabled, the submit button is untouched, and `Dismiss` is final for this form — a strip that
 * reappears on the next keystroke has not been dismissed, it has been postponed, which is worse
 * than not offering the control at all.
 *
 * PAGEFIND IS BUILD-TIME. Under `astro dev` the module 404s, `searchDocs` returns `[]`, `hits` is
 * empty and the strip simply stays hidden — the degradation is "nothing appears", never an error.
 * That is also exactly how this will first be seen and pronounced broken; verify on a build.
 */
function wireArticles(form: HTMLFormElement): void {
  const input = form.querySelector<HTMLInputElement>('[data-arts-input]');
  const box = form.querySelector<HTMLElement>('[data-arts]');
  const head = form.querySelector<HTMLElement>('[data-arts-h]');
  const list = form.querySelector<HTMLElement>('[data-arts-list]');
  const dismiss = form.querySelector<HTMLButtonElement>('[data-arts-dismiss]');
  if (!input || !box || !head || !list) return;

  let timer: ReturnType<typeof setTimeout> | undefined;
  let seq = 0;
  let off = false;

  dismiss?.addEventListener('click', () => {
    off = true;
    box.hidden = true;
    /* The control that just vanished had focus. Put it back on the field the strip was about,
       rather than letting it fall to `<body>` in the middle of a form. */
    input.focus();
  });

  const run = async (q: string) => {
    const mine = ++seq;
    const hits = (await findRelated(q, isDocsUrl)).slice(0, MAX_ARTICLES);
    if (mine !== seq || off) return; // A slower earlier keystroke must not overwrite a newer one.

    if (!hits.length) {
      box.hidden = true;
      return;
    }

    head.textContent =
      hits.length === 1
        ? 'One page may already answer this.'
        : `${hits.length} pages may already answer this.`;

    /* `linkRow` from the one row vocabulary, not a fourth kind of row — and without an excerpt on
       purpose. The eight troubleshooting pages map near one-to-one onto the subjects this door
       receives, so the title IS the answer to "is this my problem"; three excerpts underneath the
       subject field would push the body box off the screen to say it twice. */
    list.innerHTML = hits.map((h) => linkRow(h.title, h.url, ICON_DOC)).join('');
    box.hidden = false;
  };

  input.addEventListener('input', () => {
    clearTimeout(timer);
    if (off) return;
    const q = input.value.trim();
    if (q.length < MIN_QUERY) {
      box.hidden = true;
      return;
    }
    timer = setTimeout(() => void run(q), DEBOUNCE_MS);
  });
}

/* ── Validation and the confirmation ─────────────────────────────────────────────────────────── */

/* ── The receipt ─────────────────────────────────────────────────────────────────────────────────
 *
 * THREE FACTS, BECAUSE THEY ARE THE THREE A PERSON NEEDS A WEEK LATER: a reference they can quote,
 * the address the mail went to, and who ends the wait and how. Everything else that could go here —
 * a queue position, a stage, a clock — is either unknowable or a promise the business has not made.
 *
 * NO DURATION, ANYWHERE — and this comment does not quote the phrases either, because the check
 * that enforces the rule is a grep over `src` and a warning written in the banned words fails it
 * just as a promise would. The forbidden shape is any clock: a number of hours, a soft adverb, a
 * claim about what we usually do. The second sentence of the answer line is what converts "we will
 * not tell you how long" from an omission into a stated policy, which is the work an SLA would
 * otherwise be invented to do.
 */

/* Four of the five doors say the same thing because the same thing is true of all four: it is a
   private case, and a person answers it in the mailbox. `request` is the one that cannot — nobody
   replies to a board post — so it overrides, and the override still ends in a mail a person reads. */
const ANSWERED_BY_EMAIL =
  'A person answers by replying to that email. We do not publish response times; you get an ' +
  'email when there is an update.';

/* THE EXIT IS THE FIFTH PER-DOOR FACT, and it was the one left shared. Every confirmation ended
   on `Back to the board` — correct after a public request and wrong after the other four, which
   send a private message to a person and have nothing to do with the roadmap. Somebody who has
   just reported a failed backup is still stuck; the useful next place is the documentation, not a
   list of features other people want. */
const DOCS_EXIT = { href: '/start/what-baseout-is/', label: 'Back to the documentation' };

const DONE: Record<Kind, { h: string; body: string; answer?: string; exit?: { href: string; label: string } }> = {
  ticket: {
    exit: DOCS_EXIT,
    h: 'That would have gone to support',
    body: 'A real submission would open a ticket against your email address, flagged as coming from someone who is not signed in, and send you a copy.',
  },
  request: {
    exit: { href: '/roadmap/', label: 'Back to the board' },
    h: 'That would have gone on the board',
    body: 'A real submission would post it as Planned for a moderator to review, count your vote for it, and email you when its status changes.',
    answer:
      'Nobody replies to a board post. You get an email when its status changes, and replying to ' +
      'that email reaches a person.',
  },
  /* Each confirmation names its own destination, because that is the one fact the person pressing
     submit is checking. A shared "Thanks, we got it" would read the same after all five and would
     be the wrong reassurance for four of them. */
  billing: {
    exit: DOCS_EXIT,
    h: 'That would have gone to the billing team',
    body: 'A real submission would open a ticket against your email address, route it to whoever holds the account rather than to the engineers, and send you a copy.',
  },
  /* THE ONE CONFIRMATION THAT MUST NOT SAY "SUPPORT". Everyone who reaches this screen is deciding
     whether to become a customer, and being told their question went to the desk that fixes broken
     backups is being told they were misheard. It also cannot say "against your account", because
     the premise of this door is that there is not one yet. */
  sales: {
    exit: DOCS_EXIT,
    h: 'That would have gone to sales',
    body: 'A real submission would open a ticket against your email address, route it to whoever answers sales questions rather than to support, and send you a copy.',
  },
  other: {
    exit: DOCS_EXIT,
    h: 'That would have gone to the support inbox',
    body: 'A real submission would open a ticket against your email address, leave it unsorted for a person to place, and send you a copy.',
  },
};

/**
 * A reference, generated here ONLY because there is no backend. The real one is minted by the
 * server when the case row is written, and it must arrive with the acknowledgement mail so the
 * screen and the mailbox cannot disagree.
 *
 * TWO IDS, AND CONFLATING THEM IS THE FAILURE. `ref` is the HUMAN, QUOTABLE label — it goes in the
 * mail subject, the first line of the body and on this screen, and holding it grants nothing; it is
 * a name for a case, not a key to one. The EMAIL-THREADING TOKEN is a different value entirely: it
 * lives only in the Reply-To address, it is independently rotatable, and holding it grants the
 * ability to POST into the thread. One id doing both jobs is the hole Krebs documented against
 * Zendesk in October 2025 — the string a customer pastes into a public forum becomes a write key
 * into their own case. Whoever builds the backend must mint both, and this comment is the contract.
 *
 * NOT SEQUENTIAL, which is the other half of that same finding: Zendesk's ids were "often
 * sequential and guessable". Eight characters over a 32-symbol alphabet from `crypto`, and 256
 * divides by 32 exactly, so the modulo is uniform rather than quietly favouring the first eight
 * symbols. The alphabet is Crockford's: no I, L, O or U, because this is a string people read down
 * a phone and type back into a mail.
 *
 * STABLE FOR THE VISITOR'S SESSION. A reference that changed between two submissions would be a
 * reference to nothing, and the one thing this screen is for is being quotable later.
 */
const REF_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
const REF_KEY = 'bo-support-ref';

let memoRef = '';

function sessionRef(): string {
  if (memoRef) return memoRef;
  try {
    const held = sessionStorage.getItem(REF_KEY);
    if (held) return (memoRef = held);
  } catch {
    /* Private mode, or storage denied. The in-memory copy is still stable for this page. */
  }
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  memoRef = 'BO-' + Array.from(bytes, (b) => REF_ALPHABET[b % 32]).join('');
  try {
    sessionStorage.setItem(REF_KEY, memoRef);
  } catch {
    /* As above. */
  }
  return memoRef;
}

/**
 * The copy control, the anatomy of `pattern-copy-id`: a 20px ghost button, `lucide--copy` at rest,
 * `lucide--check` for ~1.1s after a write, then back. No toast — copying is not an event worth a
 * page-level announcement — and no native `title=`, which is the portal's rule as much as the app's.
 *
 * THE CHECK ONLY POPS ON A WRITE THAT HAPPENED. `navigator.clipboard` is undefined outside a secure
 * context, and a tick shown after nothing was copied is worse than no feedback: the person walks
 * away believing they hold a reference they do not.
 */
function wireReceipt(root: HTMLElement): void {
  const btn = root.querySelector<HTMLButtonElement>('[data-ref-copy]');
  const code = root.querySelector<HTMLElement>('[data-ref]');
  const glyph = root.querySelector<HTMLElement>('[data-ref-glyph]');
  if (!btn || !code || !glyph) return;

  let back: ReturnType<typeof setTimeout> | undefined;

  btn.addEventListener('click', () => {
    void navigator.clipboard?.writeText(code.textContent ?? '').then(
      () => {
        glyph.innerHTML = iconHtml('check', 14);
        clearTimeout(back);
        back = setTimeout(() => {
          glyph.innerHTML = iconHtml('copy', 14);
        }, 1100);
      },
      () => {
        /* Refused by the browser. Nothing is claimed, and the reference is on screen to select. */
      },
    );
  });
}

function wireForm(root: HTMLElement, steps: Map<string, HTMLElement>, kind: Kind): void {
  const form = root.querySelector<HTMLFormElement>(`[data-form="${kind}"]`);
  if (!form) return;

  wireAttachments(form);
  wireArticles(form);

  const err = form.querySelector<HTMLElement>('[data-err]');
  const email = form.querySelector<HTMLInputElement>('input[name=email]');

  /* Someone who has already voted has already given us this. Asking again is a toll. */
  if (email && !email.value) email.value = readVoteEmail();

  const fail = (field: HTMLElement | null, message: string) => {
    if (err) {
      /* The glyph, not just the colour — this is the one message on the page that has to survive a
         reader who cannot tell the red from the ink around it. */
      err.innerHTML = iconHtml('triangle-alert', 15) + `<span>${esc(message)}</span>`;
      err.hidden = false;
    }
    field?.setAttribute('aria-invalid', 'true');
    (field as HTMLInputElement | null)?.focus();
  };

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    if (err) err.hidden = true;
    for (const el of form.querySelectorAll('[aria-invalid]')) el.removeAttribute('aria-invalid');

    /* Validated here rather than by `required` alone, so the message says which field and why —
       the browser's own bubble disappears the moment anything else is clicked. */
    for (const el of form.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>('[required]')) {
      if (!el.value.trim()) {
        const label = el.closest('label')?.querySelector('span')?.textContent ?? 'This field';
        return fail(el, `${label} is needed before this can be sent.`);
      }
    }

    if (email && !looksLikeEmail(email.value)) {
      return fail(email, 'That does not look like an email address.');
    }

    if (email) writeVoteEmail(email.value.trim());

    const done = steps.get('done');
    if (done) {
      done.querySelector('[data-done-h]')!.textContent = DONE[kind].h;
      done.querySelector('[data-done-body]')!.textContent = DONE[kind].body;
      done.querySelector('[data-ref]')!.textContent = sessionRef();
      /* PRINTED, NEVER ASKED FOR AGAIN. The address is in hand — it was validated two lines up —
         and a confirmation that asks "where should we reply?" after the reply address was typed is
         asking a person to check our work. Echoing it is also the one chance they get to catch
         their own typo while the case is still one line old. */
      done.querySelector('[data-receipt-mail]')!.textContent = email ? email.value.trim() : '';

      /* THE OPTIONAL ANSWER, SHOWN BACK ONLY WHEN THERE WAS ONE. `spaceId` is what leaves the form;
         what goes on the receipt is the RESOLVED display, joined here through `spaceById` because
         that is precisely what a real store does to fill `Ticket.about` — so the string on this
         screen and the chip on `/requests/` are one lookup rather than two spellings. The org is
         carried with the name for the same reason it labels the `optgroup`: two organisations can
         each hold a Space called `Ops`, and a receipt that cannot tell them apart is not a receipt.
         Absent, never blank — see the note in `pages/contact.astro`. */
      const spaceSel = form.querySelector<HTMLSelectElement>('[data-space]');
      const space = spaceSel && !spaceSel.disabled ? spaceById(spaceSel.value) : null;
      const aboutRow = done.querySelector<HTMLElement>('[data-receipt-about-row]');
      if (aboutRow) {
        aboutRow.hidden = !space;
        const aboutVal = aboutRow.querySelector('[data-receipt-about]');
        if (aboutVal) aboutVal.textContent = space ? `${space.name} · ${space.orgName}` : '';
      }

      done.querySelector('[data-receipt-answer]')!.textContent =
        DONE[kind].answer ?? ANSWERED_BY_EMAIL;

      const exit = DONE[kind].exit ?? DOCS_EXIT;
      const exitEl = done.querySelector<HTMLAnchorElement>('[data-done-exit]');
      if (exitEl) {
        exitEl.href = exit.href;
        exitEl.textContent = exit.label;
      }
    }
    /* It has been sent. A payload that outlived its own case would attach itself to the next one. */
    clearHandoff();

    for (const [key, el] of steps) el.hidden = key !== 'done';
    done?.scrollIntoView({ block: 'start', behavior: 'smooth' });
  });
}

/* ── Attachments ─────────────────────────────────────────────────────────────────────────────── */

/**
 * A FILE INPUT THAT SWALLOWS ITS OWN FILENAMES is the most-complained-about control on the web. The
 * native one says "3 files" and stops there, so nobody can tell whether the right screenshot went
 * in, and nobody can take one back out without starting the pick again. So the list is ours, the
 * count is stated, and each row carries a real `<button>` rather than an `x` glyph on a span, which
 * has no keyboard reach and no name to announce.
 *
 * REJECTION IS A VALIDATION MESSAGE, NOT A CATASTROPHE. Nothing broke when someone picked a 14 MB
 * file: nothing here is red, the message says what was refused and what to do instead, and the
 * files in the same pick that were fine are attached anyway rather than the whole pick being
 * thrown away for one bad member.
 */
function wireAttachments(form: HTMLFormElement): void {
  const input = form.querySelector<HTMLInputElement>('[data-file-input]');
  const add = form.querySelector<HTMLButtonElement>('[data-file-add]');
  const list = form.querySelector<HTMLElement>('[data-file-list]');
  const count = form.querySelector<HTMLElement>('[data-file-count]');
  const note = form.querySelector<HTMLElement>('[data-file-note]');
  if (!input || !add || !list || !count || !note) return;

  const chosen: File[] = [];
  const keyOf = (f: File) => `${f.name}:${f.size}:${f.lastModified}`;

  /* The input stays the source of truth — see the header. `DataTransfer` is the only way to write a
     `FileList`, and it is the reason a second visit to the picker adds to the selection instead of
     replacing it. */
  const commit = () => {
    const dt = new DataTransfer();
    for (const f of chosen) dt.items.add(f);
    input.files = dt.files;
  };

  const render = (lead = '', refused: string[] = []) => {
    list.innerHTML = chosen
      .map(
        (f, i) =>
          '<li class="sb-file">' +
          `<span class="sb-file-name">${esc(f.name)}</span>` +
          `<span class="sb-file-size">${formatBytes(f.size)}</span>` +
          /* THE GLYPH IS WHAT SEPARATES THE CONTROL FROM THE FIGURE BESIDE IT (Oleh, 2026-08-26:
             "воно зливається з розміром"). `Remove` and `5.6 MB` were both 13px of muted text on the
             same line, so the row read as three pieces of information rather than two facts and a
             button. An `x` is the one mark in this row that is not a word, and it says "control"
             before anything is read. Same glyph and size as `.sb-hand-x` twenty lines up in the same
             form, so the two Remove buttons on this page are one thing. */
          `<button type="button" class="sb-file-drop" data-file-remove="${i}">` +
          `<span class="sb-file-drop-ic" aria-hidden="true">${iconHtml('x', 14)}</span>Remove` +
          `<span class="sb-file-for"> ${esc(f.name)}</span></button>` +
          '</li>',
      )
      .join('');
    list.hidden = chosen.length === 0;

    /* THE ROW BUTTONS ALL SAY "REMOVE", so the accessible name has to carry the filename or a
       screen reader hears the same word five times with no way to tell which row it is on. The
       trailing span is visually hidden and is part of the button's own text, which beats an
       `aria-label` here: the visible word and the announced name cannot drift apart. */
    const total = chosen.reduce((n, f) => n + f.size, 0);
    const summary = chosen.length
      ? `${chosen.length} file${chosen.length === 1 ? '' : 's'} attached, ${formatBytes(total)} in total.`
      : lead
        ? 'Nothing attached.'
        : '';
    count.textContent = `${lead}${summary}`;

    note.innerHTML = refused.length
      ? iconHtml('triangle-alert', 14) + `<span>${refused.map(esc).join('<br>')}</span>`
      : '';
    note.hidden = refused.length === 0;
  };

  /* The native input is hidden and driven from a real button, because a bare file input cannot be
     styled to match anything else on the page and its own label text is set by the browser. Hidden
     outright rather than clipped: a control that is invisible but still in the tab order is worse
     than no control, and `input.click()` works on a hidden input in every browser we serve. */
  add.addEventListener('click', () => input.click());

  input.addEventListener('change', () => {
    const picked = Array.from(input.files ?? []);
    const refused: string[] = [];
    const had = chosen.length;
    let added = 0;

    for (const f of picked) {
      if (chosen.some((c) => keyOf(c) === keyOf(f))) continue; // Already attached; silently ignored.
      if (!acceptable(f)) {
        refused.push(
          `${f.name} is not an image or a PDF. Save it as PNG or PDF, or paste the text into the box above.`,
        );
        continue;
      }
      if (f.size > ATTACH_MAX_BYTES) {
        refused.push(
          `${f.name} is ${formatBytes(f.size)}. The limit is ${formatBytes(ATTACH_MAX_BYTES)} per file, so crop it or send a link to the original.`,
        );
        continue;
      }
      if (chosen.length >= ATTACH_MAX_FILES) {
        refused.push(
          `${ATTACH_MAX_FILES} files is the limit, so ${f.name} was not added. Remove one first if you want to swap it.`,
        );
        continue;
      }
      chosen.push(f);
      added += 1;
    }

    commit();
    /* THE DELTA IS ONLY SAID WHEN IT IS NOT THE WHOLE STORY. On a first pick, "2 files added" and
       "2 files attached, 3 KB in total" are the same sentence twice, and this string is the VISIBLE
       count line as well as the live region, so the repetition is on screen. Appending to files
       that were already there is the one case where the delta says something the total cannot. */
    render(added && had ? `${added} file${added === 1 ? '' : 's'} added. ` : '', refused);
  });

  list.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement | null)?.closest<HTMLButtonElement>('[data-file-remove]');
    if (!btn) return;
    const i = Number(btn.dataset.fileRemove);
    const [gone] = chosen.splice(i, 1);
    if (!gone) return;
    commit();
    render(`${gone.name} removed. `);

    /* The button that had focus no longer exists, and focus falling to `<body>` after a delete is
       how a keyboard user loses their place in a form. It lands on the row that took this one's
       position, or on the last row, or back on the control that opens the picker. */
    const rows = list.querySelectorAll<HTMLButtonElement>('[data-file-remove]');
    (rows[Math.min(i, rows.length - 1)] ?? add).focus();
  });
}

/**
 * A HINT, NOT A GATE. `accept` already filters the dialog and this re-checks it, because a file can
 * arrive with an empty `type` from a network volume or an unusual OS — hence the extension
 * fallback. Neither is a security boundary: the real check belongs on the server that finally
 * receives these, and it has to assume this one did not happen.
 */
function acceptable(f: File): boolean {
  if (ATTACH_TYPES.has(f.type)) return true;
  const dot = f.name.lastIndexOf('.');
  return dot > 0 && ATTACH_EXTS.has(f.name.slice(dot).toLowerCase());
}
