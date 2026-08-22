/**
 * "Was this page helpful?" — the controller.
 *
 * THE SHAPE IS STRIPE'S, ported deliberately (Oleh, 2026-08-19, with their three screens): one
 * question with two answers, and only once it is answered does a reason list appear. The reason
 * list is where the value is. "37% said no" tells you nothing you can act on; "nine people said
 * `the steps did not match the app`" is a work item, and it is the difference between a widget that
 * decorates a page and one that produces a queue.
 *
 * WHAT WE CHANGED, and why each:
 *   · Stripe's "Code sample errors" is gone. This documentation has no code samples. In its place,
 *     `The steps did not match the app` and `It looks out of date`, which are the two ways a
 *     backup tool's docs actually rot: the UI moves, and a limit changes.
 *   · Stripe's "okay to follow up by email" is gone entirely. Stripe knows who you are; nobody is
 *     signed in here, so ours had to reveal an address field, and a field turns a one-click answer
 *     into a form. `/contact` is the door for anyone who wants a reply.
 *   · Nothing is sent, and the page says so in the same words `/contact` uses. There is no backend
 *     in this repo, and a thank-you that implies delivery is the one lie a support portal cannot
 *     afford. The verdict is kept in this browser instead, which is also what stops the page
 *     asking a reader the same question every visit.
 *
 * IN A .ts FILE, NOT AN INLINE `<script>`: `astro check` never type-checks a script block inside an
 * `.astro` file, so anything written there is unchecked by every gate this repo owns.
 */
export type Verdict = 'yes' | 'no';

interface Stored {
  verdict: Verdict;
  reason?: string;
  at: string;
}

/** Keyed by path: a verdict is about THIS page, and a reader may disagree with the next one. */
function storageKey(): string {
  return `bo-feedback:${window.location.pathname}`;
}

function read(): Stored | null {
  try {
    const raw = window.localStorage.getItem(storageKey());
    return raw ? (JSON.parse(raw) as Stored) : null;
  } catch {
    return null;
  }
}

function write(value: Stored): void {
  try {
    window.localStorage.setItem(storageKey(), JSON.stringify(value));
  } catch {
    /* storage disabled: the widget still works, it just asks again next visit */
  }
}

function show(root: HTMLElement, step: 'ask' | 'why' | 'done'): void {
  for (const el of root.querySelectorAll<HTMLElement>('[data-fb-step]')) {
    el.hidden = el.dataset.fbStep !== step;
  }
}

export function mountPageFeedback(): void {
  const root = document.querySelector<HTMLElement>('[data-feedback]');
  if (!root) return;

  const form = root.querySelector<HTMLFormElement>('[data-fb-form]');
  const why = root.querySelector<HTMLElement>('[data-fb-why]');
  const doneLine = root.querySelector<HTMLElement>('[data-fb-done-line]');
  if (!form || !why || !doneLine) return;

  /* A reader who already answered is shown the outcome rather than the question. Re-asking is how a
     widget teaches people to ignore it. */
  const prior = read();
  if (prior) {
    doneLine.textContent = 'Thanks. You already told us about this page.';
    show(root, 'done');
    return;
  }

  let verdict: Verdict | null = null;

  for (const btn of root.querySelectorAll<HTMLButtonElement>('[data-fb-verdict]')) {
    btn.addEventListener('click', () => {
      verdict = btn.dataset.fbVerdict === 'yes' ? 'yes' : 'no';
      why.dataset.fbTone = verdict;
      show(root, 'why');
      /* Focus the heading of the step that just appeared: a screen reader is otherwise left on a
         button that no longer exists on screen. */
      root.querySelector<HTMLElement>('[data-fb-why-h]')?.focus();
    });
  }

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    if (!verdict) return;
    const picked = form.querySelector<HTMLInputElement>('input[name="reason"]:checked');
    write({ verdict, reason: picked?.value, at: new Date().toISOString() });
    doneLine.textContent =
      verdict === 'yes' ? 'Thanks, that is good to know.' : 'Thanks. We will look at this page.';
    show(root, 'done');
  });

  /* Skipping the reasons is a legitimate answer and must cost one click, not a hunt. */
  root.querySelector<HTMLButtonElement>('[data-fb-skip]')?.addEventListener('click', () => {
    if (!verdict) return;
    write({ verdict, at: new Date().toISOString() });
    doneLine.textContent = 'Thanks.';
    show(root, 'done');
  });
}
