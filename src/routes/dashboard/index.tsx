import { useState } from 'react'
import { createFileRoute, redirect, useNavigate } from '@tanstack/react-router'
import { useMutation } from '@tanstack/react-query'
import { FileText, LogOut, Users, Building2, Shield, UserPlus, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { NavItem } from '@/components/ui/nav-item'
import { authApi } from '@/lib/api/auth'
import { useAuthStore } from '@/store/authStore'
import { initials, isDeleted } from '@/lib/formatters'
import { useCompanyUsers } from '@/features/company-users/hooks/use-company-users'
import { useRoles } from '@/features/roles/hooks/use-roles'
import { CompanyTab } from '@/features/company-users/components/CompanyTab'
import { CompanyUsersTable } from '@/features/company-users/components/CompanyUsersTable'
import { CompanyUserDialogs } from '@/features/company-users/components/CompanyUserDialogs'
import { RolesTab } from '@/features/roles/components/RolesTab'
import { RoleDialogs } from '@/features/roles/components/RoleDialogs'

const DEMO_COMPANY_ID = 'c1'

export const Route = createFileRoute('/dashboard/')({
  beforeLoad: () => {
    const { isSuperAdmin } = useAuthStore.getState()
    if (isSuperAdmin) throw redirect({ to: '/dashboard/admin' })
  },
  component: CompanyDashboard,
})

function CompanyDashboard() {
  const navigate = useNavigate()
  const { user: me, clearAuth } = useAuthStore()
  const companyId = me?.companyId ?? DEMO_COMPANY_ID
  const [activeTab, setActiveTab] = useState<'company' | 'users' | 'roles'>('company')

  const companyUsers = useCompanyUsers(companyId)
  const roles = useRoles(companyId)

  const activeUsers = companyUsers.users.filter((u) => !isDeleted(u))

  const logoutMutation = useMutation({
    mutationFn: authApi.logout,
    onSettled: () => { clearAuth(); navigate({ to: '/login' }) },
  })

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
            <p className="text-[10px] text-muted-foreground truncate">{companyUsers.company?.name ?? 'Cargando...'}</p>
          </div>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-0.5">
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-2 mb-2">Gestión</p>
          <NavItem icon={<Building2 className="size-4" />} label="Empresa" active={activeTab === 'company'} onClick={() => setActiveTab('company')} />
          <NavItem icon={<Users className="size-4" />} label="Usuarios" active={activeTab === 'users'} onClick={() => setActiveTab('users')} />
          <NavItem icon={<Shield className="size-4" />} label="Roles y permisos" active={activeTab === 'roles'} onClick={() => setActiveTab('roles')} />
        </nav>

        <div className="px-4 py-4 border-t border-border">
          <div className="flex items-center gap-2.5">
            <Avatar className="size-8">
              <AvatarFallback className="text-xs bg-primary/10 text-primary">
                {me?.name ? initials(me.name) : '?'}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium truncate">{me?.name ?? me?.email}</p>
              <p className="text-[10px] text-muted-foreground">{me?.role ?? 'Usuario'}</p>
            </div>
            <Button variant="ghost" size="icon" className="size-7 shrink-0 text-muted-foreground hover:text-destructive" onClick={() => logoutMutation.mutate()}>
              <LogOut className="size-3.5" />
            </Button>
          </div>
        </div>
      </aside>

      {/* ── Main ────────────────────────────────────────────────────── */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)} className="flex-1 min-w-0 overflow-hidden gap-0">
        <header className="flex items-center justify-between px-6 h-16 border-b border-border bg-card shrink-0">
          <TabsList>
            <TabsTrigger value="company"><Building2 className="size-4" />Empresa</TabsTrigger>
            <TabsTrigger value="users"><Users className="size-4" />Usuarios</TabsTrigger>
            <TabsTrigger value="roles"><Shield className="size-4" />Roles y permisos</TabsTrigger>
          </TabsList>
          {activeTab === 'users' && (
            <Button size="sm" onClick={() => { companyUsers.createForm.reset(); companyUsers.openCreate() }}>
              <UserPlus className="size-4" />Nuevo usuario
            </Button>
          )}
          {activeTab === 'roles' && (
            <Button size="sm" onClick={roles.openCreate}>
              <Plus className="size-4" />Nuevo rol
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
        <TabsContent value="users" className="overflow-auto">
          <CompanyUsersTable hook={companyUsers} roles={roles.roles} />
        </TabsContent>
        <TabsContent value="roles" className="overflow-auto">
          <RolesTab hook={roles} users={companyUsers.users} />
        </TabsContent>
      </Tabs>

      {/* ── Dialogs ─────────────────────────────────────────────────── */}
      <CompanyUserDialogs hook={companyUsers} companyName={companyUsers.company?.name} companyId={companyId} />
      <RoleDialogs hook={roles} activeUsers={activeUsers} allUsers={companyUsers.users} />
    </div>
  )
}
