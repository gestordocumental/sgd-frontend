import { useState, startTransition, useCallback } from 'react'
import { createFileRoute, redirect } from '@tanstack/react-router'
import { Users, Building2, Shield, FolderTree, GitBranch, ClipboardList, LayoutDashboard } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useAuthStore } from '@/store/authStore'
import { isDeleted } from '@/lib/formatters'
import { UserProfileCard } from '@/features/profile/components/UserProfileCard'
import { useCompanyUsers } from '@/features/company-users/hooks/use-company-users'
import { useRoles } from '@/features/roles/hooks/use-roles'
import { CompanyTab } from '@/features/company-users/components/CompanyTab'
import { CompanyUsersTable } from '@/features/company-users/components/CompanyUsersTable'
import { CompanyUserDialogs } from '@/features/company-users/components/CompanyUserDialogs'
import { RolesTab } from '@/features/roles/components/RolesTab'
import { RoleDialogs } from '@/features/roles/components/RoleDialogs'
import { useOrgStructure } from '@/features/org-structure/hooks/use-org-structure'
import { OrgStructureTab } from '@/features/org-structure/components/OrgStructureTab'
import { OrgStructureDialogs } from '@/features/org-structure/components/OrgStructureDialogs'
import { useMyPermissions } from '@/features/profile/hooks/use-my-permissions'
import { useTypologies } from '@/features/doc-governance/hooks/use-typologies'
import { useWorkflows } from '@/features/workflows/hooks/use-workflows'
import { WorkflowsTable } from '@/features/workflows/components/WorkflowsTable'
import { WorkflowDialogs } from '@/features/workflows/components/WorkflowDialogs'
import { useAudit } from '@/features/audit/hooks/use-audit'
import { AuditTable } from '@/features/audit/components/AuditTable'
import { useOrgDashboard } from '@/features/dashboard/hooks/use-org-dashboard'
import { OrgDashboard } from '@/features/dashboard/components/OrgDashboard'

export const Route = createFileRoute('/dashboard/')({
  beforeLoad: () => {
    const { isAuthenticated, isSuperAdmin, user } = useAuthStore.getState()
    if (!isAuthenticated) throw redirect({ to: '/login' })
    if (isSuperAdmin && !user?.companyId) throw redirect({ to: '/dashboard/admin' })
  },
  component: CompanyDashboard,
})

type TabId = 'overview' | 'company' | 'users' | 'roles' | 'org-structure' | 'workflows' | 'audit'

function CompanyDashboard() {
  const { user: me, isSuperAdmin } = useAuthStore()
  const { t } = useTranslation()
  const companyId = me?.companyId ?? ''
  const [activeTab, setActiveTab] = useState<TabId>('overview')
  // Tracks which tabs have been visited at least once. Tabs are lazy-mounted on
  // first visit and kept alive (keepMounted) afterwards to avoid remount cost.
  const [mountedTabs, setMountedTabs] = useState<Set<TabId>>(() => new Set(['overview']))

  const { hasPermission, isLoading: permissionsLoading } = useMyPermissions(companyId, isSuperAdmin)

  const canViewUsers = hasPermission('USERS', 'READ')
  const canViewOrgs = hasPermission('ORGS', 'READ')
  const canViewOrgStructure = hasPermission('ORG_STRUCTURE', 'READ')
  const canViewWorkflows = hasPermission('WORKFLOWS', 'READ')
  const canViewAudit = hasPermission('AUDIT', 'READ')
  const canWriteUsers = hasPermission('USERS', 'WRITE')
  const canWriteOrgs = hasPermission('ORGS', 'WRITE')
  const canWriteOrgStructure = hasPermission('ORG_STRUCTURE', 'WRITE')
  const canWriteWorkflows = hasPermission('WORKFLOWS', 'WRITE')
  const canApproveWorkflows = hasPermission('WORKFLOWS', 'APPROVE')

  // If the active tab is inaccessible (permissions denied or still loading),
  // fall back to 'company' without mutating state — derived during render.
  const effectiveTab: TabId = (() => {
    if (permissionsLoading) return activeTab
    if (activeTab === 'users' && !canViewUsers) return 'overview'
    if (activeTab === 'roles' && !canViewOrgs) return 'overview'
    if (activeTab === 'org-structure' && !canViewOrgStructure) return 'overview'
    if (activeTab === 'workflows' && !canViewWorkflows) return 'overview'
    if (activeTab === 'audit' && !canViewAudit) return 'overview'
    return activeTab
  })()

  // Updates both activeTab and mountedTabs in a single transition, avoiding
  // a separate useEffect that would call setState after render.
  const handleTabChange = useCallback((tab: TabId) => {
    startTransition(() => {
      setActiveTab(tab)
      setMountedTabs(prev => prev.has(tab) ? prev : new Set(prev).add(tab))
    })
  }, [])

  const companyUsers = useCompanyUsers(companyId)
  const roles = useRoles(companyId)
  const orgStructure = useOrgStructure(companyId, mountedTabs.has('org-structure'))
  const typologies   = useTypologies(companyId, mountedTabs.has('org-structure'))
  const workflows    = useWorkflows(companyId)
  const audit        = useAudit(companyId, mountedTabs.has('audit'))
  const orgDashboard = useOrgDashboard(companyId, mountedTabs.has('overview'))

  const handleWorkflowNotificationClick = useCallback(async (workflowId: string) => {
    handleTabChange('workflows')
    await workflows.openDetailById(workflowId)
  }, [handleTabChange, workflows])

  const activeUsers = companyUsers.users.filter((u) => !isDeleted(u))

  return (
    <Tabs
      value={effectiveTab}
      onValueChange={(v) => handleTabChange(v as TabId)}
      className="flex flex-col h-screen bg-background overflow-hidden gap-0"
    >
      {/* ── Header ──────────────────────────────────────────────────── */}
      <header className="flex items-center px-4 h-16 border-b border-border bg-card shrink-0 gap-3">
        {/* Logo — nunca se encoge */}
        <div className="shrink-0">
          <img src="/logo.svg" alt="Logo" className="h-14 w-auto mix-blend-multiply dark:mix-blend-screen" />
        </div>

        <div className="w-px h-6 bg-border shrink-0" />

        {/* Pestañas — toma el espacio disponible y hace scroll si no caben */}
        <div className="flex-1 min-w-0 overflow-x-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
          <TabsList className="w-max">
            <TabsTrigger value="overview">
              <LayoutDashboard className="size-4" /><span className="hidden xl:inline">{t('dashboard.overview')}</span>
            </TabsTrigger>
            <TabsTrigger value="company">
              <Building2 className="size-4" /><span className="hidden xl:inline">{t('dashboard.company')}</span>
            </TabsTrigger>
            {canViewUsers && (
              <TabsTrigger value="users">
                <Users className="size-4" /><span className="hidden xl:inline">{t('common.users')}</span>
              </TabsTrigger>
            )}
            {canViewOrgs && (
              <TabsTrigger value="roles">
                <Shield className="size-4" /><span className="hidden xl:inline">{t('dashboard.rolesAndPermissions')}</span>
              </TabsTrigger>
            )}
            {canViewOrgStructure && (
              <TabsTrigger value="org-structure">
                <FolderTree className="size-4" /><span className="hidden xl:inline">{t('dashboard.orgStructure')}</span>
              </TabsTrigger>
            )}
            {canViewWorkflows && (
              <TabsTrigger value="workflows">
                <GitBranch className="size-4" /><span className="hidden xl:inline">{t('dashboard.workflows')}</span>
                {workflows.myTasks.length > 0 && (
                  <span className="ml-1.5 flex items-center justify-center size-4 rounded-full text-[9px] text-white font-bold" style={{ backgroundColor: '#0060C5' }}>
                    {workflows.myTasks.length}
                  </span>
                )}
              </TabsTrigger>
            )}
            {canViewAudit && (
              <TabsTrigger value="audit">
                <ClipboardList className="size-4" /><span className="hidden xl:inline">{t('dashboard.audit')}</span>
              </TabsTrigger>
            )}
          </TabsList>
        </div>

        {/* Controles — nunca se encogen ni se solapan */}
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
      <TabsContent value="company" className="flex-1 overflow-auto">
        <CompanyTab
          company={companyUsers.company}
          activeUsersCount={activeUsers.length}
          totalUsersCount={companyUsers.users.length}
          rolesCount={roles.roles.length}
        />
      </TabsContent>
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
          <OrgStructureTab hook={orgStructure} typologiesHook={typologies} canWrite={canWriteOrgStructure} />
        </TabsContent>
      )}

      {canViewWorkflows && mountedTabs.has('workflows') && (
        <TabsContent value="workflows" keepMounted className="flex-1 overflow-auto">
          <WorkflowsTable hook={workflows} canWrite={canWriteWorkflows} canApprove={canApproveWorkflows} />
        </TabsContent>
      )}
      {canViewAudit && mountedTabs.has('audit') && (
        <TabsContent value="audit" keepMounted className="flex-1 overflow-auto">
          <AuditTable hook={audit} users={companyUsers.users} />
        </TabsContent>
      )}

      {/* ── Dialogs ─────────────────────────────────────────────────── */}
      <CompanyUserDialogs hook={companyUsers} companyName={companyUsers.company?.name} companyId={companyId} />
      <RoleDialogs hook={roles} activeUsers={activeUsers} allUsers={companyUsers.users} />
      <OrgStructureDialogs hook={orgStructure} />
      <WorkflowDialogs hook={workflows} canApprove={canApproveWorkflows} />
    </Tabs>
  )
}
