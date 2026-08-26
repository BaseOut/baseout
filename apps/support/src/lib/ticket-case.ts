/**
 * The client controller for `/requests/<ref>/` — reply, close, reopen.
 *
 * ── ONE TRANSITION, NOT A SECOND ENTITY ────────────────────────────────────────────────────────
 * Replying to a closed case flips `closed` → `open`. It does not mint a follow-up case. Zendesk does
 * mint one, and that is not a model to copy from: it exists because Zendesk has TWO closed-ish states
 * — `solved`, which reopens, and `closed`, which does not — separated by a system timer that defaults
 * to 4 days and caps at 28 and "can't be changed". Baseout has one `Closed`, so the conflict that
 * forces a follow-up entity does not arise, and a second entity would need a parent/child field in a
 * data model that has none and should not grow one.
 *
 * ── THE CUSTOMER MAY CLOSE THEIR OWN CASE ──────────────────────────────────────────────────────
 * Somebody who solved it themselves should not have to write "never mind" and wait. The control is
 * quiet and it lives in the record rail beside the status it changes, not in the composer — closing
 * is not a way of replying.
 *
 * ── SEND NOW DOES WHAT SEND WOULD DO (2026-08-21) ──────────────────────────────────────────────
 * It used to run `empty → sending → failed` and print "Nothing was sent — this portal has no mail
 * behind it yet." That was honest and it was the wrong instrument. This portal exists to demonstrate
 * a finished product, and the one flow it exists to demonstrate ended in a red region every single
 * time — which is not a caveat, it is a broken-looking demo, and an alarm that fires on every
 * expected outcome is an alarm the reader learns to ignore. So Send now performs the whole
 * transition it would perform against a real store:
 *
 *   · the message is appended to the thread as the customer, with its own timestamp;
 *   · the composer clears — draft AND file field — because the send SUCCEEDED, which is the only
 *     condition under which clearing was ever safe (the "never clear optimistically" rule is about
 *     `sending` and `failed`, and both still keep the text);
 *   · the case's last activity moves to the new message;
 *   · a `closed` case reopens, because the composer already promised it would;
 *   · chosen files become one-line chips on the sent message;
 *   · the new message is scrolled into view and focus returns to the composer, which is where a
 *     person who just sent one reply and may send another expects to be.
 *
 * THE HONESTY MOVED, IT DID NOT GO. One quiet permanent line sits on the case saying replies stay in
 * the browser and no mail leaves the site (`[ref].astro`, `.tk-preview-note`). It is the only such
 * statement on the page — the old failure sentence was the second, and two of them was already one
 * too many. The composer's `failed` state and its region are KEPT: a real store can genuinely fail a
 * send, the catalog lists it as one of the four composer states, and nothing in this preview reaches
 * it.
 *
 * ── WHAT SURVIVES A RELOAD: `sessionStorage`, PER TAB, PER CASE ────────────────────────────────
 * The decision, and it goes against `apps/design`'s "refreshing resets to the fixture" rule on
 * purpose — that rule is about `apps/design`, a harness whose whole job is to render a fixture, and
 * this is `apps/support`, which is a real static site being reviewed as a product. Every peer
 * behaviour in this app already persists: the chat transcript, the vote list, the portal session,
 * the page-feedback state. A reply that vanished on ⌘R would be the only thing here that forgets,
 * and the reviewer would have to retype it to look at the thread twice.
 *
 * `sessionStorage` rather than `localStorage`, which is the opposite of `chat-core.ts`'s choice and
 * for a reason that does not apply here: that module persists a SPEND budget, and per-tab storage
 * would hand out a fresh five messages with every new tab. A demo reply has no budget to defend. It
 * is a scratch artifact of one review sitting, and it should not still be sitting in the thread when
 * the same person opens the portal next week and reads it as real history. Per-tab is also what the
 * printed line promises, word for word.
 *
 * Keyed by `ref`, so two cases in two tabs do not bleed into each other, and a fixture case the
 * reviewer never touched is left exactly as built.
 *
 * ── EVERY STATE IS ALREADY IN THE DOM; THIS FILE MOVES ATTRIBUTES AND CLONES NODES ─────────────
 * `apps/support` is a static build, so nothing here can re-render. The status badges for all three
 * states are printed by the page and `data-case-status` selects one, exactly as the composer's two
 * button labels are both printed and `data-case-closed` selects one.
 *
 * AND NO MESSAGE IS BUILT WITH `createElement`. A sent message is a CLONE of a server-rendered
 * `<TicketMessage>` sitting in a `<template>` on the page, and a file chip is a clone of a
 * server-rendered `<FileChip>`. An Astro scoped `<style>` never reaches a node the client made, and
 * this app has already shipped that defect once — every message a visitor sent on the old `/chat/`
 * page went unstyled for the whole life of that page. A clone carries the compiler's hash classes,
 * so it cannot regress the same way.
 */

import { readSession } from './portal-session';
import { fmtBytes, fmtStamp, isoAttr } from './ticket-time';

/** The stored enum, mirrored. Kept as a literal union so an unknown string cannot be assigned. */
type CaseStatus = 'open' | 'pending' | 'closed';

/** The three glyph buckets `FileChip` draws, mirrored from `data/tickets.ts`. */
type ChipKind = 'image' | 'document' | 'other';

interface SentAttachment {
  name: string;
  bytes: number;
  kind: ChipKind;
}

interface SentMessage {
  id: string;
  /** ISO 8601. Formatted through `ticket-time.ts` like every other stamp on these surfaces. */
  at: string;
  body: string;
  attachments: SentAttachment[];
}

interface CaseState {
  status: CaseStatus;
  sent: SentMessage[];
}

const KEY = (ref: string) => `support-case-${ref}`;

/* Storage can throw — Safari private mode, a blocked third-party context, a full quota. A preview
   that loses its replies is a worse demo; a preview that throws is a broken page. So every read and
   every write is guarded and the page keeps working without persistence. */
const readState = (ref: string): CaseState | null => {
  try {
    const raw = sessionStorage.getItem(KEY(ref));
    return raw ? (JSON.parse(raw) as CaseState) : null;
  } catch {
    return null;
  }
};

const writeState = (ref: string, state: CaseState): void => {
  try {
    sessionStorage.setItem(KEY(ref), JSON.stringify(state));
  } catch {
    /* Nothing to report: the reply is on screen either way, and an error region for a storage
       refusal would be louder than the thing it reports. */
  }
};

/** MIME → the glyph bucket. `other` is honest rather than a guess dressed as a type. */
const kindOf = (type: string): ChipKind => {
  if (type.startsWith('image/')) return 'image';
  if (type === 'application/pdf' || type.startsWith('text/')) return 'document';
  return 'other';
};

export function wireTicketCase(): void {
  const root = document.querySelector<HTMLElement>('[data-case]');
  if (!root) return;

  /* SIGNED IN IS THE DEFAULT, here as on the list (2026-08-21). A case is still signed-in only;
     `?session=out` renders the locked capability in place rather than redirecting to a sign-in. */
  root.dataset.session = readSession();

  const ref = root.dataset.caseRef ?? '';
  const composer = root.querySelector<HTMLFormElement>('[data-composer]');
  const sendBtn = root.querySelector<HTMLButtonElement>('[data-composer-send]');
  const closeBtn = root.querySelector<HTMLButtonElement>('[data-case-close]');
  const draft = root.querySelector<HTMLTextAreaElement>('[data-composer] textarea');
  const files = root.querySelector<HTMLInputElement>('[data-composer] input[type="file"]');
  const thread = root.querySelector<HTMLElement>('[data-thread]');
  const lastActivity = root.querySelector<HTMLTimeElement>('[data-last-activity]');
  const msgTpl = root.querySelector<HTMLTemplateElement>('[data-tpl-message]');

  const state: CaseState = readState(ref) ?? {
    status: (root.dataset.caseStatus as CaseStatus) ?? 'open',
    sent: [],
  };

  const setStatus = (next: CaseStatus): void => {
    root.dataset.caseStatus = next;
    state.status = next;
    composer?.setAttribute('data-case-closed', String(next === 'closed'));
  };

  const chipFor = (a: SentAttachment): Element | null => {
    const tpl = root.querySelector<HTMLTemplateElement>(`[data-tpl-chip="${a.kind}"]`);
    const chip = tpl?.content.querySelector('.fc')?.cloneNode(true) as HTMLElement | undefined;
    if (!chip) return null;
    const name = chip.querySelector('.fc-name');
    const size = chip.querySelector('.fc-size');
    if (name) name.textContent = a.name;
    if (size) size.textContent = fmtBytes(a.bytes);
    return chip;
  };

  /** Clone → fill → append. Never `createElement`; see the header. */
  const paint = (m: SentMessage): HTMLElement | null => {
    const node = msgTpl?.content.querySelector('.tm')?.cloneNode(true) as HTMLElement | undefined;
    if (!node || !thread) return null;

    node.id = `m-${m.id}`;
    const time = node.querySelector('time');
    if (time) {
      time.setAttribute('datetime', isoAttr(m.at));
      time.textContent = fmtStamp(m.at);
    }
    const body = node.querySelector('.tm-body');
    /* `textContent`, not `innerHTML`: this string is whatever the customer typed. */
    if (body) body.textContent = m.body;

    const atts = node.querySelector('.tm-atts');
    if (atts && m.attachments.length > 0) {
      atts.classList.remove('tm-atts-none');
      for (const a of m.attachments) {
        const chip = chipFor(a);
        if (chip) atts.append(chip);
      }
    }

    thread.append(node);
    return node;
  };

  const moveLastActivity = (iso: string): void => {
    if (!lastActivity) return;
    lastActivity.setAttribute('datetime', isoAttr(iso));
    lastActivity.textContent = fmtStamp(iso);
  };

  /* ── REPLAY, BEFORE ANYTHING IS WIRED ──────────────────────────────────────────────────────
     The stored status is applied even with no stored messages, because closing a case is a change
     too and it has to survive the same reload the replies do. */
  setStatus(state.status);
  for (const m of state.sent) paint(m);
  const newest = state.sent.at(-1);
  if (newest) moveLastActivity(newest.at);
  /* Announced only from here on. Setting it before the replay would read the whole restored
     backlog aloud on every load, which is the opposite of what a live region is for. */
  thread?.setAttribute('aria-live', 'polite');

  closeBtn?.addEventListener('click', () => {
    setStatus('closed');
    writeState(ref, state);
    /* The composer stays. It always stays — that is the whole ruling. What changes is the line above
       the actions and the label on the button, and both are already on the page. */
  });

  /* THE QUOTABLE ID, AND THE ONE CONTROL THE PAGE OWES IT. `ref` exists to be pasted — into a
     forum post, into a chat, into another email — so the page that shows it hands it over rather
     than asking the reader to select twelve characters by hand. The confirmation REPLACES the
     label instead of joining it, so the rail does not reflow on a click. */
  const copyBtn = root.querySelector<HTMLButtonElement>('[data-copy-ref]');
  copyBtn?.addEventListener('click', () => {
    const id = copyBtn.dataset.copyRef;
    if (!id) return;
    void navigator.clipboard
      ?.writeText(id)
      .then(() => {
        copyBtn.dataset.copied = 'true';
        window.setTimeout(() => delete copyBtn.dataset.copied, 1600);
      })
      /* A clipboard write can be refused by permission or by a non-secure origin. Failing SILENTLY
         is right here and only here: the id is already on screen, so the reader loses a convenience
         and nothing else — an error region for it would be louder than the thing it reports. */
      .catch(() => undefined);
  });

  composer?.addEventListener('submit', (e) => {
    e.preventDefault();
    if (!draft || draft.value.trim().length === 0) return;

    const body = draft.value.trim();
    const attachments: SentAttachment[] = Array.from(files?.files ?? []).map((f) => ({
      name: f.name,
      bytes: f.size,
      kind: kindOf(f.type),
    }));

    /* REOPEN BEFORE THE SEND RESOLVES, because the warning was given before the send: the reader was
       told "sending a reply reopens it", and the state has to agree with the sentence they read. */
    if (root.dataset.caseStatus === 'closed') setStatus('open');

    composer.setAttribute('data-composer-state', 'sending');
    if (sendBtn) sendBtn.disabled = true;

    /* The one artificial thing left. A real send is not instantaneous and a demo where the button
       resolves in the same frame reads as nothing having happened. */
    window.setTimeout(() => {
      const message: SentMessage = {
        id: `sent-${Date.now()}`,
        at: new Date().toISOString(),
        body,
        attachments,
      };

      const node = paint(message);
      state.sent.push(message);
      writeState(ref, state);
      moveLastActivity(message.at);

      /* CLEARED ONLY HERE. The draft survives `sending` and `failed`; it is emptied at the one
         moment the message is safely somewhere else, which is the whole point of the rule. */
      draft.value = '';
      if (files) files.value = '';

      composer.setAttribute('data-composer-state', 'empty');
      if (sendBtn) sendBtn.disabled = false;

      /* The reply lands, then the caret comes back — a person who just sent one may send another,
         and `preventScroll` keeps the focus move from yanking the view off the message they were
         given. `nearest` scrolls the minimum needed rather than re-centring a page that was already
         in the right place, and `prefers-reduced-motion` turns the animation off — this is the one
         scroll on the page the site initiates rather than the reader. */
      const calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      node?.scrollIntoView({ block: 'nearest', behavior: calm ? 'auto' : 'smooth' });
      draft.focus({ preventScroll: true });
    }, 400);
  });
}
