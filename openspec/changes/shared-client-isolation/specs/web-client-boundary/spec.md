## ADDED Requirements

### Requirement: Browser communicates with apps/web only
The browser SHALL communicate with `apps/web` as its sole origin. No browser-initiated HTTP or WebSocket connection SHALL target `apps/server`, `apps/api`, `apps/sql`, or `apps/hooks` directly.

#### Scenario: Live progress WebSocket is on apps/web
- **WHEN** the browser opens a WebSocket for backup/restore progress
- **THEN** the connection SHALL be to `wss://baseout.com/api/ws/spaces/{id}/progress` (apps/web)
- **AND** the browser SHALL NOT connect to any `apps/server` URL directly

#### Scenario: Run trigger goes through apps/web
- **WHEN** the browser triggers a backup run
- **THEN** the request SHALL be a POST to `/api/runs/{id}/start` on `apps/web`
- **AND** apps/web SHALL validate the session before forwarding to apps/server

#### Scenario: Restore trigger goes through apps/web
- **WHEN** the browser triggers a restore
- **THEN** the request SHALL be a POST to `/api/restores/{id}/start` on `apps/web`
- **AND** apps/web SHALL validate the session before forwarding to apps/server

### Requirement: apps/web proxies server data reads via service binding
All data reads from `apps/server` that the browser needs (health scores, schema changelogs, restore bundles) SHALL be proxied through `/api/*` routes in `apps/web` using a Cloudflare service binding.

#### Scenario: Health score is read through apps/web
- **WHEN** the dashboard requests a per-Base health score
- **THEN** the browser SHALL call an `/api/*` endpoint on `apps/web`
- **AND** apps/web SHALL fetch the data from apps/server via service binding

#### Scenario: Schema changelog is read through apps/web
- **WHEN** the browser requests schema diff history
- **THEN** the browser SHALL call an `/api/*` endpoint on `apps/web`
- **AND** apps/web SHALL fetch from apps/server via service binding

### Requirement: apps/server rejects requests without HMAC service token
`apps/server` SHALL reject any inbound HTTP request that does not include a valid `X-Service-Token` HMAC header. Browser sessions are not valid callers.

#### Scenario: Direct browser request to apps/server is rejected
- **WHEN** an HTTP request arrives at apps/server without a valid X-Service-Token header
- **THEN** apps/server SHALL return 401 Unauthorized

#### Scenario: Service binding call from apps/web is accepted
- **WHEN** apps/web calls apps/server via service binding with a valid HMAC token
- **THEN** apps/server SHALL process the request normally

### Requirement: apps/web holds a cross-Worker DO namespace binding to PerSpaceDO
`apps/web` SHALL declare a Durable Object namespace binding to `PerSpaceDO` (defined in `apps/server`) using `script_name = "baseout-server"`, enabling it to access the same DO instance without routing through apps/server's HTTP handlers.

#### Scenario: WebSocket upgrade is forwarded directly to the DO
- **WHEN** apps/web receives a browser WebSocket upgrade for `/api/ws/spaces/{id}/progress`
- **THEN** apps/web SHALL create a PerSpaceDO stub via its DO namespace binding
- **AND** forward the upgrade to the DO directly
- **AND** the DO SHALL accept the WebSocket via the Hibernation API
