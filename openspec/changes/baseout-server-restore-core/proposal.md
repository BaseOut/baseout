## Why

Restoring a backup into a destination Airtable base needs a start endpoint, deterministic write order, and post-write verification. Source-of-truth: PRD §9; Features §6.4.

## What Changes

`POST /restores/{id}/start`, write order, post-restore verification.

## Depends on

- [airtable-client](../airtable-client/)
- [baseout-server-engine-core](../baseout-server-engine-core/)
- [baseout-server-durable-objects](../baseout-server-durable-objects/)
