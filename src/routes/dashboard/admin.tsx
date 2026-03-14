import { useState } from 'react'
import { createFileRoute, redirect, useNavigate } from '@tanstack/react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  FileText, LogOut, Users, ShieldCheck, UserPlus,
  MoreHorizontal, Pencil, Trash2, RotateCcw, ShieldOff,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { authApi } from '@/lib/api/auth'
import { usersApi, type ApiUser, type CreateUserDto, type UpdateUserDto } from '@/lib/api/users'
import { useAuthStore } from '@/store/authStore'
import { emailField, requiredString } from '@/lib/validations/schemas'

export const Route = createFileRoute('/dashboard/admin')({
  beforeLoad: () => {
    const { isAuthenticated, isSuperAdmin } = useAuthStore.getState()
    if (!isAuthenticated) throw redirect({ to: '/login' })
    if (!isSuperAdmin) throw redirect({ to: '/dashboard' })
  },
  component: AdminDashboard,
})

// ── Schemas ──────────────────────────────────────────────────────────────────

const createUserSchema = z.object({
  position: requiredString('El cargo o posición'),
  email: emailField,
})
type CreateUserForm = z.infer<typeof createUserSchema>

const editUserSchema = z.object({
  name: requiredString('El nombre'),
  email: emailField,
})
type EditUserForm = z.infer<typeof editUserSchema>

// ── Helpers ───────────────────────────────────────────────────────────────────

function initials(name: string | undefined | null) {
  if (!name) return '?'
  return name
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase()
}

function isDeleted(user: ApiUser) {
  return !!user.deletedAt
}

// ── Main component ────────────────────────────────────────────────────────────

function AdminDashboard() {
  const navigate = useNavigate()
  const { user: me, clearAuth } = useAuthStore()
  const queryClient = useQueryClient()

  const [createOpen, setCreateOpen] = useState(false)
  const [editUser, setEditUser] = useState<ApiUser | null>(null)
  const [deleteUser, setDeleteUser] = useState<ApiUser | null>(null)

  // ── Data ──────────────────────────────────────────────────────────────────

  const { data: users = [], isLoading } = useQuery({
    queryKey: ['users'],
    queryFn: usersApi.list,
  })

  const totalActive = users.filter((u) => !isDeleted(u)).length
  const totalSuperAdmins = users.filter((u) => u.isSuperAdmin).length

  // ── Mutations ─────────────────────────────────────────────────────────────

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['users'] })

  const createMutation = useMutation({
    mutationFn: (dto: CreateUserDto) => usersApi.create(dto),
    onSuccess: () => { invalidate(); setCreateOpen(false) },
  })

  const editMutation = useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: UpdateUserDto }) => usersApi.update(id, dto),
    onSuccess: () => { invalidate(); setEditUser(null) },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => usersApi.remove(id),
    onSuccess: () => { invalidate(); setDeleteUser(null) },
  })

  const restoreMutation = useMutation({
    mutationFn: (id: string) => usersApi.restore(id),
    onSuccess: invalidate,
  })

  const toggleSuperAdminMutation = useMutation({
    mutationFn: ({ id, isSuperAdmin }: { id: string; isSuperAdmin: boolean }) =>
      usersApi.toggleSuperAdmin(id, isSuperAdmin),
    onSuccess: invalidate,
  })

  const logoutMutation = useMutation({
    mutationFn: authApi.logout,
    onSettled: () => { clearAuth(); navigate({ to: '/login' }) },
  })

  // ── Create form ───────────────────────────────────────────────────────────

  const createForm = useForm<CreateUserForm>({
    resolver: zodResolver(createUserSchema),
    mode: 'onTouched',
  })

  const onCreateSubmit = (values: CreateUserForm) => {
    createMutation.mutate(values)
  }

  // ── Edit form ─────────────────────────────────────────────────────────────

  const editForm = useForm<EditUserForm>({
    resolver: zodResolver(editUserSchema),
    mode: 'onTouched',
  })

  const openEdit = (u: ApiUser) => {
    setEditUser(u)
    editForm.reset({ name: u.name, email: u.email })
  }

  const onEditSubmit = (values: EditUserForm) => {
    if (!editUser) return
    editMutation.mutate({ id: editUser.id, dto: values })
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex h-screen bg-background overflow-hidden">

      {/* ── Sidebar ────────────────────────────────────────────────── */}
      <aside className="hidden lg:flex w-60 flex-col border-r border-border bg-card shrink-0">
        {/* Logo */}
        <div className="flex items-center gap-2.5 px-5 h-16 border-b border-border">
          <div className="flex items-center justify-center size-8 rounded-md bg-primary shrink-0">
            <FileText className="size-4 text-primary-foreground" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold truncate">SGD Helisa</p>
            <p className="text-[10px] text-muted-foreground">Panel de administración</p>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-0.5">
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-2 mb-2">
            Gestión
          </p>
          <NavItem icon={<Users className="size-4" />} label="Usuarios" active />
        </nav>

        {/* User info */}
        <div className="px-4 py-4 border-t border-border">
          <div className="flex items-center gap-2.5">
            <Avatar className="size-8">
              <AvatarFallback className="text-xs bg-primary/10 text-primary">
                {me?.name ? initials(me.name) : 'SA'}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium truncate">{me?.name ?? me?.email}</p>
              <p className="text-[10px] text-muted-foreground">Super Admin</p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="size-7 shrink-0 text-muted-foreground hover:text-destructive"
              onClick={() => logoutMutation.mutate()}
            >
              <LogOut className="size-3.5" />
            </Button>
          </div>
        </div>
      </aside>

      {/* ── Main content ───────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

        {/* Header */}
        <header className="flex items-center justify-between px-6 h-16 border-b border-border bg-card shrink-0">
          <h1 className="text-base font-semibold">Gestión de usuarios</h1>
          <Button size="sm" onClick={() => { createForm.reset(); setCreateOpen(true) }}>
            <UserPlus className="size-4" />
            Nuevo usuario
          </Button>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-auto p-6 space-y-6">

          {/* Stats */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <StatCard
              title="Total usuarios"
              value={users.length}
              icon={<Users className="size-5 text-muted-foreground" />}
            />
            <StatCard
              title="Usuarios activos"
              value={totalActive}
              icon={<Users className="size-5 text-muted-foreground" />}
            />
            <StatCard
              title="Super admins"
              value={totalSuperAdmins}
              icon={<ShieldCheck className="size-5 text-muted-foreground" />}
            />
          </div>

          {/* Users table */}
          <div className="rounded-lg border border-border bg-card overflow-hidden">
            <div className="px-5 py-4 border-b border-border">
              <h2 className="text-sm font-semibold">Usuarios</h2>
            </div>

            {isLoading ? (
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
                    <TableHead>Rol</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead className="w-10" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((u) => (
                    <TableRow key={u.id} className={isDeleted(u) ? 'opacity-50' : ''}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="size-8">
                            <AvatarFallback className="text-xs bg-primary/10 text-primary">
                              {initials(u.name)}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="text-sm font-medium">{u.name}</p>
                            <p className="text-xs text-muted-foreground">{u.email}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        {u.isSuperAdmin ? (
                          <Badge variant="default" className="gap-1 text-xs">
                            <ShieldCheck className="size-3" />
                            Super Admin
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="text-xs">
                            Usuario
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
                                <DropdownMenuItem onClick={() => openEdit(u)}>
                                  <Pencil className="size-4" />
                                  Editar
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() =>
                                    toggleSuperAdminMutation.mutate({
                                      id: u.id,
                                      isSuperAdmin: !u.isSuperAdmin,
                                    })
                                  }
                                >
                                  {u.isSuperAdmin ? (
                                    <><ShieldOff className="size-4" />Quitar Super Admin</>
                                  ) : (
                                    <><ShieldCheck className="size-4" />Dar Super Admin</>
                                  )}
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  className="text-destructive focus:text-destructive"
                                  onClick={() => setDeleteUser(u)}
                                >
                                  <Trash2 className="size-4" />
                                  Eliminar
                                </DropdownMenuItem>
                              </>
                            )}
                            {isDeleted(u) && (
                              <DropdownMenuItem onClick={() => restoreMutation.mutate(u.id)}>
                                <RotateCcw className="size-4" />
                                Restaurar
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </main>
      </div>

      {/* ── Create user dialog ─────────────────────────────────────── */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Nuevo usuario</DialogTitle>
          </DialogHeader>
          <form onSubmit={createForm.handleSubmit(onCreateSubmit)} className="space-y-4 pt-2">
            <FormField
              id="create-email"
              label="Correo electrónico"
              error={createForm.formState.errors.email?.message}
            >
              <Input
                id="create-email"
                type="email"
                placeholder="usuario@empresa.com"
                {...createForm.register('email')}
              />
            </FormField>
            <FormField
              id="create-position"
              label="Cargo o posición"
              error={createForm.formState.errors.position?.message}
            >
              <Input
                id="create-position"
                placeholder="Gerente de Ventas"
                {...createForm.register('position')}
              />
            </FormField>
            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={createMutation.isPending || !createForm.formState.isValid}
              >
                {createMutation.isPending ? 'Creando...' : 'Crear usuario'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Edit user dialog ───────────────────────────────────────── */}
      <Dialog open={!!editUser} onOpenChange={(open) => { if (!open) setEditUser(null) }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Editar usuario</DialogTitle>
          </DialogHeader>
          <form onSubmit={editForm.handleSubmit(onEditSubmit)} className="space-y-4 pt-2">
            <FormField
              id="edit-email"
              label="Correo electrónico"
              error={editForm.formState.errors.email?.message}
            >
              <Input
                id="edit-email"
                type="email"
                placeholder="usuario@empresa.com"
                {...editForm.register('email')}
              />
            </FormField>
            <FormField
              id="edit-position"
              label="Cargo o posición"
              error={editForm.formState.errors.name?.message}
            >
              <Input id="edit-name" placeholder="Juan García" {...editForm.register('name')} />
            </FormField>
            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setEditUser(null)}>
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={editMutation.isPending || !editForm.formState.isValid}
              >
                {editMutation.isPending ? 'Guardando...' : 'Guardar cambios'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Delete confirmation dialog ─────────────────────────────── */}
      <Dialog open={!!deleteUser} onOpenChange={(open) => { if (!open) setDeleteUser(null) }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Eliminar usuario</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            ¿Estás seguro de que deseas eliminar a{' '}
            <span className="font-medium text-foreground">{deleteUser?.name}</span>?
            Podrás restaurarlo después.
          </p>
          <DialogFooter className="pt-2">
            <Button variant="outline" onClick={() => setDeleteUser(null)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              disabled={deleteMutation.isPending}
              onClick={() => deleteUser && deleteMutation.mutate(deleteUser.id)}
            >
              {deleteMutation.isPending ? 'Eliminando...' : 'Eliminar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────

function StatCard({ title, value, icon }: { title: string; value: number; icon: React.ReactNode }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        {icon}
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-bold">{value}</p>
      </CardContent>
    </Card>
  )
}

function NavItem({ icon, label, active }: { icon: React.ReactNode; label: string; active?: boolean }) {
  return (
    <button
      type="button"
      className={`flex items-center gap-2.5 w-full px-2 py-2 rounded-md text-sm transition-colors ${
        active
          ? 'bg-primary/10 text-primary font-medium'
          : 'text-muted-foreground hover:bg-accent hover:text-foreground'
      }`}
    >
      {icon}
      {label}
    </button>
  )
}

function FormField({
  id, label, error, children,
}: {
  id: string
  label: string
  error?: string
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  )
}
