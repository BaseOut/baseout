// Regenerate the OpenAPI 3 document from the operation registry.
//   pnpm --filter @baseout/api openapi:generate
// Writes openapi.json at the app root. Publishing it to docs.baseout.com is the
// deploy-side follow-up (task 5.1 — hosting mechanics are an open question).

import { writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { buildOpenApiDocument } from "../src/lib/openapi";
import { operations } from "../src/operations";

const out = resolve(dirname(fileURLToPath(import.meta.url)), "../openapi.json");
writeFileSync(out, JSON.stringify(buildOpenApiDocument(operations), null, 2) + "\n");
// eslint-disable-next-line no-console -- CLI script; stdout is the product (§3.5).
console.log(`wrote ${out} (${operations.length} operations)`);
