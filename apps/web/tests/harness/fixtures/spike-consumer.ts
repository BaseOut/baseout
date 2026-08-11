// Spike fixture Worker for openspec/changes/system-test-harness-spike.
//
// A minimal stand-in for apps/web's SSR Worker: it imports the REAL
// `createBackupEngine` client and calls it over a REAL `BACKUP_ENGINE`
// service binding (wired by `createTestHarness()` to the apps/server
// Worker running in the same harness). This proves the cross-Worker
// contract with the production client code, without booting the full
// Astro build.
//
// Route: GET /spike/whoami/:connectionId → JSON EngineWhoamiResult.

import { createBackupEngine } from "../../../src/lib/backup-engine";

interface SpikeEnv {
  BACKUP_ENGINE: Fetcher;
  BACKUP_ENGINE_INTERNAL_TOKEN: string;
}

export default {
  async fetch(request: Request, env: SpikeEnv): Promise<Response> {
    const url = new URL(request.url);
    const match = url.pathname.match(/^\/spike\/whoami\/([^/]+)$/);
    if (!match) {
      return new Response(JSON.stringify({ error: "not_found" }), {
        status: 404,
        headers: { "content-type": "application/json" },
      });
    }
    const engine = createBackupEngine({
      binding: env.BACKUP_ENGINE,
      internalToken: env.BACKUP_ENGINE_INTERNAL_TOKEN,
    });
    const result = await engine.whoami(match[1] as string);
    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  },
};
