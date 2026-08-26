/**
 * Is there a person behind this page? One answer, read in one place, by both ticket surfaces.
 *
 * ── THE DEFAULT IS SIGNED IN (Oleh, 2026-08-21) ────────────────────────────────────────────────
 * There is still no auth in this app, so neither state is "true" — both are drawn. The default used
 * to be `out`, on the argument that a surface should be correct in the state it is actually in. That
 * argument loses to what this portal is FOR: it is a demo of the finished product, the same ruling
 * that removed the provisional banners, and a reviewer who opens `/requests/` to see the ticket
 * design should see the ticket design rather than a lock. `?session=out` shows the signed-out half,
 * and BOTH are DECLARED variants — `smoke-support.mjs` requests each, so either render silently
 * failing to generate is a red gate rather than a page nobody opened.
 *
 * ── IT IS NEVER PERSISTED ──────────────────────────────────────────────────────────────────────
 * `lib/shot-switch.ts` writes its variant to `localStorage` because it is comparing two designs
 * across a browsing session. This is not a preference — it is a claim about who you are, and a
 * sticky lie about identity is expensive in exactly the place it would stick. Read the URL, stamp the
 * attribute, done.
 *
 * ── SIGNED OUT IS A LOCKED CAPABILITY IN PLACE, NEVER A REDIRECT ───────────────────────────────
 * The industry answer is a 302 to a sign-in (verified live on Zapier's portal, and Figma's does the
 * same). We diverge on purpose: the portal is a separate origin, the catalog's ruling is "render in
 * place, never hide", and a redirect answers a question the person did not ask while throwing away
 * the explanation they came for.
 */
export type Session = 'in' | 'out';

const isSession = (v: string | null): v is Session => v === 'in' || v === 'out';

/** The URL is the only source. Absent or malformed reads as `in` — see the header. */
export function readSession(): Session {
  const v = new URLSearchParams(window.location.search).get('session');
  return isSession(v) ? v : 'in';
}

/**
 * Stamp the session onto `<html>` so a stylesheet can decide what is seen.
 *
 * The PRE-PAINT copy lives inline in `contact.astro` and is duplicated verbatim, for the same reason
 * `shot-switch.ts` is duplicated by `LandingBody.astro`: a module cannot run before the document is
 * parsed, and a page that paints "Sign in" at a reader who is signed in has already told them the
 * wrong thing. This function is the authority everywhere after that first paint.
 */
export function stampSession(session: Session = readSession()): void {
  document.documentElement.setAttribute('data-portal-session', session);
}
