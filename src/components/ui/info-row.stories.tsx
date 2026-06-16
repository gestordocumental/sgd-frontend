import type { Meta, StoryObj } from '@storybook/react';
import { InfoRow } from './info-row';

const meta: Meta<typeof InfoRow> = {
  title: 'UI/InfoRow',
  component: InfoRow,
  tags: ['autodocs'],
  parameters: { layout: 'centered' },
};
export default meta;
type Story = StoryObj<typeof InfoRow>;

export const Default: Story = {
  args: { label: 'Company', value: 'Helisa S.A.S.' },
};

export const Monospace: Story = {
  args: { label: 'Document ID', value: 'DOC-2024-001234', mono: true },
};

export const MultipleRows: Story = {
  render: () => (
    <div className="space-y-4 w-64">
      <InfoRow label="Full name" value="Juan Carlos Pérez" />
      <InfoRow label="Email" value="juan@helisa.com" />
      <InfoRow label="Reference" value="REF-000042" mono />
    </div>
  ),
};
