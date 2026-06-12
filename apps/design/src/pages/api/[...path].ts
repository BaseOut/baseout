/**
 * Catch-all stub for every API endpoint apps/web pages call from the
 * client. In apps/design, none of these have backing services — we
 * return realistic-shaped success responses so the UI feels alive.
 *
 * Routes handled with bespoke responses (because the calling UI inspects
 * the body):
 *   POST /api/spaces/[spaceId]/backup-runs       → returns { ok, runId, triggerRunIds }
 *   GET  /api/spaces/[spaceId]/backup-runs       → returns { runs: [] } so the poll loop is quiet
 *   GET  /api/spaces                             → returns the fixture space list
 *   POST /api/connections/airtable/start         → 302 → /integrations?statusCode=connected
 *   POST /api/connections/storage/.../authorize  → 302 → /integrations?statusCode=connected
 *
 * Everything else returns 200 { ok: true }. Auth, onboarding, dismiss,
 * cancel, delete, rescan, base-selection — none of them persist, but
 * the calling UI is happy with the success.
 */

import type { APIRoute } from 'astro';
import { FIXTURE_ACCOUNT } from '../../fixtures/account';

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function redirect(to: string): Response {
  return new Response(null, { status: 302, headers: { Location: to } });
}

// Preserve the active design-version (?v=) across a simulated OAuth redirect,
// read from the Referer of the page that submitted the connect form.
function vQuery(request: Request): string {
  try {
    const v = new URL(request.headers.get('referer') ?? '').searchParams.get('v');
    return v ? `v=${encodeURIComponent(v)}&` : '';
  } catch {
    return '';
  }
}

function newRunId(): string {
  return `run_design_stub_${Math.floor(performance.now()).toString(36)}`;
}

const handler: APIRoute = async ({ params, request, url }) => {
  // `pages/api/[...path].ts` captures the segments AFTER `/api/`, so re-add the
  // prefix the handlers below match against (without it, every bespoke route
  // missed and fell through to `{ ok: true }`).
  const path = '/api/' + (params.path ?? '');
  const method = request.method.toUpperCase();

  // GET /api/spaces — sidebar refresh
  if (path === '/api/spaces' && method === 'GET') {
    return json({
      spaces: FIXTURE_ACCOUNT.spaces,
      activeSpaceId: FIXTURE_ACCOUNT.space?.id ?? null,
    });
  }

  // POST /api/spaces — create-space modal
  if (path === '/api/spaces' && method === 'POST') {
    return json({ ok: true, space: { id: `space_design_new_${Date.now()}`, name: 'New Space', status: 'active' } });
  }

  // POST /api/spaces/switch — switch active space
  if (path === '/api/spaces/switch' && method === 'POST') {
    return json({ ok: true });
  }

  // Per-space routes — match any spaceId
  const spaceMatch = /^\/api\/spaces\/([^/]+)(\/.+)?$/.exec(path);
  if (spaceMatch) {
    const tail = spaceMatch[2] ?? '';

    // GET backup-runs — return empty so the poll loop falls quiet (SSR seeded the list)
    if (tail === '/backup-runs' && method === 'GET') {
      return json({ runs: [] });
    }

    // POST backup-runs — kick off a run
    if (tail === '/backup-runs' && method === 'POST') {
      const runId = newRunId();
      return json({ ok: true, runId, triggerRunIds: [`run_trigger_${runId}`] });
    }

    // POST backup-runs/:id/cancel
    if (/^\/backup-runs\/[^/]+\/cancel$/.test(tail) && method === 'POST') {
      return json({ ok: true });
    }

    // POST backup-runs/:id/delete
    if (/^\/backup-runs\/[^/]+\/delete$/.test(tail) && method === 'POST') {
      return json({ ok: true });
    }

    // POST rescan-bases
    if (tail === '/rescan-bases' && method === 'POST') {
      return json({ ok: true, discovered: 0, autoAdded: 0, blockedByTier: 0 });
    }

    // PATCH backup-config (auto-add toggle, frequency, storage)
    if (tail === '/backup-config' && method === 'PATCH') {
      return json({ ok: true });
    }
    if (tail === '/backup-config' && method === 'POST') {
      return json({ ok: true });
    }

    // POST backup-config/bases — base selection
    if (tail === '/backup-config/bases' && method === 'POST') {
      return json({ ok: true });
    }
    if (tail === '/backup-config/bases' && method === 'GET') {
      return json({ bases: [] });
    }

    // POST space-events/:id/dismiss
    if (/^\/space-events\/[^/]+\/dismiss$/.test(tail) && method === 'POST') {
      return json({ ok: true });
    }

    return json({ ok: true });
  }

  // Connections — Airtable OAuth start: simulate returning from auth and drop the
  // first-time user straight into the SETUP flow (Configure, ?first=1). We don't
  // show a "Connected" overview here — there's no valid config yet; the user
  // configures, then "Save & run first backup" lands the connected+running final.
  if (path === '/api/connections/airtable/start' && method === 'POST') {
    return redirect(`/integrations/authorizing`);
  }

  // Connections — Airtable API-key connect: no OAuth redirect (the user pasted a
  // token), so skip the Authorizing interstitial and go straight into setup.
  if (path === '/api/connections/airtable/api-key' && method === 'POST') {
    return redirect(`/integrations/configure?first=1`);
  }

  // Connections — Airtable whoami probe (Test connection button)
  if (path === '/api/connections/airtable/test' && method === 'POST') {
    return json({
      connectionId: 'conn_design_airtable',
      airtable: {
        id: 'usrDESIGN0000000',
        scopes: ['data.records:read', 'data.recordComments:read', 'schema.bases:read'],
        email: 'designer@baseout.design',
      },
    });
  }

  // Connections — Storage (Google Drive / Dropbox / Box / OneDrive)
  if (/^\/api\/connections\/storage\/[^/]+\/(authorize|callback|disconnect)$/.test(path)) {
    if (path.endsWith('/authorize')) {
      return redirect(`/integrations?${vQuery(request)}status=connected`);
    }
    return json({ ok: true });
  }

  // Auth endpoints (better-auth) — always succeed
  if (path.startsWith('/api/auth/')) {
    if (path.includes('sign-in') || path.includes('sign-up')) {
      return json({ data: { status: 'sent' }, error: null });
    }
    if (path.includes('sign-out')) {
      return json({ success: true });
    }
    if (path.includes('update-user')) {
      return json({ data: { status: 'ok' }, error: null });
    }
    return json({ data: null, error: null });
  }

  // Onboarding complete
  if (path === '/api/onboarding/complete' && method === 'POST') {
    return json({ ok: true });
  }

  // /api/me — account context
  if (path === '/api/me' && method === 'GET') {
    return json({ account: FIXTURE_ACCOUNT });
  }

  // Default
  void url;
  return json({ ok: true });
};

export const GET = handler;
export const POST = handler;
export const PATCH = handler;
export const PUT = handler;
export const DELETE = handler;
export const ALL = handler;
