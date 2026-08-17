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

// Regression: a preselected option whose label/sublabel is longer than the
// trigger's width used to overflow it instead of truncating with an
// ellipsis — the flex-col wrapper had items-start, so each span sized to
// its own text instead of stretching to the trigger's width, and truncate's
// overflow:hidden never had a boundary to actually clip against.
const longOptions: SelectOption[] = [
  {
    value: 'long-1',
    label:
      'Formato de Entrega de Feedback de Evaluación de Desempeño del Área de Nómina y Compensaciones',
    sublabel: 'D-MS-F-012 · v01',
  },
  ...options,
];

export const LongLabel: Story = {
  render: function Render() {
    const [value, setValue] = useState('long-1');
    return (
      <div className="w-64">
        <SearchableSelect options={longOptions} value={value} onChange={setValue} />
      </div>
    );
  },
};
