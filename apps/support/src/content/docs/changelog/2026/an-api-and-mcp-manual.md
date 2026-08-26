---
title: An API and MCP manual, separate from the product one
description: The developer documentation is its own manual now, with its own header item and its own sidebar, and every page in the portal has a markdown twin.
lastUpdated: 2026-08-24
---

Driving Baseout from your own code is a different job from using the app, read by different people
at a different time. Until now both lived in one tree, which meant the ten product chapters sat
above the developer material for readers who wanted one and not the other.

## Its own header item, its own sidebar

`API/MCP` is a top-level destination in the header. Behind it is a manual with its own sidebar
holding two groups and nothing else: the product chapters are not there, and the developer pages are
no longer in the product sidebar. Paging forward with the previous and next links keeps you inside
the manual you are reading, instead of walking you across the seam into the other one.

## How the reference is arranged

The API is organised around the same objects the app is: an organization, a space, a connection, a
backup run, a snapshot, a restore, a schema. [The overview](/api/) lists them and points at the
glossary, which stays the authority on what each one means.

Two pages describe the shape the reference takes rather than its contents. [Anatomy of a reference
page](/api/anatomy-of-a-reference-page/) and [Anatomy of a tool
page](/mcp/anatomy-of-a-tool-page/) lay out where on the page each block sits, in braces, so that
the layout is readable before there is anything filled into it. They are worth five minutes once and
never again.

## Related operations, on the pages that need them

A few product pages describe something the API can also do. Those pages carry the operation in their
own frontmatter and render it at the foot, named in words. Most pages will never carry one, which is
the point: the note appears where it is specific and stays absent where it would be noise.

## Every page has a markdown twin

Add `.md` to any documentation URL and you get that page's source, with a header naming its
canonical address. [`/llms.txt`](/llms.txt) is the index of the whole manual and
[`/llms-full.txt`](/llms-full.txt) is the whole manual in one file. Both are generated from the same
list of pages the sidebar is built from, so neither can quietly fall behind it.
