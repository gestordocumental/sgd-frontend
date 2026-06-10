import type { Meta, StoryObj } from '@storybook/react';
import { FormField } from './form-field';
import { Input } from './input';

const meta: Meta<typeof FormField> = {
  title: 'UI/FormField',
  component: FormField,
  tags: ['autodocs'],
  parameters: { layout: 'centered' },
};
export default meta;
type Story = StoryObj<typeof FormField>;

export const Default: Story = {
  render: () => (
    <div className="w-72">
      <FormField id="email" label="Email address">
        <Input id="email" type="email" placeholder="you@example.com" />
      </FormField>
    </div>
  ),
};

export const WithDescription: Story = {
  render: () => (
    <div className="w-72">
      <FormField id="username" label="Username" description="Must be 3–20 characters.">
        <Input id="username" placeholder="johndoe" />
      </FormField>
    </div>
  ),
};

export const WithError: Story = {
  render: () => (
    <div className="w-72">
      <FormField id="password" label="Password" error="validation.required">
        <Input id="password" type="password" aria-invalid />
      </FormField>
    </div>
  ),
};
