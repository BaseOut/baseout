---
title: MCP
description: The Baseout MCP server — what it exposes to an AI client, and how this section is arranged.
# The tool surface is now REAL (api-write-foundation → api-productionization, 2026-08-27): the
# server ships with a scope-filtered catalog covering org/backups/schema/data/documents/views/
# reports + search. This page still names no individual tool — the per-tool reference pages are the
# remaining work, added beside `mcp/anatomy-of-a-tool-page.md` (which stays a template by its own
# ruling; see `api/index.md`'s note for the original reasoning).
sources:
  - apps/api/src/mcp
---

The Model Context Protocol is a standard way for an AI client to discover and call tools on your
behalf. A Baseout MCP server puts your backups on the other end of it, so an assistant can answer
questions about what was captured and when, using the same data the app reads.

## What this changes

The API in the [section beside this one](/api/) is for code you write. MCP is for a client you did
not write — an assistant that needs to find out what tools exist before it can use one. That
difference is the whole reason these are two sections rather than one:

| | API | MCP |
|---|---|---|
| Who is calling | your code | an AI client, on your instruction |
| How a caller learns what exists | it reads this reference | it asks the server |
| What a page here documents | a request and its response | a tool, its arguments, and what the model sees |
| What breaks a caller | a changed field | a changed description |

The last row is the one people are surprised by. In an API, a tool's prose is documentation; in MCP,
the prose is part of the interface, because it is what the model reads to decide whether to call
something. That is why a tool page has a block an endpoint page does not.

## How this section is arranged

**Connecting** comes first: what the server address is, how a client authenticates to it, and the
configuration each supported client wants. It is read once per machine.

**The tool reference** comes second: one page per tool, all laid out the same way. That layout is
described in [Anatomy of a tool page](/mcp/anatomy-of-a-tool-page/).

## What it can reach

The same objects the API names — organizations, spaces, backup runs, schemas, records, documents,
saved views and reports. Reading is most of it; a token can also grant editing of the things that
live inside Baseout itself — documents, saved Data views, report definitions — each behind its own
write scope. An MCP client never stands between Baseout and the platform: it is not a way to start
a backup, a restore, or to touch a connection.

## Scope, stated once

Read access is read access, and a write scope is granted on the token, never assumed — the
[authentication page](/api/authentication/) has the full scope table. A tool that changes something
says so in its own description, and there is no tool that writes to a connected platform.
