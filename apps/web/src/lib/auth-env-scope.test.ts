import { describe, expect, it } from 'vitest'
import { withUserEnvScope, type AdapterWhereClause } from './auth-env-scope'

// Design D3, second amendment (Dan 2026-09-01): one email may exist once PER
// env (unique(email, runtime_env)), so every email-addressed user lookup the
// better-auth adapter makes must be scoped to THIS worker's env — otherwise
// magic-link/SSO flows pick an arbitrary row across envs. Id-addressed
// lookups and other models pass through untouched. Null worker env matches
// nothing (fail closed).

type Call = { method: string; args: { model?: string; where?: AdapterWhereClause[] } }

function fakeAdapterFactory(calls: Call[]) {
  const handler = (method: string) => async (args: Call['args']) => {
    calls.push({ method, args })
    return method === 'findMany' ? [] : null
  }
  return () => ({
    findOne: handler('findOne'),
    findMany: handler('findMany'),
    update: handler('update'),
    updateMany: handler('updateMany'),
    delete: handler('delete'),
    deleteMany: handler('deleteMany'),
    create: handler('create'),
    count: handler('count'),
  })
}

function envClause(where?: AdapterWhereClause[]) {
  return where?.find((w) => w.field === 'runtimeEnv')
}

describe('withUserEnvScope', () => {
  it('appends the env clause to email-addressed user findOne', async () => {
    const calls: Call[] = []
    const adapter = withUserEnvScope(fakeAdapterFactory(calls), 'dev')() as never as Record<
      string,
      (a: Call['args']) => Promise<unknown>
    >
    await adapter.findOne({
      model: 'user',
      where: [{ field: 'email', value: 'a@b.co', operator: 'eq' }],
    })
    const clause = envClause(calls[0].args.where)
    expect(clause).toMatchObject({ field: 'runtimeEnv', value: 'dev', connector: 'AND' })
  })

  it('scopes email-addressed update/delete on user too', async () => {
    const calls: Call[] = []
    const adapter = withUserEnvScope(fakeAdapterFactory(calls), 'staging')() as never as Record<
      string,
      (a: Call['args']) => Promise<unknown>
    >
    await adapter.update({ model: 'user', where: [{ field: 'email', value: 'a@b.co' }] })
    await adapter.deleteMany({ model: 'user', where: [{ field: 'email', value: 'a@b.co' }] })
    expect(envClause(calls[0].args.where)?.value).toBe('staging')
    expect(envClause(calls[1].args.where)?.value).toBe('staging')
  })

  it('leaves id-addressed user lookups untouched', async () => {
    const calls: Call[] = []
    const adapter = withUserEnvScope(fakeAdapterFactory(calls), 'dev')() as never as Record<
      string,
      (a: Call['args']) => Promise<unknown>
    >
    await adapter.findOne({ model: 'user', where: [{ field: 'id', value: 'u1' }] })
    expect(envClause(calls[0].args.where)).toBeUndefined()
  })

  it('leaves other models untouched', async () => {
    const calls: Call[] = []
    const adapter = withUserEnvScope(fakeAdapterFactory(calls), 'dev')() as never as Record<
      string,
      (a: Call['args']) => Promise<unknown>
    >
    await adapter.findOne({
      model: 'session',
      where: [{ field: 'email', value: 'a@b.co' }],
    })
    expect(envClause(calls[0].args.where)).toBeUndefined()
  })

  it('fails closed: null worker env scopes email lookups to a match-nothing sentinel', async () => {
    const calls: Call[] = []
    const adapter = withUserEnvScope(fakeAdapterFactory(calls), null)() as never as Record<
      string,
      (a: Call['args']) => Promise<unknown>
    >
    await adapter.findOne({
      model: 'user',
      where: [{ field: 'email', value: 'a@b.co' }],
    })
    expect(envClause(calls[0].args.where)?.value).toBe('__none__')
  })

  it('does not touch create (env is stamped by the user.create.before hook)', async () => {
    const calls: Call[] = []
    const adapter = withUserEnvScope(fakeAdapterFactory(calls), 'dev')() as never as Record<
      string,
      (a: Call['args']) => Promise<unknown>
    >
    await adapter.create({ model: 'user' })
    expect(calls[0].args.where).toBeUndefined()
  })
})
