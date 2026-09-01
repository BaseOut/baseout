import { describe, it, expect, afterEach } from 'vitest'
import {
  fmtDateTime,
  fmtTime,
  fmtDay,
  fmtAbsolute,
  asOfWhen,
  expandedTimestamp,
  formatNextScheduledAt,
  setServerTimeZoneResolver,
} from './time'

// 2026-09-01 18:27 UTC = Sep 1, 2:27 PM in America/New_York (EDT, GMT-4).
const UTC_INSTANT = '2026-09-01T18:27:00.000Z'

afterEach(() => setServerTimeZoneResolver(null))

describe('viewer-timezone rendering (server side)', () => {
  it('fmtDateTime renders in the resolved viewer zone', () => {
    setServerTimeZoneResolver(() => 'America/New_York')
    expect(fmtDateTime(UTC_INSTANT)).toBe('Sep 1, 2:27 PM')
  })

  it('fmtTime renders in the resolved viewer zone', () => {
    setServerTimeZoneResolver(() => 'America/New_York')
    expect(fmtTime(UTC_INSTANT)).toBe('2:27 PM')
  })

  it('fmtDay shifts the DATE across midnight in the viewer zone', () => {
    // 02:00 UTC on Sep 1 is still Aug 31 in New York.
    setServerTimeZoneResolver(() => 'America/New_York')
    expect(fmtDay('2026-09-01T02:00:00.000Z')).toBe('Aug 31, 2026')
  })

  it('a UTC resolver renders UTC wall-clock time', () => {
    setServerTimeZoneResolver(() => 'UTC')
    expect(fmtDateTime(UTC_INSTANT)).toBe('Sep 1, 6:27 PM')
  })

  it('fmtAbsolute prints the offset of the resolved zone, not the runtime zone', () => {
    setServerTimeZoneResolver(() => 'America/New_York')
    expect(fmtAbsolute(UTC_INSTANT)).toBe('Sep 1, 2026, 2:27 PM (GMT-4)')
  })

  it('asOfWhen renders in the resolved viewer zone', () => {
    setServerTimeZoneResolver(() => 'America/New_York')
    expect(asOfWhen(UTC_INSTANT)).toBe('Sep 1, 2:27 PM')
  })

  it('expandedTimestamp renders in the resolved viewer zone', () => {
    setServerTimeZoneResolver(() => 'America/New_York')
    expect(expandedTimestamp(UTC_INSTANT)).toBe('Sep 1, 2026, 2:27:00 PM')
  })

  it('formatNextScheduledAt renders in the resolved viewer zone', () => {
    setServerTimeZoneResolver(() => 'America/New_York')
    const future = '2099-09-01T18:27:00.000Z'
    expect(formatNextScheduledAt(future, 0)).toBe('Sep 1, 2099, 2:27 PM')
  })

  it('with no resolver the runtime default zone applies (client behavior unchanged)', () => {
    setServerTimeZoneResolver(null)
    const expected = new Date(UTC_INSTANT).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    })
    expect(fmtDateTime(UTC_INSTANT)).toBe(expected)
  })

  it('a resolver returning undefined falls through to the runtime default', () => {
    setServerTimeZoneResolver(() => undefined)
    const expected = new Date(UTC_INSTANT).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    })
    expect(fmtDateTime(UTC_INSTANT)).toBe(expected)
  })
})
