## ADDED Requirements

### Requirement: In-run download of the pending set

The `backup-base` task SHALL, for each comments-sync response, hand the returned pending set to the attachment downloader within the same run, interleaved with the remaining capture work (not deferred to end of run). Each pending entry SHALL be processed with the comment-scoped registry contract: lookup with `source:'comment'` (a hit short-circuits the download), download on miss, write via the active storage writer, then record with `source:'comment'` and an `uploadStatus` reflecting the writer's `storageType` (`ready` for `local_fs`, `uploaded` for managed R2 or a BYOS provider).

#### Scenario: Pending entry downloaded and recorded

- **WHEN** a comments-sync response includes a pending entry whose comment-scoped lookup misses
- **THEN** the task SHALL download the URL, write the bytes via the active storage writer, and record the entry with `source:'comment'` and the status matching the destination

#### Scenario: Lookup hit skips the download

- **WHEN** a pending entry's comment-scoped lookup returns a hit
- **THEN** the task SHALL NOT download or re-write the bytes

### Requirement: Comment-attachment storage layout

Comment-attachment bytes SHALL be written under `attachments/comments/<commentId>/<filename>` within the base's backup output, for every storage destination. Filename collisions within one comment SHALL be disambiguated with the attachment id, per the field-attachment writer convention.

#### Scenario: Output path

- **WHEN** an attachment on comment `com123` named `invoice.pdf` is downloaded
- **THEN** it SHALL be written to `attachments/comments/com123/invoice.pdf` under the base output root

### Requirement: Best-effort failure isolation

A comment-attachment download failure (including an expired URL) SHALL leave that item unrecorded — its registry row remains `pending` for the server-side comments-plan recovery — and SHALL NOT fail the comment step or the backup run. The step's progress detail SHALL report comment-attachment counts as `{downloaded, skipped, failed}`.

#### Scenario: Expired URL mid-run

- **WHEN** a pending entry's URL returns 4xx at download time
- **THEN** the item SHALL be counted as `failed`, no record call SHALL be made for it, and the run SHALL continue unaffected

### Requirement: Shared concurrency budget with comment priority

Comment-attachment downloads SHALL execute within the existing attachment download concurrency pool and per-base rate budget — no separate pool — and SHALL be prioritized ahead of queued field-attachment backlog, since their URLs age toward expiry.

#### Scenario: Saturated attachment stage

- **WHEN** pending comment entries arrive while field-attachment downloads are queued
- **THEN** the comment entries SHALL be scheduled ahead of the remaining field backlog within the same pool

### Requirement: Gating rides commentsEnabled

Comment-attachment capture SHALL run only when the task payload's `commentsEnabled` flag is set — the same flag that gates comment capture. No separate capability flag exists.

#### Scenario: Flag off

- **WHEN** `commentsEnabled` is false for the run
- **THEN** no comment-attachment lookups, downloads, or record calls SHALL occur
