---
title: Glossary
description: The words Baseout uses, and what they mean.
---

The terms below are taken from the project's own naming specification. This is the subset that is
settled; it is not the whole vocabulary yet.

| Term | Means |
|---|---|
| **Organization** | The top-level customer entity. Billing lives here. |
| **Space** | A container inside an Organization, bound to exactly one platform. Has its own backups, destination and settings. |
| **Platform** | A supported source system. Airtable in V1. |
| **Source** | A connection between your account and a platform — for Airtable, OAuth or a personal access token. |
| **Destination** | Where backup files are written. File storage is required; a database is optional. |
| **Base** | An Airtable base visible through a Source. |
| **Table** / **Field** / **Record** / **View** | Airtable's own terms, used unchanged. |
| **Attachment** | A file on an attachment-type field. |
| **Automation** / **Interface** | Airtable's own terms. Neither can be exported by Airtable's API. |
| **Backup run** | One execution of the backup process. An immutable log entry. |
| **Snapshot** | The output of a backup run — what you restore from. |
| **Restore** | Writing a snapshot back into Airtable. Always into new tables, never over the original. |
| **Health score** | A per-base 0–100 grade over schema cleanliness, data quality and configuration. |
| **Changelog** | A time-ordered diff between backups — one for schema, one for data. |
| **Preset** | A saved base + table + filter + field selection on the Data section. |

## Why "Space" and not "Workspace"

Airtable already uses "Workspace" for its own concept. Using the same word for ours would be
ambiguous the moment someone has several Airtable workspaces inside one Baseout Space.

## Not complete

Terms deliberately left out because their meaning is not settled: the plan and tier names, the
credit and usage vocabulary, and the backup-mode names (static, dynamic, instant) which appear in
the specifications but not in any shipped screen.
