# airtable-client

Cross-cutting change. Introduces the Baseout Airtable client library to the monorepo:

1. Extracts Airtable OAuth (PKCE), AES-256-GCM crypto, and Meta API client from `apps/web/src/lib/airtable/` and `apps/web/src/lib/crypto.ts` into `packages/shared/airtable/`.
2. Updates `apps/web` to import from `@baseout/shared/airtable` (no behavior change).
3. Adds server-side capabilities to the shared library: Records API client (pagination + 429 handling), attachment URL refresh (1h-before-expiry re-fetch), Airtable Enterprise scope variant detection + handling, token refresh cadence helper.
4. Wires `apps/server` to use the Airtable client through a `Connection` accessor that reads `connections.access_token_enc / refresh_token_enc / token_expires_at` from the master DB.

See [proposal.md](./proposal.md), [design.md](./design.md), [tasks.md](./tasks.md), and [specs/airtable-client/spec.md](./specs/airtable-client/spec.md).

Source-of-truth anchors: PRD §2.1, §13.1, §17.4, §20.2; Features §6.3, §14.2, §14.3.
