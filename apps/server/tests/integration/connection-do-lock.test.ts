// ConnectionDO lock semantics — Phase 6.1 of the Backups MVP plan.
//
// Locks are scoped to a Connection (Airtable account binding). Two backup
// tasks running across two Spaces that share one Connection must serialize
// at the DO so we don't blow Airtable's per-account quota. The DO is the
// rate-limit gateway per openspec/changes/baseout-backup/design.md.
//
// Each test calls a fresh DO id (random crypto.randomUUID name) so in-memory
// lock state from one test never leaks into the next.

import { env } from "cloudflare:test";
import { describe, expect, it } from "vitest";

interface Bindings {
  CONNECTION_DO: DurableObjectNamespace;
}

function getStub(name: string): DurableObjectStub {
  const ns = (env as unknown as Bindings).CONNECTION_DO;
  return ns.get(ns.idFromName(name));
}

async function postLock(name: string): Promise<Response> {
  return getStub(name).fetch("http://do/lock", { method: "POST" });
}

async function postUnlock(name: string): Promise<Response> {
  return getStub(name).fetch("http://do/unlock", { method: "POST" });
}

describe("ConnectionDO /lock + /unlock", () => {
  it("acquires the lock when free", async () => {
    const res = await postLock(`free-${crypto.randomUUID()}`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { acquired: boolean };
    expect(body.acquired).toBe(true);
  });

  it("returns 409 when the lock is already held", async () => {
    const conn = `held-${crypto.randomUUID()}`;
    const first = await postLock(conn);
    expect(first.status).toBe(200);

    const second = await postLock(conn);
    expect(second.status).toBe(409);
    const body = (await second.json()) as { acquired: boolean };
    expect(body.acquired).toBe(false);
  });

  it("releases via /unlock and allows re-acquisition", async () => {
    const conn = `release-${crypto.randomUUID()}`;
    expect((await postLock(conn)).status).toBe(200);
    expect((await postUnlock(conn)).status).toBe(200);
    expect((await postLock(conn)).status).toBe(200);
  });

  it("two concurrent /lock requests: exactly one wins, one gets 409", async () => {
    const conn = `race-${crypto.randomUUID()}`;
    const [a, b] = await Promise.all([postLock(conn), postLock(conn)]);
    const statuses = [a.status, b.status].sort();
    expect(statuses).toEqual([200, 409]);
  });
});
