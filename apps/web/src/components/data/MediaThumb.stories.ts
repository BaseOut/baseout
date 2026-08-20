import type { Meta, StoryObj } from '@storybook/html-vite';
import Comp from './MediaThumb.astro';
import { renderAstro } from '../../../.storybook/render-astro';

// Slice A Task 4 promotion (ui-only@9cf5b1ef). Minimal catalog render — these
// components render from an embedded SSR snapshot; the empty-state render exercises
// their structure + daisyUI styling (Container API does not run their client scripts).
const meta: Meta = {
  title: 'Data/MediaThumb',
  loaders: [async () => ({ html: await renderAstro(Comp, { props: { asset: { id: "a1", filename: "photo.jpg", type: "image" }, size: "sm" } }) })],
  render: (_args, { loaded }) => loaded.html,
};
export default meta;

type Story = StoryObj;

export const Default: Story = {};
