// @baseout/db-schema — Drizzle schema for the master DB.
//
// See ./openspec/proposal.md for the full intent. Tables are organized by
// domain in ./schema/*.ts and re-exported here. Migrations are generated via
// `pnpm db:generate` and applied via `pnpm db:migrate`.
//
// Conventions:
// - snake_case tables/columns
// - UUID primary keys (named `id`)
// - `created_at` / `modified_at` timestamps on every table
// - `_enc` suffix for AES-256-GCM-encrypted columns
//
// Implementation pending. Runtime apps consuming this package import named
// tables, e.g. `import { organizations, connections } from '@baseout/db-schema'`.

export {};
