---
title: Connecting ClickUp
description: ClickUp's two authorization methods, and what one connection can see.
platform: clickup
---

The steps are the same on every platform. This page covers only what is specific to ClickUp. For
what a Source is and how to add one, see [Sources](/connections/sources/).

ClickUp offers two ways in, and both authorize against a **Workspace**, the top of its hierarchy.
Neither can be narrowed to a single Space.

## OAuth

You are sent to ClickUp, it shows its own consent screen, and the person authorizing picks one or
more Workspaces there. Nothing is copied and pasted. ClickUp will say afterwards which Workspaces
were authorized, and the same screen is where that person widens or narrows the grant later. The
access token does not currently expire, which ClickUp notes is subject to change.

Registering the app side of this is a one-time job for a Workspace owner or admin, not something
each person repeats.

## Personal API token

Each person generates their own token in ClickUp's settings, under Apps, and pastes it into Baseout.
ClickUp's personal tokens begin with `pk_` and never expire.

A token belongs to the person who created it. It carries their permissions, and it stops seeing a
Space when they stop seeing it.

## What the connection can see

Both methods carry the permissions of the person who authorized them, so a private Space that person
cannot open is a Space Baseout cannot know exists. Items shared with them one by one, out of a
Workspace they are not a member of, arrive through ClickUp's shared hierarchy and read the same way.

## Speed is set by the ClickUp plan

ClickUp rate-limits per token, and the ceiling comes from the Workspace's plan: 100 requests a
minute on Free Forever, Unlimited and Business, 1,000 on Business Plus, 10,000 on Enterprise. A
large Workspace on a lower plan takes longer to read, and that is ClickUp pacing the run rather
than anything waiting on our side.

A few of ClickUp's endpoints are Enterprise-only, all of them for reading and managing individual
users and guests, so member detail is thinner on the other plans.

## When it breaks

A Source that loses access stops backups for every Space that uses it, and Baseout says so in three
places at once: the connection's own status, a banner in the affected Space, and a row in the Inbox.
See [Reconnecting a broken connection](/connections/reconnecting/).
