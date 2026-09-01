import type { APIRoute } from 'astro';

export const prerender = false;

/**
 * Response capture stub. With D1 provisioned (survey-app task 2.1) this inserts
 * the response row and issues a real completion token; until then it accepts the
 * payload and returns a preview token so the flow completes end-to-end.
 */
export const POST: APIRoute = async ({ request }) => {
  let body: { surveyVersion?: string; answers?: unknown; email?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, error: 'invalid_json' }, { status: 400 });
  }
  if (!body.surveyVersion || typeof body.answers !== 'object') {
    return Response.json({ ok: false, error: 'missing_fields' }, { status: 400 });
  }
  // TODO(task 2.1): insert into SURVEY_DB (responses), return crypto-random token.
  return Response.json({ ok: true, token: 'preview' });
};
