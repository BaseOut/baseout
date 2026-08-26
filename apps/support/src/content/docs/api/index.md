---
title: API
description: The reference for driving Baseout from your own code.
# THE TENSION THIS PAGE IS THE ANSWER TO — READ BEFORE "FINISHING" IT.
# This portal carries no "not written yet" affordance. Oleh removed the site-wide draft banner on
# 2026-08-18 and the seven per-page `provisional` banners on 2026-08-20, on one ruling: the portal is
# a demonstration of the finished product, and a banner saying the text is not real is noise in
# front of the thing being judged. Every page has to read as finished.
# The API surface, however, is NOT settled — there are no endpoint paths, no parameter names and no
# error codes to write down yet. Inventing a plausible set would be worse than a banner, because a
# banner is detectable and an invented endpoint is not: a reader has no way to tell `GET /v1/runs`
# from something we made up to fill a table, and neither has the next person to edit this file.
# THE RESOLUTION: this section is written about a subject that IS settled — its own arrangement, and
# the object model the app already publishes in the glossary. Nothing here is a claim about a
# request. The two "Anatomy of" pages carry the request-shaped material and carry it as a TEMPLATE,
# in `{braces}`, which is generic on purpose and reads as generic on sight.
# So: when the API exists, ADD reference pages beside these; do not "correct" the braces into names.
---

The API is organised around the same objects the app is organised around. Anything you can name in
the interface — an organization, a space, a connection, a backup run — you can name in a request,
and it keeps the same identifier in both places.

## The objects

These are the app's own terms, unchanged. The [glossary](/reference/glossary/) is the authority on
what each one means; this reference will describe what you can do with each one.

| Object | What it is |
|---|---|
| **Organization** | The top-level customer entity. Billing lives here. |
| **Space** | A container inside an organization, bound to exactly one platform. |
| **Connection** | A link between your account and a platform — a source you back up from, or a destination you write to. |
| **Backup run** | One execution of the backup process. An immutable log entry. |
| **Snapshot** | The output of a backup run, and the thing a restore reads from. |
| **Restore** | Writing a snapshot back into the platform it came from. |
| **Schema** | The structure of a base at the moment a run captured it. |

## How this section is arranged

Two parts, in this order.

**Concepts** come first and are read once: how a request is authenticated, how versions are pinned,
how a list is paged, how an error is shaped, and what the rate limits are. These are the things that
are true of every endpoint, and repeating them on every endpoint page is what makes a reference
unreadable.

**The reference** comes second and is read a hundred times: one page per object above, each one laid
out identically so that the block you need is always in the same place on the page. That layout is
described in [Anatomy of a reference page](/api/anatomy-of-a-reference-page/), which is worth five
minutes before your first request and never again.

## MCP is beside this, not inside it

The [MCP server](/mcp/) exposes the same objects to an AI client rather than to your code. It sits
in its own section of this manual because the questions it answers are different ones — which tools
exist, what each returns, and which client you are wiring it into — even though both surfaces are
reading the same backups.

## The product manual is elsewhere

If you are looking for what a backup run *is*, rather than how to ask for one, that is the
[product documentation](/start/what-baseout-is/) — a different manual with its own contents, reached
from **Docs** in the header.
