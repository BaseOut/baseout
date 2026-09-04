// GET /api/internal/orgs/:orgId/ai-credential   (shared-ai-byok task 3.3)
//
// The trusted, SERVER_INTERNAL_TOKEN-gated AI credential endpoint. The workflows chat
// task (task 4.1) runs on the Trigger.dev Node runner, which CANNOT decrypt the
// stored `ai_provider_keys.key_enc` ciphertext itself — the master encryption
// key (BASEOUT_ENCRYPTION_KEY) never leaves the Worker/env boundary. So at run
// start the task fetches the org's AI routing decision + (for byok) the
// DECRYPTED plaintext key over this endpoint.
//
// It reuses the exact routing + decrypt composition from lib/ai/byok-credential
// (`resolveByokAdapter`): pool everywhere unless the org is `byo_ai_key`-
// entitled AND has an `active` key for a callable provider.
//
// SECURITY (design review point #2):
//   - The `x-internal-token` gate is enforced by middleware for every
//     /api/internal/* path; this handler re-checks it (constant-time) as
//     defense-in-depth and rejects a bad/missing token BEFORE any resolve or
//     decrypt (CLAUDE.md §5.2 "token gate stays as defense-in-depth").
//   - The plaintext apiKey appears ONLY in this response body, which crosses
//     the trusted service boundary (SERVER binding + token gate). It is
//     NEVER logged. `{ mode: 'pool' }` carries no secret.

import type { AppLocals, Env } from "../../../../env";
import { constantTimeEqual } from "../../../../middleware";
import { resolveByokAdapter } from "../../../../lib/ai/byok-credential";
import type { ByokAdapterConfig } from "../../../../lib/ai/byok-credential";

/** The wire shape returned to the workflows Node runner. */
export type AiCredentialResponse =
  | { mode: "pool" }
  | { mode: "byok"; provider: string; model: string | null; apiKey: string };

/** Injected deps so the auth gate + pool/byok mapping unit-test with no DB. */
export interface AiCredentialDeps {
  /** True when the presented `x-internal-token` matches the expected secret. */
  verifyToken: (presented: string | null) => boolean;
  /** Resolve the org's byok adapter config, or null for the pool path. */
  resolveAdapter: (orgId: string) => Promise<ByokAdapterConfig | null>;
}

/**
 * Pure core: verify the token FIRST (no resolve/decrypt on a bad token), then
 * map the resolved adapter to the wire shape. Returns a `{ status, body }` pair
 * the thin handler serializes.
 */
export async function resolveAiCredential(
  presentedToken: string | null,
  orgId: string,
  deps: AiCredentialDeps,
): Promise<
  | { status: 401; body: { error: string } }
  | { status: 200; body: AiCredentialResponse }
> {
  if (!deps.verifyToken(presentedToken)) {
    return { status: 401, body: { error: "unauthorized" } };
  }
  const config = await deps.resolveAdapter(orgId);
  if (!config) return { status: 200, body: { mode: "pool" } };
  return {
    status: 200,
    body: {
      mode: "byok",
      provider: config.provider,
      model: config.model,
      apiKey: config.apiKey,
    },
  };
}

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

/**
 * Route handler (registered in src/index.ts). GET-only; wires the real deps:
 * a constant-time token check against env.SERVER_INTERNAL_TOKEN and the DB-backed
 * `resolveByokAdapter` with the master encryption key.
 */
export async function orgsAiCredentialHandler(
  request: Request,
  env: Env,
  _ctx: ExecutionContext,
  locals: AppLocals,
  orgId: string,
): Promise<Response> {
  if (request.method !== "GET") {
    return jsonResponse({ error: "method_not_allowed" }, 405);
  }

  const result = await resolveAiCredential(
    request.headers.get("x-internal-token"),
    orgId,
    {
      verifyToken: (presented) =>
        !!presented &&
        !!env.SERVER_INTERNAL_TOKEN &&
        constantTimeEqual(presented, env.SERVER_INTERNAL_TOKEN),
      resolveAdapter: (id) => {
        const { db } = locals.getMasterDb();
        return resolveByokAdapter(db, env.BASEOUT_ENCRYPTION_KEY, id);
      },
    },
  );
  return jsonResponse(result.body, result.status);
}
