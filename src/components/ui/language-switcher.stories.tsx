import type { Meta, StoryObj } from '@storybook/react';
import { LanguageSwitcher } from './language-switcher';

const meta: Meta<typeof LanguageSwitcher> = {
  title: 'UI/LanguageSwitcher',
  component: LanguageSwitcher,
  tags: ['autodocs'],
  parameters: { layout: 'centered' },
};
export default meta;
type Story = StoryObj<typeof LanguageSwitcher>;

export const Default: Story = {};
