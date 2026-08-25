// D1 HTTP query executor (server-d1-backend 4.1). Same statement batch
// shape as provision DDL. Routes still use drizzle+postgres for managed_pg;
// this is the D1 arm those routes will call once they dispatch on backend.

import {
  queryD1,
  queryD1Batch,
  type D1ApiConfig,
} from "../provisioning/d1-api";

export interface SpaceD1Executor {
  query(sql: string, params?: unknown[]): Promise<unknown[]>;
  batch(statements: { sql: string; params?: unknown[] }[]): Promise<void>;
}

export function createSpaceD1Executor(
  config: D1ApiConfig,
  databaseId: string,
): SpaceD1Executor {
  return {
    query: (sql, params) => queryD1(config, databaseId, sql, params ?? []),
    batch: (statements) => queryD1Batch(config, databaseId, statements),
  };
}
