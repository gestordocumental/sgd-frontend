import { Users, ShieldCheck, ShieldOff, Pencil, Trash2, RotateCcw, MoreHorizontal } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { StatCard } from '@/components/ui/stat-card'
import { initials, isDeleted } from '@/lib/formatters'
import type { ApiUser } from '@/lib/api/users'
import type { AdminUsersHook } from '@/features/users/hooks/use-admin-users'

interface UsersTableProps {
  hook: AdminUsersHook
}

export function UsersTable({ hook }: UsersTableProps) {
  const {
    superAdmins,
    superAdminsLoading,
    openEdit,
    setDeleteUser,
    restoreMutation,
    toggleSuperAdminMutation,
  } = hook
  const { t } = useTranslation()

  const totalActive = superAdmins.filter((u) => !isDeleted(u)).length

  return (
    <main className="p-6 space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard title={t('users.totalUsers')} value={superAdmins.length} icon={<Users className="size-5 text-muted-foreground" />} />
        <StatCard title={t('users.activeUsers')} value={totalActive} icon={<Users className="size-5 text-muted-foreground" />} />
        <StatCard title={t('users.superAdmins')} value={superAdmins.filter((u) => u.isSuperAdmin).length} icon={<ShieldCheck className="size-5 text-muted-foreground" />} />
      </div>

      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <div className="px-5 py-4 border-b border-border">
          <h2 className="text-sm font-semibold">{t('users.title')}</h2>
        </div>

        {superAdminsLoading ? (
          <div className="flex items-center justify-center py-16 text-sm text-muted-foreground">
            {t('users.loading')}
          </div>
        ) : superAdmins.length === 0 ? (
          <div className="flex items-center justify-center py-16 text-sm text-muted-foreground">
            {t('users.empty')}
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('users.userColumn')}</TableHead>
                <TableHead>{t('users.roleColumn')}</TableHead>
                <TableHead>{t('users.registrationColumn')}</TableHead>
                <TableHead>{t('users.statusColumn')}</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {superAdmins.map((u) => (
                <UserRow
                  key={u.id}
                  user={u}
                  onEdit={() => openEdit(u)}
                  onDelete={() => setDeleteUser(u)}
                  onRestore={() => restoreMutation.mutate(u.id)}
                  onToggleSuperAdmin={() =>
                    toggleSuperAdminMutation.mutate({ id: u.id, isSuperAdmin: !u.isSuperAdmin })
                  }
                />
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </main>
  )
}

interface UserRowProps {
  user: ApiUser
  onEdit: () => void
  onDelete: () => void
  onRestore: () => void
  onToggleSuperAdmin: () => void
}

function UserRow({ user: u, onEdit, onDelete, onRestore, onToggleSuperAdmin }: UserRowProps) {
  const { t } = useTranslation()
  return (
    <TableRow className={isDeleted(u) ? 'opacity-50' : ''}>
      <TableCell>
        <div className="flex items-center gap-3">
          <Avatar className="size-8">
            <AvatarFallback className="text-xs bg-primary/10 text-primary">
              {initials(u.firstName)}
            </AvatarFallback>
          </Avatar>
          <div>
            <p className="text-sm font-medium">{u.firstName} {u.lastName}</p>
            <p className="text-xs text-muted-foreground">{u.email}</p>
          </div>
        </div>
      </TableCell>
      <TableCell>
        {u.isSuperAdmin ? (
          <Badge variant="default" className="gap-1 text-xs">
            <ShieldCheck className="size-3" /> {t('users.superAdmin')}
          </Badge>
        ) : (
          <Badge variant="secondary" className="text-xs">{t('users.userBadge')}</Badge>
        )}
      </TableCell>
      <TableCell>
        {u.registrationStatus === 'pending_credentials' ? (
          <Badge variant="default" className="gap-1 text-xs">
            <ShieldCheck className="size-3" /> {t('users.pendingCredentials')}
          </Badge>
        ) : (
          <Badge variant="outline" className="text-xs text-emerald-600 border-emerald-200 bg-emerald-50">
            <ShieldCheck className="size-3" /> {t('common.registered')}
          </Badge>
        )}
      </TableCell>
      <TableCell>
        {isDeleted(u) ? (
          <Badge variant="destructive" className="text-xs">{t('common.deleted')}</Badge>
        ) : (
          <Badge variant="outline" className="text-xs text-emerald-600 border-emerald-200 bg-emerald-50">
            {t('common.active')}
          </Badge>
        )}
      </TableCell>
      <TableCell>
        <DropdownMenu>
          <DropdownMenuTrigger
            className="inline-flex items-center justify-center size-8 rounded-md text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
            aria-label={t('users.actions.menuLabel', { name: u.firstName ?? u.email })}
          >
            <MoreHorizontal className="size-4" aria-hidden="true" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {!isDeleted(u) && (
              <>
                <DropdownMenuItem onClick={onEdit}>
                  <Pencil className="size-4" /> {t('users.actions.edit')}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={onToggleSuperAdmin}>
                  {u.isSuperAdmin ? (
                    <><ShieldOff className="size-4" /> {t('users.actions.removeSuperAdmin')}</>
                  ) : (
                    <><ShieldCheck className="size-4" /> {t('users.actions.grantSuperAdmin')}</>
                  )}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={onDelete}>
                  <Trash2 className="size-4" /> {t('users.actions.delete')}
                </DropdownMenuItem>
              </>
            )}
            {isDeleted(u) && (
              <DropdownMenuItem onClick={onRestore}>
                <RotateCcw className="size-4" /> {t('users.actions.restore')}
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </TableCell>
    </TableRow>
  )
}
