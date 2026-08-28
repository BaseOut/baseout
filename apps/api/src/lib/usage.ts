// Month-to-date API-call usage from the Analytics Engine dataset
// (api-productionization D3). Reads back what metering.ts writes (blob2 =
// orgId, double1 = count) through AE's SQL-over-HTTP API. The credentials
// (`AE_ACCOUNT_ID` + `AE_API_TOKEN`) are OPTIONAL — unconfigured or failing
// reads return null and the usage surface reports usageAvailable: false, the
// same failure-isolated posture the metering writer has. Period = the UTC
// calendar month (documented; billing anchors are a D5 follow-up).

import type { Env } from "../env";

const DATASET = "baseout_api_requests";
const TIMEOUT_MS = 10_000;

/** First instant of the current UTC calendar month. */
export function monthStartUtc(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

/** The AE SQL statement — `_sample_interval` weighting corrects for sampling. */
export function usageQuery(orgId: string, since: Date): string {
  const ts = since.toISOString().slice(0, 19).replace("T", " ");
  const org = orgId.replace(/'/g, "''");
  return `SELECT sum(_sample_interval * double1) AS calls FROM ${DATASET} WHERE blob2 = '${org}' AND timestamp >= toDateTime('${ts}')`;
}

/** Month-to-date call count for the org, or null (unconfigured / read failed). */
export async function readMonthlyUsage(env: Env, orgId: string, now: Date): Promise<number | null> {
  if (!env.AE_ACCOUNT_ID || !env.AE_API_TOKEN) return null;
  try {
    const timeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), TIMEOUT_MS));
    const res = (await Promise.race([
      fetch(`https://api.cloudflare.com/client/v4/accounts/${env.AE_ACCOUNT_ID}/analytics_engine/sql`, {
        method: "POST",
        headers: { authorization: `Bearer ${env.AE_API_TOKEN}` },
        body: usageQuery(orgId, monthStartUtc(now)),
      }),
      timeout,
    ])) as Response | null;
    if (!res || !res.ok) return null;
    const body = (await res.json()) as { data?: { calls?: number | string | null }[] };
    const calls = body.data?.[0]?.calls;
    if (calls == null) return 0; // no rows this month = zero usage
    const n = Number(calls);
    return Number.isFinite(n) ? Math.round(n) : null;
  } catch {
    return null;
  }
}
