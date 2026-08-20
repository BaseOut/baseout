import type { Meta, StoryObj } from '@storybook/html-vite';
import Table from './Table.astro';
import { renderAstro } from '../../../.storybook/render-astro';

/**
 * Table — the ONE table vessel (catalog: `table`). The caller passes `columns`
 * (the vessel renders the header, sort and keyboard) and slots the `<tr>` rows;
 * `growth` makes "can this set grow?" falsifiable — `fixed` is bounded, `paged`
 * renders a TablePager. `narrow` defaults to `pan` (specs/16-responsive.md §5).
 */

const columns = [
  { label: 'Source', sort: 'name' },
  { label: 'Status' },
  { label: 'Bases', align: 'end' as const },
];

const rows = [
  ['Marketing workspace', '<span class="badge badge-soft badge-success">Connected</span>', '12'],
  ['Ops workspace', '<span class="badge badge-soft badge-warning">Reconnect</span>', '4'],
]
  .map(
    ([name, status, bases]) =>
      `<tr class="reg-row"><td class="font-medium">${name}</td><td>${status}</td><td class="text-right font-mono tabular-nums">${bases}</td></tr>`,
  )
  .join('');

const meta: Meta = {
  title: 'UI/Table',
};
export default meta;

type Story = StoryObj;

/** A bounded set — `growth="fixed"`, the default pan-on-narrow strategy. */
export const Fixed: Story = {
  loaders: [
    async () => ({
      html: await renderAstro(Table, {
        props: { columns, rowCount: 2, growth: 'fixed', name: 'sources-registry', rowSelector: '.reg-row' },
        slots: rows,
      }),
    }),
  ],
  render: (_args, { loaded }) => loaded.html,
};

/** A growing set — `growth="paged"` renders the TablePager under the table. */
export const Paged: Story = {
  loaders: [
    async () => ({
      html: await renderAstro(Table, {
        props: {
          columns,
          rowCount: 40,
          growth: 'paged',
          pager: { sizes: [25, 50, 100], selected: 25 },
          hook: 'demo',
          name: 'run-log',
        },
        slots: rows,
      }),
    }),
  ],
  render: (_args, { loaded }) => loaded.html,
};
