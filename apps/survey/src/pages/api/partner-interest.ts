import type { APIRoute } from 'astro';

export const prerender = false;

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/**
 * Partner-interest confirmation stub — records against the response row once D1 lands (task 2.1).
 *
 * THE ADDRESS IS ACCEPTED AND VALIDATED HERE EVEN THOUGH NOTHING IS WRITTEN YET. The finish page
 * now asks for the confirmation in a dialog that shows the address the respondent goes on the list
 * under and lets them correct it, so the corrected address has to reach the server or the
 * correction is theatre. Validating it now also means the persistence task is the insert and
 * nothing else: the field is already here, already trimmed, already lower-cased, already checked.
 */
export const POST: APIRoute = async ({ request }) => {
  let body: { token?: string; email?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, error: 'invalid_json' }, { status: 400 });
  }
  if (!body.token) return Response.json({ ok: false, error: 'missing_token' }, { status: 400 });

  const email = (body.email ?? '').trim().toLowerCase();
  if (!EMAIL_RE.test(email)) {
    return Response.json({ ok: false, error: 'invalid_email' }, { status: 400 });
  }

  // TODO(task 2.1): validate token → responses row, upsert partner_interest with `email`.
  return Response.json({ ok: true });
};
