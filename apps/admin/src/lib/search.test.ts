import { describe, expect, it } from 'vitest'
import {
  decideRedirect,
  detectQuery,
  escapeLike,
  finalizeGroup,
  toSuggestGroups,
  GROUP_LIMIT,
  linkFor,
  membershipContext,
  orgContext,
  type MatchRef,
  type ResultRow,
} from './search'

describe('detectQuery', () => {
  // Precedence-ordered shape table (design D1). First match wins.
  const uuid = '3f1a2b3c-4d5e-6f70-8192-a3b4c5d6e7f8'
  const cases: Array<[string, string, boolean, string[]]> = [
    // input, kind, exact, lookups
    [uuid, 'uuid', true, ['backup_runs', 'restore_runs', 'connections', 'spaces', 'organizations']],
    [`  ${uuid.toUpperCase()}  `, 'uuid', true, ['backup_runs', 'restore_runs', 'connections', 'spaces', 'organizations']],
    ['cus_ABC123', 'stripe-customer', true, ['organizations']],
    ['sub_9xYz', 'stripe-subscription', true, ['subscriptions']],
    ['appABCDEF1234', 'at-base', true, ['at_bases']],
    ['appshort', 'text', false, ['organizations', 'spaces', 'users']], // too short for app-base shape → free text
    ['jane@acme.com', 'email', true, ['users']],
    ['acme', 'text', false, ['organizations', 'spaces', 'users']],
    ['', 'empty', false, []],
    ['   ', 'empty', false, []],
    ['a', 'empty', false, []], // <2 chars → no lookups
  ]

  it.each(cases)('%s → %s', (input, kind, exact, lookups) => {
    const plan = detectQuery(input)
    expect(plan.kind).toBe(kind)
    expect(plan.exact).toBe(exact)
    expect(plan.lookups).toEqual(lookups)
  })

  it('trims and preserves the normalized value', () => {
    expect(detectQuery('  Acme Corp  ').normalized).toBe('Acme Corp')
  })
})

describe('escapeLike', () => {
  it('escapes LIKE metacharacters so input matches literally', () => {
    expect(escapeLike('50%_off\\x')).toBe('50\\%\\_off\\\\x')
    expect(escapeLike('plain')).toBe('plain')
  })
})

describe('linkFor', () => {
  it('routes each entity through the single route authority', () => {
    expect(linkFor({ type: 'org', id: 'o1' })).toBe('/organizations/o1')
    expect(linkFor({ type: 'space', id: 's1' })).toBe('/spaces/s1')
    expect(linkFor({ type: 'user', id: 'u1' })).toBe('/users/u1')
    expect(linkFor({ type: 'backup_run', id: 'b1' })).toBe('/backups/b1')
    expect(linkFor({ type: 'connection', id: 'c1' })).toBe('/connections#c1')
    expect(linkFor({ type: 'restore_run', id: 'r1' })).toBe('/restores#r1')
  })

  it('links a base to its owning Space (a base has no page of its own)', () => {
    expect(linkFor({ type: 'base', id: 'ab1', spaceId: 's9' })).toBe('/spaces/s9')
  })

  it('leaves a base with no known Space unlinked', () => {
    expect(linkFor({ type: 'base', id: 'ab1', spaceId: null })).toBeNull()
  })
})

describe('decideRedirect', () => {
  const exactPlan = detectQuery('cus_ABC123')
  const textPlan = detectQuery('acme')
  const single: MatchRef[] = [{ type: 'org', id: 'o1' }]
  const multi: MatchRef[] = [
    { type: 'space', id: 'x' },
    { type: 'connection', id: 'x' },
  ]

  it('redirects on an exact-shape single match', () => {
    expect(decideRedirect(exactPlan, single)).toBe('/organizations/o1')
  })
  it('does not redirect when an exact shape matches more than once', () => {
    expect(decideRedirect(exactPlan, multi)).toBeNull()
  })
  it('never redirects for free-text, even on a single match', () => {
    expect(decideRedirect(textPlan, single)).toBeNull()
  })
  it('does not redirect with no matches', () => {
    expect(decideRedirect(exactPlan, [])).toBeNull()
  })
})

describe('finalizeGroup', () => {
  const row = (i: number): ResultRow => ({ id: `r${i}`, label: `R${i}`, context: null, href: `/x/${i}` })

  it('drops empty groups', () => {
    expect(finalizeGroup('users', 'Users', [])).toBeNull()
  })
  it('keeps ≤limit rows without a truncation flag', () => {
    const g = finalizeGroup('users', 'Users', Array.from({ length: GROUP_LIMIT }, (_, i) => row(i)))
    expect(g!.rows).toHaveLength(GROUP_LIMIT)
    expect(g!.truncated).toBe(false)
  })
  it('slices to the limit and flags truncation when the +1 probe row is present', () => {
    const g = finalizeGroup('users', 'Users', Array.from({ length: GROUP_LIMIT + 1 }, (_, i) => row(i)))
    expect(g!.rows).toHaveLength(GROUP_LIMIT)
    expect(g!.truncated).toBe(true)
  })
})

describe('orgContext', () => {
  it('summarizes distinct active tiers + a subscription status per org', () => {
    const m = orgContext([
      { organizationId: 'o1', tier: 'pro', subscriptionStatus: 'active' },
      { organizationId: 'o1', tier: 'growth', subscriptionStatus: 'active' },
      { organizationId: 'o2', tier: 'enterprise', subscriptionStatus: 'past_due' },
    ])
    expect(m.get('o1')).toBe('growth/pro · active')
    expect(m.get('o2')).toBe('enterprise · past_due')
    expect(m.get('missing')).toBeUndefined()
  })
})

describe('membershipContext', () => {
  it('joins each user’s org memberships into one disambiguating line', () => {
    const m = membershipContext([
      { userId: 'u1', organizationName: 'Acme' },
      { userId: 'u1', organizationName: 'Globex' },
      { userId: 'u2', organizationName: 'Initech' },
    ])
    expect(m.get('u1')).toBe('Acme, Globex')
    expect(m.get('u2')).toBe('Initech')
  })
})

describe('toSuggestGroups', () => {
  const row = (id: string, href: string | null) => ({ id, label: id, context: null, href })
  it('caps each group to perGroup, keeps only navigable rows, drops empty groups', () => {
    const result = {
      redirect: null,
      groups: [
        { key: 'org', label: 'Organizations', rows: [row('o1', '/organizations/o1'), row('o2', '/organizations/o2'), row('o3', '/organizations/o3'), row('o4', '/organizations/o4')], truncated: true },
        { key: 'user', label: 'Users', rows: [row('u1', null)], truncated: false }, // no href → dropped
        { key: 'space', label: 'Spaces', rows: [row('s1', '/spaces/s1')], truncated: false },
      ],
    }
    const out = toSuggestGroups(result, 3)
    expect(out.map((g) => g.key)).toEqual(['org', 'space']) // user dropped (no navigable rows)
    expect(out[0].rows).toHaveLength(3) // capped from 4
    expect(out[1].rows).toHaveLength(1)
  })

  it('returns empty for a no-result search', () => {
    expect(toSuggestGroups({ redirect: null, groups: [] }, 3)).toEqual([])
  })
})
