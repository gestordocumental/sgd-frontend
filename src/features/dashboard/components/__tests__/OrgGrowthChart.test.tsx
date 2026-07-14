import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { OrgGrowthChart } from '../OrgGrowthChart';

describe('OrgGrowthChart', () => {
  it('shows the noDataLabel when every month has a zero count', () => {
    render(
      <OrgGrowthChart
        title="Empresas registradas por mes"
        data={[
          { label: 'Ene', count: 0 },
          { label: 'Feb', count: 0 },
        ]}
        noDataLabel="Sin datos"
      />,
    );

    expect(screen.getByText('Sin datos')).toBeInTheDocument();
  });

  it('renders the count label for every month, including the tallest bar', () => {
    // Regression: the month with the highest count used to have its bar reach
    // y=0, placing the count label (drawn at y-5) outside the SVG viewBox —
    // invisible in the browser even though the bar itself rendered fine.
    const { container } = render(
      <OrgGrowthChart
        title="Empresas registradas por mes"
        data={[
          { label: 'Ene', count: 3 },
          { label: 'Feb', count: 10 }, // the max — previously invisible label
          { label: 'Mar', count: 0 },
        ]}
        noDataLabel="Sin datos"
      />,
    );

    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('10')).toBeInTheDocument();
    expect(screen.getByText('0')).toBeInTheDocument();

    // Every <text> element must stay within the declared viewBox (y >= 0),
    // otherwise browsers clip it and it never becomes visible.
    const svg = container.querySelector('svg')!;
    const texts = Array.from(svg.querySelectorAll('text'));
    for (const text of texts) {
      const y = Number(text.getAttribute('y'));
      expect(y).toBeGreaterThanOrEqual(0);
    }
  });

  it('renders month labels for every bar', () => {
    render(
      <OrgGrowthChart
        title="Empresas registradas por mes"
        data={[
          { label: 'Ene', count: 1 },
          { label: 'Feb', count: 2 },
        ]}
        noDataLabel="Sin datos"
      />,
    );

    expect(screen.getByText('Ene')).toBeInTheDocument();
    expect(screen.getByText('Feb')).toBeInTheDocument();
  });
});
