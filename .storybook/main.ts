import type { StorybookConfig } from '@storybook/react-vite';
import path from 'path';

const config: StorybookConfig = {
  stories: ['../src/**/*.stories.@(ts|tsx)'],
  addons: ['@storybook/addon-essentials'],
  framework: {
    name: '@storybook/react-vite',
    options: {},
  },
  docs: { autodocs: 'tag' },
  viteFinal: async (config) => {
    const { default: tailwindcss } = await import('@tailwindcss/vite');

    // Drop plugins that are only relevant to the app (routing, CSP workaround).
    config.plugins = (config.plugins ?? []).filter((p) => {
      if (!p || typeof p !== 'object' || !('name' in p)) return true;
      const n = (p as { name: string }).name;
      return n !== 'tanstack-router-vite-plugin' && n !== 'sonner-no-inject-css';
    });
    config.plugins.push(tailwindcss());

    config.resolve ??= {};
    config.resolve.alias = {
      ...(config.resolve.alias as Record<string, string>),
      '@': path.resolve(process.cwd(), 'src'),
    };

    return config;
  },
};

export default config;
