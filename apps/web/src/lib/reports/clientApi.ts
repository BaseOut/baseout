/**
 * Browser helpers for Reports proxies (Phase 8). Used by ReportsView /
 * ReportDefinitionView client scripts — keeps fetch + loading spinner in one place.
 */
import { setButtonLoading } from '../ui'

export async function generateReport(
  spaceId: string,
  reportId: string,
  btn?: HTMLButtonElement | null,
): Promise<{ ok: true; runId: string } | { ok: false; error: string }> {
  if (btn) setButtonLoading(btn, true)
  try {
    const res = await fetch(
      `/api/spaces/${encodeURIComponent(spaceId)}/reports/${encodeURIComponent(reportId)}/generate`,
      { method: 'POST', headers: { accept: 'application/json', 'content-type': 'application/json' }, body: '{}' },
    )
    const body = (await res.json().catch(() => ({}))) as { runId?: string; error?: string; message?: string }
    if (!res.ok) return { ok: false, error: body.message || body.error || `generate_failed_${res.status}` }
    return { ok: true, runId: String(body.runId ?? '') }
  } catch {
    return { ok: false, error: 'network_error' }
  } finally {
    if (btn) setButtonLoading(btn, false)
  }
}

export async function deleteReport(
  spaceId: string,
  reportId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const res = await fetch(
      `/api/spaces/${encodeURIComponent(spaceId)}/reports/${encodeURIComponent(reportId)}`,
      { method: 'DELETE', headers: { accept: 'application/json' } },
    )
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string; message?: string }
      return { ok: false, error: body.message || body.error || `delete_failed_${res.status}` }
    }
    return { ok: true }
  } catch {
    return { ok: false, error: 'network_error' }
  }
}

export async function saveReportDefinition(
  spaceId: string,
  reportId: string | null,
  body: Record<string, unknown>,
  btn?: HTMLButtonElement | null,
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  if (btn) setButtonLoading(btn, true)
  try {
    const isCreate = !reportId || reportId === 'new'
    const path = isCreate
      ? `/api/spaces/${encodeURIComponent(spaceId)}/reports`
      : `/api/spaces/${encodeURIComponent(spaceId)}/reports/${encodeURIComponent(reportId)}`
    const res = await fetch(path, {
      method: isCreate ? 'POST' : 'PATCH',
      headers: { accept: 'application/json', 'content-type': 'application/json' },
      body: JSON.stringify(body),
    })
    const json = (await res.json().catch(() => ({}))) as {
      definition?: { id?: string }
      error?: string
      message?: string
    }
    if (!res.ok) return { ok: false, error: json.message || json.error || `save_failed_${res.status}` }
    const id = json.definition?.id ?? reportId ?? ''
    return { ok: true, id: String(id) }
  } catch {
    return { ok: false, error: 'network_error' }
  } finally {
    if (btn) setButtonLoading(btn, false)
  }
}

/** Open the authorized artifact stream in a new tab (PDF/HTML). */
export function downloadReportArtifact(spaceId: string, runId: string, format: 'pdf' | 'html'): void {
  const url = `/api/spaces/${encodeURIComponent(spaceId)}/reports/runs/${encodeURIComponent(runId)}/artifact?format=${format}`
  window.open(url, '_blank', 'noopener')
}
