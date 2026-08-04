import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import i18n from '@/i18n';
import { RecentOrgsList } from '../RecentOrgsList';
import type { ApiCompany } from '@/lib/api/companies';

function makeCompany(overrides: Partial<ApiCompany> = {}): ApiCompany {
  return {
    id: 'org-1',
    name: 'Acme Corp',
    nit: null,
    address: null,
    phone: null,
    status: 'active',
    createdBy: null,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
    deletedAt: null,
    ...overrides,
    reviewCycleEnabled: overrides.reviewCycleEnabled ?? true,
  };
}

describe('RecentOrgsList', () => {
  it('shows the noData message when there are no companies', () => {
    render(<RecentOrgsList companies={[]} />);

    expect(screen.getByText('No data yet')).toBeInTheDocument();
  });

  it('renders the date next to a long company name without either being dropped', () => {
    // Regression: the name span had `truncate` but no `min-w-0`. Flex items
    // default to `min-width: auto`, so a long name's content width overrode
    // `truncate` and pushed the date/status badge out of the row instead of
    // the name itself getting the ellipsis.
    const longName =
      'Corporación Internacional de Servicios Administrativos y Logísticos de Latinoamérica S.A.S.';
    // Noon UTC keeps the calendar date stable across the runner's local
    // timezone (avoids a midnight-UTC date shifting to the prior/next day).
    const createdAt = '2024-03-15T12:00:00Z';
    render(
      <RecentOrgsList companies={[makeCompany({ id: 'org-long', name: longName, createdAt })]} />,
    );

    const nameEl = screen.getByText(longName);
    expect(nameEl).toBeInTheDocument();
    // The fix that keeps the date visible alongside a long name.
    expect(nameEl.className).toContain('min-w-0');
    expect(nameEl.className).toContain('truncate');
    const expectedDate = new Date(createdAt).toLocaleDateString(
      i18n.resolvedLanguage ?? i18n.language,
    );
    expect(screen.getByText(expectedDate)).toBeInTheDocument();
  });

  it('lays out the name, date, and status in three balanced columns', () => {
    // Date and status are independent grid cells so they keep a proportional
    // distance from the company name and from each other.
    render(<RecentOrgsList companies={[makeCompany({ name: 'Acme Corp' })]} />);

    const nameWrapper = screen.getByText('Acme Corp').closest('div');
    expect(nameWrapper).not.toBeNull();

    const dateEl = screen.getByText(
      new Date('2024-01-01T00:00:00Z').toLocaleDateString(i18n.resolvedLanguage ?? i18n.language),
    );
    const badgeEl = screen.getByText('Active');
    const row = nameWrapper!.parentElement;

    expect(row).not.toBeNull();
    expect(row!.className).toContain('grid');
    expect(row!.className).toContain('grid-cols-12');
    expect(dateEl.parentElement).toBe(row);
    expect(badgeEl.parentElement).toBe(row);
    expect(nameWrapper!.className).toContain('col-span-6');
    expect(dateEl.className).toContain('col-span-3');
    expect(badgeEl.className).toContain('col-span-3');
    expect(dateEl.className).toContain('justify-self-center');
    expect(badgeEl.className).toContain('justify-self-end');
  });

  it('sorts companies by createdAt descending and caps the list at 8', () => {
    const companies = Array.from({ length: 10 }, (_, i) =>
      makeCompany({
        id: `org-${i}`,
        name: `Org ${i}`,
        createdAt: new Date(2024, 0, i + 1).toISOString(),
      }),
    );

    render(<RecentOrgsList companies={companies} />);

    expect(screen.getByText('Org 9')).toBeInTheDocument(); // most recent
    expect(screen.queryByText('Org 1')).not.toBeInTheDocument(); // beyond the cap of 8
  });
});
