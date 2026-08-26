/**
 * The three transactional emails, read off disk at BUILD TIME for `/handoff/emails/`.
 *
 * WHY THIS FILE EXISTS RATHER THAN FRONTMATTER: `.astro` frontmatter must stay thin in this repo —
 * union-heavy types and file reads there have broken esbuild before — so the reading, the parsing
 * and the types live in a `.ts` sibling and the page renders what it is handed.
 *
 * ── THE COMPILED HTML IS THE SUBJECT, NOT THE SOURCE ────────────────────────────────────────────
 * `emails/*.html` is what gets sent, so it is what the preview must show. Reading the `.mjml` and
 * compiling it here would put a second compiler in the page and let the preview disagree with the
 * artefact — the preview would be right and the mailbox would be wrong, which is the wrong way round
 * for a thing whose job is to be believed. The consequence is stated plainly on the page: if the
 * build script has not been run, the frames are empty and the page says so instead of pretending.
 *
 * ── THE VARIABLE LIST IS DERIVED, NOT RETYPED ───────────────────────────────────────────────────
 * Names come out of the compiled HTML by matching the placeholder syntax itself, so the list on the
 * page is the set of variables the template ACTUALLY carries. A hand-written list is a second copy
 * that goes stale silently — and it goes stale in the direction that matters, because the person
 * wiring the send reads the list and not the template.
 *
 * The prose beside each name is hand-written and is the one half that CAN drift. It is therefore
 * optional: a variable with no note prints as a bare name rather than borrowing a neighbour's
 * description or being dropped from the list. A missing sentence is visible; a missing row is not.
 */
/* ── HOW THE FILES ARE READ, AND WHY NOT `node:fs` ──────────────────────────────────────────────
 * The first version of this used `readFileSync(new URL('../../emails/', import.meta.url))`. It
 * worked on the dev server and produced THREE EMPTY FRAMES in the production build, with every gate
 * green: `astro build` bundles this module into a chunk in a temporary directory, so `import.meta.url`
 * no longer points anywhere near `apps/support/emails/`, `existsSync` said no, and the page rendered
 * its own honest "not compiled" notice — which is exactly the failure that notice was written for,
 * arriving for the wrong reason. Only reading the built HTML caught it.
 *
 * `import.meta.glob(..., { query: '?raw', eager: true })` is Vite's own build-time file read. The
 * paths are resolved by the bundler at transform time, so dev and build agree by construction, and
 * it drops the `node:fs` import — which this app, being a fully static build with a Cloudflare
 * deploy target, is better off without.
 */
const RAW: Record<string, string> = {
  ...(import.meta.glob('../../emails/*.html', { query: '?raw', import: 'default', eager: true }) as Record<string, string>),
  ...(import.meta.glob('../../emails/*.txt', { query: '?raw', import: 'default', eager: true }) as Record<string, string>),
};

/* THE ONE PLACE THE PREVIEW DIFFERS FROM WHAT IS SENT, and it is here rather than in the template
   because the template has to be right for the mail client, not for us.

   The masthead logo is referenced by an ABSOLUTE URL, because a relative path resolves against
   nothing in a mail client — there is no document base in an inbox. That absolute URL is the
   production host, which does not answer on localhost, so an unrewritten preview would show a broken
   image on every one of these and the reviewer would be looking at a defect we introduced by
   previewing. Stripping the origin turns it into a site-root path, which is exactly what this app
   serves from `public/`, so the preview shows the real file.

   IT IS A REWRITE OF THE PREVIEW, NOT OF THE FILE. `emails/*.html` on disk keeps the absolute URL,
   `emails:check` still diffs against a fresh compile, and the bytes that would be mailed are the
   bytes in the repo. What the preview cannot prove, and never could, is that the URL resolves once
   deployed; that needs the deployed host. */
const SITE_ORIGIN = 'https://support.baseout.com';

const read = (name: string): string | null => {
  const key = Object.keys(RAW).find((k) => k.endsWith(`/${name}`));
  if (!key) return null;
  const raw = RAW[key]!;
  return name.endsWith('.html') ? raw.split(`${SITE_ORIGIN}/email/`).join('/email/') : raw;
};

export interface EmailVariable {
  name: string;
  /** Hand-written, and allowed to be absent — see the header. */
  note?: string;
}

/** One drawing of one email. Both styles carry the same words; see any `*-style2.mjml` header. */
export interface EmailBody {
  /** The compiled HTML, as it would be sent apart from the logo origin. `null` before the build. */
  html: string | null;
  /** The plain-text part. */
  text: string | null;
}

/** The two drawings. `one` is the plain-type letter, `two` the instrument. */
export type StyleKey = 'one' | 'two';

export interface EmailPreview {
  slug: string;
  title: string;
  /** One sentence: when this is sent and what it has to achieve. */
  purpose: string;
  /** The subject line, verbatim, placeholders and all. Shared by both styles: a style is a drawing,
   *  and two drawings of one email do not get two subject lines. */
  subject: string | null;
  styles: Record<StyleKey, EmailBody>;
  variables: EmailVariable[];
}

/* The notes. Keyed by variable name, shared across templates where the name is shared — `case_ref`
   means the same thing in all three and describing it twice is how two descriptions appear. */
const NOTES: Record<string, string> = {
  case_ref: 'The quotable reference, e.g. BO-4F2A91X7. Minted on submit.',
  case_subject: "The customer's own subject. Echoed in the reply and never in the acknowledgement.",
  case_url: 'The case in the portal. An offer, last, never the payload.',
  reply_to_address: 'The address the customer typed, printed back to them.',
  support_address: 'The fallback inbox, reachable when our mail is being filtered.',
  submitted_subject: 'What they wrote in the subject field. Body only.',
  submitted_body: 'What they wrote in the message field.',
  space_label: 'Optional. The Space they picked — omit the row when there is none, never blank it.',
  author_name: 'A real name, or the literal "Baseout Support". Never an invented person.',
  reply_body: 'The answer. Escape it — it is authored text.',
  quoted_history: 'The thread so far, already quoted.',
  login_url: 'The single-use link. Never shortened, never tracker-wrapped.',
  link_expires: "A human duration for the LINK's lifetime, e.g. 15 minutes.",
  request_url: 'Where to ask for another link.',
};

/** `{{ name }}` — the one placeholder syntax this directory uses. */
const PLACEHOLDER = /\{\{\s*([a-z0-9_]+)\s*\}\}/gi;

const variablesIn = (...sources: (string | null)[]): EmailVariable[] => {
  const found = new Set<string>();
  for (const s of sources) {
    if (!s) continue;
    for (const m of s.matchAll(PLACEHOLDER)) found.add(m[1]!);
  }
  return [...found].sort().map((name) => ({ name, note: NOTES[name] }));
};

/* ── THE PREVIEW IS FILLED IN, AND THE VALUES ARE THE PORTAL'S OWN CASE ─────────────────────────
   A page of `{{ case_ref }}` cannot be judged as a design. Braces are a different width, a different
   colour and a different rhythm from the strings they stand for, so a reviewer reading a template is
   reading a typographic accident rather than the email — a heading that wraps at two lines with a
   real subject in it wraps at one with a placeholder, and nobody sees the wrap until it ships.

   THESE ARE NOT INVENTED. Every value below is lifted verbatim from `data/tickets.ts`, the same case
   the ticket portal renders: reference `BO-7QX9-K4TD`, Dana Keller at Northwind, Priya Raghavan
   answering, the Sales CRM schedule that stopped. So the mailbox and the portal tell one story, and
   a reviewer moving between `/requests/` and this page is following the same customer rather than
   comparing two fictions. If the fixture changes, this drifts, and the fix is to re-copy it rather
   than to write a second version here.

   IT HAPPENS AFTER `variablesIn`, WHICH IS THE WHOLE TRICK. Filling first would leave no braces to
   scan and the variable list on `/handoff/` — the thing that tells an engineer what the sender has
   to supply — would silently come back empty. The list is built from the raw files; only the copy
   that gets DISPLAYED is filled.

   AND IT DOES NOT TOUCH `emails/*.html`. Same rule as the logo origin above: the bytes on disk are
   the bytes that would be mailed, `emails:check` still diffs against a fresh compile, and this is a
   view over them. Nothing here is a template change. */
const SAMPLE: Record<string, string> = {
  case_ref: 'BO-7QX9-K4TD',
  case_subject: 'Scheduled backup on Sales CRM has not run since Sunday',
  case_url: 'https://support.baseout.com/requests/BO-7QX9-K4TD/',
  reply_to_address: 'dana@northwind.example',
  support_address: 'support@baseout.com',
  submitted_subject: 'Scheduled backup on Sales CRM has not run since Sunday',
  submitted_body:
    'The nightly schedule on Sales CRM has not produced a run since Sunday. Nothing changed on ' +
    'our side that I know of, and the connection still shows as connected.',
  space_label: 'Ops · Northwind',
  author_name: 'Priya Raghavan',
  /* Verbatim from the fixture, em dash and all. Copying it exactly is the point; house style applies
     to the words this repo writes, and a quoted fixture that has been tidied is no longer the same
     message the portal is showing three clicks away. */
  reply_body:
    'A schedule stops producing runs when the connection behind it loses a scope rather than the ' +
    'connection itself — the Space keeps its green state and the run never starts. Open the Space, ' +
    'then Connections, and tell me what the scope line under Airtable reads.',
  quoted_history:
    'On Sun, 16 Aug 2026 at 08:41, Dana Keller <dana@northwind.example> wrote: The nightly ' +
    'schedule on Sales CRM has not produced a run since Sunday. Nothing changed on our side that ' +
    'I know of, and the connection still shows as connected.',
  login_url: 'https://support.baseout.com/signin/c8f2a1d0-4b77-4a3e-9c15-2f6b8e0d5a91',
  link_expires: '15 minutes',
  request_url: 'https://support.baseout.com/signin/',
};

const fill = (src: string | null): string | null =>
  src === null ? null : src.replace(PLACEHOLDER, (whole, name: string) => SAMPLE[name] ?? whole);

const load = (slug: string, title: string, purpose: string): EmailPreview => {
  const html = read(`${slug}.html`);
  const html2 = read(`${slug}-style2.html`);
  /* ONE TEXT PART AND ONE SUBJECT PER EMAIL, SHARED BY BOTH STYLES, because a style is a DRAWING and
     plain text has none. `*-style2.txt` files were written and then deleted: they were a second copy
     of the same words that could only ever drift from the first, and the thing they were copying is
     the part of the message that has no styling to vary. Both styles read this one. */
  const text = read(`${slug}.txt`);
  const subject = read(`${slug}.subject.txt`);
  return {
    slug,
    title,
    purpose,
    subject: fill(subject)?.trim() ?? null,
    styles: {
      one: { html: fill(html), text: fill(text) },
      two: { html: fill(html2), text: fill(text) },
    },
    /* RAW, NOT FILLED, AND FROM BOTH STYLES. Subject and text included: a variable used ONLY in the
       subject line is still a variable the sender has to supply, and it would be invisible if only
       the HTML were scanned. Both styles because a variable that appears in one drawing and not the
       other is still a variable, and reading only style one would hide it. */
    variables: variablesIn(html, text, html2, subject),
  };
};

/* THREE EMAILS, TWO DRAWINGS EACH. Style two used to be a fourth pick in the row; it is a shared
   toggle now that all three have one, which is what makes the control honest — a style switch that
   works on two of three surfaces and vanishes on the third is one people stop trusting. The picker
   answers "which email", the style toggle "drawn which way", and the two questions stay separate. */
export const EMAIL_PREVIEWS: EmailPreview[] = [
  load(
    'acknowledgement',
    'Acknowledgement',
    'Sent once, when someone submits from /contact/. It carries the same three facts as the receipt on screen, because a receipt in the mailbox that disagrees with the one on screen is worse than either alone.',
  ),
  load(
    'reply',
    'Support reply',
    "A human's answer arriving in the thread. The reference travels in the subject so the reply still threads after the headers expire.",
  ),
  load(
    'login-link',
    'Login link',
    'How someone gets into the support-only account their submission created. A separate email, so that a receipt never carries a live credential.',
  ),
];

/** True when the build script has not been run and there is nothing to show. */
export const EMAILS_NOT_BUILT = EMAIL_PREVIEWS.some((m) => m.styles.one.html === null);
