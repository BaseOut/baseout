import type { Meta, StoryObj } from '@storybook/html-vite';
import FrequencyPicker from './FrequencyPicker.astro';
import { renderAstro } from '../../../.storybook/render-astro';

/**
 * FrequencyPicker (web-instant-webhook) — the backup-cadence control with the
 * tier-and-dynamic-DB-gated Instant option and its poll-interval control.
 *
 * States covered (spec: web-instant-backup-config):
 *   - Unlocked: Pro+ tier AND dynamic DB ready — Instant selectable, interval visible.
 *   - LockedByTier: sub-Pro tier — Instant disabled with the tier reason + Upgrade CTA.
 *   - LockedByDynamicDb: Pro+ tier but the Space DB isn't provisioned yet.
 *   - IntervalError: the server's below-minimum rejection rendered inline
 *     (Container API runs no scripts — `play` paints the error line the client
 *     script would).
 */

const baseProps = {
  spaceId: '00000000-0000-4000-8000-000000000001',
  frequency: 'daily' as const,
  webhookPollIntervalSeconds: 900,
  availableFrequencies: ['monthly', 'weekly', 'daily', 'instant'] as const,
  dynamicDbReady: true,
  webhookPollMinSeconds: 900,
};

const meta: Meta = {
  title: 'Backups/FrequencyPicker',
  render: (_args, { loaded }) => loaded.html,
};
export default meta;

type Story = StoryObj;

export const Unlocked: Story = {
  loaders: [
    async () => ({
      html: await renderAstro(FrequencyPicker, {
        props: { ...baseProps, frequency: 'instant' },
      }),
    }),
  ],
};

export const LockedByTier: Story = {
  loaders: [
    async () => ({
      html: await renderAstro(FrequencyPicker, {
        props: {
          ...baseProps,
          availableFrequencies: ['monthly', 'weekly'] as const,
          // Even a ready DB stays locked below Pro — tier wins.
          dynamicDbReady: true,
          frequency: 'weekly',
        },
      }),
    }),
  ],
};

export const LockedByDynamicDb: Story = {
  loaders: [
    async () => ({
      html: await renderAstro(FrequencyPicker, {
        props: { ...baseProps, dynamicDbReady: false },
      }),
    }),
  ],
};

export const IntervalError: Story = {
  loaders: [
    async () => ({
      html: await renderAstro(FrequencyPicker, {
        props: { ...baseProps, frequency: 'instant', webhookPollMinSeconds: 300 },
      }),
    }),
  ],
  play: async ({ canvasElement }: { canvasElement: HTMLElement }) => {
    // The Container API doesn't run the component script; surface the inline
    // rejection the client renders for webhook_poll_interval_below_minimum.
    const error = canvasElement.querySelector('[data-fp-error]') as HTMLElement | null;
    if (error) {
      error.hidden = false;
      error.textContent =
        "Your plan's minimum is every 15 minutes — pick a longer interval.";
    }
  },
};
