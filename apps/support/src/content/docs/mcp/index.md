---
title: MCP
description: The Baseout MCP server — what it exposes to an AI client, and how this section is arranged.
# THE SAME TENSION, THE SAME RESOLUTION. Read the frontmatter note on `api/index.md` first.
# The Model Context Protocol itself is public and settled, and everything this page says about it is
# checkable. What is NOT settled is which tools Baseout exposes, what each is called, or what it
# returns — so no tool name appears on this page, and the one on `mcp/anatomy-of-a-tool-page.md`
# is written in `{braces}` as a template. Add tool pages beside these when they exist; do not fill
# the braces in.
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

The same objects the API names — organizations, spaces, connections, backup runs, snapshots and
schemas — and no more. An MCP client reads your backups; it does not stand between Baseout and the
platform, and it is not another way to start a restore.

## Scope, stated once

Read access is read access. A tool that would change something in your account is documented as such
on its own page, in its first paragraph, and there is no tool that writes to a connected platform.
