import type { Preview } from '@storybook/html-vite';
import { withThemeByDataAttribute } from '@storybook/addon-themes';

// The single master stylesheet — daisyUI + @opensided/theme + iconify (Lucide) +
// every per-component CSS. This is the ONLY way styles reach Container-rendered HTML.
import '../src/styles/global.css';
// SocialButton / brand marks use FontAwesome (loaded app-wide in production).
import '@fortawesome/fontawesome-free/css/fontawesome.min.css';
import '@fortawesome/fontawesome-free/css/brands.min.css';
import '@fortawesome/fontawesome-free/css/solid.min.css';

const preview: Preview = {
  // Body background comes from the theme's --root-bg token, not SB backgrounds.
  parameters: { backgrounds: { disable: true } },
  globalTypes: {
    fontFamily: {
      description: 'Brand font',
      defaultValue: 'urbanist',
      toolbar: {
        title: 'Font',
        items: [
          { value: 'urbanist', title: 'Urbanist' },
          { value: 'geist', title: 'Geist' },
          { value: 'default', title: 'System' },
        ],
      },
    },
  },
  decorators: [
    // Light/dark toolbar — sets data-theme on <html> exactly as production does.
    withThemeByDataAttribute({
      themes: { Light: 'baseout-light', Dark: 'baseout' },
      defaultTheme: 'Light',
      attributeName: 'data-theme',
    }),
    // Brand-font toolbar → data-font-family on <html> (mapped in @opensided/theme).
    (story, ctx) => {
      document.documentElement.setAttribute(
        'data-font-family',
        (ctx.globals.fontFamily as string) ?? 'urbanist',
      );
      return story();
    },
  ],
};

export default preview;
