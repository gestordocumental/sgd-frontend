import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import { SearchableSelect, type SelectOption } from './searchable-select';

const options: SelectOption[] = [
  { value: 'co', label: 'Colombia', sublabel: 'COL' },
  { value: 'mx', label: 'México', sublabel: 'MEX' },
  { value: 'ar', label: 'Argentina', sublabel: 'ARG' },
  { value: 'cl', label: 'Chile', sublabel: 'CHL' },
  { value: 'pe', label: 'Perú', sublabel: 'PER' },
];

const meta: Meta<typeof SearchableSelect> = {
  title: 'UI/SearchableSelect',
  component: SearchableSelect,
  tags: ['autodocs'],
  parameters: { layout: 'centered' },
};
export default meta;
type Story = StoryObj<typeof SearchableSelect>;

export const Default: Story = {
  render: function Render() {
    const [value, setValue] = useState('');
    return (
      <div className="w-64">
        <SearchableSelect options={options} value={value} onChange={setValue} />
      </div>
    );
  },
};

export const Preselected: Story = {
  render: function Render() {
    const [value, setValue] = useState('co');
    return (
      <div className="w-64">
        <SearchableSelect options={options} value={value} onChange={setValue} />
      </div>
    );
  },
};

export const Disabled: Story = {
  render: () => (
    <div className="w-64">
      <SearchableSelect options={options} value="mx" onChange={() => {}} disabled />
    </div>
  ),
};
