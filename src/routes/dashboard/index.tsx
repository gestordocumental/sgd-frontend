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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuthStore } from '@/store/authStore';
import { UserProfileCard } from '@/features/profile/components/UserProfileCard';
import { CompanyTab } from '@/features/company-users/components/CompanyTab';
import { CompanyUsersTable } from '@/features/company-users/components/CompanyUsersTable';
import { CompanyUserDialogs } from '@/features/company-users/components/CompanyUserDialogs';
import { RolesTab } from '@/features/roles/components/RolesTab';
import { RoleDialogs } from '@/features/roles/components/RoleDialogs';
import { OrgStructureTab } from '@/features/org-structure/components/OrgStructureTab';
import { OrgStructureDialogs } from '@/features/org-structure/components/OrgStructureDialogs';
import { WorkflowsTable } from '@/features/workflows/components/WorkflowsTable';
import { WorkflowDialogs } from '@/features/workflows/components/WorkflowDialogs';
import { AuditTable } from '@/features/audit/components/AuditTable';
import { OrgDashboard } from '@/features/dashboard/components/OrgDashboard';
import { useCompanyDashboard, type TabId } from '@/features/dashboard/hooks/use-company-dashboard';

export const Route = createFileRoute('/dashboard/')({
  beforeLoad: () => {
    const { isAuthenticated, isSuperAdmin, user } = useAuthStore.getState();
    if (!isAuthenticated) throw redirect({ to: '/login' });
    if (isSuperAdmin && !user?.companyId) throw redirect({ to: '/dashboard/admin' });
  },
  component: CompanyDashboard,
});

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

        <div className="flex-1 min-w-0 overflow-x-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
          <TabsList className="w-max">
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
          </TabsList>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <UserProfileCard variant="header" onWorkflowClick={handleWorkflowNotificationClick} />
        </div>
      </header>

      {/* ── Content ─────────────────────────────────────────────────── */}
      <TabsContent value="overview" className="flex-1 overflow-auto">
        <OrgDashboard
          typologyStats={orgDashboard.typologyStats.data}
          workflowStats={orgDashboard.workflowStats.data}
          isLoading={orgDashboard.typologyStats.isLoading || orgDashboard.workflowStats.isLoading}
          users={companyUsers.users}
          usersLoading={companyUsers.usersLoading}
        />
      </TabsContent>
      {mountedTabs.has('company') && (
        <TabsContent value="company" keepMounted className="flex-1 overflow-auto">
          <CompanyTab
            company={companyUsers.company}
            activeUsersCount={activeUsers.length}
            totalUsersCount={companyUsers.users.length}
            rolesCount={roles.roles.length}
          />
        </TabsContent>
      )}
      {canViewUsers && mountedTabs.has('users') && (
        <TabsContent value="users" keepMounted className="flex-1 overflow-auto">
          <CompanyUsersTable hook={companyUsers} canWrite={canWriteUsers} />
        </TabsContent>
      )}
      {canViewOrgs && mountedTabs.has('roles') && (
        <TabsContent value="roles" keepMounted className="flex-1 overflow-auto">
          <RolesTab hook={roles} users={companyUsers.users} canWrite={canWriteOrgs} />
        </TabsContent>
      )}
      {canViewOrgStructure && mountedTabs.has('org-structure') && (
        <TabsContent value="org-structure" keepMounted className="flex-1 overflow-auto">
          <OrgStructureTab
            hook={orgStructure}
            typologiesHook={typologies}
            canWrite={canWriteOrgStructure}
          />
        </TabsContent>
      )}
      {canViewWorkflows && mountedTabs.has('workflows') && (
        <TabsContent value="workflows" keepMounted className="flex-1 overflow-auto">
          <WorkflowsTable
            hook={workflows}
            canWrite={canWriteWorkflows}
            canApprove={canApproveWorkflows}
            canManage={canManageWorkflows}
          />
        </TabsContent>
      )}
      {canViewAudit && mountedTabs.has('audit') && (
        <TabsContent value="audit" keepMounted className="flex-1 overflow-auto">
          <AuditTable hook={audit} users={companyUsers.users} />
        </TabsContent>
      )}

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
