// App-facing db factory. Middleware creates one `db` per request and exposes
// it via Astro.locals.db. Mirrors apps/web/src/db/index.ts.
export { createDb, type AppDb } from './worker'
