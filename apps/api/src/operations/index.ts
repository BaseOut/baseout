// The operation registry — every public endpoint declared once. The router,
// OpenAPI generator, and MCP tool catalog (api-mcp) all derive from this array.

import type { Operation } from "../lib/registry";
import { orgOperations } from "./orgs";
import { backupOperations } from "./backups";
import { schemaOperations } from "./schema";

export const operations: Operation[] = [...orgOperations, ...backupOperations, ...schemaOperations];
