import type { Meta, StoryObj } from '@storybook/html-vite';
import BaseSelectionTable from './BaseSelectionTable.astro';
import { renderAstro } from '../../../.storybook/render-astro';
import { baseSelectionFixture } from '../../../../design/src/fixtures/component-catalog';

const meta: Meta = {
  title: 'Patterns/BaseSelectionTable',
  loaders: [async () => ({ html: await renderAstro(BaseSelectionTable, { props: baseSelectionFixture }) })],
  render: (_args, { loaded }) => loaded.html,
};
export default meta;

type Story = StoryObj;

export const Default: Story = {};
