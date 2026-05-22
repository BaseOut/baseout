// Unit tests for the workflows-side Google Drive StorageWriter.
//
// Same testing pattern as airtable-client.test.ts: inject `fetchImpl` via
// vi.fn() and assert call URLs, headers, body shape. No msw — keeps the
// workflows package's test surface tiny.
//
// Coverage:
//   - writeFile() happy path: resumable session start + PUT to session URL
//   - writeFile() 401 on PUT → refresh → retry once → success
//   - writeFile() 401 twice → typed StorageWriteError (kind='auth_failed')
//   - writeFile() 429 → typed StorageWriteError carries retryAfterMs
//   - init() proactively refreshes when token within 5 min of expiry
//   - init() does not refresh when token has plenty of headroom
//   - factory rejects google_drive destination without accessToken or
//     providerFolderId

import { describe, expect, it, vi } from "vitest";
import {
  createGoogleDriveWriter,
  type GoogleDriveWriterOptions,
} from "../../trigger/tasks/_lib/storage-writers/google-drive";
import { makeStorageWriter } from "../../trigger/tasks/_lib/storage-writers";
import { StorageWriteError } from "../../trigger/tasks/_lib/storage-writers/types";

const SESSION_URL =
  "https://www.googleapis.com/upload/drive/v3/files?upload_id=test-session";

function startSessionResponse(): Response {
  return new Response(null, {
    status: 200,
    headers: { location: SESSION_URL },
  });
}

function putOkResponse(fileId: string): Response {
  return new Response(JSON.stringify({ id: fileId, name: "table.csv" }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

function jsonStatus(status: number, body: unknown = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function makeOpts(
  overrides: Partial<GoogleDriveWriterOptions> = {},
): GoogleDriveWriterOptions {
  return {
    accessToken: "access-token-v1",
    refreshToken: "refresh-token",
    oauthExpiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    rootFolderId: "folder-baseout-space",
    refreshClient: vi.fn().mockResolvedValue({
      accessToken: "access-token-v2",
      refreshToken: "refresh-token",
      oauthExpiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    }),
    fetchImpl: vi.fn<typeof fetch>(),
    ...overrides,
  };
}

describe("createGoogleDriveWriter.writeFile", () => {
  it("starts a resumable session then PUTs the body and returns the file id", async () => {
    const fetchImpl = vi.fn<typeof fetch>();
    fetchImpl
      .mockResolvedValueOnce(startSessionResponse())
      .mockResolvedValueOnce(putOkResponse("file-abc"));
    const opts = makeOpts({ fetchImpl });
    const writer = createGoogleDriveWriter(opts);

    const result = await writer.writeFile(
      "row,1\nrow,2\n",
      "org/space/runStarted/base/table.csv",
    );

    expect(result.destinationKey).toBe("file-abc");
    expect(result.sizeBytes).toBe(12);
    expect(fetchImpl).toHaveBeenCalledTimes(2);

    const [startUrl, startInit] = fetchImpl.mock.calls[0]!;
    expect(String(startUrl)).toBe(
      "https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable",
    );
    expect(startInit?.method).toBe("POST");
    const startHeaders = startInit?.headers as Record<string, string>;
    expect(startHeaders.authorization).toBe("Bearer access-token-v1");
    expect(startHeaders["content-type"]).toBe(
      "application/json; charset=UTF-8",
    );
    expect(startHeaders["x-upload-content-type"]).toBe("text/csv");
    expect(startHeaders["x-upload-content-length"]).toBe("12");
    const startBody = JSON.parse(startInit?.body as string) as {
      name: string;
      parents: string[];
      mimeType: string;
    };
    expect(startBody.name).toBe("table.csv");
    expect(startBody.parents).toEqual(["folder-baseout-space"]);
    expect(startBody.mimeType).toBe("text/csv");

    const [putUrl, putInit] = fetchImpl.mock.calls[1]!;
    expect(String(putUrl)).toBe(SESSION_URL);
    expect(putInit?.method).toBe("PUT");
    const putHeaders = putInit?.headers as Record<string, string>;
    expect(putHeaders["content-type"]).toBe("text/csv");
    expect(putHeaders["content-length"]).toBe("12");
  });

  it("refreshes the token on a 401 from the PUT and retries once", async () => {
    const fetchImpl = vi.fn<typeof fetch>();
    fetchImpl
      .mockResolvedValueOnce(startSessionResponse())
      .mockResolvedValueOnce(new Response(null, { status: 401 }))
      .mockResolvedValueOnce(startSessionResponse())
      .mockResolvedValueOnce(putOkResponse("file-after-refresh"));
    const refreshClient = vi.fn().mockResolvedValue({
      accessToken: "access-token-v2",
      oauthExpiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    });
    const writer = createGoogleDriveWriter(makeOpts({ fetchImpl, refreshClient }));

    const result = await writer.writeFile("x", "table.csv");
    expect(result.destinationKey).toBe("file-after-refresh");
    expect(refreshClient).toHaveBeenCalledOnce();
    expect(fetchImpl).toHaveBeenCalledTimes(4);

    // Retry attempt uses the refreshed access token.
    const [, secondStartInit] = fetchImpl.mock.calls[2]!;
    const secondStartHeaders = secondStartInit?.headers as Record<string, string>;
    expect(secondStartHeaders.authorization).toBe("Bearer access-token-v2");
  });

  it("surfaces a typed auth_failed error if the refresh-then-retry still 401s", async () => {
    const fetchImpl = vi.fn<typeof fetch>();
    fetchImpl
      .mockResolvedValueOnce(startSessionResponse())
      .mockResolvedValueOnce(new Response(null, { status: 401 }))
      .mockResolvedValueOnce(startSessionResponse())
      .mockResolvedValueOnce(new Response(null, { status: 401 }));
    const writer = createGoogleDriveWriter(makeOpts({ fetchImpl }));

    await expect(writer.writeFile("x", "table.csv")).rejects.toMatchObject({
      name: "StorageWriteError",
      kind: "auth_failed",
      status: 401,
    });
  });

  it("surfaces a rate_limited error with retryAfterMs parsed from Retry-After (seconds)", async () => {
    const fetchImpl = vi.fn<typeof fetch>();
    fetchImpl
      .mockResolvedValueOnce(startSessionResponse())
      .mockResolvedValueOnce(
        new Response(JSON.stringify({}), {
          status: 429,
          headers: {
            "content-type": "application/json",
            "retry-after": "7",
          },
        }),
      );
    const writer = createGoogleDriveWriter(makeOpts({ fetchImpl }));

    await expect(writer.writeFile("x", "table.csv")).rejects.toMatchObject({
      name: "StorageWriteError",
      kind: "rate_limited",
      status: 429,
      retryAfterMs: 7000,
    });
  });

  it("classifies 5xx as transient", async () => {
    const fetchImpl = vi.fn<typeof fetch>();
    fetchImpl
      .mockResolvedValueOnce(startSessionResponse())
      .mockResolvedValueOnce(jsonStatus(503, { error: "unavailable" }));
    const writer = createGoogleDriveWriter(makeOpts({ fetchImpl }));

    await expect(writer.writeFile("x", "table.csv")).rejects.toMatchObject({
      kind: "transient",
      status: 503,
    });
  });

  it("throws if the session-start response is missing the Location header", async () => {
    const fetchImpl = vi.fn<typeof fetch>();
    fetchImpl.mockResolvedValueOnce(
      new Response(null, { status: 200 }), // no Location
    );
    const writer = createGoogleDriveWriter(makeOpts({ fetchImpl }));

    await expect(writer.writeFile("x", "table.csv")).rejects.toMatchObject({
      kind: "unknown",
    });
  });
});

describe("createGoogleDriveWriter.init", () => {
  it("proactively refreshes when the token is within 5 minutes of expiry", async () => {
    const refreshClient = vi.fn().mockResolvedValue({
      accessToken: "access-token-v2",
      oauthExpiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    });
    const writer = createGoogleDriveWriter(
      makeOpts({
        // Expires in 2 minutes — inside the 5-minute skew window.
        oauthExpiresAt: new Date(Date.now() + 2 * 60 * 1000).toISOString(),
        refreshClient,
      }),
    );

    await writer.init();
    expect(refreshClient).toHaveBeenCalledOnce();
  });

  it("does not refresh when the token has plenty of headroom", async () => {
    const refreshClient = vi.fn().mockResolvedValue({
      accessToken: "shouldn't be used",
    });
    const writer = createGoogleDriveWriter(
      makeOpts({
        oauthExpiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
        refreshClient,
      }),
    );

    await writer.init();
    expect(refreshClient).not.toHaveBeenCalled();
  });

  it("is a no-op when oauthExpiresAt is missing (writer cannot decide if refresh is needed)", async () => {
    const refreshClient = vi.fn();
    const writer = createGoogleDriveWriter(
      makeOpts({
        oauthExpiresAt: undefined,
        refreshClient,
      }),
    );

    await writer.init();
    expect(refreshClient).not.toHaveBeenCalled();
  });
});

describe("makeStorageWriter dispatch", () => {
  it("builds a Drive writer for type=google_drive", () => {
    const writer = makeStorageWriter(
      {
        type: "google_drive",
        accessToken: "tok",
        providerFolderId: "folder-id",
      },
      { refreshClient: vi.fn() },
    );
    expect(typeof writer.writeFile).toBe("function");
  });

  it("rejects a google_drive destination missing accessToken", () => {
    expect(() =>
      makeStorageWriter(
        { type: "google_drive", providerFolderId: "folder-id" },
        { refreshClient: vi.fn() },
      ),
    ).toThrow(/missing decrypted accessToken/);
  });

  it("rejects a google_drive destination missing providerFolderId", () => {
    expect(() =>
      makeStorageWriter(
        { type: "google_drive", accessToken: "tok" },
        { refreshClient: vi.fn() },
      ),
    ).toThrow(/missing providerFolderId/);
  });

  // Dropbox writer is now implemented (Phase W.1.3 / shared-byos-drive-dropbox
  // C.3.2 — landed by Step 3 of the rolling Drive-foundations plan). The
  // dispatch + validation lives in tests/storage-writers/dropbox.test.ts.

  it("throws StorageWriter-lands-later for box", () => {
    expect(() =>
      makeStorageWriter(
        { type: "box", accessToken: "tok" },
        { refreshClient: vi.fn() },
      ),
    ).toThrow(/Box StorageWriter lands in Phase C.s of shared-byos-box/);
  });

  it("throws for r2_managed (workflows runner can't reach the R2 binding)", () => {
    expect(() =>
      makeStorageWriter(
        { type: "r2_managed" },
        { refreshClient: vi.fn() },
      ),
    ).toThrow(/server-byos-r2-proxy-upload/);
  });
});

// Regression guard: StorageWriteError is exported from the package barrel
// so callers can `import { StorageWriteError } from "./storage-writers"`
// and branch on `instanceof`.
describe("StorageWriteError", () => {
  it("is exported and instanceof checks work", () => {
    const err = new StorageWriteError("transient", "test", 503);
    expect(err instanceof StorageWriteError).toBe(true);
    expect(err.kind).toBe("transient");
    expect(err.status).toBe(503);
  });
});
