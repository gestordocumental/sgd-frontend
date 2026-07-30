import { useTranslation } from 'react-i18next';
import { Building2, Users, CheckCircle, Clock, HardDrive } from 'lucide-react';
import type { ApiCompany } from '@/lib/api/companies';
import type { ApiUser, OrgUserCount } from '@/lib/api/users';
import { KpiCard } from './KpiCard';
import { DonutChart } from './DonutChart';
import { OrgGrowthChart } from './OrgGrowthChart';
import { UsersPerOrgChart } from './UsersPerOrgChart';
import { StoragePerOrgChart, type MergedOrgStorage } from './StoragePerOrgChart';
import { RecentOrgsList } from './RecentOrgsList';
import { formatBytes, buildMonthlyOrgData } from '@/lib/formatters';

// Re-export for consumers that import MergedOrgStorage from this module
export type { MergedOrgStorage };

interface AdminDashboardProps {
  companies: ApiCompany[];
  users: ApiUser[];
  loading: boolean;
  storageStats: MergedOrgStorage[];
  storageLoading: boolean;
  orgUserCounts: OrgUserCount[];
  orgUserCountsLoading: boolean;
}

export function AdminDashboard({
  companies,
  users,
  loading,
  storageStats,
  storageLoading,
  orgUserCounts,
  orgUserCountsLoading,
}: AdminDashboardProps) {
  const { t } = useTranslation();

  // Every org-related board only ever considers organizations that still
  // exist — a soft-deleted org (status active/inactive is irrelevant once
  // deletedAt is set) must not inflate totals, show up in "recent orgs", or
  // leak into per-org user/storage breakdowns just because it still has
  // historical rows in another service.
  const activeCompanies = companies.filter((c) => !c.deletedAt);
  const knownOrgIds = new Set(activeCompanies.map((c) => c.id));
  const filteredOrgUserCounts = orgUserCounts.filter((c) => knownOrgIds.has(c.orgId));
  const filteredStorageStats = storageStats.filter((s) => knownOrgIds.has(s.orgId));

  const activeOrgs = activeCompanies.filter((c) => c.status === 'active').length;
  const inactiveOrgs = activeCompanies.length - activeOrgs;
  // "Usuarios totales"/"Usuarios (globales)" must reflect every user actually
  // registered in the Usuarios module — a user's isSuperAdmin flag is an
  // unrelated global privilege and must not make them disappear from this count.
  // Soft-deleted users, like soft-deleted orgs above, no longer exist for this
  // dashboard's purposes — they must not inflate the total, and (the bug this
  // replaced) must not get counted as "inactive" just because they're not
  // "active" either.
  const existingUsers = users.filter((u) => !u.deletedAt);
  const activeUsers = existingUsers.filter((u) => u.isActive).length;
  const inactiveUsers = existingUsers.length - activeUsers;
  const monthlyData = buildMonthlyOrgData(activeCompanies);
  const totalStorageBytes = filteredStorageStats.reduce((s, r) => s + r.storageTotalBytes, 0);

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <KpiCard
          icon={Building2}
          label={t('dashboard.kpi.totalOrgs')}
          value={activeCompanies.length}
          sub={t('dashboard.kpi.orgActiveSub', { active: activeOrgs, inactive: inactiveOrgs })}
          loading={loading}
          colorIdx={0}
        />
        <KpiCard
          icon={CheckCircle}
          label={t('dashboard.kpi.activeOrgs')}
          value={activeOrgs}
          sub={`${Math.round((activeOrgs / (activeCompanies.length || 1)) * 100)}%`}
          loading={loading}
          colorIdx={1}
        />
        <KpiCard
          icon={Users}
          label={t('dashboard.kpi.totalUsers')}
          value={existingUsers.length}
          sub={t('dashboard.kpi.userGlobalSub', {
            active: activeUsers,
            superAdmins: existingUsers.filter((u) => u.isSuperAdmin).length,
          })}
          loading={loading}
          colorIdx={2}
        />
        <KpiCard
          icon={Clock}
          label={t('dashboard.kpi.registeredThisMonth')}
          value={monthlyData[monthlyData.length - 1]?.count ?? 0}
          loading={loading}
          colorIdx={3}
        />
        <KpiCard
          icon={HardDrive}
          label={t('dashboard.kpi.storageUsed')}
          value={storageLoading ? '…' : formatBytes(totalStorageBytes)}
          sub={t('dashboard.kpi.storageWithData', { count: filteredStorageStats.length })}
          loading={storageLoading}
          colorIdx={4}
        />
      </div>

      {/* Donuts + monthly growth */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <DonutChart
          title={t('dashboard.charts.orgStatus')}
          centerLabel={t('dashboard.charts.orgsCenterLabel')}
          noDataLabel={t('dashboard.noData')}
          slices={[
            { label: t('dashboard.charts.orgsActive'), value: activeOrgs, color: '#10b981' },
            { label: t('dashboard.charts.orgsInactive'), value: inactiveOrgs, color: '#94a3b8' },
          ]}
        />
        <DonutChart
          title={t('dashboard.charts.globalUsers')}
          centerLabel={t('dashboard.charts.usersCenterLabel')}
          noDataLabel={t('dashboard.noData')}
          slices={[
            { label: t('dashboard.charts.usersActive'), value: activeUsers, color: '#6366f1' },
            { label: t('dashboard.charts.usersInactive'), value: inactiveUsers, color: '#f87171' },
          ]}
        />
        <OrgGrowthChart
          title={t('dashboard.charts.monthlyRegistrations')}
          data={monthlyData}
          noDataLabel={t('dashboard.noData')}
        />
      </div>

      <UsersPerOrgChart
        counts={filteredOrgUserCounts}
        companies={activeCompanies}
        loading={orgUserCountsLoading}
      />

      <StoragePerOrgChart
        stats={filteredStorageStats}
        companies={activeCompanies}
        title={t('dashboard.charts.storagePerOrg')}
        noDataLabel={t('dashboard.noData')}
        loading={storageLoading}
      />

      <RecentOrgsList companies={activeCompanies} />
    </div>
  );
}
