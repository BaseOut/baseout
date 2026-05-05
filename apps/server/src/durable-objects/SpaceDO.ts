// SpaceDO — per-Space scheduler + backup controller.
//
// Phase 1 will add: scheduled-backup state machine, Trigger.dev task
// dispatch, WebSocket fan-out for real-time progress, alarm-driven cron-like
// dispatching.
//
// PoC: stub fetch handler proves the DO is reachable and wrangler validates
// the binding + migration.

import type { Env } from "../env";

export class SpaceDO {
  constructor(
    private readonly state: DurableObjectState,
    private readonly env: Env,
  ) {}

  async fetch(_request: Request): Promise<Response> {
    return new Response(
      JSON.stringify({ do: "SpaceDO", id: this.state.id.toString() }),
      { status: 200, headers: { "content-type": "application/json" } },
    );
  }
}
