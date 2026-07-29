/**
 * POST /api/workspaces/:wsId/alias
 *
 * Names a placeholder workspace group in the base picker
 * (base-picker-workspace-grouping). The picker fires this fire-and-forget
 * when a user renames a "Workspace N" group whose name Airtable withheld
 * (limited-access grant). The alias persists into
 * `space_workspaces.workspace_name` for the ACTIVE Space — 'placeholder-fill'
 * semantics by construction: the engine's workspace pass overwrites the name
 * when the real one becomes available, exactly as the design intends
 * ("theirs was a stand-in, not a preference"). The 'custom'/keep-mine
 * promotion flow is a follow-up (needs an alias-with-provenance column).
 *
 * Scoping: spaceId comes from locals.account (never the client) + the
 * workspace must already be enrolled for that Space — IDOR-safe.
 */

import type { APIRoute } from 'astro'
import { and, eq } from 'drizzle-orm'
import { spaceWorkspaces } from '../../../../db/schema'
import type { AccountContext } from '../../../../lib/account'

const MAX_ALIAS_LENGTH = 120

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

export interface AliasDeps {
  account: AccountContext | null
  wsId: string
  request: Request
  /** Persists the trimmed alias; returns how many rows matched. */
  saveAlias: (spaceId: string, workspaceId: string, alias: string) => Promise<{ updated: number }>
}

export async function handlePost(deps: AliasDeps): Promise<Response> {
  const spaceId = deps.account?.space?.id
  if (!spaceId) return json({ error: 'Not authenticated' }, 401)

  let alias: string
  try {
    const parsed = (await deps.request.json()) as { alias?: unknown }
    alias = typeof parsed.alias === 'string' ? parsed.alias.trim() : ''
  } catch {
    return json({ error: 'invalid_json' }, 400)
  }
  if (!alias || alias.length > MAX_ALIAS_LENGTH) {
    return json({ error: 'invalid_alias' }, 400)
  }

  const { updated } = await deps.saveAlias(spaceId, deps.wsId, alias)
  if (updated === 0) return json({ error: 'workspace_not_enrolled' }, 404)
  return json({ ok: true }, 200)
}

export const POST: APIRoute = async ({ locals, params, request }) => {
  return handlePost({
    account: locals.account ?? null,
    wsId: params.wsId ?? '',
    request,
    saveAlias: async (spaceId, workspaceId, alias) => {
      const rows = await locals.db
        .update(spaceWorkspaces)
        .set({ workspaceName: alias, modifiedAt: new Date() })
        .where(
          and(
            eq(spaceWorkspaces.spaceId, spaceId),
            eq(spaceWorkspaces.workspaceId, workspaceId),
          ),
        )
        .returning({ id: spaceWorkspaces.id })
      return { updated: rows.length }
    },
  })
}
