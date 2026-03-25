import { Pencil, Trash2, RotateCcw, MoreHorizontal } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { initials, isDeleted } from '@/lib/formatters'
import type { ApiUser } from '@/lib/api/users'
import type { ApiRole } from '@/lib/api/roles'
import type { useCompanyUsers } from '@/features/company-users/hooks/use-company-users'

type CompanyUsersHook = ReturnType<typeof useCompanyUsers>

interface CompanyUsersTableProps {
  hook: CompanyUsersHook
  roles: ApiRole[]
}

export function CompanyUsersTable({ hook, roles }: CompanyUsersTableProps) {
  const { users, usersLoading, openEdit, setDeleteUser, restoreMutation } = hook
  const activeUsers = users.filter((u) => !isDeleted(u))

  return (
    <main className="p-6 space-y-6">
      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <h2 className="text-sm font-semibold">Usuarios de la empresa</h2>
          <span className="text-xs text-muted-foreground">
            {activeUsers.length} activos · {users.length} total
          </span>
        </div>

        {usersLoading ? (
          <div className="flex items-center justify-center py-16 text-sm text-muted-foreground">
            Cargando usuarios...
          </div>
        ) : users.length === 0 ? (
          <div className="flex items-center justify-center py-16 text-sm text-muted-foreground">
            No hay usuarios registrados
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Usuario</TableHead>
                <TableHead>Cargo</TableHead>
                <TableHead>Roles</TableHead>
                <TableHead>Registro</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((u) => (
                <UserRow
                  key={u.id}
                  user={u}
                  userRoles={roles.filter((r) => r.userIds.includes(u.id))}
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
  user: ApiUser
  userRoles: ApiRole[]
  onEdit: () => void
  onDelete: () => void
  onRestore: () => void
}

function UserRow({ user: u, userRoles, onEdit, onDelete, onRestore }: UserRowProps) {
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
          {userRoles.length > 0 ? (
            userRoles.map((r) => (
              <Badge key={r.id} variant="secondary" className="text-xs">{r.name}</Badge>
            ))
          ) : (
            <span className="text-xs text-muted-foreground">Sin rol</span>
          )}
        </div>
      </TableCell>
      <TableCell>
        {u.registrationStatus === 'pending_credentials' ? (
          <Badge variant="default" className="text-xs">Pendiente</Badge>
        ) : (
          <Badge variant="outline" className="text-xs text-emerald-600 border-emerald-200 bg-emerald-50">
            Registrado
          </Badge>
        )}
      </TableCell>
      <TableCell>
        {isDeleted(u) ? (
          <Badge variant="destructive" className="text-xs">Eliminado</Badge>
        ) : (
          <Badge variant="outline" className="text-xs text-emerald-600 border-emerald-200 bg-emerald-50">
            Activo
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
                  <Pencil className="size-4" /> Editar
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={onDelete}>
                  <Trash2 className="size-4" /> Eliminar
                </DropdownMenuItem>
              </>
            )}
            {isDeleted(u) && (
              <DropdownMenuItem onClick={onRestore}>
                <RotateCcw className="size-4" /> Restaurar
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </TableCell>
    </TableRow>
  )
}
