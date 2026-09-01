import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { and, desc, eq, or } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/d1';
import { createAuth } from '../../lib/auth';
import { surveyProgress } from '../../lib/schema';

export const prerender = false;

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const MAX_ANSWERS_JSON = 100_000;

type SessionUser = { id: string; email: string; emailVerified: boolean };

/**
 * Privacy rule (spec: survey-resume): an anonymous session only ever sees the
 * row its own user created. Rows are matched by email ONLY for sessions whose
 * email better-auth has verified (the magic-link path) — most-recent row wins
 * and is re-pointed to the verified user (adopt-on-read, last-write-wins).
 */
async function findRow(db: ReturnType<typeof drizzle>, user: SessionUser, surveyVersion: string) {
  const own = and(eq(surveyProgress.userId, user.id), eq(surveyProgress.surveyVersion, surveyVersion));
  const match =
    user.emailVerified && user.email
      ? or(own, and(eq(surveyProgress.email, user.email), eq(surveyProgress.surveyVersion, surveyVersion)))
      : own;
  const rows = await db
    .select()
    .from(surveyProgress)
    .where(match)
    .orderBy(desc(surveyProgress.updatedAt))
    .limit(1);
  const row = rows[0];
  if (row && row.userId !== user.id) {
    await db
      .update(surveyProgress)
      .set({ userId: user.id, updatedAt: new Date() })
      .where(eq(surveyProgress.id, row.id));
    row.userId = user.id;
  }
  return row;
}

async function getSessionUser(ctx: Parameters<APIRoute>[0]): Promise<SessionUser | null> {
  const auth = createAuth(env, ctx.url.origin);
  const session = await auth.api.getSession({ headers: ctx.request.headers });
  return session?.user ?? null;
}

export const GET: APIRoute = async (ctx) => {
  const user = await getSessionUser(ctx);
  if (!user) return Response.json({ ok: false, error: 'unauthorized' }, { status: 401 });

  const surveyVersion = ctx.url.searchParams.get('v');
  if (!surveyVersion) return Response.json({ ok: false, error: 'missing_version' }, { status: 400 });

  const db = drizzle(env.SURVEY_DB);
  const row = await findRow(db, user, surveyVersion);
  if (!row) return Response.json({ ok: false, error: 'not_found' }, { status: 404 });

  let answers: unknown = {};
  try {
    answers = JSON.parse(row.answers);
  } catch {
    /* corrupt row — resume from an empty sheet rather than 500 */
  }
  return Response.json({
    ok: true,
    answers,
    stepIdx: row.stepIdx,
    email: row.email,
    completed: row.completedAt !== null,
  });
};

export const PUT: APIRoute = async (ctx) => {
  const user = await getSessionUser(ctx);
  if (!user) return Response.json({ ok: false, error: 'unauthorized' }, { status: 401 });

  let body: {
    surveyVersion?: string;
    answers?: unknown;
    stepIdx?: number;
    email?: string;
    completed?: boolean;
  };
  try {
    body = await ctx.request.json();
  } catch {
    return Response.json({ ok: false, error: 'invalid_json' }, { status: 400 });
  }

  const surveyVersion = body.surveyVersion;
  if (!surveyVersion || typeof body.answers !== 'object' || body.answers === null) {
    return Response.json({ ok: false, error: 'missing_fields' }, { status: 400 });
  }
  const answersJson = JSON.stringify(body.answers);
  if (answersJson.length > MAX_ANSWERS_JSON) {
    return Response.json({ ok: false, error: 'answers_too_large' }, { status: 413 });
  }
  const stepIdx =
    typeof body.stepIdx === 'number' && Number.isInteger(body.stepIdx) && body.stepIdx >= 0
      ? Math.min(body.stepIdx, 500)
      : 0;

  const db = drizzle(env.SURVEY_DB);
  const now = new Date();
  const row = await findRow(db, user, surveyVersion);

  if (row) {
    await db
      .update(surveyProgress)
      .set({
        answers: answersJson,
        stepIdx,
        updatedAt: now,
        ...(body.completed ? { completedAt: now } : {}),
      })
      .where(eq(surveyProgress.id, row.id));
    return Response.json({ ok: true });
  }

  const email = (body.email ?? '').trim().toLowerCase();
  if (!EMAIL_RE.test(email)) {
    return Response.json({ ok: false, error: 'invalid_email' }, { status: 400 });
  }
  await db.insert(surveyProgress).values({
    id: crypto.randomUUID(),
    userId: user.id,
    email,
    surveyVersion,
    answers: answersJson,
    stepIdx,
    createdAt: now,
    updatedAt: now,
    completedAt: body.completed ? now : null,
  });
  return Response.json({ ok: true });
};
