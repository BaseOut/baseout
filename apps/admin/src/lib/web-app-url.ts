// Base URL of the customer app (apps/web), where login lives. Admin has no
// login of its own — it reuses web's better-auth session — so unauthenticated
// visitors route here. Override via WEB_APP_URL; defaults to the canonical
// local dev origin. Extracted from the middleware so the auth pages and the
// sign-out route share one resolution.
import { env } from 'cloudflare:workers'

export function webAppUrl(): string {
  const fromEnv = import.meta.env.DEV
    ? process.env.WEB_APP_URL
    : (env as unknown as { WEB_APP_URL?: string }).WEB_APP_URL
  return (fromEnv ?? 'https://baseout.local:4331').replace(/\/$/, '')
}
