/**
 * App-facing db factory. The Astro runtime (middleware) is responsible for
 * creating one `db` per request and exposing it via `Astro.locals.db`.
 *
 * Node tooling (seed, scripts) should import `./node` directly and use its
 * long-lived module-scoped `db`.
 */

export { createDb, type AppDb } from './worker'
