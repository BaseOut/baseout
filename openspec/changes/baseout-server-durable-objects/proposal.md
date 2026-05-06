## Why

The PoC `ConnectionDO` and `SpaceDO` stubs need real rate-limit, lock, state-machine, and scheduler implementations to operate per-Connection and per-Space concurrency safely. Source-of-truth: PRD §7.4, §15; Features §11.

## What Changes

Real `ConnectionDO` (rate-limit gateway, lock manager) + `SpaceDO` (state machine, scheduler) replacing the PoC stubs.

## Depends on

- [airtable-client](../airtable-client/)
