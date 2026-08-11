// Minimal engine client for staff surfaces — a slim sibling of
// apps/web/src/lib/backup-engine.ts exposing only the calls admin needs
// (startRun / cancelRun for staff actions, tokenHealth for the Connections
// dashboard). Result shapes and error-code vocabularies match web's client so
// the engine contract stays single-sourced in behavior. Extracting a shared
// engine-client package is a flagged system-* follow-up.

interface FetcherLike {
  fetch: (input: string, init?: RequestInit) => Promise<Response>
}

export interface EngineStartRunSuccess {
  ok: true
  runId: string
  triggerRunIds: string[]
}

export interface EngineStartRunError {
  ok: false
  code:
    | 'unauthorized'
    | 'run_not_found'
    | 'run_already_started'
    | 'connection_not_found'
    | 'invalid_connection'
    | 'config_not_found'
    | 'unsupported_storage_type'
    | 'no_bases_selected'
    | 'engine_unreachable'
    | 'engine_error'
  status: number
}

export type EngineStartRunResult = EngineStartRunSuccess | EngineStartRunError

export interface EngineCancelRunSuccess {
  ok: true
  cancelledTriggerRunIds: string[]
}

export interface EngineCancelRunError {
  ok: false
  code:
    | 'unauthorized'
    | 'run_not_found'
    | 'run_already_terminal'
    | 'engine_unreachable'
    | 'engine_error'
  status: number
}

export type EngineCancelRunResult = EngineCancelRunSuccess | EngineCancelRunError

export interface EngineTokenHealthSuccess {
  ok: true
  activeExpired: number
  refreshExpiringSoon: number
}

export interface EngineTokenHealthError {
  ok: false
  code: 'unauthorized' | 'engine_unreachable' | 'engine_error'
  status: number
}

export type EngineTokenHealthResult = EngineTokenHealthSuccess | EngineTokenHealthError

const KNOWN_START_ERROR_CODES = new Set<EngineStartRunError['code']>([
  'unauthorized', 'run_not_found', 'run_already_started', 'connection_not_found',
  'invalid_connection', 'config_not_found', 'unsupported_storage_type', 'no_bases_selected',
])

const KNOWN_CANCEL_ERROR_CODES = new Set<EngineCancelRunError['code']>([
  'unauthorized', 'run_not_found', 'run_already_terminal',
])

export interface AdminEngine {
  startRun(runId: string): Promise<EngineStartRunResult>
  cancelRun(runId: string): Promise<EngineCancelRunResult>
  tokenHealth(): Promise<EngineTokenHealthResult>
}

export function createAdminEngine(options: {
  binding: FetcherLike | undefined
  internalToken: string | undefined
}): AdminEngine | null {
  const { binding, internalToken } = options
  if (!binding || !internalToken) return null

  async function request(
    method: 'GET' | 'POST',
    path: string,
  ): Promise<{ res: Response } | { unreachable: true }> {
    try {
      const res = await binding!.fetch(`https://engine${path}`, {
        method,
        headers: { 'x-internal-token': internalToken!, accept: 'application/json' },
      })
      return { res }
    } catch {
      return { unreachable: true }
    }
  }

  const post = (path: string) => request('POST', path)

  async function errorBodyCode(res: Response): Promise<string | undefined> {
    try {
      const body = (await res.json()) as Record<string, unknown>
      return typeof body.error === 'string' ? body.error : undefined
    } catch {
      return undefined
    }
  }

  return {
    async startRun(runId) {
      const out = await post(`/api/internal/runs/${encodeURIComponent(runId)}/start`)
      if ('unreachable' in out) return { ok: false, code: 'engine_unreachable', status: 0 }
      if (out.res.ok) {
        const body = (await out.res.json()) as Omit<EngineStartRunSuccess, 'ok'>
        return { ok: true, ...body }
      }
      const raw = await errorBodyCode(out.res)
      const code = raw && KNOWN_START_ERROR_CODES.has(raw as EngineStartRunError['code'])
        ? (raw as EngineStartRunError['code'])
        : 'engine_error'
      return { ok: false, code, status: out.res.status }
    },

    async cancelRun(runId) {
      const out = await post(`/api/internal/runs/${encodeURIComponent(runId)}/cancel`)
      if ('unreachable' in out) return { ok: false, code: 'engine_unreachable', status: 0 }
      if (out.res.ok) {
        const body = (await out.res.json()) as Omit<EngineCancelRunSuccess, 'ok'>
        return { ok: true, ...body }
      }
      const raw = await errorBodyCode(out.res)
      const code = raw && KNOWN_CANCEL_ERROR_CODES.has(raw as EngineCancelRunError['code'])
        ? (raw as EngineCancelRunError['code'])
        : 'engine_error'
      return { ok: false, code, status: out.res.status }
    },

    async tokenHealth() {
      const out = await request('GET', '/api/internal/connections/token-health')
      if ('unreachable' in out) return { ok: false, code: 'engine_unreachable', status: 0 }
      if (out.res.ok) {
        const body = (await out.res.json()) as Omit<EngineTokenHealthSuccess, 'ok'>
        return { ok: true, ...body }
      }
      const raw = await errorBodyCode(out.res)
      return {
        ok: false,
        code: raw === 'unauthorized' ? 'unauthorized' : 'engine_error',
        status: out.res.status,
      }
    },
  }
}
