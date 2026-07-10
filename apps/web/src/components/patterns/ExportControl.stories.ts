import type { Meta, StoryObj } from '@storybook/html-vite';
import ExportControl from './ExportControl.astro';
import { renderAstro } from '../../../.storybook/render-astro';
import { exportControlVariants } from '../../../../design/src/fixtures/component-catalog';

const meta: Meta = {
  title: 'Patterns/ExportControl',
  render: (_args, { loaded }) => loaded.html,
};
export default meta;

type Story = StoryObj;

const variant = (key: string): Story => {
  const entry = exportControlVariants.find((v) => v.key === key)!;
  return {
    loaders: [async () => ({ html: await renderAstro(ExportControl, { props: entry.props }) })],
  };
};

export const Csv = variant('csv');
export const PdfNoRowSelector = variant('pdf');
export const HeavyAsyncDegrade = variant('heavy');
export const ImageDiagram = variant('image');
