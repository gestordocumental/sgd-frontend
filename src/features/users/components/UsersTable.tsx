import { Users, ShieldCheck, ShieldOff, Pencil, Trash2, RotateCcw, MoreHorizontal } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { StatCard } from '@/components/ui/stat-card'
import { initials, isDeleted } from '@/lib/formatters'
import type { ApiUser } from '@/lib/api/users'
import type { useAdminUsers } from '@/features/users/hooks/use-admin-users'

type UsersHook = ReturnType<typeof useAdminUsers>

interface UsersTableProps {
  hook: UsersHook
}

export function UsersTable({ hook }: UsersTableProps) {
  const {
    users,
    superAdmins,
    superAdminsLoading,
    openEdit,
    setDeleteUser,
    restoreMutation,
    toggleSuperAdminMutation,
  } = hook

  const totalActive = users.filter((u) => !isDeleted(u)).length
  const totalSuperAdmins = superAdmins.filter((u) => u.isSuperAdmin).length

  return (
    <main className="p-6 space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard title="Total usuarios" value={users.length} icon={<Users className="size-5 text-muted-foreground" />} />
        <StatCard title="Usuarios activos" value={totalActive} icon={<Users className="size-5 text-muted-foreground" />} />
        <StatCard title="Super admins" value={totalSuperAdmins} icon={<ShieldCheck className="size-5 text-muted-foreground" />} />
      </div>

      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <div className="px-5 py-4 border-b border-border">
          <h2 className="text-sm font-semibold">Usuarios</h2>
        </div>

        {superAdminsLoading ? (
          <div className="flex items-center justify-center py-16 text-sm text-muted-foreground">
            Cargando usuarios...
          </div>
        ) : superAdmins.length === 0 ? (
          <div className="flex items-center justify-center py-16 text-sm text-muted-foreground">
            No hay usuarios registrados
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Usuario</TableHead>
                <TableHead>Rol</TableHead>
                <TableHead>Estado Registro</TableHead>
                <TableHead>Estado</TableHead>
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
            <ShieldCheck className="size-3" /> Super Admin
          </Badge>
        ) : (
          <Badge variant="secondary" className="text-xs">Usuario</Badge>
        )}
      </TableCell>
      <TableCell>
        {u.registrationStatus === 'pending_credentials' ? (
          <Badge variant="default" className="gap-1 text-xs">
            <ShieldCheck className="size-3" /> Pendiente de Credenciales
          </Badge>
        ) : (
          <Badge variant="outline" className="text-xs text-emerald-600 border-emerald-200 bg-emerald-50">
            <ShieldCheck className="size-3" /> Registrado
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
                <DropdownMenuItem onClick={onToggleSuperAdmin}>
                  {u.isSuperAdmin ? (
                    <><ShieldOff className="size-4" /> Quitar Super Admin</>
                  ) : (
                    <><ShieldCheck className="size-4" /> Dar Super Admin</>
                  )}
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
