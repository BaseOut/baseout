// defaultFetchStorageCreds — URL shape under multi-destination
// (shared-multi-destinations).
//
// A Space holds one storage_destinations row per provider type, so the creds
// fetch MUST pin the engine read to the run's enqueue-time storageType via
// ?type= — on the initial read AND the ?refresh=1 re-read — or a mid-run
// primary swap could flip which credentials come back.

import { describe, expect, it, vi } from "vitest";
import { defaultFetchStorageCreds } from "../trigger/tasks/backup-base";

const SPACE_ID = "11111111-1111-1111-1111-111111111111";
const ENGINE = "http://engine.test";
const EXPIRES = new Date(Date.now() + 60 * 60_000).toISOString();

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

describe("defaultFetchStorageCreds", () => {
  it("pins the initial read to ?type=<storageType>", async () => {
    const fetchFn = vi.fn(async () =>
      jsonResponse({
        type: "google_drive",
        accessToken: "at-1",
        expiresAt: EXPIRES,
        providerFolderId: "folder-1",
      }),
    ) as unknown as typeof fetch;

    const creds = await defaultFetchStorageCreds(
      fetchFn,
      ENGINE,
      "internal-token",
      SPACE_ID,
      "google_drive",
    );

    expect(creds).toMatchObject({ kind: "google_drive", accessToken: "at-1" });
    expect(fetchFn).toHaveBeenCalledTimes(1);
    expect(vi.mocked(fetchFn).mock.calls[0]?.[0]).toBe(
      `${ENGINE}/api/internal/spaces/${SPACE_ID}/storage-destination?type=google_drive`,
    );
  });

  it("keeps ?type= on the ?refresh=1 re-read", async () => {
    const fetchFn = vi.fn(async () =>
      jsonResponse({
        type: "box",
        accessToken: "at-1",
        expiresAt: EXPIRES,
        providerFolderId: "folder-1",
      }),
    ) as unknown as typeof fetch;

    const creds = await defaultFetchStorageCreds(
      fetchFn,
      ENGINE,
      "internal-token",
      SPACE_ID,
      "box",
    );
    if (!creds || !("refresh" in creds) || !creds.refresh) {
      throw new Error("expected refreshable creds");
    }
    await creds.refresh();

    expect(fetchFn).toHaveBeenCalledTimes(2);
    const refreshUrl = String(vi.mocked(fetchFn).mock.calls[1]?.[0]);
    expect(refreshUrl).toBe(
      `${ENGINE}/api/internal/spaces/${SPACE_ID}/storage-destination?refresh=1&type=box`,
    );
  });
});
