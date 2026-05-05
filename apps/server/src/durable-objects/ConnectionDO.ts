// ConnectionDO — per-Airtable-Connection rate-limit gateway + state holder.
//
// Phase 1 will add: leaky-bucket throttling per Connection, queueing of
// inbound requests from SpaceDO, OAuth-token refresh handoff, lock state.
//
// PoC: stub fetch handler proves the DO is reachable and wrangler validates
// the binding + migration.

import type { Env } from "../env";

export class ConnectionDO {
  constructor(
    private readonly state: DurableObjectState,
    private readonly env: Env,
  ) {}

  async fetch(_request: Request): Promise<Response> {
    return new Response(
      JSON.stringify({ do: "ConnectionDO", id: this.state.id.toString() }),
      { status: 200, headers: { "content-type": "application/json" } },
    );
  }
}
