import { describe, it, expect } from 'vitest'
import { resolveViewerTimeZone, runWithTimeZone, TZ_COOKIE } from './server-timezone'
import { fmtDateTime } from './time'

const UTC_INSTANT = '2026-09-01T18:27:00.000Z'

describe('resolveViewerTimeZone', () => {
  it('reads the bo_tz cookie', () => {
    expect(
      resolveViewerTimeZone(`foo=1; ${TZ_COOKIE}=America%2FNew_York; bar=2`, undefined),
    ).toBe('America/New_York')
  })

  it('cookie wins over the cf fallback', () => {
    expect(
      resolveViewerTimeZone(`${TZ_COOKIE}=America/Chicago`, 'Europe/Berlin'),
    ).toBe('America/Chicago')
  })

  it('rejects an invalid cookie zone and falls back to cf', () => {
    expect(
      resolveViewerTimeZone(`${TZ_COOKIE}=Not/AZone`, 'Europe/Berlin'),
    ).toBe('Europe/Berlin')
  })

  it('rejects an invalid cf zone', () => {
    expect(resolveViewerTimeZone(null, 'garbage')).toBeUndefined()
  })

  it('returns undefined with no signal at all', () => {
    expect(resolveViewerTimeZone(null, undefined)).toBeUndefined()
    expect(resolveViewerTimeZone('', undefined)).toBeUndefined()
  })

  it('rejects absurdly long cookie values', () => {
    expect(
      resolveViewerTimeZone(`${TZ_COOKIE}=${'A'.repeat(200)}`, undefined),
    ).toBeUndefined()
  })
})

describe('runWithTimeZone', () => {
  it('binds the zone for formatters inside the scope, across awaits', async () => {
    const out = await runWithTimeZone('America/New_York', async () => {
      await Promise.resolve()
      return fmtDateTime(UTC_INSTANT)
    })
    expect(out).toBe('Sep 1, 2:27 PM')
  })

  it('leaves formatters on the runtime default outside the scope', () => {
    const expected = new Date(UTC_INSTANT).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    })
    expect(fmtDateTime(UTC_INSTANT)).toBe(expected)
  })

  it('runs the callback un-scoped when no zone was resolved', async () => {
    const expected = new Date(UTC_INSTANT).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    })
    const out = await runWithTimeZone(undefined, async () => fmtDateTime(UTC_INSTANT))
    expect(out).toBe(expected)
  })

  it('isolates concurrent scopes from each other', async () => {
    const [ny, berlin] = await Promise.all([
      runWithTimeZone('America/New_York', async () => {
        await new Promise((r) => setTimeout(r, 5))
        return fmtDateTime(UTC_INSTANT)
      }),
      runWithTimeZone('Europe/Berlin', async () => {
        await new Promise((r) => setTimeout(r, 1))
        return fmtDateTime(UTC_INSTANT)
      }),
    ])
    expect(ny).toBe('Sep 1, 2:27 PM')
    expect(berlin).toBe('Sep 1, 8:27 PM')
  })
})
