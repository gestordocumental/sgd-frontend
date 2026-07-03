import type { Meta, StoryObj } from '@storybook/react';
import { Input } from './input';

const meta: Meta<typeof Input> = {
  title: 'UI/Input',
  component: Input,
  tags: ['autodocs'],
  parameters: { layout: 'centered' },
  argTypes: { type: { control: 'text' } },
};
export default meta;
type Story = StoryObj<typeof Input>;

export const Default: Story = {
  args: { placeholder: 'Enter text…', className: 'w-72' },
};

export const Password: Story = {
  args: { type: 'password', placeholder: 'Password', className: 'w-72' },
};

export const Disabled: Story = {
  args: { placeholder: 'Disabled', disabled: true, className: 'w-72' },
};

export const Invalid: Story = {
  args: { placeholder: 'Invalid value', 'aria-invalid': true, className: 'w-72' },
};

export const WithValue: Story = {
  args: { defaultValue: 'Pre-filled value', className: 'w-72' },
};
