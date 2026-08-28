// Throwaway write-path proof operation (api-write-foundation task 1.2).
// DELIBERATELY NOT registered in `operations` (src/operations/index.ts) — it
// exists only for tests, which compose `[...operations, ...testOperations]`
// into their own router. Keeping it out of the shipped registry entirely is
// stricter than an E2E_TEST_MODE gate (review decision recorded here); delete
// this file once Phase 1 lands a real mutation.

import { z } from "zod";
import { json } from "../lib/responses";
import type { Operation } from "../lib/registry";

export const echoBodySchema = z.object({
  message: z.string(),
  count: z.number().int().optional(),
});

export const testOperations: Operation[] = [
  {
    method: "PATCH",
    path: "/v1/_test/echo",
    scope: "org:read",
    summary: "Echo the validated body back (write-path test only).",
    bodySchema: echoBodySchema,
    handler: (c) => json({ echoed: c.body }, c.requestId),
  },
];
