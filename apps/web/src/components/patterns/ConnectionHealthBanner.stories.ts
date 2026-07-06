import type { Meta, StoryObj } from '@storybook/html-vite';
import ConnectionHealthBanner from './ConnectionHealthBanner.astro';
import { renderAstro } from '../../../.storybook/render-astro';
import { connectionHealthStates } from '../../../../design/src/fixtures/component-catalog';

const meta: Meta = {
  title: 'Patterns/ConnectionHealthBanner',
  render: (_args, { loaded }) => loaded.html,
};
export default meta;

type Story = StoryObj;

const state = (key: string): Story => {
  const entry = connectionHealthStates.find((s) => s.key === key)!;
  return {
    loaders: [async () => ({ html: await renderAstro(ConnectionHealthBanner, { props: { ...entry.props, collapsible: false } }) })],
  };
};

export const BrokenSource = state('broken');
export const BrokenDestination = state('broken-dest');
export const MultipleBroken = state('multiple');
export const Expiring = state('expiring');
export const Degraded = state('degraded');
export const Reconnecting = state('reconnecting');
export const Restored = state('restored');
