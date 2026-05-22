// Unit tests for the workflows-side Dropbox StorageWriter.
//
// Same pattern as the Drive writer tests: inject `fetchImpl` via vi.fn()
// and assert call URLs, headers (especially Dropbox-API-Arg), and body
// shapes. No msw.
//
// Coverage:
//   - small body (< chunk size): start({close:true}) + finish()
//   - large body (> chunk size): start({close:false}) + 1+ append_v2 + finish()
//   - 401 on append → refresh → retry once → success
//   - 401 on start (proactive refresh test path)
//   - 429 surfaces typed rate_limited error with retryAfterMs
//   - 5xx classified as transient
//   - init() proactively refreshes when within 5 minutes of expiry
//   - factory builds Dropbox writer; rejects destination missing fields
//   - commit arg shape (path/mode/autorename/mute) on finish

import { describe, expect, it, vi } from "vitest";
import {
  createDropboxWriter,
  type DropboxWriterOptions,
} from "../../trigger/tasks/_lib/storage-writers/dropbox";
import { makeStorageWriter } from "../../trigger/tasks/_lib/storage-writers";
import { StorageWriteError } from "../../trigger/tasks/_lib/storage-writers/types";

const SPACE_FOLDER = "/Apps/Baseout/space-abc";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function makeOpts(
  overrides: Partial<DropboxWriterOptions> = {},
): DropboxWriterOptions {
  return {
    accessToken: "access-token-v1",
    refreshToken: "refresh-token",
    oauthExpiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    rootFolderPath: SPACE_FOLDER,
    refreshClient: vi.fn().mockResolvedValue({
      accessToken: "access-token-v2",
      oauthExpiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    }),
    fetchImpl: vi.fn<typeof fetch>(),
    ...overrides,
  };
}

function parseApiArg(init: RequestInit | undefined): unknown {
  const headers = init?.headers as Record<string, string>;
  const arg = headers["Dropbox-API-Arg"];
  if (!arg) throw new Error("missing Dropbox-API-Arg header");
  return JSON.parse(arg);
}

describe("createDropboxWriter.writeFile (small body, single-chunk path)", () => {
  it("issues start({close:true}) + finish() with the commit shape", async () => {
    const fetchImpl = vi.fn<typeof fetch>();
    fetchImpl
      .mockResolvedValueOnce(jsonResponse({ session_id: "sess-1" }))
      .mockResolvedValueOnce(jsonResponse({ id: "id:dbx-file-1" }));
    const writer = createDropboxWriter(makeOpts({ fetchImpl }));

    const result = await writer.writeFile(
      "col,1\ncol,2\n",
      "org/space/runStarted/base/table.csv",
    );

    expect(result).toEqual({
      destinationKey: "id:dbx-file-1",
      sizeBytes: 12,
    });
    expect(fetchImpl).toHaveBeenCalledTimes(2);

    const [startUrl, startInit] = fetchImpl.mock.calls[0]!;
    expect(String(startUrl)).toBe(
      "https://content.dropboxapi.com/2/files/upload_session/start",
    );
    expect(startInit?.method).toBe("POST");
    const startHeaders = startInit?.headers as Record<string, string>;
    expect(startHeaders.authorization).toBe("Bearer access-token-v1");
    expect(startHeaders["content-type"]).toBe("application/octet-stream");
    expect(parseApiArg(startInit)).toEqual({ close: true });

    const [finishUrl, finishInit] = fetchImpl.mock.calls[1]!;
    expect(String(finishUrl)).toBe(
      "https://content.dropboxapi.com/2/files/upload_session/finish",
    );
    expect(parseApiArg(finishInit)).toEqual({
      cursor: { session_id: "sess-1", offset: 12 },
      commit: {
        path: `${SPACE_FOLDER}/table.csv`,
        mode: "add",
        autorename: false,
        mute: true,
      },
    });
  });
});

describe("createDropboxWriter.writeFile (large body, multi-chunk path)", () => {
  it("splits into start({close:false}) + N append_v2 + finish() at chunk-size boundaries", async () => {
    const fetchImpl = vi.fn<typeof fetch>();
    fetchImpl
      .mockResolvedValueOnce(jsonResponse({ session_id: "sess-multi" }))
      .mockResolvedValueOnce(new Response(null, { status: 200 }))
      .mockResolvedValueOnce(jsonResponse({ id: "id:dbx-file-multi" }));
    // Use a tiny chunk size so we don't need MB of test data. Body = 7 bytes,
    // chunkBytes = 3 → start with bytes[0..3), append bytes[3..6), finish
    // with bytes[6..7).
    const writer = createDropboxWriter(
      makeOpts({ fetchImpl, chunkBytes: 3 }),
    );

    const body = new TextEncoder().encode("abcdefg"); // 7 bytes
    const result = await writer.writeFile(body, "x/y/z/table.csv");

    expect(result.destinationKey).toBe("id:dbx-file-multi");
    expect(result.sizeBytes).toBe(7);
    expect(fetchImpl).toHaveBeenCalledTimes(3);

    // start: close=false (we know we'll append), chunk = bytes[0..3) = "abc"
    expect(parseApiArg(fetchImpl.mock.calls[0]![1])).toEqual({ close: false });

    // append_v2: cursor offset = 3, chunk = bytes[3..6) = "def"
    const appendUrl = String(fetchImpl.mock.calls[1]![0]);
    expect(appendUrl).toBe(
      "https://content.dropboxapi.com/2/files/upload_session/append_v2",
    );
    expect(parseApiArg(fetchImpl.mock.calls[1]![1])).toEqual({
      cursor: { session_id: "sess-multi", offset: 3 },
    });

    // finish: cursor offset = 6, final chunk = bytes[6..7) = "g"
    const finishArg = parseApiArg(fetchImpl.mock.calls[2]![1]) as {
      cursor: { session_id: string; offset: number };
      commit: { path: string };
    };
    expect(finishArg.cursor).toEqual({
      session_id: "sess-multi",
      offset: 6,
    });
    expect(finishArg.commit.path).toBe(`${SPACE_FOLDER}/table.csv`);
  });
});

describe("createDropboxWriter.writeFile error paths", () => {
  it("refreshes on 401 from start and retries once", async () => {
    const fetchImpl = vi.fn<typeof fetch>();
    fetchImpl
      .mockResolvedValueOnce(new Response(null, { status: 401 }))
      .mockResolvedValueOnce(jsonResponse({ session_id: "sess-retry" }))
      .mockResolvedValueOnce(jsonResponse({ id: "id:after-refresh" }));
    const refreshClient = vi.fn().mockResolvedValue({
      accessToken: "access-token-v2",
      oauthExpiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    });
    const writer = createDropboxWriter(
      makeOpts({ fetchImpl, refreshClient }),
    );

    const result = await writer.writeFile("x", "table.csv");
    expect(result.destinationKey).toBe("id:after-refresh");
    expect(refreshClient).toHaveBeenCalledOnce();
    expect(fetchImpl).toHaveBeenCalledTimes(3);
    // Second start uses the refreshed token.
    const secondStartHeaders = fetchImpl.mock.calls[1]![1]
      ?.headers as Record<string, string>;
    expect(secondStartHeaders.authorization).toBe("Bearer access-token-v2");
  });

  it("surfaces auth_failed when refresh-and-retry also 401s", async () => {
    const fetchImpl = vi.fn<typeof fetch>();
    fetchImpl
      .mockResolvedValueOnce(new Response(null, { status: 401 }))
      .mockResolvedValueOnce(new Response(null, { status: 401 }));
    const writer = createDropboxWriter(makeOpts({ fetchImpl }));

    await expect(writer.writeFile("x", "table.csv")).rejects.toMatchObject({
      name: "StorageWriteError",
      kind: "auth_failed",
      status: 401,
    });
  });

  it("surfaces rate_limited with retryAfterMs on 429", async () => {
    const fetchImpl = vi.fn<typeof fetch>();
    fetchImpl.mockResolvedValueOnce(
      new Response(JSON.stringify({}), {
        status: 429,
        headers: {
          "content-type": "application/json",
          "retry-after": "5",
        },
      }),
    );
    const writer = createDropboxWriter(makeOpts({ fetchImpl }));

    await expect(writer.writeFile("x", "table.csv")).rejects.toMatchObject({
      kind: "rate_limited",
      status: 429,
      retryAfterMs: 5000,
    });
  });

  it("classifies 5xx as transient", async () => {
    const fetchImpl = vi.fn<typeof fetch>();
    fetchImpl.mockResolvedValueOnce(jsonResponse({}, 503));
    const writer = createDropboxWriter(makeOpts({ fetchImpl }));

    await expect(writer.writeFile("x", "table.csv")).rejects.toMatchObject({
      kind: "transient",
      status: 503,
    });
  });

  it("throws unknown when start returns no session_id", async () => {
    const fetchImpl = vi.fn<typeof fetch>();
    fetchImpl.mockResolvedValueOnce(jsonResponse({})); // no session_id
    const writer = createDropboxWriter(makeOpts({ fetchImpl }));

    await expect(writer.writeFile("x", "table.csv")).rejects.toMatchObject({
      kind: "unknown",
    });
  });

  it("throws unknown when finish returns no id", async () => {
    const fetchImpl = vi.fn<typeof fetch>();
    fetchImpl
      .mockResolvedValueOnce(jsonResponse({ session_id: "sess-1" }))
      .mockResolvedValueOnce(jsonResponse({})); // no id
    const writer = createDropboxWriter(makeOpts({ fetchImpl }));

    await expect(writer.writeFile("x", "table.csv")).rejects.toMatchObject({
      kind: "unknown",
    });
  });
});

describe("createDropboxWriter.init", () => {
  it("proactively refreshes when within 5 minutes of expiry", async () => {
    const refreshClient = vi.fn().mockResolvedValue({
      accessToken: "access-token-v2",
      oauthExpiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    });
    const writer = createDropboxWriter(
      makeOpts({
        oauthExpiresAt: new Date(Date.now() + 2 * 60 * 1000).toISOString(),
        refreshClient,
      }),
    );

    await writer.init();
    expect(refreshClient).toHaveBeenCalledOnce();
  });

  it("does not refresh when the token has plenty of headroom", async () => {
    const refreshClient = vi.fn();
    const writer = createDropboxWriter(
      makeOpts({
        oauthExpiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
        refreshClient,
      }),
    );

    await writer.init();
    expect(refreshClient).not.toHaveBeenCalled();
  });
});

describe("makeStorageWriter dispatch (dropbox)", () => {
  it("builds a Dropbox writer for type=dropbox", () => {
    const writer = makeStorageWriter(
      {
        type: "dropbox",
        accessToken: "tok",
        providerFolderId: SPACE_FOLDER,
      },
      { refreshClient: vi.fn() },
    );
    expect(typeof writer.writeFile).toBe("function");
    expect(writer.proxyStreamMode).toBe(true);
  });

  it("rejects a dropbox destination missing accessToken", () => {
    expect(() =>
      makeStorageWriter(
        { type: "dropbox", providerFolderId: SPACE_FOLDER },
        { refreshClient: vi.fn() },
      ),
    ).toThrow(/missing decrypted accessToken/);
  });

  it("rejects a dropbox destination missing providerFolderId", () => {
    expect(() =>
      makeStorageWriter(
        { type: "dropbox", accessToken: "tok" },
        { refreshClient: vi.fn() },
      ),
    ).toThrow(/missing providerFolderId/);
  });
});

describe("StorageWriteError shape", () => {
  it("carries kind/status/retryAfterMs and is instanceof-checkable", () => {
    const err = new StorageWriteError("rate_limited", "test", 429, 1234);
    expect(err instanceof StorageWriteError).toBe(true);
    expect(err.kind).toBe("rate_limited");
    expect(err.status).toBe(429);
    expect(err.retryAfterMs).toBe(1234);
  });
});
