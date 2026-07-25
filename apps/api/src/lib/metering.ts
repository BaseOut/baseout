// Per-request usage metering via Workers Analytics Engine (api-usage-tracking).
// One writeDataPoint per request — token/org/space/platform/route-template/method/
// status/surface + count + duration. Failure-isolated: a metering error MUST NOT
// affect the response (the whole call is wrapped and swallowed). No-op when the
// dataset binding is absent (local dev / tests).

import { log } from "./log";
import type { Env } from "../env";

export type ApiSurface = "rest" | "inbound" | "mcp";

export interface UsagePoint {
  tokenId: string | null; // null for unauthenticated (401) requests
  orgId: string | null;
  spaceId: string | null;
  platform: string | null;
  routeTemplate: string; // template, NOT the concrete URL
  method: string;
  status: number;
  surface: ApiSurface;
  durationMs: number;
}

export function meterRequest(env: Env, p: UsagePoint): void {
  if (!env.API_USAGE) return;
  try {
    env.API_USAGE.writeDataPoint({
      // AE index (sampling key) — token id groups a caller's traffic.
      indexes: [p.tokenId ?? ""],
      blobs: [
        p.tokenId ?? "",
        p.orgId ?? "",
        p.spaceId ?? "",
        p.platform ?? "",
        p.routeTemplate,
        p.method,
        String(p.status),
        p.surface,
      ],
      doubles: [1, p.durationMs],
    });
  } catch (err) {
    log.error("api.metering.write_failed", { err: err instanceof Error ? err.message : String(err) });
  }
}
