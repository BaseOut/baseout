import type { Meta, StoryObj } from '@storybook/html-vite';
import Avatar from './Avatar.astro';
import { renderAstro } from '../../../.storybook/render-astro';

interface AvatarArgs {
  src?: string;
  alt?: string;
  initials?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  shape?: 'circle' | 'square';
  color?: 'teal' | 'amber' | 'cyan';
  status?: 'online' | 'away' | 'busy' | 'offline';
}

const meta: Meta<AvatarArgs> = {
  title: 'UI/Avatar',
  loaders: [async ({ args }) => ({ html: await renderAstro(Avatar, { props: args }) })],
  render: (_args, { loaded }) => loaded.html,
  args: { initials: 'AS', size: 'md', shape: 'circle', color: 'teal' },
  argTypes: {
    src: { control: 'text' },
    alt: { control: 'text' },
    initials: { control: 'text' },
    size: { control: 'select', options: ['xs', 'sm', 'md', 'lg', 'xl', '2xl'] },
    shape: { control: 'inline-radio', options: ['circle', 'square'] },
    color: { control: 'inline-radio', options: ['teal', 'amber', 'cyan'] },
    status: { control: 'select', options: [undefined, 'online', 'away', 'busy', 'offline'] },
  },
};
export default meta;

type Story = StoryObj<AvatarArgs>;

export const Initials: Story = {};
export const Square: Story = { args: { shape: 'square', color: 'amber', initials: 'BO' } };
export const WithStatus: Story = { args: { status: 'online', color: 'cyan', initials: 'ON' } };
export const Image: Story = {
  args: { src: 'https://placehold.co/80x80/14b8a6/ffffff?text=AS', alt: 'Autumn' },
};

/** Every size in one frame. */
export const AllSizes: Story = {
  loaders: [
    async () => {
      const sizes = ['xs', 'sm', 'md', 'lg', 'xl', '2xl'] as const;
      const parts = await Promise.all(
        sizes.map((s) => renderAstro(Avatar, { props: { size: s, initials: 'AS' } })),
      );
      return { html: `<div class="flex flex-wrap items-end gap-4 p-4">${parts.join('')}</div>` };
    },
  ],
  render: (_args, { loaded }) => loaded.html,
};

/** Every color tone in one frame. */
export const AllColors: Story = {
  loaders: [
    async () => {
      const colors = ['teal', 'amber', 'cyan'] as const;
      const parts = await Promise.all(
        colors.map((c) => renderAstro(Avatar, { props: { color: c, initials: 'AS', size: 'lg' } })),
      );
      return { html: `<div class="flex flex-wrap items-center gap-4 p-4">${parts.join('')}</div>` };
    },
  ],
  render: (_args, { loaded }) => loaded.html,
};
