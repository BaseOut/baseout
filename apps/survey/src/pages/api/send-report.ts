import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { BANDS } from '../../lib/maturity';
import { sendReport } from '../../lib/email';
import type { ReportLine } from '../../lib/email';

export const prerender = false;

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
/** Six practices today. A ceiling, not the count, so the extended index does not need a redeploy. */
const MAX_LINES = 24;
const MAX_TEXT = 400;

/**
 * "EMAIL ME MY REPORT" — the finish page's one outbound action.
 *
 * THE PAYLOAD COMES FROM THE CLIENT, AND THAT IS NOT A PREFERENCE. Neither half of what this route
 * needs is reachable from the server today: `/api/submit` is a stub that stores nothing and returns
 * the literal token `preview`, so there is no row to look an address or a score up in. The score
 * itself is computed in the browser from the answers `/survey` leaves in localStorage. So the
 * page sends what it is already displaying, and this route validates it rather than trusting it.
 *
 * WHAT THAT COSTS, WRITTEN DOWN SO IT IS NOT DISCOVERED LATER: anyone can post any address here and
 * have a report mailed to it. That is spam-shaped, and the fix is the same task that fixes
 * everything else here — once responses are persisted (task 2.1), the token identifies the row, the
 * address and the score come off the row, and the client sends nothing but the token. Until then
 * the validation below is the whole defence: shape, length, and a band that exists.
 */
export const POST: APIRoute = async ({ request }) => {
  let body: {
    token?: string;
    email?: string;
    score?: number;
    band?: string;
    blurb?: string;
    dimensions?: unknown;
    recommendations?: unknown;
  };
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, error: 'invalid_json' }, { status: 400 });
  }

  const email = (body.email ?? '').trim().toLowerCase();
  if (!EMAIL_RE.test(email)) {
    return Response.json({ ok: false, error: 'invalid_email' }, { status: 400 });
  }

  const score = body.score;
  if (typeof score !== 'number' || !Number.isFinite(score) || score < 0 || score > 100) {
    return Response.json({ ok: false, error: 'invalid_score' }, { status: 400 });
  }

  const band = body.band ?? '';
  if (!(BANDS as string[]).includes(band)) {
    return Response.json({ ok: false, error: 'invalid_band' }, { status: 400 });
  }

  if (!Array.isArray(body.dimensions) || body.dimensions.length === 0) {
    return Response.json({ ok: false, error: 'missing_dimensions' }, { status: 400 });
  }
  const raw = body.dimensions.slice(0, MAX_LINES);
  const dimensions: ReportLine[] = [];
  for (const d of raw) {
    const line = d as Partial<ReportLine>;
    if (
      typeof line.label !== 'string' ||
      typeof line.answer !== 'string' ||
      typeof line.score !== 'number' ||
      !Number.isFinite(line.score)
    ) {
      return Response.json({ ok: false, error: 'invalid_dimensions' }, { status: 400 });
    }
    dimensions.push({
      label: line.label.slice(0, MAX_TEXT),
      answer: line.answer.slice(0, MAX_TEXT),
      score: Math.max(0, Math.min(3, Math.round(line.score))),
    });
  }

  const recommendations = Array.isArray(body.recommendations)
    ? body.recommendations
        .filter((t): t is string => typeof t === 'string')
        .slice(0, MAX_LINES)
        .map((t) => t.slice(0, MAX_TEXT))
    : undefined;

  try {
    await sendReport(env, email, {
      score: Math.round(score),
      band,
      blurb: typeof body.blurb === 'string' ? body.blurb.slice(0, MAX_TEXT) : undefined,
      dimensions,
      recommendations,
    });
  } catch {
    // The provider is the one thing here that fails for reasons the caller cannot fix by retrying
    // the same second, so it gets its own status and its own code: the page tells the reader to try
    // again rather than telling them their address was wrong.
    return Response.json({ ok: false, error: 'send_failed' }, { status: 502 });
  }

  // TODO(task 2.1): record the send against the response row, so a second press can be rate-limited
  // and so "we emailed you on the 3rd" is answerable.
  return Response.json({ ok: true });
};
