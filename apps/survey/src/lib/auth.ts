/**
 * better-auth server instance for the survey Worker.
 *
 * Two sign-in paths only (no passwords, no OAuth):
 * - anonymous(): the instant, no-verification session issued at the email-first
 *   start step. The entered email lives on survey_progress, NOT as auth identity.
 * - magicLink(): the verified resume path for expired sessions / new devices.
 *
 * Built per-request (Workers: bindings and I/O objects are request-scoped).
 */
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { anonymous, magicLink } from 'better-auth/plugins';
import { drizzle } from 'drizzle-orm/d1';
import * as schema from './schema';
import { sendMagicLink } from './email';

const DAY = 60 * 60 * 24;

export function createAuth(env: Env, requestOrigin: string) {
  const db = drizzle(env.SURVEY_DB, { schema });
  return betterAuth({
    baseURL: env.BETTER_AUTH_URL ?? requestOrigin,
    secret: env.BETTER_AUTH_SECRET ?? 'survey-dev-only-secret',
    database: drizzleAdapter(db, {
      provider: 'sqlite',
      schema: {
        user: schema.user,
        session: schema.session,
        account: schema.account,
        verification: schema.verification,
      },
    }),
    session: { expiresIn: 30 * DAY, updateAge: 1 * DAY },
    plugins: [
      anonymous({ emailDomainName: 'anon.survey.baseout.com' }),
      magicLink({
        sendMagicLink: async ({ email, url }) => sendMagicLink(env, email, url),
      }),
    ],
  });
}

export type Auth = ReturnType<typeof createAuth>;
