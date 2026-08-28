---
title: Connecting a client
description: The server address, how a client authenticates, and what it will find when it asks.
api:
  - summary: Discover the tool catalog a token is allowed to see
  - summary: Call a tool under the same scopes as the REST API
sources:
  - apps/api/src/mcp
---

One address, one header, and the client does the rest — discovery is the protocol's job, not
yours. In this guide, you will: create a token, point a client at the server, and understand what
shapes the tool list it gets back.

## The address and the key

The MCP server lives at `/mcp` on the API host, and authenticates exactly as the
[API does](/api/authentication/): a bearer token from **Settings → Developer** in the
`Authorization` header. There is no separate MCP credential — a token is a token, and everything
on the authentication page (Space binding, revocation, the one-time reveal) applies here
unchanged.

Most clients take both in one block of configuration:

```json
{
  "mcpServers": {
    "baseout": {
      "url": "{server_url}/mcp",
      "headers": { "Authorization": "Bearer bo_live_..." }
    }
  }
}
```

The transport is the standard streamable HTTP one; a client that speaks current MCP needs no
Baseout-specific handling.

## The catalog is scoped

When a client asks what tools exist, the answer depends on the token. A tool whose scope the token
lacks is not listed at all — an assistant holding a read-only token never sees a write tool, rather
than seeing it and failing. So the way to decide what an assistant may do is the way you already
have: the scope boxes on the token, not configuration in the client.

The catalog covers the same ground as the app, tool by tool: the Organization and its Spaces,
backup runs and status, the captured schema, records and attachments, documents, saved Data views,
report definitions — and search across each of them. A tool that changes something says so in its
own description, and deleting is marked destructive, so a well-behaved client will ask you first.

## Answers link back to the app

Results that name something you can open — a record, a field, a document, a report — carry an
`appUrl` alongside the data: a link into the app with the right panel already open. An assistant
that answers "found it in the Members table" can hand you the row itself, not a description of
where to look.

## What it deliberately cannot do

A token bound to one Space keeps the assistant inside that Space, same as the API. And no tool
exists for running backups, restoring, or touching your platform connections — an MCP client works
with what Baseout has captured; the capture itself stays in the app.
