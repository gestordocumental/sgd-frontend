import { lazy, Suspense } from 'react';
import { createFileRoute, redirect } from '@tanstack/react-router';
import {
  Users,
  Building2,
  Shield,
  FolderTree,
  GitBranch,
  ClipboardList,
  LayoutDashboard,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Tabs, TabsContent, TabsTrigger } from '@/components/ui/tabs';
import { ScrollableTabsList } from '@/components/ui/scrollable-tabs-list';
import { useAuthStore } from '@/store/authStore';
import { UserProfileCard } from '@/features/profile/components/UserProfileCard';
import { CompanyUserDialogs } from '@/features/company-users/components/CompanyUserDialogs';
import { RoleDialogs } from '@/features/roles/components/RoleDialogs';
import { OrgStructureDialogs } from '@/features/org-structure/components/OrgStructureDialogs';
import { WorkflowDialogs } from '@/features/workflows/components/WorkflowDialogs';
import { Skeleton } from '@/components/ui/skeleton';
import { useCompanyDashboard, type TabId } from '@/features/dashboard/hooks/use-company-dashboard';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { FeatureErrorFallback } from '@/components/FeatureErrorFallback';

const OrgDashboard = lazy(() =>
  import('@/features/dashboard/components/OrgDashboard').then((m) => ({ default: m.OrgDashboard })),
);
const CompanyTab = lazy(() =>
  import('@/features/company-users/components/CompanyTab').then((m) => ({ default: m.CompanyTab })),
);
const CompanyUsersTable = lazy(() =>
  import('@/features/company-users/components/CompanyUsersTable').then((m) => ({
    default: m.CompanyUsersTable,
  })),
);
const RolesTab = lazy(() =>
  import('@/features/roles/components/RolesTab').then((m) => ({ default: m.RolesTab })),
);
const OrgStructureTab = lazy(() =>
  import('@/features/org-structure/components/OrgStructureTab').then((m) => ({
    default: m.OrgStructureTab,
  })),
);
const WorkflowsTable = lazy(() =>
  import('@/features/workflows/components/WorkflowsTable').then((m) => ({
    default: m.WorkflowsTable,
  })),
);
const AuditTable = lazy(() =>
  import('@/features/audit/components/AuditTable').then((m) => ({ default: m.AuditTable })),
);

export const Route = createFileRoute('/dashboard/')({
  beforeLoad: () => {
    const { isAuthenticated, isSuperAdmin, user } = useAuthStore.getState();
    if (!isAuthenticated) throw redirect({ to: '/login' });
    if (isSuperAdmin && !user?.companyId) throw redirect({ to: '/dashboard/admin' });
  },
  component: CompanyDashboard,
});

function TabSkeleton() {
  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center gap-4">
        <Skeleton className="h-7 w-40" />
        <Skeleton className="h-7 w-24" />
      </div>
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <Skeleton className="h-28 rounded-xl" />
        <Skeleton className="h-28 rounded-xl" />
        <Skeleton className="h-28 rounded-xl" />
        <Skeleton className="h-28 rounded-xl" />
      </div>
      <Skeleton className="h-72 rounded-xl" />
    </div>
  );
}

function CompanyDashboard() {
  const { t } = useTranslation();
  const {
    companyId,
    effectiveTab,
    mountedTabs,
    handleTabChange,
    canViewUsers,
    canViewOrgs,
    canViewOrgStructure,
    canViewWorkflows,
    canManageWorkflows,
    canViewAudit,
    canWriteUsers,
    canWriteOrgs,
    canWriteOrgStructure,
    canWriteWorkflows,
    canApproveWorkflows,
    companyUsers,
    roles,
    orgStructure,
    typologies,
    workflows,
    audit,
    orgDashboard,
    activeUsers,
    handleWorkflowNotificationClick,
  } = useCompanyDashboard();

  return (
    <Tabs
      value={effectiveTab}
      onValueChange={(v) => handleTabChange(v as TabId)}
      className="flex flex-col h-screen bg-background overflow-hidden gap-0"
    >
      {/* ── Header ──────────────────────────────────────────────────── */}
      <header className="flex items-center px-4 h-16 border-b border-border bg-card shrink-0 gap-3">
        <div className="shrink-0">
          <img
            src="/logo.svg"
            alt="Logo"
            className="h-14 w-auto mix-blend-multiply dark:mix-blend-screen"
          />
        </div>

        <div className="w-px h-6 bg-border shrink-0" />

        <ScrollableTabsList>
          <TabsTrigger value="overview">
            <LayoutDashboard className="size-4" />
            <span className="hidden xl:inline">{t('dashboard.overview')}</span>
          </TabsTrigger>
          <TabsTrigger value="company">
            <Building2 className="size-4" />
            <span className="hidden xl:inline">{t('dashboard.company')}</span>
          </TabsTrigger>
          {canViewUsers && (
            <TabsTrigger value="users">
              <Users className="size-4" />
              <span className="hidden xl:inline">{t('common.users')}</span>
            </TabsTrigger>
          )}
          {canViewOrgs && (
            <TabsTrigger value="roles">
              <Shield className="size-4" />
              <span className="hidden xl:inline">{t('dashboard.rolesAndPermissions')}</span>
            </TabsTrigger>
          )}
          {canViewOrgStructure && (
            <TabsTrigger value="org-structure">
              <FolderTree className="size-4" />
              <span className="hidden xl:inline">{t('dashboard.orgStructure')}</span>
            </TabsTrigger>
          )}
          {canViewWorkflows && (
            <TabsTrigger value="workflows">
              <GitBranch className="size-4" />
              <span className="hidden xl:inline">{t('dashboard.workflows')}</span>
              {workflows.queries.myTasks.length > 0 && (
                <span className="ml-1.5 flex items-center justify-center size-4 rounded-full text-[9px] text-white font-bold bg-brand">
                  {workflows.queries.myTasks.length}
                </span>
              )}
            </TabsTrigger>
          )}
          {canViewAudit && (
            <TabsTrigger value="audit">
              <ClipboardList className="size-4" />
              <span className="hidden xl:inline">{t('dashboard.audit')}</span>
            </TabsTrigger>
          )}
        </ScrollableTabsList>

        <div className="flex items-center gap-2 shrink-0">
          <UserProfileCard variant="header" onWorkflowClick={handleWorkflowNotificationClick} />
        </div>
      </header>

      {/* ── Content ─────────────────────────────────────────────────── */}
      <div id="main-content" tabIndex={-1} className="flex-1 flex flex-col min-h-0 outline-none">
        <TabsContent value="overview" className="flex-1 overflow-auto">
          <ErrorBoundary
            fallback={(reset) => (
              <FeatureErrorFallback feature={t('dashboard.overview')} onReset={reset} />
            )}
          >
            <Suspense fallback={<TabSkeleton />}>
              <OrgDashboard
                typologyStats={orgDashboard.typologyStats.data}
                workflowStats={orgDashboard.workflowStats.data}
                isLoading={
                  orgDashboard.typologyStats.isLoading || orgDashboard.workflowStats.isLoading
                }
                users={companyUsers.users}
                usersLoading={companyUsers.usersLoading}
              />
            </Suspense>
          </ErrorBoundary>
        </TabsContent>
        {mountedTabs.has('company') && (
          <TabsContent value="company" keepMounted className="flex-1 overflow-auto">
            <ErrorBoundary
              fallback={(reset) => (
                <FeatureErrorFallback feature={t('dashboard.company')} onReset={reset} />
              )}
            >
              <Suspense fallback={<TabSkeleton />}>
                <CompanyTab
                  company={companyUsers.company}
                  activeUsersCount={activeUsers.length}
                  totalUsersCount={companyUsers.users.length}
                  rolesCount={roles.roles.length}
                />
              </Suspense>
            </ErrorBoundary>
          </TabsContent>
        )}
        {canViewUsers && mountedTabs.has('users') && (
          <TabsContent value="users" keepMounted className="flex-1 overflow-auto">
            <ErrorBoundary
              fallback={(reset) => (
                <FeatureErrorFallback feature={t('common.users')} onReset={reset} />
              )}
            >
              <Suspense fallback={<TabSkeleton />}>
                <CompanyUsersTable hook={companyUsers} canWrite={canWriteUsers} />
              </Suspense>
            </ErrorBoundary>
          </TabsContent>
        )}
        {canViewOrgs && mountedTabs.has('roles') && (
          <TabsContent value="roles" keepMounted className="flex-1 overflow-auto">
            <ErrorBoundary
              fallback={(reset) => (
                <FeatureErrorFallback
                  feature={t('dashboard.rolesAndPermissions')}
                  onReset={reset}
                />
              )}
            >
              <Suspense fallback={<TabSkeleton />}>
                <RolesTab hook={roles} users={companyUsers.users} canWrite={canWriteOrgs} />
              </Suspense>
            </ErrorBoundary>
          </TabsContent>
        )}
        {canViewOrgStructure && mountedTabs.has('org-structure') && (
          <TabsContent value="org-structure" keepMounted className="flex-1 overflow-auto">
            <ErrorBoundary
              fallback={(reset) => (
                <FeatureErrorFallback feature={t('dashboard.orgStructure')} onReset={reset} />
              )}
            >
              <Suspense fallback={<TabSkeleton />}>
                <OrgStructureTab
                  hook={orgStructure}
                  typologiesHook={typologies}
                  canWrite={canWriteOrgStructure}
                />
              </Suspense>
            </ErrorBoundary>
          </TabsContent>
        )}
        {canViewWorkflows && mountedTabs.has('workflows') && (
          <TabsContent value="workflows" keepMounted className="flex-1 overflow-auto">
            <ErrorBoundary
              fallback={(reset) => (
                <FeatureErrorFallback feature={t('dashboard.workflows')} onReset={reset} />
              )}
            >
              <Suspense fallback={<TabSkeleton />}>
                <WorkflowsTable
                  hook={workflows}
                  canWrite={canWriteWorkflows}
                  canApprove={canApproveWorkflows}
                  canManage={canManageWorkflows}
                />
              </Suspense>
            </ErrorBoundary>
          </TabsContent>
        )}
        {canViewAudit && mountedTabs.has('audit') && (
          <TabsContent value="audit" keepMounted className="flex-1 overflow-auto">
            <ErrorBoundary
              fallback={(reset) => (
                <FeatureErrorFallback feature={t('dashboard.audit')} onReset={reset} />
              )}
            >
              <Suspense fallback={<TabSkeleton />}>
                <AuditTable hook={audit} users={companyUsers.users} />
              </Suspense>
            </ErrorBoundary>
          </TabsContent>
        )}
      </div>

      {/* ── Dialogs ─────────────────────────────────────────────────── */}
      <CompanyUserDialogs
        hook={companyUsers}
        companyName={companyUsers.company?.name}
        companyId={companyId}
      />
      <RoleDialogs hook={roles} activeUsers={activeUsers} allUsers={companyUsers.users} />
      <OrgStructureDialogs hook={orgStructure} />
      <WorkflowDialogs hook={workflows} canApprove={canApproveWorkflows} />
    </Tabs>
  );
}
