---
title: How Baseout is organized
description: Organization, Space, Source, Destination and Base, the containers everything else sits inside.
sources:
  - apps/web/src/db/schema/core.ts
  - apps/web/src/views/SourcesView.astro
  - apps/web/src/views/DestinationsView.astro
---

Four containers, nested. An *Organization* is the top-level customer entity, and billing lives
there. An Organization holds one or more *Spaces*. A Space is bound to exactly one platform and is
where a backup is configured, with its own scope, schedule, destination and settings. A Space reads
through a *Source* and writes to a *Destination*. Everything below that belongs to the platform.

## What the platform changes, and what it does not

Getting into Baseout and running your account work the same way whoever you back up. Everything
past that is relative to a platform. It is worth knowing which half of the documentation you are
in, because it tells you whether an answer you found applies to you.

| The same on every platform | Different on every platform |
| --- | --- |
| Signing in, and the whole account | Authorizing a Source |
| Plans, billing and invoices | What a backup can and cannot capture |
| Spaces, schedules and retention | The nouns for what you are protecting |
| Destinations and where files land | What restoring writes, and where |
| Notifications, the Inbox and run history | Which limits the platform imposes on a run |

Pages in the right-hand column carry a chip under their title naming the platform they are about,
and the filter above the navigation hides the ones that are not yours. Nothing in the left-hand
column is ever hidden by that filter: it is true of everybody, so it stays.

## The vocabulary changes with the platform

Baseout's own words stay the same whichever platform a Space is bound to. The words for the things
inside it do not, so the product uses your platform's nouns rather than translating them:

| Platform | What you pick | What that holds | One row | One column |
|---|---|---|---|---|
| **Airtable** | Bases | Tables | Records | Fields |
| **ClickUp** | Spaces | Lists | Tasks | Custom Fields |
| **Notion** | Teamspaces | Databases | Pages | Properties |

That is the short version. ClickUp puts Folders between a Space and its Lists, and a Notion page
carries a body as well as properties. See [What we back up in
ClickUp](/platforms/clickup/what-we-back-up/) and [What we back up in
Notion](/platforms/notion/what-we-back-up/).

:::caution
**ClickUp calls one of its own levels a Space, and so does Baseout.** They are not the same object.
A Baseout Space is a backup configuration; a ClickUp Space is a container inside a ClickUp
Workspace.
:::

## Why Space and not Workspace

Airtable already uses Workspace for a container of its own, and one Baseout Space can hold bases
drawn from several Airtable workspaces, so reusing the word would be ambiguous the moment anyone had
more than one. See [Connecting Airtable](/platforms/airtable/connecting/).

## Sources and Destinations belong to the account

A Source is the connection Baseout reads through. A Destination is the storage it writes to.
Both belong to your account rather than to a single Space, so you set one up once and reuse it
wherever you need it.

A Space uses exactly one Source, and one file Destination with an optional database beside it. Two
Spaces can share a Source, and they can share a Destination: each Space writes into its own folder
or schema underneath it, so nothing collides. Status and reconnect live on the connection itself, so
fixing it once fixes every Space that uses it.

## When you want a second Space

A Space is bound to one platform, so a second platform means a second Space. Past that, a Space is
the unit that carries a scope and a schedule, so a second one is what you reach for when one set of
bases needs a different cadence, a different depth, or a different Destination from another.

## Next steps

- [Glossary](/reference/glossary/): every settled term in one table
- [Sources](/connections/sources/): what a Source can see, and how it is authorized
- [Destinations](/connections/destinations/): where backups are written
