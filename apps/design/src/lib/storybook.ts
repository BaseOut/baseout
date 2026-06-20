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
      'Spacing is Tailwind’s default 4px scale (<code>--spacing: 0.25rem</code>); every padding, gap and margin is a multiple of 4. Use the scale, never arbitrary pixel values, so vertical rhythm stays consistent across views. The knob is <code>--spacing</code> plus the discipline of using <code>p-*</code> / <code>gap-*</code> / <code>m-*</code> steps.',
    showCode: false,
    usageDo: [
      'Snap every gap and pad to the scale (4 / 8 / 12 / 16 / 24 / 32 / 48).',
      'Use larger steps (24–48) to separate sections, smaller (4–8) to group.',
    ],
    usageDont: [
      "Don't hand-pick 14px / 18px / 30px — those break the grid.",
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
      'Use btn btn-outline plus a FontAwesome brand icon for third-party auth buttons — no custom provider CSS.',
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
      'Use Badge for tier, capability, and plan labels — never hand-roll feature pill CSS.',
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
    id: 'alert',
    group: 'Primitives',
    name: 'Alert',
    summary: 'daisyUI alert — an inline banner for a state the user should notice.',
    reference: 'components/ui/Alert.astro',
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
    usageDo: ['Use the soft style for calm, on-brand banners.', 'Give an error alert a recovery action (Reconnect, Retry).', 'Make every user hint / heads-up an alert with a leading icon — a gating hint is a persistent alert-warning + lucide--circle-alert; a non-gating tip may add a × to dismiss.'],
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
    summary: 'daisyUI drawer — a slide-over side panel pattern for focused side tasks.',
    description:
      'A right-side (or left) slide-over for a focused side task: connecting a source/destination, reviewing failed attachments, reauthorizing a broken connection. Use daisyUI’s <code>drawer drawer-end</code> + <code>drawer-toggle</code> checkbox + <code>drawer-side</code> + <code>drawer-overlay</code> until a second real reusable call site justifies a wrapper. Live: the <a href="/integrations/configure">setup wizard</a> (Connect Airtable / Add a destination).',
    props: [
      { name: 'id', type: 'string', default: 'required', description: 'Unique id; the matching checkbox that open/close triggers toggle.' },
      { name: 'title', type: 'string', default: 'required', description: 'Heading shown in the panel header.' },
      { name: 'subtitle', type: 'string', default: '—', description: 'Optional supporting line under the title.' },
      { name: 'side', type: "'end' | 'start'", default: "'end'", description: 'Which edge it slides from (end = right).' },
      { name: 'width', type: 'string', default: "'w-[min(92vw,28rem)]'", description: 'Tailwind width class for the panel.' },
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
];
