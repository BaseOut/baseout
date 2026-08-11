import { describe, it, expect, vi } from "vitest";
import { fetchBaseMetadata } from "../trigger/tasks/_lib/base-metadata";

const TOKEN = "pt-abc";
const BASE = "appXYZ";

describe("fetchBaseMetadata", () => {
  it("GETs the metadata endpoint with all four include params + auth, returns body verbatim", async () => {
    const body = { workspaceId: "wsp1", individualCollaborators: { baseCollaborators: [] }, unknownFutureBlock: 1 };
    const fetchImpl = vi.fn<typeof fetch>(async () => new Response(JSON.stringify(body), { status: 200 }));
    const res = await fetchBaseMetadata({ baseId: BASE, accessToken: TOKEN, fetchImpl });

    expect(res.ok).toBe(true);
    if (res.ok) expect(res.metadata).toEqual(body); // verbatim, incl. unknown blocks
    const url = fetchImpl.mock.calls[0]![0] as string;
    expect(url).toContain(`/v0/meta/bases/${BASE}`);
    expect(url).toContain("include=collaborators");
    expect(url).toContain("include=inviteLinks");
    expect(url).toContain("include=interfaces");
    expect(url).toContain("include=packages");
    const init = fetchImpl.mock.calls[0]![1] as RequestInit;
    expect((init.headers as Record<string, string>).authorization).toBe(`Bearer ${TOKEN}`);
  });

  it("non-200 → typed skip reason, no throw", async () => {
    const fetchImpl = vi.fn(async () => new Response("forbidden", { status: 403 }));
    const res = await fetchBaseMetadata({ baseId: BASE, accessToken: TOKEN, fetchImpl: fetchImpl as never });
    expect(res).toEqual({ ok: false, reason: "http_403" });
  });

  it("network error → typed skip reason, no throw", async () => {
    const fetchImpl = vi.fn(async () => {
      throw new Error("boom");
    });
    const res = await fetchBaseMetadata({ baseId: BASE, accessToken: TOKEN, fetchImpl: fetchImpl as never });
    expect(res).toEqual({ ok: false, reason: "transport" });
  });

  it("invalid JSON → typed skip reason", async () => {
    const fetchImpl = vi.fn(async () => new Response("not json", { status: 200 }));
    const res = await fetchBaseMetadata({ baseId: BASE, accessToken: TOKEN, fetchImpl: fetchImpl as never });
    expect(res).toEqual({ ok: false, reason: "parse" });
  });
});
