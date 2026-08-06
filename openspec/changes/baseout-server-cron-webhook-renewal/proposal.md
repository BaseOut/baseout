## Why

Airtable webhook subscriptions expire on a 7-day TTL — daily renewal at the 6-day threshold and a 3-strike disable workflow keep them alive without paging on transient errors. Source-of-truth: PRD §17; Features §11.

## What Changes

Daily renewal at 6-day threshold, 3-strike disable.

## Depends on

- [airtable-client](../airtable-client/)
