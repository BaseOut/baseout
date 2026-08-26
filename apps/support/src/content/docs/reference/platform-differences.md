---
title: Platform differences at a glance
description: The facts that differ between Airtable, ClickUp and Notion, in one table each, with a link to the page that explains why.
---

Every page with a platform chip answers one question for one platform. This page puts the three
answers side by side, for when the question you have is comparative: which of these will be slower,
which loses more in a restore, which one needs the most setting up.

It carries no platform chip of its own, so the filter never hides it.

## Vocabulary

| | Airtable | ClickUp | Notion |
| --- | --- | --- | --- |
| What you pick | Base | Space | Teamspace |
| What that holds | Table | List | Database |
| One row | Record | Task | Page |
| One column | Field | Custom Field | Property |

ClickUp calls one of its own levels a Space, and so does Baseout. They are not the same object: a
Baseout Space is a backup configuration. See
[How Baseout is organized](/start/how-baseout-is-organized/).

## Authorization

| | Airtable | ClickUp | Notion |
| --- | --- | --- | --- |
| Methods | OAuth, personal access token | OAuth, personal API token | Internal connection, public connection |
| Granted over | Named bases or a workspace | A whole Workspace | Nothing, until each page is shared |
| Narrowed by | Scopes on the token | The person's role | Capabilities, then sharing |
| Survives the person leaving | A token on a shared account does | A token on a shared account does | An internal connection does |

See [What an Airtable connection can see](/platforms/airtable/permissions/),
[What a ClickUp connection can see](/platforms/clickup/permissions/) and
[What a Notion connection can see](/platforms/notion/permissions/).

## Pace

| | Airtable | ClickUp | Notion |
| --- | --- | --- | --- |
| Metered per | Base | Token | Connection, and again per workspace |
| Ceiling | 5 requests a second | 100 a minute, to 10,000 on Enterprise | About 3 a second |
| Also capped | 50 a second per token owner | By the Workspace's plan | By the workspace's plan |
| The slow case | One very large base | A large Workspace on a lower plan | A deep page tree |

See [How long an Airtable backup takes](/platforms/airtable/limits-and-timing/),
[How long a ClickUp backup takes](/platforms/clickup/limits-and-timing/) and
[How long a Notion backup takes](/platforms/notion/limits-and-timing/).

## Files

| | Airtable | ClickUp | Notion |
| --- | --- | --- | --- |
| URL lifetime | 2 hours | Fetched from the task | 1 hour, Notion-hosted files |
| Attached-on date | Not reported | Reported | Reported |
| Held in | An attachment field | The task, and File Custom Fields | `files` properties and file blocks |

See [Attachments in Airtable](/platforms/airtable/attachments/),
[Attachments in ClickUp](/platforms/clickup/attachments/) and
[Files in Notion](/platforms/notion/attachments/).

## Identifiers

| | Airtable | ClickUp | Notion |
| --- | --- | --- | --- |
| Shape | Three-letter prefix and 14 characters | Numeric containers, short alphanumeric tasks | UUID |
| A second, readable id | No | Custom task ids, if enabled | `unique_id`, per data source |
| Restored rows keep them | No | No | No |

See [Airtable record ids](/platforms/airtable/identifiers/),
[ClickUp task ids](/platforms/clickup/identifiers/) and
[Notion page ids](/platforms/notion/identifiers/).

## Deletion

| | Airtable | ClickUp | Notion |
| --- | --- | --- | --- |
| Deleted rows | Absent from the API | Absent from the API | Flagged as in the trash, still addressable by id |
| Archived rows | No such state | Hidden unless asked for | No such state |
| Listing what was deleted | Not possible | Not possible | Only through a search that is not guaranteed complete |

See [Deleted records in Airtable](/platforms/airtable/deleted-items/),
[Archived and deleted items in ClickUp](/platforms/clickup/deleted-items/) and
[Deleted pages in Notion](/platforms/notion/deleted-items/).

## What a restore cannot rebuild

| | Airtable | ClickUp | Notion |
| --- | --- | --- | --- |
| Structure the API will not create | Some field types | Statuses, Custom Field definitions | Nothing beyond unsupported blocks |
| Comments | Not recreated | Recreated without author or date | Replies only, into threads that exist |
| The hard case | Links to tables not restored | Voting fields, which cannot be set | Inline mentions, which keep the old id |

See [A restore left gaps](/troubleshooting/restore-left-gaps/).

## Next steps

- [Glossary](/reference/glossary/): the settled terms
- [What Baseout cannot capture](/troubleshooting/what-baseout-cannot-capture/): the honest limits
