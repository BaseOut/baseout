// markdown → Plate conversion (api-documents-tools D3). Agents send markdown;
// the broker stores Plate JSON. DELIBERATELY conservative: emits only nodes the
// web DocBodyEditor renders natively (paragraph blocks + bold/italic marks —
// its only plugins are Bold/Italic/Underline). Headings become bold paragraphs;
// list items keep their marker as text; inline code backticks are stripped.
// Fidelity grows if/when the editor grows plugins — extend here in lockstep.

export interface PlateText {
  text: string;
  bold?: true;
  italic?: true;
}

export interface PlateParagraph {
  type: "p";
  children: PlateText[];
}

const EMPTY_DOC: PlateParagraph[] = [{ type: "p", children: [{ text: "" }] }];

/** Inline pass: **bold**, *italic*, _italic_ → marks; `code` → bare text. */
function parseInline(raw: string): PlateText[] {
  const text = raw.replace(/`([^`]*)`/g, "$1");
  const children: PlateText[] = [];
  // Alternation order matters: ** before *.
  const marker = /\*\*(.+?)\*\*|\*([^*]+)\*|_([^_]+)_/g;
  let last = 0;
  for (let m = marker.exec(text); m; m = marker.exec(text)) {
    if (m.index > last) children.push({ text: text.slice(last, m.index) });
    if (m[1] !== undefined) children.push({ text: m[1], bold: true });
    else children.push({ text: (m[2] ?? m[3])!, italic: true });
    last = m.index + m[0].length;
  }
  if (last < text.length) children.push({ text: text.slice(last) });
  return children.length ? children : [{ text: "" }];
}

/** One markdown block (already blank-line split) → one or more paragraphs. */
function parseBlock(block: string): PlateParagraph[] {
  const lines = block.split("\n").map((l) => l.trim()).filter((l) => l.length);
  // A block of list items → one paragraph per item, marker kept as text.
  if (lines.length && lines.every((l) => /^(-\s|\d+\.\s)/.test(l))) {
    return lines.map((l) => ({ type: "p" as const, children: parseInlinePreservingMarker(l) }));
  }
  const joined = lines.join(" ");
  const heading = joined.match(/^#{1,6}\s+(.*)$/);
  if (heading) {
    return [{ type: "p", children: [{ text: heading[1]!.trim(), bold: true }] }];
  }
  return [{ type: "p", children: parseInline(joined) }];
}

/** List items: keep the `- ` / `1. ` marker literal, run inline parsing after it. */
function parseInlinePreservingMarker(line: string): PlateText[] {
  const m = line.match(/^(-\s|\d+\.\s)(.*)$/)!;
  const rest = parseInline(m[2]!);
  const [first, ...others] = rest;
  if (first && first.bold === undefined && first.italic === undefined) {
    return [{ ...first, text: `${m[1]}${first.text}` }, ...others];
  }
  return [{ text: m[1]! }, ...rest];
}

/** Convert a markdown string to a Plate document (array of paragraph nodes). */
export function markdownToPlate(markdown: string): PlateParagraph[] {
  const blocks = markdown
    .replace(/\r\n/g, "\n")
    .split(/\n\s*\n/)
    .map((b) => b.trim())
    .filter((b) => b.length);
  if (!blocks.length) return structuredClone(EMPTY_DOC);
  return blocks.flatMap(parseBlock);
}
