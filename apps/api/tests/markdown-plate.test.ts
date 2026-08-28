// markdown→Plate conversion (api-documents-tools D3). Deliberately conservative:
// emits ONLY nodes the web DocBodyEditor renders (paragraphs + bold/italic/
// underline marks); headings become bold paragraphs; list prefixes stay text.
import { describe, expect, it } from "vitest";
import { markdownToPlate } from "../src/lib/markdown-plate";

describe("markdownToPlate", () => {
  it("empty / whitespace input → single empty paragraph (editor's EMPTY_VALUE shape)", () => {
    expect(markdownToPlate("")).toEqual([{ type: "p", children: [{ text: "" }] }]);
    expect(markdownToPlate("  \n \n")).toEqual([{ type: "p", children: [{ text: "" }] }]);
  });

  it("blank-line-separated blocks become paragraphs", () => {
    expect(markdownToPlate("first para\n\nsecond para")).toEqual([
      { type: "p", children: [{ text: "first para" }] },
      { type: "p", children: [{ text: "second para" }] },
    ]);
  });

  it("single newlines inside a block collapse to spaces", () => {
    expect(markdownToPlate("line one\nline two")).toEqual([
      { type: "p", children: [{ text: "line one line two" }] },
    ]);
  });

  it("**bold** and *italic* / _italic_ become marks", () => {
    expect(markdownToPlate("plain **bold** and *ital* and _also_")).toEqual([
      {
        type: "p",
        children: [
          { text: "plain " },
          { text: "bold", bold: true },
          { text: " and " },
          { text: "ital", italic: true },
          { text: " and " },
          { text: "also", italic: true },
        ],
      },
    ]);
  });

  it("headings become bold paragraphs (the editor has no heading plugin)", () => {
    expect(markdownToPlate("# Title\n\nbody")).toEqual([
      { type: "p", children: [{ text: "Title", bold: true }] },
      { type: "p", children: [{ text: "body" }] },
    ]);
    expect(markdownToPlate("### Sub")).toEqual([{ type: "p", children: [{ text: "Sub", bold: true }] }]);
  });

  it("list items each become their own paragraph, keeping the marker as text", () => {
    expect(markdownToPlate("- one\n- two\n\n1. first\n2. second")).toEqual([
      { type: "p", children: [{ text: "- one" }] },
      { type: "p", children: [{ text: "- two" }] },
      { type: "p", children: [{ text: "1. first" }] },
      { type: "p", children: [{ text: "2. second" }] },
    ]);
  });

  it("unterminated markers stay literal text (no crash, no dangling mark)", () => {
    expect(markdownToPlate("a **broken bold")).toEqual([
      { type: "p", children: [{ text: "a **broken bold" }] },
    ]);
  });

  it("inline `code` backticks are stripped to plain text (no code plugin)", () => {
    expect(markdownToPlate("run `pnpm dev` now")).toEqual([
      { type: "p", children: [{ text: "run pnpm dev now" }] },
    ]);
  });
});
