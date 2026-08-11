## Why

Airtable OAuth tokens need pre-emptive refresh on a 15-min cadence with a dead-connection 4-touch escalation so backups don't fail mid-run. Source-of-truth: PRD §17.4, §20.2; Features §14.2.

## What Changes

15-min cadence, dead-connection 4-touch flow.

## Depends on

- [airtable-client](../airtable-client/)
