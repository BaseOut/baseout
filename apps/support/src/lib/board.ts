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
import { PICKER_EVENT, resetPickerPlatforms } from './platform-picker';
import { hasVoted, looksLikeEmail, readVoteEmail, toggleVote, writeVoteEmail, VOTE_EMAIL_NOTE } from './votes';

const platformName = (id: string): string => PLATFORMS.find((p) => p.id === id)?.name ?? id;

/** "Airtable", "Airtable and Notion", "Airtable, ClickUp and Notion". */
function listNames(ids: string[]): string {
  const names = ids.map(platformName);
  if (names.length <= 1) return names[0] ?? '';
  return names.slice(0, -1).join(', ') + ' and ' + names[names.length - 1];
}

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
    /* THE PLATFORM FACET IS NO LONGER THIS FILE'S CONTROL. Until 2026-08-21 it was a row of
       `[data-plat-filter]` buttons this module pressed and un-pressed itself; it is now
       `components/PlatformPicker.astro`, which owns its own pressed state, its own keyboard
       behaviour and its own collapse. All that is left here is listening to what it decided.

       SCOPED TO THE BOARD, NOT TO THE DOCUMENT. `/roadmap/` renders FOUR pickers: this one plus the
       docs sidebar's, the search modal's and the chat's, all three of them `shared`. A document-wide
       query returns whichever Starlight put in the DOM first, which is the sidebar — so the count
       below would have been 3 instead of 5 and `Show all` would have reset the manual's filter
       instead of the board's, both silently and both looking like the control was ignoring clicks. */
    const picker = board.querySelector<HTMLElement>('[data-platform-picker]');
    const items = Array.from(board.querySelectorAll<HTMLElement>('[data-slug]'));
    const sections = Array.from(board.querySelectorAll<HTMLElement>('[data-sec]'));
    const empty = board.querySelector<HTMLElement>('[data-board-empty]');
    const narrow = board.querySelector<HTMLElement>('[data-plat-narrow]');
    const narrowText = board.querySelector<HTMLElement>('[data-plat-narrow-text]');

    let status = 'all';
    /* WHY THIS STAYS PAGE-LOCAL, AND THE OLD REASON IS NOT IT. The argument that used to sit here
       was that the board HIDES untagged items and the documentation filter must not, so the two
       could not share a value. Adopting the multi-select dissolved it: this board no longer hides
       them either (see the item loop below).

       WHAT REPLACES IT IS A VOCABULARY MISMATCH. The board's picker draws all five platform
       IDENTITIES, because here a platform is the SUBJECT of a request. Every documentation surface
       draws only the platforms that have pages — three of the five. A shared value would therefore
       be written in one alphabet and read in another: a click on Smartsheet here would repaint the
       docs sidebar to a filter naming a platform that control renders no row for, so nothing there
       could switch it back off, and "All platforms" would be unreachable from the sidebar for the
       rest of the session. The reverse is no better — a docs choice would silently re-filter a
       board the reader is counting rows on, from a control on another page.

       AND THE LIFETIME IS WRONG. `?platform=` and the stored preference are a durable statement
       about which manual this person wants. Which requests they are reading right now is a
       question about one list, and it should end when they leave it.

       THE COST, STATED: a `/roadmap/?platform=notion` link cannot exist. Nobody has asked for one,
       and the board is one screen with a control at the top of it. */
    let plat: string[] = [];
    let platCount = 0;

    const apply = () => {
      const anyStatus = status === 'all';
      /* BOTH ENDS ARE NO FILTER, and since 2026-08-21 both are reachable. Everything ticked narrows
         to nothing; nothing ticked also narrows to nothing, because the picker's lock on the last
         platform is gone and an empty selection now means "no narrowing" rather than "impossible".
         This line already read the empty case that way — it was written for the first paint, before
         any event had arrived — so the behaviour change cost it no edit, only this note. */
      const anyPlat = plat.length === 0 || plat.length === platCount;

      /* ONE ATTRIBUTE FOR BOTH FACETS, because the columns stop being true the moment EITHER
         narrows: a head reading "PLANNED 3" over one card is a stale count, and a card carries its
         own badge precisely so the board can collapse to a single list without losing the state. */
      board.toggleAttribute('data-filtered', !anyStatus || !anyPlat);

      for (const el of items) {
        const okStatus = anyStatus || el.dataset.status === status;
        /* AN UNTAGGED ITEM IS NEVER HIDDEN, AND THAT REVERSES WHAT THIS LINE USED TO DO. It read
           `el.dataset.platform === plat`, so choosing Airtable removed every request that named no
           platform — and a request that names no platform is not a request about nothing, it is a
           request about Baseout, which is to say about all five at once. Filtering to Airtable and
           being handed only the rows with the word "Airtable" on them dropped exactly the ones an
           Airtable user most wanted counted. It also matches the docs filter now, which has never
           hidden an untagged page, so the portal has one rule for this instead of two. */
        const okPlat = anyPlat || !el.dataset.platform || plat.includes(el.dataset.platform);
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
          /* THE SENTENCE CHANGED WITH THE BEHAVIOUR, and it had to. It used to end "Requests that
             apply to every platform are hidden", which is now false — leaving it would have been a
             notice actively lying about what the filter did. What is true is the other half: rows
             about the platforms NOT ticked are gone, and that is still worth saying, because the
             conclusion on offer from a short board is that nobody has asked us for much. */
          narrowText.textContent =
            `Showing ${listNames(plat)} requests, plus everything that applies to every platform. ` +
            'Requests specific to the other platforms are hidden.';
        }
      }

      for (const chip of statusChips) {
        chip.setAttribute('aria-pressed', String(chip.dataset.filter === status));
      }
    };

    for (const chip of statusChips) {
      chip.addEventListener('click', () => {
        status = chip.dataset.filter ?? 'all';
        apply();
      });
    }
    /* The picker announces on its own root and the event bubbles, so one listener on the document
       catches it wherever the control ends up sitting in the bar. `detail` is the ids that are ON,
       in catalogue order, and it CAN be empty — which `apply` reads as no filter, the same view as
       all of them ticked. */
    document.addEventListener(PICKER_EVENT, (e) => {
      /* Only a `local` picker fires this and the board owns the only one — but the guard is a line
         and the failure it prevents is a board silently re-filtered by a control belonging to the
         documentation, which is the exact confusion this whole pass came to remove. */
      if (!(e.target instanceof Node) || !board.contains(e.target)) return;
      plat = (e as CustomEvent<string[]>).detail ?? [];
      apply();
    });

    /* THE WAY BACK IS THE PICKER'S OWN PATH, NOT A SECOND COPY OF THE RULE. `Show all` used to set
       this module's variable and repaint; with the state living in the control, doing that would
       leave the notice gone and every chip still showing the narrowed set. Resetting the picker
       makes it fire the same event a click does, which repaints both. */
    board.querySelector<HTMLButtonElement>('[data-plat-show-all]')?.addEventListener('click', () => {
      if (picker) resetPickerPlatforms(picker);
    });

    /* The control's rendered rows are the denominator. Read off the markup rather than off
       `PLATFORM_IDS`, so a board whose picker ever draws a subset still knows what "all" means. */
    platCount = picker ? picker.querySelectorAll('[data-pk-opt]').length : PLATFORMS.length;

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
