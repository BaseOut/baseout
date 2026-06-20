import type { Meta, StoryObj } from '@storybook/html-vite';
import StoragePicker from './StoragePicker.astro';
import { renderAstro } from '../../../.storybook/render-astro';
import { storagePickerFixture } from '../../../../design/src/fixtures/component-catalog';

const meta: Meta = {
  title: 'Patterns/StoragePicker',
  loaders: [async () => ({ html: await renderAstro(StoragePicker, { props: storagePickerFixture }) })],
  render: (_args, { loaded }) => loaded.html,
};
export default meta;

type Story = StoryObj;

export const Default: Story = {};
