import type { Meta, StoryObj } from '@storybook/html-vite';
import BackupHistoryWidget from './BackupHistoryWidget.astro';
import { renderAstro } from '../../../.storybook/render-astro';
import { backupHistoryFixture } from '../../../../design/src/fixtures/component-catalog';

const meta: Meta = {
  title: 'Patterns/BackupHistoryWidget',
  loaders: [async () => ({ html: await renderAstro(BackupHistoryWidget, { props: backupHistoryFixture }) })],
  render: (_args, { loaded }) => loaded.html,
};
export default meta;

type Story = StoryObj;

export const Default: Story = {};
