---
title: Status reference
description: Every status badge in Baseout, what it means, and what you can do about it.
sources:
  - apps/web/src/lib/connection-health.ts
  - apps/web/src/stores/backup-runs.ts
  - apps/web/src/db/schema/core.ts
  - apps/server/src/lib/per-space/comments-read.ts
---

Every status Baseout shows you is in one of the four tables below, with the action it asks of you.
If a run says `failed` or a connection says `reconnect required`, start here.

Statuses are written as `code` throughout the documentation because they are values Baseout stores
and shows back to you, not buttons you press.

## Connection status

Applies to both Sources and Destinations. A Source or Destination that loses access stops backups
for every Space that uses it, so these four are the ones worth watching.

| Status | What it means | What you can do |
|---|---|---|
| <span id="connected"></span>`connected` | Authorization is current. Backups can run. | <ul><li>Nothing. This is the resting state.</li></ul> |
| <span id="refreshing"></span>`refreshing` | A token refresh is in flight. Transient. | <ul><li>Wait. It settles on its own.</li></ul> |
| <span id="needs-connection"></span>`needs connection` | Created but never authorized. | <ul><li>Authorize it from its page under Sources or Destinations.</li></ul> |
| <span id="reconnect-required"></span>`reconnect required` | The credential expired and the refresh failed. Backups are paused. | <ul><li>Reconnect from the connection's own page. One reconnect heals every Space that uses it.</li><li>Take an off-schedule run to cover the time it was down.</li><li>See <a href="/connections/reconnecting/">Reconnecting a broken connection</a>.</li></ul> |
| <span id="disconnected"></span>`disconnected` | The connection is broken outright. Backups will not run until you reconnect. | <ul><li>The same reconnect. The two states differ in how they arrived, not in what they ask of you.</li></ul> |

:::note
The status is the last conversation Baseout had with the platform, not a live reading. No platform
offers an endpoint answering "is this still valid", so a connection can be broken for a while
before it says so.
:::

## Backup run status

One badge per run, in the Space's backup history and on the run itself. A second badge beside it
carries the *kind* — `full` or `schema` — which is not a status.

| Status | What it means | What you can do |
|---|---|---|
| <span id="queued"></span>`queued` | Accepted, not started. | <ul><li>Wait. Count columns show a dash until there is something to count.</li></ul> |
| <span id="running"></span>`running` | In progress. The header shows an estimated time remaining. | <ul><li>Pause it, or cancel it. Both act only while it is still going, and both are gated by role.</li></ul> |
| <span id="paused"></span>`paused` | Started, then paused by someone. | <ul><li>Restart it. A restart resumes from where it stopped rather than starting over.</li></ul> |
| <span id="succeeded"></span>`succeeded` | Finished. | <ul><li>Check the run for a failed-attachment banner — a run can succeed and still have skipped individual files.</li><li><strong>Retry failed</strong> re-fetches only those files into the same run.</li></ul> |
| <span id="failed"></span>`failed` | Did not finish. Carries a reason. | <ul><li>Open the run: it names which base failed and the error.</li><li>Read the counts of the bases that finished first — they still wrote their data.</li><li>See <a href="/troubleshooting/backup-failed/">My backup failed</a>.</li></ul> |
| <span id="cancelled"></span>`cancelled` | Stopped by a person. Keeps whatever it had already written. | <ul><li>Start a new run. A cancelled run cannot be resumed.</li></ul> |
| <span id="trial-run"></span>`trial run` | A pre-payment run, taken during onboarding. | <ul><li>Nothing. It is a real run against your own data and it stays in the history.</li></ul> |

:::note
No run can be deleted, at any status. The backup history is an audit trail, and a log that can be
pruned is not evidence of anything. Backed-up *data* is thinned by
[the cleanup schedule](/backups/retention-and-cleanup/), which is a separate mechanism.
:::

## Health band

Each base is graded 0–100 and lands in one of three bands.

| Band | Score | What you can do |
|---|---|---|
| <span id="healthy"></span>`healthy` | 90–100 | <ul><li>Nothing.</li></ul> |
| <span id="could-improve"></span>`could improve` | 60–89 | <ul><li>Open the base's Health tab, which lists the specific issues behind the score.</li></ul> |
| <span id="needs-attention"></span>`needs attention` | Below 60 | <ul><li>The same list, read first. See <a href="/schema/changelog-and-health/">Schema changelog and Health</a>.</li></ul> |

## Comment status

Carried by every comment in the Comments tab.

| Status | What it means | What you can do |
|---|---|---|
| <span id="active"></span>`active` | The comment and its record both still exist. | <ul><li>Open the record it sits on.</li></ul> |
| <span id="deleted"></span>`deleted` | The comment was deleted; the record still exists. | <ul><li>Read it here. Baseout captured it before it went.</li></ul> |
| <span id="record-deleted"></span>`record deleted` | The record the comment sat on is gone. | <ul><li>Read the comment here; there is no record left to open.</li></ul> |

## Not complete

Two sets of statuses are missing from this page: the report delivery statuses, and any status the
Health tab shows under its own Green / Yellow / Red naming, which does not match the three band
names above. Both need the exact labels confirmed before they are written down.
