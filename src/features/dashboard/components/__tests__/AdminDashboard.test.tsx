import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import '@/i18n';
import { AdminDashboard } from '../AdminDashboard';
import type { ApiUser } from '@/lib/api/users';
import type { ApiCompany } from '@/lib/api/companies';
import { formatBytes } from '@/lib/formatters';

function makeUser(overrides: Partial<ApiUser> = {}): ApiUser {
  return {
    id: `user-${Math.random()}`,
    firstName: 'Ana',
    lastName: 'Lopez',
    position: 'Dev',
    idNumber: null,
    departamentoId: null,
    areaId: null,
    cargoId: null,
    email: 'ana@test.com',
    registrationStatus: 'active',
    isActive: true,
    isSuperAdmin: false,
    avatarUrl: null,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
    deletedAt: null,
    ...overrides,
  };
}

function makeCompany(overrides: Partial<ApiCompany> = {}): ApiCompany {
  return {
    id: `org-${Math.random()}`,
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
  };
}

function renderDashboard(users: ApiUser[]) {
  // companies=[] keeps the org-status donut's slices at 0 (hidden), so its
  // "Active"/"Inactive" labels don't collide with the users donut's own
  // identically-worded labels when queried by text. orgUserCountsLoading=true
  // keeps UsersPerOrgChart on its skeleton (it renders its own always-visible
  // "Active"/"Inactive"/"Deleted" legend once loaded), for the same reason.
  render(
    <AdminDashboard
      companies={[]}
      users={users}
      loading={false}
      storageStats={[]}
      storageLoading={false}
      orgUserCounts={[]}
      orgUserCountsLoading={true}
    />,
  );
}

describe('AdminDashboard — Usuarios indicators', () => {
  it('counts every registered user in "Total users", regardless of the isSuperAdmin flag', () => {
    // Regression: a user's global isSuperAdmin flag is an unrelated privilege —
    // it must not make them disappear from the platform-wide user count. Out
    // of 12 users, 8 happen to be (incorrectly or not) flagged isSuperAdmin;
    // the KPI must still show all 12, not just the 4 that aren't flagged.
    const users = [
      ...Array.from({ length: 4 }, (_, i) => makeUser({ id: `regular-${i}`, isActive: true })),
      ...Array.from({ length: 8 }, (_, i) =>
        makeUser({ id: `flagged-${i}`, isSuperAdmin: true, isActive: i < 3 }),
      ),
    ];

    renderDashboard(users);

    // Scoped to the KPI card itself: "12" also legitimately appears as the
    // "Users (global)" donut's center total (7 active + 5 inactive), so a
    // bare screen.getByText('12') matches both elements.
    const totalUsersLabel = screen.getByText('Total users');
    const kpiCard = totalUsersLabel.closest('div');
    expect(kpiCard).not.toBeNull();
    expect(within(kpiCard!).getByText('12')).toBeInTheDocument();
  });

  it('splits active/inactive for the "Users (global)" donut across all users, not just non-super-admins', () => {
    const users = [
      ...Array.from({ length: 7 }, (_, i) => makeUser({ id: `active-${i}`, isActive: true })),
      ...Array.from({ length: 5 }, (_, i) =>
        makeUser({ id: `inactive-${i}`, isActive: false, isSuperAdmin: i < 3 }),
      ),
    ];

    renderDashboard(users);

    expect(screen.getByText('Users (global)')).toBeInTheDocument();
    expect(screen.getByText('Active')).toBeInTheDocument();
    expect(screen.getByText('Inactive')).toBeInTheDocument();
    expect(screen.getByText('7')).toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument();
  });

  it('excludes soft-deleted users from "Total users" and does not fold them into "Inactive"', () => {
    // Regression: inactiveUsers was computed as `users.length - activeUsers`,
    // so a deletedAt user (neither counted as active nor filtered out first)
    // silently inflated the "Inactive" slice — 6 real inactive users plus 2
    // deleted ones showed up as "8 inactive".
    const users = [
      ...Array.from({ length: 6 }, (_, i) => makeUser({ id: `active-${i}`, isActive: true })),
      ...Array.from({ length: 6 }, (_, i) => makeUser({ id: `inactive-${i}`, isActive: false })),
      ...Array.from({ length: 2 }, (_, i) =>
        makeUser({ id: `deleted-${i}`, isActive: false, deletedAt: '2024-06-01T00:00:00Z' }),
      ),
    ];

    renderDashboard(users);

    // 12 non-deleted users (6 active + 6 inactive), not 14.
    const totalUsersLabel = screen.getByText('Total users');
    const kpiCard = totalUsersLabel.closest('div');
    expect(kpiCard).not.toBeNull();
    expect(within(kpiCard!).getByText('12')).toBeInTheDocument();

    // "Inactive" must read 6, not 8 — the 2 deleted users must not count here.
    const inactiveLabel = screen.getByText('Inactive');
    const donutSlice = inactiveLabel.closest('li') ?? inactiveLabel.parentElement;
    expect(donutSlice).not.toBeNull();
    expect(within(donutSlice!).getByText('6')).toBeInTheDocument();
  });
});

describe('AdminDashboard — org boards exclude soft-deleted organizations', () => {
  // Regression: GET /org (default 'all' filter, used by the shared companies
  // hook) returns soft-deleted orgs too — the CompaniesTable needs that so
  // admins can find/restore them. The dashboard boards must not: a
  // soft-deleted org still having historical rows in another service (users,
  // storage) must not inflate "Organizaciones", "Estado de organizaciones",
  // "Organizaciones recientes", "Usuarios por organización" or "Espacio
  // usado por organización".
  const activeCo = makeCompany({ id: 'org-active', name: 'Org Activa', status: 'active' });
  const inactiveCo = makeCompany({ id: 'org-inactive', name: 'Org Inactiva', status: 'inactive' });
  const deletedCo = makeCompany({
    id: 'org-deleted',
    name: 'Org Eliminada',
    status: 'active',
    deletedAt: '2024-06-01T00:00:00Z',
  });
  const companies = [activeCo, inactiveCo, deletedCo];

  it('excludes deleted orgs from the "Organizaciones" KPI and active/inactive sub-count', () => {
    render(
      <AdminDashboard
        companies={companies}
        users={[]}
        loading={false}
        storageStats={[]}
        storageLoading={false}
        orgUserCounts={[]}
        orgUserCountsLoading={true}
      />,
    );

    const orgsLabel = screen.getByText('Organizations');
    const kpiCard = orgsLabel.closest('div');
    expect(kpiCard).not.toBeNull();
    // 2 non-deleted orgs (active + inactive), not 3.
    expect(within(kpiCard!).getByText('2')).toBeInTheDocument();
    expect(screen.getByText('1 active · 1 inactive')).toBeInTheDocument();
  });

  it('excludes a deleted org from "Organizaciones recientes"', () => {
    render(
      <AdminDashboard
        companies={companies}
        users={[]}
        loading={false}
        storageStats={[]}
        storageLoading={false}
        orgUserCounts={[]}
        orgUserCountsLoading={true}
      />,
    );

    expect(screen.getByText('Org Activa')).toBeInTheDocument();
    expect(screen.getByText('Org Inactiva')).toBeInTheDocument();
    expect(screen.queryByText('Org Eliminada')).not.toBeInTheDocument();
  });

  it('drops a deleted org\'s row from "Usuarios por organización" even if user-service still has historical counts for it', () => {
    render(
      <AdminDashboard
        companies={companies}
        users={[]}
        loading={false}
        storageStats={[]}
        storageLoading={false}
        orgUserCounts={[
          { orgId: 'org-active', total: 5, active: 5, inactive: 0, deleted: 0 },
          { orgId: 'org-deleted', total: 9, active: 9, inactive: 0, deleted: 0 },
        ]}
        orgUserCountsLoading={false}
      />,
    );

    // "Org Activa" also renders in "Organizaciones recientes" — only presence matters here.
    expect(screen.getAllByText('Org Activa').length).toBeGreaterThan(0);
    // The deleted org's own name would only render if its row survived the
    // filter (companies excludes it, so the chart would otherwise fall back
    // to showing a truncated org id for that row instead of dropping it).
    expect(screen.queryByText('org-delet')).not.toBeInTheDocument();
    expect(screen.queryByText('9')).not.toBeInTheDocument();
  });

  it('drops a deleted org\'s row from "Espacio usado por organización" even if storage stats still reference it', () => {
    render(
      <AdminDashboard
        companies={companies}
        users={[]}
        loading={false}
        storageStats={[
          {
            orgId: 'org-active',
            storageTotalBytes: 1024,
            uploadedDocuments: 1,
            workflowAttachments: 0,
          },
          {
            orgId: 'org-deleted',
            storageTotalBytes: 999_999_999,
            uploadedDocuments: 42,
            workflowAttachments: 0,
          },
        ]}
        storageLoading={false}
        orgUserCounts={[]}
        orgUserCountsLoading={true}
      />,
    );

    expect(screen.getAllByText('Org Activa').length).toBeGreaterThan(0);
    expect(screen.queryByText('org-delet')).not.toBeInTheDocument();
    // Total storage KPI must reflect only the non-deleted org's bytes (1024),
    // not the deleted org's ~1 GB. Scoped to the KPI card itself, since the
    // per-org chart row for "Org Activa" legitimately shows the same value.
    const storageLabel = screen.getByText('Storage used');
    const kpiCard = storageLabel.closest('div');
    expect(kpiCard).not.toBeNull();
    expect(within(kpiCard!).getByText(formatBytes(1024))).toBeInTheDocument();
    expect(within(kpiCard!).queryByText(formatBytes(1024 + 999_999_999))).not.toBeInTheDocument();
  });
});
