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
  superAdmins: ApiUser[];
  loading: boolean;
  storageStats: MergedOrgStorage[];
  storageLoading: boolean;
  orgUserCounts: OrgUserCount[];
  orgUserCountsLoading: boolean;
}

export function AdminDashboard({
  companies,
  users,
  superAdmins,
  loading,
  storageStats,
  storageLoading,
  orgUserCounts,
  orgUserCountsLoading,
}: AdminDashboardProps) {
  const { t } = useTranslation();

  const activeOrgs = companies.filter((c) => c.status === 'active').length;
  const inactiveOrgs = companies.length - activeOrgs;
  const orgUsers = users.filter((u) => !u.isSuperAdmin);
  const activeUsers = orgUsers.filter((u) => u.isActive && !u.deletedAt).length;
  const inactiveUsers = orgUsers.length - activeUsers;
  const monthlyData = buildMonthlyOrgData(companies);
  const totalStorageBytes = storageStats.reduce((s, r) => s + r.storageTotalBytes, 0);

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <KpiCard
          icon={Building2}
          label={t('dashboard.kpi.totalOrgs')}
          value={companies.length}
          sub={t('dashboard.kpi.orgActiveSub', { active: activeOrgs, inactive: inactiveOrgs })}
          loading={loading}
          colorIdx={0}
        />
        <KpiCard
          icon={CheckCircle}
          label={t('dashboard.kpi.activeOrgs')}
          value={activeOrgs}
          sub={`${Math.round((activeOrgs / (companies.length || 1)) * 100)}%`}
          loading={loading}
          colorIdx={1}
        />
        <KpiCard
          icon={Users}
          label={t('dashboard.kpi.totalUsers')}
          value={orgUsers.length}
          sub={t('dashboard.kpi.userGlobalSub', {
            active: activeUsers,
            superAdmins: superAdmins.length,
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
          sub={t('dashboard.kpi.storageWithData', { count: storageStats.length })}
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
        counts={orgUserCounts}
        companies={companies}
        loading={orgUserCountsLoading}
      />

      <StoragePerOrgChart
        stats={storageStats}
        companies={companies}
        title={t('dashboard.charts.storagePerOrg')}
        noDataLabel={t('dashboard.noData')}
      />

      <RecentOrgsList companies={companies} />
    </div>
  );
}
