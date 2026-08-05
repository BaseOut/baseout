// GET /api/search/suggest?q= — typeahead quick results (admin-crm-ux Task 4.2).
// Staff-gated by src/middleware.ts like every admin route. Reuses the omnisearch
// planner (detectQuery → runSearch) with a tight per-type cap and returns entity
// METADATA ONLY ({ id, label, context, href } per group) — never token values,
// *_enc-derived data, or record content (the admin mirror omits *_enc entirely).
import type { APIRoute } from 'astro';
import { detectQuery, runSearch, toSuggestGroups } from '../../../lib/search';

const SUGGEST_PER_GROUP = 3;

export const GET: APIRoute = async ({ url, locals }) => {
  const q = (url.searchParams.get('q') ?? '').trim();
  const plan = detectQuery(q);
  if (plan.kind === 'empty') {
    return Response.json({ redirect: null, groups: [] });
  }
  const result = await runSearch(locals.db, plan);
  return Response.json({ redirect: result.redirect, groups: toSuggestGroups(result, SUGGEST_PER_GROUP) });
};
