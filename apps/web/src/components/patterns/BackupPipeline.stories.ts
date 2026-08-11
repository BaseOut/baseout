import type { Meta, StoryObj } from '@storybook/html-vite';
import BackupPipeline from './BackupPipeline.astro';
import { renderAstro } from '../../../.storybook/render-astro';
import { backupPipelineFixture } from '../../../../design/src/fixtures/component-catalog';

const meta: Meta = {
  title: 'Patterns/BackupPipeline',
  loaders: [async () => ({ html: await renderAstro(BackupPipeline, { props: backupPipelineFixture }) })],
  render: (_args, { loaded }) => loaded.html,
};
export default meta;

type Story = StoryObj;

export const Healthy: Story = {};
