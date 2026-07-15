import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import '@/i18n';
import { DonutChart } from '../DonutChart';

describe('DonutChart', () => {
  it('keeps a zero-value slice visible in the legend instead of hiding it', () => {
    // Regression: a slice with value === 0 used to be filtered out of the
    // legend entirely, so a known category with no members vanished — no way
    // to tell "0" apart from "this category doesn't exist here".
    render(
      <DonutChart
        title="Active / inactive users"
        centerLabel="users"
        noDataLabel="No data"
        slices={[
          { label: 'Active', value: 3, color: '#6366f1' },
          { label: 'Inactive', value: 0, color: '#f87171' },
        ]}
      />,
    );

    const card = screen.getByText('Active / inactive users').closest('div');
    expect(card).not.toBeNull();
    expect(within(card!).getByText('Inactive')).toBeInTheDocument();
    expect(within(card!).getByText('0')).toBeInTheDocument();
    expect(within(card!).getByText('0%')).toBeInTheDocument();
  });

  it('shows the noDataLabel when every slice is zero', () => {
    render(
      <DonutChart
        title="Active / inactive users"
        noDataLabel="No data"
        slices={[
          { label: 'Active', value: 0, color: '#6366f1' },
          { label: 'Inactive', value: 0, color: '#f87171' },
        ]}
      />,
    );

    expect(screen.getByText('No data')).toBeInTheDocument();
    expect(screen.queryByText('Inactive')).not.toBeInTheDocument();
  });
});
