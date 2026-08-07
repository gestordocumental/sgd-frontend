import { describe, it, expect, vi } from 'vitest';
import { render, screen, within, fireEvent } from '@testing-library/react';
import '@/i18n';
import { OrgDashboard } from '../OrgDashboard';
import type { TypologyStats } from '@/lib/api/typologies';
import type { WorkflowStats } from '@/lib/api/workflows';
import type { ApiUserWithRoles } from '@/lib/api/users';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const TYPOLOGY_STATS: TypologyStats = {
  totalTypologies: 25,
  activeTypologies: 7,
  uploadedDocuments: 5,
  storageTotalBytes: 1_000_000,
  extractionStatusCounts: { COMPLETED: 3, FAILED: 1 },
};

const WORKFLOW_STATS: WorkflowStats = {
  totalWorkflows: 12,
  statusCounts: { PENDING_APPROVAL: 4, CLOSED: 8 },
  myPendingTasks: 2,
  weeklyTrend: [{ week: '01/01', count: 3 }],
  storageTotalBytes: 2_000_000,
  totalAttachments: 9,
};

function makeUser(overrides: Partial<ApiUserWithRoles> = {}): ApiUserWithRoles {
  return {
    id: 'u-1',
    firstName: 'Ada',
    lastName: 'Lovelace',
    position: 'Engineer',
    idNumber: null,
    departamentoId: null,
    areaId: null,
    cargoId: null,
    email: 'ada@test.com',
    registrationStatus: 'active',
    isActive: true,
    isSuperAdmin: false,
    avatarUrl: null,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
    deletedAt: null,
    roles: [],
    orgRemovedAt: null,
    isOptionalReviewer: false,
    ...overrides,
  };
}

const USERS: ApiUserWithRoles[] = [makeUser()];

function renderDashboard(overrides: Partial<Parameters<typeof OrgDashboard>[0]> = {}) {
  return render(
    <OrgDashboard
      typologyStats={TYPOLOGY_STATS}
      workflowStats={WORKFLOW_STATS}
      isLoading={false}
      users={USERS}
      usersLoading={false}
      canViewOrgStructure={true}
      canViewWorkflows={true}
      canViewUsers={true}
      {...overrides}
    />,
  );
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('OrgDashboard — permission-gated sections', () => {
  it('shows every section when all three permissions are granted', () => {
    renderDashboard();

    expect(screen.getByText('Active typologies')).toBeInTheDocument();
    expect(screen.getByText('Total workflows')).toBeInTheDocument();
    expect(screen.getByText('My pending tasks')).toBeInTheDocument();
    expect(screen.getByText('Users')).toBeInTheDocument();
  });

  it('hides typology-only sections without ORG_STRUCTURE:READ', () => {
    renderDashboard({ canViewOrgStructure: false });

    expect(screen.queryByText('Active typologies')).not.toBeInTheDocument();
    // Workflow-only sections remain
    expect(screen.getByText('Total workflows')).toBeInTheDocument();
    expect(screen.getByText('Users')).toBeInTheDocument();
  });

  it('hides workflow-only sections without WORKFLOWS:READ', () => {
    renderDashboard({ canViewWorkflows: false });

    expect(screen.queryByText('Total workflows')).not.toBeInTheDocument();
    expect(screen.queryByText('My pending tasks')).not.toBeInTheDocument();
    // Typology and users sections remain
    expect(screen.getByText('Active typologies')).toBeInTheDocument();
    expect(screen.getByText('Users')).toBeInTheDocument();
  });

  it('hides the users KPI and both user donuts without USERS:READ', () => {
    renderDashboard({ canViewUsers: false });

    expect(screen.queryByText('Users')).not.toBeInTheDocument();
    expect(screen.queryByText('Active / inactive users')).not.toBeInTheDocument();
    // Other sections remain
    expect(screen.getByText('Active typologies')).toBeInTheDocument();
    expect(screen.getByText('Total workflows')).toBeInTheDocument();
  });

  it('hides every section, including the combined "documents/storage" KPIs, when no permission is granted', () => {
    renderDashboard({ canViewOrgStructure: false, canViewWorkflows: false, canViewUsers: false });

    expect(screen.queryByText('Active typologies')).not.toBeInTheDocument();
    expect(screen.queryByText('Total workflows')).not.toBeInTheDocument();
    expect(screen.queryByText('My pending tasks')).not.toBeInTheDocument();
    expect(screen.queryByText('Users')).not.toBeInTheDocument();
    // The combined KPIs are also hidden when neither module backing them is visible
    expect(screen.queryByText('Uploaded documents')).not.toBeInTheDocument();
    expect(screen.queryByText('Storage used')).not.toBeInTheDocument();
  });

  // ── "My pending tasks" card click ─────────────────────────────────────────

  it('calls onMyTasksClick when the "My pending tasks" card is clicked', () => {
    const onMyTasksClick = vi.fn();
    renderDashboard({ onMyTasksClick });

    fireEvent.click(screen.getByRole('button', { name: /my pending tasks/i }));

    expect(onMyTasksClick).toHaveBeenCalledOnce();
  });

  it('renders the "My pending tasks" card as plain, non-interactive content when no handler is passed', () => {
    renderDashboard();

    expect(screen.queryByRole('button', { name: /my pending tasks/i })).not.toBeInTheDocument();
    expect(screen.getByText('My pending tasks')).toBeInTheDocument();
  });

  it('does not leak the restricted module count into the combined documents KPI', () => {
    renderDashboard({ canViewWorkflows: false });

    // totalAttachments would be 5 (typology) + 9 (workflow) = 14 if unfiltered;
    // with WORKFLOWS:READ denied, only the permitted typology count (5) should show.
    expect(screen.getByText('5')).toBeInTheDocument();
    expect(screen.queryByText('14')).not.toBeInTheDocument();
  });

  it('labels the weekly workflow creation chart clearly and shows precise per-week counts, including zero weeks', () => {
    renderDashboard({
      workflowStats: {
        ...WORKFLOW_STATS,
        weeklyTrend: [
          { week: '06/21', count: 0 },
          { week: '06/28', count: 1 },
        ],
      },
    });

    // Regression: the title didn't say what the chart counts (workflows), and
    // weeks with zero creations rendered no number at all — indistinguishable
    // from missing data.
    expect(screen.getByText('Weekly workflow creation (8 weeks)')).toBeInTheDocument();
    // Scoped via the tooltip text rather than a bare "0" — the users
    // active/inactive donut in this fixture also legitimately shows a 0.
    expect(screen.getByText('Week of 06/21: 0 workflows created')).toBeInTheDocument();
    expect(screen.getByText('Week of 06/28: 1 workflow created')).toBeInTheDocument();
  });

  it('lists every workflow status in "Workflow status", including ones with zero workflows', () => {
    // Regression: only statuses present in workflowStats.statusCounts were
    // shown (PENDING_APPROVAL: 4, CLOSED: 8 in this fixture) — the other 7
    // known statuses were silently absent instead of showing 0.
    renderDashboard();

    const card = screen.getByText('Workflow status').closest('div');
    expect(card).not.toBeNull();
    expect(within(card!).getByText('Draft')).toBeInTheDocument();
    expect(within(card!).getByText('Cancelled')).toBeInTheDocument();
  });

  it('still lists every workflow status at 0 when the org has no workflows at all', () => {
    // Regression: the legend was gated behind the donut's total !== 0 branch,
    // so when every status was 0 (an org with zero workflows), the whole
    // legend collapsed into a bare "no data" message — defeating the point of
    // showAllCategories, which exists specifically to keep zero-count
    // categories visible instead of silently absent.
    renderDashboard({
      workflowStats: { ...WORKFLOW_STATS, statusCounts: {} },
    });

    const card = screen.getByText('Workflow status').closest('div');
    expect(card).not.toBeNull();
    expect(within(card!).getByText('Draft')).toBeInTheDocument();
    expect(within(card!).getByText('Cancelled')).toBeInTheDocument();
    expect(within(card!).getAllByText('0').length).toBeGreaterThan(0);
  });

  it('does not expand "Extraction status" the same way — still only shows statuses that occurred', () => {
    renderDashboard();

    const card = screen.getByText('Extraction status').closest('div');
    expect(card).not.toBeNull();
    // TYPOLOGY_STATS fixture only has COMPLETED and FAILED.
    expect(within(card!).getByText('Completed')).toBeInTheDocument();
    expect(within(card!).queryByText('No document')).not.toBeInTheDocument();
  });

  it('keeps a zero-value slice visible in a donut legend instead of hiding it', () => {
    // Regression: DonutChart used to filter out any slice with value === 0
    // before rendering the legend, so a category with no members at all
    // (here: zero inactive users) vanished from the list entirely instead of
    // showing "0" — indistinguishable from the legend being broken/incomplete.
    renderDashboard(); // default USERS fixture = 1 active user, 0 inactive

    const card = screen.getByText('Active / inactive users').closest('div');
    expect(card).not.toBeNull();
    expect(within(card!).getByText('Inactive')).toBeInTheDocument();
    expect(within(card!).getByText('0')).toBeInTheDocument();
  });

  it('excludes org-removed users from both the active and inactive counts, matching CompanyTab/RoleDialogs', () => {
    renderDashboard({
      users: [
        makeUser({ id: 'u-1', isActive: true }),
        // Still flagged isActive, but no longer a member of this org — must not
        // count as "active" here, or this KPI would disagree with every other
        // view (CompanyTab's active count, the role-assignment eligible list).
        makeUser({ id: 'u-2', isActive: true, orgRemovedAt: '2024-02-01T00:00:00Z' }),
        makeUser({ id: 'u-3', isActive: false }),
      ],
    });

    expect(screen.getByText('1 active · 1 inactive')).toBeInTheDocument();
  });
});
