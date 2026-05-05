import { describe, it, expect } from 'vitest'
import { resolveBaseURL } from 'better-auth'
import { createAuth } from './auth-factory'

describe('createAuth', () => {
  const auth = createAuth({} as never, {
    secret: 'test-secret',
    email: undefined,
    from: undefined,
    dev: true,
  })
  const baseURL = (auth.options as { baseURL: unknown }).baseURL as {
    allowedHosts: string[]
    fallback: string
  }

  it('declares loopback wildcards plus baseout.dev as allowed hosts', () => {
    expect(baseURL).toEqual({
      allowedHosts: [
        'localhost',
        'localhost:*',
        '127.0.0.1',
        '127.0.0.1:*',
        'baseout.dev',
      ],
      fallback: 'https://baseout.dev',
    })
  })

  it.each([
    ['http://localhost:4331/api/auth/sign-in/magic-link', 'localhost:4331', 'http://localhost:4331/api/auth'],
    ['http://localhost/api/auth/sign-in/magic-link', 'localhost', 'http://localhost/api/auth'],
    ['http://127.0.0.1:4331/api/auth/sign-in/magic-link', '127.0.0.1:4331', 'http://127.0.0.1:4331/api/auth'],
    ['https://baseout.dev/api/auth/sign-in/magic-link', 'baseout.dev', 'https://baseout.dev/api/auth'],
  ])('resolves request with host %s → %s', (url, host, expected) => {
    const req = new Request(url, { headers: { host } })
    expect(resolveBaseURL(baseURL, '/api/auth', req, undefined, true)).toBe(expected)
  })

  it.each([
    ['https://evil.com/x', 'evil.com'],
    ['https://www.baseout.dev/x', 'www.baseout.dev'],
    ['http://127.0.0.2/x', '127.0.0.2'],
  ])('falls back to baseout.dev for unauthorized host %s', (url, host) => {
    const req = new Request(url, { headers: { host } })
    expect(resolveBaseURL(baseURL, '/api/auth', req, undefined, true)).toBe('https://baseout.dev/api/auth')
  })

  it('uses env.baseUrl verbatim when set, ignoring Host-header inference', () => {
    const overrideAuth = createAuth({} as never, {
      secret: 'test-secret',
      email: undefined,
      from: undefined,
      dev: false,
      baseUrl: 'https://baseout.dev',
    })
    expect((overrideAuth.options as { baseURL: unknown }).baseURL).toBe('https://baseout.dev')
  })

  it('trusts baseout.dev plus localhost wildcards under dev: true', () => {
    expect((auth.options as { trustedOrigins: unknown }).trustedOrigins).toEqual([
      'https://baseout.dev',
      'http://localhost:*',
      'http://127.0.0.1:*',
    ])
  })

  it('trusts only baseout.dev under dev: false', () => {
    const prodAuth = createAuth({} as never, {
      secret: 'test-secret',
      email: undefined,
      from: undefined,
      dev: false,
    })
    expect((prodAuth.options as { trustedOrigins: unknown }).trustedOrigins).toEqual([
      'https://baseout.dev',
    ])
  })
})
