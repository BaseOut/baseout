/**
 * Helper for routes that need to gate on tier capabilities. Reads the cache,
 * falls back to the resolver, populates cache on miss. Returns either the
 * resolved `TierCapabilitySet` (predicate passed) or a typed `Response`
 * (auth failure / no org / predicate failed) — caller checks the union with
 * `instanceof Response`.
 *
 * Caller pattern:
 *
 *   const caps = await enforceCapability(ctx, 'airtable', (c) => c.basesPerSpace !== null);
 *   if (caps instanceof Response) return caps;
 *   // …continue with caps…
 */

import type { APIContext } from 'astro'
import { resolveCapabilities, type ResolvedCapabilities } from './resolve'
import {
  getCachedCapabilities,
  setCachedCapabilities,
} from './cache'
import type { TierCapabilitySet } from './tier-capabilities'

const JSON_HEADERS = { 'Content-Type': 'application/json' }

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS })
}

export async function getCapabilitiesFor(
  ctx: Pick<APIContext, 'locals'>,
  platformSlug: string,
): Promise<ResolvedCapabilities | Response> {
  const account = ctx.locals.account
  if (!ctx.locals.user || !account) {
    return jsonResponse({ error: 'Not authenticated' }, 401)
  }
  const orgId = account.organization?.id
  if (!orgId) {
    return jsonResponse({ error: 'No active organization' }, 403)
  }

  const cached = getCachedCapabilities(orgId, platformSlug)
  if (cached) return cached

  const resolved = await resolveCapabilities(ctx.locals.db, orgId, platformSlug)
  setCachedCapabilities(orgId, platformSlug, resolved)
  return resolved
}

export async function enforceCapability(
  ctx: Pick<APIContext, 'locals'>,
  platformSlug: string,
  predicate: (caps: TierCapabilitySet) => boolean,
): Promise<TierCapabilitySet | Response> {
  const result = await getCapabilitiesFor(ctx, platformSlug)
  if (result instanceof Response) return result

  if (!predicate(result.capabilities)) {
    return jsonResponse({ error: 'Capability denied' }, 403)
  }
  return result.capabilities
}
