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
import { OPEN_CHAT_EVENT } from './rows';
import { iconHtml } from './icons';
import { searchDocs } from './pagefind';
import { esc } from './rows';
import { statusBadgeHtml } from './status';
import { looksLikeEmail, readVoteEmail, writeVoteEmail } from './votes';

const DEBOUNCE_MS = 200;
const MIN_QUERY = 4;
const MAX_DUPES = 3;

/* ── The four doors ───────────────────────────────────────────────────────────────────────────
 *
 * `billing` EXISTS BECAUSE IT WAS BEING MIS-ROUTED (Dan, 2026-08-20). An invoice question is
 * neither broken nor a wish, and with two doors it landed in the broken one, which sent an account
 * question to whoever reads bug reports and told the person writing it that their problem was a
 * fault. It is private like a ticket and it must never carry the public-board warning.
 *
 * `other` IS LAST AND READS AS LAST. A catch-all collects everyone who does not want to choose,
 * which is the point of having one — but it also collects everyone who would have chosen correctly
 * if it had not been sitting there at equal weight. So it is quieter than the three above it
 * rather than a fourth tile.
 */
export type Kind = 'ticket' | 'request' | 'billing' | 'other';

const KINDS: Kind[] = ['ticket', 'request', 'billing', 'other'];

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
     now (Dan, 2026-08-20: "it could just be contact us"). Two of the four doors do not go to
     support — a feature request goes to a public board and a billing question goes to whoever
     holds the account — so naming the desk in the neutral title would be wrong on half the page.
     The static string in `pages/contact.astro` has to match this one: it is what renders before
     this script runs, and a title that changes on hydration is a flicker. */
  const TITLES: Record<string, string> = {
    fork: 'Contact us',
    ticket: 'Report a problem',
    request: 'Suggest an improvement',
    billing: 'Account and billing',
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
     asking is. All four kinds deep-link the same way, so a billing link in an invoice email opens
     the billing form. Anything else in `kind` falls through to the fork rather than erroring, which
     is why this is a guard over the one list of kinds and not a hand-written pair of comparisons —
     the fifth door would have been added to the chooser and forgotten here. */
  const params = new URLSearchParams(location.search);
  const kind = params.get('kind');
  if (isKind(kind)) show(kind, false);

  wireDuplicates(root);
  wireRelated(root, params.get('about'));
  for (const k of KINDS) wireForm(root, steps, k);
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

async function findSimilar(query: string): Promise<{ url: string; title: string }[]> {
  const isRequest = (u: string) => u.startsWith('/roadmap/') && u !== '/roadmap/';

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

/* ── Validation and the confirmation ─────────────────────────────────────────────────────────── */

const DONE: Record<Kind, { h: string; body: string }> = {
  ticket: {
    h: 'That would have gone to support',
    body: 'A real submission would open a ticket against your email address, flagged as coming from someone who is not signed in, and send you a copy.',
  },
  request: {
    h: 'That would have gone on the board',
    body: 'A real submission would post it as Planned for a moderator to review, count your vote for it, and email you when its status changes.',
  },
  /* Each confirmation names its own destination, because that is the one fact the person pressing
     submit is checking. A shared "Thanks, we got it" would read the same after all four and would
     be the wrong reassurance for three of them. */
  billing: {
    h: 'That would have gone to the billing team',
    body: 'A real submission would open a ticket against your email address, route it to whoever holds the account rather than to the engineers, and send you a copy.',
  },
  other: {
    h: 'That would have gone to the support inbox',
    body: 'A real submission would open a ticket against your email address, leave it unsorted for a person to place, and send you a copy.',
  },
};

function wireForm(root: HTMLElement, steps: Map<string, HTMLElement>, kind: Kind): void {
  const form = root.querySelector<HTMLFormElement>(`[data-form="${kind}"]`);
  if (!form) return;

  wireAttachments(form);

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
    }
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
          `<button type="button" class="sb-file-drop" data-file-remove="${i}">Remove` +
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
