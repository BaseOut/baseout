// Pure-function orchestration for workspace base rediscovery.
//
// Workspace rediscovery is the layer that picks up Airtable bases added to
// a workspace AFTER OAuth. The OAuth callback writes the initial at_bases
// rows; everything else added to the workspace later was previously
// invisible to Baseout. This module is the single writer for rediscovery
// (the alarm path in SpaceDO and the manual rescan route both route
// through it) so the auto-add + tier-cap policy stays consistent.
//
// Schema drift INSIDE already-selected bases is out of scope here — the
// per-run backup task (apps/server/trigger/tasks/backup-base.ts) already
// re-fetches `getBaseSchema()` per base on every run. Webhook-driven
// real-time drift is owned by openspec/changes/baseout-backup-instant-webhook
// and openspec/changes/baseout-backup-dynamic-mode.
//
// Every side-effect is a deps function so this module is unit-testable
// without Postgres / Airtable. Production wiring lives in run-deps.ts
// (Phase 3 / Phase 4 of baseout-backup-workspace-rediscovery).

import type { AirtableBaseSummary } from "../airtable/client";

export type RediscoveryTrigger = "alarm" | "manual";

/** Airtable base ID, e.g. "appXXXXXXXX". */
export type AtBaseId = string;

export interface RediscoveryInput {
  spaceId: string;
  configId: string;
  organizationId: string;
  triggeredBy: RediscoveryTrigger;
}

export interface UpsertAtBasesRow {
  atBaseId: AtBaseId;
  name: string;
}

export interface UpsertAtBasesOptions {
  spaceId: string;
  /**
   * `discoveredVia` to set on NEWLY-inserted rows. On conflict the column
   * is left alone so the original discovery source is preserved.
   */
  discoveredViaForFreshInserts:
    | "rediscovery_scheduled"
    | "rediscovery_manual";
  now: Date;
}

export interface SpaceEventInsert {
  kind: "bases_discovered";
  payload: {
    discovered: AtBaseId[];
    autoAdded: AtBaseId[];
    blockedByTier: AtBaseId[];
    tierCap: number | null;
  };
}

export interface WorkspaceRediscoveryDeps {
  /** Set of Airtable base IDs (the "appXXX" form) already known for this Space. */
  fetchKnownAtBaseIds: (spaceId: string) => Promise<Set<AtBaseId>>;
  /** Per-config `auto_add_future_bases` toggle. */
  fetchAutoAddToggle: (configId: string) => Promise<boolean>;
  /** Count of `is_included = true` rows for this config — needed to compute the remaining cap slots. */
  fetchIncludedBaseCount: (configId: string) => Promise<number>;
  /** Calls Airtable Meta API `GET /v0/meta/bases` and returns the workspace listing. */
  listAirtableBases: () => Promise<AirtableBaseSummary[]>;
  /**
   * Upsert every listed base. Inserts set `discoveredVia` from `opts`;
   * conflicts update `name`, `last_seen_at`, `modified_at` only.
   */
  upsertAtBases: (
    rows: UpsertAtBasesRow[],
    opts: UpsertAtBasesOptions,
  ) => Promise<void>;
  /** Returns the tier `basesPerSpace` cap (null = unlimited). */
  resolveTierCap: (organizationId: string) => Promise<number | null>;
  /**
   * Insert `is_included = true` + `is_auto_discovered = true` rows for the
   * given Airtable base IDs. Must resolve `at_base_id` → `at_bases.id`
   * internally so callers don't have to round-trip.
   */
  enableBackupConfigurationBases: (
    configId: string,
    atBaseIds: AtBaseId[],
  ) => Promise<void>;
  /** Insert one `space_events` row. */
  insertSpaceEvent: (
    spaceId: string,
    event: SpaceEventInsert,
  ) => Promise<void>;
  now: () => Date;
  logger: {
    info: (msg: string, fields?: Record<string, unknown>) => void;
    warn: (msg: string, fields?: Record<string, unknown>) => void;
    error: (msg: string, fields?: Record<string, unknown>) => void;
  };
}

export interface RediscoveryResult {
  discovered: number;
  autoAdded: number;
  blockedByTier: number;
}

function discoveredViaFor(
  triggeredBy: RediscoveryTrigger,
): UpsertAtBasesOptions["discoveredViaForFreshInserts"] {
  return triggeredBy === "alarm"
    ? "rediscovery_scheduled"
    : "rediscovery_manual";
}

export async function runWorkspaceRediscovery(
  input: RediscoveryInput,
  deps: WorkspaceRediscoveryDeps,
): Promise<RediscoveryResult> {
  const listed = await deps.listAirtableBases();
  const known = await deps.fetchKnownAtBaseIds(input.spaceId);

  // Upsert ALL listed bases so `last_seen_at` bumps for known + new alike.
  // This matters even with no fresh bases — it's how the system records
  // that a known base is still present in the workspace.
  await deps.upsertAtBases(
    listed.map((b) => ({ atBaseId: b.id, name: b.name })),
    {
      spaceId: input.spaceId,
      discoveredViaForFreshInserts: discoveredViaFor(input.triggeredBy),
      now: deps.now(),
    },
  );

  const fresh = listed.filter((b) => !known.has(b.id));
  if (fresh.length === 0) {
    return { discovered: 0, autoAdded: 0, blockedByTier: 0 };
  }

  const freshIds = fresh.map((b) => b.id);
  const autoAddOn = await deps.fetchAutoAddToggle(input.configId);
  const cap = await deps.resolveTierCap(input.organizationId);

  if (!autoAddOn) {
    // Discovery-only path. We still record the event so the user sees
    // "3 bases discovered" in the inline banner; tierCap rides along so
    // the UI can show "Your tier allows N — upgrade for more" without a
    // second query.
    await deps.insertSpaceEvent(input.spaceId, {
      kind: "bases_discovered",
      payload: {
        discovered: freshIds,
        autoAdded: [],
        blockedByTier: [],
        tierCap: cap,
      },
    });
    return {
      discovered: fresh.length,
      autoAdded: 0,
      blockedByTier: 0,
    };
  }

  const includedNow = await deps.fetchIncludedBaseCount(input.configId);
  const allowed =
    cap === null ? Number.POSITIVE_INFINITY : Math.max(0, cap - includedNow);

  const willAutoAdd = freshIds.slice(0, allowed);
  const blocked = freshIds.slice(allowed);

  if (willAutoAdd.length > 0) {
    await deps.enableBackupConfigurationBases(input.configId, willAutoAdd);
  }

  await deps.insertSpaceEvent(input.spaceId, {
    kind: "bases_discovered",
    payload: {
      discovered: freshIds,
      autoAdded: willAutoAdd,
      blockedByTier: blocked,
      tierCap: cap,
    },
  });

  return {
    discovered: fresh.length,
    autoAdded: willAutoAdd.length,
    blockedByTier: blocked.length,
  };
}
