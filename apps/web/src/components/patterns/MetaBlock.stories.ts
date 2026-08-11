import type { Meta, StoryObj } from '@storybook/html-vite';
import MetaBlock from './MetaBlock.astro';
import { renderAstro } from '../../../.storybook/render-astro';
import { metaBlockItems } from '../../../../design/src/fixtures/component-catalog';

const meta: Meta = {
  title: 'Patterns/MetaBlock',
  loaders: [async () => ({ html: await renderAstro(MetaBlock, { props: { items: metaBlockItems } }) })],
  render: (_args, { loaded }) => loaded.html,
};
export default meta;

type Story = StoryObj;

export const Default: Story = {};
