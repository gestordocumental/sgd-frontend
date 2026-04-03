import { Pencil, Trash2, RotateCcw, MoreHorizontal } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { initials, isDeleted } from '@/lib/formatters'
import type { ApiUserWithRoles } from '@/lib/api/users'
import type { useCompanyUsers } from '@/features/company-users/hooks/use-company-users'

type CompanyUsersHook = ReturnType<typeof useCompanyUsers>

interface CompanyUsersTableProps {
  hook: CompanyUsersHook
}

export function CompanyUsersTable({ hook }: CompanyUsersTableProps) {
  const { users, usersLoading, openEdit, setDeleteUser, restoreMutation } = hook
  const { t } = useTranslation()
  const activeUsers = users.filter((u) => !isDeleted(u))

  return (
    <main className="p-6 space-y-6">
      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <h2 className="text-sm font-semibold">{t('users.companyUsers')}</h2>
          <span className="text-xs text-muted-foreground">
            {t('users.activeCount', { active: activeUsers.length, total: users.length })}
          </span>
        </div>

        {usersLoading ? (
          <div className="flex items-center justify-center py-16 text-sm text-muted-foreground">
            {t('users.loading')}
          </div>
        ) : users.length === 0 ? (
          <div className="flex items-center justify-center py-16 text-sm text-muted-foreground">
            {t('users.empty')}
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('users.userColumn')}</TableHead>
                <TableHead>{t('users.positionColumn')}</TableHead>
                <TableHead>{t('users.rolesColumn')}</TableHead>
                <TableHead>{t('users.registrationStatusColumn')}</TableHead>
                <TableHead>{t('common.status')}</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((u) => (
                <UserRow
                  key={u.id}
                  user={u}
                  onEdit={() => openEdit(u)}
                  onDelete={() => setDeleteUser(u)}
                  onRestore={() => restoreMutation.mutate(u.id)}
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
  user: ApiUserWithRoles
  onEdit: () => void
  onDelete: () => void
  onRestore: () => void
}

function UserRow({ user: u, onEdit, onDelete, onRestore }: UserRowProps) {
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
      <TableCell className="text-sm text-muted-foreground">{u.position ?? '—'}</TableCell>
      <TableCell>
        <div className="flex flex-wrap gap-1">
          {u.roles.length > 0 ? (
            u.roles.map((r) => (
              <Badge key={r.roleId} variant="secondary" className="text-xs">{r.roleName}</Badge>
            ))
          ) : (
            <span className="text-xs text-muted-foreground">{t('common.noRole')}</span>
          )}
        </div>
      </TableCell>
      <TableCell>
        {u.registrationStatus === 'pending_credentials' ? (
          <Badge variant="default" className="text-xs">{t('common.pending')}</Badge>
        ) : (
          <Badge variant="outline" className="text-xs text-emerald-600 border-emerald-200 bg-emerald-50">
            {t('common.registered')}
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
          <DropdownMenuTrigger className="inline-flex items-center justify-center size-8 rounded-md text-muted-foreground hover:bg-accent hover:text-foreground transition-colors">
            <MoreHorizontal className="size-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {!isDeleted(u) && (
              <>
                <DropdownMenuItem onClick={onEdit}>
                  <Pencil className="size-4" /> {t('users.actions.edit')}
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
