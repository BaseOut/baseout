## Why

`apps/server`'s [`baseout-server-websocket-progress`](../baseout-server-websocket-progress/) is currently a one-paragraph stub: "DO-emitted progress events". No frame envelope, no subscription URL, no auth model, no reconnect policy. Without the contract, a server agent picking up websocket-progress has to guess; web-side `/backups/[runId]` page can't be built either side.

This change locks the contract end-to-end:
- Subscription URL pattern (server-hosted; web subscribes directly).
- One-time HMAC subscription token minted by web.
- Frame envelope: `progress`, `complete`, `error`, `heartbeat`.
- Reconnect / replay policy.

It's contract-only. No live WebSocket on either side today. Web ships a stub `POST /api/me/run-progress-token` that returns 501 with the spec header.

## What Changes

- **Add** spec [specs/web-websocket-progress-contract/spec.md](./specs/web-websocket-progress-contract/spec.md) — SHALL/MUST scenarios for:
  - Subscription URL: `wss://<server-host>/api/runs/<runId>/progress?token=<hmac>`.
  - Token mint: `POST /api/me/run-progress-token` on web → returns `{ token, expiresAt }`.
  - Frame envelope (text JSON): `progress`, `complete`, `error`, `heartbeat` types.
  - Reconnect: client exponential backoff (1s → 30s, jittered, cap 60s).
  - Replay: on reconnect, server replays the last `progress` plus any unacknowledged `complete`/`error`.
- **Add** stub endpoint [apps/web/src/pages/api/me/run-progress-token.ts](../../../apps/web/src/pages/api/me/run-progress-token.ts) — returns `501` with `Spec: openspec/changes/baseout-web-websocket-progress-contract` header.

## Capabilities

### New Capabilities

- `web-websocket-progress-contract` — frozen WebSocket frame envelope and subscription protocol for backup-progress streams. Spec: [specs/web-websocket-progress-contract/spec.md](./specs/web-websocket-progress-contract/spec.md).

### Modified Capabilities

None.

## Impact

- New: spec + stub endpoint.
- No DB / external API changes.
- No `apps/server` code changes (server agent reads spec when implementing the live WSS endpoint).
- **Cross-app contract**: server's WSS endpoint and web's subscriber both read this spec as authoritative.

## Reversibility

Contract-only. Reverting deletes two files. No external surface to roll back.

## Server-side handoff [SERVER-NOTE]

When implementing `baseout-server-websocket-progress`:

1. Frame schema is frozen at four `type` values: `progress`, `complete`, `error`, `heartbeat`. New types require a v2 contract.
2. Heartbeat cadence is **15 seconds**. The web reconnect detector treats >30s without any frame as a dead connection.
3. The token mint endpoint stays on web (`POST /api/me/run-progress-token`) — it has the user session. Server validates the HMAC against `BASEOUT_WSS_TOKEN_SECRET` (new shared secret added in the live implementation, NOT in this contract).
4. Replay buffer: server SHOULD retain the last `progress` frame + all unacknowledged terminal frames per run for at least 60s. Client acks via WebSocket text frame `{ type: 'ack', runId, frameId }` (frame IDs added in the live implementation if needed; today's contract treats replay as best-effort).
