import type { Meta, StoryObj } from '@storybook/react';
import { UsersIcon, FileTextIcon, BuildingIcon, CheckCircleIcon } from 'lucide-react';
import { StatCard } from './stat-card';

const meta: Meta<typeof StatCard> = {
  title: 'UI/StatCard',
  component: StatCard,
  tags: ['autodocs'],
  parameters: { layout: 'centered' },
};
export default meta;
type Story = StoryObj<typeof StatCard>;

export const Default: Story = {
  args: {
    title: 'Total Users',
    value: 1_234,
    icon: <UsersIcon className="size-4 text-muted-foreground" />,
  },
};

export const Dashboard: Story = {
  render: () => (
    <div className="grid grid-cols-2 gap-4 w-96">
      <StatCard
        title="Users"
        value={1_234}
        icon={<UsersIcon className="size-4 text-muted-foreground" />}
      />
      <StatCard
        title="Documents"
        value={5_678}
        icon={<FileTextIcon className="size-4 text-muted-foreground" />}
      />
      <StatCard
        title="Companies"
        value={42}
        icon={<BuildingIcon className="size-4 text-muted-foreground" />}
      />
      <StatCard
        title="Approved"
        value={891}
        icon={<CheckCircleIcon className="size-4 text-muted-foreground" />}
      />
    </div>
  ),
};
