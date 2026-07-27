/**
 * Global setup for the createTestHarness spike suite
 * (openspec/changes/system-test-harness-spike).
 *
 * Same contract as tests/integration/setup/globalSetup.ts (wait for
 * Postgres on 127.0.0.1:5432, ensure the `baseout` schema, apply drizzle
 * migrations) — but if nothing is listening on 5432 it first boots a
 * disposable embedded PostgreSQL 16 (same major as docker-compose.test.yml's
 * postgres:16-alpine) so the suite runs on machines without Docker.
 * When the Docker test DB is already up, this is a pass-through.
 */

import { mkdtempSync } from 'node:fs'
import net from 'node:net'
import os from 'node:os'
import path from 'node:path'
import integrationSetup from '../../integration/setup/globalSetup'

const PG_PORT = 5432

function portOpen(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = net.connect({ host: '127.0.0.1', port, timeout: 1_000 })
    socket.once('connect', () => {
      socket.destroy()
      resolve(true)
    })
    socket.once('error', () => resolve(false))
    socket.once('timeout', () => {
      socket.destroy()
      resolve(false)
    })
  })
}

export default async function globalSetup(): Promise<() => Promise<void>> {
  let embedded: { stop(): Promise<void> } | null = null

  if (!(await portOpen(PG_PORT))) {
    const { default: EmbeddedPostgres } = await import('embedded-postgres')
    const pg = new EmbeddedPostgres({
      databaseDir: mkdtempSync(path.join(os.tmpdir(), 'baseout-harness-pg-')),
      user: 'postgres',
      password: 'postgres',
      port: PG_PORT,
      persistent: false,
    })
    await pg.initialise()
    await pg.start()
    await pg.createDatabase('baseout_test')
    embedded = pg
  }

  const teardownIntegration = await integrationSetup()

  return async () => {
    teardownIntegration()
    if (embedded) await embedded.stop()
  }
}
