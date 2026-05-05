import { env } from 'cloudflare:workers'
import { describe, expect, it } from 'vitest'
import { createDb } from '../../src/db'

// Do not call sql.end() — vitest-pool-workers tears down the isolate per
// file, which closes the Miniflare Hyperdrive WebSocket cleanly. Calling
// end() mid-teardown races the postgres/cf/polyfills background read loop
// and surfaces an unhandled "Stream was cancelled" rejection that fails
// the suite even when assertions pass.
const { sql } = createDb(env.HYPERDRIVE.connectionString)

describe('integration smoke', () => {
  it('exposes a HYPERDRIVE binding with a connection string', () => {
    expect(env.HYPERDRIVE).toBeDefined()
    expect(env.HYPERDRIVE.connectionString).toBeTypeOf('string')
    expect(env.HYPERDRIVE.connectionString.length).toBeGreaterThan(0)
  })

  it('can query Postgres through the Hyperdrive stub', async () => {
    const rows = await sql`SELECT current_schema() AS schema`
    expect(rows[0]?.schema).toBeTypeOf('string')
  })

  it('has the baseout schema after migrations ran', async () => {
    const rows = await sql`
      SELECT schema_name
      FROM information_schema.schemata
      WHERE schema_name = 'baseout'
    `
    expect(rows).toHaveLength(1)
  })
})
