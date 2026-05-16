// Production wiring for runWorkspaceRediscovery deps.
//
// The pure orchestrator in run.ts takes deps as functions; this factory
// resolves the per-Space context (organizationId, configId, active
// Airtable connection, decrypted access token) and returns the closure
// bag the route + (Phase 4) the SpaceDO alarm both share.
//
// Context validation collapses into four 4xx-shaped errors before any
// rediscovery side effect runs:
//   - space_not_found        — Space row missing
//   - config_not_found       — Space has no backup_configurations row
//   - connection_not_found   — Space's Org has no active Airtable connection
// (decryption / Airtable failures surface from inside runWorkspaceRediscovery
//  as thrown errors and become 502 at the route boundary.)

import { and, desc, eq, inArray, sql } from "drizzle-orm";
import type { AppDb } from "../../db/worker";
import {
  atBases,
  backupConfigurationBases,
  backupConfigurations,
  connections,
  platforms,
  spaceEvents,
  spaces,
} from "../../db/schema";
import { decryptToken } from "../crypto";
import { resolveCapabilities } from "../capabilities/resolve";
import {
  createAirtableClient,
  type AirtableBaseSummary,
} from "../airtable/client";
import type {
  AtBaseId,
  RediscoveryTrigger,
  SpaceEventInsert,
  UpsertAtBasesOptions,
  UpsertAtBasesRow,
  WorkspaceRediscoveryDeps,
} from "./run";

export interface BuildRediscoveryDepsInput {
  db: AppDb;
  spaceId: string;
  triggeredBy: RediscoveryTrigger;
  encryptionKey: string;
}

export interface RediscoveryContext {
  configId: string;
  organizationId: string;
}

export type BuildRediscoveryDepsResult =
  | {
      ok: true;
      context: RediscoveryContext;
      deps: WorkspaceRediscoveryDeps;
    }
  | {
      ok: false;
      error: "space_not_found" | "config_not_found" | "connection_not_found";
      context?: undefined;
      deps?: undefined;
    };

export async function buildRediscoveryDeps(
  input: BuildRediscoveryDepsInput,
): Promise<BuildRediscoveryDepsResult> {
  const { db, spaceId, encryptionKey } = input;

  const [space] = await db
    .select({ id: spaces.id, organizationId: spaces.organizationId })
    .from(spaces)
    .where(eq(spaces.id, spaceId))
    .limit(1);
  if (!space) return { ok: false, error: "space_not_found" };

  const [config] = await db
    .select({ id: backupConfigurations.id })
    .from(backupConfigurations)
    .where(eq(backupConfigurations.spaceId, spaceId))
    .limit(1);
  if (!config) return { ok: false, error: "config_not_found" };

  const [connectionRow] = await db
    .select({
      id: connections.id,
      status: connections.status,
      accessTokenEnc: connections.accessTokenEnc,
    })
    .from(connections)
    .innerJoin(platforms, eq(platforms.id, connections.platformId))
    .where(
      and(
        eq(connections.organizationId, space.organizationId),
        eq(platforms.slug, "airtable"),
      ),
    )
    .orderBy(desc(connections.createdAt))
    .limit(1);
  if (!connectionRow || connectionRow.status !== "active") {
    return { ok: false, error: "connection_not_found" };
  }

  const accessToken = await decryptToken(
    connectionRow.accessTokenEnc,
    encryptionKey,
  );
  const airtable = createAirtableClient({ accessToken });

  return {
    ok: true,
    context: {
      configId: config.id,
      organizationId: space.organizationId,
    },
    deps: buildDeps({
      db,
      airtableListBases: () => airtable.listBases(),
    }),
  };
}

interface DepsWiring {
  db: AppDb;
  airtableListBases: () => Promise<AirtableBaseSummary[]>;
}

function buildDeps(wiring: DepsWiring): WorkspaceRediscoveryDeps {
  const { db, airtableListBases } = wiring;

  return {
    fetchKnownAtBaseIds: async (spaceId) => {
      const rows = await db
        .select({ atBaseId: atBases.atBaseId })
        .from(atBases)
        .where(eq(atBases.spaceId, spaceId));
      return new Set<AtBaseId>(rows.map((r) => r.atBaseId));
    },

    fetchAutoAddToggle: async (configId) => {
      const [row] = await db
        .select({ autoAddFutureBases: backupConfigurations.autoAddFutureBases })
        .from(backupConfigurations)
        .where(eq(backupConfigurations.id, configId))
        .limit(1);
      return row?.autoAddFutureBases ?? false;
    },

    fetchIncludedBaseCount: async (configId) => {
      const [row] = await db
        .select({ count: sql<number>`COUNT(*)::int` })
        .from(backupConfigurationBases)
        .where(
          and(
            eq(backupConfigurationBases.backupConfigurationId, configId),
            eq(backupConfigurationBases.isIncluded, true),
          ),
        );
      return row?.count ?? 0;
    },

    listAirtableBases: airtableListBases,

    upsertAtBases: async (
      rows: UpsertAtBasesRow[],
      opts: UpsertAtBasesOptions,
    ) => {
      if (rows.length === 0) return;
      // INSERT new rows with discoveredVia set; on conflict, bump name +
      // lastSeenAt + modifiedAt but PRESERVE discoveredVia (set-list
      // intentionally omits it).
      await db
        .insert(atBases)
        .values(
          rows.map((r) => ({
            spaceId: opts.spaceId,
            atBaseId: r.atBaseId,
            name: r.name,
            discoveredVia: opts.discoveredViaForFreshInserts,
            firstSeenAt: opts.now,
            lastSeenAt: opts.now,
          })),
        )
        .onConflictDoUpdate({
          target: [atBases.spaceId, atBases.atBaseId],
          set: {
            name: sql`excluded.name`,
            lastSeenAt: sql`excluded.last_seen_at`,
          },
          // modifiedAt intentionally not touched here — the engine mirror
          // omits the column. The DB-side `defaultNow()` fires on INSERT
          // (fresh bases); existing rows keep their last modifiedAt.
        });
    },

    resolveTierCap: async (organizationId) => {
      const resolved = await resolveCapabilities(db, organizationId, "airtable");
      return resolved.capabilities.basesPerSpace;
    },

    enableBackupConfigurationBases: async (configId, atBaseIds) => {
      if (atBaseIds.length === 0) return;
      // Resolve atBaseIds (Airtable "appXXX" ids) → at_bases.id (our UUIDs).
      // The FK at backup_configuration_bases.at_base_id points at the
      // internal UUID, NOT the Airtable id (column name is misleading; see
      // schema header comment). atBaseId is unique per Space (and listBases
      // only returns this Org's workspace bases), so the lookup is safe
      // without scoping to spaceId here.
      const internalIds = await db
        .select({ id: atBases.id })
        .from(atBases)
        .where(inArray(atBases.atBaseId, atBaseIds));

      if (internalIds.length === 0) return;
      await db
        .insert(backupConfigurationBases)
        .values(
          internalIds.map((row) => ({
            backupConfigurationId: configId,
            atBaseId: row.id,
            isIncluded: true,
            isAutoDiscovered: true,
          })),
        )
        .onConflictDoUpdate({
          target: [
            backupConfigurationBases.backupConfigurationId,
            backupConfigurationBases.atBaseId,
          ],
          set: {
            isIncluded: true,
            // modifiedAt omitted (column not mirrored on the engine side).
            // V1: existing rows that get re-enabled keep their last
            // modifiedAt; add the column to the mirror when the engine
            // needs to read it.
          },
        });
    },

    insertSpaceEvent: async (spaceId, event: SpaceEventInsert) => {
      await db.insert(spaceEvents).values({
        spaceId,
        kind: event.kind,
        payload: event.payload,
      });
    },

    now: () => new Date(),
    logger: {
      info: (msg, fields) => {
        // eslint-disable-next-line no-console -- structured stderr; no logger lib yet
        console.log(JSON.stringify({ level: "info", msg, ...fields }));
      },
      warn: (msg, fields) => {
        // eslint-disable-next-line no-console -- structured stderr; no logger lib yet
        console.warn(JSON.stringify({ level: "warn", msg, ...fields }));
      },
      error: (msg, fields) => {
        // eslint-disable-next-line no-console -- structured stderr; no logger lib yet
        console.error(JSON.stringify({ level: "error", msg, ...fields }));
      },
    },
  };
}
