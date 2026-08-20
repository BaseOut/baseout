import type { Meta, StoryObj } from '@storybook/html-vite';
import DataComments from './DataComments.astro';
import { renderAstro } from '../../../.storybook/render-astro';

// Slice A Task 9 promotion (ui-only@9cf5b1ef), fed by server-comments-read. Minimal
// catalog render — the Data components render from an embedded SSR snapshot; the
// empty-state render exercises their structure + daisyUI styling (Container API does
// not run their client scripts).
const meta: Meta = {
  title: 'Data/DataComments',
  loaders: [async () => ({ html: await renderAstro(DataComments, { props: { bases: [], tables: [], comments: [], records: [] } }) })],
  render: (_args, { loaded }) => loaded.html,
};
export default meta;

type Story = StoryObj;

export const Default: Story = {};
