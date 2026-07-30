/*
 * Storybook content model — the single source of truth for /styleguide.
 *
 * Each entry documents one foundation or primitive. The `examples[].html` string
 * is rendered live (set:html) AND shown verbatim as copy-paste code, so the
 * preview can never drift from the documented markup. Classes used here are
 * real daisyUI / Tailwind classes from the Baseout theme; this file lives under
 * apps/design/src so Tailwind's auto content-scan emits every class it names.
 *
 * Foundations describe the *knobs* (the actual CSS tokens), so the system is a
 * control surface, not just a showcase: change the token, the whole UI follows.
 */

export type SBExample = { label?: string; html: string };

// A decision row: which option, when to reach for it, and why.
export type SBGuideRow = { token: string; use: string; why?: string };
// A "When to use" table. `default` highlights the option you reach for unless
// there's a reason not to; `note` carries the headline rule (e.g. the 90% case).
export type SBGuide = { title: string; note?: string; default?: string; rows: SBGuideRow[] };
// A component prop / API row (the Storybook "Controls / ArgTypes" analog).
// Sourced from the real component interface in apps/web so the catalog documents
// the actual options an author (or an agent) can reach for.
export type SBProp = { name: string; type: string; default?: string; description: string };

export type SBEntry = {
  id: string;
  group: 'Overview' | 'Foundations' | 'Primitives' | 'Patterns';
  name: string;
  summary: string; // one line under the title
  description?: string; // longer prose (supports inline HTML via set:html)
  reference?: string; // the apps/web source that wraps this primitive
  showCode?: boolean; // default true; false for foundations (no copy-paste snippet)
  guides?: SBGuide[]; // the decision rules — when to use which variant / size, and why
  props?: SBProp[]; // the component API — every option it accepts
  usageDo?: string[];
  usageDont?: string[];
  examples: SBExample[];
};

export const SB_GROUPS: SBEntry['group'][] = ['Overview', 'Foundations', 'Primitives', 'Patterns'];

export const SB_ENTRIES: SBEntry[] = [
  // ──────────────────────────────── Overview ─────────────────────────────────
  {
    id: 'overview',
    group: 'Overview',
    name: 'Overview',
    summary: 'How this catalog is organized — and how to build from it.',
    description: `<p>The Baseout component catalog: the single source of truth for how the UI is built. Pick any entry on the left to see the live component, the rules for using it, its props, and copy-paste markup.</p>
<p><strong>How it’s organized</strong></p>
<ul>
<li><strong>Foundations</strong> — the tokens everything is built from (color, type, spacing, radius, elevation). These are the knobs: change a token and the whole UI follows.</li>
<li><strong>Primitives</strong> — the standard building blocks (buttons, inputs, badges, tables…). Build new screens from these, not hand-rolled CSS.</li>
<li><strong>Patterns</strong> — product-specific compositions (the Home rail, the backup pipeline, audit tables). These stay bespoke; reuse the primitives inside them.</li>
</ul>
<p><strong>How to read an entry</strong></p>
<ul>
<li><strong>When to use</strong> — which variant or size to reach for, and why. The highlighted row is the default.</li>
<li><strong>Props</strong> — every option the component accepts (its API).</li>
<li><strong>Examples</strong> — the live component above its exact copy-paste markup. What you see is what ships.</li>
</ul>
<p><strong>Building a new screen (person or agent):</strong> compose from Primitives, follow each entry’s “When to use” default, and pull color / spacing / radius from Foundations. The non-negotiables: one primary button per surface · <strong><code>btn-sm</code> is the default size</strong> — and <code>input-sm</code> / <code>select-sm</code> / <code>toggle-sm</code> with it — with unsized md reserved for the ONE standing call-to-action in a page header (see Button → Choosing a size; measured from Schema / Data / Reports, not assumed) · every badge is <strong>soft + semantic</strong> (status, plus Required = error / Recommended = primary / Managed = success) — <strong>never <code>badge-outline</code></strong>, and a standalone status badge gets a leading dot · any user hint is a <strong>soft <code>alert</code> with a leading icon</strong>, not a bare tinted line · a Clear/reset is a <strong>red ghost + ×</strong> shown only when there’s something to clear · real third-party services use their <strong>real logo</strong> · a concept uses <strong>one icon everywhere</strong> · linked-and-healthy connectors are a <strong>green line + check</strong> (the Home pipeline language) · numbers are <code>font-mono</code> + tabular · 12px is the smallest text. If something isn’t a primitive here, it’s a Pattern — keep it bespoke.</p>
<p><strong>Tags:</strong> each component is tagged by provenance — <strong>daisyUI</strong> (a standard component, used as-is), <strong>daisyUI + custom</strong> (daisyUI primitives composed into our own layout / logic), <strong>Custom</strong> (fully ours, no daisyUI core).</p>`,
    showCode: false,
    examples: [],
  },

  // ─────────────────────────────── Foundations ───────────────────────────────
  {
    id: 'colors',
    group: 'Foundations',
    name: 'Colors',
    summary: 'The Arctic Console palette — achromatic chrome, one luminous accent.',
    description:
      'All UI chrome is grayscale; the only chromatic voice is the primary (arctic cyan on dark, twilight blue on light). Status colors exist strictly for state, never decoration. Tokens are daisyUI <code>--color-*</code> variables defined in <code>styles/themes/baseout.css</code> — the same swatches re-resolve per theme, so toggle light/dark to see both.',
    showCode: false,
    usageDo: [
      'Use the primary only for interactive elements — buttons, links, focus, active state.',
      'Use status colors only to signal state (success / warning / error).',
      'Reach for tokens (bg-primary, text-base-content) — never raw hex in components.',
    ],
    usageDont: [
      "Don't use the primary as decoration or on a surface where it fails contrast.",
      "Don't introduce a second brand color — the palette is single-accent on purpose.",
    ],
    examples: [
      {
        label: 'Brand & surfaces',
        html: `
<div class="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
  <div>
    <div class="h-14 rounded-box border border-base-300 bg-primary"></div>
    <div class="mt-1.5 text-sm text-base-content">Primary</div>
    <div class="font-mono text-xs text-base-content/55">--color-primary</div>
  </div>
  <div>
    <div class="h-14 rounded-box border border-base-300 bg-secondary"></div>
    <div class="mt-1.5 text-sm text-base-content">Secondary</div>
    <div class="font-mono text-xs text-base-content/55">--color-secondary</div>
  </div>
  <div>
    <div class="h-14 rounded-box border border-base-300 bg-accent"></div>
    <div class="mt-1.5 text-sm text-base-content">Accent</div>
    <div class="font-mono text-xs text-base-content/55">--color-accent</div>
  </div>
  <div>
    <div class="h-14 rounded-box border border-base-300 bg-neutral"></div>
    <div class="mt-1.5 text-sm text-base-content">Neutral</div>
    <div class="font-mono text-xs text-base-content/55">--color-neutral</div>
  </div>
  <div>
    <div class="h-14 rounded-box border border-base-300 bg-base-100"></div>
    <div class="mt-1.5 text-sm text-base-content">Base 100</div>
    <div class="font-mono text-xs text-base-content/55">surface</div>
  </div>
  <div>
    <div class="h-14 rounded-box border border-base-300 bg-base-200"></div>
    <div class="mt-1.5 text-sm text-base-content">Base 200</div>
    <div class="font-mono text-xs text-base-content/55">sunken</div>
  </div>
  <div>
    <div class="h-14 rounded-box border border-base-300 bg-base-300"></div>
    <div class="mt-1.5 text-sm text-base-content">Base 300</div>
    <div class="font-mono text-xs text-base-content/55">border</div>
  </div>
  <div>
    <div class="h-14 rounded-box border border-base-300 bg-base-content"></div>
    <div class="mt-1.5 text-sm text-base-content">Base content</div>
    <div class="font-mono text-xs text-base-content/55">text</div>
  </div>
</div>`,
      },
      {
        label: 'Status',
        html: `
<div class="grid grid-cols-2 gap-3 sm:grid-cols-4">
  <div>
    <div class="h-14 rounded-box border border-base-300 bg-success"></div>
    <div class="mt-1.5 text-sm text-base-content">Success</div>
    <div class="font-mono text-xs text-base-content/55">--color-success</div>
  </div>
  <div>
    <div class="h-14 rounded-box border border-base-300 bg-warning"></div>
    <div class="mt-1.5 text-sm text-base-content">Warning</div>
    <div class="font-mono text-xs text-base-content/55">--color-warning</div>
  </div>
  <div>
    <div class="h-14 rounded-box border border-base-300 bg-error"></div>
    <div class="mt-1.5 text-sm text-base-content">Error</div>
    <div class="font-mono text-xs text-base-content/55">--color-error</div>
  </div>
  <div>
    <div class="h-14 rounded-box border border-base-300 bg-info"></div>
    <div class="mt-1.5 text-sm text-base-content">Info</div>
    <div class="font-mono text-xs text-base-content/55">--color-info</div>
  </div>
</div>`,
      },
    ],
  },
  {
    id: 'typography',
    group: 'Foundations',
    name: 'Typography',
    summary: 'Urbanist for everything human, JetBrains Mono for everything machine.',
    description:
      'One sans family (Urbanist) carries the whole interface — hierarchy comes from size and weight, not from mixing fonts. Mono (JetBrains Mono via <code>font-mono</code>) is reserved for machine-readable data. Font tokens live in <code>--font-sans</code> / <code>--font-mono</code>.',
    showCode: false,
    guides: [
      {
        title: 'Choosing a role',
        default: 'Body · 16 / 400',
        note: 'Body 16 is the reading default. In dense tables and metadata we drop to 14 or 13 — never below the 12px floor. Display (64) appears at most once per page and mostly on brand or marketing surfaces, rarely in-app.',
        rows: [
          {
            token: 'Body · 16 / 400',
            use: 'Default reading text — descriptions, paragraphs, form values.',
            why: 'Comfortable for sustained reading; keep line length 65–75ch.',
          },
          {
            token: 'Label · 14 / 500 · caps',
            use: 'Category and section headers above a group; table column headers.',
            why: 'Uppercase + tracking says "this labels a group", distinct from content.',
          },
          {
            token: 'Subtitle · 22 / 600',
            use: 'Card, widget and dialog titles.',
            why: 'Enough step above body to anchor a block without competing with the page title.',
          },
          {
            token: 'Title · 32 / 600',
            use: 'Page and major section headings.',
            why: 'The top of the in-app hierarchy — one focal heading per view.',
          },
          {
            token: 'Caption · 13–14 / 400',
            use: 'Timestamps, helper text, secondary metadata.',
            why: 'Supporting info that should recede; still at or above the 12px floor.',
          },
          {
            token: 'Mono · 14 / 400',
            use: 'IDs, hashes, durations, and counts in data columns.',
            why: 'The mono boundary — machine-readable data only, never human text.',
          },
        ],
      },
    ],
    usageDo: [
      'Drive hierarchy with size + weight, not color.',
      'Use font-mono for IDs, hashes, durations, timestamps, counts in data columns.',
      'Keep body line length at 65–75 characters.',
    ],
    usageDont: [
      "Don't use mono for human-written text (names, labels, descriptions).",
      "Don't go below 12px — that is the floor for the smallest UI text.",
    ],
    examples: [
      {
        html: `
<div class="text-base-content">
  <div class="flex items-baseline justify-between gap-6 border-b border-base-300 py-3">
    <span style="font-size:40px;line-height:1.1;font-weight:700;letter-spacing:-0.02em">Backup intelligence</span>
    <span class="shrink-0 font-mono text-xs text-base-content/55">Display · 64 / 700</span>
  </div>
  <div class="flex items-baseline justify-between gap-6 border-b border-base-300 py-3">
    <span style="font-size:32px;line-height:1.25;font-weight:600">Every base, accounted for</span>
    <span class="shrink-0 font-mono text-xs text-base-content/55">Title · 32 / 600</span>
  </div>
  <div class="flex items-baseline justify-between gap-6 border-b border-base-300 py-3">
    <span style="font-size:22px;line-height:1.4;font-weight:600">Backup run detail</span>
    <span class="shrink-0 font-mono text-xs text-base-content/55">Subtitle · 22 / 600</span>
  </div>
  <div class="flex items-baseline justify-between gap-6 border-b border-base-300 py-3">
    <span style="font-size:16px;line-height:1.65;font-weight:400">Standard reading text for descriptions and longer copy.</span>
    <span class="shrink-0 font-mono text-xs text-base-content/55">Body · 16 / 400</span>
  </div>
  <div class="flex items-baseline justify-between gap-6 border-b border-base-300 py-3">
    <span style="font-size:14px;font-weight:500;letter-spacing:0.05em;text-transform:uppercase">Section label</span>
    <span class="shrink-0 font-mono text-xs text-base-content/55">Label · 14 / 500 · caps</span>
  </div>
  <div class="flex items-baseline justify-between gap-6 py-3">
    <span class="font-mono" style="font-size:14px">rec_8f2a1c · 420,318 · 2m 14s</span>
    <span class="shrink-0 font-mono text-xs text-base-content/55">Mono · 14 / 400</span>
  </div>
</div>`,
      },
    ],
  },
  {
    id: 'text-color-weight',
    group: 'Foundations',
    name: 'Text: color & weight',
    summary: 'The reading hierarchy — carried by how dark and how heavy text is, never by hue.',
    description:
      'Two levers build the text hierarchy: <strong>color</strong> (an opacity step on <code>base-content</code>, not different hues) and <strong>weight</strong>. Keep text neutral; a semantic color is only for words that <em>are</em> a state. Tune these and the whole UI’s legibility and emphasis shift together.',
    showCode: false,
    guides: [
      {
        title: 'Text color — when to use which',
        default: 'Primary · text-base-content',
        note: 'Text is base-content stepped down by opacity, not recoloured. Reach for a status color only to signal state, and for the primary (accent) only for interactive text.',
        rows: [
          { token: 'Primary · text-base-content', use: 'Main content — values, headings, body you must read.', why: 'Full contrast; this is where the eye lands.' },
          { token: 'Secondary · text-base-content/70', use: 'Supporting copy — descriptions, the caption next to a value.', why: 'Present but clearly subordinate to primary.' },
          { token: 'Muted · text-base-content/55', use: 'Metadata — table headers, timestamps, placeholders, hints.', why: 'Recedes to the background; stays ≥ AA at ≥12px.' },
          { token: 'Status · text-success / warning / error', use: 'Words that ARE a state — “Failed”, “Backed up”, an error line.', why: 'Here colour is meaning, not decoration; pair with a label/icon.' },
          { token: 'Action · text-primary', use: 'Inline links and clickable text.', why: 'The single chromatic accent reads as “interactive”.' },
        ],
      },
      {
        title: 'Font weight — when to use which',
        default: 'Regular · 400',
        note: 'Weight reinforces hierarchy alongside size. Body is 400; labels and small UI text step to 500 so they hold up small; headings and the one value a block is about use 600. Avoid 700 for in-app text.',
        rows: [
          { token: 'Regular · 400', use: 'Body and reading text.', why: 'Comfortable for sustained reading; the baseline.' },
          { token: 'Medium · 500', use: 'Labels, nav, table headers, buttons, small UI text.', why: 'Holds legibility at small sizes where 400 looks thin.' },
          { token: 'Semibold · 600', use: 'Headings, card titles, the single key value of a block.', why: 'Anchors a block — one focal weight per surface.' },
        ],
      },
    ],
    examples: [
      {
        label: 'Color ladder',
        html: `
<div class="text-base-content">
  <div class="flex items-baseline justify-between gap-6 border-b border-base-300 py-2.5">
    <span class="text-base-content">Primary — every base accounted for</span>
    <span class="shrink-0 font-mono text-xs text-base-content/55">text-base-content</span>
  </div>
  <div class="flex items-baseline justify-between gap-6 border-b border-base-300 py-2.5">
    <span class="text-base-content/70">Secondary — runs daily at 02:00 UTC</span>
    <span class="shrink-0 font-mono text-xs text-base-content/55">/70</span>
  </div>
  <div class="flex items-baseline justify-between gap-6 border-b border-base-300 py-2.5">
    <span class="text-base-content/55">Muted — last checked 2 minutes ago</span>
    <span class="shrink-0 font-mono text-xs text-base-content/55">/55</span>
  </div>
  <div class="flex items-baseline justify-between gap-6 border-b border-base-300 py-2.5">
    <span class="flex gap-3"><span class="text-success">Backed up</span><span class="text-error">Failed</span></span>
    <span class="shrink-0 font-mono text-xs text-base-content/55">text-success / text-error</span>
  </div>
  <div class="flex items-baseline justify-between gap-6 py-2.5">
    <span class="text-primary">View run details</span>
    <span class="shrink-0 font-mono text-xs text-base-content/55">text-primary</span>
  </div>
</div>`,
      },
      {
        label: 'Weight ladder',
        html: `
<div class="text-base-content">
  <div class="flex items-baseline justify-between gap-6 border-b border-base-300 py-2.5">
    <span style="font-weight:400">Regular — standard reading text</span>
    <span class="shrink-0 font-mono text-xs text-base-content/55">400</span>
  </div>
  <div class="flex items-baseline justify-between gap-6 border-b border-base-300 py-2.5">
    <span style="font-weight:500">Medium — labels, nav, small UI text</span>
    <span class="shrink-0 font-mono text-xs text-base-content/55">500</span>
  </div>
  <div class="flex items-baseline justify-between gap-6 py-2.5">
    <span style="font-weight:600">Semibold — headings &amp; key values</span>
    <span class="shrink-0 font-mono text-xs text-base-content/55">600</span>
  </div>
</div>`,
      },
    ],
  },
  {
    id: 'spacing',
    group: 'Foundations',
    name: 'Spacing',
    summary: 'A 4px grid — the rhythm everything snaps to.',
    description:
      'Spacing is Tailwind’s default 4px scale (<code>--spacing: 0.25rem</code>) — which is also daisyUI’s native scale, so snapping to it aligns WITH the framework. Every padding, gap and margin is a multiple of 4 (4·8·12·16·20·24·28·32·40·48). Prefer Tailwind utilities (<code>p-*</code> / <code>gap-*</code> / <code>m-*</code>); <strong>bespoke component CSS rounds to the same grid</strong>. Only 1–2px is allowed off-grid, and only for borders / hairlines / optical nudges — never for spacing. Enforced by <code>ds-lint</code> (rule <code>spacing-grid</code>): an off-grid padding/margin/gap px value fails the gate.',
    showCode: false,
    usageDo: [
      'Snap every gap and pad to the scale (4 / 8 / 12 / 16 / 20 / 24 / 32 / 48).',
      'Use larger steps (24–48) to separate sections, smaller (4–8) to group.',
      'In bespoke CSS too: round padding/margin/gap to a multiple of 4 (ds-lint enforces it).',
    ],
    usageDont: [
      "Don't hand-pick 6 / 7 / 9 / 10 / 14 / 18 / 30px — those break the grid (1–2px is fine for a border only).",
    ],
    examples: [
      {
        html: `
<div class="text-base-content">
  <div class="flex items-center gap-4 py-1"><code class="w-14 shrink-0 font-mono text-xs text-base-content/70">4px</code><code class="w-28 shrink-0 font-mono text-xs text-base-content/45">p-1 / gap-1</code><div class="h-4 rounded-sm bg-primary" style="width:4px"></div></div>
  <div class="flex items-center gap-4 py-1"><code class="w-14 shrink-0 font-mono text-xs text-base-content/70">8px</code><code class="w-28 shrink-0 font-mono text-xs text-base-content/45">p-2 / gap-2</code><div class="h-4 rounded-sm bg-primary" style="width:8px"></div></div>
  <div class="flex items-center gap-4 py-1"><code class="w-14 shrink-0 font-mono text-xs text-base-content/70">12px</code><code class="w-28 shrink-0 font-mono text-xs text-base-content/45">p-3 / gap-3</code><div class="h-4 rounded-sm bg-primary" style="width:12px"></div></div>
  <div class="flex items-center gap-4 py-1"><code class="w-14 shrink-0 font-mono text-xs text-base-content/70">16px</code><code class="w-28 shrink-0 font-mono text-xs text-base-content/45">p-4 / gap-4</code><div class="h-4 rounded-sm bg-primary" style="width:16px"></div></div>
  <div class="flex items-center gap-4 py-1"><code class="w-14 shrink-0 font-mono text-xs text-base-content/70">24px</code><code class="w-28 shrink-0 font-mono text-xs text-base-content/45">p-6 / gap-6</code><div class="h-4 rounded-sm bg-primary" style="width:24px"></div></div>
  <div class="flex items-center gap-4 py-1"><code class="w-14 shrink-0 font-mono text-xs text-base-content/70">32px</code><code class="w-28 shrink-0 font-mono text-xs text-base-content/45">p-8 / gap-8</code><div class="h-4 rounded-sm bg-primary" style="width:32px"></div></div>
  <div class="flex items-center gap-4 py-1"><code class="w-14 shrink-0 font-mono text-xs text-base-content/70">48px</code><code class="w-28 shrink-0 font-mono text-xs text-base-content/45">p-12 / gap-12</code><div class="h-4 rounded-sm bg-primary" style="width:48px"></div></div>
</div>`,
      },
    ],
  },
  {
    id: 'radius',
    group: 'Foundations',
    name: 'Radius & corners',
    summary: 'Three daisyUI knobs, all 6px today — change them once, the whole UI re-rounds.',
    description:
      'Corner rounding is driven by three tokens in <code>styles/themes/baseout.css</code>: <code>--radius-field</code> (buttons, inputs, selects), <code>--radius-box</code> (cards, modals, containers) and <code>--radius-selector</code> (checkboxes, toggles, badges). All three are <code>0.375rem</code> (6px) right now. This is the single lever to make the product softer or sharper — edit the tokens, every component follows. Use <code>rounded-full</code> for true pills (avatars, status dots).',
    showCode: false,
    usageDo: [
      'Adjust the three radius tokens together for a consistent feel.',
      'Use rounded-field / rounded-box / rounded-selector so components track the tokens.',
    ],
    usageDont: [
      "Don't hardcode arbitrary border-radius on individual components — it desyncs from the system.",
    ],
    examples: [
      {
        html: `
<div class="flex flex-wrap gap-7 text-base-content">
  <div class="text-center">
    <div class="size-20 rounded-field border border-base-300 bg-base-100"></div>
    <div class="mt-2 text-sm">Field</div>
    <code class="font-mono text-xs text-base-content/55">--radius-field · 6px</code>
    <div class="text-xs text-base-content/45">button · input · select</div>
  </div>
  <div class="text-center">
    <div class="size-20 rounded-box border border-base-300 bg-base-100"></div>
    <div class="mt-2 text-sm">Box</div>
    <code class="font-mono text-xs text-base-content/55">--radius-box · 6px</code>
    <div class="text-xs text-base-content/45">card · modal · container</div>
  </div>
  <div class="text-center">
    <div class="size-20 rounded-selector border border-base-300 bg-base-100"></div>
    <div class="mt-2 text-sm">Selector</div>
    <code class="font-mono text-xs text-base-content/55">--radius-selector · 6px</code>
    <div class="text-xs text-base-content/45">checkbox · toggle · badge</div>
  </div>
  <div class="text-center">
    <div class="size-20 rounded-full border border-base-300 bg-base-100"></div>
    <div class="mt-2 text-sm">Pill</div>
    <code class="font-mono text-xs text-base-content/55">rounded-full</code>
    <div class="text-xs text-base-content/45">avatar · dot · tag</div>
  </div>
</div>`,
      },
    ],
  },
  {
    id: 'elevation',
    group: 'Foundations',
    name: 'Elevation',
    summary: 'Border-first depth; shadows only float and modal.',
    description:
      'On near-black surfaces a drop shadow is invisible, so depth comes from a 1px border plus a step in surface color (base-100 → base-200 → base-300). Shadows are reserved for things that genuinely lift off the page — popovers, dropdowns, dialogs — via Tailwind’s <code>shadow-md</code> / <code>shadow-xl</code>.',
    showCode: false,
    usageDo: [
      'Use a border + surface step for resting cards and containers.',
      'Reserve shadow-md for floating (popovers, dropdowns) and shadow-xl for modals.',
    ],
    usageDont: [
      "Don't drop shadows on flat resting surfaces — it reads as noise on dark.",
    ],
    examples: [
      {
        html: `
<div class="flex flex-wrap gap-5 text-base-content">
  <div class="grid size-28 place-items-center rounded-box border border-base-300 bg-base-100 text-center text-xs text-base-content/65">Flat<br>border only</div>
  <div class="grid size-28 place-items-center rounded-box border border-base-300 bg-base-100 text-center text-xs text-base-content/65 shadow-md">Floating<br>shadow-md</div>
  <div class="grid size-28 place-items-center rounded-box border border-base-300 bg-base-100 text-center text-xs text-base-content/65 shadow-xl">Modal<br>shadow-xl</div>
</div>`,
      },
    ],
  },

  // ─────────────────────────────── Primitives ────────────────────────────────
  {
    id: 'button',
    group: 'Primitives',
    name: 'Button',
    summary: 'daisyUI btn — the standard action primitive across the app.',
    description:
      'Every clickable action uses <code>btn</code> plus a variant. One primary per visible surface; everything else is subordinate. Destructive actions use <code>btn-error</code> and always confirm via a modal.',
    reference: 'components/ui/Button.astro',
    props: [
      { name: 'variant', type: "'primary' | 'secondary' | 'ghost' | 'danger' | 'success' | 'warning'", default: "'primary'", description: 'Emphasis level — see the table. secondary = soft blue (btn-soft btn-primary); tonal is an alias of secondary; outline is deprecated.' },
      { name: 'size', type: "'sm' | 'md' | 'lg'", default: "'md'", description: 'md (default) is the workhorse; sm for dense areas, lg for heroes.' },
      { name: 'icon', type: 'boolean', default: 'false', description: 'Square icon-only button (needs an aria-label).' },
      { name: 'loading', type: 'boolean', default: 'false', description: 'Shows a spinner and disables the button.' },
      { name: 'disabled', type: 'boolean', default: 'false', description: 'Non-interactive, reduced opacity.' },
      { name: 'href', type: 'string', default: '—', description: 'Renders as a link (a) instead of a button.' },
    ],
    guides: [
      {
        title: 'Choosing emphasis',
        note: 'Spend exactly one primary per visible surface — it points at the single thing the user came to do. Everything else steps down: secondary is a <strong>soft blue fill (btn-soft btn-primary)</strong>, tertiary is ghost (no fill). The soft tint reads as a real, related action without the weight of a second solid fill, and it stays subordinate to the one solid primary. Outline is deprecated — reach for the soft Secondary instead; it survives only as a quieter destructive (btn-outline btn-error). Watch dense toolbars: many soft secondaries in one row can get loud — keep genuinely low-stakes / repeated actions ghost so the soft fill still means "supporting action", not "everything".',
        rows: [
          {
            token: 'Primary · btn-primary',
            use: 'The one main action of the surface — Run backup now, Save, Connect, Continue.',
            why: 'A single cyan fill is the unmistakable focal point. A second primary collapses the hierarchy.',
          },
          {
            token: 'Secondary · btn-soft btn-primary',
            use: 'A supporting action next to the primary — Detach, Settings, Cancel, Back, filter triggers.',
            why: 'A soft blue fill with blue text: clearly a related action, but it yields to the one solid primary. Softer and more on-brand than the old gray fill, without competing for the focal point.',
          },
          {
            token: 'Tertiary · btn-ghost',
            use: 'Low-stakes or repeated actions — toolbars, table-row actions, dismiss, menu items.',
            why: 'No fill or border, so many can sit together without competing for attention.',
          },
          {
            token: 'Destructive · btn-error',
            use: 'Irreversible actions — Delete, Disconnect, Overwrite.',
            why: 'Red signals stop-and-think; always pair it with a confirm modal.',
          },
        ],
      },
      {
        title: 'Choosing a size',
        default: 'Default · btn-sm (32px / 12px)',
        note: '<strong>Small is the default. Reach for <code>btn-sm</code> unless you can name the reason not to.</strong> This rule was rewritten 2026-07-28 to match the surfaces Oleh actually approved rather than the theory that preceded them: a census of Schema, Data and Reports — every view and component — found <strong>165 <code>btn-sm</code> against 2 unsized <code>btn</code></strong>, and those two are the single page-header CTA on Schema and its twin on Data. Every other control tells the same story there (input 35 sm / 4 md, select 18 / 0, checkbox 8 / 0, radio 19 / 5, toggle 14 / 4). The old text here claimed md was "the size for ~90% of the interface"; the app it describes does not exist, and agents kept building oversized surfaces by following it. Density is the house style — Linear / Vercel / Plaid — and this is a utility admin tool, not a marketing page. <strong>md is the exception:</strong> the ONE standing call-to-action in a page header, and nothing else by default. If you want md somewhere new, that is a design decision to raise, not a default to assume.',
        rows: [
          {
            token: 'Small · btn-sm (32px / 12px)',
            use: 'The default — toolbars, filter chips, table row actions, panel and drawer footers, form submits, empty-state actions, wizard nav, icon-only buttons. If you are not sure, this is the answer.',
            why: 'daisyUI’s native compact size, and what every surface we are happy with actually uses. Density is the point: an admin tool is scanned and operated, not read. (We do not restyle sm’s font — overriding daisyUI’s .btn-sm does not survive the Tailwind v4 / Lightning CSS build.)',
          },
          {
            token: 'Default · btn (40px / 14px)',
            use: 'The single standing call-to-action in a page header (Schema’s and Data’s header CTA are the only two in the app). Not for form submits, not for drawer footers, not for wizard nav — those are sm.',
            why: 'One md button per page reads as THE action for that page. Used more widely it stops signalling anything and simply makes the surface feel bigger than the rest of the product.',
          },
          {
            token: 'Large · btn-lg (48px / 18px)',
            use: 'A hero CTA — empty-state or onboarding, where one action defines the screen.',
            why: 'Reserve the extra weight for the exception; oversized buttons elsewhere read as marketing.',
          },
        ],
      },
    ],
    usageDo: [
      'Keep exactly one btn-primary per visible surface.',
      'Give primary and secondary actions a leading icon that names the action — it makes the button self-explanatory (play = Run, plus = New, settings = Configure).',
      'Pair an icon with a label; give icon-only buttons an aria-label.',
      'Show a loading spinner and disable the button during async work.',
    ],
    usageDont: [
      "Don't stack two primary buttons competing for attention.",
      "Don't ship a destructive button without a confirm step.",
    ],
    examples: [
      {
        label: 'Variants',
        html: `
<div class="flex flex-wrap items-center gap-3">
  <button class="btn btn-primary">Primary</button>
  <button class="btn btn-soft btn-primary">Secondary</button>
  <button class="btn btn-ghost">Tertiary</button>
  <button class="btn btn-error">Danger</button>
</div>`,
      },
      {
        label: 'Sizes',
        html: `
<div class="flex flex-wrap items-center gap-3">
  <button class="btn btn-primary btn-sm">Small</button>
  <button class="btn btn-primary">Default</button>
  <button class="btn btn-primary btn-lg">Large</button>
</div>`,
      },
      {
        label: 'States',
        html: `
<div class="flex flex-wrap items-center gap-3">
  <button class="btn btn-primary">
    <span class="loading loading-spinner loading-sm"></span>
    Saving
  </button>
  <button class="btn btn-primary" disabled>Disabled</button>
</div>`,
      },
      {
        label: 'With icon',
        html: `
<div class="flex flex-wrap items-center gap-3">
  <button class="btn btn-primary">
    <span class="iconify lucide--plus size-4"></span>
    New backup
  </button>
  <button class="btn btn-ghost btn-square" aria-label="Refresh">
    <span class="iconify lucide--rotate-cw size-4"></span>
  </button>
</div>`,
      },
    ],
  },
  {
    id: 'location-crumbs',
    group: 'Primitives',
    name: 'Location crumbs',
    summary: 'The one breadcrumb for a Schema detail-drawer header — the entity’s location (Base ▸ Table ▸ …).',
    description:
      'The single breadcrumb element for every detail-drawer header. It renders an entity’s LOCATION trail — <code>Base ▸ Table ▸ Field</code> / <code>Base ▸ parent-interface</code> — as a muted row of segments: each a <strong>concept icon + name</strong>, joined by a <code>›</code> separator; ancestor segments are clickable <code>&lt;button&gt;</code>s (they open that entity), the <strong>current (last) segment is muted + non-clickable</strong>. It replaces the four bespoke breadcrumbs that had drifted apart (<code>.ep-crumb</code>, <code>.rl-crumb</code>, <code>.cl-crumb</code>, the Drawer crumb). Markup comes from ONE builder (<code>locationCrumbs()</code>) and the CSS from ONE source (<code>styles/global.css</code>, <code>.sb-crumb*</code>). It lives as <strong>Row 2 of the fixed header</strong> (under the title rail), shown only where the entity has a location. Live: <a href="/schema">Schema</a> (every detail drawer).',
    reference: 'components/schema/locationCrumbs.ts (markup) + styles/global.css (.sb-crumb*)',
    usageDo: [
      'Use locationCrumbs() for EVERY drawer breadcrumb — never hand-roll a crumb trail.',
      'Put it as Row 2 of the fixed header (under the title rail), above the border; omit the row entirely when the entity has no location.',
      'Ancestor segments are clickable (pass the existing open hook via openAttrs); the current/last segment is muted and non-clickable.',
    ],
    usageDont: [
      "Don't render the crumbs as a separate row outside the header, or below the identity meta — location is always Row 2 of the header.",
      "Don't build a bespoke breadcrumb in a component's own CSS.",
    ],
    examples: [
      {
        label: 'Base ▸ Table ▸ Field (current muted)',
        html: `<nav class="sb-crumb-row" aria-label="Breadcrumb"><button type="button" class="sb-crumb sb-crumb-link"><span class="sb-crumb-ic"><span class="iconify lucide--database"></span></span><span class="sb-crumb-name">Sales CRM</span></button><span class="iconify lucide--chevron-right size-3 sb-crumb-sep"></span><button type="button" class="sb-crumb sb-crumb-link"><span class="sb-crumb-ic"><span class="iconify lucide--table-2"></span></span><span class="sb-crumb-name">Deals</span></button><span class="iconify lucide--chevron-right size-3 sb-crumb-sep"></span><span class="sb-crumb"><span class="sb-crumb-ic"><span class="iconify lucide--sigma"></span></span><span class="sb-crumb-name">Amount</span></span></nav>`,
      },
    ],
  },
  {
    id: 'entity-chip',
    group: 'Primitives',
    name: 'Entity chip',
    summary: 'The one soft pill for an inline reference to a schema entity (table / field / doc / chat).',
    description:
      'A small soft pill that references a schema entity: a leading <strong>type icon</strong> + <strong>name</strong> + optional <strong>muted context</strong> (e.g. "· Deals"). It is the ONE element for every inline entity reference — Automations/Interfaces <em>Touches</em>, Relationships <em>Connects</em> / <em>Linked fields</em> / <em>referenced-by</em>, and the Docs / Chat / Insights entity refs — replacing the per-surface hand-rolled pills (<code>.rl-dchip</code>, <code>.au-chip</code>, <code>.if-chip</code>, <code>.chat-chip</code>, <code>.doc-chip</code>, <code>.ins-chip</code>) that had drifted apart on size, radius and colour. <strong>Neutral by default</strong> (soft <code>base-200</code> fill + <code>1px base-300</code> border, rounded-full, 13px) — the concept icon carries the type, so no per-type colour. Because chips render at runtime via <code>innerHTML</code>, the markup comes from ONE builder (<code>entityChip()</code>) and the CSS from ONE source (<code>styles/global.css</code>, <code>.sb-chip*</code>). <strong>Variants:</strong> <em>clickable</em> (a <code>&lt;button&gt;</code> that opens the entity), <em>static</em> (a <code>&lt;span&gt;</code>), <em>removable</em> (a trailing × — for a manual tag), <em>derived</em> (a quieter/muted pill — an engine-derived tag, never removable; used in the edit form only, read views show plain chips). <strong>Not Schema-only (Oleh 2026-07-23):</strong> this is the chip for <em>any</em> inline entity reference, so the <a href="#pattern-inbox">Inbox</a> uses it for the Space a notification belongs to. A Space is an entity, not a status — a <a href="#badge">Badge</a> was the wrong element there, and being a different SHAPE from a button (rounded-full, bordered, 13px) is what stops it reading as the row\'s action. Live: <a href="/schema">Schema</a> (Relationships / Automations / Interfaces / Docs / Chat), <a href="/">Inbox</a>.',
    reference: 'components/schema/entityChip.ts (markup) + styles/global.css (.sb-chip*)',
    usageDo: [
      'Use entityChip() for EVERY inline reference to a schema entity — never hand-roll a chip pill.',
      'Clickable chip = opens the entity (pass the existing data-* open hook via `attrs`); static chip = a plain span.',
      'Manual tags = the removable variant (× via `remove`); engine/auto-derived tags = the `derived` variant (a quieter muted pill, no ×) — used only in the edit form, read views show plain chips. Never a dashed border.',
      'Keep it neutral — the leading type icon signals the kind; do not re-introduce per-type or per-source colours.',
      'A chip standing for a FIELD may carry that field\'s Airtable type glyph (<code>AIRTABLE_FIELD_ICONS</code> via <code>airtableIconKey()</code>) as its icon, falling back to the generic kind glyph when the type is unknown — the same mark Browse, Search and the filters already use, so one field reads identically everywhere. It is a sharper icon, not a second chip: never fork a builder to get it, and never tint by type.',
    ],
    usageDont: [
      "Don't hand-roll a bordered pill in a component's own CSS — that is exactly the drift this element removes.",
      "Don't nest the × inside a clickable chip button (button-in-button); a removable chip is a span.",
      "Don't drop below the 12px sizing floor or use a bespoke radius (it is rounded-full, 13px).",
    ],
    examples: [
      {
        label: 'Clickable (opens the entity) · with muted context',
        html: `<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
  <button type="button" class="sb-chip sb-chip-btn"><span class="sb-chip-ic"><span class="iconify lucide--table-2"></span></span><span class="sb-chip-name">Deals</span></button>
  <button type="button" class="sb-chip sb-chip-btn"><span class="sb-chip-ic"><span class="iconify lucide--sigma"></span></span><span class="sb-chip-name">Amount</span><span class="sb-chip-ctx">· Deals</span></button>
</div>`,
      },
      {
        label: 'Removable (manual tag) · derived (engine/auto tag)',
        html: `<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
  <span class="sb-chip sb-chip-static sb-chip-removable"><span class="sb-chip-ic"><span class="iconify lucide--table-2"></span></span><span class="sb-chip-name">Company</span><button type="button" class="sb-chip-x" aria-label="Remove"><span class="iconify lucide--x size-3"></span></button></span>
  <span class="sb-chip sb-chip-static sb-chip-derived"><span class="sb-chip-ic"><span class="iconify lucide--table-2"></span></span><span class="sb-chip-name">Contacts</span></span>
</div>`,
      },
    ],
  },
  {
    id: 'badge',
    group: 'Primitives',
    name: 'Badge / Status',
    summary: 'daisyUI badge — soft tint + colored text for state, the app-wide status pill.',
    description:
      'Status reads as a tinted pill: a soft background at low opacity with full-color text (<code>badge-soft badge-{state}</code>), optionally with a leading dot (a small <code>bg-current</code> span we compose inside the badge so it inherits the badge’s colour — daisyUI’s standalone dot is the <a href="#status-dot">Status</a> component). Solid badges are for counts and emphasis, not status. This is the pattern every view should converge on instead of hand-rolled pills.',
    reference: 'components/ui/Badge.astro',
    props: [
      { name: 'variant', type: "'default' | 'primary' | 'secondary' | 'tertiary' | 'success' | 'warning' | 'error' | '*-solid'", default: "'default'", description: 'Soft tint by default; the -solid variants fill.' },
      { name: 'size', type: "'sm' | 'md' | 'lg'", default: "'md'", description: 'Pill height.' },
      { name: 'outline', type: 'boolean', default: 'false', description: 'Outlined instead of filled / soft.' },
      { name: 'dot', type: 'boolean', default: 'false', description: 'Leading status dot.' },
    ],
    guides: [
      {
        title: 'Choosing a badge',
        default: 'Soft + status · badge-soft badge-{state}',
        note: 'Status is almost always a soft tint plus a semantic color — it reads calm and stays scannable down a long list. Reach for a solid fill only for numeric counts, and for neutral when a state carries no alarm.',
        rows: [
          {
            token: 'Soft + status · badge-soft badge-{state}',
            use: 'The state of a thing — Backed up (success), Degraded (warning), Failed (error), Running (primary).',
            why: 'Tinted background + colored text signals state without shouting; consistent across every list.',
          },
          {
            token: 'Neutral · badge-ghost',
            use: 'IDLE states that carry neither alarm nor achievement — Paused, Snoozed, Skipped.',
            why: 'No semantic color means no urgency — it reads as "idle", not "wrong".',
          },
          {
            token: 'With dot · + leading dot',
            use: 'When the badge stands alone in a row (a source/destination option, not under a column header).',
            why: 'The dot reinforces the state at a glance where a label alone might be missed. Compose it as a small bg-current span inside the badge.',
          },
          {
            token: 'Meta tag · soft, by meaning',
            use: 'Required = badge-soft badge-error (you must), Recommended = badge-soft badge-primary, Managed = badge-soft badge-success.',
            why: 'Sibling meta tags must all be badges (don’t mix a plain-text label with a badge); colour carries the meaning, red flags necessity.',
          },
          {
            token: 'Solid · badge-{state}',
            use: 'Counts and emphasis only — a tally, a "12 new", never a passive status.',
            why: 'A solid fill pulls too much attention to be a calm status indicator.',
          },
        ],
      },
    ],
    usageDo: [
      'Use badge-soft + a status color for state (Backed up, Failed, Paused).',
      'Colour-code an OUTCOME, and reserve ghost for the genuinely idle (Oleh 2026-07-23). A finished-well state is `badge-soft badge-success` (Inbox Resolved / Done); work that is unsaved and could be LOST is `badge-soft badge-warning` (a Draft preset) — not ghost, because "you may lose this" is not a calm state; merely deferred is ghost (Snoozed). Ask "does this state want something from the user?" — if yes it earns a hue.',
      'Add a leading dot when the badge stands alone in a row without nearby context.',
      'Make sibling meta tags all badges by meaning (Required = error, Recommended = primary, Managed = success).',
      'A status badge may pair with an adjacent link for a recoverable cap/limit state (e.g. warning badge + Upgrade link).',
    ],
    usageDont: [
      "Don't use a solid status-colored fill for state — soft tint + colored text reads calmer.",
      "Don't use badge-outline — we standardise on the soft style everywhere.",
      "Don't pair neutral with soft — `badge-soft badge-neutral` is BANNED (Oleh 2026-07-23, repeatedly). `badge-soft` tints the badge's own colour 8% into base-100, and on the dark theme `--color-neutral` (#2c2c33) over #111 lands at 1.34:1 text and 1.02:1 for the pill itself — the chip is invisible, shape and all. Neutral means `badge-ghost` (17.4:1 in BOTH themes). Soft is for SEMANTIC colours only, where the tint still carries a hue.",
      "Don't roll a custom pill, or mix a plain-text label with a badge for sibling tags.",
    ],
    examples: [
      {
        label: 'Soft (status)',
        html: `
<div class="flex flex-wrap items-center gap-2">
  <span class="badge badge-soft badge-success">Backed up</span>
  <span class="badge badge-soft badge-warning">Degraded</span>
  <span class="badge badge-soft badge-error">Failed</span>
  <span class="badge badge-soft badge-primary">Running</span>
  <span class="badge badge-ghost">Paused</span>
</div>`,
      },
      {
        label: 'With status dot',
        html: `
<div class="flex flex-wrap items-center gap-2">
  <span class="badge badge-soft badge-success">
    <span class="size-1.5 rounded-full bg-current"></span>
    Healthy
  </span>
  <span class="badge badge-soft badge-error">
    <span class="size-1.5 rounded-full bg-current"></span>
    Failed
  </span>
</div>`,
      },
      {
        label: 'Solid — counts & emphasis',
        html: `
<div class="flex flex-wrap items-center gap-2">
  <span class="badge badge-primary">3 new</span>
  <span class="badge badge-success">12</span>
  <span class="badge badge-neutral">v2</span>
</div>`,
      },
      {
        label: 'Sizes (sm · default · lg)',
        html: `
<div class="flex flex-wrap items-center gap-3">
  <span class="badge badge-soft badge-primary badge-sm">Small</span>
  <span class="badge badge-soft badge-primary">Default</span>
  <span class="badge badge-soft badge-primary badge-lg">Large</span>
</div>`,
      },
    ],
  },
  {
    id: 'tooltip',
    group: 'Primitives',
    name: 'Tooltip',
    summary: 'daisyUI tooltip — an instant, on-brand hint for icon-only controls.',
    description:
      'A <code>tooltip</code> wraps a control and shows its <code>data-tip</code> text on hover or focus. Use it to name an icon-only button — never the native <code>title</code> attribute, which waits ~1s, renders unstyled, and ignores the theme (we zero the open-delay in <code>global.css</code> so ours appear instantly). Keep the tip to a few words, and always keep an <code>aria-label</code> on the button — the tip alone is hover-only, unreachable by keyboard, touch, or screen reader.<br><br><strong>Tooltips render in the top layer (2026-07-24).</strong> daisyUI draws the bubble as a CSS pseudo-element on the trigger, so <em>any</em> ancestor with <code>overflow: auto/hidden</code> clips it — and no z-index can escape a clipping box, which is why the same bug kept resurfacing (the toolbar, the locked-scope wrapper, the pin-bar ＋, a tab\'s ✕ inside a scroller) and got patched one site at a time. It is now fixed once: a shared controller (<code>components/ui/tooltip.ts</code>, loaded globally) intercepts every <code>[data-tip]</code> and paints ONE bubble in the browser\'s <strong>top layer</strong> via the Popover API, positioned in JS from the trigger\'s rect. The top layer sits above every stacking context and outside every clipping box by definition, so a tooltip can no longer be cut off or painted under anything. <strong>The call site does not change</strong> — keep writing <code>class="tooltip tooltip-left" data-tip="…"</code>; only where it draws changed, across all ~167 existing usages. daisyUI\'s pseudo-elements are switched off globally so there is never a second bubble. <em>Not</em> CSS anchor positioning: Firefox still lacks it, while the Popover API ships in all three engines.<br><br><strong>A tooltip that repeats a visible label is suppressed (Oleh 2026-07-24).</strong> The rule at the top of this entry — a tooltip <em>names a control that has no visible label</em> — is now enforced, not just written down: if the trigger already shows the same words, no bubble appears. That is what makes the sidebar behave. Expanded, every item renders its label and a hint would merely echo it; collapsed, the label is not drawn, so the tooltip becomes the only thing naming the icon and it appears — <code>tooltip-right</code>, beside the icon rather than above it, which is where the eye already is. No state flag and no sidebar-specific branch: any control anywhere that carries a redundant hint simply stops showing one. A hint that ADDS something — <em>"Open beside · ⌘/Ctrl-click"</em> next to a bare icon — is unaffected. Suppression is an <strong>echo test, not a containment test</strong>: the tip must equal the visible text, or be it followed by the trigger\'s own badge (<em>"Inbox 4"</em>). It was containment at first, which made the behaviour depend on <em>customer data</em> — a button whose tip is <code>Open</code> and whose visible text is an entity name loses its hint the moment someone names a base "Openside CRM", and short tips like Open / Edit / Close / Back are everywhere. <strong>What counts as visible is measured, not read off <code>innerText</code> (Oleh 2026-07-24).</strong> <code>innerText</code> reports visually-hidden text as present, so a label clipped to 1×1 for screen readers still counted as "on screen" — and the three Visualize mode tabs lost their tooltips the moment the a11y fix swapped their <code>display: none</code> label for a clipped one. The two fixes were correct alone and broke each other, because the suppression rule had quietly depended on a hiding TECHNIQUE rather than on visibility. It now walks the trigger\'s own nodes and skips any box of 1px or less, which covers both recipes. <strong>Truncated text is exempt outright:</strong> CSS ellipsis does not shorten the text either, so a value clipped by its column would otherwise have its own tooltip eaten — exactly the case where repeating the label IS the point, so a trigger whose content overflows always keeps its hint.',
    guides: [
      {
        title: 'When to use a tooltip',
        default: 'Icon-only control · tooltip + aria-label',
        note: 'A tooltip names a control that has no visible label. It is a hint, not a home for essential information — anything a user must read belongs on the surface.',
        rows: [
          { token: 'tooltip (top)', use: 'Default. An icon button with room above it.', why: 'Points at the trigger without covering neighbouring rows.' },
          { token: 'tooltip-left', use: 'Against the right edge, or on a row where a top tooltip would cover the row above (e.g. the Schema field-row actions).', why: 'Keeps the hint beside its trigger. It is a layout choice now — since 2026-07-24 the bubble renders in the top layer, so no side gets clipped.' },
          { token: 'tooltip-primary / -success / …', use: 'When the hint reinforces a semantic action (rare).', why: 'Colours the bubble to match; default neutral suits most cases.' },
        ],
      },
    ],
    usageDo: [
      'Wrap the control in a tooltip and set data-tip to a short label.',
      'Keep an aria-label on the button so the action is announced and touch-reachable.',
      'Pick the side that reads best — a tooltip is no longer clipped by a scroll area, so the side is a layout choice, not a workaround.',
    ],
    usageDont: [
      "Don't use the native title attribute — it lags ~1s and ignores the theme.",
      "Don't put essential information in a tooltip (hover-only: no keyboard, no touch).",
      "Don't write a sentence; a tooltip is two to four words.",
    ],
    examples: [
      {
        label: 'Placement (forced open for the catalog)',
        html: `
<div class="flex flex-wrap items-center justify-center gap-12" style="padding: 3rem 4.5rem">
  <div class="tooltip tooltip-open tooltip-top" data-tip="Top"><button class="btn btn-sm">Top</button></div>
  <div class="tooltip tooltip-open tooltip-bottom" data-tip="Bottom"><button class="btn btn-sm">Bottom</button></div>
  <div class="tooltip tooltip-open tooltip-left" data-tip="Left"><button class="btn btn-sm">Left</button></div>
  <div class="tooltip tooltip-open tooltip-right" data-tip="Right"><button class="btn btn-sm">Right</button></div>
</div>`,
      },
      {
        label: 'On icon-only buttons (hover to reveal) — the real use',
        html: `
<div class="flex items-center gap-2" style="padding: 2.75rem 1rem">
  <div class="tooltip tooltip-left" data-tip="Generate description · 10 credits">
    <button class="btn btn-sm btn-ghost btn-square text-primary" aria-label="Generate description"><span class="iconify lucide--sparkles size-4"></span></button>
  </div>
  <div class="tooltip" data-tip="Edit description">
    <button class="btn btn-sm btn-ghost btn-square" aria-label="Edit description"><span class="iconify lucide--pencil size-4"></span></button>
  </div>
  <div class="tooltip" data-tip="Clear description">
    <button class="btn btn-sm btn-ghost btn-square text-error" aria-label="Clear description"><span class="iconify lucide--x size-4"></span></button>
  </div>
</div>`,
      },
      {
        label: 'Colour',
        html: `
<div class="flex flex-wrap items-center justify-center gap-12" style="padding: 3rem 3rem">
  <div class="tooltip tooltip-open" data-tip="Neutral"><button class="btn btn-sm">Default</button></div>
  <div class="tooltip tooltip-open tooltip-primary" data-tip="Primary"><button class="btn btn-sm btn-primary">Primary</button></div>
  <div class="tooltip tooltip-open tooltip-success" data-tip="Success"><button class="btn btn-sm">Success</button></div>
</div>`,
      },
    ],
  },
  {
    id: 'input',
    group: 'Primitives',
    name: 'Input',
    summary: 'daisyUI input — the text field for every form value.',
    description:
      'Inputs are bordered by default in daisyUI v5 (no <code>input-bordered</code> needed). Wrap in a <code>fieldset</code> with a <code>fieldset-legend</code> label and a <code>fieldset-label</code> for helper or error text. For a leading icon, make the control a <code>label.input</code> with the <code>input</code> as <code>.grow</code> inside.',
    reference: 'components/ui/TextInput.astro',
    props: [
      { name: 'label', type: 'string', default: '—', description: 'Visible field label (always provide one).' },
      { name: 'type', type: "'text' | 'email' | 'password' | 'search' | 'tel' | 'url' | 'number'", default: "'text'", description: 'Drives validation and the mobile keyboard.' },
      { name: 'icon / iconRight', type: 'string (lucide name)', default: '—', description: 'Leading / trailing icon inside the field.' },
      { name: 'size', type: "'sm' | 'md' | 'lg'", default: "'md'", description: 'Field height.' },
      { name: 'error', type: 'string', default: '—', description: 'Message; switches the field to the error style.' },
      { name: 'required / disabled / readonly', type: 'boolean', default: 'false', description: 'Standard field states.' },
    ],
    guides: [
      {
        title: 'States & feedback',
        note: 'Always pair an input with a visible label — never placeholder-only. Show a validation error inline below the field, not only at the top of the form.',
        rows: [
          { token: 'Default · input', use: 'The resting field for any value.', why: 'Bordered and neutral; reads as editable.' },
          { token: 'Error · input-error', use: 'A failed validation — put the reason in the fieldset-label below.', why: 'Red border + message points straight at the field to fix.' },
          { token: 'Success · input-success', use: 'Confirmed values where confirmation genuinely matters (rare).', why: 'Use sparingly; most valid fields need no color.' },
          { token: 'Small · input-sm — the default', use: 'Every field unless you can name a reason not to: forms, inline edit, filters, drawers, wizards.', why: 'Pairs with the btn-sm density default. Measured across Schema / Data / Reports: 35 input-sm to 4 unsized.' },
        ],
      },
    ],
    usageDo: [
      'Give every input a visible label.',
      'Use the right type (email, number, url) so mobile shows the right keyboard.',
      'Put helper and error text in a fieldset-label below the field.',
    ],
    usageDont: [
      "Don't rely on the placeholder as the label — it vanishes on input.",
      "Don't surface errors only at the top of the form.",
    ],
    examples: [
      {
        label: 'Default + label',
        html: `
<fieldset class="fieldset max-w-xs">
  <legend class="fieldset-legend">Space name</legend>
  <input type="text" class="input" placeholder="My backup" />
  <p class="fieldset-label">Shown across the app.</p>
</fieldset>`,
      },
      {
        label: 'With leading icon',
        html: `
<label class="input max-w-xs">
  <span class="iconify lucide--search size-4 opacity-50"></span>
  <input type="search" class="grow" placeholder="Search runs" />
</label>`,
      },
      {
        label: 'Error',
        html: `
<fieldset class="fieldset max-w-xs">
  <legend class="fieldset-legend">API key</legend>
  <input type="text" class="input input-error" value="bad-key" />
  <p class="fieldset-label text-error">That key was rejected by Airtable.</p>
</fieldset>`,
      },
      {
        label: 'Sizes',
        html: `
<div class="flex max-w-xs flex-col gap-2">
  <input type="text" class="input input-sm" placeholder="Small" />
  <input type="text" class="input" placeholder="Default" />
</div>`,
      },
    ],
  },
  {
    id: 'select',
    group: 'Primitives',
    name: 'Select',
    summary: 'daisyUI select — one choice from a known list.',
    description:
      'Same <code>fieldset</code> wrapper as Input, bordered by default. A select is for exactly one value from a short, fixed list. For many searchable options use a combobox; for 2–4 mutually exclusive ones consider a segmented control.',
    reference: 'components/ui/Select.astro',
    props: [
      { name: 'options', type: 'Option[]', default: 'required', description: 'The list of choices.' },
      { name: 'label', type: 'string', default: '—', description: 'Visible label.' },
      { name: 'placeholder', type: 'string', default: '—', description: 'Empty first option.' },
      { name: 'icon', type: 'string (lucide name)', default: '—', description: 'Leading icon.' },
      { name: 'size', type: "'sm' | 'md' | 'lg'", default: "'md'", description: 'Control height.' },
      { name: 'error', type: 'string', default: '—', description: 'Message + error style.' },
    ],
    guides: [
      {
        title: 'When to use a select',
        note: 'One choice from a short, known list. If the list is long and needs search, or the options are 2–4 and always visible, a select is the wrong tool.',
        rows: [
          { token: 'Default · select', use: 'One value from a fixed list — frequency, destination type.', why: 'Compact, familiar, native keyboard support.' },
          { token: 'Error · select-error', use: 'A required choice left unmade on submit.', why: 'Matches the input error treatment.' },
          { token: 'Small · select-sm — the default', use: 'Every select unless you can name a reason not to: toolbars, inline controls, forms, drawers.', why: 'Pairs with the btn-sm density default. Measured across Schema / Data / Reports: 18 select-sm to 0 unsized.' },
        ],
      },
    ],
    usageDo: [
      'Pre-select a sensible default when one exists.',
      'Auto-select the only option when the list has exactly one.',
    ],
    usageDont: ["Don't use a select for free text or for many searchable options."],
    examples: [
      {
        label: 'Default',
        html: `
<fieldset class="fieldset max-w-xs">
  <legend class="fieldset-legend">Frequency</legend>
  <select class="select">
    <option>Daily</option>
    <option>Weekly</option>
    <option>Monthly</option>
  </select>
</fieldset>`,
      },
      {
        label: 'Sizes',
        html: `
<div class="flex items-center gap-2">
  <select class="select select-sm"><option>Small</option></select>
  <select class="select"><option>Default</option></select>
</div>`,
      },
    ],
  },
  {
    id: 'checkbox-toggle',
    group: 'Primitives',
    name: 'Checkbox & Toggle',
    summary: 'Two boolean controls — choose by whether the change is immediate.',
    description:
      'A <code>checkbox</code> selects items in a set or opts into something that applies on submit. A <code>toggle</code> flips a setting that takes effect the instant you flip it. Both use the primary color when on.',
    reference: 'components/ui/Checkbox.astro · components/ui/Toggle.astro',
    props: [
      { name: 'label', type: 'string', default: '—', description: 'Both — the control’s label.' },
      { name: 'checked', type: 'boolean', default: 'false', description: 'Both — on / off state.' },
      { name: 'disabled', type: 'boolean', default: 'false', description: 'Both — non-interactive.' },
      { name: 'size', type: "'sm' | 'md' | 'lg'", default: "'md'", description: 'Toggle only — switch size.' },
      { name: 'description', type: 'string', default: '—', description: 'Toggle only — helper line under the label.' },
    ],
    guides: [
      {
        title: 'Checkbox vs toggle',
        note: 'The deciding question: does the change apply now or on save? Immediate effect → toggle. Part of a form, deferred, or multi-select → checkbox.',
        rows: [
          { token: 'Checkbox · checkbox', use: 'Selecting rows (which bases to back up), opting into a form choice.', why: 'Reads as "part of a set / applies on submit".' },
          { token: 'Toggle · toggle', use: 'A setting that takes effect the instant it flips (enable schedule).', why: 'Reads as an on/off switch with immediate effect.' },
        ],
      },
      {
        title: 'Indeterminate — a select-all header over a group',
        note: 'A checkbox that governs a set (a "select all" for a group of rows) has three states, not two. Set the native <code>el.indeterminate = true</code> property (JS only — there is no HTML attribute) to paint the neutral dash. It stays the one neutral checkbox — do not invent a second control or a differently-styled tick.',
        rows: [
          { token: 'checked', use: 'Every row in the group is selected.', why: 'The header mirrors a fully-selected set.' },
          { token: 'indeterminate (dash)', use: 'Some but not all rows are selected — set <code>el.indeterminate = true</code>, leave <code>checked = false</code>.', why: 'The dash reads as "partial", distinct from empty and from full.' },
          { token: 'unchecked', use: 'No row in the group is selected.', why: 'Empty box = empty set.' },
        ],
      },
    ],
    usageDo: ['Use a toggle only when the effect is immediate.', 'Label the state so on/off is unambiguous.', 'When an option can’t be chosen (at a selection cap, plan-gated), make the item itself read inactive — reduced opacity (~0.4) + cursor-not-allowed + the control disabled — not just a banner. A long list hides the banner; the disabled item carries the reason in place.', 'For a group "select all" header, drive the three states from the group’s own rows via <code>el.checked</code> / <code>el.indeterminate</code>. When that select-all shares a tier-cap budget, filling it stops at the cap: the header then lands on <b>indeterminate</b>, not checked — a partial dash is the honest signal that the cap, not the user, ended the selection (a bespoke rule; native indeterminate has no such semantics).'],
    usageDont: ["Don't use a toggle for something that only applies after a Save.", "Don't fake a partial state with opacity or a custom glyph — use native indeterminate so it matches the one neutral checkbox everywhere.", "Don't fake a mixed state on a master control — set <code>el.indeterminate</code> and let the control paint it. A master over a set of CHECKBOXES is a checkbox (dash); a master over a set of TOGGLES is a toggle (daisyUI paints <code>.toggle:indeterminate</code> natively, knob centred). Matching the master to the children is what makes the two read as one control — corrected 2026-07-28, an earlier note here wrongly claimed a toggle cannot render indeterminate."],
    examples: [
      {
        label: 'Checkbox',
        html: `
<label class="flex items-center gap-2">
  <input type="checkbox" class="checkbox checkbox-primary checkbox-sm" checked />
  <span class="text-sm">Include attachments</span>
</label>`,
      },
      {
        label: 'Indeterminate (group select-all)',
        html: `
<label class="flex items-center gap-2">
  <input type="checkbox" class="checkbox checkbox-sm" ref="ind" />
  <span class="text-sm">Marketing workspace · 3 of 12</span>
</label>
<script>document.currentScript.previousElementSibling.querySelector('[ref=ind]').indeterminate = true;</script>`,
      },
      {
        label: 'Toggle',
        html: `
<label class="flex items-center gap-2">
  <input type="checkbox" class="toggle toggle-primary" checked />
  <span class="text-sm">Scheduled backups on</span>
</label>`,
      },
    ],
  },
  {
    id: 'card',
    group: 'Primitives',
    name: 'Card',
    summary: 'daisyUI card — the default container for a grouped block.',
    description:
      'A surface that groups related content: <code>card</code> on <code>bg-base-100</code> with a <code>base-300</code> border, padded, <code>rounded-box</code>. Border-first depth — no resting shadow (see Elevation). Use a card when content genuinely forms a unit; don’t wrap everything, and never nest cards.',
    reference: 'components/ui/Card.astro',
    props: [
      { name: 'variant', type: "'default' | 'elevated' | 'outlined' | 'tonal' | 'primary'", default: "'default'", description: 'Surface treatment; default = border-first, no shadow.' },
      { name: 'hover', type: 'boolean', default: 'false', description: 'Adds a hover shadow (for clickable cards).' },
    ],
    usageDo: ['Use a card to group content that belongs together.', 'Keep one border + surface; let spacing do the rest.'],
    usageDont: ["Don't nest a card inside a card.", "Don't wrap every element in a card — most don't need one."],
    examples: [
      {
        label: 'Default',
        html: `
<div class="card max-w-sm rounded-box border border-base-300 bg-base-100 p-6">
  <h3 class="text-base font-semibold">Daily backup</h3>
  <p class="mt-1 text-sm text-base-content/70">Runs every day at 02:00 UTC to Google Drive.</p>
</div>`,
      },
    ],
  },
  {
    id: 'modal',
    group: 'Primitives',
    name: 'Modal',
    summary: 'daisyUI modal — a focused interruption, used sparingly.',
    description:
      'A <code>dialog.modal</code> with a <code>modal-box</code> and a <code>modal-backdrop</code>. Reserve modals for confirming consequential or destructive actions, or a short focused task — exhaust inline and progressive options first. Destructive confirmations use <code>btn-error</code> and name the blast radius. (Click the trigger below to open the real dialog.)',
    reference: 'components/ui/Modal.astro',
    props: [
      { name: 'id', type: 'string', default: 'required', description: 'Unique id; the trigger calls id.showModal().' },
      { name: 'size', type: "'sm' | 'md' | 'lg' | 'xl' | 'full'", default: "'md'", description: 'Box width.' },
      { name: 'title', type: 'string', default: '—', description: 'Heading rendered in the box header.' },
      { name: 'open', type: 'boolean', default: 'false', description: 'Render open initially.' },
    ],
    guides: [
      {
        title: 'When to use a modal',
        note: 'A modal interrupts, so it should be the exception. Default to inline / progressive disclosure; reach for a modal only when the user must stop and decide.',
        rows: [
          { token: 'Confirm destructive', use: 'Delete, disconnect, overwrite — name what is affected.', why: 'Forces a deliberate stop before an irreversible action.' },
          { token: 'Confirm + credits', use: 'Run backup now — warn that extra credits will be used.', why: 'A cost the user should acknowledge before it happens.' },
          { token: 'Short focused task', use: 'Create Space, rename — a few fields, then return.', why: 'Keeps a small task in context without a page change.' },
        ],
      },
    ],
    usageDo: ['Confirm every destructive action with a modal.', 'State the consequence and what cannot be undone.'],
    usageDont: ["Don't reach for a modal as the first thought — try inline first.", "Don't stack modals."],
    examples: [
      {
        label: 'Destructive confirm — click to open',
        html: `
<button class="btn btn-sm btn-error" onclick="document.getElementById('sb_modal_demo').showModal()">
  Disconnect Google Drive…
</button>
<dialog id="sb_modal_demo" class="modal">
  <div class="modal-box max-w-sm">
    <h3 class="text-lg font-semibold">Disconnect Google Drive?</h3>
    <p class="mt-2 text-sm text-base-content/70">3 Spaces back up here. They will fail until you reconnect. This can’t be undone.</p>
    <div class="modal-action">
      <form method="dialog" class="flex gap-2">
        <button class="btn btn-sm btn-ghost">Cancel</button>
        <button class="btn btn-sm btn-error">Disconnect</button>
      </form>
    </div>
  </div>
  <form method="dialog" class="modal-backdrop"><button>close</button></form>
</dialog>`,
      },
    ],
  },
  {
    id: 'confirm-modal',
    group: 'Primitives',
    name: 'Confirm modal',
    summary: 'A reusable "are you sure?" dialog built on the catalog Modal.',
    description:
      'ConfirmModal turns the Modal into a ready confirmation: a message + an optional soft Alert for the consequence, then Cancel + a confirm action. Use it for anything that should pause and ask — destructive (cancel a run, disconnect a destination) or costly (run off-schedule = extra credits). Body goes in the default slot; <code>confirmHref</code> navigates (the prototype pattern) or a <code>confirm</code> named slot supplies a custom control. <code>confirmClass</code> sets the emphasis — <code>btn-outline btn-error</code> for destructive, <code>btn-neutral</code> for a calm/reversible one. Don\'t rebuild a confirm inline — reuse this. (Click to open the real dialog.)',
    reference: 'components/ui/ConfirmModal.astro',
    props: [
      { name: 'id', type: 'string', default: 'required', description: 'Dialog id; the trigger calls id.showModal().' },
      { name: 'title', type: 'string', default: 'required', description: 'The question, e.g. "Cancel this backup run?".' },
      { name: 'confirmLabel', type: 'string', default: "'Confirm'", description: 'Confirm-button label.' },
      { name: 'confirmHref', type: 'string', default: '—', description: 'Where confirm navigates (prototype). Omit and use the confirm slot for a custom control.' },
      { name: 'confirmClass', type: 'string', default: "'btn-primary'", description: "Confirm emphasis — 'btn-neutral' / 'btn-outline btn-error' (destructive)." },
      { name: 'confirmIcon', type: 'string', default: '—', description: "Lucide class on the confirm button, e.g. 'lucide--x'." },
      { name: 'cancelLabel', type: 'string', default: "'Cancel'", description: 'Dismiss-button label.' },
    ],
    usageDo: ['Reuse it for every confirm — destructive or costly.', 'State the consequence in a soft Alert (kept data, irreversibility, credits).'],
    usageDont: ["Don't rebuild a confirm dialog inline.", "Don't use a red/destructive confirm for a reversible action — Pause is info, not error."],
    examples: [
      {
        label: 'Destructive confirm — click to open',
        html: `
<button class="btn btn-sm btn-outline btn-error" onclick="document.getElementById('sb_confirm_demo').showModal()">
  Cancel run…
</button>
<dialog id="sb_confirm_demo" class="modal">
  <div class="modal-box max-w-sm">
    <div class="flex items-center justify-between gap-4 pb-4 border-b border-base-300/20">
      <h2 class="font-headline font-semibold text-lg">Cancel this backup run?</h2>
      <form method="dialog"><button class="btn btn-sm btn-circle btn-ghost" aria-label="Close"><span class="iconify lucide--x icon-lg"></span></button></form>
    </div>
    <div class="py-4">
      <p class="text-sm text-base-content/70">The run stops where it is. Everything captured so far is kept.</p>
      <div role="alert" class="alert alert-soft alert-warning mt-3">
        <span class="iconify lucide--triangle-alert size-4"></span>
        <span>A cancelled run <strong>can’t be resumed</strong> — start a new one with Run backup now.</span>
      </div>
      <div class="modal-action">
        <form method="dialog" class="flex gap-2">
          <button class="btn btn-ghost">Keep running</button>
          <button class="btn btn-outline btn-error"><span class="iconify lucide--x size-4"></span>Cancel run</button>
        </form>
      </div>
    </div>
  </div>
  <form method="dialog" class="modal-backdrop"><button>close</button></form>
</dialog>`,
      },
    ],
  },
  {
    id: 'tabs',
    group: 'Primitives',
    name: 'Tabs',
    summary: 'daisyUI tabs — switch views within one context.',
    description:
      'Tabs switch between sibling views of the same object (Schema / Data / Activity) — not between pages. Default is the underline style (<code>tabs tabs-border</code>); <code>tabs-lift</code> for a card-attached set; <code>tabs-pills</code> for a compact segmented control. The daisyUI <strong>radio-input variant</strong> (<code>&lt;input type="radio" class="tab"&gt;</code>) has no children and therefore cannot carry a leading icon or a count badge, so in-page section switching uses the button recipe documented in <a href="#pattern-section-tabs">Section tabs</a>.',
    reference: 'components/ui/Tabs.astro',
    props: [
      { name: 'tabs', type: 'Tab[]', default: 'required', description: 'The tab items.' },
      { name: 'variant', type: "'underline' | 'pills' | 'pills-full' | 'boxed' | 'vertical' | 'submenu'", default: "'underline'", description: 'Tab style — see the table above.' },
      { name: 'activeTab', type: 'string', default: '—', description: 'Id of the initially active tab.' },
    ],
    guides: [
      {
        title: 'Choosing a tab style',
        default: 'Underline · tabs tabs-border',
        note: 'Underline is the in-app default. Use lift only when tabs sit on top of a card, and pills for a small inline segmented toggle.',
        rows: [
          { token: 'Underline · tabs tabs-border', use: 'Section switching within a page (the common case).', why: 'Quiet; reads as "same object, different view".' },
          { token: 'Lift · tabs tabs-lift', use: 'Tabs attached to the top of a card or panel.', why: 'The active tab visually connects to the panel below.' },
          { token: 'Pills · tabs tabs-pills', use: 'A compact inline toggle — list/grid, day/week.', why: 'Segmented-control feel in a tight space.' },
        ],
      },
    ],
    usageDo: ['Use tabs for sibling views of one object.', 'Keep exactly one tab active and obvious.'],
    usageDont: ["Don't use tabs as primary page navigation.", "Don't hide critical actions behind a non-default tab."],
    examples: [
      {
        label: 'Underline (default)',
        html: `
<div class="tabs tabs-border">
  <a class="tab tab-active">Schema</a>
  <a class="tab">Data</a>
  <a class="tab">Activity</a>
</div>`,
      },
      {
        label: 'Pills',
        html: `
<div class="tabs tabs-pills">
  <a class="tab tab-active">List</a>
  <a class="tab">Grid</a>
</div>`,
      },
    ],
  },
  {
    id: 'table',
    group: 'Primitives',
    name: 'Table',
    summary: 'daisyUI table — dense, scannable rows of records.',
    description:
      'The workhorse for run history and audit data. Use <code>table</code>; headers in a small uppercase label; IDs and counts in <code>font-mono tabular-nums</code> so columns align; status via a soft badge; a row’s drill-in action as a primary-coloured ghost (<code>btn-ghost btn-sm text-sm text-primary</code> — btn-sm keeps the compact height, text-sm matches the 14px rows, text-primary reads as the interactive drill-in). Add <code>table-zebra</code> only when row scanning needs the help.',
    usageDo: [
      'Right-align and tabular-num numeric columns so they compare at a glance.',
      'Use font-mono for IDs, durations, and counts.',
      'Match a row action’s text to the table (btn-ghost btn-sm text-sm text-primary) so its label is the data size and reads as interactive.',
    ],
    usageDont: ["Don't center-align numbers.", "Don't put more than one primary action in a row."],
    examples: [
      {
        label: 'Run history',
        html: `
<table class="table">
  <thead>
    <tr class="text-xs uppercase tracking-wider">
      <th>Status</th>
      <th>Run</th>
      <th class="text-right">Records</th>
      <th class="text-right">Duration</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td><span class="badge badge-soft badge-success">Backed up</span></td>
      <td class="font-mono text-sm">run_8f2a1c</td>
      <td class="text-right font-mono tabular-nums">420,318</td>
      <td class="text-right font-mono tabular-nums">2m 14s</td>
    </tr>
    <tr>
      <td><span class="badge badge-soft badge-error">Failed</span></td>
      <td class="font-mono text-sm">run_7b1d04</td>
      <td class="text-right font-mono tabular-nums">—</td>
      <td class="text-right font-mono tabular-nums">0m 38s</td>
    </tr>
  </tbody>
</table>`,
      },
    ],
  },
  {
    id: 'breadcrumbs',
    group: 'Primitives',
    name: 'Breadcrumbs',
    summary: 'daisyUI breadcrumbs — show where you are in a drill-down.',
    description:
      'Use breadcrumbs in the multi-level audit trail (Backups → Run → Base) so the user always sees the path and can step back up. Higher levels are links; the current level is plain text.',
    reference: 'components/ui/Breadcrumbs.astro',
    props: [
      { name: 'items', type: 'Crumb[]', default: 'required', description: 'The trail; each has a label and optional href + icon.' },
    ],
    usageDo: ['Make every level except the current one a link.', 'Keep labels short and real (the run id, the base name).'],
    usageDont: ["Don't breadcrumb a flat page with no hierarchy."],
    examples: [
      {
        label: 'Drill-down trail',
        html: `
<div class="breadcrumbs text-sm">
  <ul>
    <li><a>Backups</a></li>
    <li><a>run_8f2a1c</a></li>
    <li>Sales base</li>
  </ul>
</div>`,
      },
    ],
  },
  {
    id: 'progress',
    group: 'Primitives',
    name: 'Progress',
    summary: 'daisyUI progress — determinate work and quota meters.',
    description:
      'Use <code>progress</code> for a known-percentage bar: a running backup’s completion or a usage/quota meter. Colour by meaning — primary for in-progress, warning as a quota nears its cap. For unknown-duration work use a spinner, not a bar.<br><br><strong>Card-edge variant (base picker, 2026-07-29).</strong> When the work is a background enhancement to a surface that STAYS usable, pin the bar as a 3px line on the <strong>top edge of the card</strong> (<code>position:absolute; inset-inline:0; top:0; height:3px; border-radius:0</code>, inside the card’s <code>overflow:hidden</code> so it follows the radius) — the browser-loading-bar idiom, which reads as "loading, the page still works". Never lay a bar across the content it is loading: that reads as "this table is unavailable", which is the opposite of the truth. Hold it back ~500ms so short work never flashes, keep the raw <code>n / N</code> count beside it (the bar says how far, the number says what is being counted), and if the work FAILS stop the bar and drop to the neutral <code>progress</code> — a failed enhancement is not a page error, so it never turns <code>progress-error</code>.',
    reference: 'components/ui/ProgressBar.astro',
    props: [
      { name: 'value', type: 'number', default: 'required', description: 'Current value (0 to max).' },
      { name: 'max', type: 'number', default: '100', description: 'Upper bound.' },
      { name: 'variant', type: "'primary' | 'success' | 'warning' | 'error'", default: "'primary'", description: 'Colour by meaning.' },
      { name: 'label / showValue', type: 'string / boolean', default: '— / false', description: 'Optional label and percentage readout.' },
    ],
    usageDo: [
      'Use a determinate bar only when you know the percentage.',
      'Turn a quota bar to warning as it approaches the cap.',
      'Pin a background-work bar to the top EDGE of the card it belongs to, and keep the n / N count beside it.',
      'Go neutral, not error, when background work fails on a surface that still functions.',
    ],
    usageDont: [
      "Don't fake progress for unknown-duration work — use a spinner.",
      "Don't use a spinner when you DO know the percentage — that is what this primitive is for.",
      "Don't draw a bar across the content it is loading; on the edge it means \"still working\", on top it means \"unavailable\".",
    ],
    examples: [
      {
        label: 'Variants',
        html: `
<div class="flex max-w-sm flex-col gap-3">
  <progress class="progress progress-primary w-full" value="64" max="100"></progress>
  <progress class="progress progress-warning w-full" value="88" max="100"></progress>
  <progress class="progress progress-error w-full" value="100" max="100"></progress>
</div>`,
      },
    ],
  },

  {
    id: 'alert',
    group: 'Primitives',
    name: 'Alert',
    summary: 'daisyUI alert — an inline banner for a state the user should notice.',
    description:
      'A banner tied to a state: icon + message, optionally an action. Use the <strong>soft</strong> style to match our calm surfaces (<code>alert alert-soft alert-{color}</code>). Colour by meaning. This replaces our hand-rolled banners (failed-attachments, the “extra credits” warning).',
    guides: [
      {
        title: 'Which alert',
        note: 'Colour carries the meaning; pair it with an icon and keep the copy to roughly one line.',
        rows: [
          { token: 'Info · alert-info', use: 'Neutral notices — “Schema captured”, a heads-up.', why: 'Informs without alarm.' },
          { token: 'Warning · alert-warning', use: 'Quota nearing a cap, “extra credits will be used”.', why: 'Asks for attention before a cost.' },
          { token: 'Error · alert-error', use: 'A failure the user must see — a failed run, lost connection.', why: 'Highest urgency; pair with a recovery action.' },
          { token: 'Success · alert-success', use: 'A completed action worth confirming inline.', why: 'Positive confirmation in place.' },
        ],
      },
    ],
    usageDo: ['Use the soft style for calm, on-brand banners.', 'Give an error alert a recovery action (Reconnect, Retry).', 'Make every user hint / heads-up an alert with a leading icon — a gating hint is a persistent alert-warning + lucide--circle-alert; a non-gating tip may add a × to dismiss.', 'Use it for EVERY in-panel message banner — provenance/AI = alert-info, removed/invalid/stale/broken-data = alert-warning (see pattern-removed-notice). Never a hand-rolled tinted box. (Inline helper text under an input is a caption, not an alert.)'],
    usageDont: ["Don't stack multiple alerts — collapse to the most important.", "Don't use an alert for a transient confirmation — that's a Toast.", "Don't render a hint as a bare tinted <p> — it must be an alert with an icon."],
    examples: [
      {
        label: 'Soft, by meaning',
        html: `
<div class="flex flex-col gap-2">
  <div role="alert" class="alert alert-soft alert-warning">
    <span class="iconify lucide--triangle-alert size-4"></span>
    <span>Running this backup now will use additional credits.</span>
    <button class="btn btn-sm btn-warning">Run anyway</button>
  </div>
  <div role="alert" class="alert alert-soft alert-error">
    <span class="iconify lucide--circle-x size-4"></span>
    <span>3 attachments could not be backed up.</span>
    <button class="btn btn-sm btn-ghost">Review</button>
  </div>
  <div role="alert" class="alert alert-soft alert-info">
    <span class="iconify lucide--info size-4"></span>
    <span>Schema, data and attachments were captured.</span>
  </div>
</div>`,
      },
      {
        label: 'Dismissible — a read-once confirmation',
        html: `
<div role="alert" class="alert alert-soft alert-success">
  <span class="iconify lucide--circle-check size-4"></span>
  <span class="flex-1">Your Space is protected. The first backup is running.</span>
  <button class="btn btn-ghost btn-sm btn-square" aria-label="Dismiss" onclick="this.closest('.alert').remove()">
    <span class="iconify lucide--x size-4"></span>
  </button>
</div>`,
      },
    ],
  },
  {
    id: 'tooltip',
    group: 'Primitives',
    name: 'Tooltip',
    summary: 'daisyUI tooltip — a hover hint for icon-only controls and truncated text.',
    description:
      'Wrap a control in <code>tooltip</code> and set <code>data-tip</code>; position with <code>tooltip-top/right/bottom/left</code>. Use it for icon-only buttons, truncated values, and provider hints — replacing native <code>title</code> (slow, unstyled). Rendered in the top layer by the shared controller, so no scroll container can clip it — see the fuller Tooltip entry above.',
    usageDo: ['Give every icon-only button a tooltip (and an aria-label).', 'Use a tooltip to reveal a truncated value in full.'],
    usageDont: ["Don't hide essential info in a tooltip — it's unreachable on touch.", "Don't put actions inside a tooltip."],
    examples: [
      {
        label: 'Positions (forced open to preview)',
        html: `
<div class="flex items-center gap-10 pt-6">
  <div class="tooltip tooltip-open tooltip-top" data-tip="Opens the run detail"><button class="btn btn-sm btn-outline">Details</button></div>
  <div class="tooltip tooltip-open tooltip-right" data-tip="Google Drive"><button class="btn btn-sm btn-square btn-ghost" aria-label="Destination"><span class="iconify lucide--folder size-4"></span></button></div>
</div>`,
      },
    ],
  },
  {
    id: 'status-dot',
    group: 'Primitives',
    name: 'Status dot',
    summary: 'daisyUI status — a tiny dot that signals state inline.',
    description:
      'A small dot (<code>status status-{color}</code>, sizes <code>status-xs…lg</code>) for at-a-glance state next to a label — connection state, a pipeline node, online/offline. For a labelled state pill use a <a href="#badge">Badge</a>; the dot is for compact, repeated indicators.',
    usageDo: ['Pair the dot with a nearby label so colour is not the only signal.', 'Use it where a full badge would be too heavy (lists, pipeline nodes).'],
    usageDont: ["Don't rely on the dot's colour alone — add text or an aria-label."],
    examples: [
      {
        label: 'States',
        html: `
<div class="flex flex-col gap-2 text-sm">
  <span class="inline-flex items-center gap-2"><span class="status status-success"></span> Connected</span>
  <span class="inline-flex items-center gap-2"><span class="status status-warning"></span> Reconnect needed</span>
  <span class="inline-flex items-center gap-2"><span class="status status-error"></span> Disconnected</span>
  <span class="inline-flex items-center gap-2"><span class="status status-neutral"></span> Paused</span>
</div>`,
      },
    ],
  },
  {
    id: 'steps',
    group: 'Primitives',
    name: 'Steps',
    summary: 'daisyUI steps — a progress indicator for a linear flow.',
    description:
      'A horizontal (or <code>steps-vertical</code>) progress trail; completed/current steps get <code>step-primary</code>. Use for the setup wizard and any multi-step flow so the user sees where they are. Our bespoke <a href="#pattern-setup-stepper">setup stepper</a> can move onto this.',
    usageDo: ['Mark completed and current steps with step-primary.', 'Keep step labels short.'],
    usageDont: ["Don't use steps for navigation between unrelated pages."],
    examples: [
      {
        label: 'Setup flow',
        html: `
<ul class="steps">
  <li class="step step-primary">Source</li>
  <li class="step step-primary">Destination</li>
  <li class="step step-primary">Bases</li>
  <li class="step">Depth</li>
  <li class="step">Schedule</li>
</ul>`,
      },
    ],
  },
  {
    id: 'radial-progress',
    group: 'Primitives',
    name: 'Radial progress',
    summary: 'daisyUI radial-progress — a ring for a single percentage.',
    description:
      'A circular gauge driven by <code>--value</code> (0–100); set <code>--size</code> / <code>--thickness</code> as needed. Good for a compact health or quota ring — e.g. the future <strong>Health Score</strong>. Colour by meaning with a text-colour class.',
    usageDo: ['Use for a single headline percentage (health, quota).', 'Colour by meaning (success / warning / error).'],
    usageDont: ["Don't use a ring for multi-series data — that's a chart."],
    examples: [
      {
        label: 'Health-style rings',
        html: `
<div class="flex items-center gap-5">
  <div class="radial-progress text-success" style="--value:82;--size:4rem;" role="progressbar" aria-valuenow="82">82</div>
  <div class="radial-progress text-warning" style="--value:54;--size:4rem;" role="progressbar" aria-valuenow="54">54</div>
  <div class="radial-progress text-error" style="--value:23;--size:4rem;" role="progressbar" aria-valuenow="23">23</div>
</div>`,
      },
    ],
  },
  {
    id: 'toast',
    group: 'Primitives',
    name: 'Toast',
    summary: 'daisyUI toast — a transient confirmation pinned to the top-right.',
    description:
      'A positioning wrapper (<code>toast toast-top toast-end</code>) that pins one or more <a href="#alert">alerts</a> to a screen corner for brief confirmations (connected, saved, copied, backup started). <strong>Our default corner is top-right</strong> (<code>toast-top toast-end</code>) so it never collides with the bottom drawer / footer actions. Auto-dismiss after a few seconds and never steal focus. Live: the <a href="/integrations/configure">setup wizard</a> fires one on connect / save.',
    usageDo: ['Pin to the top-right (toast-top toast-end).', 'Auto-dismiss in 3–5s.', 'Use aria-live so screen readers announce it.'],
    usageDont: ["Don't put a critical, must-act message in a toast — use an inline Alert.", "Don't pin it bottom-center where it overlaps footer / drawer actions."],
    examples: [
      {
        label: 'Click to show — top-right toast',
        html: `
<button class="btn btn-primary" onclick="(function(){var t=document.getElementById('sb_toast_demo');t.hidden=false;clearTimeout(t._t);t._t=setTimeout(function(){t.hidden=true;},2600);})()">
  <span class="iconify lucide--bell size-4"></span>Show toast
</button>
<div id="sb_toast_demo" class="toast toast-top toast-end z-[600]" hidden>
  <div role="status" aria-live="polite" class="alert alert-success shadow-lg">
    <span class="iconify lucide--circle-check size-4"></span>
    <span>Airtable connected.</span>
  </div>
</div>`,
      },
    ],
  },
  {
    id: 'pattern-export-control',
    group: 'Patterns',
    name: 'Export control',
    summary: 'One control per surface. The label names the format, the panel shows both row counts, and the filename says which one you took.',
    description:
      'Every Schema tab exports. Most tabs export exactly one format, so the <strong>trigger names it</strong>: <code>Export CSV</code>, <code>Export image</code>, <code>Export PDF</code>. When a tab offers a <strong>choice</strong> (Changelog exports CSV <em>or</em> JSON, for technical-ops users who want machine-readable output beside the spreadsheet), the trigger is a bare <code>Export</code> and a <strong>Format</strong> group in the panel picks the one — the filename, button label and format-specific options follow the selection. The trigger is the catalog <a href="#pattern-faceted-filter">facet</a> trigger — a bordered <code>ff-trigger</code> with a chevron — because an export is a quiet toolbar control, not the loudest button on the page.<br><br><strong>Scope is the whole decision.</strong> The panel offers two radios and shows <strong>both counts at once</strong> — <em>Current view · 24 fields</em> against <em>Everything · 108 fields</em> — so “keeps your filters” is something the user can <em>verify</em> rather than something we promise. The count repeats in the confirm button (<code>Export 24 fields</code>): the last thing read before the click is what lands on disk. Airtable scopes exports to the active view <em>silently</em>, which is a documented source of user confusion; no competitor shows counts at all.<br><br><strong>Zero matches disables the control</strong>, with the reason inline (“No fields match the current filter”). A header-only file reads as a bug, and a bug in an export is indistinguishable from data loss.<br><br><strong>The filename carries the scope</strong> — <code>baseout_core-crm_browse_2026-07-10_filtered.csv</code> vs <code>…_all.csv</code> — so the answer to “what did I actually export?” survives until the day the file is opened. It is shown in the panel before download.<br><br><strong>Standard CSV</strong> (client’s call): the file opens cleanly in Excel and a formula field’s definition is written out <em>verbatim</em> (<code>=…</code> stays <code>=…</code>). RFC-4180 quoting — every cell quoted, embedded quotes doubled — so commas, quotes and newlines survive a round-trip, but formula triggers are <em>not</em> apostrophe-guarded: the user is exporting their own base’s data, and prefixing would corrupt the very formula text the export exists to document. UTF-8 without BOM by default; an <em>Opening in Excel</em> toggle adds the BOM.<br><br><strong>Image export is not a bare button.</strong> Whole graph fitted with padding (never the viewport, which silently drops off-screen nodes); <strong>PNG or SVG</strong> (raster for a quick paste, vector for a diagram that stays crisp when zoomed — scale is PNG-only); background defaults to <strong>light</strong> because a dark canvas baked into a PNG lands in a white document (the single most-reported complaint against Excalidraw), with match-theme and transparent still offered.<br><br><strong>Large exports degrade the button, not the user’s patience</strong> (ProBackup’s pattern): when a job is heavy the trigger itself becomes <code>Request full export</code>, runs asynchronously, and the finished file arrives in the <a href="#pattern-inbox">Inbox</a>’s Activity lane. The label change <em>is</em> the warning and the wait-communication, in one affordance. No spinner trapped in a modal.<br><br><strong>Scope shapes per surface (Dan 2026-07-15):</strong> the old “Current view vs Everything” pair is retired — you export what you can SEE. Three modes: (a) <strong>plain</strong> — a one-line “Exports the current view — N” note, no radios (change the view to export more); (b) <strong>change-type</strong> (Changelog) — All / Created / Updated / Deleted; (c) <strong>split</strong> (Browse preset TABS, Docs DOCUMENTS) — <em>This one</em> vs <em>All, zipped</em>: the group appears only when &gt;1 is open, and “All …” writes <strong>one file per member into a single <code>.zip</code></strong> (Browse: a CSV/JSON per tab; Docs: a PDF per document — never one merged file), counting MEMBERS not rows, with a <code>…_tabs.zip</code> / <code>…_documents.zip</code> name. “This document” is always <strong>1</strong> (the open doc), which is why the old “2 documents” miscount is gone at the root. Driven by <code>splitScope</code> / <code>splitSelector</code> / <code>splitLabel</code>, kept live by a <code>data:tabschange</code> / <code>data:splitchange</code> event.<br><br>Research: <code>research/schema-export/</code>.',
    reference: 'components/patterns/ExportControl.astro · lib/csv.ts (formatCsv, exportFilename)',
    showCode: false,
    usageDo: [
      'Name the format in the trigger when the surface exports exactly one. A bare “Export” is only honest when the user still has a format to pick.',
      'Show BOTH counts in the scope options, and repeat the chosen one in the confirm button. “Keeps your filters” must be verifiable, not promised.',
      'Disable on zero matches and say why. Never hand back a header-only file.',
      'Encode the scope in the filename (…_filtered / …_all) and show the filename before the download.',
      'Escape CSV cells that open with = + - @ TAB CR LF, and tell the user their formulas export as text (OWASP CSV injection).',
      'For an image: export the whole graph fitted with padding, let the user choose the background, and rasterise at 2×.',
      'When the job is heavy, change the trigger to “Request full export” and deliver the result to the Inbox.',
    ],
    usageDont: [
      "Don't offer a format the product cannot produce. A dead menu item is a promise you have already broken.",
      "Don't use a filled/neutral trigger — an export is a toolbar control, not the primary action of the page.",
      "Don't export the viewport of a diagram. Off-screen nodes are exactly what the user wanted to keep.",
      "Don't bake a dark theme into an image without saying so; it will be pasted into a white document.",
      "Don't leave a spinner in a modal for a slow job. Degrade the button and hand the result to the Inbox.",
    ],
    examples: [
      {
        label: 'CSV tab — both counts visible, the count repeated in the button',
        html: `
<div class="w-[264px] rounded-box border border-base-300 bg-base-100 p-2 text-sm shadow-lg">
  <div class="px-2 py-1 text-[10.5px] font-bold uppercase tracking-wider opacity-45">Scope</div>
  <label class="flex items-center gap-2 rounded-[7px] px-2 py-1">
    <span class="flex-1">Current view</span>
    <span class="text-[11.5px] tabular-nums opacity-55">24 fields</span>
    <input type="radio" name="sb_xp" class="radio radio-sm radio-primary" checked />
  </label>
  <label class="flex items-center gap-2 rounded-[7px] px-2 py-1">
    <span class="flex-1">Everything</span>
    <span class="text-[11.5px] tabular-nums opacity-55">108 fields</span>
    <input type="radio" name="sb_xp" class="radio radio-sm radio-primary" />
  </label>
  <div class="my-1 h-px bg-base-300"></div>
  <label class="flex items-center gap-2 rounded-[7px] px-2 py-1">
    <span class="flex-1">Excel-compatible</span>
    <input type="checkbox" class="toggle toggle-sm toggle-primary" />
  </label>
  <p class="mx-2 mt-1 text-[11px] leading-snug opacity-50">Adds a UTF-8 byte-order mark. Formula definitions are exported as text.</p>
  <div class="my-1 h-px bg-base-300"></div>
  <p class="mx-2 mb-2 flex items-center gap-1 text-[11px] opacity-55">
    <span class="iconify lucide--file-down size-3.5"></span>
    <code class="text-[10.5px]">baseout_core-crm_browse_2026-07-10_filtered.csv</code>
  </p>
  <button class="btn btn-sm btn-primary w-full">Export 24 fields</button>
</div>`,
      },
    ],
  },
  {
    id: 'pattern-section-tabs',
    group: 'Patterns',
    name: 'Section tabs',
    summary: 'The underline tab row that switches sibling views inside one page — button tabs with a leading icon, plain-JS panel switching, and one tab-change event.',
    description:
      'The canonical <strong>section-tab row</strong>: sibling views of the SAME object inside one page (Schema › Browse / Visualize / Relationships…, Data › Browse / Changelog / Docs / Chat), never page-level navigation. Styling is global — <code>styles/global.css</code>, class prefix <code>sch-</code> — so a new surface gets the row by writing the markup, not by copying CSS. It had been copied into three views and the third copy had already drifted; that is why it lives in one place now.<br><br><strong>The recipe.</strong> A <code>&lt;div class="sch-tabbar" role="tablist" aria-label="…"&gt;</code> wraps a <code>&lt;div class="sch-gtabs tabs tabs-border"&gt;</code> holding <code>&lt;button type="button" class="tab" role="tab" data-tab="key"&gt;</code> — each with a <strong>leading</strong> <code>&lt;span class="iconify lucide--… size-4" aria-hidden="true"&gt;</code> before the label text. Buttons, not links and not radios: the tab is an in-page control, and only a button element can carry an icon (and later a count badge) inside the label.<br><br><strong>The switch is plain JS on the data attributes</strong> — the click handler reads <code>data-tab</code>, toggles <code>tab-active</code>, and shows the matching <code>[data-panel]</code>. Never the daisyUI <code>&lt;input type="radio" class="tab"&gt;</code> variant: a radio input has no children, so it cannot hold the icon, and its checked state is not addressable from the URL or from another tab\'s code.<br><br><strong>The switch itself is ONE shared module: <code>components/ui/sectionTabs.ts</code> (2026-07-30).</strong> The CSS was extracted long ago but the twenty-line click handler was still hand-copied into every host, and the copies had already drifted — Schema\'s carried a "/" shortcut and a React-Flow resize nudge, Data\'s did not, and <strong>neither read the URL</strong>. So a tab was not addressable at all: <code>/data?tab=comments</code> silently opened Browse, which meant nothing outside the page — a handoff step, a spec link, a message to the client — could ever point at a specific tab. The module now owns <strong>activate-on-load from <code>?tab=</code></strong>, <strong>writing the param back on change with <code>history.replaceState</code></strong> (replace, not push: Back must leave the page, not undo a tab), the <code>app:tabchange</code> dispatch, and the "/" search shortcut. Host-specific extras arrive through an <code>onChange</code> hook rather than a fork. An unknown or missing <code>?tab=</code> falls back to the server-rendered landing panel, so a stale link degrades instead of blanking the page.<br><br><strong>Panels</strong> are <code>&lt;div class="sch-panel" data-panel="key" hidden&gt;</code>, one per tab key. The <strong>landing panel omits <code>hidden</code></strong> and its tab carries <code>tab-active</code> in the server-rendered markup, so the correct view is painted before any JS runs.<br><br><strong>Changing tab must fire the app-wide event:</strong> <code>document.dispatchEvent(new CustomEvent(\'app:tabchange\', { detail: { tab } }))</code>. Every stacking drawer controller (<a href="#pattern-entity-panel">EntityPanel</a>, RecordPanel, DataChangelog) listens for it and closes its stack. Omitting the dispatch <strong>orphans open drawers</strong> — they stay pinned over a panel whose rows no longer exist, which reads as a rendering bug.<br><br><strong>Cluster grouping is optional and for ≥6 tabs only.</strong> Wrap each cluster in <code>&lt;div class="sch-group"&gt;</code> with a <code>&lt;span class="sch-glabel"&gt;</code> caption above its own <code>.sch-gtabs</code>, separated by <code>&lt;span class="sch-tabdiv" aria-hidden="true"&gt;</code> hairlines (approved Variant A, live on Schema\'s eight tabs). Below that count the labels are their own grouping and the captions only add noise — the <strong>flat DataView variant is the default</strong>: one <code>.sch-gtabs</code> directly inside <code>.sch-tabbar</code>.<br><br><strong>Two things that must not be "tidied".</strong> The active underline is daisyUI\'s own <code>tab-active</code> indicator (its <code>::before</code>); adding a second <code>border-bottom</code> produces a doubled/offset underline. And the 1px baseline under the whole row is <code>.sch-tabbar</code>\'s own <code>border-bottom</code> — which is why <code>.sch-gtabs.tabs { border: 0 }</code> exists.',
    reference: 'styles/global.css (.sch-tabbar) — live on SchemaView / DataView',
    showCode: true,
    usageDo: [
      'Use it for sibling views of one object inside a page. Page-level navigation belongs in the sidebar.',
      'Give every tab a leading Lucide icon at size-4 before the label — the icon is what makes a dense row scannable.',
      'Render the landing panel without `hidden` and its tab with `tab-active`, so the right view is correct before JS runs.',
      "Fire `app:tabchange` on every switch. It is what closes the open drawer stacks; without it they hang over the wrong panel.",
      'Keep the row flat. Reach for `.sch-group` / `.sch-glabel` / `.sch-tabdiv` clusters only once the row passes about six tabs.',
      'Mark the wrapper `role="tablist"` with an `aria-label` naming the section, and each button `role="tab"`.',
    ],
    usageDont: [
      "Don't use the `<input type=\"radio\" class=\"tab\">` variant — it structurally cannot hold a leading icon or a count badge.",
      "Don't add a `border-bottom` to the active tab; daisyUI already draws the indicator and you get two offset lines.",
      "Don't copy the CSS into a view's scoped <style> — the classes are global, and the third copy is how Reports drifted.",
      "Don't switch panels by re-navigating or by re-rendering the page; toggle `hidden` on the `[data-panel]` siblings.",
      "Don't use section tabs as primary page navigation, and don't hide a destructive or critical action behind a non-landing tab.",
    ],
    examples: [
      {
        label: 'Flat row (the default) — DataView’s four tabs',
        html: `
<div class="sch-tabbar" role="tablist" aria-label="Data sections">
  <div class="sch-gtabs tabs tabs-border">
    <button type="button" class="tab tab-active" role="tab" data-tab="browse"><span class="iconify lucide--table-2 size-4" aria-hidden="true"></span>Browse</button>
    <button type="button" class="tab" role="tab" data-tab="changelog"><span class="iconify lucide--history size-4" aria-hidden="true"></span>Changelog</button>
    <button type="button" class="tab" role="tab" data-tab="docs"><span class="iconify lucide--book-text size-4" aria-hidden="true"></span>Docs</button>
    <button type="button" class="tab" role="tab" data-tab="chat"><span class="iconify lucide--messages-square size-4" aria-hidden="true"></span>Chat</button>
  </div>
</div>`,
      },
      {
        label: 'Clustered (≥6 tabs only) — labelled groups with hairline dividers',
        html: `
<div class="sch-tabbar" role="tablist" aria-label="Schema sections">
  <div class="sch-group">
    <span class="sch-glabel">Explore</span>
    <div class="sch-gtabs tabs tabs-border">
      <button type="button" class="tab tab-active" role="tab" data-tab="browse"><span class="iconify lucide--list-tree size-4" aria-hidden="true"></span>Browse</button>
      <button type="button" class="tab" role="tab" data-tab="visualize"><span class="iconify lucide--workflow size-4" aria-hidden="true"></span>Visualize</button>
    </div>
  </div>
  <span class="sch-tabdiv" aria-hidden="true"></span>
  <div class="sch-group">
    <span class="sch-glabel">Monitor</span>
    <div class="sch-gtabs tabs tabs-border">
      <button type="button" class="tab" role="tab" data-tab="changelog"><span class="iconify lucide--history size-4" aria-hidden="true"></span>Changelog</button>
      <button type="button" class="tab" role="tab" data-tab="health"><span class="iconify lucide--activity size-4" aria-hidden="true"></span>Health</button>
    </div>
  </div>
</div>`,
      },
    ],
  },
  {
    id: 'pattern-automation-anatomy',
    group: 'Patterns',
    name: 'Automation anatomy (trigger → touches)',
    summary: 'A captured automation or interface answers two questions inside its panel — what fires this, and what does it touch — and nothing else. Actions compress to a typed count; step configuration is deliberately unrenderable.',
    description:
      'The detail an <a href="/schema">Automations</a> / <a href="/schema">Interfaces</a> panel gains once the capture carries a definition. Three parts, in this order: a <strong>trigger block</strong> (trigger type + <em>on {table}</em> + the watched fields as <a href="#entity-chip">entity chips</a>), a <strong>touches</strong> section (every table and field the automation reaches, grouped by table), and an <strong>action summary</strong> that is a typed count only — <em>"3 actions: update record · send email · run script"</em>. <strong>The boundary is the design.</strong> Founder direction 2026-07-25: never render step-by-step action configuration — the captured JSON\'s depth is a liability, not a feature. This layout has no slot where step config could go, which is the point; if a future request asks for it, that is a new pattern and a new conversation, not an extra row here. Nor is this a run log: a backup product records what a base <em>is</em>, not what it <em>did</em> (see <a href="#pattern-changelog">Changelog</a> for the history that does belong to us).<br><br><strong>Wording follows Airtable\'s own</strong>, because the user has already learned it there: <em>"When a record is updated — Name, Assignee, Status, and 3 more fields"</em>. Do not invent a second vocabulary for the same concept.<br><br><strong>Degradation is a first-class state, not an error.</strong> Captures arrive at three depths and each has its own rendering: <em>full</em> shows the strip; <em>inventory</em> (id/name/enabled only) shows <strong>nothing at all</strong> — no empty headers, no "—" placeholders, because a section that exists only to say it is empty is noise; <em>unknown</em> (a shape the extractor cannot read) shows one honest line, <strong>"Details not available for this capture"</strong>, with the raw-definition disclosure still available underneath. The three are distinguished by an explicit <code>captureDepth</code>, never by guessing from absent fields — "no touches" and "we could not read it" are different facts and must not collapse into one blank.<br><br><strong>Script honesty.</strong> When an action list contains a script step, the summary says <em>run script</em> and the section carries a soft <a href="#alert">alert</a>: the fields shown are only those declared in configuration. A script can reach anything; silently presenting a partial list as complete would be the one genuinely dangerous thing this pattern could do.<br><br>Interfaces reuse the identical touches grammar, and an interface <em>page</em> adds its page type (list · record detail · dashboard · form) to the identity line. One grammar across all three so the reader learns it once.',
    reference: 'components/schema/schemaReadBody.ts (automationReadBody / interfaceReadBody) + automationAnatomy.ts',
    showCode: false,
    usageDo: [
      'Answer only "what fires this" and "what does it touch". Actions are a typed count — the boundary is the layout, not a rule someone has to remember.',
      'Mirror Airtable\'s own phrasing for the trigger ("… and 3 more fields"); the user learned the vocabulary there.',
      'Group touches by table, one row per table, its fields as chips inside — a flat chip soup loses the structure that makes the answer usable.',
      'Distinguish the three capture depths explicitly: full renders the strip, inventory renders NOTHING, unknown renders one honest line plus the raw disclosure.',
      'Say so when a script action exists: the fields listed are those declared in configuration, and may be incomplete.',
      'Reuse entityChip() with the Airtable field-type glyph, and keep the existing panel push hook so a chip drills to that entity.',
      'Obey the panel list rules — cap at 5 rows then an inline "+N more", inside the shared row-list container, count badge only from 2 up.',
      'The strip is CAPTURED FACT, so it renders identically in the panel\'s read and edit modes (<a href="#pattern-panel-edit-mode">Panel Read/Edit mode</a>) — never an input, never disabled, never greyed; edit mode only adds a "from capture" marker to the section label. The one exception is the trigger of a manually registered entry with no capture to contradict: that same slot renders the trigger-type select in edit mode.',
    ],
    usageDont: [
      "Don't render step-by-step action configuration. It is excluded on purpose; adding it back is a new pattern, not a bigger section.",
      "Don't render an empty section to prove a capture was shallow — inventory-grade shows nothing at all.",
      "Don't collapse 'nothing to show' and 'we could not read this' into the same blank; they are different facts and only one needs the raw escape hatch.",
      "Don't dump raw JSON into the primary UI — it stays behind the existing disclosure.",
      "Don't show a partial field list from a script action without saying it is partial.",
      "Don't fork a second chip builder for field types — the glyph goes into the existing chip.",
    ],
    examples: [
      {
        label: 'Trigger → touches → typed action count',
        html: `
<div class="max-w-md">
  <p class="text-xs font-bold uppercase tracking-wide opacity-60 mb-1.5">Trigger</p>
  <div class="rounded-[11px] border border-base-300 bg-base-200/45 p-3 mb-4">
    <p class="text-sm font-semibold">When a record is updated <span class="opacity-60">on</span> Orders</p>
    <div class="flex flex-wrap gap-1.5 mt-2">
      <span class="sb-chip sb-chip-static"><span class="sb-chip-ic"><span class="iconify lucide--circle-dot size-3.5"></span></span><span class="sb-chip-name">Status</span></span>
      <span class="sb-chip sb-chip-static"><span class="sb-chip-ic"><span class="iconify lucide--hash size-3.5"></span></span><span class="sb-chip-name">Amount</span></span>
      <span class="text-xs opacity-60 self-center">and 3 more fields</span>
    </div>
  </div>
  <p class="text-xs font-bold uppercase tracking-wide opacity-60 mb-1.5">Touches <span class="badge badge-sm badge-neutral align-middle">2</span></p>
  <div class="rounded-[11px] border border-base-300 bg-base-200/45 overflow-hidden mb-4">
    <div class="p-3 border-b border-base-200">
      <p class="text-sm font-medium mb-1.5">Invoices</p>
      <div class="flex flex-wrap gap-1.5">
        <span class="sb-chip sb-chip-static"><span class="sb-chip-name">Total</span></span>
        <span class="sb-chip sb-chip-static"><span class="sb-chip-name">Sent at</span></span>
      </div>
    </div>
    <div class="p-3"><p class="text-sm font-medium">Contacts</p></div>
  </div>
  <p class="text-sm"><span class="opacity-60">3 actions:</span> update record · send email · run script</p>
  <div role="note" class="alert alert-soft alert-warning mt-3">
    <span class="iconify lucide--circle-alert size-4"></span>
    <span class="flex-1 text-sm">This automation runs a script — the fields shown are those declared in its configuration and may be incomplete.</span>
  </div>
</div>`,
      },
      {
        label: 'Unknown shape — one honest line, raw still reachable',
        html: `
<div class="max-w-md">
  <p class="text-sm opacity-60">Details not available for this capture.</p>
  <details class="mt-2">
    <summary class="text-sm cursor-pointer">Raw definition (JSON)</summary>
    <pre class="text-xs mt-2 p-2 rounded-lg bg-base-200 overflow-x-auto">{ "v": 2, "spec": "…" }</pre>
  </details>
</div>`,
      },
    ],
  },
  {
    id: 'pattern-undo-toast',
    group: 'Patterns',
    name: 'Undo toast (with countdown)',
    summary: 'A destructive action confirms itself and offers Undo for a few seconds — with a bar that drains so the user can see the time left.',
    description:
      'The answer to "should this action ask first?" for anything cheap to reverse: <strong>don’t confirm — do it, then offer Undo.</strong> Built from the catalog: the <a href="#toast">toast</a> positioner wraps a soft <a href="#alert">alert</a> holding an icon, the outcome sentence, and a ghost <a href="#button">button</a> labelled <strong>Undo</strong>. The bar is a <strong>deadline</strong>, so it appears <em>only when the toast offers an action</em> — an informational toast ("opened as a strip") has nothing to be late for, takes a <code>lucide--info</code> glyph and no bar. What is NOT in daisyUI is the <strong>countdown</strong>: a 2px accent bar pinned to the alert’s bottom edge that <strong>drains left-to-right</strong> (its right edge travels leftwards) over the dismiss window, so the offer never expires without warning. Implemented as a <code>scaleX(1 → 0)</code> animation with <code>transform-origin: left</code> — a transform, so it composites on the GPU and never reflows the alert. Restart it by removing the run class, forcing a reflow, and re-adding it; otherwise a second close reuses the finished animation and the bar sits empty. <strong>Placement:</strong> bottom-centre, deliberately against the primitive’s top-right default — the top-right corner is where the drawer panels put their own close buttons, and an Undo that lands under the cursor that just closed something invites a double-click. <strong>Not for irreversible or expensive actions</strong> — those still take a dialog. Live: <a href="/schema">Schema › Browse</a>, closing any drawer panel.',
    reference: 'design:components/schema/EntityPanel.astro (.ep-undo / [data-ep-undo-bar] / showUndo())',
    showCode: true,
    usageDo: [
      'Do the thing immediately, then offer Undo. Reserve dialogs for what cannot be undone.',
      'Show a draining countdown bar so the window is visible, not guessed. Match its duration to the dismiss timer exactly — one CSS variable feeding both.',
      'Only draw the bar when there is an ACTION to be late for. Let the icon name the action (rotate-ccw = Undo), never merely the fact that one exists.',
      'State the outcome in the past tense ("Panel closed"), not the action ("Close panel?").',
      'Restart the bar animation on every show (remove class → reflow → add class), or the second toast shows an already-empty bar.',
    ],
    usageDont: [
      "Don't offer Undo for something you cannot actually restore — a dead button is worse than a dialog.",
      "Don't pin it top-right in a surface whose own close buttons live there; the Undo lands under the cursor that just closed something.",
      "Don't animate the bar's width or its <code>value</code> — animate a transform, or every frame reflows the alert.",
      "Don't put a countdown on a statement of fact — it promises a choice the user does not have.",
    ],
    examples: [
      {
        label: 'Click to close — then Undo before the bar drains',
        html: `
<button class="btn btn-sm btn-neutral" onclick="(function(){var t=document.getElementById('sb_undo_demo');t.hidden=false;var b=t.querySelector('.sb-undo-bar');b.style.animation='none';b.offsetHeight;b.style.animation='';clearTimeout(t._t);t._t=setTimeout(function(){t.hidden=true;},5000);})()">
  <span class="iconify lucide--x size-4"></span>Close panel
</button>
<div id="sb_undo_demo" class="toast toast-bottom toast-center z-[600]" hidden>
  <div role="status" aria-live="polite" class="alert alert-soft relative overflow-hidden shadow-lg">
    <span class="iconify lucide--rotate-ccw size-4"></span>
    <span>Panel closed</span>
    <button class="btn btn-sm btn-ghost" onclick="document.getElementById('sb_undo_demo').hidden=true">Undo</button>
    <span class="sb-undo-bar absolute bottom-0 left-0 right-0 h-[2px] origin-left bg-primary" style="animation: sb-undo-count 5000ms linear forwards"></span>
  </div>
</div>
<style>@keyframes sb-undo-count { from { transform: scaleX(1); } to { transform: scaleX(0); } }</style>`,
      },
    ],
  },
  {
    id: 'skeleton',
    group: 'Primitives',
    name: 'Skeleton',
    summary: 'daisyUI skeleton — a loading placeholder.',
    description:
      'A shimmering placeholder (<code>skeleton</code> + size utilities) shown while content loads — better than a blank gap or a long spinner for loads over ~1s. Mirror the shape of what is coming.',
    usageDo: ['Match the skeleton to the real content layout.', 'Use for loads over ~1s; a spinner for shorter.'],
    usageDont: ["Don't leave a skeleton up forever — replace it as soon as data arrives."],
    examples: [
      {
        label: 'Loading a row',
        html: `
<div class="flex max-w-sm items-center gap-4">
  <div class="skeleton size-10 shrink-0 rounded-full"></div>
  <div class="flex w-full flex-col gap-2">
    <div class="skeleton h-3 w-3/4"></div>
    <div class="skeleton h-3 w-1/2"></div>
  </div>
</div>`,
      },
    ],
  },
  {
    id: 'stats',
    group: 'Primitives',
    name: 'Stats',
    summary: 'daisyUI stats — a row of headline metrics.',
    description:
      'A grouped metric strip: <code>stats</code> wrapping <code>stat</code> blocks (<code>stat-title</code> / <code>stat-value</code> / <code>stat-desc</code>, optional <code>stat-figure</code>). The standard option for summary numbers (run summary, usage). <strong>Note:</strong> the Home metrics we already have look good and stay custom (lightly adapted) — reach for this on new metric rows.',
    usageDo: ['Use stat-value for the number, stat-desc for the delta/context.', 'Keep a row to 3–4 stats.'],
    usageDont: ["Don't pack a paragraph into a stat — it's a glanceable number."],
    examples: [
      {
        label: 'Run summary',
        html: `
<div class="stats border border-base-300 bg-base-100">
  <div class="stat">
    <div class="stat-title">Records</div>
    <div class="stat-value text-2xl">12,407</div>
    <div class="stat-desc">across 2 bases</div>
  </div>
  <div class="stat">
    <div class="stat-title">Attachments</div>
    <div class="stat-value text-2xl">218</div>
    <div class="stat-desc text-success">all captured</div>
  </div>
  <div class="stat">
    <div class="stat-title">Duration</div>
    <div class="stat-value text-2xl mono-data">7m</div>
    <div class="stat-desc">scheduled</div>
  </div>
</div>`,
      },
    ],
  },
  {
    id: 'drawer',
    group: 'Primitives',
    name: 'Drawer',
    summary: 'A slide-over side panel — our Drawer component on daisyUI’s drawer.',
    description:
      'A right-side (or left) slide-over for a focused side task: connecting a source/destination, reviewing failed attachments, reauthorizing a broken connection. It wraps daisyUI’s <code>drawer drawer-end</code> + <code>drawer-toggle</code> checkbox + <code>drawer-side</code> + <code>drawer-overlay</code>, so open/close is pure CSS — a <code>&lt;label for={id}&gt;</code> opens it, the overlay and × close it, and Esc is wired in the component. The host drives it from JS with <code>document.getElementById(id).checked = true</code>. Body and footer are slots, so each screen keeps its own content. Live: the <a href="/integrations/configure">setup wizard</a> (Connect Airtable / Add a destination). A <strong>bottom fly-out sheet</strong> variant (<code>side="bottom"</code>: full width, slides up from the bottom edge) is also available for full-width slide-up sheets when a side panel would feel too narrow. For a <strong>detail drawer</strong> that follows the <a href="#pattern-detail-panel">detail-panel canon</a> (icon + entity name in the header), the head carries an optional leading <strong>concept-icon tile</strong>: a host sets it at runtime via the <code>[data-sb-drawer-titleic]</code> hook (unhide + inject the Lucide icon) and sets the dynamic name on <code>[data-sb-drawer-title]</code> — this is how the Automations/Interfaces read-drawers put the entity name in the rail like the other detail drawers. A matching <code>[data-sb-drawer-crumbs]</code> hook adds a <strong>location crumbs sub-row</strong> under the title (Base ▸ …), so the base lives in the crumbs, not the meta line. All three hooks are hidden by default, so a plain title-string drawer is unaffected.',
    reference: 'design:components/ui/Drawer.astro',
    props: [
      { name: 'id', type: 'string', default: 'required', description: 'Unique id; the matching checkbox that open/close triggers toggle.' },
      { name: 'title', type: 'string', default: 'required', description: 'Heading shown in the panel header.' },
      { name: 'subtitle', type: 'string', default: '—', description: 'Optional supporting line under the title.' },
      { name: 'side', type: "'end' | 'start' | 'bottom'", default: "'end'", description: 'Which edge it slides from (end = right). bottom = a full-width fly-out sheet that slides up.' },
      { name: 'width', type: 'string', default: "'w-[min(92vw,28rem)]'", description: 'Tailwind width class for the end/start panel.' },
      { name: 'height', type: 'string', default: "'82dvh'", description: 'Panel height for the bottom sheet variant.' },
      { name: 'slot:footer', type: 'slot', default: '—', description: 'Footer actions (right-aligned); omit for a footerless panel.' },
    ],
    usageDo: [
      'Drive open/close by toggling the panel’s checkbox (or a <label for={id}>).',
      'Put the primary action in the footer; give the panel a clear title.',
      'Keep the × and a Cancel that close natively (label for the id).',
    ],
    usageDont: [
      "Don't put a primary, always-needed action ONLY inside a drawer.",
      "Don't reach for a drawer when a Modal (a short confirm) or inline disclosure fits better.",
    ],
    examples: [
      {
        label: 'Click to open — a real drawer',
        html: `
<div class="drawer drawer-end">
  <input id="sb_drawer_demo" type="checkbox" class="drawer-toggle" />
  <div class="drawer-content">
    <label for="sb_drawer_demo" class="btn btn-primary"><span class="iconify lucide--panel-right-open size-4"></span>Open drawer</label>
  </div>
  <div class="drawer-side z-[500]">
    <label for="sb_drawer_demo" aria-label="Close" class="drawer-overlay"></label>
    <aside class="flex h-dvh w-[min(92vw,24rem)] flex-col border-l border-base-300 bg-base-100">
      <header class="flex items-start gap-4 border-b border-base-300 p-5">
        <div class="min-w-0"><h3 class="font-semibold">Add a destination</h3><p class="mt-0.5 text-sm text-base-content/60">Pick where backups go.</p></div>
        <label for="sb_drawer_demo" class="btn btn-sm btn-ghost btn-square ml-auto" aria-label="Close"><span class="iconify lucide--x size-4"></span></label>
      </header>
      <div class="flex-1 overflow-y-auto p-5 text-sm text-base-content/70">The panel body — compose catalog inputs, selects and buttons here.</div>
      <footer class="flex justify-end gap-2 border-t border-base-300 p-4">
        <label for="sb_drawer_demo" class="btn btn-ghost">Cancel</label>
        <button class="btn btn-primary"><span class="iconify lucide--check size-4"></span>Save destination</button>
      </footer>
    </aside>
  </div>
</div>`,
      },
    ],
  },

  // ──────────────────────────────── Patterns ─────────────────────────────────
  // Product-specific compositions that STAY bespoke. They are documented (not
  // standardized to a primitive) so future work reuses the primitives inside
  // them without trying to flatten the composition itself into daisyUI.
  {
    id: 'pattern-detail-panel',
    group: 'Patterns',
    name: 'Entity detail panel (canonical anatomy)',
    summary: 'The one anatomy every right-side detail panel/drawer follows.',
    description:
      'The canonical shape for the Schema detail panels (EntityPanel, RelationshipPanel, the Automations/Interfaces read-drawers, Changelog detail). <strong>Drawer canon v2 (2026-07-06):</strong> all five share <strong>ONE width</strong> — <code>min(94vw, 30rem)</code> (480px; EntityPanel keeps an optional 900px expand) — so they never feel like different components. The <strong>header carries the identity</strong>: a single row of <code>[back, only where the panel drills] · concept-icon tile (2rem, radius .55rem, base-200) · dynamic entity name · [expand, EntityPanel only] · close (btn btn-sm btn-ghost btn-square + lucide--x)</code>, with a <strong>crumbs sub-row</strong> below it (Base ▸ Table ▸ …, one shared small muted style) shown only where the entity has a location — the leaf is the header title, so crumbs show ancestors only. The <strong>first body element is the identity meta line</strong>: <code>kind · STATUS soft-semantic chip · health chip · base chip</code>. Then a scroll-owning body of ordered, present-only sections → optional footer: read-only by default (no action bar; Changelog keeps a "Detected &lt;date&gt;" meta line), but Automations + Interfaces keep Edit/Delete through ONE standardized footer bar (see the drawer-footer note). Same slot order everywhere: absent → absent; present → the same fixed position. Sections are separated by generous whitespace, not a divider line; the count is a small catalog badge (badge-sm, solid neutral — soft is too faint on dark) pressed right after the section name. <strong>Every data-row list (and short chip set) sits inside ONE shared container</strong> — a <code>1px base-300</code> border + a faint <code>base-200/45%</code> fill + an ~11px radius (the same container language as the <code>.ep-stats</code> metric strip and the description box), with rows touching and split by a subtle <code>1px base-200</code> hairline (no per-row cards, no per-row radius) and the box clipping the first/last row hover — so a lone 1–2-row list reads as a grouped surface, never floating text. Every list caps at 5 rows then a <code>+N more</code> inline disclosure (<code>&lt;details&gt;</code> — expands in place, never a floating popover that escapes the panel); long free-text grows to a max height then scrolls inside its own box; the panel owns its scroll and locks the page scroll behind it. On a <strong>long panel (≥ 4 sections)</strong> a <a href="#panel-section-nav">progressive section-nav</a> chip-strip sits as the third header row (above the header border, part of the fixed header) for jump-to-section navigation with scroll-spy (shorter panels render none). Icon vocabulary: <code>lucide--globe</code> public-info · <code>lucide--lock</code> internal · <code>lucide--triangle-alert</code> real warning ONLY · <code>lucide--circle-check</code> success · <code>lucide--sparkles</code> AI. Spec: overview/schema/panel-anatomy-canonical.md. Live: <a href="/panels">Panel Lab</a>.',
    reference: 'views/schema/BrowseTab.astro (detail panel)',
    showCode: false,
    usageDo: [
      'Keep the slot order fixed across every panel; omit a section entirely when absent.',
      'Give every detail drawer the SAME width — min(94vw, 30rem) (480px). Put the concept-icon tile + the entity name in the HEADER row (not the body), with the crumbs sub-row (ancestors only) beneath it where the entity has a location. The body opens with the identity meta line (kind · status · trailing note).',
      'Identity meta line = kind · STATUS · trailing note. Keep the kind label everywhere (Interface / Page / Automation / Lookup / Table / relationship type). Render STATUS as a colored DOT + label (never a soft badge — a badge reads as a button): green = Published/Active/Valid/Healthy · amber = Draft/Paused/Could improve · red = Invalid/Not published/At risk/Removed · grey = Inactive/Unknown. Trailing note = "as of last backup" on entity drawers. (Soft badges stay in LISTING table cells; the dot+label is for the detail meta line.)',
      'Location (Base ▸ Table ▸ … / Base ▸ parent-interface) lives ONLY in the crumbs sub-row — never a base chip in the meta line. The catalog Drawer hosts it via [data-sb-drawer-crumbs]. Cardinality (Relationships) shows a readable label ("Many-to-one") with the compact token (m:1) as a daisyUI tooltip.',
      'Any collapsible (e.g. "Raw definition (JSON)") gets a trailing chevron that rotates on [open] (the same affordance as "+N more") so it reads as expandable — never a bare bordered row.',
      'Footer is read-only by default (no action bar). Where edit/delete genuinely applies (Automations/Interfaces), use ONE standardized footer bar, identical in every file: border-top 1px base-200, Delete = btn btn-sm btn-ghost text-error + lucide--trash-2, and in edit mode the same bar carries Save (btn-sm btn-primary) + Cancel (btn-sm btn-ghost). Editing is a MODE of this panel, not a second surface — see <a href="#pattern-panel-edit-mode">Panel Read/Edit mode</a>; the mode switch sits at the end of the identity meta line.',
      'Give each TOP-LEVEL section header a quiet grey concept icon (the same icons the app/tabs use: Relationships=waypoints, Changelog=history, Documentation=book-text, Configuration=settings-2, …). Sub-labels INSIDE a section (Formula / References / Rolls up) get NO icon — that contrast is what marks the levels. EXCEPTION: the "Referenced by" section groups its rows BY KIND (Automations=zap · Interfaces & pages=layout-panel-left · Formulas=variable · Rollups=sigma · Lookups=search · Docs=book-text · Chats=messages-square) — each group sub-header DOES carry its kind concept-icon (+ a right-aligned per-group count), because there the icon is the group signifier, not a section label. Empty groups are omitted.',
      "Show BACK-references in the field Relationships section: the fields that point at this field (formula / rollup / lookup), each an ordinary row with a '← referenced by' direction marker that mirrors the table-level LINKS TO / LINKED FROM language. Forward config (Formula / Looks up / Rolls up) stays untouched. The reverse edges are derived by inverting the forward graph — the engine must emit them (Airtable's API returns only the forward config).",
      'Put the section count in a small catalog badge (badge-sm badge-neutral) pressed right after the name; separate top-level sections with whitespace (no divider line). Show the badge only from 2 upward — suppress the lone "1" (a single item is self-evident from the one row below it). Same for the Referenced-by group sub-headers.',
      "Wrap each row-list (References, Relationships, Referenced-by groups, Fields/Children, Options, Documentation, Changelog, linked-fields chips) in ONE shared container: 1px base-300 border + faint base-200/45% fill + ~11px radius + overflow-hidden, rows split by a 1px base-200 hairline. This is the SAME container as the .ep-stats strip / description box — it stops a 1–2-row list from looking like floating text, and stretches cleanly from 1 to 50 rows. Keep it calm (subtle fill, no shadow).",
      'Cap any list at 5 rows, then a "+N more" disclosure that expands the rest INLINE inside the panel body (never a floating popover — it escapes a scroll-owning panel).',
      'Grow long free-text to a max height, then scroll inside its own box — never push the panel.',
      'Use lucide--globe for public/synced info; reserve lucide--triangle-alert for genuine warnings.',
      'daisyUI tooltip for hints — never native title=.',
    ],
    usageDont: [
      "Don't render an uncapped 50-row list; that's the worst-case this pattern exists to prevent.",
      "Don't put a warning-triangle on an informational line — it reads as an error.",
      "Don't show a “1” count badge — a lone item needs no counter (and a faint “1” reads as disabled); only badge counts of 2+.",
      "Don't leave a row-list as bare rows on the panel background, or give each row its own bordered card — a lone 1–2-row list then looks like floating text. One shared container, hairline-split rows.",
    ],
    examples: [
      {
        html: `
<div class="max-w-sm rounded-box border border-base-300 bg-base-100 p-4 text-sm">
  <div class="flex items-baseline justify-between border-t border-base-300 pt-3">
    <span class="text-[11px] font-bold uppercase tracking-wider text-base-content/50">References</span>
    <span class="font-mono text-base-content/60">50</span>
  </div>
  <div class="mt-2 overflow-hidden rounded-[11px] border border-base-300" style="background:color-mix(in oklch, var(--color-base-200) 45%, transparent)">
    <div class="px-3 py-2 hover:bg-base-200">Amount</div>
    <div class="border-t border-base-200 px-3 py-2 hover:bg-base-200">Probability</div>
    <div class="border-t border-base-200 px-3 py-2 hover:bg-base-200">Adjustment</div>
    <details>
      <summary class="flex cursor-pointer list-none items-center gap-1 border-t border-base-200 px-3 py-2 text-sm font-medium text-primary hover:bg-base-200">+47 more<span class="iconify lucide--chevron-down size-3.5"></span></summary>
      <div class="border-t border-base-200 px-3 py-2 hover:bg-base-200">Metric 04</div>
      <div class="border-t border-base-200 px-3 py-2 hover:bg-base-200">Metric 05</div>
    </details>
  </div>
  <p class="mt-3 flex items-center gap-1.5 text-[11.5px] text-base-content/60"><span class="iconify lucide--globe size-3.5"></span>Shown to everyone in Airtable · the only synced copy.</p>
</div>`,
      },
    ],
  },
  {
    id: 'pattern-multi-panel-drawer',
    group: 'Patterns',
    name: 'Multi-panel drawer (independent tabs)',
    summary: 'Independent side-by-side detail panels — the slot next to the table is the anchor; every other panel you opened by hand. Capped at 10.',
    description:
      'The <strong>independent side-by-side multi-panel</strong> behaviour layered on the <a href="#pattern-detail-panel">entity detail panel</a> so a power user can hold and compare several schema entities at once. <strong>Model — independent panels, capped at 10</strong> (redesigned from the old Anchor+Focus cap-2; that parent-child model is retired). Each panel is <strong>self-contained</strong> (own visit-stack, own description-edit state) and <strong>closes independently</strong> — there is no "close both". <strong>The anchor slot:</strong> the panel nearest the table is <em>docked to it</em> — a plain open (a Browse row / <code>schema:openEntity</code>) ALWAYS lands in that panel, never in the focused one and never in a new one, so the answer to "what will this click replace?" is always "the panel by the table". Transience is encoded by <strong>position, not by a badge</strong>: no preview chip, no italic title, no Pin. The anchor’s <strong>header is hatched</strong> (a faint diagonal <code>repeating-linear-gradient</code> + a slightly deeper fill) and has <strong>no drag grip</strong>: the bar you would drag a panel by visibly does not move. It must read as <em>fixed</em>, never as <em>disabled</em> — the panel below stays fully interactive. Deliberately <strong>not</strong> an accent left border: that pixel belongs to the resize grip, whose hover state is the same primary colour. Nothing can be dropped into the anchor’s slot. <strong>Detach</strong> turns it into an ordinary panel and frees the slot for the next row you click. <strong>Open beside:</strong> ⌘/Ctrl-click or middle-click a reference/row (or the picker) opens that entity in a NEW ordinary panel beside — a plain reference click drills <strong>in place</strong> within its panel (push, Miller rule). The focused panel carries <strong>no decoration</strong> — focus is implied by where the user just clicked. There is no top bar and <strong>no rail surface</strong>: the controls (a round ＋ add, the open-count, and the shutter pill 5px further out) simply <strong>float on the leftmost panel’s left edge</strong>, so the drawers keep every pixel of width. The ＋ opens a picker whose <strong>search sits directly under the title</strong>, above a scope-aware <em>Suggested</em> list — <em>This base</em> offers the focused table, the whole base and its sibling tables; <em>All bases</em> offers every base. Panels already open are never suggested. <strong>Cap 10</strong> — opening an 11th evicts the least-recently-focused panel with a one-tap Undo; the anchor is never the victim (it is the one panel the user did not ask for by hand). <strong>Non-modal</strong> — no scrim; the table behind stays visible AND clickable. <strong>Resizable at two levels</strong> — each panel’s left edge line drags its OWN width, while the rail’s <strong>shutter pill</strong> drags the WHOLE stack: left grows it, right shrinks it, every expanded panel snaps to one equal width, and squeezing past the floor parks them one at a time from the left (pulling back out unparks them right to left) instead of collapsing the whole stack at once (auto-fit keeps a table strip visible; a default width persists in localStorage). <strong>Mobile (&lt; 900px)</strong> shows a single full-width column (the focused panel). Everything inside each panel is the unchanged <a href="#pattern-detail-panel">detail-panel canon</a> (header identity + crumbs + identity meta + ordered sections + <a href="#panel-section-nav">section-nav</a> + dual-description Draft→Publish) — this pattern only governs how several panels coexist. Reorder (drag handle) and collapse-to-rail + auto-accordion follow as further increments. A per-panel Compare toggle existed and was <strong>removed</strong> on client feedback — the diff highlight solved no problem he had. <strong>Automations & Interfaces open here too</strong> (client answer): a row on those tabs opens its item as an ordinary stacking panel (same open-beside / rail / undo-close), rendering the shared read body (<code>schemaReadBody.ts</code>); a tagged table/field drills in place, and the panel footer’s Edit/Delete route back to that tab’s existing form. Ported from <code>research/multi-panel-drawer/</code>. Live: <a href="/panels">Panel Lab</a> + <a href="/schema">Schema › Browse</a>.<br><br><strong>The hold slot (Oleh 2026-07-24).</strong> One leading slot in the header answers a single question — <em>how is this panel held?</em> A movable panel shows its drag grip there; the anchored one shows Detach. They are mutually exclusive, so it is always one control in one place, and Detach no longer sits on the right among unrelated actions like open-in-Airtable and close. <strong>The slot is closed until the header is hovered or holds focus</strong>: a grip and a pin do not earn permanent ink, and at rest the title and its icon should start at the edge of the header rather than behind an empty gap. It collapses to <strong>zero width</strong> and opens on hover, nudging the title right — that small movement is what says the control belongs to the panel and not to the content. Collapse it with <code>width: 0</code>, never <code>display: none</code>: the control has to stay in the DOM to stay focusable, or a hover-only affordance quietly becomes keyboard-unreachable, which is also why <code>:focus-within</code> opens it.',
    reference: 'design:components/schema/EntityPanel.astro (.ep-wrap / .ep-rail / .ep-sheet[data-ep-sheet-tpl] / .ep-previewbar / .ep-grip)',
    showCode: false,
    usageDo: [
      'Cap at TEN independent panels; each closes on its own (no "close both"). Opening an 11th evicts the least-recently-focused one with an Undo.',
      'Give the stack a shutter pill on its outer (left) edge: dragging it resizes every expanded panel together AND equalizes their widths. Squeeze past the floor and panels park to rail strips ONE AT A TIME, leftmost first, with the survivors re-sharing the freed width; pulling back out unparks them right to left. Keep the per-panel edge grip for adjusting one panel alone.',
      'A plain open ALWAYS lands in the anchor — the panel next to the table. Never retarget the focused panel: focus is an accident of the last click and must not decide what gets replaced. Mark the anchor by its POSITION (fixed slot) plus a hatched, grip-less header — the surface you drag by, visibly immovable. Never a coloured left border: that pixel is the resize grip’s.',
      '⌘/Ctrl-click or middle-click a reference/row (or the picker) opens a NEW ordinary panel beside. A plain reference click drills in place (push, Miller rule). Back pops that panel’s stack; at the root the × dismisses. Detach frees the anchor slot; the next plain open recreates it.',
'A panel’s BODY may itself be a visit-stack, so one panel can drill through related things without spawning a new panel each time: the Schema entity panel pushes entity→field, the Data changelog drill pushes run→record. A plain click on a row inside the panel PUSHES that view onto the body’s stack with a Back arrow; ⌘/Ctrl-click opens it BESIDE as a new panel instead. Back pops the body’s stack; at the root the × dismisses the panel. This keeps "drill deeper here" and "compare side by side" as two clear, separate gestures rather than one overloaded open.',
      'Float the add (＋, round) + open-count on the leftmost panel’s left edge — no top bar and no rail column stealing width. Don’t decorate the focused panel: focus is implied by where the user just clicked.',
      'In the ＋ picker put the search field directly under the title, then the Suggested list. A scope pill (This base ⇄ All bases) must re-render BOTH the suggestions and the live typeahead results — a pill that only relabels itself reads as broken.',
      'Keep it non-modal: no scrim, the table behind stays visible and clickable. Each panel’s edge line resizes that panel alone (auto-fit keeps a table strip visible; persist a default width).',
      'Below 900px show a single full-width column (the focused panel). Reuse the detail-panel canon verbatim inside every panel — this pattern only adds the multi-panel layout + the anchor slot + open-beside.',
    ],
    usageDont: [
      "Don't cascade closes — a panel’s × closes only that panel; there is no anchor that closes its children.",
      "Don't pile up panels on plain opens — they all land in the anchor; only open-beside creates another panel.",
      "Don't let the anchor be dragged, dropped-into, or evicted by the cap. Its slot IS the rule; a movable anchor teaches nothing.",
      "Don't dim or block the table behind the panels; the multi-panel drawer is non-modal by design.",
      "Don't make ⌘/Ctrl-click the only way to open beside — pair it with a visible affordance (the ⧉ / picker) whose tooltip teaches the shortcut.",
    ],
    examples: [
      {
        html: `
<div class="flex h-64 justify-end gap-0 overflow-hidden rounded-box border border-base-300 bg-base-200/40 text-sm">
  <div class="flex-1 p-3 text-base-content/50">Table stays live behind →</div>
  <div class="flex w-44 flex-col border-l border-base-300 bg-base-100 p-3">
    <div class="text-[11px] font-bold uppercase tracking-wider text-base-content/50">Anchor</div>
    <div class="mt-1 font-medium">Amount</div>
    <div class="mt-1 text-[11px] text-base-content/50">pinned</div>
  </div>
  <div class="relative flex w-48 flex-col border-l border-base-300 bg-base-100 p-3">
    <span class="absolute left-0 top-0 bottom-0 w-0.5 bg-primary"></span>
    <span class="absolute left-0 top-1/2 h-9 w-1.5 -translate-y-1/2 rounded-full bg-primary"></span>
    <div class="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-base-content/50"><span class="iconify lucide--arrow-left size-3.5"></span>Focus</div>
    <div class="mt-1 font-medium">Currency</div>
    <div class="mt-1 text-[11px] text-base-content/50">own back-stack</div>
  </div>
</div>`,
      },
    ],
  },
  {
    id: 'pattern-panel-collapse-rail',
    group: 'Patterns',
    name: 'Panel collapse-to-rail',
    summary: 'Park an open detail panel to a slim vertical rail — icon + rotated name + a close — and click to expand.',
    description:
      'A space-saving state for the <a href="#pattern-multi-panel-drawer">multi-panel drawer</a>: any open panel can <strong>collapse to a ~46px vertical rail</strong> so the user keeps it in the set without spending width on it. The parked strip shows, top-to-bottom, a <strong>✕ close</strong>, the entity <strong>icon tile</strong>, and the <strong>rotated (vertical) name</strong>. <strong>Click the strip body to expand</strong> it back to its full width and state; the top ✕ closes it outright. Two ways to park: the panel header’s <strong>park button</strong> (Lucide <code>chevrons-left</code>), or <strong>dragging the panel’s resize edge narrower than the floor</strong> (~300px) — it snaps to a rail rather than clamping. Parked panels are excluded from the width auto-fit (fixed 46px each) so the expanded panels share the rest. Used both manually and as the overflow state of the <a href="#pattern-panel-accordion">auto-accordion</a>.',
    reference: 'design:components/schema/EntityPanel.astro (.ep-sheet.ep-collapsed / [data-ep-park])',
    showCode: false,
    usageDo: [
      'Show the parked strip as ✕ (top) · icon · rotated name, at ~46px wide. Click the strip to expand; the ✕ closes.',
      'Offer two park triggers: the header park button AND dragging the resize edge below the floor (~300px) so it snaps to a rail.',
      'Exclude parked panels from the width auto-fit (fixed 46px) so expanded panels keep a legible width.',
    ],
    usageDont: [
      "Don't lose the panel’s state on collapse — expanding restores its full stack, description edits, and section-nav.",
      "Don't let a parked strip fall below a legible ~44–46px or drop its close affordance.",
    ],
    examples: [
      {
        html: `
<div class="flex h-56 justify-end overflow-hidden rounded-box border border-base-300 bg-base-200/40 text-sm">
  <div class="flex-1 p-3 text-base-content/50">Table stays live behind →</div>
  <div class="flex w-11 flex-col items-center gap-3 border-l border-base-300 bg-base-200 py-2">
    <span class="iconify lucide--x size-4 text-base-content/50"></span>
    <span class="grid size-6 place-items-center rounded bg-base-100"><span class="iconify lucide--table-2 size-4"></span></span>
    <span class="rotate-180 text-xs text-base-content/70" style="writing-mode: vertical-rl;">Companies</span>
  </div>
  <div class="w-48 border-l border-base-300 bg-base-100 p-3"><div class="font-medium">Amount</div></div>
</div>`,
      },
    ],
  },
  {
    id: 'pattern-panel-accordion',
    group: 'Patterns',
    name: 'Panel auto-accordion (responsive)',
    summary: 'Keep only as many detail panels expanded as fit the viewport; park the rest to rails; rebalance on resize.',
    description:
      'The responsive overflow behaviour for the <a href="#pattern-multi-panel-drawer">multi-panel drawer</a>. Capacity <strong>C = floor(availWidth / minExpandedWidth)</strong> (min expanded ≈ 360px; availWidth = viewport minus the table gap + rail). When the number of <strong>expanded</strong> panels exceeds C, the drawer <strong>auto-parks the least-recently-focused</strong> expanded panels to <a href="#pattern-panel-collapse-rail">rails</a> — never shrinking a panel below legibility, never scrolling a wall of half-panels. Clicking a parked strip <strong>expands it and parks the current LRU</strong> expanded panel, so the expanded count stays = C (an accordion). Capacity is <strong>recomputed on window resize</strong>: widen and a parked panel’s slot frees up; narrow and the LRU parks. On a 13″ / ~1280px screen this yields ~3 expanded + the rest as rails. Below 900px it degrades to a single full-width column (the focused panel).',
    reference: 'design:components/schema/EntityPanel.astro (layout() capacity C + LRU park by seq)',
    showCode: false,
    usageDo: [
      'Compute C = floor(availWidth / ~360) and keep at most C panels expanded; park the least-recently-focused overflow to rails.',
      'On resize, recompute C and rebalance. Clicking a parked strip expands it and parks the current LRU expanded panel.',
      'Track focus recency so "least-recently-focused" means the panel the user has touched least — not just the leftmost.',
    ],
    usageDont: [
      "Don't shrink panels below a legible minimum to cram more in — park to rails instead.",
      "Don't auto-park the panel the user is actively focused on; it is by definition the most-recently-focused.",
    ],
    examples: [
      {
        html: `
<div class="flex h-40 items-stretch justify-end overflow-hidden rounded-box border border-base-300 bg-base-200/40 text-xs">
  <div class="flex-1 p-2 text-base-content/50">C = 2 fit → 2 expanded · rest park →</div>
  <div class="w-40 border-l border-base-300 bg-base-100 p-2"><div class="font-medium">Amount</div></div>
  <div class="w-40 border-l border-base-300 bg-base-100 p-2"><div class="font-medium">Weighted Value</div></div>
  <div class="flex w-9 flex-col items-center gap-2 border-l border-base-300 bg-base-200 py-2"><span class="iconify lucide--table-2 size-4"></span><span class="rotate-180" style="writing-mode: vertical-rl;">Deals</span></div>
  <div class="flex w-9 flex-col items-center gap-2 border-l border-base-300 bg-base-200 py-2"><span class="iconify lucide--database size-4"></span><span class="rotate-180" style="writing-mode: vertical-rl;">Sales CRM</span></div>
</div>`,
      },
    ],
  },
  {
    id: 'panel-section-nav',
    group: 'Patterns',
    name: 'Panel section-nav (progressive)',
    summary: 'A sticky chip-strip of a detail panel’s sections — shown only when the panel is long.',
    description:
      'A <strong>progressive in-panel section-nav</strong> for the <a href="#pattern-detail-panel">entity detail panel</a>: an Airtable-style <strong>horizontal chip-strip</strong> of the panel’s section names, rendered as the <strong>THIRD header row — inside the fixed header, ABOVE its border</strong> (part of the pinned header, so it stays put while the body scrolls), letting a reviewer jump between sections without scrolling. <strong>Progressive by design</strong> — it renders ONLY when the panel has <strong>≥ 4 top-level sections</strong>; shorter panels hide it and stay clean. Each top-level section gets a stable anchor id (<code>ep-sec-&lt;slug&gt;</code>) + a small <code>scroll-margin-top</code>; the strip is built from the SAME section titles just rendered (in order), so the chips always match the body. Clicking a chip scrolls the <code>.ep-body</code> container (never the window) to that section, landing it at the top of the body; a <strong>scroll-spy</strong> (an <code>IntersectionObserver</code> rooted on <code>.ep-body</code>) marks the top-most visible section’s chip <code>.is-active</code>, keeping exactly one active — the observer is disconnected + rebuilt on every body re-render (open / drill / refresh). Chips are <strong>legible SM/12px pills</strong>: an inactive chip is a clear muted label (<code>base-content ~.68</code>, NOT a faint soft badge — those read as invisible in dark mode), hover fills <code>base-200</code>, and the active chip is a <strong>primary-tinted pill with primary text</strong>. When the strip is wider than the header it <strong>scrolls horizontally</strong> and <strong>fades both edges</strong> (a mask, toggled only on real overflow) to signal the scroll, with the active chip auto-scrolled into view. Same jump/scroll-spy idea as the <a href="/handoff">/handoff</a> rail, but scoped inside a scroll-owning panel instead of the page.',
    reference: 'design:components/schema/EntityPanel.astro (.ep-secnav)',
    showCode: false,
    usageDo: [
      'Show the strip ONLY when the panel has ≥ 4 top-level sections — it earns its place on long panels; short panels render nothing.',
      'Build the chips from the SAME section titles you render, in the same order, so the strip always matches the body.',
      'Give every top-level section a stable anchor id + scroll-margin-top so a jumped-to section lands just below the sticky strip.',
      'Scroll the panel’s own container (.ep-body) on a chip click — never the window; root the scroll-spy IntersectionObserver on that same container and keep exactly one chip active.',
      'Rebuild the scroll-spy (disconnect + reconnect) on every body re-render, since the panel body is replaced on open / drill / refresh.',
    ],
    usageDont: [
      'Don’t render the strip on a short panel (< 4 sections) — a jump nav for two sections is noise.',
      'Don’t scroll the window or use a page-level scroll-spy — the panel owns its scroll; anchoring must stay inside it.',
      'Don’t put icons on the chips — they are quiet text pills; keep them SM/12px (never *-xs / ~10px).',
    ],
    examples: [
      {
        html: `
<div class="max-w-sm rounded-box border border-base-300 bg-base-100 p-4">
  <nav class="flex gap-1 overflow-x-auto border-b border-base-200 pb-2" aria-label="Sections">
    <button type="button" class="inline-flex items-center rounded-full border border-base-300 px-2 py-1 text-xs whitespace-nowrap bg-base-200 text-base-content">Descriptions</button>
    <button type="button" class="inline-flex items-center rounded-full border border-base-300 px-2 py-1 text-xs whitespace-nowrap text-base-content/70">Configuration</button>
    <button type="button" class="inline-flex items-center rounded-full border border-base-300 px-2 py-1 text-xs whitespace-nowrap text-base-content/70">Relationships</button>
    <button type="button" class="inline-flex items-center rounded-full border border-base-300 px-2 py-1 text-xs whitespace-nowrap text-base-content/70">Referenced by</button>
    <button type="button" class="inline-flex items-center rounded-full border border-base-300 px-2 py-1 text-xs whitespace-nowrap text-base-content/70">Changelog</button>
  </nav>
  <p class="mt-3 text-sm text-base-content/60">Shown only when the panel has ≥ 4 sections; the active chip tracks the scroll position.</p>
</div>`,
      },
    ],
  },
  {
    id: 'pattern-panel-reorder',
    group: 'Patterns',
    name: 'Panel reorder handle',
    summary: 'Drag a ⠿ grip in a panel header to reorder the open panels — a live sortable swap.',
    description:
      'Open panels in the <a href="#pattern-multi-panel-drawer">multi-panel drawer</a> can be <strong>reordered by dragging a ⠿ grip</strong> (Lucide <code>grip-vertical</code>) in the panel header. The grip is <strong>quiet until the header is hovered</strong>, then brightens. Dragging <strong>live-swaps</strong> the dragged panel past whichever panel the pointer is over (the DOM + the panels array reorder together, re-laying-out on the fly), so it reads like a sortable list rather than a drop-target guess. The dragging panel gets a <strong>dashed accent outline</strong> so the moving item is obvious. Lets a user bring, say, the first and fifth panels side by side to compare. The grip is a distinct affordance from the resize edge line and the park button so the three never conflict.',
    reference: 'design:components/schema/EntityPanel.astro ([data-ep-reorder] / .ep-sheet.ep-dragging)',
    showCode: false,
    usageDo: [
      'Put the ⠿ grip in the header, quiet until header-hover; the whole panel follows the pointer with a dashed accent outline while dragging.',
      'Live-swap on pointer-over (reorder as you cross a neighbour), not a drop-zone at release.',
      'Keep the grip visually and spatially distinct from the resize edge and the park button.',
    ],
    usageDont: [
      "Don't reuse the resize edge or the park button for dragging — three separate affordances, no mode ambiguity.",
      "Don't lose a panel's state (stack, edits, compare) when it changes position.",
    ],
    examples: [
      {
        html: `
<div class="flex h-40 justify-end gap-0 overflow-hidden rounded-box border border-base-300 bg-base-200/40 text-sm">
  <div class="flex w-44 flex-col border-l border-base-300 bg-base-100">
    <div class="flex items-center gap-2 border-b border-base-300 p-2">
      <span class="iconify lucide--grip-vertical size-4 cursor-grab text-base-content/70"></span>
      <span class="font-medium">Amount</span>
    </div>
  </div>
  <div class="flex w-44 flex-col border-l border-base-300 bg-base-100 opacity-60 outline-2 outline-dashed outline-primary">
    <div class="flex items-center gap-2 border-b border-base-300 p-2">
      <span class="iconify lucide--grip-vertical size-4 cursor-grabbing text-base-content"></span>
      <span class="font-medium">Weighted Value</span>
    </div>
    <div class="p-2 text-xs text-base-content/50">dragging…</div>
  </div>
</div>`,
      },
    ],
  },
  {
    id: 'pattern-status-rail',
    group: 'Patterns',
    name: 'Status rail',
    summary: 'The right-hand health column on Home — bespoke, not a primitive.',
    description:
      'The sticky right rail on the Space Home: overall health, the backup pipeline, and usage. It composes primitives (badges, progress) into a product-specific layout no framework ships. Keep the composition bespoke (<code>.hm-rail*</code>); standardize only the primitives inside it. Live: <a href="/">Home</a>.',
    reference: 'views/SpaceHomeView.astro (.hm-rail)',
    showCode: false,
    usageDo: ['Reuse the badge and progress primitives from this catalog inside it.', 'Keep the composition itself custom — it is genuinely ours.'],
    usageDont: ["Don't try to express the rail as a daisyUI primitive — it isn’t one."],
    examples: [
      {
        html: `
<div class="max-w-xs rounded-box border border-base-300 bg-base-100 p-4">
  <span class="badge badge-soft badge-success"><span class="size-1.5 rounded-full bg-current"></span> Healthy</span>
  <p class="mt-1.5 text-sm text-base-content/70">Last backup 2h ago · next in 22h</p>
  <div class="mt-3 border-t border-base-300 pt-3">
    <div class="flex justify-between text-sm"><span class="text-base-content/70">Usage this month</span><span class="font-mono tabular-nums">64%</span></div>
    <progress class="progress progress-primary mt-1.5 w-full" value="64" max="100"></progress>
  </div>
</div>`,
      },
    ],
  },
  {
    id: 'pattern-pipeline',
    group: 'Patterns',
    name: 'Backup pipeline',
    summary: 'The vertical Source → bases → Destination flow — bespoke.',
    description:
      'The pipeline diagram on Home shows the connection as Source → bases → Destination with per-node status chips. It is a product concept, not a generic component — keep it custom (<code>.hm-pipe</code>), and use this catalog’s badge for the per-node status. Live: <a href="/">Home</a> · broken state <a href="/?broken=src">?broken=src</a>.',
    reference: 'components/patterns/BackupPipeline.astro · components/patterns/SpacePipelineHero.astro · views/SpaceHomeView.astro',
    showCode: false,
    usageDo: ['Use a soft status badge for each node’s state.', 'Keep the layout custom — it encodes our data model.'],
    usageDont: ["Don't replace it with a generic stepper — the semantics differ."],
    examples: [
      {
        html: `
<div class="flex max-w-[220px] flex-col text-sm">
  <div class="flex items-center justify-between rounded-box border border-base-300 bg-base-100 px-3 py-2">
    <span>Airtable</span><span class="badge badge-soft badge-success badge-sm">Connected</span>
  </div>
  <div class="mx-auto h-4 w-px bg-base-300"></div>
  <div class="flex items-center justify-between rounded-box border border-base-300 bg-base-100 px-3 py-2">
    <span>3 bases</span><span class="badge badge-soft badge-primary badge-sm">Active</span>
  </div>
  <div class="mx-auto h-4 w-px bg-base-300"></div>
  <div class="flex items-center justify-between rounded-box border border-base-300 bg-base-100 px-3 py-2">
    <span>Google Drive</span><span class="badge badge-soft badge-success badge-sm">Connected</span>
  </div>
</div>`,
      },
    ],
  },
  {
    id: 'pattern-audit-table',
    group: 'Patterns',
    name: 'Audit tables',
    summary: 'The Backups drill-down tables (run → base → tables) — bespoke layout on the table primitive.',
    description:
      'The audit trail composes the <a href="#table">table</a> primitive with per-row status, counts, captured-depth chips and a destination link into a layout specific to backup auditing. The table styling is standard; the columns and drill-down are ours. Live: <a href="/backups">Backups</a>.',
    reference: 'components/patterns/MetaBlock.astro · views/BackupRunDetailView.astro · views/BackupRunBaseView.astro',
    showCode: false,
    usageDo: ['Build on the table primitive; keep numbers font-mono + tabular.', 'Use soft badges for per-row status.'],
    usageDont: ["Don't invent a non-table layout for tabular audit data."],
    examples: [
      {
        html: `
<table class="table">
  <thead>
    <tr class="text-xs uppercase tracking-wider">
      <th>Base</th><th>Status</th><th class="text-right">Records</th><th>Captured</th><th>Destination</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td class="font-medium">Sales</td>
      <td><span class="badge badge-soft badge-success badge-sm">Done</span></td>
      <td class="text-right font-mono tabular-nums">128,400</td>
      <td><span class="badge badge-soft badge-primary badge-sm">Schema</span> <span class="badge badge-soft badge-primary badge-sm">Data</span></td>
      <td class="font-mono text-xs text-primary">/Backups/Sales ↗</td>
    </tr>
    <tr>
      <td class="font-medium">Eng</td>
      <td><span class="badge badge-soft badge-error badge-sm">Failed</span></td>
      <td class="text-right font-mono tabular-nums">—</td>
      <td><span class="text-base-content/55">—</span></td>
      <td><span class="text-base-content/55">—</span></td>
    </tr>
  </tbody>
</table>`,
      },
    ],
  },
  {
    id: 'pattern-row-actions',
    group: 'Patterns',
    name: 'Clickable row (chevron + hover actions)',
    summary: 'The ONE way an openable row behaves — hover bg, a persistent grey chevron, and hover-revealed action icons that collapse to a ⋯ menu.',
    description:
      'Every row that opens a detail uses this one anatomy, so nothing reads as a mishmash (the app used to mix "Details →" text links, a hover chevron, and a ⋯ menu). The whole row is <strong>clickable</strong> with a hover background (<code>.row-clickable</code>, <code>role="button"</code>, keyboard-focusable). Its trailing edge, right to left: a <strong>persistent quiet grey chevron</strong> (<code>.row-go</code>, <code>lucide--chevron-right</code>) that is <em>always</em> visible so openability is self-evident, brightening on hover; and — <strong>revealed on hover</strong> — the row\'s contextual <strong>action icons</strong> (<code>.row-actions</code>, ghost icon-buttons, <code>opacity 0 → 1</code>) to the chevron\'s left. When there are <strong>more than two actions</strong> they collapse into a <strong>⋯ dropdown</strong> (<code>.row-menu</code>) instead of a loud icon row. Whole-row click / Enter / Space opens the detail (same target as the chevron); the action icons and ⋯ <code>stopPropagation()</code> and do their own thing. Generalises two earlier one-offs: Relationships\' grey chevron-on-hover and Automations/Interfaces\' pencil+trash reveal. The classes are global (<code>styles/components/row-actions.css</code>) so every table adopts them instead of reinventing the look. Live: <a href="/backups">Backups</a>, <a href="/reports">Reports</a>, <a href="/schema">Schema</a>.',
    reference: 'styles/components/row-actions.css',
    showCode: true,
    usageDo: [
      'Make the whole row clickable and keyboard-focusable; the chevron and the row open the same detail.',
      'Keep the chevron persistent (quiet grey), so a row advertises that it opens without needing a hover.',
      'Reveal contextual actions on hover to the chevron\'s left; collapse to a ⋯ menu when there are more than two.',
      'stopPropagation on every action icon so it does not also trigger the row\'s open.',
    ],
    usageDont: [
      "Don't use a trailing \"Details →\" / \"Open →\" text link — that's what this replaces.",
      "Don't hide the chevron until hover (openability should be visible at rest), and don't leave five loose icons in a row (use ⋯).",
    ],
    examples: [
      {
        label: 'A clickable row — persistent chevron, two hover actions',
        html: `
<table class="table text-sm" style="max-width:560px">
  <tbody>
    <tr class="row-clickable" role="button" tabindex="0">
      <td><span class="badge badge-soft badge-success badge-sm">Healthy</span></td>
      <td class="font-medium">Jul 6 – Jul 13, 2026</td>
      <td>
        <span class="row-end">
          <span class="row-actions">
            <button class="btn btn-sm btn-ghost btn-square" aria-label="Export"><span class="iconify lucide--download size-4"></span></button>
            <button class="btn btn-sm btn-ghost btn-square" aria-label="Copy link"><span class="iconify lucide--link size-4"></span></button>
          </span>
          <span class="row-go" aria-hidden="true"><span class="iconify lucide--chevron-right size-4"></span></span>
        </span>
      </td>
    </tr>
    <tr class="row-clickable" role="button" tabindex="0">
      <td><span class="badge badge-soft badge-error badge-sm">Failed</span></td>
      <td class="font-medium">Jun 29 – Jul 6, 2026</td>
      <td>
        <span class="row-end">
          <span class="row-actions"><button class="btn btn-sm btn-ghost btn-square" aria-label="Retry"><span class="iconify lucide--rotate-ccw size-4"></span></button></span>
          <span class="row-go" aria-hidden="true"><span class="iconify lucide--chevron-right size-4"></span></span>
        </span>
      </td>
    </tr>
  </tbody>
</table>`,
      },
    ],
  },
  {
    id: 'pattern-report',
    group: 'Patterns',
    name: 'Report document',
    summary: 'The sectioned periodic report — a header status strip over collapsible section cards, every reference clickable.',
    description:
      'The Reports detail view renders one <em>report per period</em>: a document that answers "what happened since the last report", not a live dashboard. It is a bespoke composition on existing primitives (like <a href="#pattern-audit-table">audit tables</a> and <a href="#pattern-status-rail">the status rail</a> are), so keep the composition custom (<code>.rpt-*</code>) and standardize only the primitives inside it. Anatomy, top to bottom: (1) a <strong>named window</strong> heading — the literal date range + "since last report", never a rolling "now"; (2) a header <a href="#pattern-metric-tiles">metric-tile strip</a> where each tile carries its <strong>delta vs the prior report</strong> (a number without a delta is decoration); (3) the <strong>four fixed section cards</strong> — Backup summary · Connection health · Schema health · Documentation updates — each on one grammar: a <strong>one-line muted aggregate</strong> (the section\'s unique numbers, NOT the header tiles restated) → a <strong>column-headed table</strong> of itemized rows → an explicit <strong>"No issues this period" line</strong> when empty. Every table carries real column headers and right-aligns its numeric columns (<code>tabular-nums</code>) sharing a left anchor (the status badge) and a right anchor (numbers + chevron) — that shared grid is what makes the report read as vertical guidelines rather than scattered numbers. Do NOT restate a header-strip number as a nested metric box inside a section (that duplication is the anti-pattern this replaced). A section is <em>never omitted</em>: an absent section is indistinguishable from "the report didn\'t run". Every referenced element is interactive and keeps the report as the spine — <strong>schema elements open the shared <a href="#pattern-entity-panel">EntityPanel</a></strong> in place (dispatch <code>schema:openEntity</code>, identical to Schema/Docs), while genuinely separate objects (a backup run, a doc) navigate. <strong>Reports v2 (client 2026-07-13):</strong> a report is a <strong>named, saved DEFINITION</strong> — the sections it covers, the bases it scopes to, and its time window — <em>separate</em> from the <strong>schedule</strong> (when/who/format), which is embedded 1:1 on the report. So <code>/reports</code> is a list of <em>definitions</em> (not artifacts — <a href="#pattern-audit-table">audit tables</a> applied), each opening its report page (<code>/reports/[id]</code>) with three tabs (client 2026-07-14): <strong>Most Recent</strong> (default — the latest run rendered inline for instant value, reusing this document + the shared EntityPanel), <strong>History</strong> (the run trail; a run row opens the rendered document at <code>/reports/run/[runId]</code>, whose breadcrumb goes <em>Reports / ‹report› / ‹window›</em> back to the parent report, not the top list), and <strong>Settings</strong> (name · section checkboxes · base scope · window · the one schedule) shown beside a <strong>live preview</strong> that renders the report using <em>current data</em> and reacts as you toggle sections / base scope (own <code>.rpd-prev-*</code> classes; labelled "using current data (not a saved run)"). A Space auto-has a default "Full &lt;Space&gt; Report"; duplicate a report for a second cadence. Two more includable sections (client 2026-07-14): <strong>Trends</strong> — a grid of compact metric cards (records/tables/fields/attachments/automations/interfaces) that expand to a full <a href="#pattern-trend-chart">trend chart</a> (ApexCharts) with the legend toggling per-base lines — and <strong>Data health</strong> — a Zoho-style record-data + attachment-data split (per-base record counts + storage), a shell that refines after the Data page. Live: <a href="/reports">Reports</a>. Components: <code>views/ReportsView.astro</code> (list) · <code>views/ReportDefinitionView.astro</code> (report page) · <code>views/ReportDetailView.astro</code> (a run).',
    reference: 'design:views/ReportDefinitionView.astro (.rpd) · views/ReportDetailView.astro (.rpt) · views/ReportsView.astro (.rpl)',
    showCode: false,
    usageDo: [
      'Print the literal window ("Jul 6 – Jul 13, 2026 · since last report") and give every headline number a delta vs the prior report.',
      'Use the metric-tile strip for the header (the single at-a-glance), then the "one-line aggregate → column-headed table → explicit empty line" grammar for every section; give every table real column headers and right-align numeric columns for shared vertical guidelines.',
      'State "No issues this period" as an affirmative line inside the card when a section is empty — never omit the section, never an empty-state illustration.',
      'Open schema references with the shared EntityPanel (schema:openEntity) so the drill-in feels identical to the rest of the app; navigate only for separate objects (run detail, doc).',
    ],
    usageDont: [
      "Don't render a rolling live-dashboard window — a report is pinned to a named period.",
      "Don't omit an empty section, and don't show a bare number without a delta.",
      "Don't build a second detail surface for schema elements — reuse the one EntityPanel.",
      "Don't restate a header-strip metric as a nested box inside a section, and don't leave a data table without column headers.",
    ],
    examples: [
      {
        label: 'A section card — one-line aggregate → column-headed table (numbers right-aligned)',
        html: `
<div class="rounded-box border border-base-300 bg-base-100 overflow-hidden" style="max-width:560px">
  <div class="flex items-center gap-2 border-b border-base-300 px-4 py-2.5">
    <span class="iconify lucide--database-backup size-4 opacity-70" aria-hidden="true"></span>
    <span class="font-semibold text-sm">Backup summary</span>
    <span class="badge badge-soft badge-success badge-sm ml-auto"><span class="size-1.5 rounded-full bg-current"></span>Healthy</span>
  </div>
  <div class="flex flex-wrap items-baseline gap-2 border-b border-base-300 bg-base-200/40 px-4 py-2 text-xs">
    <span class="inline-flex items-baseline gap-1"><span class="text-base-content/55">Runs</span><span class="font-semibold tabular-nums">14</span><span class="text-success tabular-nums">+2</span></span>
    <span class="inline-flex items-baseline gap-1"><span class="text-base-content/30">·</span><span class="text-base-content/55">Failed</span><span class="font-semibold tabular-nums">1</span><span class="text-error tabular-nums">+1</span></span>
    <span class="inline-flex items-baseline gap-1"><span class="text-base-content/30">·</span><span class="text-base-content/55">Volume</span><span class="font-semibold tabular-nums">2.4 GB</span></span>
  </div>
  <table class="table text-sm">
    <thead><tr>
      <th class="text-[11px] uppercase tracking-wide text-base-content/50">Status</th>
      <th class="text-[11px] uppercase tracking-wide text-base-content/50">Base</th>
      <th class="text-[11px] uppercase tracking-wide text-base-content/50 text-right">Records</th>
      <th class="text-[11px] uppercase tracking-wide text-base-content/50 text-right">Size</th>
    </tr></thead>
    <tbody>
      <tr>
        <td><span class="badge badge-soft badge-success badge-sm">Backed up</span></td>
        <td class="font-medium">Sales CRM</td>
        <td class="text-right tabular-nums text-base-content/70">128,400</td>
        <td class="text-right tabular-nums text-base-content/64">1.4 GB</td>
      </tr>
      <tr>
        <td><span class="badge badge-soft badge-error badge-sm">Failed</span></td>
        <td class="font-medium">Operations</td>
        <td class="text-right tabular-nums text-base-content/70">—</td>
        <td class="text-right tabular-nums text-base-content/64">—</td>
      </tr>
    </tbody>
  </table>
</div>`,
      },
      {
        label: 'The affirmative empty line (a section with nothing to report)',
        html: `
<div role="alert" class="alert alert-success alert-soft">
  <span class="iconify lucide--circle-check size-4" aria-hidden="true"></span>
  <span>No connection issues this period.</span>
</div>`,
      },
    ],
  },
  {
    id: 'pattern-trend-chart',
    group: 'Patterns',
    name: 'Trend chart',
    summary: 'The one charting primitive — a themed ApexCharts line/area, as a compact sparkline or a full chart.',
    description:
      'The <strong>single</strong> way we draw a metric over time. It wraps <strong>ApexCharts</strong> — the vendored theme donor (<code>@opensided/theme</code>) ships apex line/bar examples, so it is the design-system-aligned charting lib (not a hand-rolled SVG, not a second library). We use the vanilla <code>apexcharts</code> package inside an Astro island (no <code>react-apexcharts</code> — avoids React-19 peer friction), and colours are read from our <code>--color-*</code> tokens at render, so a chart follows light/dark like everything else. Two variants: <strong>compact</strong> (a sparkline — no axes, grid or legend; sits inside a metric card) and <strong>full</strong> (axes + grid + legend + tooltip; the legend toggles per-series lines, which is how "Overall vs by base" is offered without a custom control). <code>format</code> renders a plain count or a byte size. First consumer: the report\'s <strong>Trends</strong> section (records/tables/fields/attachments/automations/interfaces over time) as a grid of compact metric cards that expand to the full chart (Supabase pattern), and the <strong>Data health</strong> section. Component: <code>components/ui/TrendChart.astro</code>. When you need a chart, use THIS — do not add another chart library or hand-roll SVG.',
    reference: 'design:components/ui/TrendChart.astro · apexcharts (theme donor)',
    showCode: false,
    usageDo: [
      'Use TrendChart for every time-series chart; pass series + categories and pick compact (sparkline) or full.',
      'Let the full chart\'s legend toggle per-base series instead of building a custom Overall/By-base switch.',
      'Keep colours as token names (primary/success/…) so the chart stays on-theme in light and dark.',
    ],
    usageDont: [
      "Don't add a second charting library or hand-roll an SVG line chart — this primitive is the catalog answer.",
      "Don't hardcode hex colours into a chart; drive them from --color-* tokens.",
    ],
    examples: [
      {
        label: 'A compact metric card (sparkline) that expands to the full chart',
        html: `
<details class="rounded-box border border-base-300 bg-base-100 overflow-hidden" style="max-width:320px">
  <summary class="flex items-center justify-between gap-3 px-3 py-2 cursor-pointer" style="list-style:none">
    <span class="flex flex-col"><span class="text-xs text-base-content/60">Records</span><span class="text-base font-semibold tabular-nums">44,900 <span class="text-xs text-success">+2.7k</span></span></span>
    <span class="text-base-content/40 text-xs">▾</span>
  </summary>
  <div class="border-t border-base-300 p-2 text-xs text-base-content/50">TrendChart (full) renders here on expand.</div>
</details>`,
      },
    ],
  },
  {
    id: 'pattern-recipient-input',
    group: 'Patterns',
    name: 'Recipient input (email chips)',
    summary: 'Add report recipients as chips — Space members (avatar) and arbitrary external emails (envelope), Gmail mechanics.',
    description:
      'The recipient field for a report schedule. Two chip kinds in one input: a <strong>Space member</strong> (picked from an autocomplete, shown with an avatar) and an <strong>arbitrary external email</strong> (free-typed, shown with an envelope) — because the primary user is an agency emailing a client who is not in their Space. Gmail token mechanics: commit a chip on <strong>Enter · Tab · comma · blur</strong>; a pasted blob splits on comma / semicolon / whitespace / newline into one chip each; each entry is <strong>validated and de-duplicated</strong> on commit; an invalid address becomes a <strong>red, editable chip</strong> (click to fix) rather than being silently dropped; <strong>✕ or Backspace-at-empty</strong> removes. A <strong>live count</strong> of recipients (no hard cap — the spec sets none). Because chips are injected at runtime, the styles are <code>is:global</code> (unique <code>.rcp-</code> prefix), per our Astro-scoping rule. Component: <code>components/reports/RecipientInput.astro</code>. ASSUMPTION(reports C2): external emails are unrestricted in V1 — the privacy guard (warning / allowlist) is an open client question.',
    reference: 'design:components/reports/RecipientInput.astro',
    showCode: false,
    usageDo: [
      'Support both a member chip (avatar, from autocomplete) and an external chip (envelope, free-typed) so senders can tell who is internal.',
      'Commit on Enter/Tab/comma/blur; accept a pasted list and split it into chips; validate + de-dupe on commit.',
      'Turn an invalid address into a red editable chip, not a silent drop; show a live count of recipients.',
    ],
    usageDont: [
      "Don't validate only on submit — commit-time feedback per chip is the point.",
      "Don't silently discard an invalid or duplicate entry.",
    ],
    examples: [
      {
        label: 'A recipient field with a member chip, an external chip, and an invalid one',
        html: `
<div class="rounded-box border border-base-300 bg-base-100 p-2" style="max-width:460px">
  <div class="flex flex-wrap items-center gap-1.5">
    <span class="badge badge-soft badge-primary gap-1"><span class="iconify lucide--user-round size-3"></span>Reese D.<span class="iconify lucide--x size-3 opacity-60"></span></span>
    <span class="badge badge-ghost gap-1"><span class="iconify lucide--mail size-3"></span>client@acme.co<span class="iconify lucide--x size-3 opacity-60"></span></span>
    <span class="badge badge-soft badge-error gap-1"><span class="iconify lucide--triangle-alert size-3"></span>not-an-email<span class="iconify lucide--x size-3 opacity-60"></span></span>
    <input class="grow bg-transparent px-1 py-0.5 text-sm outline-none" placeholder="Add people or emails…" style="min-width:8rem" />
  </div>
  <div class="mt-1.5 flex justify-end px-1 text-[11px] text-base-content/50 tabular-nums">3 / 20</div>
</div>`,
      },
    ],
  },
  {
    id: 'pattern-report-schedule',
    group: 'Patterns',
    name: 'Report schedules',
    summary: 'The per-Space report delivery schedules — a rows list + an editor (cadence incl. "after every backup", recipients, format).',
    description:
      'The <strong>Schedules</strong> sub-view of the Reports page (a <code>[ Reports · Schedules ]</code> tab toggle on <code>/reports</code>). It manages the automated delivery of reports: a Space can have several schedules for different audiences. It is a bespoke composition on primitives (like <a href="#pattern-report">the report document</a> is). Two layers: a <strong>rows list</strong> on the catalog <a href="#table">table</a> — Name · Cadence (plain-English) · Recipients (<a href="#pattern-recipient-input">chips</a> as avatars +N) · Format · an Enabled <a href="#checkbox-toggle">toggle</a> · Last delivery status · ⋯ (Edit / Duplicate / Delete) — and an <strong>editor</strong> in field order <em>Name → Cadence → Format → Recipients → suppress-empty → Save</em>. <strong>Cadence is a segmented control <code>[ After every backup | Daily | Weekly | Monthly ]</code></strong> with progressive disclosure: the event option hides the day/time fields; Weekly reveals a day-of-week, Monthly a day-of-month, and the time-based ones a time — with a plain-English echo and a "Next report: Mon Jul 20, 09:00" preview. Trigger (when it fires) is distinct from the report window (what it covers — always "since the last report"). A <strong>"Don\'t send if nothing changed"</strong> toggle (default on for the event cadence) avoids spammy empty sends. NO gating wall — the full spectrum shows (ASSUMPTION(reports C3): pricing/limited-tier behaviour is layered later). Component: <code>views/ReportsView.astro (.rps)</code> + <code>components/reports/RecipientInput.astro</code>.',
    reference: 'design:views/ReportsView.astro (.rps)',
    showCode: false,
    usageDo: [
      'Make cadence a segmented control where "After every backup" is a first-class option that hides the day/time fields.',
      'Echo the schedule in plain English and preview the next run; the trigger is separate from the "since last report" window.',
      'List multiple schedules as rows (Name · Cadence · Recipients · Format · Enabled · Last delivery · ⋯); open an editor to add/edit.',
      'Offer a "don\'t send if nothing changed" toggle, default on for the after-every-backup cadence.',
    ],
    usageDont: [
      "Don't gate the schedules behind an upgrade wall in this build — show the full spectrum; cost affordances are local, per-action.",
      "Don't conflate the trigger cadence with the report window (the window is always since the last report).",
    ],
    examples: [
      {
        label: 'A schedule row + the cadence segmented control',
        html: `
<div class="rounded-box border border-base-300 bg-base-100 overflow-hidden" style="max-width:620px">
  <table class="table text-sm">
    <thead><tr class="text-xs uppercase tracking-wider text-base-content/60"><th>Name</th><th>Cadence</th><th>Recipients</th><th>Format</th><th>Enabled</th></tr></thead>
    <tbody>
      <tr>
        <td class="font-medium">Weekly client report</td>
        <td class="text-base-content/70">Every Mon · 09:00</td>
        <td class="text-base-content/70">4 recipients</td>
        <td><span class="badge badge-sm badge-ghost">PDF</span></td>
        <td><input type="checkbox" class="toggle toggle-sm toggle-primary" checked /></td>
      </tr>
    </tbody>
  </table>
  <div class="border-t border-base-300 p-3">
    <div role="tablist" class="tabs tabs-box tabs-sm w-fit">
      <span role="tab" class="tab tab-active">After every backup</span><span role="tab" class="tab">Daily</span><span role="tab" class="tab">Weekly</span><span role="tab" class="tab">Monthly</span>
    </div>
    <p class="mt-2 text-xs text-base-content/60">Sends a report as soon as each backup finishes. Next report: after the next backup.</p>
  </div>
</div>`,
      },
    ],
  },
  {
    id: 'pattern-setup-stepper',
    group: 'Patterns',
    name: 'Setup stepper',
    summary: 'The Space-setup wizard stepper — bespoke, gated for first-run.',
    description:
      'The multi-step Space setup (Source → Destination → Bases → Depth → Schedule) is a gated linear flow for onboarding, with a free-jump edit mode afterwards. It is a product flow, not a primitive — keep it custom, and use this catalog’s inputs, selects and buttons for the controls inside each step. Live: <a href="/welcome">Welcome</a>.',
    reference: 'views/IntegrationsSetupWizard.astro',
    showCode: false,
    usageDo: ['Use catalog primitives for the controls in each step.', 'Gate the stepper for first-run; allow free-jump editing after.'],
    usageDont: ["Don't reuse the gated stepper for routine edits — that’s the free-jump mode."],
    examples: [
      {
        html: `
<div class="flex flex-wrap items-center gap-2 text-sm">
  <span class="flex items-center gap-2"><span class="grid size-5 place-items-center rounded-full bg-primary text-xs text-primary-content">✓</span> Source</span>
  <span class="h-px w-6 bg-base-300"></span>
  <span class="flex items-center gap-2"><span class="grid size-5 place-items-center rounded-full bg-primary text-xs text-primary-content">2</span> Destination</span>
  <span class="h-px w-6 bg-base-300"></span>
  <span class="flex items-center gap-2 text-base-content/55"><span class="grid size-5 place-items-center rounded-full border border-base-300 text-xs">3</span> Bases</span>
  <span class="h-px w-6 bg-base-300"></span>
  <span class="flex items-center gap-2 text-base-content/55"><span class="grid size-5 place-items-center rounded-full border border-base-300 text-xs">4</span> Depth</span>
</div>`,
      },
    ],
  },
  {
    id: 'pattern-table-toolbar',
    group: 'Patterns',
    name: 'Table toolbar & pagination',
    summary: 'Search, filters and a pager wrapped around a data table — the run-history pattern.',
    description:
      'When a table grows, wrap it in a toolbar (search + filters) above and a pager below. Search is an <a href="#input">Input</a>; each filter is a <strong>faceted dropdown</strong> — a daisyUI <code>dropdown</code> of <a href="#checkbox-toggle">checkboxes</a> with a selected-count badge on its trigger (the shadcn <em>DataTableFacetedFilter</em> pattern; cf. Deel / Profound). Multi-select where it helps (status, trigger), a single range for date; a red Clear with an × resets everything. The pager is a <a href="#select">Select</a> + prev/next <a href="#button">Buttons</a>. Filter client-side in the prototype; the real app pushes it to the query. Live: <a href="/backups">Backups</a>. <strong>Shared with the <a href="#pattern-data-grid">Data ▸ Browse record grid</a> (Oleh 2026-07-23)</strong>, which used to scroll on an opaque cursor — same pager construction, but the default page size is per-surface (Backups 20, the record grid 50). <strong>Shared with the Data ▸ Changelog run list and its per-run drill (Oleh 2026-07-23)</strong> — the drill\'s prior bespoke "page N of M" pager (hardcoded 50/page, no rows control) was reconciled onto this same construction; page size stays per-surface (run list 20, drill 25).<br><br><strong>ONE component, not a copied construction (2026-07-24).</strong> The pager had been hand-copied into four places (Backups, the record grid, the Changelog run list, the Changelog drill) before it was asked for across every Schema tab too — so it is now a real element: <code>components/ui/TablePager.astro</code> for the markup and <code>components/ui/tablePager.ts</code> (<code>createPager</code>) for the behaviour. The helper owns the whole contract: the window is applied to the <strong>already filtered + sorted</strong> list, the page clamps when a shrinking set would leave it blank, <code>page</code> is ephemeral (a reload starts at page 1) and <code>pageSize</code> is a <strong>user preference</strong> under its own storage key — never part of a preset, view config or dirty diff. Any change to search, filter, sort or mode resets to page 1. Build a new paged surface by mounting the component and calling <code>createPager</code>; do not re-type the markup. <strong>Every surface is on it (2026-07-24).</strong> The four pre-existing hand-copies were migrated in the same stretch — Backups, the Data record grid, the Changelog run list and its per-run drill — so there is exactly one pager in the codebase, not one plus four look-alikes. Two mount styles, same markup: a server-rendered surface uses <code>&lt;TablePager /&gt;</code> + <code>createPager</code>; a surface that rebuilds its own body as innerHTML uses <code>pagerHtml(state)</code> and keeps its own page state — that is the Changelog drill, where every open panel pages independently while rows-per-page stays one shared preference. The drill\'s tighter lead-in is a modifier (<code>tpg-tight</code>, 4px instead of 12 because it sits under a panel header), not a second copy of the rule. Migrating Backups also gave it persisted rows-per-page, which the hand-typed version never had. Per-surface page sizes: Backups 20 · Data record grid 50 · Changelog run list 20 · Changelog drill 25 · Schema Browse (Flat) 50 · Schema Automations / Interfaces / Relationships 25 · Schema Changelog 20.<br><br><strong>The selected segment is soft-primary (Oleh 2026-07-24).</strong> A segmented toggle (Tree/Flat, the Visualize mode switch) used to mark its selection with <code>base-200</code> on a <code>base-100</code> row — grey on grey, which simply got lost, and that is not good enough for a control that now leads the toolbar and states what you are looking at. It reuses the language the app already has for <em>"this control is doing something"</em>: the same soft-primary fill, border and text as an <a href="#pattern-faceted-filter">active facet</a> — not a fourth blue. <strong>The icon follows the text colour</strong> rather than staying white: an icon disagreeing with its own label would be unique in the app.<br><br><strong>Order follows cause (Oleh 2026-07-24).</strong> A control that <em>redefines the controls after it</em> belongs BEFORE them, not in the right cluster. Schema ▸ Visualize proved it: its mode switch (Data / Relationships / Automations &amp; Interfaces) sat last, yet switching it <strong>replaces the filter set</strong> — Data offers Bases/Tables/Field types/Field visibility/Relationships, Relationships offers Bases/Tables/Relationship types, the app layer offers Bases/Node types, and only <em>Bases</em> survives all three. Reading left to right, the user configured filters and only then met the control that had decided what those filters were. It now leads the row, followed by a divider. The test is whether the control changes what the others MEAN: a <strong>scope</strong> switch leads; a <strong>display</strong> toggle that renders the same data differently (Tree/Flat on Browse and Relationships) stays in the right cluster.<br><br><strong>Where a pager is the wrong control:</strong> a <em>hierarchy</em> cannot be paged — slicing rows 51–100 out of a base ▸ table ▸ field tree cuts a table in half and orphans its fields. Schema Browse therefore pages its <strong>Flat</strong> mode only; Tree stays whole (Oleh 2026-07-23).',
    reference: 'components/patterns/RegistryTable.astro · views/BackupsListView.astro',
    showCode: false,
    usageDo: [
      'Search by stable identifiers (run id, error message) for support triage.',
      'Filter by attributes the row actually owns — status, trigger, date.',
      'Show a distinct “no matches” state, separate from the never-run empty state.',
      'Mount <code>TablePager</code> + <code>createPager</code> for any new paged list — the default page size is the only per-surface decision.',
      'Page the filtered set, and reset to page 1 whenever search, filter, sort or mode changes.',
    ],
    usageDont: [
      "Don't filter by something that isn’t a per-row fact (e.g. base — that’s current config, not a run snapshot).",
      "Don't paginate the search out of reach — keep it pinned above the table.",
      "Don't hand-copy the pager markup into a new surface — that is how four near-identical idioms appeared; import the component.",
      "Don't page a tree. Slicing a hierarchy orphans children from their parent — page the flat view, or cap per node.",
    ],
    examples: [
      {
        html: `
<div class="rounded-box border border-base-300 bg-base-100">
  <div class="flex flex-wrap items-center gap-2 border-b border-base-300 p-3">
    <label class="input input-sm max-w-[180px]">
      <span class="iconify lucide--search size-4 opacity-50"></span>
      <input type="search" class="grow" placeholder="Search runs or errors" />
    </label>
    <div class="dropdown">
      <div tabindex="0" role="button" class="btn btn-sm btn-neutral gap-1.5" style="background:color-mix(in oklch,var(--color-primary) 14%,transparent);border-color:color-mix(in oklch,var(--color-primary) 30%,transparent);color:var(--color-primary)">Status <span class="badge badge-xs badge-primary">2</span> <span class="iconify lucide--chevron-down size-3 opacity-50"></span></div>
      <div tabindex="0" class="dropdown-content z-[1] mt-1.5 w-48 rounded-box border border-base-300 bg-base-100 p-1.5 shadow-lg">
        <label class="flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 text-sm hover:bg-base-200"><input type="checkbox" class="checkbox checkbox-primary checkbox-xs" checked /> Succeeded</label>
        <label class="flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 text-sm hover:bg-base-200"><input type="checkbox" class="checkbox checkbox-primary checkbox-xs" checked /> Failed</label>
        <label class="flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 text-sm hover:bg-base-200"><input type="checkbox" class="checkbox checkbox-primary checkbox-xs" /> Running</label>
      </div>
    </div>
    <button class="btn btn-sm btn-neutral gap-1.5">Trigger <span class="iconify lucide--chevron-down size-3 opacity-50"></span></button>
    <button class="btn btn-sm btn-neutral gap-1.5">Date <span class="iconify lucide--chevron-down size-3 opacity-50"></span></button>
    <button class="btn btn-sm btn-ghost text-error gap-1"><span class="iconify lucide--x size-3.5"></span>Clear</button>
  </div>
  <table class="table">
    <thead><tr class="text-xs uppercase tracking-wider"><th>Status</th><th>Run</th><th class="text-right">Records</th></tr></thead>
    <tbody>
      <tr><td><span class="badge badge-soft badge-success badge-sm">Backed up</span></td><td class="font-mono text-sm">run_8f2a1c</td><td class="text-right font-mono tabular-nums">420,318</td></tr>
      <tr><td><span class="badge badge-soft badge-error badge-sm">Failed</span></td><td class="font-mono text-sm">run_7b1d04</td><td class="text-right font-mono tabular-nums">—</td></tr>
    </tbody>
  </table>
  <div class="flex flex-wrap items-center justify-between gap-2 border-t border-base-300 p-3 text-sm">
    <div class="flex items-center gap-2 text-base-content/70"><span>Rows</span><select class="select select-sm"><option>20</option><option>50</option></select></div>
    <div class="flex items-center gap-2"><span class="font-mono tabular-nums text-base-content/55">1–20 of 50</span><button class="btn btn-ghost btn-sm" disabled>Prev</button><button class="btn btn-outline btn-sm">Next</button></div>
  </div>
</div>`,
      },
    ],
  },
  {
    id: 'pattern-node-showmore',
    group: 'Patterns',
    name: 'Show more (inside a tree node)',
    summary: 'What a hierarchy gets instead of a pager: each node reveals its children in chunks.',
    description:
      'A tree cannot take a <a href="#pattern-table-toolbar">pager</a> — slicing rows 51–100 out of base ▸ table ▸ field cuts a table away from its own fields. But a tree is not automatically bounded either: on Schema Browse, typing in the search <strong>auto-expands every matching base</strong>, so a query like <em>id</em> against a wide schema unfolds hundreds of field rows at once. The bound therefore goes <strong>per node</strong>: a table shows its first N fields and a <code>Show 25 more of 340</code> row underneath; clicking reveals the next chunk, never the whole tail. It reads as one row of the list, not a control bar — a full-width ghost button flush with the rows it extends, sized like them.<br><br>The cap counts <strong>visible</strong> children, so it composes with the filters rather than fighting them: filter to 12 matches and the row disappears, because there is no tail left to hide. Any change to search or filters <strong>resets every node to the first chunk</strong> — same rule as a pager returning to page 1. This also fixes the case that has nothing to do with search: manually expanding a 900-field table used to render 900 rows.',
    reference: 'design:components/schema/SchemaBrowse.astro',
    showCode: false,
    usageDo: [
      'Cap the children of a node, not the nodes themselves — the parent must always keep at least some of its own children.',
      'Say what is left, not just "more": <code>Show 25 more of 340</code> tells the user the size of the tail.',
      'Reset every node to its first chunk when the search or filters change.',
    ],
    usageDont: [
      "Don't reveal the whole tail in one click — that is the unbounded render the cap exists to prevent.",
      "Don't put a pager inside a tree; page the flat view instead (see the table-toolbar entry).",
      "Don't style it as a toolbar or a card — it is one more row in the list, or it reads as the end of the list.",
    ],
    examples: [
      {
        label: 'A table node capped at 3 of 340 fields',
        html: `
<div class="rounded-box border border-base-300 bg-base-100 p-2 text-sm">
  <div class="flex items-center gap-2 px-2 py-1.5 font-medium"><span class="iconify lucide--table-2 size-4"></span>Contacts</div>
  <div class="flex items-center gap-2 px-2 py-1.5 pl-8 text-base-content/80"><span class="iconify lucide--type size-4 opacity-60"></span>Name</div>
  <div class="flex items-center gap-2 px-2 py-1.5 pl-8 text-base-content/80"><span class="iconify lucide--mail size-4 opacity-60"></span>Email</div>
  <div class="flex items-center gap-2 px-2 py-1.5 pl-8 text-base-content/80"><span class="iconify lucide--calendar size-4 opacity-60"></span>Created</div>
  <button class="btn btn-ghost btn-sm w-full justify-start gap-2 pl-8 font-normal text-base-content/60"><span class="iconify lucide--chevron-down size-4"></span>Show 25 more of 340</button>
</div>`,
      },
    ],
  },
  {
    id: 'pattern-numbered-form-steps',
    group: 'Patterns',
    name: 'Numbered form steps',
    summary: 'A long form says its order with numbered section headings — nothing more.',
    description:
      'When a form runs past one screen it stops reading as a task and starts reading as a wall: the New report form is eight field groups and about one and a half screens tall (Oleh 2026-07-24). The fix is the smallest one that works — <strong>group the fields into three or four named sections and number the headings</strong>: <em>① What it covers · ② When it sends · ③ Where it goes</em>. The numeral says "these are filled top to bottom" and that is the entire job. It is drawn in the app&apos;s <strong>soft-primary</strong> — the same 14% fill and primary text an active facet uses — while the heading TEXT stays muted: at a plain grey border the numeral vanished into the uppercase label it sits in front of (Oleh 2026-07-24). Only the number lifts, so the section still reads as a label rather than a badge.<br><br><strong>A sticky step rail beside the form was built first and rejected.</strong> It tracked the current step by scroll position and ticked completed ones — more machinery than the problem deserved, and a second column competing with a form that had just been given the width back. Oleh\'s call, and the right one: the headings already existed, so numbering them was enough.<br><br><strong>It is not a wizard and must not become one.</strong> No Next, nothing hidden, every field reachable — the same view also EDITS an existing record, where stepping through screens to change one field is worse than the wall was. For a genuine gated flow use the <a href="#pattern-setup-stepper">setup stepper</a>.',
    reference: 'design:views/ReportDefinitionView.astro (.rpd-step-h / .rpd-step-n)',
    showCode: false,
    usageDo: [
      'Group a long form into three or four sections with plain-language names, then number them.',
      'Lift the numeral with soft-primary and leave the heading text muted — the number is what carries the ordering.',
      'Order the sections the way the work actually happens, so the numbers describe rather than instruct.',
    ],
    usageDont: [
      "Don't add a rail, a progress bar or completion ticks — that was tried here and was more than the problem needed.",
      "Don't gate or hide anything behind the numbers; a numbered heading is a label, not a step you must pass.",
      "Don't number every field — three or four sections, or the numbers stop meaning anything.",
    ],
    examples: [
      {
        label: 'Numbered section headings',
        html: `
<div class="flex flex-col gap-5 rounded-box border border-base-300 bg-base-100 p-5" style="max-width:420px">
  <div class="flex flex-col gap-2">
    <h3 class="flex items-center gap-2 text-[12px] font-bold uppercase tracking-wider opacity-45"><span class="grid size-5 place-items-center rounded-full border border-base-300 text-[11px] font-semibold tracking-normal opacity-60">1</span>What it covers</h3>
    <input class="input input-sm w-full" placeholder="e.g. Full Sales CRM Report" />
  </div>
  <div class="flex flex-col gap-2 border-t border-base-300 pt-5">
    <h3 class="flex items-center gap-2 text-[12px] font-bold uppercase tracking-wider opacity-45"><span class="grid size-5 place-items-center rounded-full border border-base-300 text-[11px] font-semibold tracking-normal opacity-60">2</span>When it sends</h3>
    <label class="flex items-center gap-2 text-sm"><input type="radio" name="demo-cad" class="radio radio-sm radio-primary" checked /> On each data backup</label>
  </div>
</div>`,
      },
    ],
  },
  {
    id: 'pattern-segmented-control',
    group: 'Patterns',
    name: 'Segmented control',
    summary: 'A mutually-exclusive choice shown as one row of options — and ONE way to show which is chosen.',
    description:
      'A segmented control switches <em>how</em> or <em>over what scope</em> the same body renders — Tree/Flat, Edit/Read, Names/Types/Categories. It is <strong>not</strong> navigation: if each option owns its own content panel, page or document, that is a <a href="#tabs">Tab</a>, and tabs are styled separately. It is not a form value either — a choice that gets submitted is a radio.<br><br><strong>The selected option is soft-primary, everywhere (Oleh 2026-07-24).</strong> An audit found nine of these across the app speaking three different visual languages, and the worst of them marked selection with <code>base-200</code> on <code>base-100</code> plus bold text — roughly 2% lightness apart, which is no signal at all. The one recipe is the same the app already uses for an <a href="#pattern-faceted-filter">active facet</a>: <strong>soft-primary fill, primary text, and the icon inheriting that text colour</strong>. Never grey-on-grey, never weight alone.<br><br><strong>Two densities, one language.</strong> Both carry the identical selected colours; they differ only in the frame around them:<br>· <strong>Bordered</strong> — daisyUI <code>join</code>, classes <code>sch-tb-modes</code> / <code>sch-tb-mode-active</code>. For a toolbar, where the control sits among other bordered buttons. Note <code>join</code> pulls each segment 1px onto its neighbour, so the selected one takes <code>z-index: 1</code> and an <strong>opaque</strong> border (mixed with the surface, not with transparent) — a translucent one lets the page show through the neighbour\'s line and the divider appears to vanish.<br>· <strong>Track</strong> — classes <code>sb-segtrack</code> / <code>sb-seg-on</code>. A padded <code>base-200</code> track holding borderless buttons, for tight places: inside a dropdown, a panel, a filter menu. A bordered join at 340px reads as heavy furniture.<br><br><strong>Accessibility:</strong> if the markup says <code>role="tab"</code> it must maintain <code>aria-selected</code> — several of these toggled a class only, so a screen reader was told "tab" and never which one was current. Where there is no tabpanel, prefer <code>role="group"</code> + <code>aria-pressed</code>.',
    reference: 'styles/global.css (.sch-tb-modes / .sb-segtrack)',
    showCode: false,
    usageDo: [
      'Use it when every option is visible at once and they render the SAME body differently.',
      'Pick the density by where it sits: bordered in a toolbar, track inside a dropdown or panel.',
      'Keep <code>aria-selected</code> (or <code>aria-pressed</code>) in step with the visual selection.',
    ],
    usageDont: [
      "Don't mark the selection with grey-on-grey or with font-weight alone — that is not a state, it is a hope.",
      "Don't invent a third look. Nine controls re-derived this one because nothing said where the recipe lived.",
      "Don't use it for navigation: if the option owns a content panel or a route, it is a Tab.",
    ],
    examples: [
      {
        label: 'Bordered (toolbar) and track (inside a dropdown) — same selected colours',
        html: `
<div class="flex flex-col items-start gap-4">
  <div class="join">
    <button class="btn btn-sm join-item" style="background:var(--color-base-100);border-color:var(--color-base-300)"><span class="iconify lucide--list-tree size-4"></span>Tree</button>
    <button class="btn btn-sm join-item" style="position:relative;z-index:1;background:color-mix(in oklch,var(--color-primary) 14%,transparent);color:var(--color-primary);border-color:color-mix(in oklch,var(--color-primary) 30%,var(--color-base-100));font-weight:600"><span class="iconify lucide--table size-4"></span>Flat</button>
  </div>
  <div style="display:inline-flex;gap:2px;padding:3px;border-radius:9px;background:var(--color-base-200)">
    <button class="btn btn-sm btn-ghost" style="border:0">Names</button>
    <button class="btn btn-sm" style="border:0;background:var(--color-base-100);color:var(--color-primary);font-weight:600;box-shadow:0 1px 2px oklch(0 0 0/.08)">Types</button>
    <button class="btn btn-sm btn-ghost" style="border:0">Categories</button>
  </div>
</div>`,
      },
    ],
  },
  {
    id: 'pattern-settings-row',
    group: 'Patterns',
    name: 'Settings row',
    summary: 'Label, description and control on one line — the unit a settings hub is built from.',
    description:
      'A settings hub is a long list of one repeating shape: <strong>what this is</strong> (a label), <strong>what it does</strong> (a line of description, because a setting whose consequence you have to guess is a trap), and <strong>the control</strong>, right-aligned so a column of controls scans as a column. Everything else on the page is grouping around that unit.<br><br><strong>Section header</strong> — a heading, one line of helper text, and an optional action on the right. It names a group of rows; it is not a card, so rows underneath keep a single left edge to read down.<br><br><strong>Permission-gated section (spec 12).</strong> Many settings are admin-only, and the wrong answer is letting a non-admin click through to a 403. Mark the section with an <em>Admin only</em> <a href="#badge">Badge</a>, disable its controls, and say who CAN change it — "Ask your Org admin" — rather than hiding it, so the setting is discoverable and the route to changing it is obvious.<br><br><strong>Placeholder rows are allowed, dishonest ones are not.</strong> While a hub is being built the controls may be inert, but the row must not imply a working setting: mark the section, not each control, and never show a toggle in a state that suggests a saved preference that does not exist.',
    reference: 'design:views/SettingsView.astro (.set-row)',
    showCode: false,
    usageDo: [
      'Give every row a one-line description — the label alone rarely says what changing it does.',
      'Right-align controls so they form a scannable column.',
      'Gate by permission visibly: badge the section, disable the control, and name who can change it.',
    ],
    usageDont: [
      "Don't wrap each row in its own card — a hub becomes a wall of boxes and the rows stop lining up.",
      "Don't hide admin-only settings from non-admins; hiding makes them unfindable and the ask unclear.",
      "Don't ship an inert control that looks live — an unmarked toggle is a promise the page can't keep.",
    ],
    examples: [
      {
        label: 'A section header and two rows, one of them admin-gated',
        html: `
<div class="flex flex-col gap-4" style="max-width:560px">
  <div class="flex items-start justify-between gap-4">
    <div><h3 class="text-base font-semibold">Notifications</h3><p class="text-sm opacity-60">Which events reach you, and where.</p></div>
    <button class="btn btn-sm btn-neutral">Send test</button>
  </div>
  <div class="flex items-center justify-between gap-6 border-t border-base-300 py-3">
    <div><div class="text-sm font-medium">Backup failed</div><div class="text-[13px] opacity-55">Email you when a run does not finish.</div></div>
    <input type="checkbox" class="toggle toggle-sm toggle-primary" checked />
  </div>
  <div class="flex items-center justify-between gap-6 border-t border-base-300 py-3 opacity-60">
    <div><div class="flex items-center gap-2 text-sm font-medium">Billing email <span class="badge badge-sm badge-ghost">Admin only</span></div><div class="text-[13px] opacity-55">Ask your Org admin to change this.</div></div>
    <input class="input input-sm w-48" value="billing@acme.com" disabled />
  </div>
</div>`,
      },
    ],
  },
  {
    id: 'pattern-breakpoints',
    group: 'Patterns',
    name: 'Breakpoint ladder',
    summary: 'Three tiers, measured — not thirteen numbers invented one surface at a time.',
    description:
      'Thirteen different breakpoints had accumulated — 480 · 560 · 600 · 640 · 720 · 760 · 860 · 899.98 · 900 · 1023 · 1024 · 1100 · 1500 — including <strong>900 and 899.98 for the same idea</strong> (so Docs stacked one pixel before the record panel did) and <strong>1023 against 1024</strong> (the Inbox switched a pixel early). Three tiers now, chosen from measurements rather than habit (Oleh 2026-07-24):<br><br>· <strong>≥ 1600 — wide.</strong> Every toolbar fits fully expanded. The minimums, measured with search and labels open: Interfaces 1239 · Automations 1252 · Changelog 1316 · Browse 1541 · Relationships 1592.<br>· <strong>1024–1599.98 — laptop.</strong> A 13-inch MacBook lands here at 1440. The toolbar search collapses to its icon and secondary buttons drop their labels. That is not a promise of one row: the Data toolbar still wraps down to about 1350 and Schema Browse to about 1200 — pre-existing, and the next thing to measure.<br>· <strong>&lt; 1024 — narrow.</strong> Single column, panels take the width, <code>isMobile()</code>.<br><br><strong>A surface that cannot live at a tier gets simplified, not its own number.</strong> Visualize needed 1773px to fit expanded — 230px of that was three labelled mode buttons — so its segmented control is permanently icon-only rather than earning a fourth breakpoint. Below 1024 per-surface stacking rules (560, 640, 720…) are still allowed: that range is about fitting one column, not about the app\'s layout tiers.<br><br>The tier also has to be honoured in <strong>JS</strong>, not only CSS: <code>isMobile()</code> lives as a <code>matchMedia</code> literal in the two panel hosts AND as a default inside <code>createPanelStack</code>. That default was missed and still read <code>innerWidth &lt; 900</code>, so for 124px the Schema panel rendered its mobile CSS while its controller ran desktop logic — the exact bug this paragraph warns about, shipped by the commit that wrote it.',
    reference: 'styles/global.css (the ladder comment) + components/ui/collapsingSearch.ts',
    showCode: false,
    usageDo: [
      'Pick a tier. If a layout needs a value between tiers, simplify the layout instead.',
      'Measure before choosing: what does this row actually need at its widest?',
      'Keep the JS matchMedia literals in step with the CSS — a tier that exists in only one of them is a bug waiting.',
    ],
    usageDont: [
      "Don't invent a breakpoint for one surface — that is how thirteen appeared.",
      "Don't write 900 and 899.98 for the same boundary; pick the .98 form once and reuse it.",
      "Don't force a control visible at a tier without checking what the layout does there — below 1024 the sidebar is an off-canvas drawer, so its collapse toggle belongs to the OPEN drawer, not to the closed one where it rendered as a 14px orphan.",
    ],
    examples: [
      {
        label: 'The ladder',
        html: `
<div class="flex flex-col gap-2 text-sm">
  <div class="flex items-center gap-3"><span class="font-mono text-xs opacity-60" style="width:96px">&ge; 1600</span><span class="h-8 flex-1 rounded bg-base-300"></span><span class="opacity-70">wide — everything expanded</span></div>
  <div class="flex items-center gap-3"><span class="font-mono text-xs opacity-60" style="width:96px">1024–1600</span><span class="h-8 rounded bg-base-300" style="width:68%"></span><span class="opacity-70">laptop — search collapses, labels drop</span></div>
  <div class="flex items-center gap-3"><span class="font-mono text-xs opacity-60" style="width:96px">&lt; 1024</span><span class="h-8 rounded bg-base-300" style="width:38%"></span><span class="opacity-70">narrow — one column, full-width panels</span></div>
</div>`,
      },
    ],
  },
  {
    id: 'pattern-side-panel-width',
    group: 'Patterns',
    name: 'Side-panel widths',
    summary: 'One scale for every rail and drawer, chosen by what the panel holds.',
    description:
      'Rails and drawers were sized one surface at a time and drifted to five different numbers — 220 · 256 · 264 · 300–340 · 320–380 — which is how Schema ▸ Docs ended up squeezing its own document to a <strong>61-character line</strong> (the bottom of the comfortable 60–75 range) while the list rail sat at its maximum. Two rails took 604px between them and left 499px for the thing the page exists to show (Oleh 2026-07-24).<br><br><strong>The scale</strong> (tokens in <code>global.css</code>, on the 4px grid) — pick a step by WHAT THE PANEL HOLDS, and when it is a close call the content column\'s readability wins:<br>· <code>--rail-s</code> <strong>240px</strong> — chips and short labels (Docs tagged entities, the Data preset rail)<br>· <code>--rail-m</code> <strong>280px</strong> — a title plus one line of meta (the Docs list, Chat threads)<br>· <code>--rail-l</code> <strong>360px</strong> — rows carrying numbers or bars (Health navigation)<br>· <code>--drawer-w</code> <strong>480px</strong> — an overlay drawer OVER the page, not a column beside it<br><br><strong>A rail is navigation and stays fixed; a drawer is a work surface and may be resized</strong> — EntityPanel, RecordPanel and the Changelog drill each persist their own. Note that a stacked drawer takes its width from <code>createPanelStack</code> at layout time, so <code>DEFW</code> is the real default and the CSS token is only the pre-JS fallback; <code>MINW</code> and <code>TABLEGAP</code> stay per-surface, which is configuration rather than drift. Result on Docs at 1440: the list drops 340 → 280, tagged entities 264 → 240, and the document goes 499 → 583px — a 73-character line.',
    reference: 'styles/global.css (--rail-s / --rail-m / --rail-l / --drawer-w)',
    showCode: false,
    usageDo: [
      'Pick a step from the scale; if none fits, argue the case and add a step rather than a one-off number.',
      'Size the rail by its content, then check what is LEFT for the content column — a rail at its maximum next to prose at its minimum is the wrong trade.',
      'Keep rails fixed. Reach for a resize handle only where the panel is a work surface.',
    ],
    usageDont: [
      "Don't hand-tune a width for one surface — that is exactly how five numbers appeared.",
      "Don't let two rails flank one column without checking the reading measure that remains (60–75 characters).",
      "Don't set a drawer's default in CSS alone: a stacked drawer is sized by createPanelStack, and the stylesheet value is only the fallback before it mounts.",
    ],
    examples: [
      {
        label: 'The scale',
        html: `
<div class="flex flex-col gap-2 text-sm">
  <div class="flex items-center gap-3"><span class="h-8 rounded bg-base-300" style="width:120px"></span><span class="font-mono text-xs opacity-60">--rail-s 240</span><span class="opacity-70">chips, short labels</span></div>
  <div class="flex items-center gap-3"><span class="h-8 rounded bg-base-300" style="width:140px"></span><span class="font-mono text-xs opacity-60">--rail-m 280</span><span class="opacity-70">title + one line of meta</span></div>
  <div class="flex items-center gap-3"><span class="h-8 rounded bg-base-300" style="width:180px"></span><span class="font-mono text-xs opacity-60">--rail-l 360</span><span class="opacity-70">rows with numbers or bars</span></div>
  <div class="flex items-center gap-3"><span class="h-8 rounded bg-primary/25" style="width:240px"></span><span class="font-mono text-xs opacity-60">--drawer-w 480</span><span class="opacity-70">overlay drawer</span></div>
</div>`,
      },
    ],
  },
  {
    id: 'pattern-collapsing-search',
    group: 'Patterns',
    name: 'Collapsing search (narrow toolbars)',
    summary: 'Below a width threshold the toolbar search shrinks to its icon and expands over the filters on focus.',
    description:
      'The shared <a href="#pattern-table-toolbar">toolbar</a> puts a search box, a divider, the faceted filters and a right-hand action cluster on ONE row. On a 1440-wide laptop that row no longer fits — measured on Schema ▸ Browse it needs 1167px in a 1121px toolbar — so it wraps to two rows and the page grows a ragged second line of controls (Oleh 2026-07-23). The search is the widest single item (300px) and the least often used, so below the threshold it <strong>collapses to its magnifier icon</strong> and expands back to a full field, <strong>overlaying the filters</strong>, while it has focus — and collapses the moment it loses focus, <em>even if it still holds a query</em>. Above the threshold nothing changes — on a 27" display there is no reason to hide a search box.<br><br><strong>It needs no new markup.</strong> Every toolbar search already carries <code>data-sch-search</code> on its input and is wrapped in a daisyUI <code>&lt;label class="input"&gt;</code>, so a click on the collapsed icon focuses the input <em>natively</em> — collapse is CSS, expansion is the browser\'s own label behaviour, and a few lines of JS only track the open state. The existing <kbd>/</kbd> shortcut keeps working untouched for the same reason: it calls <code>.focus()</code>, and focus is what expands the field.<br><br><strong>An active search collapses like any other (Oleh 2026-07-24).</strong> The first version kept the field open while it held a query, so an active search would not go unnoticed. That was the wrong trade: search and filter are used <em>together</em> — you search, then narrow — so a permanently expanded field permanently covered the control you reach for next. The state was already spoken for twice over in the same toolbar (the <em>"Showing 11 of 108"</em> count and the red Clear), so the collapsed icon only has to carry it: a tinted magnifier with a dot, and a tooltip holding the query. One click reopens it with the text intact.<br><br><strong>Threshold is a viewport media query, deliberately, not a container query.</strong> A container query would be more precise — the toolbar wraps because of ITS width, which also changes when the sidebar collapses — but <code>container-type: inline-size</code> applies layout containment, and this toolbar has already been the source of three stacking regressions. The precise version is the upgrade to make once the toolbar is otherwise quiet.',
    reference: 'styles/global.css (.sch-tb-search) + components/ui/collapsingSearch.ts',
    showCode: false,
    usageDo: [
      'Collapse the widest, least-frequent control first — a search you open on purpose, not a filter you read at a glance.',
      'Expand over the filters, never by pushing them — the row must not reflow while the user is aiming at it.',
      'Collapse it again as soon as it loses focus — even mid-search — so the filters are never blocked; mark the collapsed icon as active instead.',
    ],
    usageDont: [
      "Don't collapse on wide screens — hiding a control that fits is a cost with no benefit.",
      "Don't collapse the filters instead: they carry state (a selected count) that must stay readable.",
      "Don't add a bespoke toggle button — the label already focuses the input, and a second control would drift from the / shortcut.",
    ],
    examples: [
      {
        label: 'Collapsed (narrow) → expanded over the filters',
        html: `
<div class="flex flex-col gap-3">
  <div class="flex items-center gap-2 rounded-box border border-base-300 bg-base-100 p-2">
    <button class="btn btn-sm btn-square btn-ghost"><span class="iconify lucide--search size-4"></span></button>
    <span class="h-5 w-px bg-base-300"></span>
    <button class="btn btn-sm btn-neutral gap-1.5">Bases <span class="iconify lucide--chevron-down size-3 opacity-50"></span></button>
    <button class="btn btn-sm btn-neutral gap-1.5">Type <span class="iconify lucide--chevron-down size-3 opacity-50"></span></button>
    <button class="btn btn-sm btn-neutral gap-1.5">Status <span class="iconify lucide--chevron-down size-3 opacity-50"></span></button>
  </div>
  <div class="relative flex items-center gap-2 rounded-box border border-base-300 bg-base-100 p-2">
    <button class="btn btn-sm btn-neutral gap-1.5 invisible">Bases</button>
    <label class="input input-sm absolute left-2 z-10 w-[min(420px,80%)]">
      <span class="iconify lucide--search size-4 opacity-55"></span>
      <input type="search" class="grow" placeholder="Search bases, tables, fields…" />
      <kbd class="kbd kbd-sm opacity-50">/</kbd>
    </label>
  </div>
</div>`,
      },
    ],
  },
  {
    id: 'pattern-faceted-filter',
    group: 'Patterns',
    name: 'Faceted filter',
    summary: 'The one filter control used everywhere: a dropdown trigger with a count + a "filter working" active state.',
    description:
      'Every filter across the app is this single control, so nothing reads as a mishmash. The trigger is a <strong>bordered <a href="#button">Button</a></strong> (matches the look of a <a href="#select">Select</a>) with a small chevron; when the filter is doing something it switches to a <strong>primary-tinted active state</strong> and shows a count <a href="#badge">Badge</a> inside the button. Two modes: <strong>multi-select</strong> opens a dropdown of rows = name-left + a daisyUI <a href="#checkbox-toggle">toggle</a> right (the row fades when off), with <em>Show all / Hide all</em> (disabled at the extremes) and an <code>n/total</code> count; <strong>single-select</strong> opens a list of radios and the trigger shows the chosen value (e.g. "Added"). A red <a href="#button">Clear</a> with an × resets every filter at once. Every popover opens with a <strong>Search box</strong> (placeholder <code>Search</code>, a leading magnifier) that filters the rows in place and hides empty group headings — present on every facet so they all read the same. Rows that list a <strong>base or table</strong> carry the same <strong>health status dot</strong> (success / warning / error) the tree and Visualize canvas use, so the dropdowns are consistent across tabs. Field-type rows carry the vendored Airtable icon. Component: <code>components/schema/FacetFilter.astro</code> (Astro, self-wiring via a bubbling <code>facetchange</code> event) and the React twin in the Visualize island — kept visually identical. Live: <a href="/schema">Schema</a> (Browse + Visualize + Changelog), <a href="/backups">Backups</a>. <strong>The styles are global</strong> (<code>styles/components/facet-filter.css</code>), not scoped to <code>FacetFilter.astro</code> — a second surface can then render the same <code>ff-trigger</code> / <code>ff-panel</code> / <code>ff-opt</code> classes instead of copying the look. The <a href="#pattern-inbox">Inbox</a> filter menu does exactly that: it needs lane-aware rows and a command row, which the component cannot host, so it reuses the construction. The trigger always states what it is doing: it tints primary (<code>ff-on</code>) and shows a count of active filters, because a narrowed list that looks unnarrowed is indistinguishable from an empty one. <strong>Locked scope (Dan 2026-07-23):</strong> a single-select SCOPE picker can be <em>locked</em> — on the Data page a Preset\'s Base and Table lock the moment the preset is first saved, because changing either would invalidate the filter that was saved with it. A locked trigger stays <strong>visible and in place</strong>, rendered disabled (<code>btn-disabled</code> + <code>aria-disabled</code>) with its chevron swapped for <code>lucide--lock</code>, and the REASON lives in a daisyUI <a href="#tooltip">tooltip</a> — so the answer to "what am I looking at" survives, and the answer to "why can\'t I change it" is one hover away. Never hide a locked scope and never explain it with a native <code>title=</code>. <strong>Workspace-grouped headings (workspace-visual-grouping):</strong> a multi-select Bases facet can opt into <code>groupToggles</code> — the same grouping the "Manage bases" picker (<code>components/integrations/BaseSelectionTable.astro</code>) uses. Build <code>groups</code> with <code>groupByWorkspace</code> (<code>components/schema/workspaceGroups.ts</code>), splitting bases by their Airtable workspace, name-ordered, with a final "Workspace unknown" bucket for anything the engine could not attribute. With <code>groupToggles</code> set AND more than one group, the facet renders a <strong>checkbox tree</strong> (redesigned with Oleh 2026-07-27 for one consistent control language — no more checkbox-for-the-group + toggle-for-each-base mishmash). Each <code>FacetGroup.label</code> is a <strong>shaded header band</strong> — left to right: a <strong>collapse chevron</strong>, a <strong>tri-state parent checkbox</strong> (a neutral <a href="#checkbox-toggle">checkbox</a> — checked / indeterminate-dash / empty reflects the group\'s items and flips them all on change), a muted <strong>layers glyph</strong> (the compact "this is a workspace grouping" signal — the verbose "· Airtable workspace" text is NOT repeated here; it stays on the picker/canvas), the group name, and a muted <strong>"N of M"</strong> count. The bases are <strong>checkbox leaves</strong>, indented beneath, that fade when unchecked — <em>no health dots</em> (the filter is uniform on every tab; health lives in the tree / Health tab). The trailing bucket for bases with no workspace reads <strong>"No workspace"</strong>. A single-group facet (one workspace, or none) ignores <code>groupToggles</code> and renders the plain flat list, unchanged — zero regression for a single-workspace estate. <strong>Placeholder workspace names (base-picker-workspace-grouping, Dan 2026-07-28):</strong> Airtable returns the workspace <em>ID</em> on every base regardless of access scope, but the workspace <em>name</em> only comes with full-environment access. A group that has an id but no name renders as <strong>"Workspace N"</strong> (numbered stably by id), keeps its "Airtable workspace" identity, and gains an <strong>inline rename</strong> (a pencil swaps the name for an editable field; the alias persists by workspace id server-side) plus an <strong>"Open in Airtable"</strong> link to identify which one it is. <strong>Superseded on the picker (2026-07-28)</strong> — the picker used to carry ONE consolidated limited-access alert band above the table; that band is gone and the fact now sits in the group header itself. <strong>Re-reversed 2026-07-29:</strong> the picker DOES group by default again — it groups itself the moment the per-base lookup completes, and its <em>Group by workspace</em> toggle is on by default. See <a href="#pattern-base-picker">Base picker (progressive workspace grouping)</a> before copying any of that into a facet. A group on/off toggle is still deliberately NOT in the FACET — a facet groups whenever it is handed groups, and the picker\'s toggle exists because it decides whether auto-add is set per workspace or per connection, a consequence a facet does not have. <strong>De-cluttered 2026-07-28 (Oleh audit):</strong> the picker had grown FOUR stacked "future automation" surfaces above the table — a standing auto-enroll card, a tinted per-workspace auto-add MACRO card, a bridge suggestion alert, and per-header switches — which duplicated each other and buried the actual job (pick bases). Now there are exactly TWO levels, and they are told apart by what they act on: a standing <strong>"Auto-enroll new workspaces"</strong> card (a whole new WORKSPACE appearing in Airtable — the one general option, kept on the picker), and <strong>auto-add as a table COLUMN</strong> (new BASES inside a workspace already enrolled). The placeholder group\'s "Open in Airtable" jump-out was cut — leaving the flow mid-setup to identify a workspace costs more than it gives, and the bases listed inside the group already identify it. <strong>Auto-add is a column, not a floating action (Oleh 2026-07-28):</strong> the bulk control had three failed homes — a tinted macro card, a toolbar button, then a caption-line link — and each time it read as a mysterious THIRD setting because nothing tied it to the switches it drives. It now lives in the sticky column header beside <em>Tables</em> / <em>Fields</em>: the header cell is the label <strong>AUTO-ADD</strong> plus the <strong>master toggle</strong>, and every workspace\'s own toggle sits in that same column directly beneath it (all three row kinds share one grid template, so the fixed right-hand columns stay in one line despite the deeper indent on base rows). Naming the column once removes the per-row text label; each toggle then carries a <a href="#tooltip">tooltip</a> naming its workspace. The master is <strong>bidirectional</strong>: it flips every workspace, and it mirrors them back — all on = checked, none = unchecked, <strong>mixed = <code>indeterminate</code></strong>, which daisyUI paints on a toggle natively by centring the knob (<code>.toggle:indeterminate</code>). Clicking a mixed master turns everything ON, matching the group select-all convention. <strong>One fact, one place:</strong> the per-row "· Airtable workspace" text was dropped once the caption above the table said it — the caption, the <em>Workspace / base</em> column header and the Airtable glyph were already three statements of the same thing, and a fourth as row text fought the provenance badges for the same strip and truncated the names. The wording now lives in the glyph\'s <a href="#tooltip">tooltip</a>: repeated signal removed, the answer still one hover away.',
    reference: 'design:components/schema/FacetFilter.astro',
    showCode: false,
    usageDo: [
      'Use this one control for ALL filters — multi-select (toggles) or single-select (radios) — never a bare native select next to it.',
      'Show the active state (primary tint) + count the moment a filter is applied, so a working filter is obvious.',
      'Keep the count inside the trigger button (n/total for multi; the chosen value for single).',
      'Offer Show all / Hide all on multi facets and a single red Clear that resets everything.',
      'Open every popover with a Search box (placeholder "Search") and give base/table rows the health status dot, so all dropdowns match.',
      'For a single-select SCOPE picker (e.g. Base / Table on the Data page), pass an optional leading concept icon (`triggerIcon`, a Lucide class) so the trigger reads as "a base" / "a table", not a bare value.',
      'When a scope is LOCKED, keep its trigger visible and in place — render it disabled (`btn-disabled` + `aria-disabled`), swap the chevron for `lucide--lock`, and put the reason in a daisyUI tooltip. The user still needs to read what the scope IS, and to learn in one hover what to do instead (duplicate the preset, or start a new one).',
      'For a multi-select Bases facet across a multi-workspace estate, pass `groupToggles` and build `groups` with `groupByWorkspace` — a collapse chevron + tri-state group checkbox + k/n count per workspace, "Workspace unknown" last, single-workspace estates staying flat.',
    ],
    usageDont: [
      "Don't mix styles — no native select beside the faceted buttons (that was the bug this pattern fixes).",
      "Don't drop the active state; a filtered facet that looks identical to an empty one is a defect.",
      "Don't put the control on the left of the row label — name left, toggle/radio right, everywhere.",
      "Don't HIDE a locked scope, and don't explain the lock with a native `title=` — the trigger stays put, disabled, with the reason in a daisyUI tooltip. A scope that vanishes when it locks destroys the user's sense of place.",
    ],
    examples: [
      {
        label: 'Triggers — default · active multi (n/total) · active single (value) · locked scope',
        html: `
<div class="flex flex-wrap items-center gap-2" style="padding:1.25rem 1rem">
  <div class="btn btn-sm gap-1.5" style="background:var(--color-base-100);border-color:var(--color-base-300);font-weight:400">Bases <span class="iconify lucide--chevron-down size-3 opacity-55"></span></div>
  <div class="btn btn-sm gap-1.5" style="background:color-mix(in oklch,var(--color-primary) 13%,transparent);border-color:color-mix(in oklch,var(--color-primary) 35%,transparent);color:var(--color-primary);font-weight:400">Field types <span class="badge badge-sm badge-primary">13/14</span> <span class="iconify lucide--chevron-down size-3 opacity-55"></span></div>
  <div class="btn btn-sm gap-1.5" style="background:color-mix(in oklch,var(--color-primary) 13%,transparent);border-color:color-mix(in oklch,var(--color-primary) 35%,transparent);color:var(--color-primary);font-weight:400">Added <span class="iconify lucide--chevron-down size-3 opacity-55"></span></div>
  <div class="tooltip tooltip-bottom" data-tip="Locked — this preset is saved. Duplicate it, or start a new one, to use another table.">
    <div class="btn btn-sm btn-disabled gap-1.5" aria-disabled="true" style="font-weight:400"><span class="iconify lucide--table-2 size-3.5 opacity-55"></span>Contacts <span class="iconify lucide--lock size-3 opacity-55"></span></div>
  </div>
  <button class="btn btn-sm btn-ghost text-error gap-1"><span class="iconify lucide--x size-3.5"></span>Clear</button>
</div>`,
      },
      {
        label: 'Open dropdowns — multi (toggles + Show/Hide all) · single (radios)',
        html: `
<div class="flex flex-wrap gap-6" style="padding:1rem 1rem 5rem">
  <div style="width:232px" class="rounded-box border border-base-300 bg-base-100 p-1.5 shadow-lg text-sm">
    <div class="flex gap-1 px-0.5 pb-1.5">
      <button class="btn btn-xs btn-ghost gap-1 px-2 text-primary"><span class="iconify lucide--eye size-3.5"></span>Show all</button>
      <button class="btn btn-xs btn-ghost gap-1 px-2"><span class="iconify lucide--eye-off size-3.5"></span>Hide all</button>
    </div>
    <label class="flex items-center gap-2 rounded-md px-1.5 py-1 hover:bg-base-200"><span class="size-1.5 rounded-full bg-success"></span><span class="grow truncate font-medium">Sales CRM</span><input type="checkbox" class="toggle toggle-sm toggle-primary" checked /></label>
    <label class="flex items-center gap-2 rounded-md px-1.5 py-1 hover:bg-base-200" style="opacity:.45"><span class="size-1.5 rounded-full bg-warning"></span><span class="grow truncate font-medium">Marketing</span><input type="checkbox" class="toggle toggle-sm toggle-primary" /></label>
    <label class="flex items-center gap-2 rounded-md px-1.5 py-1 hover:bg-base-200"><span class="size-1.5 rounded-full bg-error"></span><span class="grow truncate font-medium">Operations</span><input type="checkbox" class="toggle toggle-sm toggle-primary" checked /></label>
  </div>
  <div style="width:200px" class="rounded-box border border-base-300 bg-base-100 p-1.5 shadow-lg text-sm">
    <label class="flex items-center gap-2 rounded-md px-1.5 py-1 hover:bg-base-200"><span class="grow font-medium">All changes</span><input type="radio" name="sb-ff" class="radio radio-sm radio-primary" /></label>
    <label class="flex items-center gap-2 rounded-md px-1.5 py-1 hover:bg-base-200"><span class="grow font-medium">Added</span><input type="radio" name="sb-ff" class="radio radio-sm radio-primary" checked /></label>
    <label class="flex items-center gap-2 rounded-md px-1.5 py-1 hover:bg-base-200"><span class="grow font-medium">Renamed</span><input type="radio" name="sb-ff" class="radio radio-sm radio-primary" /></label>
  </div>
</div>`,
      },
      {
        label: 'Workspace-grouped Bases facet (`groupToggles`) — a checkbox tree: shaded group band (chevron · tri-state parent · layers glyph · N of M) with checkbox leaves indented beneath · "No workspace" last',
        html: `
<div style="width:248px" class="rounded-box border border-base-300 bg-base-100 p-1.5 shadow-lg text-sm">
  <div class="flex items-center gap-2 rounded-md bg-base-200 px-2 py-1 font-semibold text-[12px]">
    <button class="inline-flex size-5 items-center justify-center rounded opacity-60"><span class="iconify lucide--chevron-down size-3.5"></span></button>
    <input type="checkbox" class="checkbox checkbox-sm" indeterminate />
    <span class="iconify lucide--layers size-3.5 opacity-55"></span>
    <span class="truncate">Growth</span>
    <span class="flex-1"></span>
    <span class="text-[12px] opacity-55 tabular-nums">1 of 2</span>
  </div>
  <label class="flex items-center gap-2 rounded-md py-1 hover:bg-base-200 opacity-45" style="padding-left:2.15rem"><input type="checkbox" class="checkbox checkbox-sm" /><span class="grow truncate font-medium">Sales CRM</span></label>
  <label class="flex items-center gap-2 rounded-md py-1 hover:bg-base-200" style="padding-left:2.15rem"><input type="checkbox" class="checkbox checkbox-sm" checked /><span class="grow truncate font-medium">Marketing</span></label>
  <div class="flex items-center gap-2 rounded-md bg-base-200 px-2 py-1 font-semibold text-[12px]" style="margin-top:8px">
    <button class="inline-flex size-5 items-center justify-center rounded opacity-60"><span class="iconify lucide--chevron-down size-3.5"></span></button>
    <input type="checkbox" class="checkbox checkbox-sm" checked />
    <span class="iconify lucide--layers size-3.5 opacity-40"></span>
    <span class="truncate opacity-70">No workspace</span>
    <span class="flex-1"></span>
    <span class="text-[12px] opacity-55 tabular-nums">1 of 1</span>
  </div>
  <label class="flex items-center gap-2 rounded-md py-1 hover:bg-base-200" style="padding-left:2.15rem"><input type="checkbox" class="checkbox checkbox-sm" checked /><span class="grow truncate font-medium">Operations</span></label>
</div>`,
      },
    ],
  },
  {
    id: 'pattern-base-picker',
    group: 'Patterns',
    name: 'Base picker (progressive workspace grouping)',
    summary:
      'The "choose bases" table is usable from the first paint and GROUPS ITSELF by workspace the moment the per-base lookup finishes — one determinate bar on the card edge explains the wait, one named toggle above the table sets whether auto-add is decided per workspace or per connection.',
    description:
      'The picker (<code>components/integrations/BaseSelectionTable.astro</code>) is the dense, capped, searchable table used by the setup wizard\'s <em>Bases</em> step and the standalone <a href="/integrations/configure/bases">Manage bases</a> screen. <strong>Why it changed (Dan, 2026-07-28):</strong> Airtable gives us a list of bases cheaply, but a base\'s WORKSPACE costs <strong>one extra API call per base</strong> — <em>"it just may take a long time to get for a long list of bases"</em>. Every earlier version assumed that map was free and switched grouping on unconditionally (<code>const grouped = groups.length &gt; 1</code>), which meant the page could not be drawn at all until the slow part finished. <strong>So grouping stopped being the frame of the page and became an enhancement that arrives.</strong> The flat table is therefore the complete product: search, sort, select-all-to-cap, show-selected, save — nothing is skeletoned, nothing is disabled, nothing waits.<br><br><strong>V2 — grouped is the DEFAULT, and the toggle says what it is FOR (Oleh, 2026-07-29).</strong> V1 optimised for "let them work immediately, offer grouping later". Reviewed live, that premise lost: <em>the user did not come for an ungrouped list, they came for a finished result and will wait ~10s if they can see the work happening.</em> So grouping is no longer an offer — <strong>the table groups itself the moment matching completes</strong>. The API cost is unchanged (one call per base, so workspaces still cannot be known at T0); what changed is that "grouped by default" now means "group automatically on completion", not "ask first". The remembered preference still wins: a user who switches it off (<code>bst-wsgroup:&lt;spaceId&gt;</code> / the <code>groupByWorkspace</code> prop in production) stays off, and every later visit renders grouped from the server with <em>no</em> movement at all. This whole design costs exactly ONE reflow, once per connection.<br><br><strong>The grouping control is not a view option — it sets the granularity of a standing decision.</strong> Grouped, auto-add is decided <em>per workspace</em>; ungrouped it is one switch for the whole connection. That consequence is why the control left the toolbar (where it sat among search and sort, as if it were cosmetic) and now has its own band directly above the table: a labelled <a href="#checkbox-toggle">toggle</a> — <strong>on by default</strong> — whose label NEVER changes (<code>Group by workspace</code>), one sentence naming the consequence, and the boundary of the change. V1 had the same binary under two names, <em>Group by workspace</em> in the toolbar and <em>Ungroup</em> in the selection strip; one setting gets one name. <strong>The band replaces, it does not join</strong>: the toolbar\'s status line leaves (the progress bar takes over that job), and the standing <em>Auto-enroll new workspaces</em> rule folds INTO this band rather than sitting as a second plate — same subject (future bases and future workspaces), one surface.<br><br><strong>Copy, verbatim.</strong> <code>Group by workspace</code> · <code>Grouped, you set auto-add per workspace. Ungrouped, it\'s one switch for the whole connection.</code> · <code>Affects this picker only — Schema and Data keep their own workspace grouping.</code> The boundary sentence is not padding: the user\'s real fear with a default-on grouping switch is invisible consequences on other screens.<br><br><strong>A determinate bar pinned to the card\'s top edge — never a spinner, never over the rows.</strong> The <a href="#progress">progress</a> entry already rules this: a bar is for known percentages, a spinner for unknown-duration work. We know the percentage (<code>31 / 50</code>), so the spinner was simply the wrong primitive and is gone. The bar is a <strong>thin catalog <code>progress</code> absolutely positioned on the top edge of the table card</strong> (<code>.bst-prog</code>, 3px, inside the card\'s clip so it follows the radius) — the browser-loading-bar idiom, which reads as "loading, the page still works". A bar drawn <em>across the rows</em> was deliberately rejected: it reads as "table unavailable", which is exactly the overlay misread this pattern exists to avoid. <strong>Keep the number beside it</strong> — the bar says how far, the number says what is being counted, and only the number explains the wait; it sits in the selection strip immediately under the bar (<code>.bst-wsstatus</code>). <strong>Do not flash it:</strong> render only after the wait exceeds ~500ms, so a five-base account never gets a blink of progress. <strong>On failure the bar stops and goes NEUTRAL, never red</strong> (drop <code>progress-primary</code>, keep <code>progress</code>) — failing to group is not a page error; the bases are still selectable and the flow continues, with <code>Retry</code> beside it.<br><br><strong>Honest copy while it runs.</strong> <code>Organising your bases by workspace… 31 / 50</code> — never "syncing your bases". The bases are already loaded and already selectable; saying otherwise teaches the user the list is incomplete and that they should wait before choosing, which is false and costs them the whole point of the flat-table-is-complete rule.<br><br><strong>Re-grouping animates, it does not fake a load.</strong> A skeleton/placeholder on re-group was proposed and REJECTED: the first grouping waits on the network, but toggling afterwards is a local DOM move that takes ~0ms, and a skeleton over an instant operation is invented latency. The honest answer to "don\'t let it jump" is an <strong>animated reflow</strong> — a FLIP pass measures each visible row before the move and transitions it from its old position, so rows travel rather than teleport (~180ms). Under <code>prefers-reduced-motion: reduce</code> the move is instant with no transform. Across that one automatic reflow, <strong>scroll position and every ticked base are preserved</strong> — selection survives free (the same DOM nodes are moved, never re-rendered) and <code>.bst-table</code>\'s <code>scrollTop</code> is captured and restored around the move.<br><br><strong>One workspace ⇒ no grouping UI at all</strong> — one group is not grouping, so neither the band nor the bar appears. Rows live in a flat container (<code>[data-bst-flatrows]</code>) or inside their group\'s <code>[data-bst-grows]</code>, never half of each.<br><br><strong>"Still matching" is not "No workspace".</strong> Two different facts, two buckets, two code paths, and they must never be merged: <em>No workspace</em> means the base has no workspace id (we asked and there is nothing to attribute), while <em>Still matching</em> means its per-base lookup has not returned yet (<code>BaseSummary.workspacePending</code>). Collapsing the second into the first states something untrue about the user\'s Airtable. The pending group carries no auto-add switch — there is nothing yet to watch — and empties itself as answers land.<br><br><strong>Progress survives a reload.</strong> The counter RESUMES from where the work got to; it never restarts at 0. There is no backend in this repo, so the harness simulates a resumed run (<code>?wsresolve=resumed</code> starts part-way), but the design assumes the work is never thrown away.<br><br><strong>Limited access moved into the header (2026-07-28).</strong> Airtable returns the workspace <em>id</em> on every base regardless of scope but the <em>name</em> only with full-environment access, so a group can be real-but-unnamed. That used to be explained by a full-width <code>alert-soft alert-warning</code> band above the whole table. The band is deleted; the fact is now stated where it applies — the group header reads <strong>Workspace 1</strong> <span class="opacity-60">· name unavailable</span> with the existing inline <strong>Rename</strong> pencil beside it. An explanation belongs next to the thing it explains, not stacked above 180 rows that are not affected by it. The route out (reconnect with full access) is not lost: it stays on the <em>Auto-enroll new workspaces</em> rule, the capability limited access actually blocks. The suffix is <code>white-space: nowrap; flex: none</code> so the NAME is still the first thing to truncate — the group header was already fixed once for truncation (<code>.bst-gname { min-width: 5rem }</code>) and must not regress.<br><br><strong>The workspace ID, and a way out to Airtable (founder, 2026-07-30).</strong> Every REAL workspace group header carries its <code>wsp…</code> id in a smaller muted label, and that label is the link to the workspace in Airtable (<code>airtable.com/&lt;wspId&gt;</code>, the same bare-id shape <code>BackupRunBaseView</code> already uses for a base). Two reasons it earns the space on a picking surface: the id is the only unambiguous handle when two workspaces share a name or when the name is a placeholder the user typed themselves, and a picker is exactly where someone needs to go and LOOK at the thing they are being asked about. It is not shown on the synthetic buckets ("No workspace", "Still matching") — those have no id and nothing to open. Like <code>.bst-gwhy</code> it is <code>white-space: nowrap; flex: none</code>, so the NAME still truncates first. <strong>Crowding + separator fixed (Oleh, 2026-07-30):</strong> the id used to butt straight against the auto-add toggle in the next column, and the ad-hoc <code>· </code> typed in front of it read as a crude, unstyled dot. Two changes, no grid track moved: <code>.bst-gident</code> gained <code>padding-right: .5rem</code> so the identity cell keeps its own 8px of breathing room before the boundary it spans up to, instead of clipping flush against it; and the typed "·" character was replaced by a shared <code>.bst-gsep</code> element — a 1px <code>currentColor</code> hairline, not a glyph — used by BOTH the id label and <code>.bst-gwhy</code>/the dual-name suffix, so the busiest case ("Workspace 1 · name unavailable · wspOps…") reads as ONE attached-fact convention rather than two different kinds of markup living side by side. The external-link icon stays visible at rest (unchanged); its gap from the id text grew from 4px to 8px so icon and text read level with each other rather than crammed together.<br><br><strong>The alias swap — dual display is EARNED, not default (Oleh 2026-07-28).</strong> A user can name a placeholder workspace, and until now the real Airtable name simply overwrote theirs when it arrived. An alias is therefore stored with the REASON it was typed (<code>WorkspaceAlias.kind</code>): <code>placeholder-fill</code> (typed only because the name was missing — every alias starts here, including the ones the inline pencil writes) versus <code>custom</code> (a deliberate different name). When a real name lands on a <code>placeholder-fill</code>, Airtable\'s name takes over — theirs was a stand-in — and <strong>one</strong> reversible prompt appears, attached under that group\'s header: <em>"Now using its Airtable name: Growth. You called it Marketing."</em> with <strong>Keep mine</strong>. Pressing it promotes the alias to <code>custom</code>, and <strong>only then</strong> are both names shown — the user\'s leading, Airtable\'s muted beside it. Never show both by default: the group header truncated once already and a permanent second name re-breaks precisely that. The prompt sits on its own attached line rather than inside the sticky header row for the same reason.<br><br><strong>Copy, verbatim (rest of the surface).</strong> <code>Organising your bases by workspace… 31 / 50</code> · <code>Group by workspace</code> · <code>Still matching</code> · <code>Couldn\'t organise by workspace</code> + <code>Retry</code> · <code>Workspace 1 · name unavailable</code> + <code>Rename</code>. No exclamation marks, no apologies, no "Oops" — a failed lookup is a fact about the connection, never the user\'s mistake. The V1 strings <code>Matching workspaces…</code>, <code>Workspaces matched</code> and <code>Ungroup</code> are RETIRED: the first two described a background job the progress bar now shows, and the third was a second name for a setting that has one.<br><br><strong>The wizard\'s gate is an instruction, not a standing accusation.</strong> The picker is the <em>Bases</em> step of the setup wizard, whose gate used to render a permanent amber <code>alert-soft alert-warning</code> band above the page heading on <em>every</em> incomplete step — telling the user they were in violation before they had done anything, on all four steps. The requirement now lives in the <strong>step subtitle</strong> ("Pick the bases this Space protects — at least one to continue"), and the amber band appears <strong>only after the user attempts Next</strong> with the gate unsatisfied, then clears the moment it is satisfied. Consequently <strong>Next is no longer disabled by a gate</strong>: a disabled button cannot be attempted, and an attempt is what earns the message. This is the wizard\'s generic mechanism, so it removes a permanent band from every step, not just this one.<br><br><strong>Structural contracts.</strong> <code>.bst[data-grouped]</code> is the single switch: it selects the five-column grid (<code>2.4rem · 16rem · Auto-add · 6rem · 6rem</code>) shared by <code>.bst-head</code>, <code>.bst-ghead</code> and <code>.bst-row</code>, reveals the group shells, and reveals the <code>.c-auto</code> cell that every row renders but flat mode hides — so "flat" and "grouped" are one template each, chosen deliberately, never inherited half-and-half. <code>.bst-head { min-height: 2.4rem }</code> and <code>.bst-ghead { top: 2.4rem }</code> are a matched sticky pair. The wizard reads the picker directly (<code>[data-base-checkbox]:checked</code> for the count, <code>[data-bst-ws-autoadd]:checked</code> for the review line), so the per-workspace auto-add switches are <strong>disabled and cleared while flat</strong> and restored from <code>data-ws-autoadd-saved</code> on grouping — a hidden checked switch would otherwise make the review step claim an auto-add the user can neither see nor have chosen.<br><br><strong>ONE search field, no scope switch (Oleh, 2026-07-29).</strong> The search used to sit beside a scope <code>&lt;select&gt;</code> docked inside the input — <em>in Bases</em> / <em>in Workspaces</em> — so the user had to decide WHERE to look before they had typed a character. That select is <strong>deleted</strong>, not hidden. The picker now uses the shared <a href="#pattern-entity-typeahead">entity typeahead</a>, exactly as Schema Browse does: one field that searches everything and groups what it finds. Typing does two things at once — it <strong>filters the table in place</strong>, matching base names AND workspace names simultaneously (the picker\'s loop is narrow → <em>Select all</em> → continue, so filtering is never replaced by jump-to-result), and it <strong>opens a grouped dropdown</strong> with <em>WORKSPACES</em> above <em>BASES</em>, each row = concept icon + name + a muted context line (a base shows its workspace, a workspace shows its base count). ↑/↓ move, ↵ picks, Esc clears, and <code>/</code> focuses the field. Workspace names are matched in BOTH modes, grouped or flat — the workspace is a property of the base whether or not the table is currently grouped, and the dropdown row names the workspace it matched on, so the match explains itself. What is mode-dependent is the WORKSPACES group: ungrouped there are no workspace rows to scroll to, so the whole group is absent (via <code>esKinds</code>) rather than present and empty.<br><br><strong>Picking is not "opening" — a picker has nothing to open.</strong> Browse\'s pick semantics must not be copied here. Picking a <strong>base</strong> clears the query, pages/expands to that row, scrolls it into view and <strong>ticks its checkbox</strong>; at the plan cap it does exactly what the row itself does — the tick is refused and the existing amber cap note explains why, never a second cap behaviour invented for the dropdown. Picking a <strong>workspace</strong> scrolls to that group and expands it if collapsed, and <strong>selects nothing</strong> — the user asked to look, not to commit 40 bases.',
    reference: 'components/integrations/BaseSelectionTable.astro · components/integrations/BasePickerRow.astro',
    showCode: false,
    usageDo: [
      'Ship the flat table as a complete product — search, sort, select, save — and let grouping arrive on top of it without ever blocking it.',
      'Group automatically the moment the lookup completes, and preserve scroll position and every ticked base across that one reflow.',
      'Give the grouping toggle ONE name that never changes, and state its consequence (auto-add per workspace vs per connection) plus its boundary (this picker only) beside it.',
      'Pay for a new band with a removal: the toolbar status line left, the auto-enroll rule folded in, and the wizard gate band became conditional.',
      'Use a determinate catalog progress bar pinned to the CARD EDGE for known-percentage waits, and keep the raw count beside it.',
      'Hold the bar back ~500ms so a small account never sees a blink of progress, and go NEUTRAL (not red) if the lookup fails.',
      'Animate a local re-group with a FLIP reflow, honouring prefers-reduced-motion — an instant operation gets movement, never a skeleton.',
      'Remember the answer per connection, so a user who turned grouping off stays off.',
      'Keep "Still matching" and "No workspace" as separate buckets with separate copy — an unfinished lookup is not an absent workspace.',
      'Resume a progress counter where it left off after a reload; restarting at 0 tells the user their wait was thrown away.',
      'State a limited-access caveat in the header of the group it applies to, not in a band above rows it does not apply to.',
      'Suppress the whole grouping UI when only one group exists — one group is not grouping.',
      'Show a wizard gate as an instruction in the step subtitle, and raise the amber band only after a failed attempt to advance.',
      'Store a user-typed name with the REASON it was typed, and let the real name take over a stand-in — once, reversibly, with "Keep mine".',
      'Give the picker ONE search field that matches bases and workspaces at once and groups the results — the shared entity typeahead, never a second hand-rolled one.',
      'Keep typing a FILTER on the table; the dropdown is an extra way in, not a replacement for narrowing then selecting all.',
      'Make picking mean what a picker means: a base scrolls into view and gets ticked (refused at the cap, same as the row), a workspace scrolls to its group and expands it, selecting nothing.',
    ],
    usageDont: [
      "Don't make the user click to get the result they came for — grouping is the finished state, not an offer, once the data is in.",
      "Don't ask the user to choose a search SCOPE before they have typed. One field searches everything; the grouped results say what was found where.",
      "Don't skeleton, disable or block the table while workspaces resolve; the flat table is already usable and blocking it buys nothing.",
      "Don't fake a load when re-grouping. Toggling is local and instant; a placeholder there is invented latency.",
      "Don't draw the progress bar across the rows or over the table — a bar on top of content reads as \"table unavailable\", and it is not.",
      "Don't use a spinner for this: the percentage is known, so the catalog says bar. And don't turn the bar red on failure — nothing the user did broke.",
      "Don't say \"syncing your bases\": they are already loaded. Say what is actually happening — organising them by workspace.",
      "Don't give one setting two names. \"Group by workspace\" and \"Ungroup\" were the same binary wearing two labels in two places.",
      "Don't park bases whose lookup is still running in the \"No workspace\" bucket — that asserts a fact about their Airtable that we have not established.",
      "Don't leave per-workspace auto-add switches live (or checked) while the table is flat — the wizard counts them, and it would report a choice the user cannot see.",
      "Don't render a gate message before the user has had a chance to satisfy it, and don't disable the button that would earn it.",
      "Don't show a user's name and Airtable's name side by side by default — dual display is earned by answering \"Keep mine\", and an unearned second string re-breaks the header truncation.",
      "Don't silently overwrite a name the user typed when the real one arrives, and don't silently keep theirs either — say which one is now in use, once, with a way back.",
    ],
    examples: [
      {
        label: 'The toggle band (one name, its consequence, its boundary, auto-enroll folded in) + the card-edge progress bar — running · failed (neutral, never red)',
        html: `
<div class="flex flex-col gap-4" style="padding:1rem">
  <div class="rounded-box border border-base-300 bg-base-100" style="padding:.75rem">
    <label class="flex items-start gap-3" style="cursor:pointer">
      <input type="checkbox" class="toggle toggle-sm toggle-primary" checked style="flex:none;margin-top:.1rem" />
      <span class="min-w-0">
        <span class="block text-sm font-bold">Group by workspace</span>
        <span class="block text-xs opacity-65" style="margin-top:.125rem">Grouped, you set auto-add per workspace. Ungrouped, it's one switch for the whole connection. Affects this picker only — Schema and Data keep their own workspace grouping.</span>
      </span>
    </label>
    <label class="flex items-start gap-3" style="cursor:pointer;margin-top:.75rem;padding-top:.75rem;border-top:1px dashed var(--color-base-300)">
      <input type="checkbox" class="toggle toggle-sm toggle-primary" style="flex:none;margin-top:.1rem" />
      <span class="min-w-0">
        <span class="block text-sm font-bold">Auto-enroll new workspaces</span>
        <span class="block text-xs opacity-65" style="margin-top:.125rem">Workspaces created in Airtable later are enrolled automatically at the next backup run.</span>
      </span>
    </label>
  </div>
  <div class="rounded-box border border-base-300 bg-base-100 overflow-hidden" style="position:relative">
    <progress class="progress progress-primary" value="31" max="50" style="position:absolute;inset-inline:0;top:0;height:3px;border-radius:0"></progress>
    <div class="flex items-center gap-2 border-b border-base-300 px-3 py-2 text-sm">
      <span class="font-semibold opacity-70">Selected 12 of 50</span>
      <span class="flex-1"></span>
      <span class="text-xs opacity-60">Organising your bases by workspace… <span class="tabular-nums">31 / 50</span></span>
    </div>
    <div class="px-3 py-2 text-sm opacity-60">Bases stay selectable the whole time.</div>
  </div>
  <div class="rounded-box border border-base-300 bg-base-100 overflow-hidden" style="position:relative">
    <progress class="progress" value="18" max="50" style="position:absolute;inset-inline:0;top:0;height:3px;border-radius:0"></progress>
    <div class="flex items-center gap-2 border-b border-base-300 px-3 py-2 text-sm">
      <span class="font-semibold opacity-70">Selected 12 of 50</span>
      <span class="flex-1"></span>
      <span class="text-xs opacity-60">Couldn't organise by workspace</span>
      <button class="btn btn-sm btn-ghost text-primary gap-1.5"><span class="iconify lucide--rotate-ccw size-4"></span>Retry</button>
    </div>
    <div class="px-3 py-2 text-sm opacity-60">Not an error state — the bar stops and goes neutral, the table keeps working.</div>
  </div>
</div>`,
      },
      {
        label: 'Group headers — placeholder name carries its own caveat · "Still matching" is its own bucket, distinct from "No workspace"',
        html: `
<div class="rounded-box border border-base-300 bg-base-100 overflow-hidden" style="max-width:34rem">
  <div class="flex items-center gap-2 bg-base-200 px-3 py-2 text-sm font-bold">
    <span class="iconify lucide--chevron-down size-4 opacity-60"></span>
    <input type="checkbox" class="checkbox checkbox-sm" checked />
    <span>Workspace 1</span>
    <span class="text-xs font-normal opacity-60 whitespace-nowrap">· name unavailable</span>
    <span class="iconify lucide--pencil size-4 opacity-55"></span>
    <span class="flex-1"></span>
    <span class="text-xs font-normal opacity-60 tabular-nums">4 of 4</span>
  </div>
  <div class="flex items-center gap-2 bg-base-200 px-3 py-2 text-sm font-bold border-t border-base-300">
    <span class="iconify lucide--chevron-down size-4 opacity-60"></span>
    <input type="checkbox" class="checkbox checkbox-sm" />
    <span class="opacity-70">Still matching</span>
    <span class="loading loading-spinner loading-sm opacity-50"></span>
    <span class="flex-1"></span>
    <span class="text-xs font-normal opacity-60 tabular-nums">0 of 12</span>
  </div>
  <div class="flex items-center gap-2 bg-base-200 px-3 py-2 text-sm font-bold border-t border-base-300">
    <span class="iconify lucide--chevron-down size-4 opacity-60"></span>
    <input type="checkbox" class="checkbox checkbox-sm" />
    <span class="opacity-70">No workspace</span>
    <span class="flex-1"></span>
    <span class="text-xs font-normal opacity-60 tabular-nums">0 of 3</span>
  </div>
</div>`,
      },
    ],
  },
  {
    id: 'pattern-date-range',
    group: 'Patterns',
    name: 'Date-range filter',
    summary: 'A period filter with quick presets (Last 30 / 60 / 90 days) and a custom from–to range, in one popover.',
    description:
      'The period filter across list surfaces. Its trigger matches the shared <a href="#pattern-faceted-filter">facet filter</a> (a bordered <code>ff-trigger</code> with a calendar icon + chevron) so the whole filter bar reads as one set. Opening it shows a small popover: a column of <strong>quick presets</strong> — <em>All time · Last 30 days · Last 60 days · Last 90 days</em> (one click, the common case) — and a <strong>custom From / To</strong> pair of native <code>date</code> inputs with an <strong>Apply</strong>, for anything else. The trigger states the active range: <em>All time</em>, a preset label, or <em>Jun 6 – Jul 13</em>; when a non-default range is set it takes the primary-tinted active state (<code>ff-on</code>) like the other filters. It emits a bubbling <code>daterangechange</code> event with <code>{ from, to }</code> (ISO dates, or nulls for "all"), and clears on the shared <code>facetreset</code>. Lightweight and dependency-free (native inputs, no calendar library) — a real calendar grid can be layered later without changing the contract. Component: <code>components/ui/DateRangePicker.astro</code>. Live: <a href="/reports">Reports</a>.',
    reference: 'design:components/ui/DateRangePicker.astro',
    showCode: false,
    usageDo: [
      'Lead with the quick presets (30 / 60 / 90 days) — they are the common case — and keep a custom From/To for the rest.',
      'State the active range on the trigger and give it the same active tint as the other filters.',
      'Emit one range ({from,to}); let the host filter its rows — the picker owns no data.',
    ],
    usageDont: [
      "Don't make the user open a calendar for the common \"last 30 days\" case — that's what the presets are for.",
      "Don't diverge the trigger from the shared facet look — the filter bar must read as one set of controls.",
    ],
    examples: [
      {
        label: 'The popover — presets + a custom range',
        html: `
<div class="rounded-box border border-base-300 bg-base-100 p-2" style="width:248px">
  <div class="flex flex-col gap-0.5">
    <button class="btn btn-sm btn-ghost justify-start">All time</button>
    <button class="btn btn-sm btn-ghost justify-start">Last 30 days</button>
    <button class="btn btn-sm btn-ghost justify-start">Last 60 days</button>
    <button class="btn btn-sm btn-ghost justify-start">Last 90 days</button>
  </div>
  <div class="my-2 border-t border-base-300"></div>
  <div class="flex flex-col gap-1.5 px-1">
    <label class="flex items-center justify-between gap-2 text-xs"><span class="text-base-content/60">From</span><input type="date" class="input input-sm" /></label>
    <label class="flex items-center justify-between gap-2 text-xs"><span class="text-base-content/60">To</span><input type="date" class="input input-sm" /></label>
  </div>
  <div class="mt-2 flex items-center justify-end gap-2 px-1">
    <button class="btn btn-sm btn-ghost text-error">Clear</button>
    <button class="btn btn-sm btn-primary">Apply</button>
  </div>
</div>`,
      },
    ],
  },
  {
    id: 'pattern-field-visibility-filter',
    group: 'Patterns',
    name: 'Field-visibility filter (Base ▸ Table ▸ Field)',
    summary: 'The hierarchical sibling of the faceted filter: a tree of tri-state checkboxes that picks exactly which fields a view shows.',
    description:
      'Where the <a href="#pattern-faceted-filter">faceted filter</a> hides whole facets (a base, a table, a field <em>type</em>), this one hides <strong>individual fields</strong> — the control a busy diagram needs. Same chrome as its flat sibling (a bordered trigger that goes <strong>primary-tinted + count badge</strong> when active, the same popover + in-popover <a href="#input">Search</a>, the same <em>Show all / Hide all</em>), so the two read as one family. The difference is structural: a <strong>tree grouped Base ▸ Table ▸ Field</strong> with collapsible groups and a <code>visible/total</code> count per group. It uses <strong>checkboxes, not toggles</strong>, because groups need a third state: a base/table is <strong>checked</strong> when all its fields show, <strong>unchecked</strong> when none, <strong>indeterminate</strong> when partial; toggling a group cascades to its fields. Search filters the tree (keeping ancestors) and the bulk controls then apply to the matches (labelled "Show all matches"). Each field row carries its vendored <strong>Airtable field-type icon</strong>. The component is <strong>presentational</strong>: it takes the schema + the hidden-field set and emits the next set; the consumer (Visualize) owns persistence and drops the hidden rows. The red <a href="#button">Clear</a> in the toolbar resets it alongside the other facets. Component: <code>components/schema/FieldsFilter.tsx</code>. Live: <a href="/schema">Schema</a> → Visualize.',
    reference: 'components/schema/FieldsFilter.tsx',
    showCode: false,
    usageDo: [
      'Use checkboxes (tri-state) here, not toggles — groups must show an indeterminate (partial) state.',
      'Cascade a group toggle to all its fields; show a visible/total count on every group and in the trigger.',
      'Match the faceted-filter chrome: same trigger active-state, same Search box, same Show all / Hide all.',
      'When a search is active, scope Show all / Hide all to the matches and label them as such.',
      'Show each field row’s Airtable field-type icon; collapse groups for very large schemas.',
    ],
    usageDont: [
      "Don't filter bases or tables here — that's the faceted filter's job; Base/Table levels are only grouping + bulk for fields.",
      "Don't colour the checkbox (no checkbox-primary); keep it the one neutral checkbox used everywhere.",
      "Don't default to hiding fields (no \"show first N\") — show all; the user hides what they don't want.",
    ],
    examples: [
      {
        label: 'Trigger — default · active (visible/total)',
        html: `
<div class="flex flex-wrap items-center gap-2" style="padding:1.25rem 1rem">
  <div class="btn btn-sm gap-1.5" style="background:var(--color-base-100);border-color:var(--color-base-300);font-weight:400">Field visibility <span class="iconify lucide--chevron-down size-3 opacity-55"></span></div>
  <div class="btn btn-sm gap-1.5" style="background:color-mix(in oklch,var(--color-primary) 13%,transparent);border-color:color-mix(in oklch,var(--color-primary) 35%,transparent);color:var(--color-primary);font-weight:400">Field visibility <span class="badge badge-sm badge-primary">24/180</span> <span class="iconify lucide--chevron-down size-3 opacity-55"></span></div>
</div>`,
      },
      {
        label: 'Open popover — tree of tri-state checkboxes (Sales CRM partial, Companies all, Deals partial, Marketing collapsed)',
        html: `
<div style="padding:1rem 1rem 6rem">
  <div style="width:304px" class="rounded-box border border-base-300 bg-base-100 p-2 shadow-lg text-sm">
    <label class="input input-sm w-full"><span class="iconify lucide--search size-3.5 opacity-50"></span><input type="text" placeholder="Search fields" /></label>
    <div class="flex items-center gap-1 py-1.5">
      <button class="btn btn-xs btn-ghost gap-1 px-2 text-primary"><span class="iconify lucide--eye size-3.5"></span>Show all</button>
      <button class="btn btn-xs btn-ghost gap-1 px-2"><span class="iconify lucide--eye-off size-3.5"></span>Hide all</button>
      <button class="btn btn-xs btn-ghost px-1.5 ml-auto opacity-70">Collapse</button>
    </div>
    <div class="space-y-0.5">
      <!-- Base: Sales CRM (indeterminate) -->
      <div class="flex items-center gap-2 rounded-md px-1.5 py-1 hover:bg-base-200">
        <span class="iconify lucide--chevron-down size-3 opacity-55"></span>
        <span class="inline-grid place-items-center" style="width:1rem;height:1rem;border:1.5px solid var(--color-base-content);border-radius:5px;opacity:.55"><span style="width:8px;height:2px;background:var(--color-base-content);border-radius:1px"></span></span>
        <span class="iconify lucide--database size-3.5 opacity-60"></span><span class="grow font-semibold">Sales CRM</span><span class="mono-data text-[10.5px] opacity-50">12/18</span>
      </div>
      <!-- Table: Companies (all on) -->
      <div class="flex items-center gap-2 rounded-md py-1 pr-1.5 hover:bg-base-200" style="padding-left:1.375rem">
        <span class="iconify lucide--chevron-down size-3 opacity-55"></span>
        <input type="checkbox" class="checkbox checkbox-sm" checked />
        <span class="iconify lucide--table-2 size-3.5 opacity-60"></span><span class="grow font-semibold">Companies</span><span class="mono-data text-[10.5px] opacity-50">8/8</span>
      </div>
      <div class="flex items-center gap-2 rounded-md py-1 pr-1.5 hover:bg-base-200" style="padding-left:2.375rem"><span class="size-3"></span><input type="checkbox" class="checkbox checkbox-sm" checked /><span class="iconify lucide--type size-3.5 opacity-70"></span><span class="grow font-medium">Name</span></div>
      <div class="flex items-center gap-2 rounded-md py-1 pr-1.5 hover:bg-base-200" style="padding-left:2.375rem"><span class="size-3"></span><input type="checkbox" class="checkbox checkbox-sm" checked /><span class="iconify lucide--circle-dot size-3.5 opacity-70"></span><span class="grow font-medium">Industry</span></div>
      <!-- Table: Deals (indeterminate) -->
      <div class="flex items-center gap-2 rounded-md py-1 pr-1.5 hover:bg-base-200" style="padding-left:1.375rem">
        <span class="iconify lucide--chevron-down size-3 opacity-55"></span>
        <span class="inline-grid place-items-center" style="width:1rem;height:1rem;border:1.5px solid var(--color-base-content);border-radius:5px;opacity:.55"><span style="width:8px;height:2px;background:var(--color-base-content);border-radius:1px"></span></span>
        <span class="iconify lucide--table-2 size-3.5 opacity-60"></span><span class="grow font-semibold">Deals</span><span class="mono-data text-[10.5px] opacity-50">4/12</span>
      </div>
      <div class="flex items-center gap-2 rounded-md py-1 pr-1.5 hover:bg-base-200" style="padding-left:2.375rem"><span class="size-3"></span><input type="checkbox" class="checkbox checkbox-sm" checked /><span class="iconify lucide--circle-dot size-3.5 opacity-70"></span><span class="grow font-medium">Stage</span></div>
      <div class="flex items-center gap-2 rounded-md py-1 pr-1.5 hover:bg-base-200" style="padding-left:2.375rem;opacity:.5"><span class="size-3"></span><input type="checkbox" class="checkbox checkbox-sm" /><span class="iconify lucide--hash size-3.5 opacity-70"></span><span class="grow font-medium">Amount</span></div>
      <!-- Base: Marketing (collapsed, none on) -->
      <div class="flex items-center gap-2 rounded-md px-1.5 py-1 hover:bg-base-200">
        <span class="iconify lucide--chevron-right size-3 opacity-55"></span>
        <input type="checkbox" class="checkbox checkbox-sm" />
        <span class="iconify lucide--database size-3.5 opacity-60"></span><span class="grow font-semibold">Marketing</span><span class="mono-data text-[10.5px] opacity-50">0/14</span>
      </div>
    </div>
  </div>
</div>`,
      },
    ],
  },
  {
    id: 'pattern-data-grid',
    group: 'Patterns',
    name: 'Record data grid (filter/sort/search over backed-up rows)',
    summary: 'A daisyUI table over backed-up records, sticky header, sorting + filter + search. Paged with the shared table-toolbar pager (2026-07-23) — no separate infinite-scroll idiom.',
    description:
      'The Data page browses the <em>rows</em> inside a backup. It is a daisyUI <code>table text-sm</code> with a <strong>sticky header</strong> (same muted-uppercase look as the <a href="/backups">Backups</a> list). <strong>Pagination (Oleh 2026-07-23):</strong> the grid used to load an unbounded scroll-window on a cursor with no numbered pages; that read as an opaque "N matching · N loaded" counter that just kept scrolling, so it was replaced with the <strong>same pager as <a href="#pattern-table-toolbar">the table toolbar</a></strong> — a rows-per-page <code>select</code> (25/50/100, default <strong>50</strong> — a record IS the row here, and a screen already fits about that many) plus prev/next, reading <em>"1–50 of 1,240"</em>. The pager acts on the <strong>filtered + sorted set</strong>; the window is applied last. Page size is a <strong>user preference</strong>, persisted separately from a saved preset — it is never part of the preset\'s config/baseline, so switching rows-per-page can never make a preset dirty. Page itself is ephemeral (not persisted; a reload starts at page 1), and any change to filter, search, sort or the active table/preset <strong>resets to page 1</strong>. A row is <strong>whole-row clickable</strong> (the shared <code>row-clickable</code> + trailing chevron) and opens the record sidebar. A <strong>linked-record cell shows the linked record NAMES</strong>, not an opaque count — up to two clickable chips + a <em>"+N"</em> overflow (a link field is often to just one record, where <em>"1 linked"</em> tells you nothing); clicking a name <strong>drills into that record</strong> (opens it in the sidebar), and the click is intercepted so it doesn\'t also open the row\'s own record. Read-only — values render as type-aware viewers, no inline edit. Pairs with baseout <code>server-data-browse</code> for the real paged queries.',
    reference: 'design:components/data/DataBrowse.astro',
    showCode: false,
    usageDo: [
      'Use the shared table-toolbar pager (rows-select + range/total + prev/next) — the same construction as Backups, default page size per-surface (Backups 20, this grid 50).',
      'Page the FILTERED + SORTED set, with the window applied last; reset to page 1 on any filter/search/sort/table change.',
      'Keep page size a user preference (its own storage key) — never fold it into a preset\'s saved config/baseline/dirty diff.',
      'Keep rows whole-row clickable into the record sidebar, matching the Backups / Browse row idiom.',
    ],
    usageDont: [
      "Don't reintroduce a second, differently-worded counter next to the pager (e.g. \"N matching · N loaded\") — one reading of scale, not two that can disagree.",
      "Don't let changing rows-per-page mark a preset dirty or enter its saved config — it is a per-user display preference, not part of the view.",
      "Don't offer inline editing — this is a read-only view of an immutable backup.",
    ],
    examples: [
      {
        label: 'The grid — sticky header + the shared pager below (rows-select · range/total · prev/next)',
        html: `
<div class="rounded-box border border-base-300 bg-base-100" style="padding:.75rem">
  <table class="table table-sm text-sm">
    <thead><tr class="text-xs uppercase tracking-wider text-base-content/60"><th>Name</th><th>Email</th><th>Status</th><th class="text-right">Lifetime value</th></tr></thead>
    <tbody>
      <tr class="hover:bg-base-200 cursor-pointer"><td class="font-medium">Ada Okoye</td><td class="text-base-content/70">ada@ex.com</td><td><span class="badge badge-soft badge-success badge-sm">Active</span></td><td class="text-right font-mono tabular-nums">$4,120</td></tr>
      <tr class="hover:bg-base-200 cursor-pointer"><td class="font-medium">Ben Larsson</td><td class="text-base-content/70">ben@ex.com</td><td><span class="badge badge-soft badge-warning badge-sm">Trial</span></td><td class="text-right font-mono tabular-nums">$0</td></tr>
      <tr class="hover:bg-base-200 cursor-pointer"><td class="font-medium">Chidi Musa</td><td class="text-base-content/70">chidi@ex.com</td><td><span class="badge badge-soft badge-success badge-sm">Active</span></td><td class="text-right font-mono tabular-nums">$980</td></tr>
    </tbody>
  </table>
  <div class="flex items-center gap-4 flex-wrap" style="margin-top:12px;padding-top:12px;border-top:1px solid var(--color-base-300)">
    <label class="inline-flex items-center gap-2 text-xs font-medium text-base-content/64">Rows
      <select class="select select-sm"><option>25</option><option selected>50</option><option>100</option></select>
    </label>
    <div class="ml-auto text-sm text-base-content/70"><span class="mono-data">1–50</span> of <span class="mono-data">1,240</span></div>
    <div class="inline-flex" style="gap:4px">
      <button class="btn btn-sm btn-square btn-ghost" disabled><span class="iconify lucide--chevron-left size-4"></span></button>
      <button class="btn btn-sm btn-square btn-ghost"><span class="iconify lucide--chevron-right size-4"></span></button>
    </div>
  </div>
</div>`,
      },
    ],
  },
  {
    id: 'pattern-data-views',
    group: 'Patterns',
    name: 'Presets (Chrome-style tabs over the grid)',
    summary: 'Named, saved configs of the Browse grid — table + filters + visible fields + sort — called PRESETS (not "views", to avoid the Airtable collision). A collapsible left LIBRARY of all presets (grouped) + a horizontal TAB BAR of the OPEN presets (Chrome-style: click a preset to open a tab, ✕ to close). Open tabs persist across reload.',
    description:
      'Dan\'s "killer" axis (2026-07-15): the <a href="#pattern-data-grid">record grid</a> is rarely browsed once — an operator keeps several <strong>saved configurations</strong> and moves between them. A <strong>preset</strong> = <code>{table, filters, visible fields, sort}</code>; the toolbar controls ARE the active preset\'s config. <strong>Naming (2026-07-21):</strong> these are <strong>"presets"</strong>, never "views" — "view" collides with Airtable\'s own views and ours don\'t map to theirs. <strong>Collapsible left LIBRARY + a tab bar:</strong> a left library panel that collapses like the <a href="#pattern-schema-docs">Docs list</a> (open it to find/organize presets, collapse for a clean workspace), bounded from the section-tabs baseline by a vertical divider; and a horizontal <strong>TAB BAR</strong> of the OPEN presets over the grid, drawn as soft <strong>PILLS</strong> (active = soft-primary fill, not underline tabs — those clashed with the section tabs + filter row). Collapsing hides the library; a <strong>"Presets" reopen button</strong> then leads the tab-bar row as its first item. <strong>Chrome-tab model (pin REMOVED, 2026-07-21):</strong> the library holds <em>every</em> preset (grouped + Ungrouped); <strong>clicking a library preset opens it as a tab</strong> and activates it; each tab carries an <strong>✕ to close</strong> (visible on hover + always on the active tab) — closing removes the tab but the preset stays in the library. <strong>Open tabs (ids + order + active) persist to <code>localStorage</code></strong> and survive reload — there is no "temporary preset that vanishes", and no pin/unpin. <strong>Save ≠ open:</strong> a NEW preset (New preset / Duplicate) is created in the library and opened as a tab; <strong>Save preset</strong> (<code>lucide--save</code>, shown only when the active preset\'s config is dirty vs its saved baseline) writes the current state back; <strong>Discard</strong> reverts to the baseline; <strong>Delete</strong> removes it for good. <strong>Groups:</strong> one group per preset (folder model, moved not copied); the library shows collapsible <strong>groups</strong> (header caret + count + kebab: Rename group · Delete group — <em>deleting a group never deletes its presets, they fall to Ungrouped</em>) + an <strong>Ungrouped</strong> catch-all; a group is created top-down (<code>lucide--folder-plus</code> in the rail header) or bottom-up (a preset\'s <em>Move to group ▸ New group…</em>). Every library row has a <strong>hover kebab</strong> (Rename · Duplicate · Move to group ▸ · Remove from group · Delete) AND a <strong>drag handle</strong> — <strong>drag a preset row onto a group</strong> (or Ungrouped, revealed while dragging) to re-file it. The tab-bar <strong>"+"</strong> offers New blank preset / Duplicate current and, below a separator, the user\'s <strong>existing not-open presets grouped</strong>, so you can add any preset as a tab from anywhere. Presentational (in-memory + <code>localStorage</code>); the engine owns real cross-session persistence. <strong>Save / Discard / lock / Draft (Dan 2026-07-23) — the editing model:</strong> a preset is <strong>explicitly saved</strong>. Changing the filter, sort, visible fields, column order or search leaves <em>unsaved edits</em> that do NOT stick to the tab — the tab and its library row carry an unsaved <a href="#status-dot">status dot</a>, and the toolbar offers <strong>Save preset</strong> and <strong>Discard</strong>. Discard returns the preset to its last saved state; it is NOT the same control as <strong>Clear</strong>, which empties the filter outright — two adjacent buttons, two different jobs, so each states its own in a tooltip. Dirty is computed by <strong>diffing against the saved baseline</strong>, never a sticky boolean: type a character into the search and delete it again and the preset is clean, because it once more equals what was saved. <strong>The first Save locks the preset\'s Base and Table</strong> (see <a href="#pattern-faceted-filter">the locked scope picker</a>) — changing either would invalidate the very filter that was just saved, so instead of silently wiping it the scope becomes read-only. Need another table? <strong>＋ New blank preset</strong> or <strong>Duplicate current</strong> — both arrive UNSAVED, with their scope open, so you set base + table there and then Save. An unsaved preset is a <strong>Draft</strong>: a ghost <a href="#badge">Badge</a> reading "Draft", it survives a reload with its edits intact (a draft IS its edits — losing them to a refresh is exactly the failure this model exists to prevent), and it can be deleted. Discard has nothing to return to on a never-saved Draft, so it is not offered there — Delete is the way out. Live: <a href="/data">Data</a> ▸ Browse. Component: <code>components/data/DataBrowse.astro</code> (<code>.dv-*</code>).',
    reference: 'design:components/data/DataBrowse.astro',
    showCode: false,
    usageDo: [
      'Call them PRESETS, never "views" — "view" collides with Airtable\'s own views.',
      'Model a preset as the whole grid config (table + filters + visible fields + sort); opening a preset restores all of it.',
      'Chrome-tab model: the library holds ALL presets; clicking one opens a TAB (soft-primary pill) and each tab has an ✕ to close. Persist the open-tab set + order + active so tabs survive reload.',
      'Keep Save explicit: New/Duplicate opens a preset; Save (only when dirty) writes config back to the active preset; Discard reverts to the baseline.',
      'Compute dirty by DIFFING the config against the saved baseline, never with a sticky "touched" boolean. Typing a search character and deleting it again must leave the preset CLEAN — a false dirty state trains the user to ignore the indicator.',
      'Lock a preset\'s Base + Table on its FIRST save, and route "I need another table" to ＋ New blank preset / Duplicate current (both born unsaved, scope open). Changing the scope of a saved preset would invalidate the filter saved with it, and silently wiping a minute of filter-building is the failure this model exists to prevent.',
      'Give an unsaved preset a ghost "Draft" badge, let it survive a reload WITH its edits, and let it be deleted. A draft IS its edits: dropping them on refresh is the same data loss, just later.',
      'Keep Discard and Clear visibly distinct and let each state its own job in a tooltip — Discard returns to the last saved state, Clear empties the filter. They sit next to each other and do very different things.',
      'One group per preset (folder model). Deleting a group must NEVER delete its presets — they return to Ungrouped. Hide the kebab until hover so rows/tabs stay compact.',
      'Make the "+" list existing not-open presets (grouped) so any preset can be re-opened as a tab from the bar.',
    ],
    usageDont: [
      'Don\'t call them "views" — that collides with Airtable; use "preset".',
      "Don't bring back pin/unpin or a temporary-that-vanishes preset — an opened tab persists until the user ✕-closes it (Chrome-tab model).",
      "Don't let one preset live in many groups — one group per preset (folder model), moved not copied.",
      "Don't leave the grid blank when the last tab is closed — open a fresh preset so there's always an active config.",
      "Don't let a SAVED preset change its base or table in place — and don't solve that by hiding the pickers. Lock them where they are, with the reason in a tooltip.",
      "Don't offer Discard on a never-saved Draft — there is no baseline to return to, so the button would either do nothing or quietly behave like Clear. Delete is the way out of a draft.",
      "Don't let a Draft evaporate on refresh, and don't flatten a nested filter group when persisting one. Silent structural data loss is worse than no persistence at all.",
    ],
    examples: [
      {
        label: 'Tab bar — OPEN presets as soft PILLS with a ✕ (active = soft-primary; Chrome-tab model)',
        html: `
<div class="flex items-center gap-1 px-1" style="padding:.4rem 0">
  <button class="inline-flex items-center gap-1 rounded-full pl-3 pr-1 py-1 text-sm font-semibold" style="background:oklch(from var(--color-primary) l c h / .12);color:var(--color-primary)">Churned contacts<span class="inline-grid place-items-center size-[18px] rounded-full"><span class="iconify lucide--x size-3.5"></span></span></button>
  <button class="inline-flex items-center gap-1 rounded-full pl-3 pr-1 py-1 text-sm" style="color:oklch(from var(--color-base-content) l c h / .65)">Unpaid orders<span class="inline-grid place-items-center size-[18px] rounded-full opacity-0"><span class="iconify lucide--x size-3.5"></span></span></button>
  <button class="btn btn-sm btn-ghost btn-square"><span class="iconify lucide--plus size-4"></span></button>
</div>`,
      },
      {
        label: 'Library — a bordered rail of ALL presets (grouped) with a hover kebab',
        html: `
<div class="rounded-box border border-base-300 bg-base-100" style="width:200px;padding:.4rem">
  <button class="btn btn-sm btn-soft btn-primary w-full gap-1.5" style="margin-bottom:.4rem"><span class="iconify lucide--plus size-4"></span>New preset</button>
  <div class="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm" style="background:color-mix(in oklch,var(--color-primary) 10%,transparent);color:var(--color-primary)"><span class="iconify lucide--table-2 size-3.5"></span>Churned contacts</div>
  <div class="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm"><span class="iconify lucide--table-2 size-3.5 opacity-40"></span>Unpaid orders<span class="iconify lucide--ellipsis size-4 opacity-40" style="margin-left:auto"></span></div>
  <div class="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm opacity-70"><span class="iconify lucide--table-2 size-3.5 opacity-40"></span>Scratch</div>
</div>`,
      },
    ],
  },
  {
    id: 'pattern-record-panel',
    group: 'Patterns',
    name: 'Record panel (sectioned detail)',
    summary: 'The record detail drawer, in the shared EntityPanel language: a Location breadcrumb + View-in-Airtable, then stacked SECTIONS — Fields (searchable, type icons, click a field → its config), Linked records (tabs, one-level drill-in), History last.',
    description:
      'The Data page\'s record drawer, rebuilt (Dan 2026-07-15) to read as the same detail-panel family as the Schema <a href="#pattern-entity-panel">EntityPanel</a> — a right-anchored sheet over a scrim. It is <strong>stacked sections that scroll as one</strong> (not a Fields/History segmented switch): a <strong>Location breadcrumb</strong> (Base ▸ Table ▸ record) + a <strong>"View record in Airtable"</strong> <a href="#button">Button</a> at the top; a <strong>Fields</strong> section — a <em>search</em> box inside it (records can carry hundreds of fields), each row a <strong>field-type icon</strong> + name + value, and each row <strong>clickable to open that field\'s config</strong> in the shared EntityPanel (<code>schema:openEntity</code>; ⌘/Ctrl-click opens it beside the data). <strong>The field name button now carries a tooltip</strong> naming both actions (open in place · ⌘/Ctrl-click to open beside) — a hidden ⌘-click affordance is not an affordance (Oleh 2026-07-30) — and the row ALSO shows the canon reveal-on-hover <code>⧉</code> open-beside button (same icon/tooltip/classes as every other open-beside control in the app: linked-record rows here, <code>.ep-beside</code> in Schema, <code>.dcp-openbeside</code> in the Changelog drill). It sits as a normal flex sibling after the value cell (which already truncates and yields the width) rather than absolutely overlapping — this row\'s trailing control, the provenance expand chevron, is a LIVE button (unlike EntityPanel\'s inert type/dir/health meta), so the two must both stay reachable while hovering, not swap. Field rows carry <code>⧉</code> only where the host allows field-config at all (<code>RecordBodyCtx.fieldClickable</code>) — the Changelog drill\'s inert field rows show neither the tooltip nor the button; a row that cannot be opened must not advertise opening beside. a <strong>Linked records</strong> section rendered as <strong>tabs</strong> (one per link field, e.g. Orders) showing a provenance-style preview (<em>up to N names + "+M more"</em>, the <a href="#pattern-cell-provenance">cell-provenance</a> pattern) where a linked name <strong>drills in one level in place</strong> (a mini nav with Back, plus an "open in new pane / take over" escape hatch — linked→linked is unbounded, so cap the in-place depth at one); and <strong>History</strong> (the cross-backup <a href="#pattern-record-history">diff timeline</a> + "view as of this backup"); finally a <strong>"Referenced in"</strong> section — the reverse of the Docs `@@` record tagging — listing the documents (and later chats) that tag this record, each row a doc icon + title + a quiet kind tag, clicking through to the Docs tab with that document open (<code>schema:openDoc</code>). It renders ONLY when at least one reference exists — no empty-state noise — and joins the section jump-nav automatically. Read-only. <strong>Opened from the Changelog drill (Dan 2026-07-23, revised):</strong> a record reached from a backup-run drill does NOT open this standalone drawer — it becomes a panel of the <em>drill\'s own</em> stack (see <a href="#pattern-data-changelog">Data changelog</a>). The record BODY (Location crumb · Fields · Linked · History) is shared code (<code>recordReadBody.ts</code>), so it reads identically whether it renders here for Browse/Docs or inside a drill panel — the same relationship <code>schemaReadBody</code> has to the Schema <a href="#pattern-entity-panel">EntityPanel</a>. The drill-hosted record drops the cross-stack-only affordances (field-config open-beside, value-tables, Referenced-in→Docs) and keeps the body-local reads (linked drill-in-place, provenance expand, view-as-of). This standalone RecordPanel is what Browse and Docs open, and is unchanged for them. Component: <code>components/data/RecordPanel.astro</code> (<code>.rp-*</code>).',
    reference: 'design:components/data/RecordPanel.astro',
    showCode: false,
    usageDo: [
      'Read as the EntityPanel family: right sheet + scrim, breadcrumb, concept-icon header — reuse the chrome, don\'t invent a new look.',
      'Stack sections that scroll as one (Fields → Linked records → History), not a segmented Fields/History switch.',
      'Put a search inside the Fields section and a field-type icon on every row; make a field row open that field\'s config (schema:openEntity), with ⌘-click to open beside.',
      'Render linked fields as tabs with a name preview + "+M more"; drill in ONE level in place with Back, and offer an "open in new pane" escape hatch beyond that.',
      'Keep History after the content sections, with the cross-backup diff timeline + "view as of this backup".',
      'Show "Referenced in" (docs/chats that tag this record) only when non-empty; a row carries a kind tag (Doc/Chat) and opens the Docs tab with that document (schema:openDoc).',
    ],
    usageDont: [
      "Don't go back to a Fields/History segmented toggle — the sections stack and scroll together.",
      "Don't render an empty \"Referenced in\" section — a record with no references shows nothing at all.",
      "Don't drill linked→linked→… unbounded in place — cap at one level with an open-in-new-pane hatch.",
      "Don't drop the field-type icons or the in-section field search — a wide record is unreadable without them.",
    ],
    examples: [
      {
        label: 'Record panel — breadcrumb + View-in-Airtable, then stacked sections',
        html: `
<div class="rounded-box border border-base-300 bg-base-100" style="width:320px;overflow:hidden">
  <div class="border-b border-base-300 p-3">
    <div class="flex items-center gap-2"><span class="inline-grid place-items-center size-8 rounded-lg bg-base-200"><span class="iconify lucide--table-2 size-4"></span></span><span class="font-semibold text-sm flex-1">Ada Okoye</span><span class="iconify lucide--x size-4 opacity-50"></span></div>
    <div class="mt-1 flex items-center gap-2 text-xs text-base-content/55">Sales CRM <span class="iconify lucide--chevron-right size-3 opacity-40"></span> Contacts</div>
    <a class="btn btn-sm btn-ghost gap-1.5 mt-2"><span class="iconify lucide--external-link size-3.5"></span>View record in Airtable</a>
  </div>
  <div class="p-3 flex flex-col gap-3 text-sm">
    <div class="text-[11px] font-bold uppercase tracking-wider text-base-content/50">Fields</div>
    <label class="input input-sm"><span class="iconify lucide--search size-3.5 opacity-50"></span><input placeholder="Search fields…" /></label>
    <div class="rounded-lg border border-base-300">
      <div class="flex items-center gap-2 border-b border-base-200 p-2"><span class="iconify lucide--type size-3.5 opacity-60"></span><span class="text-base-content/60 text-xs w-[40%]">Name</span><span class="flex-1">Ada Okoye</span></div>
      <div class="flex items-center gap-2 p-2"><span class="iconify lucide--circle-dot size-3.5 opacity-60"></span><span class="text-base-content/60 text-xs w-[40%]">Status</span><span class="dg-selval">Active</span></div>
    </div>
    <div class="text-[11px] font-bold uppercase tracking-wider text-base-content/50">Linked records</div>
    <div class="tabs tabs-border"><span class="tab tab-active">Orders · 2,340</span></div>
  </div>
</div>`,
      },
    ],
  },
  {
    id: 'pattern-field-filter',
    group: 'Patterns',
    name: 'Field filter (conditions + nested groups)',
    summary: 'The value-level sibling of the faceted filter: a condition builder (field · operator · value) with a per-group and/or conjunction and one level of nested condition groups — the Airtable filter model, drawn in the app\'s filter language.',
    description:
      'Where the <a href="#pattern-faceted-filter">faceted filter</a> hides whole facets (a base, a table, a field <em>type</em>), this one filters on the <strong>values inside the rows</strong> — the control the <a href="#pattern-data-grid">record grid</a> needs to narrow a million-row table. A flat AND chip list can\'t express <code>A AND (B OR C)</code>, so this is a real <strong>condition builder</strong> modelled on Airtable — but <strong>drawn in the app\'s one filter language</strong>, not a new look: the <code>+ Filter</code> trigger is an <strong><code>ff-trigger</code></strong> (bordered, chevron, identical to Base / Table / Fields), the popover is the shared <strong><code>ff-panel</code></strong> chrome, and every row uses the catalog <a href="#select">Select</a> + <a href="#input">Input</a>. <strong>Model:</strong> a tree — a root group holds <em>conditions</em> and, one level deep, nested <em>condition groups</em>. Each group carries a single <strong>and/or conjunction that applies to all its siblings</strong>: row 1 reads a static <strong>"Where"</strong>, row 2 is an editable <strong>and/or</strong> select, rows 3+ mirror it as static text — a group is homogeneous (all-AND or all-OR), and you mix logic by nesting a group with the opposite conjunction. A condition row is <strong>[conjunction] · [field ▾] · [operator ▾] · [value] · duplicate · delete · drag-handle</strong>. The operator list is <strong>scoped to the field&#39;s Airtable type</strong> — text: <em>contains / does not contain / is / is not / is empty / is not empty</em>; number: <em>= · ≠ · &gt; · &lt; · ≥ · ≤ · between · empty</em>; date: <em>is / before / after / on-or-before / on-or-after / between</em>; single-select: <em>is / is not / is any of / is none of / empty</em>; checkbox: <em>is checked / is unchecked</em>; linked: <em>contains / is empty</em>. The footer offers <strong>+ Add condition</strong>, <strong>+ Add condition group</strong>, and <strong>Copy from another view</strong> (clones an entire filter tree from another saved view of the same table — reuse over rebuild). The trigger shows a <strong>count badge</strong> of active conditions and the <code>ff-on</code> active treatment. Because the grid pages on a cursor, <strong>any change resets the cursor</strong> and re-queries from the top; a red <a href="#button">Clear</a> empties the tree. Presentational here (it filters the loaded fixture rows); the real app pushes the predicate to the engine (<code>server-data-browse</code>). Depth is capped at <strong>one level of groups</strong> — enough for <code>A AND (B OR C)</code> without Airtable\'s heavier 2-deep nesting; relative-date presets and multi-select record pickers are a later enrichment.',
    reference: 'design:components/data/DataBrowse.astro',
    showCode: false,
    usageDo: [
      'Draw it in the app\'s filter language: an ff-trigger + an ff-panel popover with catalog Select/Input — never a bespoke popover or native selects that read as a different pattern.',
      'Make the and/or conjunction a property of the GROUP, shared across its siblings: row 1 "Where" (static), row 2 the editable and/or, rows 3+ static text mirroring it.',
      'Scope the operator list to the field type — never show "greater than" for a checkbox or "is checked" for text.',
      'Offer + Add condition, + Add condition group, and Copy from another view; badge the trigger with the active-condition count and give it the ff-on active treatment.',
      'Reset the grid cursor whenever the filter tree changes — the result set changed.',
    ],
    usageDont: [
      "Don't invent a new look — no bespoke popover chrome or native selects; it must read as the same filter language as the faceted filters beside it.",
      "Don't let a single group mix and + or — the conjunction is homogeneous per group; to mix logic, nest a group with the opposite conjunction.",
      "Don't nest deeper than one level of groups — keep the tree shallow; A AND (B OR C) is the target, not arbitrary depth.",
      "Don't mix this with the faceted filter's toggles — that hides field TYPES; this filters row VALUES.",
      "Don't leave a stale cursor after a filter change — the old window no longer matches.",
    ],
    examples: [
      {
        label: 'Condition builder — Where + and/or conjunction + a nested condition group',
        html: `
<div class="rounded-box border border-base-300 bg-base-100 p-3 shadow-lg text-sm" style="width:520px;max-width:92vw">
  <div class="text-xs text-base-content/55 mb-2">In this view, show records</div>
  <div class="flex items-center gap-2 mb-2">
    <span class="inline-flex items-center justify-center text-xs text-base-content/60" style="width:56px">Where</span>
    <select class="select select-sm" style="width:150px"><option>Status</option></select>
    <select class="select select-sm" style="width:130px"><option>is</option></select>
    <input class="input input-sm flex-1" value="Active" />
    <button class="inline-grid place-items-center size-7 rounded-md text-base-content/45"><span class="iconify lucide--copy size-3.5"></span></button>
    <button class="inline-grid place-items-center size-7 rounded-md text-base-content/45"><span class="iconify lucide--trash-2 size-3.5"></span></button>
    <button class="inline-grid place-items-center size-7 rounded-md text-base-content/35"><span class="iconify lucide--grip-vertical size-3.5"></span></button>
  </div>
  <div class="flex items-start gap-2 mb-2">
    <select class="select select-sm" style="width:56px;padding-inline:6px"><option>and</option><option>or</option></select>
    <div class="flex-1 rounded-lg border border-base-300 bg-base-200/40 p-2">
      <div class="flex items-center gap-2 mb-2">
        <span class="inline-flex items-center justify-center text-xs text-base-content/60" style="width:44px">Where</span>
        <select class="select select-sm" style="width:130px"><option>Lifetime value</option></select>
        <select class="select select-sm" style="width:70px"><option>&gt;</option></select>
        <input class="input input-sm flex-1" value="1000" />
      </div>
      <div class="flex items-center gap-2">
        <select class="select select-sm" style="width:44px;padding-inline:6px"><option>or</option><option>and</option></select>
        <select class="select select-sm" style="width:130px"><option>Plan</option></select>
        <select class="select select-sm" style="width:70px"><option>is</option></select>
        <input class="input input-sm flex-1" value="Enterprise" />
      </div>
    </div>
  </div>
  <div class="flex items-center gap-3 pt-1">
    <button class="btn btn-sm btn-ghost gap-1.5"><span class="iconify lucide--plus size-3.5"></span>Add condition</button>
    <button class="btn btn-sm btn-ghost gap-1.5"><span class="iconify lucide--folder-plus size-3.5"></span>Add condition group</button>
    <button class="btn btn-sm btn-ghost gap-1.5 ml-auto"><span class="iconify lucide--copy size-3.5"></span>Copy from another view</button>
  </div>
</div>`,
      },
      {
        label: 'Collapsed trigger — ff-on with active-condition count badge',
        html: `
<div class="flex flex-wrap items-center gap-2" style="padding:1.25rem 1rem">
  <div class="btn btn-sm gap-1.5 ff-on" style="border-color:color-mix(in oklch,var(--color-primary) 35%,transparent);background:color-mix(in oklch,var(--color-primary) 12%,transparent);color:var(--color-primary)"><span class="iconify lucide--plus size-3.5"></span>Filter <span class="badge badge-sm badge-primary">3</span><span class="iconify lucide--chevron-down size-3 opacity-55"></span></div>
  <button class="btn btn-sm btn-ghost text-error gap-1"><span class="iconify lucide--x size-3.5"></span>Clear</button>
</div>`,
      },
    ],
  },
  {
    id: 'pattern-fields-picker',
    group: 'Patterns',
    name: 'Fields picker (show/hide + Names/Types/Categories)',
    summary: 'The Browse view\'s field-visibility control ("Fields", Airtable\'s term), on the LEFT with the pickers. Three searchable sub-tabs: Names (per-field toggles), Types, Categories — so you can hide one field or "hide all date fields" at once.',
    description:
      'Renamed from "Columns" to <strong>"Fields"</strong> (Airtable\'s term) and moved to the <strong>LEFT</strong> with Base / Table / +Filter — it is <em>view config</em>, not an export-adjacent action. Drawn in the app\'s filter language (an <code>ff-trigger</code> with a concept icon + an <code>ff-panel</code> popover), it gains three <strong>searchable sub-tabs</strong> (a field table can hold hundreds): <strong>Names</strong> (the default) — a per-field row (field-type icon + name + a <code>toggle toggle-sm toggle-primary</code>, name-left / toggle-right) to show/hide that one field; <strong>Types</strong> — one toggle per Airtable field type present ("hide all Date fields"); <strong>Categories</strong> — one toggle per coarse family (Text · Number · Date · Select · Link · Computed). Each sub-tab carries a search box. Reuses the same <code>ff-opt</code> row + toggle idiom as every other multi-select facet. Component: <code>components/data/DataBrowse.astro</code> (<code>.dg-fields*</code>).',
    reference: 'design:components/data/DataBrowse.astro',
    showCode: false,
    usageDo: [
      'Call it "Fields" and place it LEFT with the pickers — it configures the view, it is not an export control.',
      'Give it three searchable sub-tabs — Names (per-field toggles), Types, Categories — so a user can hide one field or a whole type at once.',
      'Reuse the ff-trigger / ff-panel chrome and the ff-opt + toggle row idiom; never a bespoke list.',
    ],
    usageDont: [
      "Don't put it on the right by Export — that reads as an export option, not view config.",
      "Don't drop the search — hundreds of fields are unnavigable without it.",
    ],
    examples: [
      {
        label: 'Fields picker — Names / Types / Categories sub-tabs + search + per-field toggles',
        html: `
<div class="rounded-box border border-base-300 bg-base-100 p-2 shadow-lg" style="width:280px">
  <div class="flex gap-0.5 rounded-lg bg-base-200 p-0.5 mb-2">
    <button class="flex-1 rounded-md bg-base-100 px-2 py-1 text-xs font-medium shadow-sm">Names</button>
    <button class="flex-1 rounded-md px-2 py-1 text-xs text-base-content/60">Types</button>
    <button class="flex-1 rounded-md px-2 py-1 text-xs text-base-content/60">Categories</button>
  </div>
  <label class="input input-sm w-full mb-2"><span class="iconify lucide--search size-3.5 opacity-50"></span><input placeholder="Search fields…" /></label>
  <label class="ff-opt"><span class="ff-icon"><span class="iconify lucide--type size-3.5"></span></span><span class="ff-label">Name</span><input type="checkbox" class="toggle toggle-sm toggle-primary" checked /></label>
  <label class="ff-opt"><span class="ff-icon"><span class="iconify lucide--calendar size-3.5"></span></span><span class="ff-label">Created</span><input type="checkbox" class="toggle toggle-sm toggle-primary" /></label>
</div>`,
      },
    ],
  },
  {
    id: 'pattern-record-history',
    group: 'Patterns',
    name: 'Record history (cross-backup diff timeline)',
    summary: "A record's biography across every backup — created / updated / deleted, each update expandable to per-field before → after diffs. The durable history Airtable truncates.",
    description:
      'The flagship of the Data page: what a record looked like at every backup, and exactly what changed between them — the history Airtable drops on restore and truncates by plan. It lives in the <a href="#pattern-detail-panel">record detail panel</a> as a <strong>reverse-chron timeline anchored to backup runs</strong> (newest first, Notion / Linear vintage). Each entry is stamped with its <strong>backup run</strong> (a link to the run detail) and a <strong>change marker</strong> — <em>created</em> (all fields added), <em>updated</em> (expandable), <em>deleted</em> (a tombstone) — the three are first-class (Bemi model), not one lumped "changed". An <strong>update expands to per-field <code>Field · Old → New</code> diffs</strong> (Salesforce column form) with <strong>Git two-tone</strong> — the old value in a red wash, the new in a green wash — so a value change reads at a glance; created rows show every field as an addition, deleted rows a single tombstone line. A <strong>"view as of this backup"</strong> toggle re-renders the Fields section at that point in time. Because the client caps how far back history goes by plan (2yr / 5yr / unlimited) but the UI never invents a limit, the section header states the <strong>available range</strong> — <em>"History since first backup · 14 runs"</em> — reflecting what we actually have, not a tier gate. Read-only; the diffs come from the engine comparing consecutive backups (<code>server-data-browse</code>).',
    reference: 'design:components/data/RecordPanel.astro (.rp-hist)',
    showCode: false,
    usageDo: [
      'Anchor every entry to its backup run (newest first) and link to that run — the run IS the timestamp.',
      'Treat created / updated / deleted as three distinct markers; only updates expand to field diffs.',
      'Show diffs as Field · Old → New with a red wash on the old value and a green wash on the new (Git two-tone).',
      'State the available history range in the header ("since first backup · N runs") — reflect what we have, never a plan cap.',
      'Offer "view as of this backup" to re-render Fields at that point in time.',
    ],
    usageDont: [
      "Don't collapse created/updated/deleted into one generic \"changed\" — the kind of change is the first thing to read.",
      "Don't invent a history limit or upsell in the UI — show the length actually available.",
      "Don't show a diff for a created row (everything is new) or a field list for a deleted row (it's gone) — a tombstone says it.",
    ],
    examples: [
      {
        label: 'The timeline — an update expanded to field diffs, a created entry, run stamps',
        html: `
<div class="text-sm" style="max-width:26rem">
  <div class="flex items-baseline justify-between pb-2">
    <span class="text-[11px] font-bold uppercase tracking-wider text-base-content/50">History</span>
    <span class="text-[11.5px] text-base-content/55">since first backup · 14 runs</span>
  </div>
  <div class="overflow-hidden rounded-[11px] border border-base-300" style="background:color-mix(in oklch, var(--color-base-200) 45%, transparent)">
    <div class="px-3 py-2.5">
      <div class="flex items-center gap-2"><span class="badge badge-soft badge-warning badge-sm">Updated</span><span class="text-base-content/60 text-[12px]">Jul 14 · run_8f2a1c</span></div>
      <div class="mt-2 space-y-1.5">
        <div class="flex items-center gap-2 text-[12.5px]"><span class="w-20 shrink-0 text-base-content/55">Status</span><span class="rounded px-1.5 py-0.5 line-through" style="background:color-mix(in oklch,var(--color-error) 15%,transparent)">Trial</span><span class="iconify lucide--arrow-right size-3 opacity-50"></span><span class="rounded px-1.5 py-0.5" style="background:color-mix(in oklch,var(--color-success) 16%,transparent)">Active</span></div>
        <div class="flex items-center gap-2 text-[12.5px]"><span class="w-20 shrink-0 text-base-content/55">Lifetime value</span><span class="rounded px-1.5 py-0.5 line-through font-mono" style="background:color-mix(in oklch,var(--color-error) 15%,transparent)">$980</span><span class="iconify lucide--arrow-right size-3 opacity-50"></span><span class="rounded px-1.5 py-0.5 font-mono" style="background:color-mix(in oklch,var(--color-success) 16%,transparent)">$4,120</span></div>
      </div>
    </div>
    <div class="border-t border-base-200 px-3 py-2.5">
      <div class="flex items-center gap-2"><span class="badge badge-soft badge-success badge-sm">Created</span><span class="text-base-content/60 text-[12px]">Jun 2 · run_1a0b02</span></div>
    </div>
  </div>
</div>`,
      },
    ],
  },
  {
    id: 'pattern-cell-provenance',
    group: 'Patterns',
    name: 'Cell provenance (formula · linked · lookup)',
    summary: 'Why a computed cell has its value — expand a formula, linked, or lookup cell to its inputs / linked set / source. One visual family, Airtable vocabulary.',
    description:
      'The other thing no competitor has: for a computed or relational cell, <em>where did this value come from?</em> In the <a href="#pattern-detail-panel">record panel</a> a Field row of the right type carries an <strong>expand affordance</strong> that opens one of three panels — deliberately the <strong>same visual family</strong> (a label header + a row list + optional search/paging) so provenance feels like one feature, not three. (1) <strong>Formula → Inputs</strong>: the expression rendered read-only, then one row per referenced field (from the backed-up schema) with that field&#39;s name, type icon, and <em>this record&#39;s</em> value; a referenced field that is itself computed gets its own expand — provenance <strong>nests one level at a time on demand</strong>, never pre-expanded (Excel <em>Trace Precedents</em> / dbt column lineage). (2) <strong>Linked record → Linked records</strong>: the collapsed row shows a count + the first few chips ("Orders · 2,340 linked"); expanded it is a <strong>searchable, cursor-paged list</strong> ("Load more") because a link field can hold thousands — each row opens <em>its</em> record (the panel pushes; back returns). (3) <strong>Lookup / rollup → Source</strong>: "<em>via ‹link field› from ‹table›</em>" then the source record(s) with the looked-up value on each; a rollup prepends the aggregation ("SUM of Amount across 14 records"). Uses native Airtable words (<em>inputs · linked records · via · rollup</em>) for instant recognition. Read-only; the schema + linked sets come from the backup (client-confirmed available for both static and dynamic).',
    reference: 'design:components/data/RecordPanel.astro (.rp-prov)',
    showCode: false,
    usageDo: [
      'Make all three provenance panels one visual family: a label header + a row list + optional search/paging.',
      'Nest formula inputs one level at a time on demand — never pre-expand the whole precedent tree.',
      "Page and search a linked set (it can hold thousands); show count + a few chips collapsed, the full list expanded.",
      'State a lookup/rollup source in Airtable words: "via ‹link field› from ‹table›"; prepend the aggregation for a rollup.',
      'Let a linked/source row push its own record into the panel, with back navigation.',
    ],
    usageDont: [
      "Don't dump thousands of linked chips inline — collapse to a count + preview, expand to a paged list.",
      "Don't invent provenance the backup doesn't hold — render only the captured schema + linked sets.",
      "Don't give the three panels three different looks — that makes provenance read as three unrelated features.",
    ],
    examples: [
      {
        label: 'Formula → Inputs (expression + referenced fields with this record\'s values)',
        html: `
<div class="text-sm" style="max-width:24rem">
  <div class="rounded-[11px] border border-base-300 overflow-hidden" style="background:color-mix(in oklch, var(--color-base-200) 45%, transparent)">
    <div class="px-3 py-2 border-b border-base-200 flex items-center gap-2"><span class="iconify lucide--variable size-3.5 opacity-70"></span><span class="font-mono text-[12px]">Amount * 1.2</span></div>
    <div class="px-3 py-2 flex items-center gap-2"><span class="iconify lucide--hash size-3.5 opacity-60"></span><span class="grow">Amount</span><span class="font-mono text-base-content/70">$420</span></div>
  </div>
</div>`,
      },
      {
        label: 'Linked → count + chips collapsed, paged list expanded · Lookup → Source',
        html: `
<div class="flex flex-col gap-3 text-sm" style="max-width:24rem">
  <div class="rounded-[11px] border border-base-300 overflow-hidden" style="background:color-mix(in oklch, var(--color-base-200) 45%, transparent)">
    <div class="px-3 py-2 border-b border-base-200 flex items-center gap-2"><span class="iconify lucide--link size-3.5 opacity-70"></span><span class="grow font-medium">Orders</span><span class="text-base-content/55 text-[12px]">2,340 linked</span></div>
    <label class="input input-sm m-2"><span class="iconify lucide--search size-3.5 opacity-50"></span><input placeholder="Search linked records" /></label>
    <div class="px-3 py-2 hover:bg-base-200 cursor-pointer">ORD-1001</div>
    <div class="border-t border-base-200 px-3 py-2 hover:bg-base-200 cursor-pointer">ORD-1002</div>
    <div class="border-t border-base-200 px-3 py-2 text-center text-primary text-[12px] cursor-pointer">Load more</div>
  </div>
  <div class="rounded-[11px] border border-base-300 overflow-hidden" style="background:color-mix(in oklch, var(--color-base-200) 45%, transparent)">
    <div class="px-3 py-2 border-b border-base-200 text-[12px] text-base-content/60">via <strong>Contact</strong> from <strong>Contacts</strong></div>
    <div class="px-3 py-2 flex items-center gap-2 hover:bg-base-200 cursor-pointer"><span class="grow">Ada Okoye</span><span class="font-mono text-base-content/70">ada@ex.com</span></div>
  </div>
</div>`,
      },
    ],
  },
  {
    id: 'pattern-locked-tab',
    group: 'Patterns',
    name: 'Locked capability state (in place)',
    summary: 'When a whole tab/feature needs a capability the Space lacks, render it in place as a locked card that says what it does + why — never hide it.',
    description:
      'Some Data-page features need a <strong>dynamic (database) backup</strong>; a static/BYOS Space has files, not a queryable store, so change-tracking can\'t run. Rather than hide those tabs, render the feature <strong>in place as a locked state</strong> (the same principle as the plan-gated states elsewhere — the <a href="#pattern-prompt-editor">prompt editor</a>\'s below-tier read-only, the <a href="#checkbox-toggle">disabled item</a> rule): a centered card with a <code>lucide--lock</code> mark, the feature\'s name, <strong>one line on what it does</strong>, <strong>one line on why it needs dynamic</strong> ("Change tracking compares every backup in a live database"), and the standard enable/upgrade affordance. Seeing <em>what changed</em> is the flagship reason to move up, so the locked state IS the pitch — shown where the feature would be, not buried. This is a <strong>data-capability</strong> constraint (files can\'t be diffed), not a price tier. On the Data page it backs the <strong>Changelog tab, record History, and Chat</strong> in static-only Spaces. Calm, not alarming — a lock, not a warning triangle.',
    reference: 'design:components/data/LockedTab.astro (.lt-*)',
    showCode: false,
    usageDo: [
      'Render the feature in place as a locked card — name + what it does + why it needs the capability + the enable affordance.',
      'Use lucide--lock (calm), not a warning triangle; keep the copy factual, not alarming.',
      'Say plainly why it is locked ("needs a dynamic backup") — a capability reason, not a bare "upgrade".',
    ],
    usageDont: [
      "Don't hide the tab — an absent tab teaches nothing; the locked state is the pitch for the capability.",
      "Don't frame a data-capability limit as a price tier, or vice-versa — name the actual reason.",
      "Don't use an error/warning colour — this is a calm locked state, not a failure.",
    ],
    examples: [
      {
        html: `
<div class="flex flex-col items-center justify-center text-center gap-2 rounded-box border border-dashed border-base-300 p-12" style="background:color-mix(in oklch, var(--color-base-200) 30%, transparent)">
  <span class="grid place-items-center size-12 rounded-xl bg-base-200"><span class="iconify lucide--lock size-5 opacity-60"></span></span>
  <p class="text-base font-semibold">Change tracking needs a dynamic backup</p>
  <p class="text-sm text-base-content/60 max-w-md">The Changelog compares every backup in a live database. Your Space stores static files, so there's nothing to diff — switch to a dynamic backup to see what changed between runs.</p>
  <button class="btn btn-primary btn-sm mt-1">Enable dynamic backups</button>
</div>`,
      },
    ],
  },
  {
    id: 'pattern-changelog-timeline',
    group: 'Patterns',
    name: 'Changelog timeline (columnar entry rows)',
    summary: 'A grouped timeline whose entries are fixed, ALIGNED columns — Location · What · Type · Time — so the feed reads like a table down a rail, not scattered text. THREE feeds share it: Schema changelog, Data changelog, Data comments.',
    description:
      'The shared row shape for the <strong>Schema changelog</strong> and the <strong>Data ▸ Comments</strong> feed. <strong>CORRECTION, 2026-07-30:</strong> this entry used to claim the Data changelog was on this grid too, and it is NOT — <code>DataChangelog.astro</code> was redesigned in iterations 2–3 into a run-grouped count list with its own <code>.dc-*</code> classes and its own catalog entry, <a href="#pattern-data-changelog">pattern-data-changelog</a>, and it does not reference <code>.cl-entry</code> anywhere. The stale claim survived because nobody re-read it after that redesign, and it sent a build brief to the wrong file. Two feeds share this grid, not three. The <strong>timeline</strong> stays — a single rail down the left with a coloured node per entry, grouped by day (Schema) or by backup run (Data). What changed is the <strong>entry ROW</strong>: it is NOT a flex-wrap of name + badge + time (which shifts the badge/time to a different x on every row as the name length varies — the scattered look this pattern fixes). Instead each row is a <strong>CSS grid of fixed columns that line up across every entry</strong>, left → right: (1) <strong>Location / name</strong> — Base ▸ Table ▸ Entity (Data: Base · Table · record), a fixed-width column that <em>truncates</em> and never pushes the others; (2) <strong>What changed</strong> — the summary + <code>before → after</code> delta with Git two-tone (old in a red wash, new in a green wash), the flex column; (3) <strong>Change type</strong> — the soft-semantic <a href="#badge">badge</a> (Added/Removed/Renamed/Type-changed/Config/View; Data: Created/Updated/Deleted), a fixed column; (4) <strong>Time</strong>, right-aligned, <code>tabular-nums</code> (the day/run header already carries the date). A <strong>⚠ attention line</strong> sits under the row in the What-changed column when a change may have broken data. The whole row is <a href="#pattern-row-actions">row-clickable</a> into the detail drawer / record panel; the Location is its own click-through. Because the columns are fixed, the <strong>Type badge and Time share the exact same left-edge x on every row</strong> — that alignment is the point. <strong>Where the CSS lives (2026-07-29):</strong> the feed + row grid — <code>.cl-feed</code> rail, <code>.cl-fhead</code> column header, <code>.cl-day*</code> headers, <code>.cl-entry</code> / <code>.cl-node</code> / <code>.cl-c-*</code> columns and their inner Location / What / Type / Time parts — is defined ONCE in <code>styles/global.css</code>, not in a component\'s scoped <code>&lt;style&gt;</code>. That is not tidiness: an Astro scoped style never reaches a SIBLING component\'s DOM, so a second feed written in its own component could not have reused the grid at all — it would have had to copy it, which is exactly the drift this entry exists to stop (the same extraction already done for <code>.sch-tabbar</code> / <a href="#pattern-section-tabs">pattern-section-tabs</a>). A feed component keeps only what is genuinely its own (its detail drawer, its empty state) in scoped CSS. <strong>Third feed — Data ▸ Comments (comments-explorer, 2026-07-29):</strong> the same grid MECHANISM and the same class names, but its own column WIDTHS — declared under <code>.cm</code> only, never by editing <code>.cl-entry</code>, which three feeds now share. Seven columns: <strong>Location</strong> (base › table — the base NEVER truncates, the table yields first: the base is the orientation anchor and a stream you cannot orient in is not scannable), <strong>Record</strong> (its own column carrying the record\'s primary-field value — founder, 2026-07-30: "the listing table should have a column with the Record primary key value of the record it\'s tied to"), <strong>Author</strong> (an <strong>initials chip</strong> + the name — Airtable ships no profile picture, so initials are the whole visual identity available; a repeated identical person-glyph would be a wall of sameness that distinguishes nobody), <strong>Comment</strong> (the one-line snippet, with <code>@[usrXXX]</code> mention tokens RESOLVED against the payload\'s <code>mentioned</code> map — a raw id must never reach the screen), <strong>Status</strong>, <strong>Time</strong>. Author and Comment are SEPARATE columns because sharing one cell put the "Comment" header over the author\'s NAME. <strong>Status is THREE states, not two (founder, 2026-07-30).</strong> The founder corrected the original reasoning: a capture returns a record\'s WHOLE comment list, so a comment missing from a re-captured record is <em>certainly</em> deleted — no extra pass, no inference. So (1) present → <strong>no badge at all</strong> (marking the normal case put 18 identical pills in a 20-row view; a column that shouts on every row stops being read); (2) the record was captured again without this comment → <strong>"Deleted"</strong>, soft-error, matching the changelog\'s <code>removed</code> colour — now a legitimate claim; (3) the RECORD itself is gone from the backup → <strong>"Last seen &lt;date&gt;"</strong>, soft-warning, because deletion and a record leaving backup scope are indistinguishable here and only this third case still has to hedge. Do not collapse (2) and (3) into one badge — that trades a fact for a guess. <strong>Location glyphs (2026-07-30):</strong> the Location column\'s Base and Table segments (and, when a feed\'s third segment is a field or a view, that segment too) each carry their concept glyph — the same <code>lucide--database</code> / <code>lucide--table-2</code> / <code>lucide--tag</code> / <code>lucide--eye</code> icons the drawer breadcrumb (<code>.sb-crumb-ic</code>, <a href="#pattern-entity-panel">EntityPanel</a>) and the Browse tree already use, 14px + muted, <code>aria-hidden</code> — never a sixth hand-rolled ternary. All THREE feeds pull the glyph from the ONE shared mapping in <code>components/schema/entityIcon.ts</code> (<code>entityIconClass</code> for the bare iconify classes, <code>entityIconMarkup</code> for ready <code>&lt;span&gt;</code> markup), which replaced five prior copies (<code>schemaReadBody.ts</code>, <code>schemaInterfaces.ts</code>, <code>schemaAutomations.ts</code>, <code>SchemaHealth.astro</code>, <code>EntityPanel.astro</code>\'s <code>kindIcon</code>). A glyph never changes the row\'s 40px height (icon ≤ the row\'s own line-height, centered by the existing flex row) and never eats the Base column\'s room in Data ▸ Comments (the glyph sits in the fixed Base/Table slot, not inside the flexible one). <strong>Record has no glyph</strong> — open, Oleh\'s call (2026-07-30); <code>RecordPanel</code>\'s header currently reuses the table glyph for it, which is a placeholder, not a decision. Components: <code>SchemaChangelog.astro</code> (.cl-*) · <code>DataChangelog.astro</code> (.dc-*) · <code>DataComments.astro</code> (.cm-*, rows on the shared .cl-* grid).',
    reference: 'styles/global.css (.cl-* feed + row grid) · components/schema/entityIcon.ts (concept-glyph mapping) · components/schema/SchemaChangelog.astro · components/data/DataComments.astro',
    showCode: false,
    usageDo: [
      'Keep the timeline rail + grouping (by day for schema changes, by backup run for record changes).',
      'Lay each entry as fixed grid COLUMNS (Location · What changed · Type · Time) that align across every row — never a flex-wrap that moves the badge/time with the name length.',
      'Truncate the Location column; let the What-changed column flex; right-align Time with tabular-nums.',
      'Keep the before→after Git two-tone and the ⚠ attention line (under the row) — only the layout changes.',
      'Use the SAME row grid in the Schema changelog, the Data changelog and the Data comments feed so all three read identically.',
      'Take the grid from global.css (.cl-feed / .cl-fhead / .cl-day* / .cl-entry / .cl-node / .cl-c-*) — a new feed adds a component, not a second copy of the grid.',
      'Resolve identity tokens before they render: a comment snippet must show the mention as a name, never a raw @[usrXXX] id.',
      'Keep a status badge to what the capture can actually prove — "Last seen <date>" for a comment that has left the source, with the explanation in a tooltip.',
      'Give Base / Table (and Field / View when they appear) their concept glyph in the Location column via entityIcon.ts (entityIconClass / entityIconMarkup) — matching the drawer breadcrumb (.sb-crumb-ic) treatment.',
    ],
    usageDont: [
      "Don't let the name length push the Type badge / Time to different x-positions row to row — that's the scattered bug.",
      "Don't drop the timeline — the rail + grouping is the liked part; only the entry becomes columnar.",
      "Don't diverge the Schema, Data and Comments row layouts — one grid, three feeds.",
      "Don't put the row grid back in a scoped <style> — it cannot reach a sibling feed component, so the next feed would have to copy it.",
      "Don't state a deletion you can't observe: an absent comment could equally be a record that left backup scope or a missed capture window.",
      "Don't hand-roll another base/table/field/view icon ternary — import it from entityIcon.ts, the one shared mapping.",
    ],
    examples: [
      {
        label: 'Two aligned entry rows under a day header (Type + Time line up)',
        html: `
<div class="text-sm" style="max-width:44rem">
  <div class="flex items-center gap-3 pb-2"><span class="size-2.5 rounded-full border-2 border-base-content/30"></span><span class="text-[11px] font-bold uppercase tracking-wider text-base-content/55">June 21, 2026</span></div>
  <div class="grid items-center gap-3 py-2 border-t border-base-200" style="grid-template-columns:1.25rem 14rem minmax(0,1fr) 9rem 5rem">
    <span class="size-2.5 rounded-full" style="background:var(--color-success)"></span>
    <span class="truncate"><strong>Sales CRM</strong> <span class="text-base-content/50">▸ Q2 Forecast</span></span>
    <span class="truncate text-base-content/80">New table added (3 fields)</span>
    <span><span class="badge badge-soft badge-success badge-sm">Added</span></span>
    <span class="text-right font-mono tabular-nums text-base-content/55 text-[12px]">2:07 PM</span>
  </div>
  <div class="grid items-center gap-3 py-2 border-t border-base-200" style="grid-template-columns:1.25rem 14rem minmax(0,1fr) 9rem 5rem">
    <span class="size-2.5 rounded-full" style="background:var(--color-warning)"></span>
    <span class="truncate"><strong>Marketing</strong> <span class="text-base-content/50">▸ Campaigns</span></span>
    <span class="truncate"><span class="rounded px-1 line-through" style="background:color-mix(in oklch,var(--color-error) 15%,transparent)">Lead Source</span> <span class="iconify lucide--arrow-right size-3 opacity-50"></span> <span class="rounded px-1" style="background:color-mix(in oklch,var(--color-success) 16%,transparent)">Acquisition Channel</span></span>
    <span><span class="badge badge-soft badge-primary badge-sm">Renamed</span></span>
    <span class="text-right font-mono tabular-nums text-base-content/55 text-[12px]">11:40 AM</span>
  </div>
</div>`,
      },
    ],
  },
  {
    id: 'pattern-data-changelog',
    group: 'Patterns',
    name: 'Data changelog (records, grouped by backup run)',
    summary: 'The record-level sibling of the schema changelog: ONE ROW PER backup run with created / updated / deleted COUNT columns; click a run to drill into its records.',
    description:
      'The schema <a href="#pattern-detail-panel">changelog</a> answers "what changed about the <em>structure</em>"; this answers "what changed about the <em>records</em>". <strong>Iteration 2 (Dan 2026-07-15):</strong> a single backup run can create <em>thousands</em> of records, so the feed is NOT a per-record timeline — it collapses to <strong>one row per backup run</strong> (newest first) with three <strong>count columns: Created · Updated · Deleted</strong> (from the run\'s true totals). Every run shows, including a type with zero (that column just reads 0). <strong>Iteration 3 (Dan 2026-07-21): clicking a run opens a NON-MODAL multi-panel drill</strong> — each run is a panel in the shared <a href="#pattern-multi-panel-drawer">multi-panel drawer</a> canon (anchor slot-0 + detach, ⌘/Ctrl-click a run row or the round ＋ = <strong>open-beside to COMPARE runs</strong>, cap 10 with auto-accordion strips, per-panel resize + reorder + undoable ✕, the stack shutter). The panel header follows the 2026-07-21 drawer-header canon: day title, <strong>"Jump to this backup" as a corner icon</strong> (label in the tooltip), synced-time + <strong>run-id chip with one-click copy</strong> on the crumb row. Inside, Created / Updated / Deleted are <strong>TRUE TABS</strong> (pill chips with counts; a zero-count tab stays visible, muted) — one type at a time, full-area, <strong>paginated 50/page</strong> ("‹ Prev · 1–50 of N · Next ›"); <strong>clicking a record opens the <a href="#pattern-record-history">record panel</a> with History focused</strong>; when a run\'s true count exceeds the shipped sample, an honest "showing the N sampled of M" line. The ＋ picker lists every backup (day + id + c/u/d counts, searchable; open runs marked). It shares the changelog chrome: the <code>.sch-tb</code> toolbar with the shared <a href="#pattern-faceted-filter">faceted filters</a> (Base · Table · Change type) + a Time range, a red Clear, and CSV/JSON <a href="#pattern-export-control">export</a> whose scope is the <strong>change type</strong>; the toolbar filters drive open panels live. Change-type colour follows the record-history badges (created = success, updated = warning, deleted = error). Read-only. <strong>Drill-row navigation (Dan 2026-07-23, revised — Option A):</strong> a record clicked in a run drill opens in the drill\'s OWN stack, never as a second overlapping drawer. Exactly like a field inside the Schema <a href="#pattern-entity-panel">EntityPanel</a>: a <strong>plain click drills IN PLACE within the same panel</strong> (its body carries a run→record visit-stack) with a <strong>Back arrow</strong> that returns to the run\'s record list; <strong>⌘/Ctrl-click or middle-click opens the record as a NEW panel beside</strong> in the same stack; the hover/focus <code>⧉</code> does the same. One stack, one rail, one cap — no second drawer, no second rail, no z-index fight. The record body is the shared <code>recordReadBody.ts</code> (see <a href="#pattern-record-panel">Record panel</a>). This replaced an earlier build where the record opened the standalone RecordPanel over the drill and needed a "Back to the changelog" arrow to escape the occlusion — that whole second mechanism is gone. Component: <code>components/data/DataChangelog.astro</code> (<code>.dc-*</code> list, <code>.dcp-*</code> panels).',
    reference: 'design:components/data/DataChangelog.astro (.dc-* / .dcp-*)',
    showCode: false,
    usageDo: [
      'Collapse to ONE ROW PER RUN with Created / Updated / Deleted count columns — a run can carry thousands of records, so never a per-record feed.',
      'Drill = the shared multi-panel drawer canon: plain click lands in the anchor, ⌘-click / ＋ opens beside to compare runs, cap 10 with accordion strips.',
      'Show Created / Updated / Deleted as TRUE TABS (counts on the pills, zero-count muted but present), one type full-area, paginated 50/page.',
      'Open the record panel (History focused) when a record in a panel is clicked — one source of truth for per-record history.',
      "State the truth when a run's real count exceeds the sample (showing the N sampled of M) + the Jump-to-backup corner icon.",
      'Reuse the changelog toolbar: Base / Table / Change-type facets + a Time range + a red Clear + CSV/JSON export (scope = change type); filters re-render open panels.',
    ],
    usageDont: [
      "Don't render a per-record timeline — thousands of created rows are unreadable; the run row + drill panels is the model.",
      "Don't rebuild a second history view — a record row deep-links into the record panel's History section.",
      "Don't hide a run with zero changes of a type — show the 0 (row column and tab) so the run trail is complete.",
      "Don't make the drill modal — the run list stays clickable behind the panels (non-modal drawer canon).",
    ],
    examples: [
      {
        label: 'A run group with Created / Updated / Deleted sections',
        html: `
<div class="text-sm" style="max-width:34rem">
  <div class="flex items-center gap-2 pb-2"><span class="iconify lucide--history size-4 opacity-60"></span><strong>Jul 14 · run_8f2a1c</strong><span class="text-base-content/50 text-[12px]">Synced 09:12</span></div>
  <div class="overflow-hidden rounded-[11px] border border-base-300" style="background:color-mix(in oklch, var(--color-base-200) 45%, transparent)">
    <div class="flex items-center gap-2 px-3 py-2 border-b border-base-200"><span class="badge badge-soft badge-success badge-sm">Created</span><span class="text-base-content/60 text-[12px]">3 records</span></div>
    <div class="flex items-center gap-2 px-3 py-2 hover:bg-base-200 cursor-pointer"><span class="grow font-medium">ORD-1204</span><span class="text-base-content/55 text-[12px]">Orders</span><span class="iconify lucide--chevron-right size-3.5 opacity-40"></span></div>
    <div class="flex items-center gap-2 px-3 py-2 border-t border-base-200"><span class="badge badge-soft badge-warning badge-sm">Updated</span><span class="text-base-content/60 text-[12px]">2 records</span></div>
    <div class="flex items-center gap-2 px-3 py-2 border-t border-base-200 hover:bg-base-200 cursor-pointer"><span class="grow font-medium">Ada Okoye</span><span class="text-base-content/55 text-[12px]">Contacts · 2 fields</span><span class="iconify lucide--chevron-right size-3.5 opacity-40"></span></div>
  </div>
</div>`,
      },
    ],
  },
  {
    id: 'pattern-removed-notice',
    group: 'Patterns',
    name: 'Removed / deleted notice',
    summary: 'The in-panel banner for an entity that no longer exists in the source — a catalog warning Alert, not a hand-rolled grey box.',
    description:
      'When a detail panel shows an entity that was deleted in Airtable (kept only from the last backup), it leads with a <a href="#alert">soft warning Alert</a> — <code>alert alert-soft alert-warning</code> + <code>lucide--trash-2</code> + "This {field/table} no longer exists in Airtable (deleted {date}). Showing the last backup." <strong>Amber (warning)</strong> is used for consistency: every other "Removed" signal in the app is warning-toned (the Removed <a href="#badge">badges</a> on Automations / Interfaces / Relationships). It is the catalog <a href="#alert">Alert</a> primitive, never a bespoke banner, so it reads the same everywhere a removed/deleted entity surfaces (EntityPanel, and the invalid-relationship notice). A one-token swap to <code>alert-error</code> (red) is possible if the product decides deletion should read as destructive rather than advisory. Live: <a href="/panels">Panel Lab</a> → EntityPanel → "Field — removed".',
    reference: 'views/schema/BrowseTab.astro (removed notice)',
    showCode: false,
    usageDo: [
      'Use the catalog Alert (alert alert-soft alert-warning) — never a hand-rolled grey box.',
      'Amber/warning to match every other Removed indicator; keep the trash icon + "showing the last backup" copy.',
      'Reuse the same treatment wherever a removed/deleted entity is surfaced.',
    ],
    usageDont: [
      "Don't invent per-panel removed styling — it drifts and stops reading as a warning.",
      "Don't leave it flat/neutral grey — a removed entity is a state the user must notice.",
    ],
    examples: [
      {
        html: `
<div role="status" class="alert alert-soft alert-warning">
  <span class="iconify lucide--trash-2 size-4"></span>
  <span>This field no longer exists in Airtable (deleted May 14, 2026). Showing the last backup.</span>
</div>`,
      },
    ],
  },
  {
    id: 'pattern-deleted-items',
    group: 'Patterns',
    name: 'Deleted items (hidden by default · reveal + mark)',
    summary: 'Entities deleted in the source are kept for history, hidden by default, revealed by one toggle and shown muted + dated.',
    description:
      'Schema entities deleted in Airtable are retained for history, but they shouldn’t clutter the default views. Browse (tree + flat) shows only <strong>active</strong> (and <code>unknown</code>) entities by default; <code>removed</code> ones are hidden. A single neutral <a href="#checkbox-toggle">checkbox</a> — <strong>"Include deleted"</strong> with a <strong>count <a href="#badge">badge</a></strong> (the discoverable "N deleted" affordance) and a <a href="#tooltip">tooltip</a> — reveals them. Revealed rows render <strong>muted</strong> with a neutral <strong>"Deleted" badge</strong> and a caption <em>"no longer in Airtable since &lt;date&gt;"</em>. They stay selectable: the <a href="#pattern-entity-panel">entity panel</a> opens read-only with a banner ("no longer exists in Airtable, showing the last backup") and the last-known values, <strong>no edit / publish / AI</strong>. <code>unknown</code> entities (couldn’t be confirmed this run) are NOT treated as deleted and stay visible. Deleted entities never appear in the live <a href="/schema">Visualize</a> diagram or the field-visibility picker. <strong>No Restore here</strong> — Schema is read-only; restoring lives in the Backups flow. <br><br><strong><code>unknown</code> is a THIRD state, not a shade of removed.</strong> It means <em>"not seen in the latest capture"</em> — the entity was in an earlier snapshot and the newest run neither confirmed nor contradicted it (a partial capture, a permissions gap, a table we could not read). It is a gap in <em>our</em> read, not a defect in the user\'s base, so it renders <strong>at full opacity</strong> (never the <code>.5</code> mute) with a <strong>soft INFO badge "Not in latest capture"</strong> and a tooltip naming the last run that did see it. <strong>Amber is forbidden</strong> here: amber is this app\'s Removed/warning voice everywhere else (the removed banner, the Removed badges), so an amber <code>unknown</code> would read as "your data broke" for what is really "we did not look". Ghost-grey is equally wrong — that is the Deleted badge. Info is the only tone left that says <em>informational, unresolved, no action implied</em>. Components: <code>components/schema/SchemaBrowse.astro</code> + <code>EntityPanel.astro</code>. Live: <a href="/schema">Schema</a> → Browse.',
    reference: 'design:components/schema/SchemaBrowse.astro',
    showCode: false,
    usageDo: [
      'Hide removed by default; reveal with ONE neutral checkbox + a count badge (the discoverable "N deleted").',
      'Mark a revealed item: muted row + a "Deleted" badge + the removal date ("no longer in Airtable since …").',
      'Keep removed items inspectable but read-only — the panel shows a banner + last-known values, no edit/publish/AI.',
      'Keep `unknown` (unconfirmed) items visible; only `removed` hides behind the toggle.',
      'Render `unknown` at FULL opacity with a soft INFO badge "Not in latest capture" — never muted, never amber, never a "Deleted" badge.',
    ],
    usageDont: [
      "Don't offer Restore here — Schema is read-only; restoring belongs in the Backups flow.",
      "Don't treat `unknown` as deleted, and don't show deleted entities in the live diagram or field picker.",
      "Don't colour the toggle/checkbox or the Deleted badge red — deletion is neutral history, not an error.",
      "Don't render `unknown` in amber/warning — amber is this app's Removed voice and reads as \"something is wrong with your data\"; a missed capture is a gap in OUR read, not a defect in theirs.",
    ],
    examples: [
      {
        label: 'Browse — "Include deleted" on, a deleted field revealed (muted + badge + date)',
        html: `
<div style="padding:1rem">
  <label class="inline-flex items-center gap-2 text-sm" style="padding-bottom:.85rem"><input type="checkbox" class="checkbox checkbox-sm" checked /> Include deleted <span class="badge badge-sm badge-ghost">2</span></label>
  <div class="rounded-box border border-base-300 bg-base-100 overflow-hidden text-sm">
    <div class="flex items-center gap-2 border-b border-base-200" style="padding:.7rem .8rem"><span class="iconify lucide--table-2 size-4 opacity-70"></span><span class="font-medium grow">Companies</span><span class="size-2 rounded-full bg-success"></span></div>
    <div class="flex items-center gap-2 border-b border-base-200" style="padding:.7rem .8rem .7rem 2.2rem"><span class="iconify lucide--type size-3.5 opacity-70"></span><span class="font-medium grow">Industry</span><span class="size-2 rounded-full bg-success"></span></div>
    <div class="flex items-center gap-2" style="padding:.7rem .8rem .7rem 2.2rem;opacity:.5"><span class="iconify lucide--type size-3.5 opacity-70"></span><span class="font-medium" style="flex:none">Legacy ID</span><span class="badge badge-sm badge-ghost" style="font-weight:600">Deleted</span><span class="text-xs grow" style="color:oklch(from var(--color-base-content) l c h /.58)">no longer in Airtable since May 14, 2026</span></div>
  </div>
</div>`,
      },
      {
        label: 'Entity panel — read-only banner for a removed entity',
        html: `
<div style="padding:1rem;max-width:430px">
  <div class="flex items-center gap-2" style="padding:.6rem .8rem;border:1px solid var(--color-base-300);border-radius:10px;background:oklch(from var(--color-base-200) l c h /.6);font-size:12.5px;line-height:1.4"><span class="iconify lucide--trash-2 size-4" style="opacity:.55"></span><span>This field no longer exists in Airtable (deleted May 14, 2026). Showing the last backup.</span></div>
</div>`,
      },
      {
        label: 'The three states side by side — active · unknown (full opacity, soft info) · removed (muted, ghost)',
        html: `
<div style="padding:1rem">
  <div class="rounded-box border border-base-300 bg-base-100 overflow-hidden text-sm">
    <div class="flex items-center gap-2 border-b border-base-200" style="padding:.7rem .8rem"><span class="iconify lucide--eye size-4 opacity-70"></span><span class="font-medium grow">Active Campaigns</span><span class="badge badge-soft badge-success gap-1"><span class="size-1.5 rounded-full bg-current"></span>Healthy</span></div>
    <div class="flex items-center gap-2 border-b border-base-200" style="padding:.7rem .8rem"><span class="iconify lucide--eye size-4 opacity-70"></span><span class="font-medium grow">Regional split</span><span class="badge badge-soft badge-info">Not in latest capture</span></div>
    <div class="flex items-center gap-2" style="padding:.7rem .8rem;opacity:.5"><span class="iconify lucide--eye size-4 opacity-70"></span><span class="font-medium" style="flex:none">Q1 pipeline</span><span class="badge badge-ghost" style="font-weight:600">Deleted</span><span class="text-xs grow" style="color:oklch(from var(--color-base-content) l c h /.58)">no longer in Airtable since Jun 2, 2026</span></div>
  </div>
</div>`,
      },
    ],
  },
  {
    id: 'pattern-view-details',
    group: 'Patterns',
    name: 'View details (Airtable views in Schema)',
    summary: 'An Airtable view as a first-class Schema entity — its own "Views (n)" group under the table, a lucide--eye mark, and a panel that states plainly what Airtable will never tell us.',
    description:
      'Airtable <strong>views</strong> (Grid, Form, Calendar, Gallery, Kanban, Timeline, Gantt) are captured alongside tables and fields and surface everywhere an entity can: <a href="/schema">Browse</a>, the entity typeahead, Docs tagging, the Changelog, and the shared <a href="#pattern-entity-panel">entity panel</a>.<br><br>' +
      '<strong>Where they live in Browse.</strong> A view is <em>not</em> a sibling of a field. Under each table the tree renders <strong>two independent groups</strong> — the fields, then a collapsible <strong>"Views (n)"</strong> group — because a view is a lens over the whole table, not one more column in it. Each group caps independently with its own <a href="#pattern-node-showmore">"Show N more"</a>, so a table with 4 fields and 120 views does not bury the fields, and a table with 900 fields does not bury the views. The table caption reads "N fields · M records · K views". A "View types" <a href="#facet-filter">facet</a> sits beside the Field-types facet, and the deleted-items filter is relabelled <strong>"Status"</strong> because it now governs three kinds, not one.<br><br>' +
      '<strong>The mark and the word.</strong> One icon everywhere: <code>lucide--eye</code>, and the kind word is <strong>"View"</strong> — in the tree, the flat table, the typeahead group header, the panel header, Docs chips, and the Changelog location. A view that appears anywhere without its eye, or labelled "Table", is a bug.<br><br>' +
      '<strong>The panel — three blocks and nothing invented.</strong> (1) <strong>Identity</strong>: name, type, health, and a <strong>Personal vs Collaborative</strong> badge (Airtable\'s <code>personalForUserId</code> — a personal view is only visible to its owner, which is exactly the kind of thing that surprises someone during a restore). (2) <strong>"Fields shown · N of M"</strong> with the named field chips, <strong>grid views only</strong> — <code>visibleFieldIds</code> is returned for grid views and nothing else, so for a Form or Kanban this block is absent, not empty. (3) <strong>History</strong> — the view\'s own changelog entries.<br><br>' +
      '<strong>"Fields shown" — name them, do not only count them.</strong> The block renders <a href="#entity-chip">entity chips</a> (<code>entityChip()</code>), one per <code>visibleFieldIds</code> entry, each carrying that field\'s <strong>Airtable field-type glyph</strong> and the panel-push hook so a click drills straight to the field. Panel list canon applies unchanged: <strong>cap at 5</strong> then an inline <strong>"+N more"</strong>, and a count badge from <strong>2 upward</strong>. A bare "12 of 34" answers a question nobody asked and provokes the one they did — <em>which ones?</em><br>' +
      '<strong>The denominator M is the owning table\'s LIVE field count</strong> — removed (deleted-in-Airtable) fields are excluded, exactly as the table panel excludes them. A view panel that says 12 while its own table panel says 11 is a bug, not a nuance. And a view NEVER borrows the table\'s "Fields · N · in this table" stat tile: on a view that tile reads as "this view shows N fields", which is a claim we cannot make.<br><br>' +
      '<strong>Two capture depths for one view.</strong> Through the official MCP server a view yields only id / name / type. On an <strong>Airtable enterprise account</strong> the REST API additionally returns which fields a grid view shows. Both scenarios ship, so a view panel must render either way — and the copy for the shallow case describes <strong>what this connection can supply</strong>. It is the <em>customer\'s Airtable plan</em>, never ours: <strong>no Baseout tier language, no upsell, no "upgrade" CTA, no price.</strong> Baseout does not gate product UI on plan, and this gate is not even ours to sell against.<br><br>' +
      '<strong>Referenced by → Views.</strong> A FIELD panel\'s <a href="#pattern-entity-panel">"Referenced by"</a> gains a <strong>Views</strong> group (<code>lucide--eye</code>) listing the views whose <code>visibleFieldIds</code> contains that field — the reverse of the block above, and the answer to "if I restore/rename this field, where does it show up?". It obeys the same rule as every other group in that section: <strong>an empty group is omitted entirely</strong>, never rendered as "Views 0". Since only grid views on a full-access connection carry <code>visibleFieldIds</code>, absence here means <em>unknown</em>, not <em>nowhere</em> — which is precisely why it must not render a zero.<br><br>' +
      '<strong>A view whose owning table is unresolved.</strong> Browse nests views strictly under their table, so a captured view with no resolved table would render nowhere at all — it would simply vanish. It gets an explicit per-base bucket instead (modelled on the base picker\'s "Still matching" group): a named group, visibly distinct from "this table has no views", with one line saying we hold the view but not which table it belongs to. Losing a row silently is the only outcome that is never acceptable.<br><br>' +
      '<strong>The type vocabulary</strong> is <code>grid · form · calendar · gallery · kanban · timeline · block</code>, where Airtable\'s <code>block</code> means <strong>Gantt</strong> (label it "Gantt", not "Block"). Treat the enum as <strong>open</strong>: Airtable ships new view types without warning, so an unrecognised type string renders in a plain neutral chip carrying the raw string rather than being coerced into a known type or dropped.<br><br>' +
      '<strong>Two DIFFERENT absences, worded differently — this is the point of the pattern.</strong> Conflating them is what makes a read-only tool feel broken.<br>' +
      '• <strong>Permanent, nobody\'s fault:</strong> a view\'s <em>filters, sorts, grouping, row height and colour rules</em> have <strong>no API at all</strong> — not REST, not the official MCP server, not at any plan tier. Say so once, plainly, in a quiet neutral line: <em>"Airtable does not expose a view\'s filters, sorts or grouping to any API, so they can\'t be captured."</em> No spinner, no "connect to see more", no retry — there is nothing to retry.<br>' +
      '• <strong>Fixable by the user:</strong> a field a reconnect with the right scope WOULD return uses the ordinary reconnect affordance. That one is actionable, so it gets an action.<br>' +
      'Never render a placeholder filter row, a greyed sort chip, or an empty "Configuration" card for the first kind. An empty slot that looks like it could fill reads as a promise the product cannot keep, and the founder will read it as a feature we shipped half of.',
    reference: 'design:components/schema/SchemaBrowse.astro · EntityPanel.astro · schemaEntities.ts',
    showCode: false,
    guides: [
      {
        title: 'View type → label + how to render it',
        note: 'Airtable\'s enum is open — an unknown string is displayed, never dropped or guessed.',
        default: 'grid',
        rows: [
          { token: 'grid', use: 'Label "Grid". The ONLY type that can carry `visibleFieldIds`, so the only one that shows "Fields shown · N of M" — or, when the connection did not supply them, the connection-depth line.', why: 'Airtable returns visibleFieldIds for grid views only, and only through the enterprise REST API.' },
          { token: 'form', use: 'Label "Form". Field visibility is never known — use the "Airtable does not share it for this view type" line.', why: 'Not exposed for non-grid views, at any depth.' },
          { token: 'calendar', use: 'Label "Calendar". Same absence line as Form.' },
          { token: 'gallery', use: 'Label "Gallery". Same absence line as Form.' },
          { token: 'kanban', use: 'Label "Kanban". Same absence line as Form.' },
          { token: 'timeline', use: 'Label "Timeline". Same absence line as Form.' },
          { token: 'block', use: 'Label **"Gantt"** — `block` is Airtable\'s wire name for a Gantt view.', why: 'Showing "Block" would be a word no Airtable user recognises.' },
          { token: '(anything else)', use: 'Neutral `badge-ghost` chip carrying the raw string, verbatim.', why: 'Airtable adds view types; coercing an unknown one to "Grid" would be a lie.' },
        ],
      },
      {
        title: 'Which absence line to use',
        note: 'They are not interchangeable. One is permanent and blameless; one depends on how deep THIS connection can read; one is a fixable gap in our own auth.',
        default: 'never-exposed',
        rows: [
          { token: 'never-exposed', use: 'Filters · sorts · grouping · colouring · row height. Quiet neutral line, NO action.', why: 'No API at any tier returns them. Offering a retry invents a fix that does not exist.' },
          { token: 'not-this-view-type', use: 'Field visibility on a non-grid view (form / calendar / gallery / kanban / timeline / Gantt). Quiet neutral line, NO action: "Airtable only shares which fields a view shows for grid views."', why: 'Airtable returns visibleFieldIds for grid views alone — no plan and no reconnect changes that.' },
          { token: 'not-this-connection', use: 'A GRID view that still has no visibleFieldIds. Quiet neutral line, NO action: "This connection did not include which fields this view shows — Airtable only returns that through its REST API on an enterprise account."', why: 'Describes the CUSTOMER\'S Airtable plan / capture route, not a Baseout tier. Never phrase it as an upgrade, never attach a CTA — it is not ours to sell against, and Baseout does not gate product UI on plan.' },
          { token: 'reconnect-would-fix', use: 'Anything a re-auth with the right scope would return. Standard reconnect affordance.', why: 'Actionable, so it gets an action.' },
          { token: 'not-in-latest-capture', use: 'The `unknown` state — see Deleted items. Soft INFO badge, full opacity.', why: 'A gap in our read, not a deletion and not an API limit.' },
          { token: 'table-unresolved', use: 'A captured view whose owning table the capture did not resolve. Its own named Browse bucket under the base + one explaining line. NO action.', why: 'The alternative is the row rendering nowhere. A silently dropped entity is the one failure a schema inventory can never have.' },
        ],
      },
    ],
    usageDo: [
      'Render views as their own collapsible "Views (n)" group under the table, capped independently from the fields group.',
      'Use lucide--eye and the word "View" in EVERY surface a view can reach — tree, flat table, typeahead, panel header, Docs chip, Changelog.',
      'Show the Personal / Collaborative badge from personalForUserId — a personal view is invisible to teammates, which matters at restore time.',
      'Show "Fields shown · N of M" as NAMED entity chips (field-type glyph + panel-push), capped at 5 with "+N more" — never a bare count.',
      'Compute M from the owning table\'s LIVE field count, excluding removed fields, so the view panel and the table panel can never disagree.',
      'When visibleFieldIds is absent, say which absence it is: "not this view type" for non-grid, "not this connection" for a grid view whose capture did not include it.',
      'Give a FIELD panel a "Referenced by → Views" group (lucide--eye) for the views that show it, and omit the group entirely when there are none.',
      'Give a view with an unresolved owning table its own named bucket under the base, so it is visible rather than silently dropped.',
      'Label the `block` type "Gantt", and pass an unrecognised type through verbatim in a neutral chip.',
      'State the permanent API limit once, in plain words, with no action attached to it.',
    ],
    usageDont: [
      "Don't interleave views with fields as siblings — a view is a lens over the whole table, not a column in it.",
      "Don't render filter rows, sort chips, grouping, colour rules or a raw-config disclosure — Airtable exposes NONE of it to any API, so any such UI is a promise the product cannot keep.",
      "Don't put filters or sorts into a fixture either. A fixture is read as a spec; a fake filter row becomes a shipped expectation.",
      "Don't give the permanent limit a Retry / Reconnect / \"connect to see more\" affordance — there is nothing to retry.",
      "Don't let a view row escape the per-node cap by carrying a different row class than the capped selector.",
      "Don't reuse the table's \"Fields · N · in this table\" stat tile on a view panel — on a view it reads as a count of what the VIEW shows, which is a claim we cannot make.",
      "Don't phrase the missing-field-visibility line as a Baseout plan limit, an upgrade, or anything with a price or CTA — the enterprise gate is the CUSTOMER'S Airtable account, not ours.",
      "Don't render a \"Views 0\" group in Referenced by. Absent visibleFieldIds means unknown, not nowhere, and a zero states the opposite.",
      "Don't fall through to \"Table\" for an unhandled kind — a mislabelled panel is worse than a missing one.",
    ],
    examples: [
      {
        label: 'Browse tree — the Views group sits BESIDE the fields group, with its own cap',
        html: `
<div style="padding:1rem">
  <div class="rounded-box border border-base-300 bg-base-100 overflow-hidden text-sm">
    <div class="flex items-center gap-2 border-b border-base-200" style="padding:.7rem .8rem"><span class="iconify lucide--table-2 size-4 opacity-70"></span><span class="font-medium grow">Campaigns</span><span class="text-xs" style="color:oklch(from var(--color-base-content) l c h /.5)">9 fields · 48 records · 5 views</span></div>
    <div class="flex items-center gap-2 border-b border-base-200" style="padding:.7rem .8rem .7rem 2.2rem"><span class="iconify lucide--type size-3.5 opacity-70"></span><span class="grow">Name</span></div>
    <div class="flex items-center gap-2 border-b border-base-200" style="padding:.7rem .8rem .7rem 2.2rem"><span class="iconify lucide--type size-3.5 opacity-70"></span><span class="grow">Status</span></div>
    <div class="flex items-center gap-2 border-b border-base-200" style="padding:.6rem .8rem .6rem 2.2rem;font-size:12.5px;color:oklch(from var(--color-base-content) l c h /.6)"><span class="iconify lucide--chevron-down size-4"></span><span>Views <span class="mono-data">5</span></span></div>
    <div class="flex items-center gap-2 border-b border-base-200" style="padding:.7rem .8rem .7rem 3.4rem"><span class="iconify lucide--eye size-4 opacity-70"></span><span class="font-medium grow">Active Campaigns</span><span class="badge badge-ghost">Grid</span></div>
    <div class="flex items-center gap-2" style="padding:.7rem .8rem .7rem 3.4rem"><span class="iconify lucide--eye size-4 opacity-70"></span><span class="font-medium grow">Submit a campaign</span><span class="badge badge-ghost">Form</span></div>
  </div>
</div>`,
      },
      {
        label: 'View panel — identity (with Personal badge) · fields shown as NAMED chips (grid only) · the permanent-limit line',
        html: `
<div style="padding:1rem;max-width:460px;display:flex;flex-direction:column;gap:16px">
  <div style="display:flex;align-items:center;gap:8px"><span class="iconify lucide--eye size-4 opacity-70"></span><span class="font-medium">My pipeline</span><span class="badge badge-soft badge-primary">Personal</span></div>
  <div style="font-size:12.5px;color:oklch(from var(--color-base-content) l c h /.6)">View · Grid · as of last backup</div>
  <div>
    <div style="font-size:11px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;color:oklch(from var(--color-base-content) l c h /.5);padding-bottom:8px">Fields shown · 3 of 11</div>
    <div style="display:flex;flex-wrap:wrap;gap:4px">
      <span class="sb-chip sb-chip-btn"><span class="sb-chip-ic"><span class="iconify lucide--type size-3.5"></span></span><span class="sb-chip-name">Name</span></span>
      <span class="sb-chip sb-chip-btn"><span class="sb-chip-ic"><span class="iconify lucide--circle-dollar-sign size-3.5"></span></span><span class="sb-chip-name">Amount</span></span>
      <span class="sb-chip sb-chip-btn"><span class="sb-chip-ic"><span class="iconify lucide--list size-3.5"></span></span><span class="sb-chip-name">Stage</span></span>
    </div>
  </div>
  <div style="display:flex;gap:8px;padding:.6rem .8rem;border:1px solid var(--color-base-300);border-radius:10px;font-size:12.5px;line-height:1.45;color:oklch(from var(--color-base-content) l c h /.62)">
    <span class="iconify lucide--info size-4" style="flex:none;opacity:.6;margin-top:1px"></span>
    <span>Airtable does not expose a view’s filters, sorts or grouping to any API, so they can’t be captured.</span>
  </div>
</div>`,
      },
      {
        label: 'The two absences — a non-grid view (never exposed) vs a grid view this connection could not read that deep',
        html: `
<div style="padding:1rem;max-width:460px;display:flex;flex-direction:column;gap:16px">
  <div>
    <div style="font-size:11px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;color:oklch(from var(--color-base-content) l c h /.5);padding-bottom:8px">Fields shown — Kanban view</div>
    <div style="display:flex;gap:8px;padding:.6rem .8rem;border:1px solid var(--color-base-300);border-radius:10px;font-size:12.5px;line-height:1.45;color:oklch(from var(--color-base-content) l c h /.62)">
      <span class="iconify lucide--info size-4" style="flex:none;opacity:.6;margin-top:1px"></span>
      <span>Airtable only shares which fields a view shows for <strong>grid</strong> views, so there is nothing to capture for a Kanban view.</span>
    </div>
  </div>
  <div>
    <div style="font-size:11px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;color:oklch(from var(--color-base-content) l c h /.5);padding-bottom:8px">Fields shown — Grid view</div>
    <div style="display:flex;gap:8px;padding:.6rem .8rem;border:1px solid var(--color-base-300);border-radius:10px;font-size:12.5px;line-height:1.45;color:oklch(from var(--color-base-content) l c h /.62)">
      <span class="iconify lucide--info size-4" style="flex:none;opacity:.6;margin-top:1px"></span>
      <span>This connection didn’t include which fields this view shows. Airtable returns that only through its REST API on an enterprise Airtable account.</span>
    </div>
  </div>
</div>`,
      },
      {
        label: 'Field panel — the reverse direction: Referenced by → Views (omitted entirely when there are none)',
        html: `
<div style="padding:1rem;max-width:460px">
  <div style="font-size:11px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;color:oklch(from var(--color-base-content) l c h /.5);padding-bottom:8px">Referenced by <span class="badge badge-sm badge-neutral">3</span></div>
  <div style="font-size:12.5px;display:flex;align-items:center;gap:6px;color:oklch(from var(--color-base-content) l c h /.6);padding-bottom:4px"><span class="iconify lucide--eye size-3.5"></span>Views <span class="badge badge-sm badge-neutral">2</span></div>
  <div class="rounded-box border border-base-300 bg-base-100 overflow-hidden text-sm">
    <div class="flex items-center gap-2 border-b border-base-200" style="padding:.6rem .8rem"><span class="iconify lucide--eye size-3.5 opacity-70"></span><span class="grow">All companies</span><span class="text-xs" style="color:oklch(from var(--color-base-content) l c h /.55)">Grid</span><span class="iconify lucide--arrow-up-right size-3.5 opacity-50"></span></div>
    <div class="flex items-center gap-2" style="padding:.6rem .8rem"><span class="iconify lucide--eye size-3.5 opacity-70"></span><span class="grow">My accounts</span><span class="text-xs" style="color:oklch(from var(--color-base-content) l c h /.55)">Grid</span><span class="iconify lucide--arrow-up-right size-3.5 opacity-50"></span></div>
  </div>
</div>`,
      },
    ],
  },
  {
    id: 'pattern-prompt-editor',
    group: 'Patterns',
    name: 'Prompt editor (resolution + override)',
    summary: 'Editable AI prompt with a System default ▸ Space ▸ Override resolution, reset/remove, and Pro+ gating.',
    description:
      'The reusable editor for any AI prompt that resolves through scopes — used for Health metric scoring and Insights generation. Opened in a right <a href="#drawer">Drawer</a> from the thing it configures. Anatomy: a <strong>resolution row</strong> of chips <strong>System default ▸ Space ▸ Override</strong> with the <strong>effective</strong> level highlighted (so the user always knows which prompt is actually in force); an <strong>Edit-at scope</strong> <a href="#select">Select</a> — <em>Whole Space</em> (applies to all bases) or an <em>override for one entity</em> (base / table / field); the editable <strong>prompt textarea</strong>; and a footer whose actions adapt to the scope: <strong>Save prompt / Reset to default</strong> at Space level, <strong>Save override / Remove override</strong> at entity level, always with Cancel. A <strong>stale banner + Re-run</strong> appears when the prompt changed since the metric was last scored (cost shown on the button). <strong>Pro+ gated</strong>: below Pro+ the textarea is read-only with an amber upgrade affordance. Components: <code>components/schema/SchemaHealth.astro</code> (the drawer body) + <code>components/ui/Drawer.astro</code>.',
    reference: 'design:components/schema/SchemaHealth.astro',
    showCode: false,
    usageDo: [
      'Always show the resolution chips with the EFFECTIVE level highlighted, so the in-force prompt is unambiguous.',
      'Adapt the footer to scope: Save prompt / Reset to default at Space level; Save override / Remove override at entity level.',
      'Open it in a right Drawer from the metric/insight it configures; reuse one drawer, populate per item.',
      'Gate editing behind Pro+: read-only + an upgrade affordance below Pro+, never a dead control.',
      'When the prompt changed since the last run, show a stale note + a Re-run (with its credit cost).',
    ],
    usageDont: [
      "Don't hide which scope is effective — the three-level resolution is the whole point.",
      "Don't use a modal; this is a focused side task that should keep the page in view (Drawer).",
      "Don't let the prompt look editable below Pro+ — make the read-only + upgrade state explicit.",
    ],
    examples: [
      {
        label: 'Editor body — Space-level effective, override available',
        html: `
<div style="padding:1rem;max-width:540px">
  <div class="text-sm font-semibold" style="display:flex;align-items:center;gap:.4rem"><span class="iconify lucide--ruler size-4"></span>Descriptions · Base, Table, Field</div>
  <div class="text-[11px] uppercase tracking-wider opacity-50" style="margin:.8rem 0 .35rem">Effective prompt — resolved from</div>
  <div style="display:flex;align-items:center;gap:.4rem;font-size:.76rem;font-weight:550">
    <span style="padding:.15rem .55rem;border-radius:999px;border:1px solid var(--color-base-300);opacity:.6">System default</span>
    <span style="opacity:.3">▸</span>
    <span style="padding:.15rem .55rem;border-radius:999px;border:1px solid color-mix(in oklch,var(--color-primary) 45%,var(--color-base-300));background:color-mix(in oklch,var(--color-primary) 12%,transparent);color:var(--color-primary);font-weight:650">Space</span>
    <span style="opacity:.3">▸</span>
    <span style="padding:.15rem .55rem;border-radius:999px;border:1px solid var(--color-base-300);opacity:.6">Override</span>
  </div>
  <label class="text-xs font-semibold" style="display:block;margin:.9rem 0 .3rem">Edit at</label>
  <select class="select select-sm" style="width:100%"><option>Whole Space — applies to all bases</option></select>
  <label class="text-xs font-semibold" style="display:block;margin:.8rem 0 .3rem">Prompt</label>
  <textarea class="textarea textarea-bordered textarea-sm" style="width:100%" rows="3">Rate documentation coverage, but only flag tables and fields that are customer-facing or used in reports — internal scratch fields are fine.</textarea>
  <div style="display:flex;align-items:center;gap:.5rem;margin-top:.9rem">
    <button class="btn btn-sm btn-primary gap-1.5"><span class="iconify lucide--check size-3.5"></span>Save prompt</button>
    <button class="btn btn-sm btn-ghost gap-1.5"><span class="iconify lucide--rotate-ccw size-3.5"></span>Reset to default</button>
    <label class="btn btn-sm btn-ghost" style="margin-left:auto">Cancel</label>
  </div>
</div>`,
      },
    ],
  },
  {
    id: 'pattern-schema-insights',
    group: 'Patterns',
    name: 'Insight card + list',
    summary: 'AI schema observations: typed card (category · date · observation · evidence · entity chips) in an active list with an archived toggle, show-more, and per-card archive.',
    description:
      'The read-only surface for AI-generated schema observations, on the Schema <a href="/schema">Health</a> tab below each base’s grade. <strong>Issues and Insights share one segmented sub-switcher</strong> directly under the Health card (Issues is the default punch-list; Insights is the AI read) so the base report stays one screen instead of a long stack — each sub-tab carries its live count. A <strong>section header</strong> states the source once — <em>Insights N</em> + a muted <strong>“AI · generated &lt;date&gt;”</strong>, then the <a href="#pattern-prompt-editor">Configure</a> (Pro+) entry, a <strong>Re-run</strong> when the prompt changed since, and a <strong>Show archived</strong> toggle. Each <strong>insight card</strong> (1px border, no fill, dense): a top row of a quiet <strong>category</strong> (icon + label, e.g. “Circular reference”) and a right-aligned muted <strong>generated date</strong>; the <strong>observation sentence</strong> (advisory — “consider…”, never alarmist); an optional muted <strong>evidence line</strong> (the claim’s supporting fact); and a row of <strong>entity tag chips</strong> (type icon + name) — the only accent-coloured elements, each opening the shared <a href="#">entity detail sidebar</a> via <code>data-entity-open</code> (same chips as Browse / Docs). A hover-revealed <strong>Archive</strong> moves a card to the archived set (reversible via Restore); <strong>archived are hidden by default</strong>, shown muted + labelled behind the toggle. Long lists show the first 6 then <strong>“Show N more”</strong>. Built on the same field-type icons as the rest of Schema. Components: <code>components/schema/SchemaHealth.astro</code>; pairs with <a href="#pattern-prompt-editor">Prompt editor</a> for config.',
    reference: 'design:components/schema/SchemaHealth.astro',
    showCode: false,
    usageDo: [
      'Lead each card with a typed category + the observation; keep copy advisory and concrete (claim + evidence), never alarmist or pejorative.',
      'Render entity references as clickable tag chips (type icon + name) that open the SAME shared sidebar as Browse / Docs — chips are the only accent on the card.',
      'State source + freshness once in the section header (AI · generated date), with Configure / Re-run / Show-archived there — keep individual cards clean.',
      'Hide archived by default; reveal muted + labelled behind one toggle. Make archive an explicit, reversible disposition (Restore), not a silent vanish.',
      'Show the first handful and a “Show N more”; reuse the Prompt editor (Pro+) for space-level + per-base override config.',
    ],
    usageDont: [
      "Don't decorate AI output with gradients, glass, sparkle-cards, or hero numbers — provenance is a quiet text line, not chrome.",
      "Don't phrase insights as commands or alarms; they're observations with a suggestion.",
      "Don't build a bespoke chip or sidebar — reuse the entity tag chip + detail sidebar so a tag behaves identically everywhere.",
      "Don't dump every insight at once or let archived items clutter the default list.",
    ],
    examples: [
      {
        label: 'Section header + one insight card',
        html: `
<div style="padding:1rem;max-width:680px">
  <div style="display:flex;align-items:center;gap:.7rem;flex-wrap:wrap;margin-bottom:.6rem">
    <h3 class="text-sm font-semibold" style="display:inline-flex;align-items:center;gap:.45rem">Insights <span class="text-[11px] font-semibold" style="background:var(--color-base-200);border-radius:999px;padding:0 .45rem;opacity:.7">7</span></h3>
    <span style="display:inline-flex;align-items:center;gap:.3rem;font-size:.73rem;opacity:.5"><span class="iconify lucide--sparkles size-3.5"></span>AI · generated Jun 22, 2:07 PM</span>
    <div style="margin-left:auto;display:inline-flex;align-items:center;gap:.35rem">
      <button class="btn btn-sm btn-ghost gap-1.5"><span class="iconify lucide--sliders-horizontal size-4"></span>Configure <span class="badge badge-sm badge-soft badge-primary">Pro+</span></button>
      <label class="inline-flex items-center gap-1.5 text-[13px]" style="opacity:.8"><input type="checkbox" class="toggle toggle-sm" /> Show archived <span class="text-[11px]" style="background:var(--color-base-200);border-radius:999px;padding:0 .4rem;opacity:.7">1</span></label>
    </div>
  </div>
  <div style="border:1px solid var(--color-base-300);border-radius:.8rem;background:var(--color-base-100);padding:.8rem .95rem">
    <div style="display:flex;align-items:center;gap:.5rem;margin-bottom:.4rem">
      <span style="display:inline-flex;align-items:center;gap:.35rem;font-size:.72rem;font-weight:600;opacity:.72"><span class="iconify lucide--git-branch size-3.5" style="opacity:.65"></span>High cardinality</span>
      <span style="margin-left:auto;font-size:.72rem;opacity:.45">Jun 22, 2:07 PM</span>
    </div>
    <p style="font-size:.88rem;line-height:1.5">Tickets fan out to Queues at a high ratio — a single queue holds most open tickets, so it dominates the size of any restore that includes it. Consider scoping restores per queue.</p>
    <p style="margin-top:.3rem;font-size:.78rem;opacity:.55">One queue accounts for ~70% of linked tickets</p>
    <div style="display:flex;flex-wrap:wrap;gap:.35rem;margin-top:.6rem">
      <span style="display:inline-flex;align-items:center;gap:.3rem;padding:.15rem .5rem;border:1px solid color-mix(in oklch,var(--color-primary) 22%,var(--color-base-300));border-radius:999px;background:color-mix(in oklch,var(--color-primary) 6%,transparent);font-size:.76rem;color:var(--color-primary)"><span class="iconify lucide--table-2 size-3"></span>Tickets</span>
      <span style="display:inline-flex;align-items:center;gap:.3rem;padding:.15rem .5rem;border:1px solid color-mix(in oklch,var(--color-primary) 22%,var(--color-base-300));border-radius:999px;background:color-mix(in oklch,var(--color-primary) 6%,transparent);font-size:.76rem;color:var(--color-primary)"><span class="iconify lucide--table-2 size-3"></span>Queues</span>
    </div>
    <div style="display:flex;justify-content:flex-end;margin-top:.5rem">
      <button class="btn btn-sm btn-ghost gap-1" style="opacity:.6"><span class="iconify lucide--archive size-3.5"></span>Archive</button>
    </div>
  </div>
</div>`,
      },
    ],
  },
  {
    id: 'pattern-section-nav',
    group: 'Patterns',
    name: 'Grouped section nav (clustered tabs)',
    summary: 'A section with many tabs, grouped into labelled clusters — catalog underline tabs (tabs tabs-border) laid out under quiet cluster labels, with a right-aligned freshness stamp + a ghost launcher.',
    description:
      'When a section has more tabs than read comfortably in one flat row (Schema has 8), group them into <strong>labelled clusters</strong> (Explore · App layer · Monitor · Knowledge) with a <strong>quiet uppercase label ABOVE each cluster</strong> and a <strong>thin vertical divider</strong> between clusters. The tabs themselves are the <a href="#tabs">catalog Tabs primitive</a> — daisyUI <code>tabs tabs-border</code> containers with <code>tab</code> buttons and <code>tab-active</code> on the current one; the pattern only themes them to the app\'s quiet-inactive / <strong>primary-underline-active</strong> look (a token accent on the primitive, NOT a re-implemented tab). One 1px baseline runs under the whole bar. Section-wide metadata (a "Schema as of …" freshness stamp) sits at the <strong>page-title level, right-aligned</strong> — never inside a tab. A persistent action that belongs to the whole section (here the "Ask about your schema" chat launcher) is a <strong>catalog <a href="#button">Ghost Button</a></strong> (<code>btn btn-ghost</code>) in the header, not a bespoke pill. On mobile the clustered bar scrolls sideways (a fuller mobile treatment is a follow-up). Layout classes are <code>.sch-tabbar / .sch-group / .sch-glabel / .sch-gtabs / .sch-tabdiv</code>; the tab visuals come from the daisyUI tab primitive + the pattern accent. Live: <a href="/schema">Schema</a>.',
    reference: 'views/SchemaView.astro',
    showCode: false,
    usageDo: [
      'Use the catalog Tabs primitive (`tabs tabs-border` + `tab`/`tab-active`) for the tabs; the pattern only adds the cluster grouping + the primary-underline-active accent. Never hand-roll a bespoke tab class.',
      'Group tabs into labelled clusters (label ABOVE each group) with a thin divider between clusters, once a flat row gets too long.',
      'Put a section-wide freshness/"as of" stamp at the page-title level (right-aligned), not inside a tab.',
      'A whole-section persistent action (e.g. an AI/chat launcher) is a catalog Ghost Button in the header — not a custom pill.',
    ],
    usageDont: [
      "Don't re-implement tabs with a custom class — reuse the daisyUI tab primitive and theme it.",
      "Don't build the launcher as a bespoke tinted pill (custom border-radius/color-mix) — that was retired 2026-07-03 for the catalog Ghost Button.",
      "Don't cram many tabs into one flat, ungrouped row when they fall into natural clusters.",
    ],
    examples: [
      {
        label: 'Two clusters of catalog tabs (Explore · Monitor), Browse active + a ghost launcher',
        html: `
<div style="padding:1rem">
  <div style="display:flex;justify-content:flex-end;margin-bottom:.6rem"><button class="btn btn-ghost btn-sm gap-1.5"><span class="iconify lucide--sparkles size-4"></span>Ask about your schema</button></div>
  <div style="display:flex;align-items:stretch;gap:.1rem;border-bottom:1px solid var(--color-base-300)">
    <div style="display:flex;flex-direction:column">
      <span style="font-size:.6rem;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:oklch(from var(--color-base-content) l c h /.42);padding:0 0 .1rem .6rem">Explore</span>
      <div class="tabs tabs-border" style="border:0">
        <button class="tab" style="border-bottom:2px solid var(--color-primary);color:var(--color-primary);font-size:.86rem;font-weight:560;padding:.5rem .6rem;margin-bottom:-1px">Browse</button>
        <button class="tab" style="border-bottom:2px solid transparent;color:oklch(from var(--color-base-content) l c h /.68);font-size:.86rem;font-weight:560;padding:.5rem .6rem;margin-bottom:-1px">Visualize</button>
      </div>
    </div>
    <span style="width:1px;background:var(--color-base-300);margin:0 .6rem;align-self:flex-end;height:1.9rem"></span>
    <div style="display:flex;flex-direction:column">
      <span style="font-size:.6rem;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:oklch(from var(--color-base-content) l c h /.42);padding:0 0 .1rem .6rem">Monitor</span>
      <div class="tabs tabs-border" style="border:0">
        <button class="tab" style="border-bottom:2px solid transparent;color:oklch(from var(--color-base-content) l c h /.68);font-size:.86rem;font-weight:560;padding:.5rem .6rem;margin-bottom:-1px">Changelog</button>
        <button class="tab" style="border-bottom:2px solid transparent;color:oklch(from var(--color-base-content) l c h /.68);font-size:.86rem;font-weight:560;padding:.5rem .6rem;margin-bottom:-1px">Health</button>
      </div>
    </div>
  </div>
</div>`,
      },
    ],
  },
  {
    id: 'pattern-schema-relationships',
    group: 'Patterns',
    name: 'Relationship row + list',
    summary: 'A relationship as a scannable "A ↔ B" row (status dot · type icon · entities · cardinality · soft badges), with inline Confirm/Dismiss for inferred ones and a right detail panel that clicks through to the shared entity sidebar.',
    description:
      'The Schema <a href="/schema">Relationships</a> tab: a Space\'s relationships (linked records, formulas, rollups, lookups, lastModified, and inferred synced views) as a tree grouped <strong>Base ▸ type</strong> (plus a Flat table). Each <strong>row</strong>: a leading <strong>status dot</strong> (green valid / grey invalid / hollow-dashed inferred), the <strong>type icon</strong>, an <strong>"A ↔ B"</strong> summary with entities primary and field/table context muted, a direction glyph (<code>→</code> one-way / <code>↔</code> reciprocal), a small mono <strong>cardinality</strong> token, and up to two <strong>soft badges</strong> (<em>Inferred</em> primary, <em>Removed history</em> warning). <strong>Filters use the same faceted toolbar as Visualize / Browse</strong> (Dan\'s spec, for cross-tab consistency): <strong>Bases · Type · Status · Validity</strong> facet dropdowns + an <strong>Include-removed</strong> toggle. <strong>Inferred (synced-view) rows</strong> carry inline <strong>Confirm / Dismiss</strong> (and a bulk bar); Confirm promotes inferred → declared (badge drops), Dismiss removes it; declared rows have no such actions. Selecting a row opens a <strong>right detail panel</strong> — the A/B entities as click-through chips (→ the shared entity sidebar), a provenance line, and (Dan round-2) a rebuilt body: the redundant "Links" list is GONE (the A↔B pair IS the single primary link); <strong>formula/rollup</strong> get a <strong>"Linked Fields"</strong> section listing the OTHER referenced fields (same table); and removed links move into a <strong>"Changelog"</strong> history (added/removed events with dates) instead of the summary. <strong>Multi-field reference cell (B1, Dan 2026-07-06):</strong> a formula/rollup that references several fields shows <strong>ALL of them on the one row</strong> (not just the first) as click-through chips — <strong>capped at 3</strong>, then a <strong>"+N more"</strong> ghost-button trigger whose <strong>daisyUI <code>dropdown-hover</code> popover</strong> reveals the rest, each chip/entry opening that field\'s shared EntityPanel (<code>data-entity-open</code>). This reuses the Browse <strong>"Tagged" cell popover (B9)</strong> pattern — one row, never duplicated per field. (Distinct from the <a href="#pattern-detail-panel">panel</a>\'s inline <code>+N more</code> disclosure: a listing row isn\'t a scroll-owning panel, so a floating popover is correct here.) <strong>Synced tables are user-declared</strong> (the API can\'t detect sync links): a primary "New synced relationship" toolbar button + an Edit action on every synced row open a right-Drawer form whose <strong>Synced/Source table pickers reuse the shared <a href="#pattern-entity-search">EntitySearch</a> typeahead</strong> (the base is derived from the synced table); save inserts/updates the declared synced-view row. Components: <code>components/schema/SchemaRelationships.astro</code> + <code>schemaRelationships.ts</code> + <code>RelationshipPanel.astro</code>.',
    reference: 'design:components/schema/SchemaRelationships.astro',
    showCode: false,
    usageDo: [
      'Render a relationship as one scannable line: status dot · type icon · A ↔ B (entities primary, fields muted) · cardinality · ≤2 soft badges.',
      'Use the SAME faceted toolbar as Visualize / Browse (Bases · Type · Status · Validity facets + Include-removed) so the structural tabs read consistently.',
      'Treat the row atoms — the soft-semantic status badge (badge-soft + a bg-current dot), the legible type chip, and the mono cardinality token — as the shared schema-table elements. The Browse tree field rows reuse the SAME atoms as aligned Type · Link · Cardinality · Status columns (name flexes + truncates, columns line up on fixed widths), so all four structural tabs (Browse · Relationships · Automations · Interfaces) read as one component.',
      'In-table data chips are the DEFAULT badge size (≈14px / 24px height) — the same as the Backups run-history badges — NOT badge-sm. The type chip, the status badge, and the mono cardinality token all sit at this one height; nothing inside a table cell reads smaller. (badge-sm stays for dense standalone/toolbar contexts, never for a data cell.)',
      'Text inside a data-table cell is never below 14px (the Backups body size): the Link value, the mono cardinality token, and base/table meta counts all sit at ≥14px. Group/parent rows (a base or table) align to the SAME columns as their children — a blank Type/Link/Cardinality cell, then the health status badge in the Status column, so the badge (not a bare dot) marks their health in line with the field rows.',
      'The "N tagged" indicator is the catalog **Ghost Button** (`btn btn-ghost btn-sm` — lucide--tags + a mono count + "tagged"), the shared cross-tab way to show how many docs/entities tag a row. It carries the built-in daisyUI ghost hover (no custom element). Browse surfaces it as a right-most TAGGED column (single → clicking opens that doc); it replaces any bare doc icon. Its text is ≥14px (text-sm) like every other cell. (Do NOT reintroduce a bespoke tag-count span — that was a custom element, not catalog; retired 2026-07-03. Always use the catalog Button.)',
      'A hierarchical / deeply-grouped schema table (Browse: Base ▸ Table ▸ Field) uses ONE sticky column header at the TOP of the whole table — NOT a header repeated under each group (the Quicken / Productboard pattern). Every row at every depth aligns its fixed columns under that one header; parent (base/table) rows leave the leaf-only cells (Type/Link/Cardinality) blank and fill the SHARED columns (Status, Tagged), so a parent chip always has a label above it. Flat one-level tables (Relationships/Automations/Interfaces) put every row directly under a per-Base header, so they keep that — the one-top-header rule is for the nested case.',
      'A value that navigates (e.g. the Link cell "→ TableName" opening the linked table) is a real interactive element (button/link) with a ghost-hover wash, not bare text — so it reads as clickable. It opens via the shared data-entity-open handler (the innermost data-entity-open wins, so it beats the row\'s own open). The "N tagged" chip gets the same ghost hover. (Any interactive element injected via set:html needs its styles is:global — scoped styles never reach innerHTML.)',
      'Sorting a hierarchical tree stays CONTEXTUAL: a header click sorts the leaf rows (fields) WITHIN each group (table), never across the whole tree — the Base ▸ Table structure never reorders, only the fields inside their own table. Re-click toggles asc/desc with a ▲/▼ indicator. A flat global sort lives in the separate Flat-index view. The first column is labelled "Name" (it covers base/table/field names), not "Field".',
      'Give inferred (synced-view) rows inline Confirm/Dismiss + a bulk bar; declared relationships get none. Confirm promotes in place, Dismiss removes.',
      'Open a right detail panel whose entity chips click through to the SAME shared sidebar as Browse/Docs; show provenance + per-link removed dates.',
      'Degrade-in-place: removed links are history behind Include-removed; an all-links-removed relationship stays visible, flagged invalid (dimmed + grey dot).',
      'Phrase inferred provenance as "inferred from usage / sync-source", never "AI guesses" — more trustworthy for an ops audience.',
    ],
    usageDont: [
      "Don't invent a bespoke filter shape for this tab — reuse the faceted toolbar the other Schema tabs use.",
      "Don't offer Confirm/Dismiss on declared (API-derived) relationships — only inferred ones are a guess.",
      "Don't silently drop removed/broken relationships — keep them as flagged history (a stale map is worse than none).",
      "Don't build a bespoke detail sidebar — reuse the shared entity sidebar via data-entity-open.",
    ],
    examples: [
      {
        label: 'Two rows — a declared link (with removed history) and an inferred synced view',
        html: `
<div style="padding:1rem;max-width:680px;border:1px solid var(--color-base-300);border-radius:11px;background:var(--color-base-100)">
  <div style="display:flex;align-items:center;gap:.45rem;padding:.45rem .85rem;font-size:.66rem;font-weight:600;letter-spacing:.04em;text-transform:uppercase;color:oklch(from var(--color-base-content) l c h / .55)"><span class="iconify lucide--link size-3.5" style="opacity:.5"></span>Linked records</div>
  <div style="display:flex;align-items:center;gap:.6rem;padding:.6rem .85rem;border-top:1px solid var(--color-base-200)">
    <span style="width:.6rem;height:.6rem;border-radius:999px;background:var(--color-success);flex:none"></span>
    <span class="iconify lucide--link size-4" style="opacity:.6"></span>
    <span style="display:inline-flex;align-items:center;gap:.4rem"><span style="font-weight:560;font-size:.86rem">Company</span><span style="opacity:.45">↔</span><span style="font-weight:560;font-size:.86rem">Deals</span><span style="font-family:ui-monospace,monospace;font-size:.72rem;color:oklch(from var(--color-base-content) l c h / .6);background:var(--color-base-200);border-radius:5px;padding:0 .35rem">m:1</span></span>
    <span style="margin-left:auto"><span class="badge badge-sm badge-soft badge-warning">Removed history</span></span>
  </div>
  <div style="display:flex;align-items:center;gap:.45rem;padding:.45rem .85rem;font-size:.66rem;font-weight:600;letter-spacing:.04em;text-transform:uppercase;color:oklch(from var(--color-base-content) l c h / .55);border-top:1px solid var(--color-base-200)"><span class="iconify lucide--refresh-cw size-3.5" style="opacity:.5"></span>Synced views <span style="font-size:.6rem;color:var(--color-primary);border:1px solid color-mix(in oklch,var(--color-primary) 35%,var(--color-base-300));border-radius:4px;padding:0 .3rem">inferred</span></div>
  <div style="display:flex;align-items:center;gap:.6rem;padding:.6rem .85rem;border-top:1px solid var(--color-base-200)">
    <span style="width:.6rem;height:.6rem;border-radius:999px;background:transparent;border:1.5px dashed color-mix(in oklch,var(--color-primary) 60%,var(--color-base-content));flex:none"></span>
    <span class="iconify lucide--refresh-cw size-4" style="opacity:.6"></span>
    <span style="display:inline-flex;align-items:center;gap:.4rem"><span style="font-weight:560;font-size:.86rem">Tickets</span><span style="opacity:.45">↔</span><span style="font-weight:560;font-size:.86rem">Queues</span></span>
    <span style="margin-left:auto;display:inline-flex;align-items:center;gap:.35rem"><span class="badge badge-sm badge-soft badge-primary">Inferred</span><button class="btn btn-sm btn-ghost gap-1 text-success"><span class="iconify lucide--check size-3.5"></span>Confirm</button><button class="btn btn-sm btn-ghost gap-1"><span class="iconify lucide--x size-3.5"></span>Dismiss</button></span>
  </div>
</div>`,
      },
    ],
  },
  {
    id: 'pattern-panel-edit-mode',
    group: 'Patterns',
    name: 'Panel Read/Edit mode',
    summary: 'One detail panel with two modes. Pressing Edit changes nothing about the layout — the value in each slot simply becomes an input. Captured facts stay facts: never editable, never greyed.',
    description:
      'How a <a href="#pattern-detail-panel">detail panel</a> becomes editable. The panel has <strong>one layout and two modes</strong>, switched by the canonical segmented control <code>.sch-modeswitch</code> / <code>.sch-mode-active</code> (<code>styles/global.css</code> — never a local copy; a local copy is how Docs once ended up grey-on-grey). Read is the default mode. <strong>Nothing moves between modes:</strong> same sections, same order, same vertical positions — a row is the same height in read and in edit, which is what a borderless read slot that simply gains its border as an input buys you (<code>.sch-slot</code> / <code>.sch-slot-in</code>: identical font-size, line-height, padding and min-height). This exists because the alternative — a separate Edit form in the same drawer — produced <em>a different page about the same object</em>: the read order was status → trigger → touches → actions → descriptions → subscribers and the form order was name → ID → base → trigger → tags → descriptions → subscribers, so pressing Edit made the user re-find what they had just been reading (Oleh 2026-07-28).<br><br><strong>Captured blocks are never editable and never greyed.</strong> Where a section states what the backup <em>captured</em> (an automation\'s trigger, the tables/fields it touches, its action types) it renders <em>identically</em> in both modes, plus a small <code>from capture</code> marker on the section label in edit mode. A greyed-out disabled control reads as "broken" or "do something else first"; these are facts, not disabled fields.<br><br><strong>Which save contract applies</strong> is decided by one question, asked per field, not per surface: <em>does this write to Airtable?</em> → the value is staged as a <strong>draft</strong> and published explicitly (field/table descriptions — see <a href="#entity-panel">EntityPanel</a>); <em>is it Baseout\'s own annotation?</em> → <strong>edit mode with an explicit Save</strong> (there is no outbound act to stage, so staging one would be ceremony — but a mistimed blur must still never rewrite a colleague\'s note); <em>is it a multi-field set that must validate together?</em> → the same, one Save for the set. The switch answers "what am I doing"; Save answers "when does this become true" — both are needed, and a mode switch is not a licence to drop Save.<br><br><strong>Escape</strong> inside edit mode cancels the edit and is swallowed, so it never reaches the panel\'s own Escape (back / close) and takes the edit with it. <strong>Cancel</strong> restores the values as they were on entering edit mode. Leaving the entity or closing the panel while dirty <strong>keeps the draft</strong> (per-entity, in memory) rather than silently discarding it — come back and the panel is still in edit mode with your text. A <strong>removed</strong> entity has nothing to edit, so the switch is <strong>absent</strong>, not present-and-disabled. Live: the <a href="/schema">Automations</a> and <a href="/schema">Interfaces</a> panels (<a href="#pattern-schema-automations-interfaces">manual registry</a>, <a href="#pattern-automation-anatomy">anatomy strip</a>).',
    reference: 'design:components/schema/schemaReadBody.ts + EntityPanel.astro (.sch-slot, .sch-modeswitch)',
    showCode: false,
    usageDo: [
      'Use the canonical .sch-modeswitch / .sch-mode-active pair from styles/global.css. Read is the default segment on a detail panel (Docs opens in edit because a doc is authored; a captured entity is read).',
      'Keep every slot in the SAME position and the SAME height across modes. Reserve the input height in read mode — a borderless value box that gains its border in edit mode is the cheap way to guarantee it.',
      'Render captured sections (trigger / touches / actions) identically in both modes, and mark the section label "from capture" in edit mode so the user knows why there is no input.',
      'Keep Save explicit, and put Save/Cancel in the footer slot the read-mode actions already occupy.',
      'Swallow Escape while in edit mode: it cancels the edit, and must not reach the panel\'s own back/close handler.',
      'Pick the save contract per FIELD by asking "does this write to Airtable?" — draft/Publish if yes, edit-mode Save if it is Baseout\'s own annotation.',
      'Omit the switch entirely for an entity that cannot be edited (removed / read-only history).',
    ],
    usageDont: [
      "Don't render a second, differently-ordered form for the same object — that is a different page about the same thing, and the user has to re-find what they were just reading.",
      "Don't grey out or disable a captured fact to signal it isn't editable. Grey reads as broken; the 'from capture' marker says it honestly.",
      "Don't add a THIRD contract (per-field inline commit) alongside a mode switch and a live toggle — one panel, one way to edit.",
      "Don't let a row change height when the mode flips; if it does, the layout still 'breaks around you' and the pattern has failed.",
      "Don't show the switch disabled for a removed entity — absent, not disabled.",
      "Don't drop Save just because there is a mode switch (the Docs bar has no Save; that is a gap in Docs, not the pattern).",
    ],
    examples: [
      {
        label: 'The same slot in read mode and in edit mode — same position, same height',
        html: `
<div style="display:grid;gap:16px;max-width:560px">
  <div style="border:1px solid var(--color-base-300);border-radius:12px;background:var(--color-base-100);padding:16px">
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px"><span style="font-size:12px;opacity:.65">Automation · Active · as of last backup</span><span style="margin-left:auto"><span class="join sch-modeswitch"><button type="button" class="btn btn-sm join-item sch-mode-active"><span class="iconify lucide--book-open size-3.5"></span>Read</button><button type="button" class="btn btn-sm join-item"><span class="iconify lucide--pencil size-3.5"></span>Edit</button></span></span></div>
    <div style="display:flex;align-items:center;gap:8px;font-size:11px;font-weight:700;letter-spacing:.05em;text-transform:uppercase;opacity:.5;margin-bottom:8px"><span class="iconify lucide--text size-3.5"></span>Internal note</div>
    <div class="sch-slot is-multi">Owned by RevOps; may switch to a daily digest.</div>
  </div>
  <div style="border:1px solid var(--color-base-300);border-radius:12px;background:var(--color-base-100);padding:16px">
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px"><span style="font-size:12px;opacity:.65">Automation · Active · as of last backup</span><span style="margin-left:auto"><span class="join sch-modeswitch"><button type="button" class="btn btn-sm join-item"><span class="iconify lucide--book-open size-3.5"></span>Read</button><button type="button" class="btn btn-sm join-item sch-mode-active"><span class="iconify lucide--pencil size-3.5"></span>Edit</button></span></span></div>
    <div style="display:flex;align-items:center;gap:8px;font-size:11px;font-weight:700;letter-spacing:.05em;text-transform:uppercase;opacity:.5;margin-bottom:8px"><span class="iconify lucide--text size-3.5"></span>Internal note</div>
    <textarea class="textarea textarea-sm sch-slot-in" rows="3">Owned by RevOps; may switch to a daily digest.</textarea>
  </div>
  <div style="border:1px solid var(--color-base-300);border-radius:12px;background:var(--color-base-100);padding:16px">
    <div style="display:flex;align-items:center;gap:8px;font-size:11px;font-weight:700;letter-spacing:.05em;text-transform:uppercase;opacity:.5;margin-bottom:8px"><span class="iconify lucide--zap size-3.5"></span>Trigger<span class="sch-cap-mark">from capture</span></div>
    <div class="sch-anat-rows"><div class="sch-anat-row"><span class="sch-anat-k">Event</span><span class="sch-anat-v"><span class="sch-anat-event">When a record matches conditions</span></span></div></div>
  </div>
</div>`,
      },
    ],
  },
  {
    id: 'pattern-schema-automations-interfaces',
    group: 'Patterns',
    name: 'Automations & Interfaces (manual registry)',
    summary: 'Two Schema tabs to hand-register the automations/interfaces Airtable\'s API can\'t export: grouped/nested listings, a right-drawer REGISTER form, an EntityPanel that reads AND edits in place (one layout, two modes), a Table/Field tag-picker (auto vs manual chips), soft-delete, below-tier upsell, and bidirectional "Referenced by" surfacing.',
    description:
      'The Schema <a href="/schema">Automations</a> and <a href="/schema">Interfaces</a> tabs. Airtable\'s API doesn\'t expose automations or interfaces, so they\'re <strong>registered manually</strong> (or via an inbound API) and tracked alongside the schema. <strong>Listings:</strong> both group by <strong>Base</strong> (Dan 2026-07-01 — a single-Base association replaces the old free-text group), reusing the Browse tree\'s collapsible header (blue <a href="#pattern-schema-app-graph">database concept-icon</a> + base name + count). Automations sit directly under their Base; Interfaces render each Interface as a <strong>parent row</strong> with its <strong>Pages nested</strong> beneath (Base ▸ Interface ▸ Pages, Zendesk-style, "N pages" sub-count). Each Base group renders as a <strong>real table</strong> with a repeated column header (Name · Status · Trigger · Tagged + hover actions for Automations; Name · Type · Status · Tagged for Interfaces), Backups-table style with fixed-width columns so the status/trigger/tagged columns line up across groups; a <strong>Base filter</strong> + <strong>Include-removed</strong> toggle sit on the toolbar; soft-deleted rows render muted with a "Removed from Airtable" badge (kept as history, not deleted). <strong>Empty state</strong> is honest — it names the API blind-spot ("Airtable\'s API doesn\'t expose these") + a primary <em>Register</em> CTA; below the unlocking tier the same skeleton becomes a quiet <em>upsell</em>. <strong>Register (create only)</strong> opens in the shared <strong>right Drawer</strong> (project default — NOT a modal): required scalars first (Name + ID + a <strong>required Base picker</strong>; Interfaces add Type <em>interface|page</em> with a <strong>parent-interface picker required for a page</strong>, scoped to the chosen Base), then a <strong>Table/Field tag-picker</strong> reusing the Browse <code>EntitySearch</code> — <em>auto</em>-derived tags render tinted + non-removable, <em>manual</em> tags outlined with an ×. There is <strong>no raw-definition JSON input</strong> — the <code>definition</code> is API-only (scraped automations), so it\'s never hand-entered and shows read-only in the detail only when a value exists. <strong>Fields (Dan round-2):</strong> automations carry an <strong>On/Off status</strong> in a dedicated <strong>Status column</strong> via our <a href="#badge">status badges</a> (badge-soft + a bg-current dot for the SEMANTIC states — Active = success, Removed = warning — and <code>badge-ghost</code> for Inactive, never <code>badge-soft badge-neutral</code>, which collapses to 1.34:1 on the dark theme (see <a href="#badge">Badge</a>); distinct states, not one grey pill), a <strong>Trigger</strong> chosen from a dropdown of Airtable\'s canonical trigger types (When a record is created / updated / matches conditions / enters a view · At a scheduled time · form / webhook / button · Integrated — free text is gone; the API can\'t export automations so it\'s manual input; it was a single labeled Trigger line in the detail, and is now the head of the <a href="#pattern-automation-anatomy">anatomy strip</a> whenever the capture carries a definition — the line stays for manually registered entries with nothing deeper to show), <strong>two descriptions</strong> in <strong>Airtable vs Internal tabs</strong> (automations DO have an Airtable description, but the API can\'t sync it — so there is <strong>no Publish</strong>, just save/edit; mirrors the <a href="#entity-panel">EntityPanel</a> field pattern minus write-back), and <strong>email subscribers</strong> (chip input); interfaces/pages show a <strong>Published / Not published</strong> status in a Status column (same badges, for interfaces AND pages) and an <strong>Internal-note-only</strong> description (they have no Airtable description). The row tag-count reads "<em>N tagged</em>" (labeled, not a bare icon). <strong>Change history:</strong> the read drawer gains a <strong>Changelog section</strong> (this entity\'s own added/renamed/removed/config events); the same events also appear in the <a href="/schema">Changelog</a> tab as base ▸ [concept icon] name rows (a status change reads e.g. "Automation turned off · Active → Inactive"). <strong>Bidirectional tags:</strong> a table/field\'s shared entity sidebar gains a <strong>"Referenced by"</strong> section listing the automations/interfaces that tag it, each click-through jumping to its tab + opening its detail. <strong>Editing an EXISTING entry (2026-07-28):</strong> there is no edit form any more. A row opens the stacking <a href="#pattern-entity-panel">EntityPanel</a>, and that panel edits itself in place — <a href="#pattern-panel-edit-mode">one layout, two modes</a>, so pressing Edit turns each value into an input where it already sat instead of opening a differently-ordered form about the same object. Name is edited in the panel <em>title</em>; the ID stays in the header and is never editable (it is the identity); Base is not an inline field (changing it invalidates every tag) — it stays a breadcrumb; Active becomes the toggle in the status line; the tag registry is edited inside the <strong>Touches</strong> section; both descriptions and the subscriber list become inputs in their own sections. The captured trigger / touches / actions are never editable and never greyed. The drawer form survives for <strong>Register</strong> only, where there is no read view to diverge from. This deliberately reverted the per-field inline editing added the day before: a panel running three save contracts at once (inline commit + form Save + a live Active toggle) is worse than one. Components: <code>components/schema/SchemaAutomations.astro</code> + <code>schemaAutomations.ts</code>, <code>SchemaInterfaces.astro</code> + <code>schemaInterfaces.ts</code>, <code>schemaReadBody.ts</code>; reuses <code>ui/Drawer.astro</code>, <code>EntitySearch.astro</code>, <code>EntityPanel.astro</code>.',
    reference: 'design:components/schema/SchemaAutomations.astro',
    showCode: false,
    usageDo: [
      'Frame the empty state honestly — name the API blind-spot ("Airtable\'s API can\'t export these, register them here") + one primary Register CTA. Reuse the same skeleton for the below-tier upsell.',
      'Automations = collapsible groups (count badge + "No group" bucket); Interfaces = parent rows with nested Pages ("N pages" sub-count), one level only.',
      'Open REGISTER (create) in the right Drawer (project default), never a daisyUI modal. Scalars first (incl. the required Base), then the tag-picker. Editing an existing entry happens in the panel itself — see Panel Read/Edit mode; never build a second, differently-ordered form for it.',
      'Tag-picker: reuse Browse EntitySearch; auto-derived tags are tinted + non-removable, manual tags outlined with an × (only manual are removable).',
      'Associate every automation/interface with a single Base (required) and group the listings + sidebars by Base, reusing the Browse tree header/visual. Don\'t offer a raw-definition JSON input — it\'s API-only, shown read-only only when present.',
      'Surface tags both ways: on the entity\'s sidebar show a "Referenced by" section (the automations/interfaces tagging it), click-through to that tab.',
      'Soft-delete, never hard-delete: removed rows stay muted with a "Removed from Airtable" badge behind Include-removed.',
      'When a capture carries a definition, the panel\'s detail is the <a href="#pattern-automation-anatomy">automation anatomy strip</a> (trigger → touches → typed action count), and the manual tag registry merges into that one grouped Touches section rather than sitting beside it as a near-duplicate. Rows are unchanged — the strip is panel-only.',
    ],
    usageDont: [
      "Don't use a modal for the register form — the project default is the right Drawer / entity sidebar.",
      "Don't reopen a separate edit form for an existing automation/interface — the panel edits itself in place (Panel Read/Edit mode). A second surface about the same object always drifts out of order from the first.",
      "Don't nest Interfaces deeper than interface → pages (one level; keep it dense).",
      "Don't make auto-derived tags removable or visually identical to manual ones — the source distinction is the point.",
      "Don't hard-validate the Definition JSON against a schema — it's opaque; only check it parses.",
    ],
    examples: [
      {
        label: 'Automations — a collapsible group with two rows',
        html: `
<div style="max-width:620px;border:1px solid var(--color-base-300);border-radius:12px;overflow:hidden;background:var(--color-base-100)">
  <div style="display:flex;align-items:center;gap:.5rem;padding:.6rem .85rem;background:oklch(from var(--color-base-200) l c h / .4)"><span class="iconify lucide--chevron-down size-4" style="opacity:.5"></span><span style="font-weight:650;font-size:.85rem">Sales ops</span><span style="font-family:ui-monospace,monospace;font-size:.74rem;opacity:.55">2</span></div>
  <div style="display:flex;align-items:center;gap:.75rem;padding:.65rem .85rem;border-top:1px solid oklch(from var(--color-base-300) l c h / .6)"><span style="flex:1;font-weight:550;font-size:.875rem">Notify owner on stage change <span style="font-weight:400;font-size:.78rem;opacity:.55">When record matches conditions</span></span><span style="display:inline-flex;align-items:center;gap:.25rem;font-size:.76rem;opacity:.6"><span class="iconify lucide--tags size-3.5"></span>2</span></div>
  <div style="display:flex;align-items:center;gap:.75rem;padding:.65rem .85rem;border-top:1px solid oklch(from var(--color-base-300) l c h / .6)"><span style="flex:1;font-weight:550;font-size:.875rem">Weekly pipeline digest <span style="font-weight:400;font-size:.78rem;opacity:.55">At scheduled time</span></span><span style="display:inline-flex;align-items:center;gap:.25rem;font-size:.76rem;opacity:.6"><span class="iconify lucide--tags size-3.5"></span>1</span></div>
</div>`,
      },
      {
        label: 'Interface with nested Pages + auto/manual tag chips',
        html: `
<div style="max-width:620px;display:flex;flex-direction:column;gap:.6rem">
  <div style="border:1px solid var(--color-base-300);border-radius:12px;overflow:hidden;background:var(--color-base-100)">
    <div style="display:flex;align-items:center;gap:.55rem;padding:.65rem .85rem;background:oklch(from var(--color-base-200) l c h / .4)"><span class="iconify lucide--chevron-down size-4" style="opacity:.5"></span><span class="iconify lucide--layout-panel-left size-4" style="opacity:.55"></span><span style="flex:1;font-weight:650;font-size:.875rem">Sales dashboard</span><span style="font-family:ui-monospace,monospace;font-size:.74rem;opacity:.55">2 pages</span></div>
    <div style="display:flex;align-items:center;gap:.55rem;padding:.65rem .85rem 0.65rem 2.4rem;border-top:1px solid oklch(from var(--color-base-300) l c h / .6)"><span class="iconify lucide--file size-3.5" style="opacity:.45"></span><span style="font-size:.875rem">Pipeline overview</span></div>
    <div style="display:flex;align-items:center;gap:.55rem;padding:.65rem .85rem 0.65rem 2.4rem;border-top:1px solid oklch(from var(--color-base-300) l c h / .6)"><span class="iconify lucide--file size-3.5" style="opacity:.45"></span><span style="font-size:.875rem">Deal detail</span></div>
  </div>
  <div style="display:flex;gap:.35rem;align-items:center"><span style="font-size:.72rem;opacity:.6">Tags:</span><span style="display:inline-flex;align-items:center;gap:.3rem;font-size:.78rem;padding:.18rem .5rem;border-radius:999px;background:oklch(from var(--color-primary) l c h / .1);color:var(--color-primary)"><span class="iconify lucide--table-2 size-3.5"></span>Deals</span><span style="display:inline-flex;align-items:center;gap:.3rem;font-size:.78rem;padding:.18rem .5rem;border-radius:999px;border:1px solid var(--color-base-300)"><span class="iconify lucide--tag size-3.5"></span>Company · Deals<span class="iconify lucide--x size-3" style="opacity:.6"></span></span></div>
</div>`,
      },
    ],
  },
  {
    id: 'pattern-schema-app-graph',
    group: 'Patterns',
    name: 'App-layer graph (Visualize · Automations & Interfaces)',
    summary: 'The third Visualize mode: automations, interfaces, and pages graphed over the table/field substrate with three typed edge kinds (references / reads / triggers), a legend that doubles as the node-type key, Base + node-type filters, field-under-table collapse, and node click-through to the shared detail.',
    description:
      'The <a href="/schema">Visualize</a> tab\'s <strong>third mode</strong> — <em>Data · Relationships · <strong>Automations &amp; Interfaces</strong></em> — reusing the same React Flow island (one bundle, one toolbar). It graphs the <strong>app layer over the data substrate</strong>: <strong>five node types</strong> — automation, interface, page, table, field — each a <strong>neutral card with a coloured accent + type chip + Lucide icon</strong> (Fibery pattern: type is a chip, never a loud full-node fill; fill/opacity is reserved for the <em>removed</em> state). <strong>Three edge kinds</strong>, distinguished by <strong>colour + dash + arrowhead + an inline label</strong> (not colour alone): <strong>references</strong> (automation → table/field, amber solid), <strong>reads</strong> (page → table/field, blue dashed), <strong>triggers</strong> (page/interface → automation, violet animated); a faint dashed <strong>contains</strong> connector nests pages under their interface and fields under their table (kept out of the legend — it\'s structure, not a kind). A compact <strong>legend</strong> bottom-left keys both the node accents and the edge kinds — the <strong>same colour language as the Node-types filter</strong>, so legend == filter == node accent. <strong>Toolbar</strong> reuses the shared faceted chrome: <strong>Bases</strong> + a <strong>Node types</strong> facet + an <strong>Expand fields</strong> toggle (fields collapse under their table by default — the edge docks to the table with the field name on the label; expanded, referenced fields become their own chips) + <strong>Include removed</strong>. <strong>Layout is structural</strong> — dagre left→right (app entities left, the data they touch right), <em>never</em> force-directed. <strong>Click-through:</strong> a table/field node opens the shared <a href="#pattern-entity-panel">entity sidebar</a> (<code>schema:openEntity</code>); an automation/interface/page node switches to its tab + opens its read drawer (<code>schema:openAutomation</code> / <code>schema:openInterface</code>) — the same handoff the "Referenced by" jump uses. <strong>Empty / upsell:</strong> no captured entities points at the Automations/Interfaces tabs; below the tier it\'s the quiet upsell. Depends on the <a href="#pattern-schema-automations-interfaces">manual registry</a> for entities; <code>triggers</code> edges render from captured page→automation links. Component: <code>components/schema/SchemaCanvas.tsx</code> (<code>appLayout()</code> + <code>AppEntityNode</code> / <code>AppFieldNode</code>).',
    reference: 'components/schema/SchemaCanvas.tsx',
    showCode: false,
    usageDo: [
      'Encode node TYPE as a coloured chip + icon inside a neutral card; reserve fill/opacity for the removed state (five types, no rainbow).',
      'Distinguish the three edge kinds by colour + dash + arrowhead + an inline label — never colour alone; keep the structural "contains" connector faint and out of the legend.',
      'Make the legend the single source of truth: legend swatch colour == node accent == the Node-types filter chip.',
      'Collapse fields under their table by default (edge docks to the table, field name on the label); reveal them with the Expand-fields toggle.',
      'Lay out structurally with dagre LR (app entities left → data right); never force-directed ("no hairballs").',
      'Reuse the shared toolbar + faceted filters (Bases · Node types · Include removed) so the mode reads identically to Data / Relationships.',
      'Click-through to the shared detail: table/field → entity sidebar; automation/interface/page → its tab + read drawer (same handoff as Referenced-by).',
      'Hovering an edge highlights it + its two endpoints (dims the rest) and shows a tooltip — the kind, A→B, the field it goes through, and a one-line consequence (impact analysis); click opens the source. Same edge-inspection pattern as the Relationships graph. The structural "contains" connector stays inert.',
    ],
    usageDont: [
      "Don't spin up a second React Flow island — it's a MODE on the existing Visualize canvas.",
      "Don't colour the whole node by type — the chip + icon carry it; a five-colour node soup is the anti-pattern.",
      "Don't rely on edge colour alone to tell the kinds apart — add dash + arrowhead + label.",
      "Don't use a force-directed layout; keep it structural (dagre), collapse fields, and filter to stay legible at scale.",
      "Don't hard-hide removed entities — mute them behind Include-removed so the graph doubles as history.",
    ],
    examples: [
      {
        label: 'Typed nodes — automation / interface / page / table',
        html: `
<div style="display:flex;flex-wrap:wrap;gap:.7rem;max-width:640px">
  <div style="position:relative;width:220px;background:var(--color-base-100);border:1px solid var(--color-base-300);border-radius:10px;overflow:hidden"><span style="position:absolute;left:0;top:0;bottom:0;width:3px;background:#d97706;opacity:.9"></span><div style="padding:.5rem .7rem .5rem .8rem"><div style="display:flex;align-items:center;gap:.45rem"><span class="iconify lucide--zap size-4" style="color:#d97706"></span><span style="flex:1;font-weight:640;font-size:.8rem">Notify owner…</span><span style="font-size:.58rem;font-weight:700;letter-spacing:.04em;text-transform:uppercase;padding:.05rem .4rem;border-radius:999px;color:#d97706;background:color-mix(in oklch,#d97706 14%,transparent)">Automation</span></div><div style="margin-top:.15rem;font-size:.7rem;opacity:.5">When record matches conditions</div></div></div>
  <div style="position:relative;width:220px;background:var(--color-base-100);border:1px solid var(--color-base-300);border-radius:10px;overflow:hidden"><span style="position:absolute;left:0;top:0;bottom:0;width:3px;background:#7c3aed;opacity:.9"></span><div style="padding:.5rem .7rem .5rem .8rem"><div style="display:flex;align-items:center;gap:.45rem"><span class="iconify lucide--layout-panel-left size-4" style="color:#7c3aed"></span><span style="flex:1;font-weight:640;font-size:.8rem">Sales dashboard</span><span style="font-size:.58rem;font-weight:700;letter-spacing:.04em;text-transform:uppercase;padding:.05rem .4rem;border-radius:999px;color:#7c3aed;background:color-mix(in oklch,#7c3aed 14%,transparent)">Interface</span></div></div></div>
  <div style="position:relative;width:220px;background:var(--color-base-100);border:1px solid var(--color-base-300);border-radius:10px;overflow:hidden"><span style="position:absolute;left:0;top:0;bottom:0;width:3px;background:#2563eb;opacity:.9"></span><div style="padding:.5rem .7rem .5rem .8rem"><div style="display:flex;align-items:center;gap:.45rem"><span class="iconify lucide--file size-4" style="color:#2563eb"></span><span style="flex:1;font-weight:640;font-size:.8rem">Pipeline overview</span><span style="font-size:.58rem;font-weight:700;letter-spacing:.04em;text-transform:uppercase;padding:.05rem .4rem;border-radius:999px;color:#2563eb;background:color-mix(in oklch,#2563eb 14%,transparent)">Page</span></div></div></div>
  <div style="display:flex;align-items:center;gap:.5rem;width:200px;height:44px;padding:0 .75rem;background:var(--color-base-100);border:1px solid var(--color-base-300);border-radius:10px"><span style="width:9px;height:9px;border-radius:999px;background:var(--color-warning)"></span><span style="flex:1;font-weight:640;font-size:.8rem">Deals</span><span style="font-family:ui-monospace,monospace;font-size:.66rem;opacity:.55">980 rec</span></div>
</div>`,
      },
      {
        label: 'Legend — node accents + the three edge kinds',
        html: `
<div style="display:inline-flex;gap:1rem;background:var(--color-base-100);border:1px solid var(--color-base-300);border-radius:10px;padding:.6rem .75rem;font-size:.72rem">
  <div><div style="font-size:.58rem;font-weight:700;letter-spacing:.05em;text-transform:uppercase;opacity:.45;margin-bottom:.3rem">Nodes</div>
    <div style="display:flex;align-items:center;gap:.4rem;margin-bottom:.2rem"><span style="width:8px;height:8px;border-radius:3px;background:#d97706"></span>Automation</div>
    <div style="display:flex;align-items:center;gap:.4rem;margin-bottom:.2rem"><span style="width:8px;height:8px;border-radius:3px;background:#7c3aed"></span>Interface</div>
    <div style="display:flex;align-items:center;gap:.4rem;margin-bottom:.2rem"><span style="width:8px;height:8px;border-radius:3px;background:#2563eb"></span>Page</div>
    <div style="display:flex;align-items:center;gap:.4rem"><span style="width:8px;height:8px;border-radius:3px;background:var(--color-base-content)"></span>Table</div></div>
  <div><div style="font-size:.58rem;font-weight:700;letter-spacing:.05em;text-transform:uppercase;opacity:.45;margin-bottom:.3rem">Edges</div>
    <div style="display:flex;align-items:center;gap:.4rem;margin-bottom:.2rem"><svg width="18" height="8"><line x1="1" y1="4" x2="17" y2="4" stroke="#d97706" stroke-width="1.6"/></svg>References</div>
    <div style="display:flex;align-items:center;gap:.4rem;margin-bottom:.2rem"><svg width="18" height="8"><line x1="1" y1="4" x2="17" y2="4" stroke="#2563eb" stroke-width="1.6" stroke-dasharray="4 3"/></svg>Reads</div>
    <div style="display:flex;align-items:center;gap:.4rem"><svg width="18" height="8"><line x1="1" y1="4" x2="17" y2="4" stroke="#7c3aed" stroke-width="1.6"/></svg>Triggers</div></div>
</div>`,
      },
    ],
  },
  {
    id: 'pattern-schema-chat',
    group: 'Patterns',
    name: 'Schema chat (threads + context + references)',
    summary: 'A dense, utility AI chat about the schema: thread rail + conversation + composer, a context bar of removable scope chips, clickable entity/doc references, convert-to-doc, Pro+ gate.',
    description:
      'The Schema <a href="/schema">Chat</a> tab (last tab): chat with AI about the Space\'s schema, in a <strong>Linear/Vercel-dense, no-avatar</strong> register (not a consumer chat). Three regions: a <strong>thread rail</strong> (New chat, single-line titles + muted date, hover kebab → Rename / Archive, archived hidden behind a toggle), a <strong>conversation</strong> (user vs assistant by label + subtle background + alignment, no avatars/bubbles-decoration), and a <strong>composer</strong>. A persistent <strong>context bar</strong> sits above the composer (Cursor/Langdock pattern): removable <strong>scope chips</strong> for bases/tables/fields (added via the reused <a href="#">EntitySearch</a> typeahead) + attached <strong>doc chips</strong> (doc picker); shows <strong>"Whole Space"</strong> when empty. Assistant replies carry a <strong>References</strong> row of <strong>the same chip component</strong> (entity → shared sidebar, doc → the Docs tab) — Notion native-mention model, not footnote numbers. <strong>Convert to doc</strong> drops a green <strong>linked-reference card</strong> ("Saved as a doc · Open"). <strong>Pro+ gated</strong>: below Pro+ the whole tab shows an upgrade affordance instead of a composer (discoverable, not hidden); a credits hint + Send↔Stop streaming state otherwise. On the <strong>Data page</strong> (data-page spec) the same surface gains: a <strong>"Current Browse view" context chip</strong> (the live table + active-filter count, offered in the Add-context picker), <strong>record references</strong> in replies (a record chip opens the record sidebar via <code>data:openRecord</code>), and the <strong>global quick-ask widget</strong> (<code>QuickAskDock.astro</code> — the right drawer opened by the header launcher) carrying the page\'s threads + the same attachable scopes on BOTH Schema and Data. Components: <code>components/schema/SchemaChat.astro</code> + <code>schemaChat.ts</code> + <code>QuickAskDock.astro</code>.',
    reference: 'design:components/schema/SchemaChat.astro',
    showCode: false,
    usageDo: [
      'Keep it dense + utility: label + subtle background + alignment for sender, no avatars or gradient bubbles.',
      'Anchor the assistant reply on a QUIET plate (weaker fill than the user bubble, no border) and soften body text to ~85% base-content — pure white on the dark theme halates and reads as heavy.',
      'Make context visible + editable: a persistent context bar of removable scope chips + doc chips; "Whole Space" when none.',
      'Render in-reply references as the SAME chip component as the context bar; entity → shared sidebar, doc → the Docs tab.',
      'Convert-to-doc drops a linked reference card in the thread (Open), and the doc lands in the Docs tab namespace.',
      'Gate behind Pro+ with a discoverable upgrade state (not a hidden route); show a credits hint + a Send/Stop streaming state.',
    ],
    usageDont: [
      "Don't build a consumer chat (avatars, big gradient bubbles, emoji reactions) — it's a schema utility.",
      "Don't hide what the AI can see — the context bar is the whole point; never leave scope implicit.",
      "Don't invent a new chip for references — reuse the entity tag-chip so a reference behaves like everywhere else.",
    ],
    examples: [
      {
        label: 'Assistant reply with a references row + a convert-to-doc card',
        html: `
<div style="padding:1rem;max-width:680px;display:flex;flex-direction:column;gap:1rem">
  <div style="display:flex;flex-direction:column;gap:.35rem;max-width:90%">
    <span style="font-size:.68rem;font-weight:600;letter-spacing:.03em;text-transform:uppercase;opacity:.45">Assistant</span>
    <div style="font-size:.9rem;line-height:1.55;padding:12px 16px;border-radius:12px;background:oklch(from var(--color-base-200) l c h / .45);color:oklch(from var(--color-base-content) l c h / .85)">Deals link to Companies through the Company field, with a reciprocal Deals field, so the two are two-way.</div>
    <div style="display:flex;align-items:center;gap:.4rem;flex-wrap:wrap">
      <span style="font-size:.66rem;text-transform:uppercase;letter-spacing:.04em;opacity:.42">References</span>
      <span style="display:inline-flex;align-items:center;gap:.3rem;padding:.12rem .5rem;border:1px solid color-mix(in oklch,var(--color-primary) 22%,var(--color-base-300));border-radius:999px;background:color-mix(in oklch,var(--color-primary) 6%,transparent);font-size:.76rem"><span class="iconify lucide--table-2 size-3" style="color:var(--color-primary)"></span>Deals</span>
      <span style="display:inline-flex;align-items:center;gap:.3rem;padding:.12rem .5rem;border:1px solid color-mix(in oklch,var(--color-primary) 22%,var(--color-base-300));border-radius:999px;background:color-mix(in oklch,var(--color-primary) 6%,transparent);font-size:.76rem"><span class="iconify lucide--file-text size-3" style="color:var(--color-primary)"></span>Sales CRM doc</span>
    </div>
  </div>
  <button style="display:inline-flex;align-items:center;gap:.6rem;padding:.6rem .75rem;border:1px solid color-mix(in oklch,var(--color-success) 30%,var(--color-base-300));background:color-mix(in oklch,var(--color-success) 7%,var(--color-base-100));border-radius:.7rem;cursor:pointer;text-align:left">
    <span style="display:grid;place-items:center;width:2rem;height:2rem;border-radius:.5rem;background:color-mix(in oklch,var(--color-success) 16%,transparent);color:var(--color-success)"><span class="iconify lucide--file-plus-2 size-4"></span></span>
    <span style="display:flex;flex-direction:column"><span style="font-size:.68rem;text-transform:uppercase;letter-spacing:.04em;opacity:.5">Saved as a doc</span><span style="font-size:.86rem;font-weight:600">Deals ↔ Companies — link &amp; reporting fields</span></span>
    <span style="margin-left:.6rem;display:inline-flex;align-items:center;gap:3px;font-size:.76rem;font-weight:500;color:var(--color-primary)">Open<span class="iconify lucide--arrow-up-right size-3.5"></span></span>
  </button>
  <div style="display:flex;align-items:center;gap:.45rem;flex-wrap:wrap;border-top:1px solid var(--color-base-300);padding-top:.7rem">
    <span style="font-size:.68rem;text-transform:uppercase;letter-spacing:.04em;opacity:.45">Context</span>
    <span style="display:inline-flex;align-items:center;border:1px solid color-mix(in oklch,var(--color-primary) 22%,var(--color-base-300));border-radius:999px;background:color-mix(in oklch,var(--color-primary) 6%,transparent)"><span style="display:inline-flex;align-items:center;gap:.3rem;padding:.12rem .5rem;font-size:.76rem"><span class="iconify lucide--table-2 size-3" style="color:var(--color-primary)"></span>Deals</span><span style="padding:0 .3rem;color:oklch(from var(--color-base-content) l c h / .5)"><span class="iconify lucide--x size-3"></span></span></span>
    <span class="btn btn-sm btn-ghost gap-1"><span class="iconify lucide--plus size-3.5"></span>Add context</span>
  </div>
</div>`,
      },
    ],
  },
  {
    id: 'pattern-schema-docs',
    group: 'Patterns',
    name: 'Docs console (list · document · meta rail)',
    summary: 'The Docs tab is a full-height three-zone console like Chat: a documents-list rail, a bordered document surface with a centered reading column, and a meta rail (Tagged entities · Links) separated by a vertical hairline — no floating cards.',
    description:
      'The Schema/Data <a href="/schema">Docs</a> tab, restructured to the same full-height console language as <a href="#pattern-schema-chat">Chat</a> (Mobbin: Intercom Knowledge, Notion page + details panel, GitBook — every mature docs product zones the page the same way). <strong>Three zones with real boundaries:</strong> (1) the <strong>documents-list rail</strong> (search + sort + one bordered list, full height, own scroll); (2) the <strong>document surface</strong> — ONE bordered panel (like <code>.chat-main</code>) with a header bar (byline · Edit/Read switch · <a href="#pattern-export-control">Export</a> · delete — document-scoped actions live HERE, not on the list toolbar) closed by a bottom hairline, and below it the scrolling content: text at a <strong>centered ~72ch measure</strong> while <strong>embedded diagrams break out to the full container width</strong> (a schema diagram earns every pixel); (3) the <strong>meta rail</strong> — Tagged entities and Links as stacked SECTIONS split by horizontal hairlines inside a full-height column separated from the text by a <strong>vertical <code>border-left</code></strong> (the divider users read as "context lives here"), with its own scroll. The anti-pattern this replaced: the doc text pinned to the pane\'s left edge and Tags/Links as two floating bordered cards in empty page background — on the dark theme the eye had no zones, everything read as scattered. <strong>Formatting toolbar (Dan 2026-07-15, "turn the Plate menu on"):</strong> a grouped, sticky <strong>Plate-style toolbar</strong> sits above the editor in EDIT mode only (hidden in Read via the same hide-list as the tag hint) — Bold · Italic · Strikethrough · Inline code | Heading 1 · Heading 2 | Bulleted · Numbered list | Quote, each a catalog <code>btn-square</code> with a <a href="#button">tooltip</a> and a caret-driven <code>is-active</code> state. Built from the button primitive (no bespoke component); in this mirror the commands run through <code>document.execCommand</code> so the UX is clickable for review, and the Baseout engine swaps in real Plate commands behind the identical chrome. Components: <code>components/schema/SchemaDocs.astro</code> (reused by Data via <code>dataToSchema</code>).',
    reference: 'design:components/schema/SchemaDocs.astro',
    showCode: false,
    usageDo: [
      'Fill the viewport: the console is height-clamped like Chat (max(520px, 100dvh − chrome)) so zones are columns, not cards that end mid-air.',
      'Center the reading column inside the document surface (~72ch) — never pin long-form text to the pane\'s left edge.',
      'Make the meta rail ONE full-height column with a vertical border-left; sections (Tagged entities, Links) divide with horizontal hairlines.',
      'Keep the header bar (byline · mode switch · actions) inside the document surface, closed by a bottom hairline.',
      'Let each zone scroll independently (list, document, meta rail).',
      'Let embedded diagrams span the full reading-column width; only TEXT keeps the 72ch measure.',
      'Give each list row a hover kebab (the Chat thread-rail pattern) with Export / Delete; document-scoped actions (Export, delete) otherwise live on the document header bar, not the list toolbar.',
      'Show the Plate-style formatting toolbar (Bold/Italic/Strike/Code · H1/H2 · lists · Quote) above the editor in EDIT mode only, built from the btn-square primitive with tooltips and a caret-driven active state; hide it in Read mode with the rest of the edit affordances.',
      'Data docs only (records prop present): `@@` opens the RECORD-tag widget — three paths to a record (Base ▾ / Table ▾ drill, a saved Browse preset, or a direct `rec…` id searched across all tables); picking inserts a circle-dot record chip (entityChip + data-record-open → the record drawer) and files it under a "Records" group in the Tagged-entities rail (rows share the tag search + full-path toggle; a record\'s path = base ▸ table). On Schema the records prop is absent and `@@` types literally — zero record UI.',
    ],
    usageDont: [
      "Don't float metadata as separate bordered cards beside the text — that's the scattered-cards anti-pattern this replaced.",
      "Don't offer a flat search over ALL records in the @@ widget — millions of records need a scope (table / preset) first; only a `rec…` id query may span tables.",
      "Don't put document-scoped actions (Export PDF) on the list toolbar at search level — the toolbar filters the LIST; the bar acts on the DOCUMENT.",
      "Don't let the page background show through between zones — the document surface is one bordered panel.",
      "Don't give the meta rail its own card-in-card chrome; the vertical divider + section hairlines are the whole structure.",
    ],
    examples: [
      {
        label: 'The three zones — list rail · centered document · meta rail',
        html: `
<div style="display:grid;grid-template-columns:150px 1fr;gap:12px;height:240px;font-size:.72rem">
  <div style="border:1px solid var(--color-base-300);border-radius:10px;padding:8px;display:flex;flex-direction:column;gap:4px">
    <div style="padding:6px 8px;border-radius:6px;background:color-mix(in oklch,var(--color-primary) 8%,transparent);color:var(--color-primary);font-weight:600">Contacts dataset</div>
    <div style="padding:6px 8px;border-radius:6px;opacity:.7">Orders: totals</div>
  </div>
  <div style="border:1px solid var(--color-base-300);border-radius:10px;overflow:hidden;display:flex;flex-direction:column">
    <div style="display:flex;align-items:center;gap:8px;padding:6px 10px;border-bottom:1px solid var(--color-base-300);opacity:.6">Dana · Edited Jul 10 <span style="margin-left:auto">Edit · Read</span></div>
    <div style="flex:1;display:grid;grid-template-columns:1fr 96px">
      <div style="padding:14px 24px"><div style="font-weight:700;font-size:.9rem;margin-bottom:6px">Contacts — how to read it</div><div style="opacity:.6;line-height:1.6">The centered reading column: title, body and diagrams scroll as one, ~72ch measure.</div></div>
      <div style="border-left:1px solid var(--color-base-300);display:flex;flex-direction:column"><div style="padding:10px;border-bottom:1px solid oklch(from var(--color-base-300) l c h / .55)"><div style="font-size:.58rem;font-weight:700;letter-spacing:.05em;text-transform:uppercase;opacity:.5">Tagged</div></div><div style="padding:10px"><div style="font-size:.58rem;font-weight:700;letter-spacing:.05em;text-transform:uppercase;opacity:.5">Links</div></div></div>
    </div>
  </div>
</div>`,
      },
    ],
  },
  {
    id: 'pattern-backup-schedule-scope',
    group: 'Patterns',
    name: 'Backup depth + schedule',
    summary: 'Three depth toggles (Schema always-on · Record data · Attachments) drive the schedule: a dynamic-titled data/attachments box plus a standalone Schema box that ties to the data schedule by default or splits to its own cadence. Per-cadence tier gating + next-run.',
    description:
      'The backup-config control on the setup wizard + a Space\'s backup settings (openspec backup-schedule-and-scope; Dan\'s 2026-07-01 restructure). <strong>What gets backed up = three toggles</strong>: <strong>Schema</strong> (checked + disabled, “Always on”), <strong>Record data</strong>, and <strong>Attachments</strong> — the two optional toggles DRIVE the schedule below (no scope radio-cards; “schema only” is just the state where neither is checked). A single <strong>data/attachments schedule box</strong> appears when Record data OR Attachments is on, with a <strong>dynamic title</strong> — “Data &amp; attachments” / “Data” / “Attachments” backup (data and attachments always share one schedule). The <strong>Schema backup is its own box</strong> with a <strong>“Same schedule as the {data &amp; attachments|data|attachments} backup” toggle (on by default)</strong>: on → schema is tied and a <em>greyed read-only preview</em> shows the inherited cadence (trust signal, per Calendly/billing “same as” research); off → reveal schema\'s own cadence picker + the more-often hint and a non-blocking warning when schema is set <em>less</em> often than data. When schema-only, the toggle is hidden and schema shows its cadence directly. <strong>Layout = horizontal</strong> (two columns, What | Schedule; data+attachments row first) — Dan picked this over the integrated variant (2026-07-01). Each cadence is a <strong>row of chips</strong> (Monthly / Weekly / Daily / Instant); tiers above the plan stay <strong>visible but locked</strong> with a trailing lock + the tier they unlock on (“Daily · Pro”), linking to billing — never hidden. A hidden <code>[data-frequency]</code> mirror carries the effective primary cadence so the host cleanup/review keep working. Components: <code>components/backups/BackupScheduleScope.astro</code> + <code>CadencePicker.astro</code>. Live: <a href="/integrations/configure">Configure backup</a> → Options. Research: Slack “different settings for mobile”, billing “same as shipping”, Veeam immediate-vs-periodic.',
    reference: 'design:components/backups/BackupScheduleScope.astro',
    showCode: false,
    usageDo: [
      'Drive the schedule from the depth toggles: show the data/attachments box only when Record data or Attachments is on, with a title that names what\'s in it.',
      'Default the Schema box to “Same schedule as the data backup” (checked); show the tied state as a greyed read-only cadence preview, not a hidden control.',
      'On untie, reveal schema\'s own cadence picker indented under the checkbox, using the same CadencePicker as the data box.',
      'Name what\'s inherited in the tie label — never a bare “With data” (research: proven refs always name the source).',
      'Render every cadence option; lock the tiers above the plan with a trailing lock + “· Pro/Launch” and click-through to billing.',
      'Warn (non-blocking) only when untied AND schema is less frequent than data — data backups already capture schema, so it\'s redundant.',
    ],
    usageDont: [
      "Don't bring back scope radio-cards — the depth toggles are the single source of what's backed up; schema-only is emergent.",
      "Don't give data and attachments separate schedules — they always share one box.",
      "Don't fully hide the schema cadence when tied — a utility user wants to see when schema actually runs (greyed preview).",
      "Don't hide locked cadences — keep them visible + lock-badged with the upgrade path.",
    ],
    examples: [
      {
        label: 'Scope cards + a cadence row with a locked tier',
        html: `
<div style="padding:1rem;max-width:680px;display:flex;flex-direction:column;gap:1rem">
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:.6rem">
    <label style="position:relative;display:flex;gap:.6rem;padding:.8rem .9rem;border:1px solid color-mix(in oklch,var(--color-primary) 55%,var(--color-base-300));border-radius:.8rem;background:color-mix(in oklch,var(--color-primary) 7%,var(--color-base-100))">
      <span style="display:grid;place-items:center;width:1.85rem;height:1.85rem;border-radius:.55rem;background:color-mix(in oklch,var(--color-primary) 16%,var(--color-base-200));color:var(--color-primary)"><span class="iconify lucide--database size-4"></span></span>
      <span style="display:flex;flex-direction:column;gap:.15rem"><span style="font-size:.9rem;font-weight:650">Schema + Data</span><span style="font-size:.78rem;line-height:1.4;color:oklch(from var(--color-base-content) l c h / .62)">Full backup: structure plus every record and field value.</span></span>
      <span style="position:absolute;top:.65rem;right:.65rem;display:grid;place-items:center;width:1.1rem;height:1.1rem;border-radius:999px;background:var(--color-primary);color:var(--color-primary-content)"><span class="iconify lucide--check size-3.5"></span></span>
    </label>
    <label style="display:flex;gap:.6rem;padding:.8rem .9rem;border:1px solid var(--color-base-300);border-radius:.8rem;background:var(--color-base-100)">
      <span style="display:grid;place-items:center;width:1.85rem;height:1.85rem;border-radius:.55rem;background:var(--color-base-200);color:oklch(from var(--color-base-content) l c h / .7)"><span class="iconify lucide--list-tree size-4"></span></span>
      <span style="display:flex;flex-direction:column;gap:.15rem"><span style="font-size:.9rem;font-weight:650">Schema Only</span><span style="font-size:.78rem;line-height:1.4;color:oklch(from var(--color-base-content) l c h / .62)">Structure and history only. Record data is <strong>not</strong> backed up.</span></span>
    </label>
  </div>
  <div style="display:flex;align-items:center;justify-content:space-between"><span style="font-size:.85rem;font-weight:650">Data backup</span><span style="font-size:.76rem;color:oklch(from var(--color-base-content) l c h / .55)">Next run in 14d</span></div>
  <div style="display:inline-flex;gap:6px;flex-wrap:wrap">
    <span style="padding:7px 12px;border:1px solid var(--color-base-300);border-radius:9px;font-size:13px;font-weight:500;color:color-mix(in oklch,var(--color-primary) 80%,var(--color-base-content));background:color-mix(in oklch,var(--color-primary) 12%,var(--color-base-100));border-color:color-mix(in oklch,var(--color-primary) 55%,var(--color-base-300))">Monthly</span>
    <span style="padding:7px 12px;border:1px solid var(--color-base-300);border-radius:9px;font-size:13px;font-weight:500">Weekly</span>
    <span style="display:inline-flex;align-items:center;gap:6px;padding:7px 12px;border:1px solid var(--color-base-300);border-radius:9px;font-size:13px;font-weight:500;color:oklch(from var(--color-base-content) l c h / .5)">Daily <span style="display:inline-flex;align-items:center;gap:2px;font-size:11px;font-weight:600"><span class="iconify lucide--lock size-3"></span>Pro</span></span>
  </div>
</div>`,
      },
    ],
  },
  {
    id: 'pattern-toolbar',
    group: 'Patterns',
    name: 'Filter toolbar (search + filters)',
    summary: 'One filter-bar layout for every page: search │ filters … → a tab-specific right cluster. Never a different shape per tab.',
    description:
      'The same toolbar shape everywhere, so no two tabs read differently. Left → right on ONE row: a <strong>search box</strong> (fixed-ish width), then the <a href="#pattern-faceted-filter">faceted filters</a> — <strong>with no divider between them (Oleh 2026-07-24)</strong>, because search and filters narrow the SAME set and read as one group; a rule drawn between them invents a boundary that does not exist. A divider is only earned where the MEANING changes: between a scope switch and the narrowing controls (Visualize), between what a preset IS and what you DO to it (the Data grid), or between narrowing and an action like Export + any checkbox filters + a red <a href="#button">Clear</a>; the <strong>right cluster</strong> (margin-left:auto) holds the tab-specific controls — a view toggle, Export, Add-to-doc, a count. It wraps gracefully on narrow widths. The classes are <strong>global</strong> (<code>.sch-tb</code>, <code>.sch-tb-search</code>, <code>.sch-tb-div</code>, <code>.sch-tb-right</code>, <code>.sch-tb-count</code>, <code>.sch-tb-check</code> in <code>global.css</code>) so the Astro tabs AND the React Visualize island share the exact same layout. Rules that come with it: <strong>section-wide metadata (a freshness stamp) lives at the page-title level, not inside a tab’s toolbar</strong>; <strong>checkbox filters are one neutral <a href="#checkbox-toggle">checkbox</a> everywhere</strong> (never a coloured <code>checkbox-warning</code> variant) with a <a href="#tooltip">tooltip</a> explaining what they do; <strong>toolbar action buttons are Secondary <a href="#button">btn-neutral</a></strong> (Add to doc, Export) — blue (primary) is reserved for the main CTA only. Live: <a href="/schema">Schema</a> (Browse / Visualize / Changelog).',
    reference: 'styles/global.css (.sch-tb)',
    showCode: false,
    usageDo: [
      'Lay every filter toolbar out the same way: search │ divider │ filters … → right cluster. Reuse the global .sch-tb classes, never a per-tab bespoke layout.',
      'Put section-wide metadata (a freshness/“as of” stamp) at the page-title level, right-aligned — not inside one tab’s toolbar.',
      'Use ONE neutral checkbox for every boolean filter, each with a tooltip; keep action buttons Secondary (btn-neutral) and reserve blue for the primary CTA.',
      'Give every tab a search box (even Changelog) so users can search the same way everywhere.',
      'ONE search chrome on every list tab: `label.input.input-sm.sch-tb-search` + a leading magnifier + a `/` keyboard-hint `kbd` + a "Search …" placeholder; pressing `/` focuses the ACTIVE tab\'s search. The EntitySearch typeahead DROPDOWN is used only on tabs that search the entity index (Browse, Docs); the other tabs use a plain input with identical chrome (no dropdown). Mark each search input `data-sch-search` for the shared `/` handler.',
      'Standard wording + controls (2026-07-03, applied to Browse · Relationships · Automations · Interfaces · Changelog): the show-hidden toggle is "Include removed" everywhere (never "deleted"); the Tree/Flat view toggle uses the shared `.sch-tb-modes` class + labels "Tree" / "Flat" (never "Flat index"), and appears only on tabs with a tree/flat duality. Automations/Interfaces were moved off their bespoke `.au-tb`/`.if-tb` onto `.sch-tb`; their Include-removed daisyUI toggle became the standard `.sch-tb-check` checkbox.',
    ],
    usageDont: [
      "Don't give each tab a different toolbar shape, or split search and filters onto separate rows.",
      "Don't colour a filter checkbox (no checkbox-warning) — that made one tab look unlike the others.",
      "Don't randomly mix ghost and neutral action buttons, or use primary blue for a plain Export/utility.",
    ],
    examples: [
      {
        label: 'One row — search │ divider │ filters → right cluster',
        html: `
<div class="rounded-box border border-base-300 bg-base-100 p-3" style="padding:1rem">
  <div class="flex flex-wrap items-center gap-2">
    <label class="input input-sm" style="flex:0 1 280px;min-width:180px">
      <span class="iconify lucide--search size-4 opacity-55"></span>
      <input type="search" placeholder="Search…" />
    </label>
    <span style="flex:none;width:1px;height:1.4rem;background:var(--color-base-300);margin:0 2px"></span>
    <div class="btn btn-sm gap-1.5" style="background:var(--color-base-100);border-color:var(--color-base-300);font-weight:400">Bases <span class="iconify lucide--chevron-down size-3 opacity-55"></span></div>
    <div class="btn btn-sm gap-1.5" style="background:var(--color-base-100);border-color:var(--color-base-300);font-weight:400">Type <span class="iconify lucide--chevron-down size-3 opacity-55"></span></div>
    <label class="tooltip tooltip-top inline-flex items-center gap-1.5 px-1 text-[13px] text-base-content/80" data-tip="What this filter does"><input type="checkbox" class="checkbox checkbox-sm" /> Undocumented</label>
    <div class="ml-auto flex items-center gap-2">
      <span class="text-xs text-base-content/55 tabular-nums">105 entities</span>
      <div class="btn btn-sm btn-neutral gap-1.5"><span class="iconify lucide--download size-4"></span>Export <span class="iconify lucide--chevron-down size-3 opacity-60"></span></div>
    </div>
  </div>
</div>`,
      },
    ],
  },
  {
    id: 'pattern-metric-tiles',
    group: 'Patterns',
    name: 'Metric tile strip',
    summary: 'The one way to show a small set of headline numbers: a bordered strip of equal tiles split by dashed dividers.',
    description:
      'A small row of headline metrics is always this strip — never bare stacked text. It is <strong>one bordered <code>base-100</code> card</strong> (1px <code>base-300</code> border, rounded, <code>overflow:hidden</code>) holding a <strong>grid of equal-width tiles</strong>; each tile is a <strong>label + a muted icon on top</strong> (label left, icon right), then the <strong>big tabular value</strong>, then a <strong>muted sub-label</strong>; tiles are separated by a <strong>dashed left border</strong>, not a gap. The value can be a number or a small composite (e.g. a <a href="#status-dot">health dot</a> + word). Set the column count to the number of tiles so they always fill the strip. Used by the <a href="/">Home</a> KPI strip (<code>.hm-kpis</code>) and the Schema <a href="#pattern-entity-panel">entity panel</a> stats (<code>.ep-stats</code>) — reuse it anywhere a few key numbers need to read as part of the system.',
    reference: 'design:views/SpaceHomeView.astro (.hm-kpis) · components/schema/EntityPanel.astro (.ep-stats)',
    showCode: false,
    usageDo: [
      'Use this strip for any short row of headline numbers; give it as many equal tiles as you have metrics.',
      'Per tile: label + muted icon on top, the big tabular value, a muted sub-label underneath.',
      'Separate tiles with a dashed left border inside one bordered card — not free-floating cards with gaps.',
    ],
    usageDont: [
      "Don't fall back to a bare row of stacked number/label text (that's what reads as off-system).",
      "Don't give each tile its own border/shadow — it's one card divided by dashed lines.",
    ],
    examples: [
      {
        label: 'Three tiles — number · number · composite (health)',
        html: `
<div class="grid overflow-hidden rounded-[11px] border border-base-300 bg-base-100" style="grid-template-columns:repeat(3,minmax(0,1fr));max-width:430px">
  <div class="flex min-w-0 flex-col gap-0.5" style="padding:11px 13px 12px">
    <div class="flex items-center justify-between gap-1.5"><span class="text-[11px] font-semibold text-base-content/55">Records</span><span class="iconify lucide--rows-3 size-3.5 text-base-content/40"></span></div>
    <span class="text-[17px] font-semibold tabular-nums">340</span>
    <span class="text-[11px] text-base-content/50">as of last backup</span>
  </div>
  <div class="flex min-w-0 flex-col gap-0.5 border-l border-dashed border-base-content/15" style="padding:11px 13px 12px">
    <div class="flex items-center justify-between gap-1.5"><span class="text-[11px] font-semibold text-base-content/55">Fields</span><span class="iconify lucide--columns-3 size-3.5 text-base-content/40"></span></div>
    <span class="text-[17px] font-semibold tabular-nums">8</span>
    <span class="text-[11px] text-base-content/50">in this table</span>
  </div>
  <div class="flex min-w-0 flex-col gap-0.5 border-l border-dashed border-base-content/15" style="padding:11px 13px 12px">
    <div class="flex items-center justify-between gap-1.5"><span class="text-[11px] font-semibold text-base-content/55">Health</span><span class="iconify lucide--heart-pulse size-3.5 text-base-content/40"></span></div>
    <span class="inline-flex items-center gap-1.5 text-[15px] font-semibold"><span class="size-2 rounded-full bg-success"></span>Healthy</span>
    <span class="text-[11px] text-base-content/50">at last backup</span>
  </div>
</div>`,
      },
    ],
  },
  {
    id: 'pattern-entity-panel',
    group: 'Patterns',
    name: 'Entity detail panel',
    summary: 'The shared stacking detail panel for a base / table / field — drill in, breadcrumb back.',
    description:
      'One panel, opened from two places: a <a href="/schema">Browse</a> row click and a <a href="/schema">Docs</a> entity-tag click (in reading mode). It is a right-anchored drawer over a scrim, modelled on iOS <code>UINavigationController</code>: selecting a child or related entity <strong>swaps the panel to that entity and pushes a crumb</strong> onto a sticky breadcrumb trail (Base ▸ Table ▸ Field); the back arrow or a crumb pops; drilling a different branch truncates the trail past the branch point. Descriptions use <strong>two source tabs — Airtable (Public) and Internal</strong>, each with a role meta line. The Airtable copy is the only one that syncs back: editing it locally flags it <strong>out of sync</strong> (a <code>Draft</code> badge on the heading + a Draft pip on the entity\'s list row) and surfaces <strong>Publish to Airtable</strong>, a guarded write-back (a confirm card with a stale-warning when the live value drifted → Publishing… → Synced) that overrides the live Airtable description. Internal is Baseout-only and never syncs. <strong>AI is not a stored tab</strong> but a <a href="#button">Generate</a> action (Pro+, cost shown on the button) available inside <strong>either tab</strong> — the Airtable draft is public-facing; the Internal draft is prompted to be more technical/verbose. The Internal note still never syncs to Airtable. Edits autosave on navigate so nothing is lost. Sections: Context+type, Descriptions, Children, Relationships, Documentation (the docs that tag it). Built from <a href="#drawer">Drawer</a> visuals + <a href="#badge">Badge</a> + <a href="#status-dot">status dots</a> + <a href="#button">Button</a>; the body is rendered at runtime so its styles are global. Component: <code>components/schema/EntityPanel.astro</code>.',
    reference: 'design:components/schema/EntityPanel.astro',
    showCode: false,
    usageDo: [
      'Reuse this one panel for every entity drill-in (Browse rows, Docs chips) — build the detail once.',
      'Keep the breadcrumb trail in the header; back / a crumb / Esc pops one level.',
      'Treat the Airtable description as the only synced source: edit → Draft → Publish overrides Airtable; once synced, show a quiet "Synced" marker, no button.',
      'Keep the Internal tab Baseout-only (an "Internal · never synced" meta line) — it never syncs to Airtable, but it CAN be AI-generated via its own Generate action (prompted to be more technical/verbose than the public copy). AI stays a Generate action inside each tab, not a third stored description.',
      'Stay inside the data boundary: counts read "as of last backup", no value-statistics section.',
    ],
    usageDont: [
      "Don't open a second floating modal over the panel — push a sheet onto the same stack instead.",
      "Don't let the panel exceed ~40% of the viewport, and keep the list interactive behind it.",
      "Don't sync the Internal description to Airtable, and don't keep AI as its own persisted tab (it's a Generate action inside each tab, not a stored tab).",
      "Don't invent fields Airtable can't provide (record stats, workspace grouping).",
    ],
    examples: [
      {
        label: 'Panel header (breadcrumb stack) + a field detail',
        html: `
<div class="rounded-box border border-base-300 bg-base-100 overflow-hidden" style="max-width:460px">
  <div class="flex items-center gap-1.5 border-b border-base-300 px-2.5 py-2">
    <button class="btn btn-sm btn-ghost btn-square"><span class="iconify lucide--arrow-left size-4"></span></button>
    <nav class="flex grow items-center gap-1 text-[12.5px]"><span class="opacity-55">Deals</span><span class="iconify lucide--chevron-right size-3 opacity-35"></span><span class="font-semibold">Stage</span></nav>
    <button class="btn btn-sm btn-ghost btn-square"><span class="iconify lucide--x size-4"></span></button>
  </div>
  <div class="p-4">
    <div class="flex items-start gap-2.5">
      <span class="grid size-[30px] place-items-center rounded-lg bg-base-200"><span class="iconify lucide--circle-dot size-4 opacity-80"></span></span>
      <div><div class="font-semibold">Stage</div><div class="mt-1 text-xs text-base-content/60">Single Select · Sales CRM ▸ Deals ▸ Stage</div></div>
    </div>
    <div class="mt-3.5 flex items-center gap-1.5 text-sm"><span class="size-2 rounded-full bg-success"></span>Healthy</div>
    <div class="mt-5 text-[11px] font-bold uppercase tracking-wide text-base-content/50">Options <span class="opacity-70">6</span></div>
    <div class="mt-2 flex flex-wrap gap-1.5">
      <span class="badge badge-sm badge-ghost">Lead</span><span class="badge badge-sm badge-ghost">Qualified</span><span class="badge badge-sm badge-ghost">Proposal</span><span class="badge badge-sm badge-ghost">Closed Won</span>
    </div>
  </div>
</div>`,
      },
      {
        label: 'Descriptions — Airtable copy edited (out of sync → Publish)',
        html: `
<div class="rounded-box border border-base-300 bg-base-100 p-4" style="max-width:460px">
  <div class="text-[11px] font-bold uppercase tracking-wide text-base-content/50">Descriptions
    <span class="badge badge-sm badge-warning badge-soft ml-1.5 gap-1"><span class="iconify lucide--pencil-line size-3"></span>Draft</span>
  </div>
  <div role="tablist" class="tabs tabs-border mt-0.5">
    <span role="tab" class="tab tab-active text-[12.5px]">Airtable</span>
    <span role="tab" class="tab text-[12.5px]">Internal</span>
  </div>
  <div class="mt-2.5 mb-1.5 flex items-center gap-1.5 px-0.5 text-[11.5px] text-base-content/60"><span class="badge badge-sm badge-ghost gap-1"><span class="iconify lucide--globe size-3"></span>Public</span>Shown to everyone in Airtable · the only synced copy.</div>
  <div class="rounded-[9px] border border-base-300 bg-base-200/55 p-3">
    <div class="text-[13px] leading-relaxed">Current pipeline stage. Advances automatically as a deal moves between Kanban columns — do not edit by hand.</div>
    <div class="mt-2 flex items-center gap-1.5 text-xs text-base-content/70"><span class="iconify lucide--pencil-line size-3.5 text-warning"></span>Not yet published to Airtable.</div>
    <div class="mt-2 flex flex-wrap items-center gap-1.5">
      <button class="btn btn-sm btn-primary gap-1.5"><span class="iconify lucide--upload-cloud size-3.5"></span>Publish to Airtable</button>
      <button class="btn btn-sm btn-ghost gap-1.5"><span class="iconify lucide--pencil size-3.5"></span>Edit</button>
      <button class="btn btn-sm btn-ghost gap-1.5 text-error ml-auto"><span class="iconify lucide--undo-2 size-3.5"></span>Discard changes</button>
    </div>
  </div>
</div>`,
      },
    ],
  },
  {
    id: 'pattern-annotation-field',
    group: 'Patterns',
    name: 'Annotation field (AI · draft → publish)',
    summary: 'Editable text that may be AI-generated, can be public or internal, and syncs to an external system through a draft → publish lifecycle.',
    description: `A reusable field for editable text that (1) may be AI-generated, (2) can carry a public / internal split, and (3) writes back to an external system through a <strong>draft → publish</strong> lifecycle. The Schema descriptions are the first instance; reuse it for any annotation that syncs.
<p style="margin:.6em 0 .3em"><strong>The placement hierarchy is the whole point</strong> — every helper has ONE fixed home, so two never collide:</p>
<ul>
<li><strong>Section heading — the draft flag, its single home.</strong> When the synced copy has unpublished edits, the <code>Draft</code> badge folds its "Not yet published to Airtable" explanation into <em>one</em> badge in the <em>Descriptions</em> heading — scannable at the top, and never repeated in the body (a duplicated status top-and-bottom is exactly what this avoids).</li>
<li><strong>The box — the value, and only the value, and it IS the edit target.</strong> Read text in place; <em>click it</em> (or focus + Enter) to drop straight into a generous textarea at the caret — no separate "Edit" button to gate it. A hover wash + a corner pencil signal it's editable. The scope caption, status line and actions are siblings <em>below</em> the box, never inside it.</li>
<li><strong>Below the value — scope caption.</strong> A quiet footnote for what the field IS (<code>Public · shown in Airtable</code> / <code>Internal · never synced</code>) — placed under the value as a note, not above it as a competing header. Persistent; independent of the content.</li>
<li><strong>Under the caption, above the actions — ONE status line, mutually exclusive.</strong> In edit mode it is the <em>AI disclaimer</em> ("AI-generated — review before publishing", or "…before saving" for a copy that doesn't sync); at rest, once published, the calm <em>Synced</em> confirmation. The draft state is up in the heading, so these never stack.</li>
<li><strong>Bottom — actions.</strong> Save / Regenerate / Cancel in edit; Publish / Edit / Discard at rest. The destructive one (Discard) is pushed to the right.</li>
<li><strong>Floating — confirmation.</strong> A transient success toast on Publish, auto-dismissed; it never takes layout space.</li>
</ul>
<p style="margin:.3em 0">Net result: a clean top-to-bottom read — heading flag · tabs (with a baseline rail, not floating labels) · the value box · then a scope caption and at most one status line below it — never a pile.</p>
<p style="margin:.3em 0"><strong>Prior art</strong> (what this is built from): AI generate + "review for accuracy" disclaimer — <a href="https://mobbin.com/screens/7ba222a6-6d42-4ce8-bf0e-318d7b3b10be" target="_blank" rel="noreferrer">Square</a>, <a href="https://mobbin.com/screens/4fc624ce-f25d-44d3-a7d3-a91431e1f455" target="_blank" rel="noreferrer">Udemy</a>; draft → publish + autosave — <a href="https://mobbin.com/screens/6d6146e2-2ea8-4aa0-b3fa-834fa6ce1812" target="_blank" rel="noreferrer">Patreon</a>, <a href="https://mobbin.com/screens/8d9e2bae-52f6-4212-a161-c6ffb980cdae" target="_blank" rel="noreferrer">X</a>, <a href="https://mobbin.com/screens/ff3e88cc-8049-4b72-a87f-75d207e7691c" target="_blank" rel="noreferrer">Intercom</a>; sync + overwrite / conflict copy — <a href="https://mobbin.com/screens/e3e51b42-ddc4-43f1-95b3-c0e53b9545c1" target="_blank" rel="noreferrer">Gorgias</a>, <a href="https://mobbin.com/screens/929f7005-277e-4550-ad43-2483745667ff" target="_blank" rel="noreferrer">Klaviyo</a>; Draft badge in a list — <a href="https://mobbin.com/screens/61e5af24-7c89-4d20-b859-0643a3dd139e" target="_blank" rel="noreferrer">Confluence</a>. Component: <code>components/schema/EntityPanel.astro</code>.`,
    reference: 'design:components/schema/EntityPanel.astro',
    showCode: false,
    usageDo: [
      'Give every helper one fixed home: the draft flag in the heading, the value in the box, the scope caption + one status line below it, actions at the bottom — so two helpers never collide.',
      'Give source tabs a full-width baseline rail with the active tab sitting on it — otherwise the labels read as floating text, not tabs.',
      'Make the value box itself the edit target (click → edit at the caret, plus focus + Enter); never gate editing behind a separate Edit button. Give the editor generous height.',
      'Keep the under-value slot single-occupancy: the AI disclaimer in edit mode, the sync status at rest, never both.',
      'Confirm a destructive sync (Publish) with a confirm step + a stale-warning when the remote drifted; celebrate success with a transient toast, not a permanent line.',
      'Show a paid action\'s cost on the button (e.g. "Generate · 10 credits"), and reuse this whole field for any write-back annotation so the lifecycle looks identical everywhere.',
      'When a button has a smaller cost/suffix (e.g. "10 credits"), wrap the label + suffix in ONE inline span so they share a baseline — never leave the suffix as a separate flex item beside the icon, or it drifts off-centre.',
    ],
    usageDont: [
      "Don't stack the identity caption, AI disclaimer, and sync status at once — that pile-up is exactly what this layout prevents.",
      "Don't bury the AI-credit cost in a tooltip, and don't make Publish a one-click destructive write (confirm it; warn on remote drift).",
      "Don't keep AI as a stored tab — it's a Generate action that seeds the field, not a third saved value.",
    ],
    examples: [
      {
        label: 'Edit mode — AI disclaimer owns the under-input slot',
        html: `
<div class="rounded-box border border-base-300 bg-base-100 p-4" style="max-width:460px">
  <div class="text-[11px] font-bold uppercase tracking-wide text-base-content/50">Descriptions</div>
  <!-- custom tab strip: a full-width baseline rail, the active tab sits ON it -->
  <div class="mt-1.5 flex gap-0.5 border-b border-base-300">
    <button class="-mb-px border-b-2 border-primary px-2.5 pb-2 pt-1.5 text-[12.5px] font-semibold">Airtable</button>
    <button class="-mb-px border-b-2 border-transparent px-2.5 pb-2 pt-1.5 text-[12.5px] font-medium text-base-content/60">Internal</button>
  </div>
  <!-- in edit mode the bordered textarea IS the field — no extra box around it -->
  <textarea class="textarea textarea-bordered textarea-sm w-full mt-3" rows="6">The contact’s role at their company.</textarea>
  <!-- scope caption — a footnote BELOW the value -->
  <div class="mt-2 flex items-center gap-1.5 px-0.5 text-[11.5px] text-base-content/60"><span class="iconify lucide--triangle-alert size-3.5 text-warning"></span>Shown to everyone in Airtable · the only synced copy.</div>
  <div class="mt-1.5 flex items-center gap-1.5 text-[11.5px] text-base-content/60"><span class="iconify lucide--sparkles size-3.5 text-primary"></span>AI-generated — review before publishing.</div>
  <div class="mt-2 flex items-center gap-1.5">
    <button class="btn btn-sm btn-primary gap-1.5"><span class="iconify lucide--check size-3.5"></span>Save</button>
    <button class="btn btn-sm btn-ghost gap-1.5 text-primary"><span class="iconify lucide--sparkles size-3.5"></span><span>Regenerate <span class="text-[11px] font-semibold opacity-65">10 credits</span></span></button>
    <button class="btn btn-sm btn-ghost ml-auto">Cancel</button>
  </div>
</div>`,
      },
      {
        label: 'At rest — sync status owns the same slot',
        html: `
<div class="rounded-box border border-base-300 bg-base-100 p-4" style="max-width:460px">
  <!-- the Draft flag folds its "not yet published" sentence into ONE badge, in the heading — its single home -->
  <div class="text-[11px] font-bold uppercase tracking-wide text-base-content/50">Descriptions
    <span class="badge badge-sm badge-warning badge-soft ml-1.5 gap-1 normal-case tracking-normal font-medium"><span class="iconify lucide--pencil-line size-3"></span>Draft — Not yet published to Airtable</span>
  </div>
  <!-- custom tab strip: a full-width baseline rail, the active tab sits ON it -->
  <div class="mt-1.5 flex gap-0.5 border-b border-base-300">
    <button class="-mb-px border-b-2 border-primary px-2.5 pb-2 pt-1.5 text-[12.5px] font-semibold">Airtable</button>
    <button class="-mb-px border-b-2 border-transparent px-2.5 pb-2 pt-1.5 text-[12.5px] font-medium text-base-content/60">Internal</button>
  </div>
  <!-- the box holds ONLY the value AND is the edit target: click it to edit (cursor: text, hover pencil) -->
  <div class="relative mt-3 cursor-text rounded-[9px] border border-base-300 bg-base-200/55 p-3">
    <div class="text-[13px] leading-relaxed">Current pipeline stage. Advances automatically as a deal moves between Kanban columns — do not edit by hand.</div>
    <span class="iconify lucide--pencil size-3.5 absolute right-2 top-1.5 text-base-content/40"></span>
  </div>
  <!-- scope caption — a footnote BELOW the box -->
  <div class="mt-2 flex items-center gap-1.5 px-0.5 text-[11.5px] text-base-content/60"><span class="iconify lucide--triangle-alert size-3.5 text-warning"></span>Shown to everyone in Airtable · the only synced copy.</div>
  <!-- actions — below the caption; NO Edit button (click the box to edit); draft status is in the heading -->
  <div class="mt-2 flex items-center gap-1.5">
    <button class="btn btn-sm btn-primary gap-1.5"><span class="iconify lucide--upload-cloud size-3.5"></span>Publish to Airtable</button>
    <button class="btn btn-sm btn-ghost gap-1.5 text-error ml-auto"><span class="iconify lucide--undo-2 size-3.5"></span>Discard changes</button>
  </div>
</div>`,
      },
    ],
  },
  {
    id: 'pattern-entity-typeahead',
    group: 'Patterns',
    name: 'Entity typeahead & tag chip',
    summary: 'One search-as-you-type control for entities, and the inline chip that references them.',
    description:
      'The same typeahead powers Browse global search/jump, the Docs "add tag" control, the inline Docs <code>@</code>-mention, and — since 2026-07-29 — the <a href="#pattern-base-picker">base picker</a>\'s search. It is an <a href="#input">Input</a> + a dropdown of matches <strong>grouped by kind</strong> (Bases / Tables / Fields), each row = the vendored field icon + name + parent path + a <a href="#status-dot">health dot</a>, with ↑/↓ + Enter keyboard nav and a key-hint footer. The <strong>tag chip</strong> is the entity identity rendered inline in a doc: a primary-tinted pill (type icon + name) that is clickable in both edit and reading mode and opens the <a href="#pattern-entity-panel">entity panel</a>; a chip whose entity was removed from Airtable flips to an error-tinted "no longer in schema" state instead of being silently dropped. Components: <code>components/schema/EntitySearch.astro</code> (emits <code>schema:searchInput</code> for filter-in-place and a pick event) + the chip in <code>SchemaDocs.astro</code>.<br><br><strong>It is a GENERIC typeahead now (2026-07-29).</strong> It used to be welded to <code>SchemaEntity</code> — kinds, icons, path lines and the health dot were all hard-coded in its client script — so a second surface that needed "one field, search everything, group the results" had no way in except a second hand-rolled typeahead. It takes <strong>pre-built rows</strong> instead: <code>items: TypeaheadItem[]</code> (<code>id · kind · name · path · icon</code> HTML · optional <code>health</code> · <code>hay</code> match string · <code>scopeKey</code>) plus <code>groups: [kind, label][]</code>, which is the ONE list that fixes both the visual order of the headings and the arrow-key order. Schema call sites are unchanged: passing <code>index</code> still maps <code>SchemaEntity</code> through <code>schema/typeaheadItems.ts</code> (<code>entityToTypeaheadItem</code> + <code>SCHEMA_TYPEAHEAD_GROUPS</code>), so the icon/path/health rules stay in one place and moved OFF the client (they are computed server-side now, and the client script no longer imports the Airtable field icons at all). Two more hooks: <code>pickHint</code> renames the footer\'s <code>↵</code> verb for hosts that do not "open" anything, and a host may set <code>root.dataset.esKinds</code> at runtime to drop whole kinds from the results — the picker uses it to make the <em>Workspaces</em> group simply ABSENT while the table is ungrouped (an empty group heading would be a worse lie than no heading). The older <code>root.dataset.esScopeBase</code> hook survives via <code>scopeKey</code>.<br><br><strong>Picking is the host\'s decision, not the component\'s.</strong> The component only clears the field, fires a real <code>input</code> event (so a host filtering in place un-filters in the same tick — dispatching only the synthetic <code>schema:searchInput</code> left the picker\'s table filtered under an empty box) and dispatches the host\'s <code>pickEvent</code> with the id. Browse opens a panel; the base picker scrolls to a row and ticks it. Do not push either meaning into the component.',
    reference: 'components/schema/EntitySearch.astro',
    showCode: false,
    usageDo: [
      'Reuse the one typeahead for every "find an entity" need (search, add-tag, @-mention, base picker) — feed it `items` + `groups` rather than forking it.',
      'Keep icon / path / haystack rules in a `.ts` sibling so they are computed once, server-side, and the client script stays generic.',
      'Group results by kind and show the parent path so the right entity is unambiguous.',
      'Render entity tags as identity chips (icon + name), clickable to the entity panel.',
      'Flag a removed entity on its chip; never silently drop a reference.',
    ],
    usageDont: [
      "Don't build a second bespoke entity search — extend this one.",
      "Don't store a name snapshot in a chip; store the id and render the live name.",
    ],
    examples: [
      {
        label: 'Typeahead dropdown (grouped) + inline tag chips',
        html: `
<div class="flex flex-wrap gap-6" style="padding:.5rem .25rem 1rem">
  <div style="width:264px" class="rounded-box border border-base-300 bg-base-100 p-1 shadow-lg text-sm">
    <div class="px-2 pb-0.5 pt-1.5 text-[10.5px] font-bold uppercase tracking-wide opacity-45">Tables</div>
    <div class="flex items-center gap-2 rounded-md px-2 py-1.5 bg-base-200"><span class="iconify lucide--table-2 size-3.5 opacity-75"></span><div class="min-w-0"><div class="font-medium">Agents</div><div class="text-[10.5px] text-base-content/50">Operations</div></div></div>
    <div class="px-2 pb-0.5 pt-1.5 text-[10.5px] font-bold uppercase tracking-wide opacity-45">Fields</div>
    <div class="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-base-200"><span class="iconify lucide--circle-dot size-3.5 opacity-75"></span><div class="min-w-0"><div class="font-medium">Stage</div><div class="text-[10.5px] text-base-content/50">Sales CRM ▸ Deals</div></div></div>
    <div class="mt-1 flex gap-3.5 border-t border-base-300 px-2.5 py-1.5 text-[11px] text-base-content/50"><span>↑↓ navigate</span><span>↵ open</span></div>
  </div>
  <div class="flex flex-col gap-3 text-sm">
    <div class="flex flex-wrap items-center gap-1.5">
      <span class="inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 font-medium" style="background:color-mix(in oklch,var(--color-primary) 10%,transparent);color:var(--color-primary);border-color:color-mix(in oklch,var(--color-primary) 22%,transparent)"><span class="iconify lucide--table-2 size-3"></span>Companies</span>
      <span class="inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 font-medium" style="background:color-mix(in oklch,var(--color-primary) 10%,transparent);color:var(--color-primary);border-color:color-mix(in oklch,var(--color-primary) 22%,transparent)"><span class="iconify lucide--circle-dot size-3"></span>Stage</span>
      <span class="inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 font-medium" style="background:color-mix(in oklch,var(--color-error) 9%,transparent);color:var(--color-error);border-color:color-mix(in oklch,var(--color-error) 25%,transparent)"><span class="iconify lucide--unlink size-3"></span>Legacy ID</span>
    </div>
    <span class="text-xs text-base-content/50">Default · field · removed (no longer in schema)</span>
  </div>
</div>`,
      },
    ],
  },
  {
    id: 'pattern-connection-health',
    group: 'Patterns',
    name: 'Connection-health banner',
    summary: 'App-wide warning when a source / destination connection breaks — plus its topbar pill.',
    description: `Surfaces a broken or at-risk connection (Airtable source, Drive / Dropbox destination) so a silently-failing backup can't go unnoticed, and flows the user back to a working state in one click. A graded state model (auth validity <em>plus</em> backup staleness) drives the colour, so we can warn before total silence. The full-width bar sits at the top of the work area, under the topbar, via the <code>app-banner</code> slot in <code>SidebarLayout</code>; collapsing a <em>broken</em> bar tucks it into a compact pill in the topbar next to the bell (it never silently disappears while broken). Warning and success states dismiss with an ×. Built from the daisyUI <code>alert</code> primitive plus our <code>Button</code> and Lucide icons; copy uses <code>*emphasis*</code> markers rendered bold. Live: <a href="/connection-banner">/connection-banner</a>.`,
    reference: 'components/patterns/ConnectionHealthBanner.astro · components/patterns/ConnectionHealthPill.astro',
    guides: [
      {
        title: 'State → colour',
        note: 'The state is the API; colour, icon and copy follow from it. Reserve loud red (broken) for a real auth failure that stopped backups; warn amber before total silence; debounce transient blips so we never cry wolf.',
        rows: [
          { token: 'broken · alert-error', use: 'Token revoked or expired — backups stopped. Source, destination, or a grouped roll-up when 2+ are down.', why: 'Highest urgency; collapses to a persistent topbar pill, never a silent dismiss.' },
          { token: 'expiring · alert-warning', use: 'Token TTL known and close — warn before it dies.', why: 'Proactive; fix it with zero interruption. Dismissible.' },
          { token: 'degraded · alert-warning', use: 'No successful backup in N hours, not yet a hard auth failure (auto-retrying).', why: 'Heads-up without alarming on a transient blip.' },
          { token: 'reconnecting · alert-info', use: 'Re-auth in progress — verifying access with named checks.', why: 'Transient progress; spinner, no action needed.' },
          { token: 'restored · alert-success', use: 'Verified, and the missed backup re-queued.', why: 'Positive confirmation in place; auto-dismiss.' },
        ],
      },
    ],
    props: [
      { name: 'state', type: "'broken' | 'expiring' | 'degraded' | 'reconnecting' | 'restored'", description: 'The graded health state — drives colour, icon, copy and behaviour.' },
      { name: 'provider', type: 'string', default: 'Airtable', description: 'Connection display name, shown bolded in the copy.' },
      { name: 'side', type: "'source' | 'destination'", default: 'source', description: 'Which side broke — shapes the broken copy.' },
      { name: 'count', type: 'number', default: '1', description: '>1 renders the grouped roll-up (broken only).' },
      { name: 'names', type: 'string[]', default: '[]', description: 'Connection names listed in the grouped roll-up.' },
      { name: 'lastBackup', type: 'string', description: 'e.g. "2 days ago" — appended to broken-source copy.' },
      { name: 'daysToExpiry', type: 'number', default: '5', description: 'Days remaining, used by the expiring state.' },
      { name: 'reconnectHref', type: 'string', default: '#', description: 'Where the Reconnect CTA points.' },
      { name: 'collapsible', type: 'boolean', default: 'true (broken)', description: 'Show the collapse chevron that tucks the bar into the topbar pill.' },
      { name: 'bleed', type: 'boolean', default: 'false', description: 'Full-bleed bar (no side / top radius) for the app-shell slot; a rounded card otherwise.' },
      { name: 'group', type: 'string', default: 'main', description: 'Ties a collapsible bar to its topbar pill (same group string).' },
    ],
    usageDo: [
      'Lead with the consequence and a single verb CTA ("Backups paused. Reconnect.").',
      'Keep one bar at a time — roll 2+ broken connections into the grouped variant.',
      'Use the bleed bar in the SidebarLayout app-banner slot; let a broken bar collapse to the topbar pill.',
      'Give the icon a soft tinted chip; keep the close / collapse control a neutral grey.',
    ],
    usageDont: [
      "Don't let a broken bar be dismissed outright — it collapses to the topbar pill and stays until resolved.",
      "Don't colour the collapse / dismiss icon button (a ghost inherits red here) — force the neutral grey.",
      "Don't stack multiple bars; roll them up instead.",
      "Don't promise “expires in N days” unless the provider token API actually exposes a TTL.",
    ],
    examples: [
      {
        label: 'State → colour (the graded model)',
        html: `
<div class="flex flex-col gap-2">
  <div role="alert" class="alert alert-soft alert-error flex items-center gap-3">
    <span class="grid size-8 shrink-0 place-items-center rounded-lg bg-error/15 text-error"><span class="iconify lucide--triangle-alert icon-md"></span></span>
    <div class="min-w-0 flex-1"><div class="font-semibold leading-snug">Backups paused: your <strong>Airtable</strong> connection expired.</div></div>
    <a class="btn btn-primary btn-sm gap-1.5"><span class="iconify lucide--refresh-cw icon-sm"></span>Reconnect</a>
  </div>
  <div role="alert" class="alert alert-soft alert-warning flex items-center gap-3">
    <span class="grid size-8 shrink-0 place-items-center rounded-lg bg-warning/15 text-warning"><span class="iconify lucide--clock icon-md"></span></span>
    <div class="min-w-0 flex-1"><div class="font-semibold leading-snug">Your <strong>Google Drive</strong> connection expires in <strong>5 days</strong>.</div></div>
    <a class="btn btn-neutral btn-sm gap-1.5"><span class="iconify lucide--refresh-cw icon-sm"></span>Reconnect</a>
  </div>
  <div role="alert" class="alert alert-soft alert-info flex items-center gap-3">
    <span class="grid size-8 shrink-0 place-items-center rounded-lg bg-info/15 text-info"><span class="iconify lucide--refresh-cw icon-md animate-spin"></span></span>
    <div class="min-w-0 flex-1"><div class="font-semibold leading-snug">Reconnecting <strong>Airtable</strong>…</div></div>
  </div>
  <div role="alert" class="alert alert-soft alert-success flex items-center gap-3">
    <span class="grid size-8 shrink-0 place-items-center rounded-lg bg-success/15 text-success"><span class="iconify lucide--circle-check icon-md"></span></span>
    <div class="min-w-0 flex-1"><div class="font-semibold leading-snug">Connection restored. Backups are running again.</div></div>
    <button class="btn btn-ghost btn-sm btn-square text-base-content/55 hover:text-base-content" aria-label="Dismiss"><span class="iconify lucide--x icon-md"></span></button>
  </div>
</div>`,
      },
      {
        label: 'Broken — full anatomy (icon chip · bold copy · primary Reconnect · neutral collapse)',
        html: `
<div role="alert" class="alert alert-soft alert-error flex items-center gap-3">
  <span class="grid size-8 shrink-0 place-items-center rounded-lg bg-error/15 text-error"><span class="iconify lucide--triangle-alert icon-md"></span></span>
  <div class="min-w-0 flex-1">
    <div class="font-semibold leading-snug text-base-content">Backups paused: your <strong>Airtable</strong> connection expired.</div>
    <div class="mt-0.5 text-sm text-base-content/70">Nothing is being backed up until you reconnect. Last successful backup: <strong>2 days ago</strong>.</div>
  </div>
  <div class="flex shrink-0 items-center gap-1.5">
    <a class="btn btn-primary btn-sm gap-1.5"><span class="iconify lucide--refresh-cw icon-sm"></span>Reconnect</a>
    <button class="btn btn-ghost btn-sm btn-square text-base-content/55 hover:text-base-content" aria-label="Collapse to topbar"><span class="iconify lucide--chevron-up icon-md"></span></button>
  </div>
</div>`,
      },
      {
        label: 'Grouped roll-up — 2+ connections down',
        html: `
<div role="alert" class="alert alert-soft alert-error flex items-center gap-3">
  <span class="grid size-8 shrink-0 place-items-center rounded-lg bg-error/15 text-error"><span class="iconify lucide--triangle-alert icon-md"></span></span>
  <div class="min-w-0 flex-1">
    <div class="font-semibold leading-snug text-base-content">3 connections need attention. Backups are paused.</div>
    <div class="mt-0.5 text-sm text-base-content/70"><strong>Airtable</strong>, <strong>Google Drive</strong> and <strong>Dropbox</strong> have stopped working. Reconnect them to get backups running again.</div>
  </div>
  <a class="btn btn-primary btn-sm shrink-0">Review connections</a>
</div>`,
      },
      {
        label: 'Collapsed — the topbar pill (sits next to the bell; ghost Reconnect)',
        html: `
<div class="flex items-center justify-end gap-2 rounded-box border border-base-300 bg-base-100 px-3 py-2">
  <span class="alert alert-soft alert-error inline-flex w-fit items-center gap-2 rounded-full py-1 ps-2.5 pe-1">
    <span class="inline-flex items-center gap-1.5 text-sm font-medium">
      <span class="grid size-5 shrink-0 place-items-center rounded-md bg-error/15 text-error"><span class="iconify lucide--triangle-alert icon-xs"></span></span>
      Airtable needs reconnecting
    </span>
    <a class="btn btn-ghost btn-sm gap-1.5"><span class="iconify lucide--refresh-cw icon-sm"></span>Reconnect</a>
  </span>
  <button class="btn btn-circle btn-ghost btn-sm" aria-label="Notifications"><span class="iconify lucide--bell icon-lg"></span></button>
</div>`,
      },
    ],
  },
  {
    id: 'pattern-inbox',
    group: 'Patterns',
    name: 'Inbox (notification center)',
    summary: 'A non-modal, single-column side panel that overlays the work area — two lanes, rolled-up successes, self-healing alerts.',
    description: `The single home for every alert: backup finished / failed, schema changed (with breaking flags), health score dropped, a connection needs reconnecting, an automation turned off, a chat answer saved as a doc. Opens from the <strong>Inbox item at the top of the sidebar</strong> (account-scoped, above the Space groups) and slides in as a column over the left edge of the work area. It <strong>overlays</strong> the page rather than pushing it: sidebar (256px) + panel (352px) = <strong>608px of chrome</strong>, so pushing only left room for a ~970px table above a ~1580px viewport — measured at 1280px, opening a pushing panel hid <strong>339px</strong> of the Backups table behind a horizontal scroll. Overlay keeps the page's own layout untouched at every width. It is <strong>non-modal</strong>: no scrim, no focus trap, no <code>role="dialog"</code> — the page behind stays interactive wherever it is still visible, so it inherits the <a href="#pattern-multi-panel-drawer">multi-panel drawer</a>'s stance (the <a href="#drawer">Drawer</a> primitive is the wrong base here — it ships a scrim). <strong>Two lanes in one scroll:</strong> <em>Needs attention</em> (a decision is required) above <em>Activity</em> (FYI), because a flat list — Linear's documented weakness — buries the one row that matters. <strong>Successes roll up per base</strong> ("<em>Sales CRM</em> — 3 backups completed", expandable); failures, breaking schema changes and reconnect <strong>never</strong> roll up. <strong>State-backed rows self-heal</strong>: reconnect and health are bound to live state, so completing the reconnect resolves the row <em>and</em> clears the <a href="#pattern-connection-health">connection banner</a>, silently — no "it's fixed!" row is minted (Datadog→PagerDuty's default). Event rows (a backup that failed) are acknowledge-based: a later success does not un-happen the failure. Row anatomy follows Vercel's alert row — icon chip, bolded entity, terse copy, right-aligned stamp. <strong>Styling rulings (Oleh 2026-07-23):</strong> (1) <strong>No panel shadow.</strong> The panel is separated by its 1px <code>base-300</code> border alone — per <a href="#elevation">Elevation</a>, shadows belong to popovers and dialogs, and the theme ships <code>--depth: 0</code>. The old <code>box-shadow</code> derived its colour from <code>--color-base-content</code>, which INVERTS with the theme, so on dark it rendered a 32px white glow. Never derive a shadow from a foreground token. (2) <strong>The Space label is an <a href="#entity-chip">entity chip</a>, not a badge</strong> — a Space is an entity reference, and the chip's rounded-full bordered shape is what keeps it visually distinct from the row's action button. (3) <strong>Neutral badges here are <code>badge-ghost</code></strong> (the tab counts, the Handled count, the Done/Snoozed/Resolved state) — <code>badge-soft badge-neutral</code> is banned, see <a href="#badge">Badge</a>. (4) The row action keeps to the documented button ladder; the chip must never share the action's fill recipe, because <code>btn-soft</code> and <code>badge-soft</code> are the same 8%/10% <code>color-mix</code> at the same radius and font-size — that identity was the whole "which one is clickable?" bug. Researched in <code>research/notifications-inbox/</code>.`,
    reference: 'components/layout/Inbox.astro · inbox.ts · inbox-client.ts',
    showCode: false,
    guides: [
      {
        title: 'Which surface does a signal go to?',
        note: 'We own three: a toast, this inbox, and the connection banner. The test is mechanical — if it carries a decision it cannot be a toast, because a toast is a passive live region that auto-dismisses. Reserve the banner for exactly one thing, or it stops meaning "act now".',
        rows: [
          { token: 'Toast', use: 'Transient confirmation of the user\'s own action — setting saved, export run, chat answer saved as a doc.', why: 'Auto-dismisses, moves no focus. Never carries a decision.' },
          { token: 'Inbox · Needs attention', use: 'Backup failed · connection needs reconnect · breaking schema change · health score crossed a threshold.', why: 'Persistent, actionable, deep-links. The record you triage.' },
          { token: 'Inbox · Activity', use: 'Backup succeeded (rolled up) · non-breaking schema change · automation turned off · interface unpublished.', why: 'FYI. Visually quieter, never competes with the lane above.' },
          { token: 'Connection banner', use: 'ONLY a broken/blocking connection that undermines "is it working right now".', why: 'The loudest surface. Let health dips or schema drift in and it stops meaning act-now.' },
        ],
      },
      {
        title: 'Filtering — Activity only, never Needs attention',
        note: 'The panel has two perpendicular axes: "have I seen it" (read/unread) and "is it closed" (attention/handled). Slack only has the first, so a global Unread toggle is safe there. We have both — and a read row is not a resolved row. So a filter on the read axis is scoped to Activity, where the volume actually is.',
        rows: [
          { token: 'All / New (Activity)', use: 'The volume valve for a lane that grows daily. Default = All.', why: 'A filter must be something the user turned on, never a reason they failed to see a row.' },
          { token: 'Show handled (Needs attention)', use: 'Reveals done / snoozed / self-resolved rows — in the lane that produced them.', why: 'You triage what needs attention; you do not "finish" the news that a backup ran. Also the Undo for a mis-clicked Done.' },
          { token: 'Row controls', use: 'Attention → Done + Snooze. Activity → Mute this base. Nothing else.', why: 'Activity rows are facts, not tasks. Offering Done there invents a state the row never had.' },
          { token: 'Needs attention', use: 'Never filtered by read state. The tab count is always visible, active tab or not.', why: 'It is small by construction. Hiding an unresolved row would sell silence as safety.' },
          { token: 'Mark all read', use: 'Touches ACTIVITY ONLY.', why: 'Otherwise "Mark all read" → "New" empties the panel while backups are stopped. Two clicks, both muscle-memory from Slack.' },
        ],
      },
      {
        title: 'Read · Done · Resolved',
        note: 'Three distinct states. Keeping read separate from done is what lets an inbox behave as a task list rather than a feed (GitHub decouples them; Linear does not).',
        rows: [
          { token: 'read', use: 'Set when the row is opened. Toggle with U.', why: 'Read ≠ resolved. A read "reconnect!" is still broken.' },
          { token: 'done', use: 'User acknowledges an event row (a past failure). Key: E.', why: 'A later success does not un-happen a failure — only the user clears it.' },
          { token: 'resolved', use: 'Set by the system when a state-backed row\'s state clears. It stays in its own lane, behind Show handled.', why: 'Self-healing. Resolve silently; show a quiet Resolved state, do not mint a new row — and never demote a connection matter into Activity, where it would read as news.' },
          { token: 'snoozed', use: 'Hidden until a chosen time; resurfaces early on new activity.', why: 'For non-urgent rows. Linear\'s model.' },
        ],
      },
    ],
    props: [
      { name: 'items', type: 'InboxItem[]', default: '[]', description: 'The rows. Lane, icon and chip are derived from `kind` via KIND_META — never passed in.' },
      { name: 'width', type: 'string', default: "'22rem'", description: 'Column width, via the `--ibx-w` custom property.' },
    ],
    usageDo: [
      'Overlay the work area — never push it narrower. Pushing costs 608px of chrome and clips data tables on any laptop under ~1580px. The panel is still non-modal: no scrim, do not trap focus, do not steal focus on open, and do not give it role="dialog".',
      'Two tabs, not a vertical stack: <strong>Needs attention</strong> (task icon) and <strong>Activity</strong> (bell). Each carries its own count badge, and <strong>both counts stay visible on the INACTIVE tab</strong> — that is the condition under which tabs are allowed here at all, since a tab must never hide a broken connection (see the <a href="#tabs">Tabs</a> entry). Attention counts what you must FIX (red); Activity counts what you have not READ (neutral). Prefer a number over a bare dot: "something broke" and "three things broke" are different decisions.',
      'Roll up successes per base; keep failures, breaking schema changes and reconnect standalone.',
      'Give every row a deep-link to the exact surface, and an inline action only where the user can resolve it from here (Reconnect · View log · Review diff).',
      'Keep the panel a SINGLE column. The deep-link target IS the detail view, and it is the only place the user can act (re-run a backup, reconnect, review the diff). An in-panel reading pane restates that surface worse and gives the same information two homes.',
      'Announce arrivals through a polite live region; reserve assertive for a failed backup or a broken connection.',
      'Hover reveals per-row triage (done · snooze · mute this base); mark-all-read stays always visible in the header.',
    ],
    usageDont: [
      "Don't notify about expected states — a queued or routine run is silent by default.",
      "Don't emit a notification when something recovers. Resolve the existing row silently instead.",
      "Don't let a rolled-up group hide a failure — only successes and non-breaking changes may roll up.",
      "Don't mark a state-backed row done on the user's behalf; let the state clear it.",
      "Don't reuse the Drawer primitive — its scrim makes the panel modal, which is the opposite of this pattern.",
      "Don't add an expand-to-two-pane reading view or a separate /inbox page. Both were built and cut: the reading pane duplicated the deep-link target, and the archive page duplicated `Show handled` without adding search, type/base filters or date grouping. Our alert volume does not earn a second surface.",
    ],
    examples: [
      {
        label: 'Two lanes — attention above activity',
        html: `
<div class="w-full max-w-sm rounded-box border border-base-300 bg-base-100">
  <header class="flex items-center gap-2 border-b border-base-300 px-4 py-3">
    <h3 class="grow font-semibold">Inbox</h3>
    <button class="btn btn-ghost btn-sm btn-square" aria-label="Mark all read"><span class="iconify lucide--check-check size-4"></span></button>
  </header>
  <p class="px-4 pt-3 pb-1 text-[11px] font-bold uppercase tracking-wider text-base-content/50">Needs attention</p>
  <div class="flex items-start gap-3 px-4 py-3 hover:bg-base-200/50">
    <span class="mt-0.5 grid size-7 shrink-0 place-items-center rounded-lg bg-error/10 text-error"><span class="iconify lucide--unplug size-4"></span></span>
    <div class="min-w-0 flex-1">
      <p class="text-sm leading-snug"><strong>Airtable</strong> needs reconnecting — backups are paused.</p>
      <button class="btn btn-neutral btn-sm mt-2 gap-1.5"><span class="iconify lucide--refresh-cw size-4"></span>Reconnect</button>
    </div>
    <span class="shrink-0 text-xs text-base-content/50">2h</span>
  </div>
  <div class="flex items-start gap-3 px-4 py-3 hover:bg-base-200/50">
    <span class="mt-0.5 grid size-7 shrink-0 place-items-center rounded-lg bg-error/10 text-error"><span class="iconify lucide--triangle-alert size-4"></span></span>
    <div class="min-w-0 flex-1"><p class="text-sm leading-snug"><strong>Sales CRM</strong> backup failed — 3 of 12 bases incomplete.</p></div>
    <span class="shrink-0 text-xs text-base-content/50">5h</span>
  </div>
  <p class="border-t border-base-300 px-4 pt-3 pb-1 text-[11px] font-bold uppercase tracking-wider text-base-content/50">Activity</p>
  <div class="flex items-start gap-3 px-4 py-3 hover:bg-base-200/50">
    <span class="mt-0.5 grid size-7 shrink-0 place-items-center rounded-lg bg-success/10 text-success"><span class="iconify lucide--archive size-4"></span></span>
    <div class="min-w-0 flex-1">
      <p class="text-sm leading-snug text-base-content/70"><strong>Marketing Ops</strong> — 3 backups completed</p>
      <button class="mt-1 inline-flex items-center gap-1 text-xs text-base-content/50 hover:text-base-content"><span class="iconify lucide--chevron-right size-3.5"></span>Show runs</button>
    </div>
    <span class="shrink-0 text-xs text-base-content/50">6h</span>
  </div>
</div>`,
      },
      {
        label: 'Resolved — a state-backed row that healed itself (silent, no new row)',
        html: `
<div class="flex w-full max-w-sm items-start gap-3 rounded-box border border-base-300 bg-base-100 px-4 py-3">
  <span class="mt-0.5 grid size-7 shrink-0 place-items-center rounded-lg bg-success/10 text-success"><span class="iconify lucide--circle-check size-4"></span></span>
  <div class="min-w-0 flex-1">
    <p class="text-sm leading-snug text-base-content/60 line-through decoration-base-content/30"><strong>Airtable</strong> needs reconnecting</p>
    <p class="mt-0.5 text-xs text-base-content/50">Resolved — connection restored</p>
  </div>
</div>`,
      },
    ],
  },

  // ── Local-only entries (monorepo) — kept across syncs per shared/internal/ui-sync.md §2
  // (storybook.ts standing exception: upstream skeleton + these 11, reconciled every sync). ──
  {
    id: 'avatar',
    group: 'Primitives',
    name: 'Avatar',
    summary: 'daisyUI avatar — user and organization identity at small sizes.',
    reference: 'components/ui/Avatar.astro',
    props: [
      { name: 'src', type: 'string', description: 'Optional image URL.' },
      { name: 'name', type: 'string', description: 'Fallback name used for initials.' },
      { name: 'size', type: "'sm' | 'md' | 'lg'", default: "'md'", description: 'Display size.' },
    ],
    usageDo: ['Use for people, Organizations, and Spaces when an identity marker helps scanning.', 'Prefer initials over decorative icons when no image is available.'],
    usageDont: ['Do not use Avatar as generic decoration.', 'Do not hand-roll initials chips in views.'],
    examples: [
      {
        html: `
<div class="flex items-center gap-3">
  <div class="avatar placeholder"><div class="w-8 rounded-full bg-base-300 text-base-content"><span>RS</span></div></div>
  <div class="avatar placeholder"><div class="w-10 rounded-full bg-primary text-primary-content"><span>BO</span></div></div>
  <div class="avatar placeholder"><div class="w-12 rounded-full bg-base-200 text-base-content"><span>DS</span></div></div>
</div>`,
      },
    ],
  },
  {
    id: 'back-link',
    group: 'Primitives',
    name: 'Back link',
    summary: 'Standard low-emphasis return link for detail and setup pages.',
    reference: 'components/ui/BackLink.astro',
    props: [
      { name: 'href', type: 'string', default: 'required', description: 'Destination URL.' },
      { name: 'label', type: 'string', default: "'Back'", description: 'Visible link label.' },
    ],
    usageDo: ['Use above detail headers and setup forms.', 'Keep the label specific: Back to sources, Back to backups.'],
    usageDont: ["Don't use a primary button for back navigation.", "Don't repeat custom arrow-link CSS in views."],
    examples: [
      {
        html: `
<a href="/sources" class="inline-flex items-center gap-2 text-sm font-medium text-base-content/65 hover:text-primary">
  <span class="iconify lucide--arrow-left size-4"></span>
  <span>Back to sources</span>
</a>`,
      },
    ],
  },
  {
    id: 'create-space-modal',
    group: 'Patterns',
    name: 'CreateSpaceModal',
    summary: 'Product pattern for creating a Space from the shell.',
    reference: 'components/ui/CreateSpaceModal.astro',
    description:
      'A behavior-bearing modal pattern built from daisyUI dialog, Button, and TextInput. Storybook documents structure; apps/design validates real interaction.',
    usageDo: ['Use the shared modal for Space creation from the sidebar or setup flows.', 'Keep validation and loading behavior aligned with the real app flow.'],
    usageDont: ['Do not create page-specific Space creation dialogs.', 'Do not use for unrelated forms.'],
    examples: [
      {
        html: `
<button class="btn btn-primary btn-sm">Create Space</button>
<div class="mt-3 rounded-box border border-base-300 bg-base-100 p-4 text-sm text-base-content/70">
  Modal pattern: title, Space name field, Cancel, Create.
</div>`,
      },
    ],
  },
  {
    id: 'divider',
    group: 'Primitives',
    name: 'Divider',
    summary: 'daisyUI divider — separates groups when spacing alone is not enough.',
    reference: 'components/ui/Divider.astro',
    guides: [
      {
        title: 'When to use',
        default: 'subtle',
        rows: [
          { token: 'subtle', use: 'Split dense forms, settings groups, or modal sections.', why: 'Adds structure without visual noise.' },
          { token: 'labeled', use: 'Auth or onboarding alternatives like “or continue with”.', why: 'Text labels explain the separation.' },
        ],
      },
    ],
    examples: [
      {
        html: `
<div class="space-y-3">
  <p class="text-sm text-base-content/70">Primary section</p>
  <div class="divider my-1"></div>
  <p class="text-sm text-base-content/70">Secondary section</p>
</div>`,
      },
      { label: 'Labeled', html: `<div class="divider">or</div>` },
    ],
  },
  {
    id: 'empty-state',
    group: 'Primitives',
    name: 'Empty state',
    summary: 'Dashed placeholder surface for no-data and no-match states.',
    reference: 'components/ui/EmptyState.astro',
    props: [
      { name: 'icon', type: 'string', default: "'lucide--inbox'", description: 'Iconify class for the empty-state symbol.' },
      { name: 'title', type: 'string', default: 'required', description: 'Short state headline.' },
      { name: 'description', type: 'string', default: '—', description: 'Supporting copy.' },
      { name: 'actionHref/actionLabel', type: 'string', default: '—', description: 'Optional primary CTA.' },
      { name: 'compact', type: 'boolean', default: 'false', description: 'Tighter padding for embedded no-match states.' },
    ],
    usageDo: ['Use for first-run empty registries, empty backup lists, and no-match filter states.', 'Keep the CTA aligned to the next useful action.'],
    usageDont: ["Don't use an empty state for errors — use Alert.", "Don't hide setup blockers in empty-state copy."],
    examples: [
      {
        html: `
<section class="rounded-box border border-dashed border-base-300 bg-base-100 p-10 text-center">
  <span class="iconify lucide--database mx-auto size-10 text-base-content/35"></span>
  <h2 class="mt-4 text-lg font-semibold text-base-content">No backups yet</h2>
  <p class="mx-auto mt-2 max-w-xl text-sm text-base-content/60">Run your first backup to start building an audit trail for this Space.</p>
  <a href="/backups/run" class="btn btn-primary mt-5">Run backup now</a>
</section>`,
      },
    ],
  },
  {
    id: 'page-header',
    group: 'Primitives',
    name: 'Page header',
    summary: 'Standard page title, description, metadata, and action cluster.',
    reference: 'components/ui/PageHeader.astro',
    props: [
      { name: 'title', type: 'string', default: 'required', description: 'Primary page or detail title.' },
      { name: 'description', type: 'string', default: '—', description: 'Short supporting copy below the title.' },
      { name: 'eyebrow', type: 'string', default: '—', description: 'Optional context label above the title.' },
      { name: 'backHref', type: 'string', default: '—', description: 'Renders the shared BackLink above the heading.' },
      { name: 'slot:meta', type: 'slot', default: '—', description: 'Badges and compact metadata under the description.' },
      { name: 'slot:actions', type: 'slot', default: '—', description: 'Right-aligned page actions.' },
    ],
    usageDo: ['Use for list, detail, and setup pages before hand-rolling title/action rows.', 'Keep one primary action in the actions slot.'],
    usageDont: ["Don't duplicate page title/action clusters directly in views.", "Don't put large content blocks in the meta slot."],
    examples: [
      {
        html: `
<header class="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
  <div>
    <p class="text-xs font-semibold uppercase tracking-[0.18em] text-base-content/50">Space</p>
    <h1 class="text-2xl font-bold tracking-tight text-base-content">Backups</h1>
    <p class="mt-1 max-w-2xl text-sm text-base-content/60">Review run history, failures, and captured data depth.</p>
  </div>
  <a href="/backups/run" class="btn btn-primary">Run backup now</a>
</header>`,
      },
    ],
  },
  {
    id: 'pattern-app-shell',
    group: 'Patterns',
    name: 'Application shell',
    summary: 'The authenticated app frame: sidebar, header, navigation, and current-space chrome.',
    reference: 'components/patterns/AppShellHeader.astro · components/patterns/AppShellSidebar.astro',
    showCode: false,
    description:
      'The app shell is a product composition, not a primitive: it owns current Organization / Space context, navigation affordances, account actions, and responsive drawer behavior. Reuse Button, Avatar, Badge, and Drawer markup inside it, but keep the shell itself cataloged as a pattern. Live: <a href="/">Home</a>.',
    usageDo: ['Keep navigation labels aligned to the canonical product naming dictionary.', 'Reuse catalog primitives for user identity, actions, and status indicators.'],
    usageDont: ["Don't clone shell navigation inside individual views.", "Don't turn the whole shell into a generic ui primitive."],
    examples: [
      {
        html: `
<div class="rounded-box border border-base-300 bg-base-100 p-4">
  <div class="flex items-center justify-between gap-4">
    <div>
      <div class="text-sm font-semibold">Baseout</div>
      <div class="text-xs text-base-content/55">Acme Ops / Production Space</div>
    </div>
    <span class="badge badge-soft badge-success badge-sm">Active</span>
  </div>
  <div class="mt-4 grid gap-2 text-sm text-base-content/70 sm:grid-cols-4">
    <span class="rounded-box bg-base-200 px-3 py-2">Home</span>
    <span class="rounded-box bg-base-200 px-3 py-2">Sources</span>
    <span class="rounded-box bg-base-200 px-3 py-2">Destinations</span>
    <span class="rounded-box bg-base-200 px-3 py-2">Backups</span>
  </div>
</div>`,
      },
    ],
  },
  {
    id: 'pattern-changelog-feed',
    group: 'Patterns',
    name: 'Changelog feed',
    summary: 'A day-grouped feed of typed change entries — kind badge, breadcrumb, before→after delta, warning line.',
    description:
      'The Schema Changelog shape (web-schema-changelog, vanilla-in-view): entries group under a <strong>day heading</strong> (date + count), each row leading with a <strong>kind badge</strong> (Added <code>badge-success</code> · Removed <code>badge-warning</code> · Renamed <code>badge-info</code> · Type changed <code>badge-secondary</code> · Config <code>badge-ghost</code>), then a <strong>base ▸ table ▸ entity breadcrumb</strong> (quiet concept icons + chevron separators), an optional muted <strong>before → after</strong> delta, and — for changes that may have broken data — a full-width <strong>warning line</strong> (<code>lucide--triangle-alert</code> + <code>text-warning</code>; the real-warning-only icon rule from the detail-panel pattern). The toolbar above it is base/kind <a href="#select">Selects</a>, an include-removed <a href="#checkbox-toggle">Toggle</a>, and a search <a href="#input">Input</a>. Names render client-side from the SSR schema index — the engine feed carries identifiers, not display strings. The richer design treatment (faceted filters, export, entry detail panel) lives in the ui-only SchemaChangelog component and lands as follow-ups. Live: <a href="/schema">Schema → Changelog</a>.',
    reference: 'views/schema/ChangelogTab.astro',
    showCode: false,
    usageDo: [
      'Group by calendar day and keep entries date-descending — the feed answers “what changed lately”.',
      'Reserve the ⚠️ warning line for breaks-data changes only (field type changes) — it must stay unmissable.',
      'Show before → after for every modification; a rename without the old name is useless for triage.',
    ],
    usageDont: [
      "Don't colour every badge — Config stays ghost so Removed/Type-changed carry the signal.",
      "Don't hide removal entries by default — the include-removed toggle starts ON; removals are half the feed's value.",
    ],
    examples: [
      {
        html: `
<div class="space-y-6">
  <div>
    <h3 class="mb-2 text-sm font-semibold text-base-content">Jul 8, 2026 <span class="text-base-content/40">(2)</span></h3>
    <ul class="space-y-2">
      <li class="flex flex-wrap items-center gap-2 rounded border border-base-300/60 px-3 py-2"><span class="badge badge-sm badge-secondary">Type changed</span><span class="flex flex-wrap items-center gap-1 font-medium text-base-content"><span class="inline-flex items-center gap-1"><span class="iconify lucide--database size-3.5 opacity-50"></span>Sales CRM</span><span class="iconify lucide--chevron-right size-3 opacity-40"></span><span class="inline-flex items-center gap-1"><span class="iconify lucide--table-2 size-3.5 opacity-50"></span>Deals</span><span class="iconify lucide--chevron-right size-3 opacity-40"></span><span class="inline-flex items-center gap-1"><span class="iconify lucide--tag size-3.5 opacity-50"></span>Amount</span></span><span class="text-xs text-base-content/60">singleLineText <span class="opacity-50">→</span> number</span><span class="mt-1 flex w-full items-center gap-1.5 text-xs text-warning"><span class="iconify lucide--triangle-alert size-3.5"></span>This change may have broken existing data.</span></li>
      <li class="flex flex-wrap items-center gap-2 rounded border border-base-300/60 px-3 py-2"><span class="badge badge-sm badge-info">Renamed</span><span class="flex flex-wrap items-center gap-1 font-medium text-base-content"><span class="inline-flex items-center gap-1"><span class="iconify lucide--database size-3.5 opacity-50"></span>Sales CRM</span><span class="iconify lucide--chevron-right size-3 opacity-40"></span><span class="inline-flex items-center gap-1"><span class="iconify lucide--table-2 size-3.5 opacity-50"></span>Deals</span><span class="iconify lucide--chevron-right size-3 opacity-40"></span><span class="inline-flex items-center gap-1"><span class="iconify lucide--tag size-3.5 opacity-50"></span>Close date</span></span><span class="text-xs text-base-content/60">Closed on <span class="opacity-50">→</span> Close date</span></li>
    </ul>
  </div>
  <div>
    <h3 class="mb-2 text-sm font-semibold text-base-content">Jul 5, 2026 <span class="text-base-content/40">(1)</span></h3>
    <ul class="space-y-2">
      <li class="flex flex-wrap items-center gap-2 rounded border border-base-300/60 px-3 py-2"><span class="badge badge-sm badge-warning">Removed</span><span class="flex flex-wrap items-center gap-1 font-medium text-base-content"><span class="inline-flex items-center gap-1"><span class="iconify lucide--database size-3.5 opacity-50"></span>Sales CRM</span><span class="iconify lucide--chevron-right size-3 opacity-40"></span><span class="inline-flex items-center gap-1"><span class="iconify lucide--table-2 size-3.5 opacity-50"></span>Old Projects</span></span></li>
    </ul>
  </div>
</div>`,
      },
    ],
  },
  {
    id: 'pattern-entity-detail',
    group: 'Patterns',
    name: 'Entity detail',
    summary: 'Shared title, status, metadata, and action structure for source/destination detail pages.',
    reference: 'components/patterns/EntityDetailHeader.astro · components/patterns/DefinitionList.astro · views/SourceDetailView.astro · views/DestinationDetailView.astro',
    showCode: false,
    description:
      'Source and Destination detail pages share the same composition: a BackLink, title, soft status badge, one primary recovery action, secondary edit action, and definition-list metadata panels. The structure is a product pattern because each entity still owns its domain fields.',
    usageDo: ['Use soft Badge status metadata and one primary recovery action.', 'Use DefinitionList for term/value metadata blocks.'],
    usageDont: ["Don't rebuild detail headers per entity.", "Don't use raw paragraphs for term/value metadata when DefinitionList fits."],
    examples: [
      {
        html: `
<div class="space-y-4 rounded-box border border-base-300 bg-base-100 p-4">
  <a href="/sources" class="inline-flex items-center gap-2 text-sm font-medium text-base-content/65"><span class="iconify lucide--arrow-left size-4"></span>Back to sources</a>
  <div class="flex items-start justify-between gap-4">
    <div>
      <h2 class="text-2xl font-bold tracking-tight">Airtable production</h2>
      <p class="mt-1 text-sm text-base-content/60">Airtable · OAuth · ops@example.com</p>
      <span class="badge badge-soft badge-warning mt-3"><span class="size-1.5 rounded-full bg-current"></span>Reconnect required</span>
    </div>
    <button class="btn btn-primary">Reconnect</button>
  </div>
</div>`,
      },
    ],
  },
  {
    id: 'pattern-schema-canvas',
    group: 'Patterns',
    name: 'Schema canvas (Visualize)',
    summary: 'The React Flow diagram island — mode switch, faceted toolbar, typed nodes/edges, mode-aware legend.',
    description:
      'The Visualize tab (web-schema-visualize): a React island (the React carve-out — an interactive node-graph daisyUI cannot express) hosted by a thin Astro view. Three modes on one canvas via a <strong>segmented mode switch</strong> (Data ER diagram · Relationships web · Automations &amp; Interfaces graph). The toolbar is the shared <code>.sch-tb</code> pattern: a find-a-table search with a jump menu, <strong>faceted show/hide dropdowns</strong> (Bases / Tables / Field types / Relationships — toggle rows with an active-count badge on the trigger), the hierarchical <strong>Field-visibility</strong> tri-state tree (FieldsFilter island, backed by the shared field-visibility model), and a red Clear. Nodes: hybrid table cards (header + relationship-bearing field rows, overflow collapses to “+N more”); edges are coloured by relation kind (linked neutral solid · lookup/rollup/formula dashed hues) with a <strong>bottom-left legend</strong> keyed to the current mode. Node click opens the shared entity modal (<code>open-entity-detail</code>). Empty/upsell cards render per mode (no relationships yet · A&amp;I below Growth). Live: <a href="/schema">Schema → Visualize</a> (design source: <code>components/schema/SchemaCanvas.tsx</code>).',
    reference: 'components/islands/SchemaCanvas.tsx · components/islands/FieldsFilter.tsx · views/schema/VisualizeTab.astro',
    showCode: false,
    usageDo: [
      'Keep dagre left→right auto-layout — positions must be deterministic, never force-directed.',
      'Anchor edges on the specific field row that carries the relationship; incoming edges dock on the table header.',
      'Dim non-neighbours on selection (focus mode) — large schemas stay legible.',
    ],
    usageDont: [
      "Don't add canvas chrome in Astro around the island — toolbar, filters, and legend live inside the React island.",
      "Don't ship actions that don't persist (the design's Add-to-doc / Export were prototypes; they stay out until real).",
    ],
    examples: [
      {
        html: `
<div class="rounded-box border border-base-300 bg-base-100 p-3 text-sm text-base-content/70">
  Interactive React Flow canvas — see it live on <a class="link" href="/schema">Schema → Visualize</a>.
  <div class="mt-2 flex items-center gap-2">
    <div class="join"><button class="btn btn-sm join-item btn-active">Data</button><button class="btn btn-sm join-item">Relationships</button><button class="btn btn-sm join-item">Automations &amp; Interfaces</button></div>
    <button class="btn btn-sm">Field visibility <span class="badge badge-sm badge-primary">18/25</span></button>
  </div>
</div>`,
      },
    ],
  },
  {
    id: 'section-panel',
    group: 'Primitives',
    name: 'Section panel',
    summary: 'Bordered content panel for grouped app sections.',
    reference: 'components/ui/SectionPanel.astro',
    props: [
      { name: 'title', type: 'string', default: '—', description: 'Optional section heading.' },
      { name: 'description', type: 'string', default: '—', description: 'Optional section copy.' },
      { name: 'variant', type: "'default' | 'tonal'", default: "'default'", description: 'Surface treatment.' },
      { name: 'slot:actions', type: 'slot', default: '—', description: 'Small header actions.' },
    ],
    usageDo: ['Use for repeated bordered panels before writing view-local card CSS.', 'Keep panel nesting shallow.'],
    usageDont: ["Don't wrap every small item in a panel.", "Don't use this for identity cards that need the Card primitive API."],
    examples: [
      {
        html: `
<section class="rounded-box border border-base-300 bg-base-100 p-5">
  <div class="mb-4 flex items-start justify-between gap-3">
    <div>
      <h2 class="text-lg font-semibold text-base-content">Backup health</h2>
      <p class="mt-1 text-sm text-base-content/60">A grouped surface for related product information.</p>
    </div>
    <button class="btn btn-ghost btn-sm">View all</button>
  </div>
  <p class="text-sm text-base-content/70">Last successful backup completed 2 hours ago.</p>
</section>`,
      },
    ],
  },
];
