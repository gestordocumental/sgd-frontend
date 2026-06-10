import '../src/index.css';
import '../src/i18n'; // initializes i18next so components using useTranslation work
import { useEffect } from 'react';
import type { Decorator, Preview } from '@storybook/react';

const DARK_BG = 'hsl(222 47% 5%)';

// Toggle the `.dark` class on <html> to match the selected Storybook background.
const DarkModeDecorator: Decorator = (Story, context) => {
  const bg = context.globals.backgrounds?.value;
  useEffect(() => {
    document.documentElement.classList.toggle('dark', bg === DARK_BG);
    return () => document.documentElement.classList.remove('dark');
  }, [bg]);
  return <Story />;
};

const preview: Preview = {
  decorators: [DarkModeDecorator],
  parameters: {
    layout: 'centered',
    backgrounds: {
      default: 'light',
      values: [
        { name: 'light', value: 'hsl(0 0% 100%)' },
        { name: 'dark', value: DARK_BG },
      ],
    },
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
  },
};

export default preview;
