---
title: What an Airtable connection can see
description: Airtable bounds a connection twice, by the bases named in the grant and by the scopes on it, and reports your permission level on every base it returns.
platform: airtable
sources:
  - apps/web/src/lib/airtable/config.ts
  - apps/web/src/pages/api/connections/airtable/start.ts
  - apps/workflows/trigger/tasks/_lib/airtable-client.ts
---

The steps are the same on every platform. This page covers only what is specific to Airtable. For
how a Source is authorized, see [Connecting Airtable](/platforms/airtable/connecting/).

Airtable answers "what can this connection reach" with two independent answers, and both have to say
yes. One is the list of bases the grant covers. The other is the list of scopes on the token. A
missing base and a missing scope look nothing alike, so it is worth being able to tell them apart.

## The resource list

Whoever authorizes chooses what the grant covers: named bases, or a whole workspace. Baseout sees
exactly that. A base left out is not hidden inside Baseout, it is invisible to Baseout, which cannot
know it exists. That is the usual reason a base is missing from the picker: see
[My bases are missing from the picker](/troubleshooting/missing-bases/).

Widening happens on Airtable's side. Add the base to the token or re-run the OAuth consent, and it
appears on the next look.

## The scopes

A scope says what kind of thing the connection may do, everywhere it can reach. The ones a backup
cares about:

| Scope | What it allows |
| --- | --- |
| `schema.bases:read` | Read tables, fields and views |
| `data.records:read` | Read records |
| `data.recordComments:read` | Read comments on records |
| `user.email:read` | See the email address of the token's owner |
| `schema.bases:write` | Create tables and fields, needed only by Restore |
| `data.records:write` | Create and update records, needed only by Restore |
| `webhook:manage` | Manage webhooks, used by the Instant cadence |

A backup needs the read scopes and nothing else. Restore is the only feature that asks for a
connection that can write, and it asks separately: see
[How backups work](/backups/how-backups-work/).

If comments are missing from a backup and everything else arrived, `data.recordComments:read` is the
first thing to check. A scope that was not granted produces an authorization error on that call
alone, not a broken connection.

## Your permission level travels with the base

When Airtable lists the bases a token can reach, each one comes back with the permission level the
token's owner holds on it: `none`, `read`, `comment`, `edit`, `create` or `interfaceOnly`. A backup
needs no more than `read`, and a restore into an existing base needs enough to create tables in it.

That level is the person's, not the token's. Scopes never widen it. A token with
`data.records:write` held by somebody with read-only access to a base still cannot write to that
base.

## The consequence

A backup captures exactly what was granted, and it says so rather than appearing complete. If a
teammate's base is not in your backup, the grant is where to look first, not the run.

## When the grant is withdrawn

Revoking a token, removing a base from the grant, or the token owner losing access to a base all
have the same effect on the next run. Baseout reports it on the connection, in a banner on the
affected Space, and in the Inbox. See
[Reconnecting a broken connection](/connections/reconnecting/).
