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
<p><strong>Building a new screen (person or agent):</strong> compose from Primitives, follow each entry’s “When to use” default, and pull color / spacing / radius from Foundations. The non-negotiables: one primary button per surface · <strong>md <code>btn</code> is the default size (~90%)</strong>, sm only for dense clusters · every badge is <strong>soft + semantic</strong> (status, plus Required = error / Recommended = primary / Managed = success) — <strong>never <code>badge-outline</code></strong>, and a standalone status badge gets a leading dot · any user hint is a <strong>soft <code>alert</code> with a leading icon</strong>, not a bare tinted line · a Clear/reset is a <strong>red ghost + ×</strong> shown only when there’s something to clear · real third-party services use their <strong>real logo</strong> · a concept uses <strong>one icon everywhere</strong> · linked-and-healthy connectors are a <strong>green line + check</strong> (the Home pipeline language) · numbers are <code>font-mono</code> + tabular · 12px is the smallest text. If something isn’t a primitive here, it’s a Pattern — keep it bespoke.</p>
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
      { name: 'variant', type: "'primary' | 'secondary' | 'ghost' | 'danger' | 'success' | 'warning'", default: "'primary'", description: 'Emphasis level — see the table. secondary = neutral gray; outline / tonal are deprecated.' },
      { name: 'size', type: "'sm' | 'md' | 'lg'", default: "'md'", description: 'md (default) is the workhorse; sm for dense areas, lg for heroes.' },
      { name: 'icon', type: 'boolean', default: 'false', description: 'Square icon-only button (needs an aria-label).' },
      { name: 'loading', type: 'boolean', default: 'false', description: 'Shows a spinner and disables the button.' },
      { name: 'disabled', type: 'boolean', default: 'false', description: 'Non-interactive, reduced opacity.' },
      { name: 'href', type: 'string', default: '—', description: 'Renders as a link (a) instead of a button.' },
    ],
    guides: [
      {
        title: 'Choosing emphasis',
        note: 'Spend exactly one primary per visible surface — it points at the single thing the user came to do. Everything else steps down: secondary is a neutral gray fill, tertiary is ghost (no fill). Reference: Cloudflare’s blue primary + gray “Edit code” secondary (cf. Linear, Claude). Outline is deprecated — its default border reads heavy; reach for the gray Secondary instead. It survives only as a quieter destructive (btn-outline btn-error).',
        rows: [
          {
            token: 'Primary · btn-primary',
            use: 'The one main action of the surface — Run backup now, Save, Connect, Continue.',
            why: 'A single cyan fill is the unmistakable focal point. A second primary collapses the hierarchy.',
          },
          {
            token: 'Secondary · btn-neutral',
            use: 'A supporting action next to the primary — Edit code, Settings, Cancel, Back.',
            why: 'A neutral gray fill with white text: clearly a button, but it yields to the primary (the Cloudflare / Linear pattern). Tuned dark-first.',
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
        default: 'Default · btn (40px / 14px)',
        note: 'daisyUI ships 5 sizes; we standardise on 3 and use daisyUI’s native scale as-is. <strong>Default (md, 40px / 14px) is the size for ~90% of the interface</strong> — every prominent or standalone action: page-header CTAs, empty-state buttons, form submits, modal AND drawer actions, wizard nav. Reach for small ONLY inside genuinely dense clusters (a toolbar, a row of filter chips, table row actions); large is the rare hero. When unsure, use md.',
        rows: [
          {
            token: 'Default · btn (40px / 14px)',
            use: 'The default for ~90% of buttons — page-header CTAs (Run backup now), empty-state actions (Connect Airtable), form submits, modal + drawer footers, wizard Next / Save. Whenever you want a 14px label, this is it.',
            why: 'Its 14px label matches the app’s body text and gives an action the presence it needs. Small reads as a secondary, dense-context control — wrong for a standalone action.',
          },
          {
            token: 'Small · btn-sm (32px / 12px)',
            use: 'Dense clusters ONLY — a toolbar, filter chips, table row actions, an icon-only close (×) in a header, tight inline groups.',
            why: 'daisyUI’s native compact size (32px / 12px) for control-packed areas, the Linear / Vercel density default. Don’t reach for it just to make a button smaller — a standalone action wants md. (We do not restyle sm’s font — overriding daisyUI’s .btn-sm doesn’t survive the Tailwind v4 / Lightning CSS build.)',
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
  <button class="btn btn-neutral">Secondary</button>
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
      'A small soft pill that references a schema entity: a leading <strong>type icon</strong> + <strong>name</strong> + optional <strong>muted context</strong> (e.g. "· Deals"). It is the ONE element for every inline entity reference — Automations/Interfaces <em>Touches</em>, Relationships <em>Connects</em> / <em>Linked fields</em> / <em>referenced-by</em>, and the Docs / Chat / Insights entity refs — replacing the per-surface hand-rolled pills (<code>.rl-dchip</code>, <code>.au-chip</code>, <code>.if-chip</code>, <code>.chat-chip</code>, <code>.doc-chip</code>, <code>.ins-chip</code>) that had drifted apart on size, radius and colour. <strong>Neutral by default</strong> (soft <code>base-200</code> fill + <code>1px base-300</code> border, rounded-full, 13px) — the concept icon carries the type, so no per-type colour. Because chips render at runtime via <code>innerHTML</code>, the markup comes from ONE builder (<code>entityChip()</code>) and the CSS from ONE source (<code>styles/global.css</code>, <code>.sb-chip*</code>). <strong>Variants:</strong> <em>clickable</em> (a <code>&lt;button&gt;</code> that opens the entity), <em>static</em> (a <code>&lt;span&gt;</code>), <em>removable</em> (a trailing × — for a manual tag), <em>derived</em> (a quieter/muted pill — an engine-derived tag, never removable; used in the edit form only, read views show plain chips). Live: <a href="/schema">Schema</a> (Relationships / Automations / Interfaces / Docs / Chat).',
    reference: 'components/schema/entityChip.ts (markup) + styles/global.css (.sb-chip*)',
    usageDo: [
      'Use entityChip() for EVERY inline reference to a schema entity — never hand-roll a chip pill.',
      'Clickable chip = opens the entity (pass the existing data-* open hook via `attrs`); static chip = a plain span.',
      'Manual tags = the removable variant (× via `remove`); engine/auto-derived tags = the `derived` variant (a quieter muted pill, no ×) — used only in the edit form, read views show plain chips. Never a dashed border.',
      'Keep it neutral — the leading type icon signals the kind; do not re-introduce per-type or per-source colours.',
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
            use: 'States that carry no alarm — Paused, Draft, Skipped.',
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
      'Add a leading dot when the badge stands alone in a row without nearby context.',
      'Make sibling meta tags all badges by meaning (Required = error, Recommended = primary, Managed = success).',
    ],
    usageDont: [
      "Don't use a solid status-colored fill for state — soft tint + colored text reads calmer.",
      "Don't use badge-outline — we standardise on the soft style everywhere.",
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
      'A <code>tooltip</code> wraps a control and shows its <code>data-tip</code> text on hover or focus. Use it to name an icon-only button — never the native <code>title</code> attribute, which waits ~1s, renders unstyled, and ignores the theme (we zero the open-delay in <code>global.css</code> so ours appear instantly). Tooltips are CSS pseudo-elements, so any <code>overflow: hidden</code> or scrolling ancestor clips them: inside a scroll area or against a right edge, use <code>tooltip-left</code>. Keep the tip to a few words, and always keep an <code>aria-label</code> on the button — the tip alone is hover-only, unreachable by keyboard, touch, or screen reader.',
    guides: [
      {
        title: 'When to use a tooltip',
        default: 'Icon-only control · tooltip + aria-label',
        note: 'A tooltip names a control that has no visible label. It is a hint, not a home for essential information — anything a user must read belongs on the surface.',
        rows: [
          { token: 'tooltip (top)', use: 'Default. An icon button with room above it.', why: 'Points at the trigger without covering neighbouring rows.' },
          { token: 'tooltip-left', use: 'Inside a scrolling panel or against the right edge (e.g. the Schema field-row actions).', why: 'A top tooltip gets clipped by the scroll container; left stays within the row.' },
          { token: 'tooltip-primary / -success / …', use: 'When the hint reinforces a semantic action (rare).', why: 'Colours the bubble to match; default neutral suits most cases.' },
        ],
      },
    ],
    usageDo: [
      'Wrap the control in a tooltip and set data-tip to a short label.',
      'Keep an aria-label on the button so the action is announced and touch-reachable.',
      'Use tooltip-left inside scroll areas or against a right edge so it is not clipped.',
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
          { token: 'Small · input-sm', use: 'Dense forms, inline edit, filters.', why: 'Matches the btn-sm density default.' },
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
          { token: 'Small · select-sm', use: 'Toolbar filters and inline controls.', why: 'Density default; pairs with btn-sm.' },
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
    ],
    usageDo: ['Use a toggle only when the effect is immediate.', 'Label the state so on/off is unambiguous.', 'When an option can’t be chosen (at a selection cap, plan-gated), make the item itself read inactive — reduced opacity (~0.4) + cursor-not-allowed + the control disabled — not just a banner. A long list hides the banner; the disabled item carries the reason in place.'],
    usageDont: ["Don't use a toggle for something that only applies after a Save."],
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
      'Tabs switch between sibling views of the same object (Schema / Data / Activity) — not between pages. Default is the underline style (<code>tabs tabs-border</code>); <code>tabs-lift</code> for a card-attached set; <code>tabs-pills</code> for a compact segmented control.',
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
      'Use <code>progress</code> for a known-percentage bar: a running backup’s completion or a usage/quota meter. Colour by meaning — primary for in-progress, warning as a quota nears its cap. For unknown-duration work use a spinner, not a bar.',
    reference: 'components/ui/ProgressBar.astro',
    props: [
      { name: 'value', type: 'number', default: 'required', description: 'Current value (0 to max).' },
      { name: 'max', type: 'number', default: '100', description: 'Upper bound.' },
      { name: 'variant', type: "'primary' | 'success' | 'warning' | 'error'", default: "'primary'", description: 'Colour by meaning.' },
      { name: 'label / showValue', type: 'string / boolean', default: '— / false', description: 'Optional label and percentage readout.' },
    ],
    usageDo: ['Use a determinate bar only when you know the percentage.', 'Turn a quota bar to warning as it approaches the cap.'],
    usageDont: ["Don't fake progress for unknown-duration work — use a spinner."],
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
    reference: 'components/ui/Alert.astro',
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
      'Wrap a control in <code>tooltip</code> and set <code>data-tip</code>; position with <code>tooltip-top/right/bottom/left</code>. Use it for icon-only buttons, truncated values, and provider hints — replacing native <code>title</code> (slow, unstyled).',
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
      'Every Schema tab exports, and every tab exports exactly one format — so the <strong>trigger names it</strong>: <code>Export CSV</code>, <code>Export image</code>, <code>Export PDF</code>, never a bare “Export”. (Surveyed products all do this; Metabase is the only one saying “Download”, and only because it truly offers four formats.) The trigger is the catalog <a href="#pattern-faceted-filter">facet</a> trigger — a bordered <code>ff-trigger</code> with a chevron — because an export is a quiet toolbar control, not the loudest button on the page.<br><br><strong>Scope is the whole decision.</strong> The panel offers two radios and shows <strong>both counts at once</strong> — <em>Current view · 24 fields</em> against <em>Everything · 108 fields</em> — so “keeps your filters” is something the user can <em>verify</em> rather than something we promise. The count repeats in the confirm button (<code>Export 24 fields</code>): the last thing read before the click is what lands on disk. Airtable scopes exports to the active view <em>silently</em>, which is a documented source of user confusion; no competitor shows counts at all.<br><br><strong>Zero matches disables the control</strong>, with the reason inline (“No fields match the current filter”). A header-only file reads as a bug, and a bug in an export is indistinguishable from data loss.<br><br><strong>The filename carries the scope</strong> — <code>baseout_core-crm_browse_2026-07-10_filtered.csv</code> vs <code>…_all.csv</code> — so the answer to “what did I actually export?” survives until the day the file is opened. It is shown in the panel before download.<br><br><strong>CSV is escaped, and the panel says so.</strong> Airtable formula fields begin with <code>=</code>; exporting them raw is an OWASP formula-injection vector <em>and</em> silently corrupts the documentation we claim to produce, because the spreadsheet evaluates them instead of showing them. Every cell is quoted, embedded quotes doubled, and any cell opening with <code>= + - @ TAB CR LF</code> is prefixed with an apostrophe. The panel states it quietly: <em>“Formula definitions are exported as text.”</em> UTF-8 without BOM by default; an <em>Excel-compatible</em> checkbox adds the BOM.<br><br><strong>Image export is not a bare button.</strong> A dark-first canvas baked into a PNG lands in a white document — the single most-reported complaint against Excalidraw. So: whole graph fitted with padding (never the viewport, which silently drops off-screen nodes), an explicit background choice (theme / light / transparent), and 2× by default because raster blurs when zoomed.<br><br><strong>Large exports degrade the button, not the user’s patience</strong> (ProBackup’s pattern): when a job is heavy the trigger itself becomes <code>Request full export</code>, runs asynchronously, and the finished file arrives in the <a href="#pattern-inbox">Inbox</a>’s Activity lane. The label change <em>is</em> the warning and the wait-communication, in one affordance. No spinner trapped in a modal.<br><br>Research: <code>research/schema-export/</code>.',
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
      'Footer is read-only by default (no action bar). Where edit/delete genuinely applies (Automations/Interfaces), use ONE standardized footer bar, identical in every file: border-top 1px base-200, Edit = btn btn-sm btn-neutral + lucide--pencil, Delete = btn btn-sm btn-ghost text-error + lucide--trash-2.',
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
    summary: 'Independent side-by-side detail panels — the slot next to the table is the anchor; every other panel you opened by hand. Capped at 4.',
    description:
      'The <strong>independent side-by-side multi-panel</strong> behaviour layered on the <a href="#pattern-detail-panel">entity detail panel</a> so a power user can hold and compare several schema entities at once. <strong>Model — independent panels, capped at 4</strong> (redesigned from the old Anchor+Focus cap-2; that parent-child model is retired). Each panel is <strong>self-contained</strong> (own visit-stack, own description-edit state) and <strong>closes independently</strong> — there is no "close both". <strong>The anchor slot:</strong> the panel nearest the table is <em>docked to it</em> — a plain open (a Browse row / <code>schema:openEntity</code>) ALWAYS lands in that panel, never in the focused one and never in a new one, so the answer to "what will this click replace?" is always "the panel by the table". Transience is encoded by <strong>position, not by a badge</strong>: no preview chip, no italic title, no Pin. The anchor’s <strong>header is hatched</strong> (a faint diagonal <code>repeating-linear-gradient</code> + a slightly deeper fill) and has <strong>no drag grip</strong>: the bar you would drag a panel by visibly does not move. It must read as <em>fixed</em>, never as <em>disabled</em> — the panel below stays fully interactive. Deliberately <strong>not</strong> an accent left border: that pixel belongs to the resize grip, whose hover state is the same primary colour. Nothing can be dropped into the anchor’s slot. <strong>Detach</strong> turns it into an ordinary panel and frees the slot for the next row you click. <strong>Open beside:</strong> ⌘/Ctrl-click or middle-click a reference/row (or the picker) opens that entity in a NEW ordinary panel beside — a plain reference click drills <strong>in place</strong> within its panel (push, Miller rule). The focused panel carries <strong>no decoration</strong> — focus is implied by where the user just clicked. There is no top bar and <strong>no rail surface</strong>: the controls (a round ＋ add, the open-count, and the shutter pill 5px further out) simply <strong>float on the leftmost panel’s left edge</strong>, so the drawers keep every pixel of width. The ＋ opens a picker whose <strong>search sits directly under the title</strong>, above a scope-aware <em>Suggested</em> list — <em>This base</em> offers the focused table, the whole base and its sibling tables; <em>All bases</em> offers every base. Panels already open are never suggested. <strong>Cap 4</strong> — opening a 5th evicts the least-recently-focused panel with a one-tap Undo; the anchor is never the victim (it is the one panel the user did not ask for by hand). <strong>Non-modal</strong> — no scrim; the table behind stays visible AND clickable. <strong>Resizable at two levels</strong> — each panel’s left edge line drags its OWN width, while the rail’s <strong>shutter pill</strong> drags the WHOLE stack: left grows it, right shrinks it, every expanded panel snaps to one equal width, and squeezing past the floor parks them one at a time from the left (pulling back out unparks them right to left) instead of collapsing the whole stack at once (auto-fit keeps a table strip visible; a default width persists in localStorage). <strong>Mobile (&lt; 900px)</strong> shows a single full-width column (the focused panel). Everything inside each panel is the unchanged <a href="#pattern-detail-panel">detail-panel canon</a> (header identity + crumbs + identity meta + ordered sections + <a href="#panel-section-nav">section-nav</a> + dual-description Draft→Publish) — this pattern only governs how several panels coexist. Reorder (drag handle) and collapse-to-rail + auto-accordion follow as further increments. A per-panel Compare toggle existed and was <strong>removed</strong> on client feedback — the diff highlight solved no problem he had. Ported from <code>research/multi-panel-drawer/</code>. Live: <a href="/panels">Panel Lab</a> + <a href="/schema">Schema › Browse</a>.',
    reference: 'design:components/schema/EntityPanel.astro (.ep-wrap / .ep-rail / .ep-sheet[data-ep-sheet-tpl] / .ep-previewbar / .ep-grip)',
    showCode: false,
    usageDo: [
      'Cap at FOUR independent panels; each closes on its own (no "close both"). Opening a 5th evicts the least-recently-focused one with an Undo.',
      'Give the stack a shutter pill on its outer (left) edge: dragging it resizes every expanded panel together AND equalizes their widths. Squeeze past the floor and panels park to rail strips ONE AT A TIME, leftmost first, with the survivors re-sharing the freed width; pulling back out unparks them right to left. Keep the per-panel edge grip for adjusting one panel alone.',
      'A plain open ALWAYS lands in the anchor — the panel next to the table. Never retarget the focused panel: focus is an accident of the last click and must not decide what gets replaced. Mark the anchor by its POSITION (fixed slot) plus a hatched, grip-less header — the surface you drag by, visibly immovable. Never a coloured left border: that pixel is the resize grip’s.',
      '⌘/Ctrl-click or middle-click a reference/row (or the picker) opens a NEW ordinary panel beside. A plain reference click drills in place (push, Miller rule). Back pops that panel’s stack; at the root the × dismisses. Detach frees the anchor slot; the next plain open recreates it.',
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
    id: 'pattern-setup-stepper',
    group: 'Patterns',
    name: 'Setup stepper',
    summary: 'The Space-setup wizard stepper — bespoke, gated for first-run.',
    description:
      'The multi-step Space setup (Source → Destination → Bases → Depth → Schedule) is a gated linear flow for onboarding, with a free-jump edit mode afterwards. It is a product flow, not a primitive — keep it custom, and use this catalog’s inputs, selects and buttons for the controls inside each step. Live: <a href="/welcome">Welcome</a>.',
    reference: 'components/patterns/WizardStepper.astro · components/patterns/SelectableConnectorRow.astro · views/IntegrationsSetupWizard.astro',
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
      'When a table grows, wrap it in a toolbar (search + filters) above and a pager below. Search is an <a href="#input">Input</a>; each filter is a <strong>faceted dropdown</strong> — a daisyUI <code>dropdown</code> of <a href="#checkbox-toggle">checkboxes</a> with a selected-count badge on its trigger (the shadcn <em>DataTableFacetedFilter</em> pattern; cf. Deel / Profound). Multi-select where it helps (status, trigger), a single range for date; a red Clear with an × resets everything. The pager is a <a href="#select">Select</a> + prev/next <a href="#button">Buttons</a>. Filter client-side in the prototype; the real app pushes it to the query. Live: <a href="/backups">Backups</a>.',
    reference: 'components/patterns/RegistryTable.astro · views/BackupsListView.astro',
    showCode: false,
    usageDo: [
      'Search by stable identifiers (run id, error message) for support triage.',
      'Filter by attributes the row actually owns — status, trigger, date.',
      'Show a distinct “no matches” state, separate from the never-run empty state.',
    ],
    usageDont: [
      "Don't filter by something that isn’t a per-row fact (e.g. base — that’s current config, not a run snapshot).",
      "Don't paginate the search out of reach — keep it pinned above the table.",
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
    id: 'pattern-faceted-filter',
    group: 'Patterns',
    name: 'Faceted filter',
    summary: 'The one filter control used everywhere: a dropdown trigger with a count + a "filter working" active state.',
    description:
      'Every filter across the app is this single control, so nothing reads as a mishmash. The trigger is a <strong>bordered <a href="#button">Button</a></strong> (matches the look of a <a href="#select">Select</a>) with a small chevron; when the filter is doing something it switches to a <strong>primary-tinted active state</strong> and shows a count <a href="#badge">Badge</a> inside the button. Two modes: <strong>multi-select</strong> opens a dropdown of rows = name-left + a daisyUI <a href="#checkbox-toggle">toggle</a> right (the row fades when off), with <em>Show all / Hide all</em> (disabled at the extremes) and an <code>n/total</code> count; <strong>single-select</strong> opens a list of radios and the trigger shows the chosen value (e.g. "Added"). A red <a href="#button">Clear</a> with an × resets every filter at once. Every popover opens with a <strong>Search box</strong> (placeholder <code>Search</code>, a leading magnifier) that filters the rows in place and hides empty group headings — present on every facet so they all read the same. Rows that list a <strong>base or table</strong> carry the same <strong>health status dot</strong> (success / warning / error) the tree and Visualize canvas use, so the dropdowns are consistent across tabs. Field-type rows carry the vendored Airtable icon. Component: <code>components/schema/FacetFilter.astro</code> (Astro, self-wiring via a bubbling <code>facetchange</code> event) and the React twin in the Visualize island — kept visually identical. Live: <a href="/schema">Schema</a> (Browse + Visualize + Changelog), <a href="/backups">Backups</a>. <strong>The styles are global</strong> (<code>styles/components/facet-filter.css</code>), not scoped to <code>FacetFilter.astro</code> — a second surface can then render the same <code>ff-trigger</code> / <code>ff-panel</code> / <code>ff-opt</code> classes instead of copying the look. The <a href="#pattern-inbox">Inbox</a> filter menu does exactly that: it needs lane-aware rows and a command row, which the component cannot host, so it reuses the construction. The trigger always states what it is doing: it tints primary (<code>ff-on</code>) and shows a count of active filters, because a narrowed list that looks unnarrowed is indistinguishable from an empty one.',
    reference: 'design:components/schema/FacetFilter.astro',
    showCode: false,
    usageDo: [
      'Use this one control for ALL filters — multi-select (toggles) or single-select (radios) — never a bare native select next to it.',
      'Show the active state (primary tint) + count the moment a filter is applied, so a working filter is obvious.',
      'Keep the count inside the trigger button (n/total for multi; the chosen value for single).',
      'Offer Show all / Hide all on multi facets and a single red Clear that resets everything.',
      'Open every popover with a Search box (placeholder "Search") and give base/table rows the health status dot, so all dropdowns match.',
    ],
    usageDont: [
      "Don't mix styles — no native select beside the faceted buttons (that was the bug this pattern fixes).",
      "Don't drop the active state; a filtered facet that looks identical to an empty one is a defect.",
      "Don't put the control on the left of the row label — name left, toggle/radio right, everywhere.",
    ],
    examples: [
      {
        label: 'Triggers — default · active multi (n/total) · active single (value)',
        html: `
<div class="flex flex-wrap items-center gap-2" style="padding:1.25rem 1rem">
  <div class="btn btn-sm gap-1.5" style="background:var(--color-base-100);border-color:var(--color-base-300);font-weight:400">Bases <span class="iconify lucide--chevron-down size-3 opacity-55"></span></div>
  <div class="btn btn-sm gap-1.5" style="background:color-mix(in oklch,var(--color-primary) 13%,transparent);border-color:color-mix(in oklch,var(--color-primary) 35%,transparent);color:var(--color-primary);font-weight:400">Field types <span class="badge badge-sm badge-primary">13/14</span> <span class="iconify lucide--chevron-down size-3 opacity-55"></span></div>
  <div class="btn btn-sm gap-1.5" style="background:color-mix(in oklch,var(--color-primary) 13%,transparent);border-color:color-mix(in oklch,var(--color-primary) 35%,transparent);color:var(--color-primary);font-weight:400">Added <span class="iconify lucide--chevron-down size-3 opacity-55"></span></div>
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
      'Schema entities deleted in Airtable are retained for history, but they shouldn’t clutter the default views. Browse (tree + flat) shows only <strong>active</strong> (and <code>unknown</code>) entities by default; <code>removed</code> ones are hidden. A single neutral <a href="#checkbox-toggle">checkbox</a> — <strong>"Include deleted"</strong> with a <strong>count <a href="#badge">badge</a></strong> (the discoverable "N deleted" affordance) and a <a href="#tooltip">tooltip</a> — reveals them. Revealed rows render <strong>muted</strong> with a neutral <strong>"Deleted" badge</strong> and a caption <em>"no longer in Airtable since &lt;date&gt;"</em>. They stay selectable: the <a href="#pattern-entity-panel">entity panel</a> opens read-only with a banner ("no longer exists in Airtable, showing the last backup") and the last-known values, <strong>no edit / publish / AI</strong>. <code>unknown</code> entities (couldn’t be confirmed this run) are NOT treated as deleted and stay visible. Deleted entities never appear in the live <a href="/schema">Visualize</a> diagram or the field-visibility picker. <strong>No Restore here</strong> — Schema is read-only; restoring lives in the Backups flow. Components: <code>components/schema/SchemaBrowse.astro</code> + <code>EntityPanel.astro</code>. Live: <a href="/schema">Schema</a> → Browse.',
    reference: 'design:components/schema/SchemaBrowse.astro',
    showCode: false,
    usageDo: [
      'Hide removed by default; reveal with ONE neutral checkbox + a count badge (the discoverable "N deleted").',
      'Mark a revealed item: muted row + a "Deleted" badge + the removal date ("no longer in Airtable since …").',
      'Keep removed items inspectable but read-only — the panel shows a banner + last-known values, no edit/publish/AI.',
      'Keep `unknown` (unconfirmed) items visible; only `removed` hides behind the toggle.',
    ],
    usageDont: [
      "Don't offer Restore here — Schema is read-only; restoring belongs in the Backups flow.",
      "Don't treat `unknown` as deleted, and don't show deleted entities in the live diagram or field picker.",
      "Don't colour the toggle/checkbox or the Deleted badge red — deletion is neutral history, not an error.",
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
    id: 'pattern-schema-automations-interfaces',
    group: 'Patterns',
    name: 'Automations & Interfaces (manual registry)',
    summary: 'Two Schema tabs to hand-register the automations/interfaces Airtable\'s API can\'t export: grouped/nested listings, a right-drawer create/edit form with a raw Definition JSON field + a Table/Field tag-picker (auto vs manual chips), soft-delete, below-tier upsell, and bidirectional "Referenced by" surfacing.',
    description:
      'The Schema <a href="/schema">Automations</a> and <a href="/schema">Interfaces</a> tabs. Airtable\'s API doesn\'t expose automations or interfaces, so they\'re <strong>registered manually</strong> (or via an inbound API) and tracked alongside the schema. <strong>Listings:</strong> both group by <strong>Base</strong> (Dan 2026-07-01 — a single-Base association replaces the old free-text group), reusing the Browse tree\'s collapsible header (blue <a href="#pattern-schema-app-graph">database concept-icon</a> + base name + count). Automations sit directly under their Base; Interfaces render each Interface as a <strong>parent row</strong> with its <strong>Pages nested</strong> beneath (Base ▸ Interface ▸ Pages, Zendesk-style, "N pages" sub-count). Each Base group renders as a <strong>real table</strong> with a repeated column header (Name · Status · Trigger · Tagged + hover actions for Automations; Name · Type · Status · Tagged for Interfaces), Backups-table style with fixed-width columns so the status/trigger/tagged columns line up across groups; a <strong>Base filter</strong> + <strong>Include-removed</strong> toggle sit on the toolbar; soft-deleted rows render muted with a "Removed from Airtable" badge (kept as history, not deleted). <strong>Empty state</strong> is honest — it names the API blind-spot ("Airtable\'s API doesn\'t expose these") + a primary <em>Register</em> CTA; below the unlocking tier the same skeleton becomes a quiet <em>upsell</em>. <strong>Create/edit</strong> opens in the shared <strong>right Drawer</strong> (project default — NOT a modal): required scalars first (Name + ID + a <strong>required Base picker</strong>; Interfaces add Type <em>interface|page</em> with a <strong>parent-interface picker required for a page</strong>, scoped to the chosen Base), then a <strong>Table/Field tag-picker</strong> reusing the Browse <code>EntitySearch</code> — <em>auto</em>-derived tags render tinted + non-removable, <em>manual</em> tags outlined with an ×. There is <strong>no raw-definition JSON input</strong> — the <code>definition</code> is API-only (scraped automations), so it\'s never hand-entered and shows read-only in the detail only when a value exists. <strong>Fields (Dan round-2):</strong> automations carry an <strong>On/Off status</strong> in a dedicated <strong>Status column</strong> via our <a href="#badge">status badges</a> (badge-soft + a bg-current dot — Active = success, Inactive = neutral, Removed = warning; distinct states, not one grey pill), a <strong>Trigger</strong> chosen from a dropdown of Airtable\'s canonical trigger types (When a record is created / updated / matches conditions / enters a view · At a scheduled time · form / webhook / button · Integrated — free text is gone; the API can\'t export automations so it\'s manual input, surfaced as a labeled Trigger line in the detail), <strong>two descriptions</strong> in <strong>Airtable vs Internal tabs</strong> (automations DO have an Airtable description, but the API can\'t sync it — so there is <strong>no Publish</strong>, just save/edit; mirrors the <a href="#entity-panel">EntityPanel</a> field pattern minus write-back), and <strong>email subscribers</strong> (chip input); interfaces/pages show a <strong>Published / Not published</strong> status in a Status column (same badges, for interfaces AND pages) and an <strong>Internal-note-only</strong> description (they have no Airtable description). The row tag-count reads "<em>N tagged</em>" (labeled, not a bare icon). <strong>Change history:</strong> the read drawer gains a <strong>Changelog section</strong> (this entity\'s own added/renamed/removed/config events); the same events also appear in the <a href="/schema">Changelog</a> tab as base ▸ [concept icon] name rows (a status change reads e.g. "Automation turned off · Active → Inactive"). <strong>Bidirectional tags:</strong> a table/field\'s shared entity sidebar gains a <strong>"Referenced by"</strong> section listing the automations/interfaces that tag it, each click-through jumping to its tab + opening its detail. Components: <code>components/schema/SchemaAutomations.astro</code> + <code>schemaAutomations.ts</code>, <code>SchemaInterfaces.astro</code> + <code>schemaInterfaces.ts</code>; reuses <code>ui/Drawer.astro</code>, <code>EntitySearch.astro</code>, <code>EntityPanel.astro</code>.',
    reference: 'design:components/schema/SchemaAutomations.astro',
    showCode: false,
    usageDo: [
      'Frame the empty state honestly — name the API blind-spot ("Airtable\'s API can\'t export these, register them here") + one primary Register CTA. Reuse the same skeleton for the below-tier upsell.',
      'Automations = collapsible groups (count badge + "No group" bucket); Interfaces = parent rows with nested Pages ("N pages" sub-count), one level only.',
      'Open create/edit in the right Drawer (project default), never a daisyUI modal. Scalars first (incl. the required Base), then the tag-picker.',
      'Tag-picker: reuse Browse EntitySearch; auto-derived tags are tinted + non-removable, manual tags outlined with an × (only manual are removable).',
      'Associate every automation/interface with a single Base (required) and group the listings + sidebars by Base, reusing the Browse tree header/visual. Don\'t offer a raw-definition JSON input — it\'s API-only, shown read-only only when present.',
      'Surface tags both ways: on the entity\'s sidebar show a "Referenced by" section (the automations/interfaces tagging it), click-through to that tab.',
      'Soft-delete, never hard-delete: removed rows stay muted with a "Removed from Airtable" badge behind Include-removed.',
    ],
    usageDont: [
      "Don't use a modal for the create/edit form — the project default is the right Drawer / entity sidebar.",
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
      'The Schema <a href="/schema">Chat</a> tab (last tab): chat with AI about the Space\'s schema, in a <strong>Linear/Vercel-dense, no-avatar</strong> register (not a consumer chat). Three regions: a <strong>thread rail</strong> (New chat, single-line titles + muted date, hover kebab → Rename / Archive, archived hidden behind a toggle), a <strong>conversation</strong> (user vs assistant by label + subtle background + alignment, no avatars/bubbles-decoration), and a <strong>composer</strong>. A persistent <strong>context bar</strong> sits above the composer (Cursor/Langdock pattern): removable <strong>scope chips</strong> for bases/tables/fields (added via the reused <a href="#">EntitySearch</a> typeahead) + attached <strong>doc chips</strong> (doc picker); shows <strong>"Whole Space"</strong> when empty. Assistant replies carry a <strong>References</strong> row of <strong>the same chip component</strong> (entity → shared sidebar, doc → the Docs tab) — Notion native-mention model, not footnote numbers. <strong>Convert to doc</strong> drops a green <strong>linked-reference card</strong> ("Saved as a doc · Open"). <strong>Pro+ gated</strong>: below Pro+ the whole tab shows an upgrade affordance instead of a composer (discoverable, not hidden); a credits hint + Send↔Stop streaming state otherwise. Components: <code>components/schema/SchemaChat.astro</code> + <code>schemaChat.ts</code>.',
    reference: 'design:components/schema/SchemaChat.astro',
    showCode: false,
    usageDo: [
      'Keep it dense + utility: label + subtle background + alignment for sender, no avatars or gradient bubbles.',
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
    <div style="font-size:.9rem;line-height:1.55;padding:.7rem .9rem;border-radius:.7rem;background:oklch(from var(--color-base-200) l c h / .6);border:1px solid var(--color-base-300)">Deals link to Companies through the Company field, with a reciprocal Deals field, so the two are two-way.</div>
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
      'The same toolbar shape everywhere, so no two tabs read differently. Left → right on ONE row: a <strong>search box</strong> (fixed-ish width), a <strong>short vertical divider</strong> that separates search from the filters, then the <a href="#pattern-faceted-filter">faceted filters</a> + any checkbox filters + a red <a href="#button">Clear</a>; the <strong>right cluster</strong> (margin-left:auto) holds the tab-specific controls — a view toggle, Export, Add-to-doc, a count. It wraps gracefully on narrow widths. The classes are <strong>global</strong> (<code>.sch-tb</code>, <code>.sch-tb-search</code>, <code>.sch-tb-div</code>, <code>.sch-tb-right</code>, <code>.sch-tb-count</code>, <code>.sch-tb-check</code> in <code>global.css</code>) so the Astro tabs AND the React Visualize island share the exact same layout. Rules that come with it: <strong>section-wide metadata (a freshness stamp) lives at the page-title level, not inside a tab’s toolbar</strong>; <strong>checkbox filters are one neutral <a href="#checkbox-toggle">checkbox</a> everywhere</strong> (never a coloured <code>checkbox-warning</code> variant) with a <a href="#tooltip">tooltip</a> explaining what they do; <strong>toolbar action buttons are Secondary <a href="#button">btn-neutral</a></strong> (Add to doc, Export) — blue (primary) is reserved for the main CTA only. Live: <a href="/schema">Schema</a> (Browse / Visualize / Changelog).',
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
      'The same typeahead powers Browse global search/jump, the Docs "add tag" control, and the inline Docs <code>@</code>-mention. It is an <a href="#input">Input</a> + a dropdown of matches <strong>grouped by kind</strong> (Bases / Tables / Fields), each row = the vendored field icon + name + parent path + a <a href="#status-dot">health dot</a>, with ↑/↓ + Enter keyboard nav and a key-hint footer. The <strong>tag chip</strong> is the entity identity rendered inline in a doc: a primary-tinted pill (type icon + name) that is clickable in both edit and reading mode and opens the <a href="#pattern-entity-panel">entity panel</a>; a chip whose entity was removed from Airtable flips to an error-tinted "no longer in schema" state instead of being silently dropped. Components: <code>components/schema/EntitySearch.astro</code> (emits <code>schema:searchInput</code> for filter-in-place and a pick event) + the chip in <code>SchemaDocs.astro</code>.',
    reference: 'design:components/schema/EntitySearch.astro',
    showCode: false,
    usageDo: [
      'Reuse the one typeahead for every "find an entity" need (search, add-tag, @-mention).',
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
    description: `The single home for every alert: backup finished / failed, schema changed (with breaking flags), health score dropped, a connection needs reconnecting, an automation turned off, a chat answer saved as a doc. Opens from the <strong>Inbox item at the top of the sidebar</strong> (account-scoped, above the Space groups) and slides in as a column over the left edge of the work area. It <strong>overlays</strong> the page rather than pushing it: sidebar (256px) + panel (352px) = <strong>608px of chrome</strong>, so pushing only left room for a ~970px table above a ~1580px viewport — measured at 1280px, opening a pushing panel hid <strong>339px</strong> of the Backups table behind a horizontal scroll. Overlay keeps the page's own layout untouched at every width. It is <strong>non-modal</strong>: no scrim, no focus trap, no <code>role="dialog"</code> — the page behind stays interactive wherever it is still visible, so it inherits the <a href="#pattern-multi-panel-drawer">multi-panel drawer</a>'s stance (the <a href="#drawer">Drawer</a> primitive is the wrong base here — it ships a scrim). <strong>Two lanes in one scroll:</strong> <em>Needs attention</em> (a decision is required) above <em>Activity</em> (FYI), because a flat list — Linear's documented weakness — buries the one row that matters. <strong>Successes roll up per base</strong> ("<em>Sales CRM</em> — 3 backups completed", expandable); failures, breaking schema changes and reconnect <strong>never</strong> roll up. <strong>State-backed rows self-heal</strong>: reconnect and health are bound to live state, so completing the reconnect resolves the row <em>and</em> clears the <a href="#pattern-connection-health">connection banner</a>, silently — no "it's fixed!" row is minted (Datadog→PagerDuty's default). Event rows (a backup that failed) are acknowledge-based: a later success does not un-happen the failure. Row anatomy follows Vercel's alert row — icon chip, bolded entity, terse copy, right-aligned stamp. Researched in <code>research/notifications-inbox/</code>.`,
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

  // ─── Local (baseout) entries — promoted-web components + patterns not yet in ui-only ───
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
