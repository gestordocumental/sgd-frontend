import type { Meta, StoryObj } from '@storybook/react';
import { Trash2Icon, PlusIcon, SearchIcon } from 'lucide-react';
import { Button } from './button';

const meta: Meta<typeof Button> = {
  title: 'UI/Button',
  component: Button,
  tags: ['autodocs'],
  argTypes: {
    variant: {
      control: 'select',
      options: ['default', 'outline', 'secondary', 'ghost', 'destructive', 'link'],
    },
    size: {
      control: 'select',
      options: ['default', 'xs', 'sm', 'lg', 'icon', 'icon-xs', 'icon-sm', 'icon-lg'],
    },
    disabled: { control: 'boolean' },
  },
};
export default meta;
type Story = StoryObj<typeof Button>;

export const Default: Story = { args: { children: 'Button', variant: 'default' } };
export const Outline: Story = { args: { children: 'Outline', variant: 'outline' } };
export const Secondary: Story = { args: { children: 'Secondary', variant: 'secondary' } };
export const Ghost: Story = { args: { children: 'Ghost', variant: 'ghost' } };
export const Destructive: Story = { args: { children: 'Delete', variant: 'destructive' } };
export const Disabled: Story = { args: { children: 'Disabled', disabled: true } };

export const WithIcon: Story = {
  args: {
    children: (
      <>
        <PlusIcon />
        Add item
      </>
    ),
    variant: 'default',
  },
};

export const IconOnly: Story = {
  args: { children: <SearchIcon />, size: 'icon', variant: 'outline', 'aria-label': 'Search' },
};

export const AllVariants: Story = {
  render: () => (
    <div className="flex flex-wrap gap-2">
      {(['default', 'outline', 'secondary', 'ghost', 'destructive', 'link'] as const).map((v) => (
        <Button key={v} variant={v}>
          {v}
        </Button>
      ))}
    </div>
  ),
};

export const AllSizes: Story = {
  render: () => (
    <div className="flex flex-wrap items-center gap-2">
      {(['xs', 'sm', 'default', 'lg'] as const).map((s) => (
        <Button key={s} size={s}>
          {s}
        </Button>
      ))}
      <Button size="icon" aria-label="icon">
        <Trash2Icon />
      </Button>
    </div>
  ),
};
