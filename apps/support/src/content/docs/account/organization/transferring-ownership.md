---
title: Transferring ownership
description: The handover to do before somebody leaves, and the parts of it that are not in Baseout at all.
---

An organization outlives the person who created it, and the moment that becomes obvious is usually
the week they leave. Most of the work is not the Baseout record of who owns what: it is the
connections, which are held by people.

## The part that is in Baseout

Billing and the organization's settings belong to the organization and are administered by an admin,
so the Baseout half of a handover is making sure somebody else is one. See
[Members and roles](/account/organization/members-and-roles/).

## The part that is not

A Source carries the access of whoever authorized it, and it stops working when that person's access
stops. This is the piece that breaks quietly a fortnight after somebody's last day, when their
platform account is deactivated and every Space using their Source starts failing.

Each platform behaves a little differently, and the fix is the same shape on all three:

| Platform | What goes with the person |
| --- | --- |
| **Airtable** | A personal access token belongs to its creator and carries their base access. OAuth inherits whoever was signed in when the grant was made. |
| **Notion** | A public connection is tied to the person who authorized it. An internal connection acts as its own bot user and survives them. |
| **ClickUp** | Both methods carry the permissions of the person who authorized them. |

The durable arrangement is a connection that belongs to a **shared account** rather than to an
individual, which is the usual reason to prefer a token over OAuth. Notion's internal connections
have this property built in. See [Sources](/connections/sources/) and
[Connecting Notion](/platforms/notion/connecting/).

## Destinations too

A Destination authorizes against your storage, and the same question applies: whose Google Drive,
whose S3 credentials. A departing person's storage account taking the backups with it is the worst
version of this problem, because nothing fails until you need the files. See
[Destinations](/connections/destinations/).

## A handover checklist

1. Make sure at least one other person is an admin.
2. Re-authorize any Source held by the leaver, ideally onto a shared account.
3. Check the Destination is not held under a personal storage account.
4. Run a backup and read the run, rather than assuming the reconnection worked. See
   [Reading a backup run](/backups/reading-a-run/).

## What is not settled yet

A single control that transfers ownership of an organization in one act does not exist yet. Until it
does, the handover is the checklist above, and [contact us](/contact/?kind=ticket) if the person who
held everything has already gone.
