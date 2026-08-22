---
title: Status reference
description: Every status badge in Baseout, in one place.
---

## Connection status

Applies to both Sources and Destinations.

| Status | What it means |
|---|---|
| **Connected** | Authorization is current. Backups can run. |
| **Refreshing** | A token refresh is in flight. Transient. |
| **Reconnect required** | The token expired and refresh failed. Needs you. Backups are paused. |
| **Disconnected** | The connection is broken. Backups will not run until you reconnect. |

## Backup run status

| Status | What it means |
|---|---|
| **Queued** | Accepted, not started. |
| **Running** | In progress. |
| **Paused** | Started, then paused. Can be restarted. |
| **Succeeded** | Finished. Note that a succeeded run can still have skipped individual attachments. |
| **Failed** | Did not finish. Carries a reason. |
| **Cancelled** | Stopped by a person. |
| **Trial run** | A pre-payment run. |

## Health band

| Band | Score |
|---|---|
| **Healthy** | 90–100 |
| **Could improve** | 60–89 |
| **Needs attention** | Below 60 |

## Comment status

| Status | What it means |
|---|---|
| **Active** | The comment and its record both still exist. |
| **Deleted** | The comment was deleted; the record still exists. |
| **Record deleted** | The record the comment sat on is gone. |

## Not complete

Missing: the report delivery statuses, and the destination "Needs connection" state which appears in
the specification but is not in the status list above because its exact label is unconfirmed.
