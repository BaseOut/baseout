/**
 * The request board: filtering, and the vote control.
 *
 * Extracted from `pages/roadmap.astro` because `astro check` does not walk `.astro` `<script>`
 * blocks — logic left inside one is invisible to every type gate we own.
 *
 * THE VOTE ASKS FOR AN EMAIL ONCE. Oleh's decision, 2026-08-19: the address is what makes a count
 * defensible and, more importantly, what lets us tell the voter when the item moves. It is asked
 * for on the first vote of a session and remembered after, so voting for a second item is one
 * click. It is never rendered anywhere.
 */
import { PLATFORMS } from './platforms';
import { hasVoted, looksLikeEmail, readVoteEmail, toggleVote, writeVoteEmail, VOTE_EMAIL_NOTE } from './votes';

const platformName = (id: string): string => PLATFORMS.find((p) => p.id === id)?.name ?? id;

export function wireBoard(): void {
  /* ── Filtering ───────────────────────────────────────────────────────────────────────────── */
  /* THE EARLY RETURN THAT USED TO BE HERE SILENTLY DISABLED THE VOTE ON EVERY DETAIL PAGE. Both
     surfaces call this function, but only `/roadmap/` carries `[data-board]` — so a bail-out on a
     missing board took the voting wiring down with the filtering, and the button on nine request
     pages did nothing at all when clicked. It looked wired: correct markup, correct handler, no
     console error. Filtering is now conditional and voting is unconditional, because they are
     independent features that happen to share a module. */
  const board = document.querySelector<HTMLElement>('[data-board]');

  if (board) {
    /* TWO FACETS, AND THEY ARE READ THE SAME WAY: each is one choice, and the two are combined with
       AND. The board used to hold one, so the whole filter lived in the chip that was clicked;
       state now lives here because "Airtable" and "Shipped" have to be answerable together.

       ITEMS ARE FOUND BY `[data-slug]`, NOT BY `.rb-card`. Suggested items are ROWS rather than
       cards (see the board's own argument), and selecting by the card class would have left the
       whole intake section visible under every filter — a failure that looks like a layout bug and
       is really a selector. A slug is what every item has regardless of the shape it is drawn in. */
    const statusChips = Array.from(document.querySelectorAll<HTMLButtonElement>('[data-filter]'));
    const platChips = Array.from(document.querySelectorAll<HTMLButtonElement>('[data-plat-filter]'));
    const items = Array.from(board.querySelectorAll<HTMLElement>('[data-slug]'));
    const sections = Array.from(board.querySelectorAll<HTMLElement>('[data-sec]'));
    const empty = board.querySelector<HTMLElement>('[data-board-empty]');
    const narrow = board.querySelector<HTMLElement>('[data-plat-narrow]');
    const narrowText = board.querySelector<HTMLElement>('[data-plat-narrow-text]');

    let status = 'all';
    let plat = 'all';

    const apply = () => {
      const anyStatus = status === 'all';
      const anyPlat = plat === 'all';

      /* ONE ATTRIBUTE FOR BOTH FACETS, because the columns stop being true the moment EITHER
         narrows: a head reading "PLANNED 3" over one card is a stale count, and a card carries its
         own badge precisely so the board can collapse to a single list without losing the state. */
      board.toggleAttribute('data-filtered', !anyStatus || !anyPlat);

      for (const el of items) {
        const okStatus = anyStatus || el.dataset.status === status;
        /* An untagged item is about Baseout itself, so a platform choice hides it. That is a
           deliberate divergence from the docs filter, which never hides an untagged page: there,
           narrowing removes noise from a manual you still have to be able to read; here, choosing
           Airtable is a question about Airtable, and answering it with eighteen rows that are not
           about any platform answers nothing. The notice below says so out loud rather than
           leaving the reader to infer it from an absence. */
        const okPlat = anyPlat || el.dataset.platform === plat;
        el.hidden = !(okStatus && okPlat);
      }

      let shown = 0;
      for (const sec of sections) {
        const own = Array.from(sec.querySelectorAll<HTMLElement>('[data-slug]'));
        const visible = own.filter((c) => !c.hidden).length;
        shown += visible;
        /* The terminal section holds the declined and the already-built, and neither is what
           anyone opened the board to read, so it stays folded away until somebody asks. A STATUS
           choice was the only thing that counted as asking, and that made a facet count lie: the
           platform chip said "Airtable 5" and revealed 3, because two of the five were terminal
           and the status facet was still "all". A number that does not match what clicking it
           shows is worse than a section nobody wanted.

           A PLATFORM CHOICE IS ALSO ASKING. It is as deliberate as picking a status, and this
           board's own intro promises to be honest about what is not coming; hiding two Airtable
           rows from a reader who asked for Airtable is the opposite of that. So either facet
           reveals it, and only the untouched board keeps it folded. */
        const isTerminal = sec.dataset.sec === 'terminal';
        sec.hidden = visible === 0 || (isTerminal && anyStatus && anyPlat);
      }

      if (empty) empty.hidden = shown > 0;

      if (narrow) {
        narrow.hidden = anyPlat;
        if (narrowText && !anyPlat) {
          narrowText.textContent =
            `Showing only requests specific to ${platformName(plat)}. ` +
            'Requests that apply to every platform are hidden.';
        }
      }

      for (const chip of statusChips) {
        chip.setAttribute('aria-pressed', String(chip.dataset.filter === status));
      }
      for (const chip of platChips) {
        chip.setAttribute('aria-pressed', String(chip.dataset.platFilter === plat));
      }
    };

    for (const chip of statusChips) {
      chip.addEventListener('click', () => {
        status = chip.dataset.filter ?? 'all';
        apply();
      });
    }
    for (const chip of platChips) {
      chip.addEventListener('click', () => {
        plat = chip.dataset.platFilter ?? 'all';
        apply();
      });
    }
    board.querySelector<HTMLButtonElement>('[data-plat-show-all]')?.addEventListener('click', () => {
      plat = 'all';
      apply();
    });

    apply();
  }

  /* ── Voting ──────────────────────────────────────────────────────────────────────────────── */
  const buttons = Array.from(document.querySelectorAll<HTMLButtonElement>('[data-vote]'));

  const paint = (btn: HTMLButtonElement) => {
    const slug = btn.dataset.vote ?? '';
    const on = hasVoted(slug);
    btn.setAttribute('aria-pressed', String(on));
    /* The word changes with the state. `aria-pressed` tells a screen reader and the fill tells a
       sighted reader, but a button still labelled "Vote" after voting reads as "it did not take". */
    const word = btn.querySelector<HTMLElement>('.rb-vote-word, .rd-vote-label');
    if (word) word.textContent = on ? 'Voted' : 'Vote';
    const count = btn.querySelector<HTMLElement>('.rb-count');
    if (!count) return; // Counts are hidden until a store backs them — see `lib/votes.ts`.
    const base = Number(count.dataset.base ?? count.textContent ?? '0');
    count.setAttribute('data-base', String(base));
    count.textContent = String(base + (on ? 1 : 0));
  };

  for (const btn of buttons) paint(btn);

  for (const btn of buttons) {
    btn.addEventListener('click', async () => {
      const slug = btn.dataset.vote ?? '';
      /* Withdrawing needs no address — only adding a vote has to be attributable. Asking again to
         take one back would read as a toll on changing your mind. */
      if (!hasVoted(slug) && !readVoteEmail()) {
        const email = await askForEmail();
        if (!email) return;
        writeVoteEmail(email);
      }
      toggleVote(slug);
      paint(btn);
    });
  }
}

/**
 * A `<dialog>`, so focus containment, Escape and the backdrop come from the platform rather than
 * from us re-implementing them. Built on demand and removed after: it exists for one answer.
 */
function askForEmail(): Promise<string | null> {
  return new Promise((resolve) => {
    const dlg = document.createElement('dialog');
    dlg.className = 'vote-dialog';
    dlg.innerHTML =
      /* `novalidate`: without it the browser's own constraint validation blocks submit BEFORE our
         handler runs, so the message that names the problem never renders and the visitor gets a
         transient native bubble instead. Measured — the error line stayed hidden on a bad address.
         The same reason `/contact/`'s forms carry it. */
      '<form method="dialog" novalidate>' +
      '<h2>One thing first</h2>' +
      `<p>${VOTE_EMAIL_NOTE} It lets us count each person once, and tell you when this moves.</p>` +
      '<label><span>Email</span><input type="email" name="email" required autocomplete="email" placeholder="you@company.com" /></label>' +
      '<p class="vote-dialog-err" hidden>That does not look like an email address.</p>' +
      '<div class="vote-dialog-actions">' +
      '<button type="button" data-cancel>Cancel</button>' +
      '<button type="submit" data-confirm>Vote</button>' +
      '</div>' +
      '</form>';
    document.body.append(dlg);

    const input = dlg.querySelector<HTMLInputElement>('input[name=email]')!;
    const err = dlg.querySelector<HTMLElement>('.vote-dialog-err')!;
    let answer: string | null = null;

    dlg.querySelector('[data-cancel]')?.addEventListener('click', () => dlg.close());

    dlg.querySelector('form')?.addEventListener('submit', (e) => {
      err.hidden = true;
      const value = input.value.trim();
      if (!looksLikeEmail(value)) {
        e.preventDefault(); // Keep the dialog open rather than losing what they typed.
        err.hidden = false;
        input.focus();
        return;
      }
      answer = value;
    });

    dlg.addEventListener('close', () => {
      dlg.remove();
      resolve(answer);
    });

    dlg.showModal();
    input.focus();
  });
}
