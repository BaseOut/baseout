import type { Meta, StoryObj } from '@storybook/html-vite';
import RegistryTable from './RegistryTable.astro';
import { renderAstro } from '../../../.storybook/render-astro';
import { registryColumns, registryRows } from '../../../../design/src/fixtures/component-catalog';

const meta: Meta = {
  title: 'Patterns/RegistryTable',
  loaders: [async () => ({ html: await renderAstro(RegistryTable, { props: { columns: registryColumns, rows: registryRows } }) })],
  render: (_args, { loaded }) => loaded.html,
};
export default meta;

type Story = StoryObj;

export const Default: Story = {};
