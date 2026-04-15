import { useState, startTransition } from 'react'
import { createFileRoute, redirect } from '@tanstack/react-router'
import { FileText, Users, Building2, Shield, UserPlus, Plus, FolderTree } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
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

export const Route = createFileRoute('/dashboard/')({
  beforeLoad: () => {
    const { isAuthenticated, isSuperAdmin, user } = useAuthStore.getState()
    if (!isAuthenticated) throw redirect({ to: '/login' })
    if (isSuperAdmin && !user?.companyId) throw redirect({ to: '/dashboard/admin' })
  },
  component: CompanyDashboard,
})

type TabId = 'company' | 'users' | 'roles' | 'org-structure'

function CompanyDashboard() {
  const { user: me, isSuperAdmin } = useAuthStore()
  const { t } = useTranslation()
  const companyId = me?.companyId ?? ''
  const [activeTab, setActiveTab] = useState<TabId>('company')
  // Tracks which tabs have been visited at least once. Tabs are lazy-mounted on
  // first visit and kept alive (keepMounted) afterwards to avoid remount cost.
  const [mountedTabs, setMountedTabs] = useState<Set<TabId>>(() => new Set(['company']))

  const { hasPermission, isLoading: permissionsLoading } = useMyPermissions(companyId, isSuperAdmin)

  const canViewUsers = hasPermission('USERS', 'READ')
  const canViewOrgs = hasPermission('ORGS', 'READ')
  const canViewOrgStructure = hasPermission('ORG_STRUCTURE', 'READ')
  const canWriteUsers = hasPermission('USERS', 'WRITE')
  const canWriteOrgs = hasPermission('ORGS', 'WRITE')
  const canWriteOrgStructure = hasPermission('ORG_STRUCTURE', 'WRITE')

  // If the active tab is inaccessible (permissions denied or still loading),
  // fall back to 'company' without mutating state — derived during render.
  const effectiveTab: TabId = (() => {
    if (permissionsLoading) return activeTab
    if (activeTab === 'users' && !canViewUsers) return 'company'
    if (activeTab === 'roles' && !canViewOrgs) return 'company'
    if (activeTab === 'org-structure' && !canViewOrgStructure) return 'company'
    return activeTab
  })()

  // Updates both activeTab and mountedTabs in a single transition, avoiding
  // a separate useEffect that would call setState after render.
  const handleTabChange = (tab: TabId) => {
    startTransition(() => {
      setActiveTab(tab)
      setMountedTabs(prev => prev.has(tab) ? prev : new Set(prev).add(tab))
    })
  }

  const companyUsers = useCompanyUsers(companyId)
  const roles = useRoles(companyId)
  const orgStructure = useOrgStructure(companyId, mountedTabs.has('org-structure'))
  const typologies   = useTypologies(companyId, mountedTabs.has('org-structure'))

  const activeUsers = companyUsers.users.filter((u) => !isDeleted(u))

  return (
    <Tabs
      value={effectiveTab}
      onValueChange={(v) => handleTabChange(v as TabId)}
      className="flex flex-col h-screen bg-background overflow-hidden gap-0"
    >
      {/* ── Header ──────────────────────────────────────────────────── */}
      <header className="flex items-center justify-between px-6 h-16 border-b border-border bg-card shrink-0">
        {/* Brand + Tabs */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2.5 shrink-0">
            <div className="flex items-center justify-center size-8 rounded-md bg-primary shrink-0">
              <FileText className="size-4 text-primary-foreground" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold truncate">SGD Helisa</p>
              <p className="text-[10px] text-muted-foreground truncate">
                {companyUsers.company?.name ?? t('common.loading')}
              </p>
            </div>
          </div>

          <div className="w-px h-6 bg-border shrink-0" />

          <TabsList>
            <TabsTrigger value="company">
              <Building2 className="size-4" />{t('dashboard.company')}
            </TabsTrigger>
            {canViewUsers && (
              <TabsTrigger value="users">
                <Users className="size-4" />{t('common.users')}
              </TabsTrigger>
            )}
            {canViewOrgs && (
              <TabsTrigger value="roles">
                <Shield className="size-4" />{t('dashboard.rolesAndPermissions')}
              </TabsTrigger>
            )}
            {canViewOrgStructure && (
              <TabsTrigger value="org-structure">
                <FolderTree className="size-4" />{t('dashboard.orgStructure')}
              </TabsTrigger>
            )}
          </TabsList>
        </div>

        {/* Actions + User controls */}
        <div className="flex items-center gap-2">
          {effectiveTab === 'users' && canWriteUsers && (
            <Button size="sm" onClick={companyUsers.openCreate}>
              <UserPlus className="size-4" />{t('dashboard.newUser')}
            </Button>
          )}
          {effectiveTab === 'roles' && canWriteOrgs && (
            <Button size="sm" onClick={roles.openCreate}>
              <Plus className="size-4" />{t('dashboard.newRole')}
            </Button>
          )}
          <UserProfileCard variant="header" />
        </div>
      </header>

      {/* ── Content ─────────────────────────────────────────────────── */}
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

      {/* ── Dialogs ─────────────────────────────────────────────────── */}
      <CompanyUserDialogs hook={companyUsers} companyName={companyUsers.company?.name} companyId={companyId} />
      <RoleDialogs hook={roles} activeUsers={activeUsers} allUsers={companyUsers.users} />
      <OrgStructureDialogs hook={orgStructure} />
    </Tabs>
  )
}
