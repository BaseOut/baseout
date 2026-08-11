import type { Meta, StoryObj } from '@storybook/html-vite';
import DefinitionList from './DefinitionList.astro';
import { renderAstro } from '../../../.storybook/render-astro';
import { definitionItems } from '../../../../design/src/fixtures/component-catalog';

const meta: Meta = {
  title: 'Patterns/DefinitionList',
  loaders: [async () => ({ html: await renderAstro(DefinitionList, { props: { items: definitionItems } }) })],
  render: (_args, { loaded }) => loaded.html,
};
export default meta;

type Story = StoryObj;

export const Default: Story = {};
