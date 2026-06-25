// Pure logic for the Schema Docs feature (openspec/changes/shared-schema-docs).
//
// Mirrors the schema-diff / record-diff split: the testable decisions live in a
// pure module (documents-logic.ts); the Drizzle CRUD over a SpaceTx
// (documents.ts) is thin I/O smoke-tested against a real per-Space schema (the
// engine test pool hosts no Postgres — same posture as applySchemaDiff).
//
// Two pure functions:
//   - deriveExcerpt(body): flatten a Plate document body to a plain-text snippet
//     for the Docs list / search. The engine derives it server-side so the
//     client never owns the snippet.
//   - flagRemovedTags(tags, activeKeys): compute the read-time `entityRemoved`
//     flag — a tag whose entity is absent/removed is retained but flagged.

import { describe, it, expect } from "vitest";
import {
  deriveExcerpt,
  flagRemovedTags,
  entityKey,
} from "../../../src/lib/per-space/documents-logic";

describe("deriveExcerpt", () => {
  it("returns '' for null / non-array / empty body", () => {
    expect(deriveExcerpt(null)).toBe("");
    expect(deriveExcerpt(undefined)).toBe("");
    expect(deriveExcerpt({})).toBe("");
    expect(deriveExcerpt([])).toBe("");
  });

  it("flattens text nodes within a block", () => {
    const body = [{ type: "p", children: [{ text: "Hello" }, { text: " world" }] }];
    expect(deriveExcerpt(body)).toBe("Hello world");
  });

  it("recurses into nested inline elements (e.g. links, @-tags)", () => {
    const body = [
      {
        type: "p",
        children: [
          { type: "a", url: "x", children: [{ text: "link" }] },
          { text: " end" },
        ],
      },
    ];
    expect(deriveExcerpt(body)).toBe("link end");
  });

  it("joins multiple blocks with a single space and trims/collapses whitespace", () => {
    const body = [
      { type: "h1", children: [{ text: "Title" }] },
      { type: "p", children: [{ text: "  Body   text " }] },
    ];
    expect(deriveExcerpt(body)).toBe("Title Body text");
  });

  it("truncates past maxLen and appends an ellipsis", () => {
    const body = [{ type: "p", children: [{ text: "Hello world" }] }];
    expect(deriveExcerpt(body, 5)).toBe("Hello…");
  });

  it("does not append an ellipsis when within maxLen", () => {
    const body = [{ type: "p", children: [{ text: "Hi" }] }];
    expect(deriveExcerpt(body, 5)).toBe("Hi");
  });
});

describe("entityKey", () => {
  it("composes a stable type:id key", () => {
    expect(entityKey("field", "fld1")).toBe("field:fld1");
  });
});

describe("flagRemovedTags", () => {
  const tags = [
    { documentId: "d1", targetType: "field", targetId: "fld1" },
    { documentId: "d1", targetType: "table", targetId: "tblGONE" },
  ];

  it("flags a tag whose entity is absent from the active set", () => {
    const active = new Set([entityKey("field", "fld1")]);
    const out = flagRemovedTags(tags, active);
    expect(out.find((t) => t.targetId === "fld1")!.entityRemoved).toBe(false);
    expect(out.find((t) => t.targetId === "tblGONE")!.entityRemoved).toBe(true);
  });

  it("preserves the original tag fields and never drops a tag", () => {
    const out = flagRemovedTags(tags, new Set());
    expect(out).toHaveLength(2);
    expect(out.every((t) => t.entityRemoved === true)).toBe(true);
    expect(out[0]).toMatchObject({ documentId: "d1", targetType: "field", targetId: "fld1" });
  });
});
