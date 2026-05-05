// @baseout/server — backup engine, restore engine, background services,
// schema diff, DB provisioning, On2Air migration. Cloudflare Worker entry
// point. See ./openspec/proposal.md for scope and ./openspec/tasks.md for the
// build sequence.
//
// This module exports:
// - default fetch handler (HTTP routes: /runs/{id}/start, /restores/{id}/start, /inbound/*, /spaces/{id}/*)
// - default scheduled handler (cron triggers for background services)
// - Durable Object classes (PerConnectionDO, PerSpaceDO)

export default {
  async fetch(): Promise<Response> {
    return new Response("baseout-server placeholder", { status: 200 });
  },
  async scheduled(): Promise<void> {
    // cron-trigger dispatch — wired in Phase 2/4
  },
};
