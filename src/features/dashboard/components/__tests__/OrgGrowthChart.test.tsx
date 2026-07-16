import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@/i18n';
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

  it('gives each bar a precise, accessible description (aria-label + native tooltip)', () => {
    // Same clarity issue reported on the weekly workflow chart: a bare number
    // next to a month label doesn't say what is being counted.
    const { container } = render(
      <OrgGrowthChart
        title="Empresas registradas por mes"
        data={[
          { label: 'Ene', count: 0 },
          { label: 'Feb', count: 1 },
        ]}
        noDataLabel="Sin datos"
      />,
    );

    // Resolves the element's accessible name via role="img" + aria-label —
    // would fail to find anything if aria-label were removed, unlike a bare
    // getByText() which would still match the sibling <title> text node.
    expect(screen.getByRole('img', { name: 'Ene: 0 companies registered' })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Feb: 1 company registered' })).toBeInTheDocument();

    // Also verify the native-tooltip <title> elements directly, independent of aria-label.
    const titles = Array.from(container.querySelectorAll('svg > g > title')).map(
      (el) => el.textContent,
    );
    expect(titles).toEqual(['Ene: 0 companies registered', 'Feb: 1 company registered']);
  });
});
