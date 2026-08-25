// D1 backend factory: create (idempotent) + apply sqlite DDL (server-d1-backend 3.1).

import { spaceD1ProvisionStatements } from "./d1-ddl";
import { serializeD1Locator } from "./d1-locator";
import { resolveSpaceD1Name } from "./d1-name";
import {
  createD1Database,
  queryD1Batch,
  type D1ApiConfig,
} from "./d1-api";

export interface ApplyD1SchemaInput {
  spaceId: string;
  envName: string;
  config: D1ApiConfig;
}

export async function applyD1Schema(
  input: ApplyD1SchemaInput,
): Promise<string> {
  const name = resolveSpaceD1Name(input.envName, input.spaceId.toLowerCase());
  const created = await createD1Database(input.config, name);
  await queryD1Batch(
    input.config,
    created.uuid,
    spaceD1ProvisionStatements({ spaceId: input.spaceId }),
  );
  return serializeD1Locator({
    d1DatabaseId: created.uuid,
    d1DatabaseName: created.name,
  });
}
