---
title: Authentication and scopes
description: How a request proves who it is, and how a token says what it may do.
api:
  - summary: Authenticate a request with a bearer token
  - summary: Scope a token to an Organization or a single Space
sources:
  - apps/api/src/lib/auth.ts
  - apps/web/src/pages/api/tokens/index.ts
---

Every request carries a token, and every token carries a list of scopes. Those two sentences are
the whole model; the rest of this page is what each half means in practice.

## The token

You create tokens in **Settings → Developer**. The full value is shown once, at creation, and never
again — Baseout stores only a hash of it, so a lost token is replaced, not recovered. A token can
be revoked there at any time, and revocation takes effect on the next request.

Send it in the `Authorization` header on every request:

```http
Authorization: Bearer bo_live_...
```

There is no other way to authenticate. A request without a valid token receives `401`, with no
detail about why — an expired token, a revoked token, and a token that never existed all read the
same from outside, on purpose.

## Where a token can look

A token belongs to your Organization, and is either **organization-wide** or **bound to one
Space** — you choose when you create it. A Space-bound token behaves as if the rest of the
organization does not exist: anything outside its Space reads as not found, not as forbidden.
The same is true across organizations — a resource that is not yours is indistinguishable from a
resource that does not exist.

## What a token can do

Each scope names one area and one direction, and a token holds exactly the scopes you tick at
creation:

| Scope | Grants |
|---|---|
| `org:read` | The Organization's profile, its Spaces, and their platforms. |
| `backups:read` | Backup runs, configuration, retention, and status. |
| `schema:read` | The captured structure — bases, tables, fields — and schema search. |
| `data:read` | The captured records and attachments, including search over both. |
| `documents:read` / `documents:write` | Reading, and creating or editing, the Space's documents. |
| `views:read` / `views:write` | Reading, and creating or editing, saved Data views. |
| `reports:read` / `reports:write` | Reading, and managing, report definitions. |

Two rules make the table predictable. A **write scope never implies its read scope** — a token
meant to both read and edit documents holds both `documents:read` and `documents:write`, stated
outright. And a request whose token lacks the one scope an endpoint requires receives `403` naming
that scope — the only case where the API says "this exists, but not for this token".

Write scopes let an integration modify your Space's content, so they start unticked in the
creation form. Grant them to integrations you trust, on tokens you can point at.

## How an error reads

Every error, from any endpoint, is the same shape:

```json
{
  "error": {
    "type": "invalid_request",
    "code": "table_locked",
    "message": "A saved view's table is locked — duplicate the view to use another table.",
    "param": "tableId",
    "requestId": "..."
  }
}
```

`type` is one of six coarse categories (`invalid_request`, `unauthorized`, `forbidden`,
`not_found`, `rate_limited`, `internal`) and tracks the HTTP status; `code` is the specific,
stable reason; `param` appears only when one field is at fault. `requestId` also arrives on every
successful response, as the `X-Request-Id` header — quote it when you write to support, and the
request can be found.

## Versions

Every path starts with `/v1/`. A version is a stable contract: fields are added to responses
without notice, but nothing within `v1` is removed or renamed. Ignore fields you do not recognise
and version changes will never surprise you.
