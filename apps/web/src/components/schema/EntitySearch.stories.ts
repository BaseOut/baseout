import type { Meta, StoryObj } from '@storybook/html-vite';
import EntitySearch from './EntitySearch.astro';
import { renderAstro } from '../../../.storybook/render-astro';
import { entitySearchFixture } from '../../../../design/src/fixtures/component-catalog';

const meta: Meta = {
  title: 'Patterns/EntitySearch',
  loaders: [async () => ({ html: await renderAstro(EntitySearch, { props: entitySearchFixture }) })],
  render: (_args, { loaded }) => loaded.html,
};
export default meta;

type Story = StoryObj;

export const Default: Story = {};
