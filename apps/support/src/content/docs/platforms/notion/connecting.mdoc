---
title: Connecting Notion
description: Notion's two kinds of connection, and why a valid one can still see nothing until each page is shared with it.
platform: notion
---

The steps are the same on every platform. This page covers only what is specific to Notion. For
what a Source is and how to add one, see [Sources](/connections/sources/).

Notion's authorization differs from Airtable's in one way that catches everybody: a token is not a
grant. Connecting produces a token that is perfectly valid and can reach **nothing**. Access is
handed over afterwards, page by page, from inside Notion, and Notion answers an unshared request
with an empty result rather than an error. A connection with no shares looks healthy and finds no
content. [Sharing with the connection](#sharing-with-the-connection) below is the part to read
before concluding that something is broken.

## Internal connections

An internal connection is scoped to one Notion workspace and authorized with a static token from
Notion's developer portal. Only a Workspace Owner can create one.

It acts as its own bot user, which is the property worth having: the access belongs to the
connection rather than to a person, so a page shared with it stays shared after the person who
shared it leaves.

## Public connections

A public connection uses OAuth. Everyone who authorizes it gets their own token, and Notion's page
picker is part of that flow, so the sharing step happens up front instead of afterwards. The token
then acts on behalf of that person and is bounded by what they can see.

## Capabilities

Both kinds carry **capabilities** chosen when the connection is made: read, update and insert
content, read and insert comments, and how much user information comes back, down to whether email
addresses are visible at all. Reading content is what a backup needs, plus reading comments where
comments matter.

Capabilities never widen a person's own access. If someone loses edit rights on a page they shared,
the connection drops to read there too, whatever it was granted.

## Sharing with the connection

Notion puts the access decision on the page, not on the token. A connection starts able to see
nothing at all, and every page or database it may read has to be handed to it from inside Notion.

### Why this looks like a bug and is not

The failure is silent at every step. The token is valid, so the connection succeeds. Notion's API
answers normally, so nothing errors. It returns an empty list, because from the connection's side an
unshared page does not exist. Nothing anywhere says the shares are missing. That is why this is the
first thing to check when a Notion connection produces no content.

### How sharing works

An internal connection is added page by page: open the page or database in Notion, use its
connections menu, and add the connection by name. A public connection asks instead during the OAuth
flow, where Notion shows a page picker and the person authorizing chooses there.

Either way, access inherits downward. Notion is explicit about it: a connection given access to a
page can read that page and its children, so one share high in the tree can cover a great deal.

The corollary is the part people miss. A database created **outside** anything you shared is not
covered by that share, and moving a page out of a shared parent takes the connection's access away
with it.

### Sharing high, and what search will admit to

There is a second reason to share high rather than widely. Notion guarantees that pages and
databases shared **directly** with a connection come back from a search; anything reached only by
inheritance depends on Notion's search index, which is not immediate and which Notion says is not
guaranteed to enumerate everything a connection can reach.

In practice that means a page shared a moment ago may not appear straight away, and a tree walked
down from a directly shared parent is more reliable than a search across many small shares.

### When access is taken away

Removing a connection from a page removes its access to that page and everything below it, and
nothing about the token changes. An internal connection keeps its shares when the person who made
them leaves the workspace, because the access belongs to the connection. A public connection is
tied to the person who authorized it and goes with them.

## Speed is set by Notion

Notion allows an average of three requests a second per connection, with short bursts above that,
and a second ceiling per workspace that scales with the plan. A workspace with a deep page tree
takes a while to walk, and that is Notion pacing the run.

## When it breaks

A Source that loses access stops backups for every Space that uses it, and Baseout says so in three
places at once: the connection's own status, a banner in the affected Space, and a row in the Inbox.
See [Reconnecting a broken connection](/connections/reconnecting/).
