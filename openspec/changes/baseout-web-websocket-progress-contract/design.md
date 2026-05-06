## Context

`apps/server` Durable Objects are the natural emitter for run progress: they hold the state machine for each Space's backup runs. Web is the natural subscriber: the customer is in the web UI, and authenticated session cookies live there.

The two questions that need answers:

1. **Where does the WebSocket terminate?** Two choices: server-worker hosts it (clients connect directly to server's domain) or web-worker hosts a proxy (clients connect to web). Direct is simpler and lower latency; the only downside is cross-domain (mitigated by HMAC token).
2. **How does the subscriber authenticate?** WebSocket can't carry cookies cleanly across origins. A short-lived HMAC token in the query string, minted by web after session check, gives single-use credentials with TTL.

## Goals

- Frame envelope stable enough that engine-core code can emit and web UI can render without future churn.
- Auth model that's secure (single-use token, TTL, scoped to runId).
- Reconnect policy that bounds reconnection storms while staying responsive to brief network blips.

## Non-Goals

- Bi-directional flow control. Server pushes; client only acks (and may not ack today).
- Multi-run subscriptions on one socket. One socket per run keeps lifecycle reasoning simple.
- Live cursor / multi-tenant chat-style features. PRD §6 dashboard widgets are read-only timelines.

## Decisions

### D1 — WebSocket lives on `apps/server`, not on `apps/web`

**Decision:** Subscription URL is `wss://<server-host>/api/runs/<runId>/progress?token=<hmac>`. Server hosts the endpoint directly.

**Why:** Server-hosted Durable Objects are the natural emitter; routing every frame through web adds a hop and a second auth layer. Cross-domain is fine — the HMAC token covers auth.

**Trade-off:** Two domains in the user's connection. Acceptable; modern browsers handle it transparently.

### D2 — Auth via single-use HMAC token in query string, TTL 10 min

**Decision:** Web mints a token via `POST /api/me/run-progress-token` (session-authed). Token is HMAC-SHA256(`runId|userId|expiresAtMs`) with shared secret `BASEOUT_WSS_TOKEN_SECRET`. Token is valid for 10 minutes; server validates HMAC + TTL on connect.

**Why:** Cookies can't be relied on for cross-origin WSS. Header-based auth doesn't work for the WSS upgrade either. Query-string token is the standard; HMAC + TTL prevents replay.

**Trade-off:** Token visible in server logs. Mitigated by 10-min TTL — token is only useful within the run's lifetime.

### D3 — Frame envelope is JSON over text frames; four `type` values, closed enum

**Decision:** Server emits text frames carrying JSON. Four `type` values: `progress`, `complete`, `error`, `heartbeat`. New types require a v2 contract.

**Why:** Closed enum is debug-friendly; binary frames offer no advantage at our message sizes (< 1 KB each). JSON is what the dashboard's React Flow / progress widgets already consume.

### D4 — Heartbeat cadence: 15s; client dead-connection threshold: 30s

**Decision:** Server emits `{ type: 'heartbeat', runId, ts }` every 15 seconds. Client treats `> 30s` since any frame as a dead connection; reconnects with backoff.

**Why:** 15s is fast enough that proxies / load balancers don't time out idle connections; 30s threshold tolerates one missed heartbeat without false-positive reconnects.

### D5 — Reconnect: exponential backoff, 1s → 30s, jittered, cap 60s

**Decision:** Client backoff schedule: 1s, 2s, 4s, 8s, 16s, 30s (cap 60s with jitter). Reset to 1s after a successful frame.

**Why:** Standard pattern; cap at 30s (jittered to 60s) prevents storms when many clients reconnect after a network blip.

### D6 — On reconnect, server replays last `progress` + any unacknowledged terminal

**Decision:** Server retains the last `progress` frame per run for ≥60s after emit, plus any `complete` / `error` frame that the client hasn't ack'd (best-effort today; ack mechanism specified in v2). On reconnect with a valid token, server immediately emits the replay.

**Why:** Without replay, brief disconnects miss completion notifications. With replay, the client's UI converges on the correct state regardless of disconnects.

**Trade-off:** Server holds buffered frames per run. Acceptable — at one progress + one terminal per run, memory is trivial.

### D7 — Frames are idempotent on `runId` + emit timestamp

**Decision:** Frames carry no monotonic sequence number today. Clients dedupe by `(runId, type, ts)` triplet.

**Why:** Sequence numbers are over-engineered for V1 — at our frame rate (heartbeat every 15s, progress every few seconds during a run), `(runId, type, ts)` is unique enough. v2 can add `frameId` for strict ordering if needed.

## Risks / Trade-offs

| # | Risk | Likelihood | Mitigation |
|---|------|------------|------------|
| R1 | HMAC secret leaks (e.g., via dev `.env` commit) | Medium | Shared secret `BASEOUT_WSS_TOKEN_SECRET` lives in Cloudflare Secrets in prod; rotation invalidates all live tokens (all clients reconnect). |
| R2 | Server retains replay buffers indefinitely under client churn | Low | TTL-based eviction (60s after emit) bounds memory. |
| R3 | Cross-origin WSS blocked by corporate proxies | Low | Same risk as any WSS app; doc-only mitigation (point to user's network admin). |
| R4 | Token leaks via Referer header | Low | WSS doesn't carry Referer; token is in URL but the URL is only used at handshake. Browser logs may capture it; mitigated by 10-min TTL. |
| R5 | Frame schema evolution breaks older web clients | Medium | Closed `type` enum + v2 contract for any change. Web clients ignore unknown types gracefully (don't error). |

## Verification

```bash
pnpm --filter @baseout/web typecheck     # 0 errors
pnpm --filter @baseout/web build          # clean
```

End-to-end (operator, dev server):

```
# Stub mints — no session → 401
curl -i -X POST https://localhost:4331/api/me/run-progress-token
# Expect: 401, body { error: 'Not authenticated' }

# With session → 501 (until live impl lands)
curl -i -X POST https://localhost:4331/api/me/run-progress-token \
  -b 'better-auth.session_token=<valid>' \
  -H 'Content-Type: application/json' \
  -d '{"runId":"r_abc"}'
# Expect: 501 with header `Spec: openspec/changes/baseout-web-websocket-progress-contract`
```
