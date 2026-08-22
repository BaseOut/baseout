---
title: What a ClickUp connection can see
description: ClickUp authorizes at the Workspace and then defers to the roles and private containers underneath, so two people connecting the same Workspace see different amounts of it.
platform: clickup
---

The steps are the same on every platform. This page covers only what is specific to ClickUp. For how
a Source is authorized, see [Connecting ClickUp](/platforms/clickup/connecting/).

ClickUp has no scope list and no per-object grant to hand an integration. Authorization is
Workspace-wide, and everything narrower is decided by the ordinary permissions of the person the
connection belongs to.

## The grant is the Workspace

Both authorization methods authorize against a **Workspace**, the top of ClickUp's hierarchy, and
neither can be narrowed to a single Space. What you cannot do is grant a connection access to one
Space and not another: ClickUp does not express that.

What you can do is choose whose access it inherits, which is the same decision by another route.

## Roles decide the rest

A connection carries the permissions of the person who authorized it, so their role is the real
boundary:

| Role | What that generally means for a backup |
| --- | --- |
| Owner, Admin | The whole Workspace, private containers included where their role reaches them |
| Member | The Spaces, Folders and Lists they are a member of |
| Guest | Only the items shared with them, one by one |

A private Space the person cannot open is a Space Baseout cannot know exists. There is no error and
nothing to reconnect: it is simply not in the answer. Items shared with them individually, out of a
Workspace they are not a member of, arrive through ClickUp's shared hierarchy and read the same way
as anything else.

## Who should authorize

The consequence is a recommendation rather than a setting: a connection meant to protect a whole
Workspace should be authorized by somebody who can see the whole Workspace. A backup made from a
Member's token is a backup of that Member's view, and it will look complete.

A connection that belongs to a shared account rather than to a person is the usual way to make that
stable, because it survives the person leaving.

## Member detail is thinner outside Enterprise

ClickUp's endpoints for reading and managing individual users and guests are Enterprise-only. On
other plans, people appear as they are embedded in tasks, assignments and comments, and there is no
directory to read them from.

## When the grant is withdrawn

Deleting a personal token, revoking the OAuth grant, or the person losing access to a container all
have the same effect on the next run. Baseout reports it on the connection, in a banner on the
affected Space, and in the Inbox. See
[Reconnecting a broken connection](/connections/reconnecting/).
