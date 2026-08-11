// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  DELETABLE_STATUSES,
  deleteButtonHtml,
  handleDeleteClick,
  isDeletable,
} from './delete-button'

const SPACE_ID = '11111111-1111-1111-1111-111111111111'
const RUN_ID = '33333333-3333-3333-3333-333333333333'

describe('isDeletable / DELETABLE_STATUSES', () => {
  it.each([
    'succeeded',
    'failed',
    'cancelled',
    'trial_complete',
    'trial_truncated',
  ])('returns true for %s (terminal)', (s) => {
    expect(isDeletable(s)).toBe(true)
  })

  it.each(['queued', 'running', 'cancelling', 'deleting', 'something_else'])(
    'returns false for %s',
    (s) => {
      expect(isDeletable(s)).toBe(false)
    },
  )

  it('contains exactly the five terminal statuses', () => {
    expect([...DELETABLE_STATUSES].sort()).toEqual([
      'cancelled',
      'failed',
      'succeeded',
      'trial_complete',
      'trial_truncated',
    ])
  })
})

describe('deleteButtonHtml', () => {
  it.each([
    'succeeded',
    'failed',
    'cancelled',
    'trial_complete',
    'trial_truncated',
  ])('returns a button when status is %s', (status) => {
    const html = deleteButtonHtml({ id: RUN_ID, status })
    expect(html).toContain('data-delete-run="' + RUN_ID + '"')
    expect(html).toContain('Delete')
    expect(html).toMatch(/^<button /)
  })

  it.each(['queued', 'running', 'cancelling', 'deleting'])(
    'returns empty string when status is %s',
    (status) => {
      expect(deleteButtonHtml({ id: RUN_ID, status })).toBe('')
    },
  )

  it('HTML-escapes the run id on the data attribute and aria-label', () => {
    const dirty = '"><script>alert(1)</script>'
    const html = deleteButtonHtml({ id: dirty, status: 'succeeded' })
    expect(html).not.toContain('<script>')
    expect(html).toContain('&quot;&gt;&lt;script&gt;')
  })
})

describe('handleDeleteClick', () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <section data-backup-history data-space-id="${SPACE_ID}">
        <button type="button" data-delete-run="${RUN_ID}">Delete</button>
      </section>
    `
  })

  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('returns false when the click target is not a delete button', async () => {
    const fetchImpl = vi.fn()
    const confirmImpl = vi.fn(() => true)
    const div = document.createElement('div')
    document.body.appendChild(div)
    const event = new MouseEvent('click', { bubbles: true })
    Object.defineProperty(event, 'target', { value: div })

    const handled = await handleDeleteClick(event, { fetchImpl, confirmImpl })
    expect(handled).toBe(false)
    expect(fetchImpl).not.toHaveBeenCalled()
    expect(confirmImpl).not.toHaveBeenCalled()
  })

  it('asks for confirmation BEFORE fetching', async () => {
    const fetchImpl: typeof fetch = vi.fn(
      async () => new Response('{}', { status: 202 }),
    ) as unknown as typeof fetch
    const confirmImpl = vi.fn(() => true)
    const btn = document.querySelector<HTMLButtonElement>(
      'button[data-delete-run]',
    )!
    const event = new MouseEvent('click', { bubbles: true })
    Object.defineProperty(event, 'target', { value: btn })

    const handled = await handleDeleteClick(event, { fetchImpl, confirmImpl })
    expect(handled).toBe(true)
    expect(confirmImpl).toHaveBeenCalledOnce()
    expect(fetchImpl).toHaveBeenCalledOnce()
  })

  it('skips fetch when confirm returns false (user cancelled the dialog)', async () => {
    const fetchImpl: typeof fetch = vi.fn() as unknown as typeof fetch
    const confirmImpl = vi.fn(() => false)
    const btn = document.querySelector<HTMLButtonElement>(
      'button[data-delete-run]',
    )!
    const event = new MouseEvent('click', { bubbles: true })
    Object.defineProperty(event, 'target', { value: btn })

    const handled = await handleDeleteClick(event, { fetchImpl, confirmImpl })
    expect(handled).toBe(true)
    expect(confirmImpl).toHaveBeenCalledOnce()
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('POSTs to /api/spaces/:sid/backup-runs/:rid/delete on confirm', async () => {
    const fetchImpl: typeof fetch = vi.fn(
      async () => new Response('{}', { status: 202 }),
    ) as unknown as typeof fetch
    const confirmImpl = vi.fn(() => true)
    const btn = document.querySelector<HTMLButtonElement>(
      'button[data-delete-run]',
    )!
    const event = new MouseEvent('click', { bubbles: true })
    Object.defineProperty(event, 'target', { value: btn })

    await handleDeleteClick(event, { fetchImpl, confirmImpl })

    const mock = fetchImpl as unknown as ReturnType<typeof vi.fn>
    const call = mock.mock.calls[0] as [string, RequestInit]
    expect(call[0]).toBe(
      `/api/spaces/${SPACE_ID}/backup-runs/${RUN_ID}/delete`,
    )
    expect(call[1].method).toBe('POST')
  })

  it('toggles aria-busy + disabled while in flight, clears in finally', async () => {
    const btn = document.querySelector<HTMLButtonElement>(
      'button[data-delete-run]',
    )!
    let resolveFetch!: (res: Response) => void
    const fetchImpl = vi.fn(
      () =>
        new Promise<Response>((resolve) => {
          resolveFetch = resolve
        }),
    )
    const confirmImpl = vi.fn(() => true)
    const event = new MouseEvent('click', { bubbles: true })
    Object.defineProperty(event, 'target', { value: btn })

    const pending = handleDeleteClick(event, { fetchImpl, confirmImpl })
    await Promise.resolve()
    expect(btn.disabled).toBe(true)
    expect(btn.getAttribute('aria-busy')).toBe('true')

    resolveFetch(new Response('{}', { status: 202 }))
    await pending
    expect(btn.disabled).toBe(false)
    expect(btn.getAttribute('aria-busy')).toBe('false')
  })

  it('clears the loading state even when fetch throws', async () => {
    const btn = document.querySelector<HTMLButtonElement>(
      'button[data-delete-run]',
    )!
    const fetchImpl = vi.fn(async () => {
      throw new TypeError('network')
    })
    const confirmImpl = vi.fn(() => true)
    const event = new MouseEvent('click', { bubbles: true })
    Object.defineProperty(event, 'target', { value: btn })

    await handleDeleteClick(event, { fetchImpl, confirmImpl })

    expect(btn.disabled).toBe(false)
    expect(btn.getAttribute('aria-busy')).toBe('false')
  })

  it('prevents the click from toggling the parent <details>', async () => {
    const btn = document.querySelector<HTMLButtonElement>(
      'button[data-delete-run]',
    )!
    const fetchImpl = vi.fn(async () => new Response('{}', { status: 202 }))
    const confirmImpl = vi.fn(() => true)
    const event = new MouseEvent('click', { bubbles: true, cancelable: true })
    Object.defineProperty(event, 'target', { value: btn })

    await handleDeleteClick(event, { fetchImpl, confirmImpl })

    expect(event.defaultPrevented).toBe(true)
  })

  it('returns true (handled) but skips fetch when the widget has no data-space-id', async () => {
    document.body.innerHTML = `
      <section data-backup-history>
        <button type="button" data-delete-run="${RUN_ID}">Delete</button>
      </section>
    `
    const btn = document.querySelector<HTMLButtonElement>(
      'button[data-delete-run]',
    )!
    const fetchImpl = vi.fn()
    const confirmImpl = vi.fn(() => true)
    const event = new MouseEvent('click', { bubbles: true })
    Object.defineProperty(event, 'target', { value: btn })

    const handled = await handleDeleteClick(event, { fetchImpl, confirmImpl })

    expect(handled).toBe(true)
    // Confirm still fires (user gestured intent) but fetch skipped (no spaceId).
    expect(fetchImpl).not.toHaveBeenCalled()
  })
})
