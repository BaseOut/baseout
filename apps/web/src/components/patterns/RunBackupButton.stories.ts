import type { Meta, StoryObj } from '@storybook/html-vite';
import RunBackupButton from './RunBackupButton.astro';
import { renderAstro } from '../../../.storybook/render-astro';
import { runBackupButtonFixture } from '../../../../design/src/fixtures/component-catalog';

const meta: Meta = {
  title: 'Patterns/RunBackupButton',
  loaders: [async () => ({ html: await renderAstro(RunBackupButton, { props: runBackupButtonFixture }) })],
  render: (_args, { loaded }) => loaded.html,
};
export default meta;

type Story = StoryObj;

export const Default: Story = {};
