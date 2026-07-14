import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@/i18n';
import { UsersPerOrgChart } from '../UsersPerOrgChart';
import type { ApiCompany } from '@/lib/api/companies';
import type { OrgUserCount } from '@/lib/api/users';

const COMPANIES: ApiCompany[] = [
  {
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
  },
];

function makeCount(overrides: Partial<OrgUserCount> = {}): OrgUserCount {
  return {
    orgId: 'org-1',
    total: 8,
    active: 6,
    inactive: 0,
    deleted: 2,
    ...overrides,
  };
}

describe('UsersPerOrgChart', () => {
  it('shows a loading skeleton while loading', () => {
    const { container } = render(
      <UsersPerOrgChart counts={[]} companies={COMPANIES} loading={true} />,
    );

    expect(container.querySelectorAll('.animate-pulse')).toHaveLength(3);
  });

  it('shows the noData message when there are no counts', () => {
    render(<UsersPerOrgChart counts={[]} companies={COMPANIES} loading={false} />);

    expect(screen.getByText('No data yet')).toBeInTheDocument();
  });

  it('renders the "Deleted" legend alongside active/inactive', () => {
    render(<UsersPerOrgChart counts={[makeCount()]} companies={COMPANIES} loading={false} />);

    expect(screen.getByText('Active')).toBeInTheDocument();
    expect(screen.getByText('Inactive')).toBeInTheDocument();
    expect(screen.getByText('Deleted')).toBeInTheDocument();
  });

  it('renders a deleted bar segment sized proportionally to the deleted count', () => {
    render(
      <UsersPerOrgChart
        counts={[makeCount({ total: 10, active: 6, inactive: 0, deleted: 4 })]}
        companies={COMPANIES}
        loading={false}
      />,
    );

    const meter = screen.getByRole('meter');
    // Scoped to the meter itself — active, inactive, deleted segments, in that
    // order — since the row also has its own aria-hidden breakdown text below it.
    const segments = meter.querySelectorAll('[aria-hidden="true"]');
    expect(segments).toHaveLength(3);
    expect(segments[2]).toHaveStyle({ width: '40%' }); // 4 / maxTotal(10) * 100
    expect(meter).toBeInTheDocument();
  });

  it('shows the active/inactive/deleted breakdown as explicit numbers per company', () => {
    // The bar alone doesn't make the exact counts clear at a glance — each row
    // must also spell out "N activos / N inactivos / N eliminados" in text.
    render(
      <UsersPerOrgChart
        counts={[makeCount({ total: 11, active: 6, inactive: 1, deleted: 4 })]}
        companies={COMPANIES}
        loading={false}
      />,
    );

    expect(screen.getByText(/6 Active/)).toBeInTheDocument();
    expect(screen.getByText(/1 Inactive/)).toBeInTheDocument();
    expect(screen.getByText(/4 Deleted/)).toBeInTheDocument();
  });

  it('includes the deleted count in the bar aria-label', () => {
    render(
      <UsersPerOrgChart
        counts={[makeCount({ total: 8, active: 6, inactive: 0, deleted: 2 })]}
        companies={COMPANIES}
        loading={false}
      />,
    );

    expect(
      screen.getByLabelText('Acme Corp: 6 active, 0 inactive, 2 deleted (of 8 users)'),
    ).toBeInTheDocument();
  });

  it('falls back to a truncated orgId when the company name is unknown', () => {
    render(
      <UsersPerOrgChart
        counts={[makeCount({ orgId: 'unknown-org-id' })]}
        companies={COMPANIES}
        loading={false}
      />,
    );

    expect(screen.getByText('unknown-')).toBeInTheDocument();
  });
});
