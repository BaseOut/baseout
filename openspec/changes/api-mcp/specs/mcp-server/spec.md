## ADDED Requirements

### Requirement: MCP server mounted on apps/api at /mcp
`apps/api` SHALL serve a Model Context Protocol server over the Streamable HTTP transport at `https://api.baseout.com/mcp`. The server SHALL be stateless: every request is independently authenticated and no session state is held beyond the MCP protocol handshake. The server SHALL NOT be deployed as a separate Worker or domain (a `mcp.baseout.com` alias, if added later, SHALL route to the same Worker).

#### Scenario: Client connects and lists tools
- **WHEN** an MCP client initializes against `/mcp` with a valid Bearer token
- **THEN** the handshake succeeds and `tools/list` returns the generated read-only tool catalog

### Requirement: Bearer-token authentication reusing api_tokens
The MCP endpoint SHALL authenticate every request via the same `Authorization: Bearer` middleware as the REST API (`api_tokens` hash lookup, active/expiry checks). Missing or invalid credentials SHALL fail the MCP request with an authentication error; the server SHALL NOT offer an unauthenticated mode.

#### Scenario: Missing header
- **WHEN** a client calls `/mcp` without an Authorization header
- **THEN** the request is rejected with an authentication error and no protocol handshake occurs

### Requirement: Tool catalog generated from the REST operation registry
Every MCP tool SHALL be generated from the `api-rest-read` operation registry: one tool per MCP-eligible operation, with the tool's input JSON Schema derived from that operation's Zod path/query/body schemas and the tool result carrying the operation's JSON response. Tools SHALL be annotated read-only (`readOnlyHint: true`). Hand-authored tools that bypass the registry SHALL NOT exist. Tool names and input schemas follow the additive-only stability policy: renames and removals are breaking and SHALL NOT occur within v1.

#### Scenario: REST endpoint addition propagates
- **WHEN** a new read operation is added to the registry and marked MCP-eligible
- **THEN** the next build's `tools/list` includes the corresponding tool with no separate MCP code change

#### Scenario: Catalog/contract drift fails CI
- **WHEN** a registry operation's schema changes without the regenerated catalog snapshot
- **THEN** the contract test fails the build

### Requirement: In-process dispatch with identical authorization semantics
Tool execution SHALL invoke the corresponding REST operation handler in-process (no HTTP self-call), under the caller's token grant context. Scope checks, tenant-safe not-found semantics, and error mapping SHALL be identical to the REST surface: a tool call outside the token's Organization/Space grants returns a not-found tool error; a tool call lacking the required scope returns a permission tool error. REST error objects SHALL map to MCP tool errors preserving `code` and `message` without leaking internal detail.

#### Scenario: Space-bound token calls another Space
- **WHEN** a token bound to Space A executes `list_backup_runs` targeting Space B
- **THEN** the tool returns a not-found error equivalent to the REST 404 `space_not_found`

#### Scenario: Scope-filtered catalog
- **WHEN** a token carries only `backups:read`
- **THEN** `tools/list` omits schema tools, and a forced call to one returns a permission error

### Requirement: Grant-aware parameter injection
Tools SHALL NOT expose parameters the token already determines: `orgId` SHALL always be injected from the token; when the token is Space-bound, `spaceId` and `platform` SHALL be injected (platform = the Space's single V1 Platform); when the token is Org-wide, `spaceId` SHALL be a required tool parameter and `list_spaces` SHALL be available for discovery.

#### Scenario: Space-bound token gets ID-free tools
- **WHEN** a Space-bound token lists tools
- **THEN** `get_backup_status` requires no org/space/platform parameters

#### Scenario: Org-wide token must name the Space
- **WHEN** an Org-wide token calls `search_schema` without `spaceId`
- **THEN** the tool returns a validation error naming `spaceId`

### Requirement: MCP usage metering
Every tool call SHALL be metered through the shared usage pipeline (`api-usage-tracking`) with `surface = "mcp"` and the tool name recorded as the route template, and SHALL count against the same per-token shadow rate limit as REST requests.

#### Scenario: Tool call appears in the usage dataset
- **WHEN** `search_schema` executes for a token
- **THEN** one Analytics Engine data point is written with surface `mcp`, the tool name, the token/org/space attribution, and duration
