# Design: WebSocket live progress

## Why two layers (apps/web proxy + SpaceDO fan-out)

The browser opens a WebSocket to `apps/web` — never directly to `apps/server`. The Worker for `apps/web` validates auth, then forwards the upgrade through a Cloudflare cross-Worker Durable Object namespace binding. After the upgrade, the WebSocket frames flow *directly* between the browser and the `SpaceDO` instance — `apps/web`'s Worker is only in the path for the initial HTTP handshake.

That gives us:

- **Auth gate**: every connection passes through `apps/web`'s session check. No way to attach a socket to a SpaceDO with just the Space's UUID — must hold a session that owns that Space.
- **Direct fan-out**: once attached, the SpaceDO sends frames to N attached browsers in one place. No round-trip through `apps/web` per progress event.
- **Hibernation cost**: workerd's WebSocket hibernation API keeps the DO billable only when there's actual work to do. An idle Space with 5 attached browsers costs nothing between progress events.

## Why script_name binding instead of a service-binding HTTP proxy

A pure service-binding HTTP proxy would terminate the WebSocket at `apps/web`'s Worker, then open a *second* WebSocket to `apps/server`, and pipe frames between them. That doubles the WebSocket-related billing surface (two connections per browser) and prevents hibernation from working — the apps/web side is always non-hibernating because it's hand-piping bytes.

The cross-Worker DO namespace binding (`script_name: "baseout-server-…"`) instead lets us:

1. Issue the upgrade response *from the DO* directly, with the apps/web Worker stepping out of the loop after the initial fetch.
2. Let the DO go to sleep between events while keeping the socket attached.
3. Avoid maintaining two parallel connection states.

The cost: apps/web needs deploy-time visibility into `apps/server`'s DO class name and script name. We pin those in `wrangler.jsonc.example` per env (e.g. `baseout-server-dev`, `baseout-server-staging`, `baseout-server`).

## Why SpaceDO and not a fresh ProgressBroadcastDO

The per-Space DO already exists and already holds the per-Space backup-run state. Routing the WebSocket fan-out through the *same* DO means:

- The post-progress broadcast happens in the same `state.storage` transaction as the state bump. Atomic.
- Existing tests for `SpaceDO` cover the new code path automatically.
- One DO instance per Space, not two — cheaper.

Trade-off: `SpaceDO`'s code grows. We accept the growth because the alternative is a second DO that mirrors most of SpaceDO's state.

## Why JSON frames instead of binary / msgpack

Progress payloads are tiny (~100 bytes each). The cost of JSON.stringify + JSON.parse is negligible vs. the network round-trip. JSON also debugs trivially in Chrome DevTools' WebSocket inspector, which we'll rely on during manual smoke testing. Revisit if we ever start streaming attachment-byte progress at MB/s rates.

## Frame shapes

```ts
type ProgressEvent = {
  type: "progress";
  runId: string;
  atBaseId: string;
  recordsAppended: number;
  tableCompleted: boolean;
};

type CompleteEvent = {
  type: "complete";
  runId: string;
  status: "succeeded" | "failed" | "trial_truncated" | "trial_complete" | "cancelled";
  tablesProcessed: number;
  recordsProcessed: number;
  attachmentsProcessed: number;
  errorMessage?: string;
};

type Frame = ProgressEvent | CompleteEvent;
```

The `type` discriminator makes the consumer a flat switch statement. New event types (e.g. restore, schema-diff) extend the union without breaking existing handlers.

## Reconnect strategy

Socket drops happen — Cloudflare's edge maintenance, transient network blips, mobile network switches. The client must reconnect transparently:

- Exponential backoff: 250ms, 500ms, 1s, 2s, 5s, 10s, 30s (cap).
- On reconnect, the client re-fetches `/api/spaces/:id/runs` once to reconcile any missed events (this is the cheap REST endpoint that already drives the 2s poll today — repurposed for catch-up).
- Safety-net poll: while disconnected, the client polls `/runs` every 30s so a permanently-broken WebSocket still produces eventual consistency. After the first successful reconnect, the safety poll stops.

## Authorization

Two checks, both inside the apps/web route handler before the DO upgrade:

1. **Session valid** — middleware in `apps/web/src/middleware.ts` runs first. If no session, return 401.
2. **Space membership** — the user's account must own (or be a member of) the target Space. Uses the existing helper that's already enforcing the same check on `GET /api/spaces/:id/runs` (REST sibling).

Both checks happen *before* the upgrade response is returned. After the upgrade, the SpaceDO trusts the connection — the DO has no per-frame auth (the connection identity *is* the auth).

## Hibernation correctness

The DO's WebSocket-hibernation API requires us to keep all per-socket state inside `state.attachWebSocket(ws, { ... })` or in `state.storage`. State that lives in JS closures is lost when the DO hibernates.

Concretely: the "list of attached sockets" is provided by `state.getWebSockets()` — not a member field. We never hand-roll a `Set<WebSocket>`. Tests must exercise the hibernation round-trip (`runDurableObjectAlarm()` or equivalent) to confirm fan-out still works after a hibernation cycle.

## Test approach

- **DO-side**: Miniflare + `@cloudflare/vitest-pool-workers`. Open the WebSocket via the test harness, POST a progress event via the internal route, assert frame receipt.
- **Route-side**: same harness. Smaller scope — assert upgrade returns 101 (or 401 for unauth), and that frames pass through unmodified.
- **Client-side**: a fake `WebSocket` (manually-implemented stub or `mock-socket` library) wired through the nanostore reducer. Assert store mutations on incoming frames.

## Open questions

- **Mobile background tabs**: iOS Safari closes WebSockets aggressively when the tab backgrounds. The safety-net poll covers this, but the UX of "swipe back to tab → see stale state for up to 2 minutes" is noticeable. A future change might add a "tap to refresh" affordance on tab-foreground events.
- **Org admins with many Spaces**: an admin watching N Spaces opens N WebSockets. At N=20 that's 20 connections per browser tab. Cloudflare WebSocket connection limits aren't documented per-Worker, but the connection count is something to watch in staging. Consider a multiplexing layer later if N grows.
