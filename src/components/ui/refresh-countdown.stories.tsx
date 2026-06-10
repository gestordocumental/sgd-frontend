import type { Meta, StoryObj } from '@storybook/react';
import { RefreshCountdown } from './refresh-countdown';

const meta: Meta<typeof RefreshCountdown> = {
  title: 'UI/RefreshCountdown',
  component: RefreshCountdown,
  tags: ['autodocs'],
  parameters: { layout: 'centered' },
};
export default meta;
type Story = StoryObj<typeof RefreshCountdown>;

export const Counting: Story = {
  args: { duration: 30_000, isFetching: false, updatedAt: Date.now() },
};

export const Fetching: Story = {
  args: { duration: 30_000, isFetching: true, updatedAt: Date.now() },
};

export const ShortDuration: Story = {
  args: { duration: 5_000, isFetching: false, updatedAt: Date.now() },
};
