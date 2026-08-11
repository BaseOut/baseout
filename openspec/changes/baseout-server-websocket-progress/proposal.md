## Why

The dashboard needs DO-emitted progress events to stream backup progress in real time; this is the server side of the WebSocket contract that pairs with `baseout-web-websocket-progress`. Source-of-truth: PRD §6, §13.

## What Changes

DO-emitted progress events; locks contract with `baseout-web-websocket-progress`.

## Depends on

- [baseout-server-durable-objects](../baseout-server-durable-objects/)
