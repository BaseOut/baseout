---
title: What a Notion connection can see
description: Notion bounds a connection three times over, by capabilities, by what each page was shared with it, and by the access of the person behind it.
platform: notion
---

The steps are the same on every platform. This page covers only what is specific to Notion. For how
a Source is authorized, see [Connecting Notion](/platforms/notion/connecting/).

Notion is the platform where a perfectly valid connection routinely sees nothing at all. Three
separate mechanisms bound it, and they fail in different ways.

## Capabilities

Capabilities are chosen when the connection is created and apply everywhere it reaches:

| Capability | What it allows |
| --- | --- |
| Read content | Read pages, databases and blocks |
| Update content | Change existing content |
| Insert content | Add new content |
| Read comments | Read open comments |
| Insert comments | Add comments and replies |
| Read user information | See who people are, with or without their email addresses |

A backup needs read content, and read comments where comments matter. The user capability is the one
worth deciding deliberately: set to exclude email addresses, `people` properties and authorship come
back as names and ids with no address, and that is what a backup will hold. Set to no user
information at all, they come back thinner still.

## Sharing, page by page

This is the mechanism that catches everybody. A capability is permission to do a kind of thing; it
is not access to anything. A connection starts able to see nothing, and each page or database has to
be handed to it from inside Notion.

Access inherits downward, so one share high in the tree covers a great deal, and a page moved out of
a shared parent takes the access with it. See
[Sharing with the connection](/platforms/notion/connecting/#sharing-with-the-connection).

The failure is silent at every step: the token is valid, the request succeeds, and the answer is an
empty list, because from the connection's side an unshared page does not exist.

## The person behind the connection

A public connection acts on behalf of whoever authorized it and is bounded by what they can see. An
internal connection acts as its own bot user, so its access survives the person who granted it.

Capabilities never widen a person's own access. If someone loses edit rights on a page they shared,
the connection drops to read there too, whatever it was granted.

## What Notion will not tell you either way

There is no endpoint that reports who can see a page. The only access fact available is whether your
own connection can read it, which means a backup can record what it captured and cannot record what
it was not allowed to capture. That asymmetry is why sharing high is worth the effort.

## The consequence

A Notion backup that finds less than you expected is almost always a sharing gap rather than a
fault. Check the shares before the run. See
[A connection finds nothing](/troubleshooting/connection-finds-nothing/).
