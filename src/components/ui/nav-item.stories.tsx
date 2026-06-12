import type { Meta, StoryObj } from '@storybook/react';
import { HomeIcon, UsersIcon, FileTextIcon, SettingsIcon } from 'lucide-react';
import { NavItem } from './nav-item';

const meta: Meta<typeof NavItem> = {
  title: 'UI/NavItem',
  component: NavItem,
  tags: ['autodocs'],
  parameters: { layout: 'centered' },
  argTypes: {
    active: { control: 'boolean' },
  },
};
export default meta;
type Story = StoryObj<typeof NavItem>;

export const Default: Story = {
  args: { icon: <HomeIcon className="size-4" />, label: 'Dashboard', active: false },
};

export const Active: Story = {
  args: { icon: <HomeIcon className="size-4" />, label: 'Dashboard', active: true },
};

export const NavList: Story = {
  render: () => (
    <div className="w-48 space-y-1">
      <NavItem icon={<HomeIcon className="size-4" />} label="Dashboard" active />
      <NavItem icon={<UsersIcon className="size-4" />} label="Users" />
      <NavItem icon={<FileTextIcon className="size-4" />} label="Documents" />
      <NavItem icon={<SettingsIcon className="size-4" />} label="Settings" />
    </div>
  ),
};
