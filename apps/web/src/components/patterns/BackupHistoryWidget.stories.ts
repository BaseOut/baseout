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

/**
 * Webhook-triggered run (web-instant-webhook): the ⚡ glyph next to
 * "Triggered by Webhook" and the detail line "Source: Webhook · N created ·
 * N updated · N deleted (· N reconciled)". The counts ride optional
 * BackupRunSummary fields (persisted by the engine's incremental-run
 * completion in server-instant-webhook); the second run shows the counts-not-
 * yet-persisted fallback.
 */
export const WebhookRun: Story = {
  loaders: [
    async () => ({
      html: await renderAstro(BackupHistoryWidget, {
        props: {
          ...backupHistoryFixture,
          runs: [
            {
              ...backupHistoryFixture.runs[0],
              id: 'run-webhook-1',
              triggeredBy: 'webhook',
              createdCount: 3,
              updatedCount: 12,
              deletedCount: 1,
              reconciledRecords: 4,
            },
            {
              ...backupHistoryFixture.runs[0],
              id: 'run-webhook-2',
              triggeredBy: 'webhook',
            },
          ],
        },
      }),
    }),
  ],
  play: async ({ canvasElement }: { canvasElement: HTMLElement }) => {
    // Open the first accordion so the Source line is visible in the story.
    const details = canvasElement.querySelector('li details') as HTMLDetailsElement | null;
    if (details) details.open = true;
  },
};
