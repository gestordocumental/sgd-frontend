import { useState, useEffect } from 'react'
import { createFileRoute, redirect } from '@tanstack/react-router'
import { FileText, Users, Building2, Shield, UserPlus, Plus, FolderTree } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { NavItem } from '@/components/ui/nav-item'
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

  const { hasPermission, isLoading: permissionsLoading } = useMyPermissions(companyId, isSuperAdmin)

  const canViewUsers = hasPermission('USERS', 'READ')
  const canViewOrgs = hasPermission('ORGS', 'READ')
  const canViewOrgStructure = hasPermission('ORG_STRUCTURE', 'READ')
  const canWriteUsers = hasPermission('USERS', 'WRITE')
  const canWriteOrgs = hasPermission('ORGS', 'WRITE')
  const canWriteOrgStructure = hasPermission('ORG_STRUCTURE', 'WRITE')

  // If the active tab becomes inaccessible after permissions load, fall back to 'company'
  useEffect(() => {
    if (permissionsLoading) return
    if (activeTab === 'users' && !canViewUsers) setActiveTab('company')
    if (activeTab === 'roles' && !canViewOrgs) setActiveTab('company')
    if (activeTab === 'org-structure' && !canViewOrgStructure) setActiveTab('company')
  }, [permissionsLoading, canViewUsers, canViewOrgs, canViewOrgStructure, activeTab])

  const companyUsers = useCompanyUsers(companyId)
  const roles = useRoles(companyId)
  const orgStructure = useOrgStructure(companyId)

  const activeUsers = companyUsers.users.filter((u) => !isDeleted(u))

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* ── Sidebar ─────────────────────────────────────────────────── */}
      <aside className="hidden lg:flex w-60 flex-col border-r border-border bg-card shrink-0">
        <div className="flex items-center gap-2.5 px-5 h-16 border-b border-border">
          <div className="flex items-center justify-center size-8 rounded-md bg-primary shrink-0">
            <FileText className="size-4 text-primary-foreground" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold truncate">SGD Helisa</p>
            <p className="text-[10px] text-muted-foreground truncate">{companyUsers.company?.name ?? t('common.loading')}</p>
          </div>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-0.5">
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-2 mb-2">{t('dashboard.management')}</p>
          <NavItem icon={<Building2 className="size-4" />} label={t('dashboard.company')} active={activeTab === 'company'} onClick={() => setActiveTab('company')} />
          {canViewUsers && (
            <NavItem icon={<Users className="size-4" />} label={t('common.users')} active={activeTab === 'users'} onClick={() => setActiveTab('users')} />
          )}
          {canViewOrgs && (
            <NavItem icon={<Shield className="size-4" />} label={t('dashboard.rolesAndPermissions')} active={activeTab === 'roles'} onClick={() => setActiveTab('roles')} />
          )}
          {canViewOrgStructure && (
            <NavItem icon={<FolderTree className="size-4" />} label={t('dashboard.orgStructure')} active={activeTab === 'org-structure'} onClick={() => setActiveTab('org-structure')} />
          )}
        </nav>

        <UserProfileCard />
      </aside>

      {/* ── Main ────────────────────────────────────────────────────── */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TabId)} className="flex-1 min-w-0 overflow-hidden gap-0">
        <header className="flex items-center justify-between px-6 h-16 border-b border-border bg-card shrink-0">
          <TabsList>
            <TabsTrigger value="company"><Building2 className="size-4" />{t('dashboard.company')}</TabsTrigger>
            {canViewUsers && (
              <TabsTrigger value="users"><Users className="size-4" />{t('common.users')}</TabsTrigger>
            )}
            {canViewOrgs && (
              <TabsTrigger value="roles"><Shield className="size-4" />{t('dashboard.rolesAndPermissions')}</TabsTrigger>
            )}
            {canViewOrgStructure && (
              <TabsTrigger value="org-structure"><FolderTree className="size-4" />{t('dashboard.orgStructure')}</TabsTrigger>
            )}
          </TabsList>
          {activeTab === 'users' && canWriteUsers && (
            <Button size="sm" onClick={() => { companyUsers.createForm.reset(); companyUsers.openCreate() }}>
              <UserPlus className="size-4" />{t('dashboard.newUser')}
            </Button>
          )}
          {activeTab === 'roles' && canWriteOrgs && (
            <Button size="sm" onClick={roles.openCreate}>
              <Plus className="size-4" />{t('dashboard.newRole')}
            </Button>
          )}
        </header>

        <TabsContent value="company" className="overflow-auto">
          <CompanyTab
            company={companyUsers.company}
            activeUsersCount={activeUsers.length}
            totalUsersCount={companyUsers.users.length}
            rolesCount={roles.roles.length}
          />
        </TabsContent>
        {canViewUsers && (
          <TabsContent value="users" className="overflow-auto">
            <CompanyUsersTable hook={companyUsers} canWrite={canWriteUsers} />
          </TabsContent>
        )}
        {canViewOrgs && (
          <TabsContent value="roles" className="overflow-auto">
            <RolesTab hook={roles} users={companyUsers.users} canWrite={canWriteOrgs} />
          </TabsContent>
        )}
        {canViewOrgStructure && (
          <TabsContent value="org-structure" className="overflow-auto">
            <OrgStructureTab hook={orgStructure} canWrite={canWriteOrgStructure} />
          </TabsContent>
        )}
      </Tabs>

      {/* ── Dialogs ─────────────────────────────────────────────────── */}
      <CompanyUserDialogs hook={companyUsers} companyName={companyUsers.company?.name} companyId={companyId} />
      <RoleDialogs hook={roles} activeUsers={activeUsers} allUsers={companyUsers.users} />
      <OrgStructureDialogs hook={orgStructure} />
    </div>
  )
}
