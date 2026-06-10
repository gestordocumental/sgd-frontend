import type { Meta, StoryObj } from '@storybook/react';
import { toast } from 'sonner';
import { ThemeProvider } from 'next-themes';
import { Toaster } from './sonner';
import { Button } from './button';

const meta: Meta = {
  title: 'UI/Toaster',
  tags: ['autodocs'],
  parameters: { layout: 'centered' },
  decorators: [
    (Story) => (
      <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
        <Story />
        <Toaster />
      </ThemeProvider>
    ),
  ],
};
export default meta;
type Story = StoryObj;

export const Success: Story = {
  render: () => (
    <Button onClick={() => toast.success('Document saved successfully.')}>
      Show success toast
    </Button>
  ),
};

export const Error: Story = {
  render: () => (
    <Button variant="destructive" onClick={() => toast.error('Failed to save document.')}>
      Show error toast
    </Button>
  ),
};

export const Info: Story = {
  render: () => (
    <Button variant="outline" onClick={() => toast.info('3 documents pending review.')}>
      Show info toast
    </Button>
  ),
};

export const AllTypes: Story = {
  render: () => (
    <div className="flex flex-wrap gap-2">
      <Button size="sm" onClick={() => toast.success('Saved!')}>
        Success
      </Button>
      <Button size="sm" variant="destructive" onClick={() => toast.error('Error!')}>
        Error
      </Button>
      <Button size="sm" variant="outline" onClick={() => toast.info('Info')}>
        Info
      </Button>
      <Button size="sm" variant="secondary" onClick={() => toast.warning('Warning!')}>
        Warning
      </Button>
    </div>
  ),
};
