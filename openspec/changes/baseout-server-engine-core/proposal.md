## Why

The backup engine needs a single-source job runner, R2 streaming layout, run lifecycle, attachment dedup, and trial caps — currently scattered across the archived `baseout-backup` umbrella. Source-of-truth: PRD §7, §8, §13; Features §6, §11.

## What Changes

Trigger.dev backup job, R2 stream, file path layout, run lifecycle, attachment dedup, trial caps.

## Depends on

- [airtable-client](../airtable-client/)
- [baseout-server-durable-objects](../baseout-server-durable-objects/)
