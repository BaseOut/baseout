// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  CANCELLABLE_STATUSES,
  cancelButtonHtml,
  handleCancelClick,
  isCancellable,
} from './cancel-button'

const SPACE_ID = '11111111-1111-1111-1111-111111111111'
const RUN_ID = '33333333-3333-3333-3333-333333333333'

describe('isCancellable / CANCELLABLE_STATUSES', () => {
  it.each(['queued', 'running'])('returns true for %s', (s) => {
    expect(isCancellable(s)).toBe(true)
  })

  it.each([
    'succeeded',
    'failed',
    'trial_complete',
    'trial_truncated',
    'cancelling',
    'cancelled',
    'something_else',
  ])('returns false for %s', (s) => {
    expect(isCancellable(s)).toBe(false)
  })

  it('only contains the two active statuses', () => {
    expect([...CANCELLABLE_STATUSES].sort()).toEqual(['queued', 'running'])
  })
})

describe('cancelButtonHtml', () => {
  it.each(['queued', 'running'])(
    'returns a button when status is %s',
    (status) => {
      const html = cancelButtonHtml({ id: RUN_ID, status })
      expect(html).toContain('data-cancel-run="' + RUN_ID + '"')
      expect(html).toContain('Cancel')
      expect(html).toMatch(/^<button /)
    },
  )

  it.each([
    'succeeded',
    'failed',
    'trial_complete',
    'trial_truncated',
    'cancelling',
    'cancelled',
  ])('returns empty string when status is %s', (status) => {
    expect(cancelButtonHtml({ id: RUN_ID, status })).toBe('')
  })

  it('HTML-escapes the run id on the data attribute and aria-label', () => {
    const dirty = '"><script>alert(1)</script>'
    const html = cancelButtonHtml({ id: dirty, status: 'running' })
    expect(html).not.toContain('<script>')
    expect(html).toContain('&quot;&gt;&lt;script&gt;')
  })
})

describe('handleCancelClick', () => {
  let unhandledRejection: unknown = null

  beforeEach(() => {
    document.body.innerHTML = `
      <section data-backup-history data-space-id="${SPACE_ID}">
        <button type="button" data-cancel-run="${RUN_ID}">Cancel</button>
      </section>
    `
    unhandledRejection = null
  })

  afterEach(() => {
    document.body.innerHTML = ''
    if (unhandledRejection) throw unhandledRejection
  })

  it('returns false when the click target is not a cancel button', async () => {
    const fetchImpl = vi.fn()
    const div = document.createElement('div')
    document.body.appendChild(div)
    const event = new MouseEvent('click', { bubbles: true })
    Object.defineProperty(event, 'target', { value: div })

    const handled = await handleCancelClick(event, { fetchImpl })
    expect(handled).toBe(false)
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('POSTs to the canonical /api/spaces/:sid/backup-runs/:rid/cancel path', async () => {
    const fetchImpl: typeof fetch = vi.fn(
      async () => new Response('{}', { status: 200 }),
    ) as unknown as typeof fetch
    const btn = document.querySelector<HTMLButtonElement>(
      'button[data-cancel-run]',
    )!
    const event = new MouseEvent('click', { bubbles: true })
    Object.defineProperty(event, 'target', { value: btn })

    const handled = await handleCancelClick(event, { fetchImpl })

    expect(handled).toBe(true)
    const mock = fetchImpl as unknown as ReturnType<typeof vi.fn>
    expect(mock).toHaveBeenCalledOnce()
    const call = mock.mock.calls[0] as [string, RequestInit]
    expect(call[0]).toBe(
      `/api/spaces/${SPACE_ID}/backup-runs/${RUN_ID}/cancel`,
    )
    expect(call[1].method).toBe('POST')
  })

  it('toggles aria-busy + disabled on the button while in flight, clears in finally', async () => {
    const btn = document.querySelector<HTMLButtonElement>(
      'button[data-cancel-run]',
    )!
    let resolveFetch!: (res: Response) => void
    const fetchImpl = vi.fn(
      () =>
        new Promise<Response>((resolve) => {
          resolveFetch = resolve
        }),
    )
    const event = new MouseEvent('click', { bubbles: true })
    Object.defineProperty(event, 'target', { value: btn })

    const pending = handleCancelClick(event, { fetchImpl })
    // Microtask boundary so setButtonLoading runs.
    await Promise.resolve()
    expect(btn.disabled).toBe(true)
    expect(btn.getAttribute('aria-busy')).toBe('true')

    resolveFetch(new Response('{}', { status: 200 }))
    await pending
    expect(btn.disabled).toBe(false)
    expect(btn.getAttribute('aria-busy')).toBe('false')
  })

  it('clears the loading state even when fetch throws', async () => {
    const btn = document.querySelector<HTMLButtonElement>(
      'button[data-cancel-run]',
    )!
    const fetchImpl = vi.fn(async () => {
      throw new TypeError('network')
    })
    const event = new MouseEvent('click', { bubbles: true })
    Object.defineProperty(event, 'target', { value: btn })

    await handleCancelClick(event, { fetchImpl })

    expect(btn.disabled).toBe(false)
    expect(btn.getAttribute('aria-busy')).toBe('false')
  })

  it('prevents the click from toggling the parent <details>', async () => {
    const btn = document.querySelector<HTMLButtonElement>(
      'button[data-cancel-run]',
    )!
    const fetchImpl = vi.fn(async () => new Response('{}', { status: 200 }))
    const event = new MouseEvent('click', { bubbles: true, cancelable: true })
    Object.defineProperty(event, 'target', { value: btn })

    await handleCancelClick(event, { fetchImpl })

    expect(event.defaultPrevented).toBe(true)
  })

  it('returns true (handled) but skips fetch when the widget has no data-space-id', async () => {
    document.body.innerHTML = `
      <section data-backup-history>
        <button type="button" data-cancel-run="${RUN_ID}">Cancel</button>
      </section>
    `
    const btn = document.querySelector<HTMLButtonElement>(
      'button[data-cancel-run]',
    )!
    const fetchImpl = vi.fn()
    const event = new MouseEvent('click', { bubbles: true })
    Object.defineProperty(event, 'target', { value: btn })

    const handled = await handleCancelClick(event, { fetchImpl })

    expect(handled).toBe(true)
    expect(fetchImpl).not.toHaveBeenCalled()
  })
})
