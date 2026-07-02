// Trigger.dev wrapper for runRelationshipInference (workflows-relationship-inference).
//
// The pure orchestration lives in ./relationship-inference.ts; this wires the
// engine `/relationships/sync` POST and is what the Trigger.dev runner picks up.
// Runs on Node (process.env is the config source). The synced-view heuristic
// itself runs engine-side; this task only triggers it per base.

import { task } from "@trigger.dev/sdk";
import {
  runRelationshipInference,
  type RelationshipInferenceInput,
  type RelationshipInferenceResult,
  type PerBaseSyncResult,
} from "./relationship-inference";

export type RelationshipInferencePayload = RelationshipInferenceInput;

function trimSlash(s: string): string {
  return s.endsWith("/") ? s.slice(0, -1) : s;
}

const ZERO: PerBaseSyncResult = { inserted: 0, refreshed: 0, skipped: 0, proposed: 0 };

// Engine relationships-sync POST. 409 (space DB not provisioned) / 501 (not
// managed_pg) degrade to a no-op so a not-ready Space doesn't fail the run;
// other non-2xx throws so per-base isolation records it.
async function syncBase(
  engineUrl: string,
  internalToken: string,
  spaceId: string,
  runId: string,
  baseId: string,
): Promise<PerBaseSyncResult> {
  const url = `${trimSlash(engineUrl)}/api/internal/spaces/${encodeURIComponent(spaceId)}/relationships/sync`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "x-internal-token": internalToken, "content-type": "application/json" },
    body: JSON.stringify({ baseId, runId }),
  });
  if (res.status === 409 || res.status === 501) return ZERO;
  if (!res.ok) throw new Error(`relationships-sync ${res.status}`);
  const body = (await res.json()) as Partial<PerBaseSyncResult>;
  return {
    inserted: body.inserted ?? 0,
    refreshed: body.refreshed ?? 0,
    skipped: body.skipped ?? 0,
    proposed: body.proposed ?? 0,
  };
}

export const relationshipInferenceTask = task({
  id: "relationship-inference",
  maxDuration: 300,
  run: async (payload: RelationshipInferencePayload): Promise<RelationshipInferenceResult> => {
    const engineUrl = process.env.BACKUP_ENGINE_URL;
    const internalToken = process.env.INTERNAL_TOKEN;
    if (!engineUrl) throw new Error("BACKUP_ENGINE_URL is not set in the Trigger.dev env");
    if (!internalToken) throw new Error("INTERNAL_TOKEN is not set in the Trigger.dev env");

    return runRelationshipInference(payload, {
      syncBase: (baseId) =>
        syncBase(engineUrl, internalToken, payload.spaceId, payload.runId, baseId),
    });
  },
});
