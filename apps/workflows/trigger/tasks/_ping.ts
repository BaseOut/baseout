// Smoke task — proves the Worker → Trigger.dev wire works end-to-end.
// No-op: returns the current ts and echoes any input. Underscore-prefixed
// to flag "internal / not user-facing"; safe to keep around as a liveness
// probe alongside __db-smoke.

import { task } from "@trigger.dev/sdk";

export const pingTask = task({
  id: "_ping",
  maxDuration: 60,
  run: async (payload: { echo?: unknown } = {}) => {
    return { ok: true, ts: Date.now(), echo: payload.echo ?? null };
  },
});
