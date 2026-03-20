import { useState, useMemo } from "react";
import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  FileText,
  LogOut,
  Users,
  UserPlus,
  MoreHorizontal,
  Pencil,
  Trash2,
  RotateCcw,
  Building2,
  ChevronRight,
  ChevronDown,
  Shield,
  Key,
  Plus,
  X,
  ShieldOff,
  UserCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Checkbox } from "@/components/ui/checkbox";
import { authApi } from "@/lib/api/auth";
import {
  usersApi,
  type ApiUser,
  type CreateUserDto,
  type UpdateUserDto,
} from "@/lib/api/users";
import { companiesApi, type ApiCompany } from "@/lib/api/companies";
import {
  rolesApi,
  type ApiRole,
  type ApiPermission,
  type ApiUserPermission,
  ALL_PERMISSIONS,
} from "@/lib/api/roles";
import { useAuthStore } from "@/store/authStore";
import { emailField, requiredString } from "@/lib/validations/schemas";

// ── Route ─────────────────────────────────────────────────────────────────────

export const Route = createFileRoute("/dashboard/")({
  beforeLoad: () => {
    const { isSuperAdmin } = useAuthStore.getState();
    if (isSuperAdmin) throw redirect({ to: "/dashboard/admin" });
  },
  component: CompanyDashboard,
});

// ── Schemas ───────────────────────────────────────────────────────────────────

const createUserSchema = z.object({
  position: requiredString("El cargo o posición"),
  email: emailField,
});
type CreateUserForm = z.infer<typeof createUserSchema>;

const editUserSchema = z.object({
  name: requiredString("El nombre"),
  email: emailField,
});
type EditUserForm = z.infer<typeof editUserSchema>;

const roleSchema = z.object({
  name: requiredString("El nombre del rol"),
  description: requiredString("La descripción"),
});
type RoleForm = z.infer<typeof roleSchema>;

// ── Helpers ───────────────────────────────────────────────────────────────────

function initials(name: string | undefined | null) {
  if (!name) return "?";
  return name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}

function isDeleted(user: ApiUser) {
  return !!user.deletedAt;
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("es-CO", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

// Computes per-permission who has it and via which mechanism
interface PermissionUserEntry {
  user: ApiUser;
  viaRoles: ApiRole[];
  isDirect: boolean;
}

function getUsersForPermission(
  permissionId: string,
  roles: ApiRole[],
  users: ApiUser[],
  userPermissions: ApiUserPermission[],
): PermissionUserEntry[] {
  const map = new Map<string, PermissionUserEntry>();

  for (const role of roles) {
    if (!role.permissionIds.includes(permissionId)) continue;
    for (const uid of role.userIds) {
      const user = users.find((u) => u.id === uid);
      if (!user) continue;
      const existing = map.get(uid);
      if (existing) existing.viaRoles.push(role);
      else map.set(uid, { user, viaRoles: [role], isDirect: false });
    }
  }

  for (const up of userPermissions) {
    if (up.permissionId !== permissionId) continue;
    const user = users.find((u) => u.id === up.userId);
    if (!user) continue;
    const existing = map.get(up.userId);
    if (existing) existing.isDirect = true;
    else map.set(up.userId, { user, viaRoles: [], isDirect: true });
  }

  return Array.from(map.values());
}

// ── Main component ────────────────────────────────────────────────────────────

// Demo: use 'c1' as mock company for non-super-admin users
const DEMO_COMPANY_ID = "c1";

function CompanyDashboard() {
  const navigate = useNavigate();
  const { user: me, clearAuth } = useAuthStore();
  const queryClient = useQueryClient();
  const companyId = me?.companyId ?? DEMO_COMPANY_ID;

  const [activeTab, setActiveTab] = useState<"company" | "users" | "roles">("company");

  // User modals
  const [createUserOpen, setCreateUserOpen] = useState(false);
  const [editUser, setEditUser] = useState<ApiUser | null>(null);
  const [deleteUser, setDeleteUser] = useState<ApiUser | null>(null);

  // Role modals
  const [createRoleOpen, setCreateRoleOpen] = useState(false);
  const [editRole, setEditRole] = useState<ApiRole | null>(null);
  const [deleteRole, setDeleteRole] = useState<ApiRole | null>(null);
  const [selectedPermIds, setSelectedPermIds] = useState<string[]>([]);

  // Assign modals
  const [assignRoleUser, setAssignRoleUser] = useState<{ role: ApiRole } | null>(null);
  const [assignPermUser, setAssignPermUser] = useState<{ permissionId: string } | null>(null);
  const [revokePermTarget, setRevokePermTarget] = useState<{ userId: string; permissionId: string } | null>(null);

  // Expanded rows
  const [expandedRoles, setExpandedRoles] = useState<Set<string>>(new Set());
  const [expandedPermissions, setExpandedPermissions] = useState<Set<string>>(new Set());

  // ── Data ────────────────────────────────────────────────────────────────────

  const { data: company } = useQuery({
    queryKey: ["company", companyId],
    queryFn: () => companiesApi.getById(companyId),
    staleTime: 60_000,
  });

  const { data: companyUsers = [], isLoading: usersLoading } = useQuery({
    queryKey: ["company-users", companyId],
    queryFn: () => companiesApi.listUsers(companyId),
    staleTime: 60_000,
    refetchInterval: 30_000,
    refetchIntervalInBackground: false,
  });

  const { data: roles = [], isLoading: rolesLoading } = useQuery({
    queryKey: ["roles", companyId],
    queryFn: () => rolesApi.listRoles(companyId),
    staleTime: 60_000,
  });

  const { data: userPermissions = [] } = useQuery({
    queryKey: ["user-permissions", companyId],
    queryFn: () => rolesApi.listUserPermissions(companyId),
    staleTime: 60_000,
  });

  const activeUsers = companyUsers.filter((u) => !isDeleted(u));

  // ── Invalidators ────────────────────────────────────────────────────────────

  const invalidateUsers = () =>
    queryClient.invalidateQueries({ queryKey: ["company-users", companyId] });

  const invalidateRoles = () =>
    queryClient.invalidateQueries({ queryKey: ["roles", companyId] });

  const invalidatePermissions = () =>
    queryClient.invalidateQueries({ queryKey: ["user-permissions", companyId] });

  // ── User mutations ───────────────────────────────────────────────────────────

  const createUserMutation = useMutation({
    mutationFn: (dto: CreateUserDto) => usersApi.create(dto),
    onSuccess: () => {
      invalidateUsers();
      setCreateUserOpen(false);
    },
  });

  const editUserMutation = useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: UpdateUserDto }) =>
      usersApi.update(id, dto),
    onSuccess: () => {
      invalidateUsers();
      setEditUser(null);
    },
  });

  const deleteUserMutation = useMutation({
    mutationFn: (id: string) => usersApi.remove(id),
    onSuccess: () => {
      invalidateUsers();
      setDeleteUser(null);
    },
  });

  const restoreUserMutation = useMutation({
    mutationFn: (id: string) => usersApi.restore(id),
    onSuccess: invalidateUsers,
  });

  // ── Role mutations ──────────────────────────────────────────────────────────

  const createRoleMutation = useMutation({
    mutationFn: (dto: { name: string; description: string; permissionIds: string[] }) =>
      rolesApi.createRole(companyId, dto),
    onSuccess: () => {
      invalidateRoles();
      setCreateRoleOpen(false);
    },
  });

  const editRoleMutation = useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: { name: string; description: string; permissionIds: string[] } }) =>
      rolesApi.updateRole(id, dto),
    onSuccess: () => {
      invalidateRoles();
      setEditRole(null);
    },
  });

  const deleteRoleMutation = useMutation({
    mutationFn: (id: string) => rolesApi.deleteRole(id),
    onSuccess: () => {
      invalidateRoles();
      setDeleteRole(null);
    },
  });

  const assignUserToRoleMutation = useMutation({
    mutationFn: ({ roleId, userId }: { roleId: string; userId: string }) =>
      rolesApi.assignUserToRole(roleId, userId),
    onSuccess: () => {
      invalidateRoles();
      setAssignRoleUser(null);
    },
  });

  const removeUserFromRoleMutation = useMutation({
    mutationFn: ({ roleId, userId }: { roleId: string; userId: string }) =>
      rolesApi.removeUserFromRole(roleId, userId),
    onSuccess: invalidateRoles,
  });

  const assignPermMutation = useMutation({
    mutationFn: ({ userId, permissionId }: { userId: string; permissionId: string }) =>
      rolesApi.assignPermissionToUser(userId, permissionId),
    onSuccess: () => {
      invalidatePermissions();
      setAssignPermUser(null);
    },
  });

  const revokePermMutation = useMutation({
    mutationFn: ({ userId, permissionId }: { userId: string; permissionId: string }) =>
      rolesApi.revokePermissionFromUser(userId, permissionId),
    onSuccess: () => {
      invalidatePermissions();
      setRevokePermTarget(null);
    },
  });

  const logoutMutation = useMutation({
    mutationFn: authApi.logout,
    onSettled: () => {
      clearAuth();
      navigate({ to: "/login" });
    },
  });

  // ── Forms ────────────────────────────────────────────────────────────────────

  const createUserForm = useForm<CreateUserForm>({
    resolver: zodResolver(createUserSchema),
    mode: "onTouched",
  });

  const editUserForm = useForm<EditUserForm>({
    resolver: zodResolver(editUserSchema),
    mode: "onTouched",
  });

  const roleCreateForm = useForm<RoleForm>({
    resolver: zodResolver(roleSchema),
    mode: "onTouched",
  });

  const roleEditForm = useForm<RoleForm>({
    resolver: zodResolver(roleSchema),
    mode: "onTouched",
  });

  const openEditUser = (u: ApiUser) => {
    setEditUser(u);
    editUserForm.reset({ name: u.firstName, email: u.email });
  };

  const openEditRole = (role: ApiRole) => {
    setEditRole(role);
    setSelectedPermIds([...role.permissionIds]);
    roleEditForm.reset({ name: role.name, description: role.description });
  };

  const openCreateRole = () => {
    setSelectedPermIds([]);
    roleCreateForm.reset();
    setCreateRoleOpen(true);
  };

  const togglePerm = (permId: string) =>
    setSelectedPermIds((prev) =>
      prev.includes(permId) ? prev.filter((p) => p !== permId) : [...prev, permId],
    );

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* ── Sidebar ────────────────────────────────────────────────── */}
      <aside className="hidden lg:flex w-60 flex-col border-r border-border bg-card shrink-0">
        <div className="flex items-center gap-2.5 px-5 h-16 border-b border-border">
          <div className="flex items-center justify-center size-8 rounded-md bg-primary shrink-0">
            <FileText className="size-4 text-primary-foreground" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold truncate">SGD Helisa</p>
            <p className="text-[10px] text-muted-foreground truncate">
              {company?.name ?? "Cargando..."}
            </p>
          </div>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-0.5">
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-2 mb-2">
            Gestión
          </p>
          <NavItem
            icon={<Building2 className="size-4" />}
            label="Empresa"
            active={activeTab === "company"}
            onClick={() => setActiveTab("company")}
          />
          <NavItem
            icon={<Users className="size-4" />}
            label="Usuarios"
            active={activeTab === "users"}
            onClick={() => setActiveTab("users")}
          />
          <NavItem
            icon={<Shield className="size-4" />}
            label="Roles y permisos"
            active={activeTab === "roles"}
            onClick={() => setActiveTab("roles")}
          />
        </nav>

        <div className="px-4 py-4 border-t border-border">
          <div className="flex items-center gap-2.5">
            <Avatar className="size-8">
              <AvatarFallback className="text-xs bg-primary/10 text-primary">
                {me?.name ? initials(me.name) : "?"}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium truncate">
                {me?.name ?? me?.email}
              </p>
              <p className="text-[10px] text-muted-foreground">{me?.role ?? "Usuario"}</p>
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

      {/* ── Main ────────────────────────────────────────────────────── */}
      <Tabs
        value={activeTab}
        onValueChange={(v) => setActiveTab(v as typeof activeTab)}
        className="flex-1 min-w-0 overflow-hidden gap-0"
      >
        {/* Header */}
        <header className="flex items-center justify-between px-6 h-16 border-b border-border bg-card shrink-0">
          <TabsList>
            <TabsTrigger value="company">
              <Building2 className="size-4" />
              Empresa
            </TabsTrigger>
            <TabsTrigger value="users">
              <Users className="size-4" />
              Usuarios
            </TabsTrigger>
            <TabsTrigger value="roles">
              <Shield className="size-4" />
              Roles y permisos
            </TabsTrigger>
          </TabsList>

          {activeTab === "users" && (
            <Button
              size="sm"
              onClick={() => {
                createUserForm.reset();
                setCreateUserOpen(true);
              }}
            >
              <UserPlus className="size-4" />
              Nuevo usuario
            </Button>
          )}
          {activeTab === "roles" && (
            <Button size="sm" onClick={openCreateRole}>
              <Plus className="size-4" />
              Nuevo rol
            </Button>
          )}
        </header>

        {/* ── Tab: Empresa ────────────────────────────────────────────── */}
        <TabsContent value="company" className="overflow-auto">
          <main className="p-6 space-y-6">
            {company ? (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <StatCard
                    title="Usuarios activos"
                    value={activeUsers.length}
                    icon={<Users className="size-5 text-muted-foreground" />}
                  />
                  <StatCard
                    title="Roles configurados"
                    value={roles.length}
                    icon={<Shield className="size-5 text-muted-foreground" />}
                  />
                  <StatCard
                    title="Total usuarios"
                    value={companyUsers.length}
                    icon={<UserCheck className="size-5 text-muted-foreground" />}
                  />
                </div>

                <div className="rounded-lg border border-border bg-card overflow-hidden">
                  <div className="px-5 py-4 border-b border-border">
                    <h2 className="text-sm font-semibold">Información de la empresa</h2>
                  </div>
                  <div className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <InfoRow label="Nombre" value={company.name} />
                    <InfoRow label="NIT" value={company.nit} mono />
                    <InfoRow label="Ciudad" value={company.city} />
                    <InfoRow
                      label="Estado"
                      value={
                        company.status === "active" ? (
                          <Badge
                            variant="outline"
                            className="text-xs text-emerald-600 border-emerald-200 bg-emerald-50"
                          >
                            Activa
                          </Badge>
                        ) : (
                          <Badge
                            variant="outline"
                            className="text-xs text-muted-foreground"
                          >
                            Inactiva
                          </Badge>
                        )
                      }
                    />
                    <InfoRow label="Miembro desde" value={formatDate(company.createdAt)} />
                  </div>
                </div>
              </>
            ) : (
              <div className="flex items-center justify-center py-20 text-sm text-muted-foreground">
                Cargando información de la empresa...
              </div>
            )}
          </main>
        </TabsContent>

        {/* ── Tab: Usuarios ───────────────────────────────────────────── */}
        <TabsContent value="users" className="overflow-auto">
          <main className="p-6 space-y-6">
            <div className="rounded-lg border border-border bg-card overflow-hidden">
              <div className="px-5 py-4 border-b border-border flex items-center justify-between">
                <h2 className="text-sm font-semibold">Usuarios de la empresa</h2>
                <span className="text-xs text-muted-foreground">
                  {activeUsers.length} activos · {companyUsers.length} total
                </span>
              </div>

              {usersLoading ? (
                <div className="flex items-center justify-center py-16 text-sm text-muted-foreground">
                  Cargando usuarios...
                </div>
              ) : companyUsers.length === 0 ? (
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
                    {companyUsers.map((u) => {
                      const userRoles = roles.filter((r) => r.userIds.includes(u.id));
                      return (
                        <TableRow key={u.id} className={isDeleted(u) ? "opacity-50" : ""}>
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <Avatar className="size-8">
                                <AvatarFallback className="text-xs bg-primary/10 text-primary">
                                  {initials(u.firstName)}
                                </AvatarFallback>
                              </Avatar>
                              <div>
                                <p className="text-sm font-medium">
                                  {u.firstName} {u.lastName}
                                </p>
                                <p className="text-xs text-muted-foreground">{u.email}</p>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {u.position ?? "—"}
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-1">
                              {userRoles.length > 0 ? (
                                userRoles.map((r) => (
                                  <Badge key={r.id} variant="secondary" className="text-xs">
                                    {r.name}
                                  </Badge>
                                ))
                              ) : (
                                <span className="text-xs text-muted-foreground">Sin rol</span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            {u.registrationStatus === "pending_credentials" ? (
                              <Badge variant="default" className="text-xs">
                                Pendiente
                              </Badge>
                            ) : (
                              <Badge
                                variant="outline"
                                className="text-xs text-emerald-600 border-emerald-200 bg-emerald-50"
                              >
                                Registrado
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            {isDeleted(u) ? (
                              <Badge variant="destructive" className="text-xs">
                                Eliminado
                              </Badge>
                            ) : (
                              <Badge
                                variant="outline"
                                className="text-xs text-emerald-600 border-emerald-200 bg-emerald-50"
                              >
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
                                    <DropdownMenuItem onClick={() => openEditUser(u)}>
                                      <Pencil className="size-4" />
                                      Editar
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
                                  <DropdownMenuItem
                                    onClick={() => restoreUserMutation.mutate(u.id)}
                                  >
                                    <RotateCcw className="size-4" />
                                    Restaurar
                                  </DropdownMenuItem>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </div>
          </main>
        </TabsContent>

        {/* ── Tab: Roles ──────────────────────────────────────────────── */}
        <TabsContent value="roles" className="overflow-auto">
          <RolesSection
            companyId={companyId}
            roles={roles}
            rolesLoading={rolesLoading}
            users={companyUsers}
            permissions={ALL_PERMISSIONS}
            userPermissions={userPermissions}
            expandedRoles={expandedRoles}
            setExpandedRoles={setExpandedRoles}
            expandedPermissions={expandedPermissions}
            setExpandedPermissions={setExpandedPermissions}
            onEditRole={openEditRole}
            onDeleteRole={setDeleteRole}
            onRemoveUserFromRole={(roleId, userId) =>
              removeUserFromRoleMutation.mutate({ roleId, userId })
            }
            onAssignRoleUser={(role) => setAssignRoleUser({ role })}
            onAssignPermUser={(permissionId) => setAssignPermUser({ permissionId })}
            onRevokePermUser={(userId, permissionId) =>
              setRevokePermTarget({ userId, permissionId })
            }
          />
        </TabsContent>
      </Tabs>

      {/* ── Create user dialog ──────────────────────────────────────── */}
      <Dialog open={createUserOpen} onOpenChange={setCreateUserOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Nuevo usuario · {company?.name}</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={createUserForm.handleSubmit((values) =>
              createUserMutation.mutate({
                ...values,
                isSuperAdmin: false,
                companyId,
              }),
            )}
            className="space-y-4 pt-2"
          >
            <FormField
              id="cu-email"
              label="Correo electrónico"
              error={createUserForm.formState.errors.email?.message}
            >
              <Input
                id="cu-email"
                type="email"
                placeholder="usuario@empresa.com"
                {...createUserForm.register("email")}
              />
            </FormField>
            <FormField
              id="cu-position"
              label="Cargo o posición"
              error={createUserForm.formState.errors.position?.message}
            >
              <Input
                id="cu-position"
                placeholder="Gerente de Ventas"
                {...createUserForm.register("position")}
              />
            </FormField>
            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setCreateUserOpen(false)}>
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={createUserMutation.isPending || !createUserForm.formState.isValid}
              >
                {createUserMutation.isPending ? "Creando..." : "Crear usuario"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Edit user dialog ────────────────────────────────────────── */}
      <Dialog open={!!editUser} onOpenChange={(o) => { if (!o) setEditUser(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Editar usuario</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={editUserForm.handleSubmit((values) => {
              if (!editUser) return;
              editUserMutation.mutate({ id: editUser.id, dto: values });
            })}
            className="space-y-4 pt-2"
          >
            <FormField
              id="eu-email"
              label="Correo electrónico"
              error={editUserForm.formState.errors.email?.message}
            >
              <Input id="eu-email" type="email" {...editUserForm.register("email")} />
            </FormField>
            <FormField
              id="eu-name"
              label="Nombre"
              error={editUserForm.formState.errors.name?.message}
            >
              <Input id="eu-name" placeholder="Juan García" {...editUserForm.register("name")} />
            </FormField>
            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setEditUser(null)}>
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={editUserMutation.isPending || !editUserForm.formState.isValid}
              >
                {editUserMutation.isPending ? "Guardando..." : "Guardar cambios"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Delete user dialog ──────────────────────────────────────── */}
      <Dialog open={!!deleteUser} onOpenChange={(o) => { if (!o) setDeleteUser(null); }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Eliminar usuario</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            ¿Eliminar a{" "}
            <span className="font-medium text-foreground">{deleteUser?.firstName}</span>? Podrás
            restaurarlo después.
          </p>
          <DialogFooter className="pt-2">
            <Button variant="outline" onClick={() => setDeleteUser(null)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              disabled={deleteUserMutation.isPending}
              onClick={() => deleteUser && deleteUserMutation.mutate(deleteUser.id)}
            >
              {deleteUserMutation.isPending ? "Eliminando..." : "Eliminar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Create role dialog ──────────────────────────────────────── */}
      <Dialog open={createRoleOpen} onOpenChange={setCreateRoleOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Nuevo rol</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={roleCreateForm.handleSubmit((values) =>
              createRoleMutation.mutate({ ...values, permissionIds: selectedPermIds }),
            )}
            className="space-y-4 pt-2"
          >
            <FormField id="cr-name" label="Nombre del rol" error={roleCreateForm.formState.errors.name?.message}>
              <Input id="cr-name" placeholder="Gestor Documentos" {...roleCreateForm.register("name")} />
            </FormField>
            <FormField id="cr-desc" label="Descripción" error={roleCreateForm.formState.errors.description?.message}>
              <Input id="cr-desc" placeholder="Descripción breve del rol" {...roleCreateForm.register("description")} />
            </FormField>
            <div className="space-y-2">
              <Label className="text-sm">Permisos del rol</Label>
              <PermissionSelector
                permissions={ALL_PERMISSIONS}
                selected={selectedPermIds}
                onToggle={togglePerm}
              />
            </div>
            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setCreateRoleOpen(false)}>
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={createRoleMutation.isPending || !roleCreateForm.formState.isValid}
              >
                {createRoleMutation.isPending ? "Creando..." : "Crear rol"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Edit role dialog ────────────────────────────────────────── */}
      <Dialog open={!!editRole} onOpenChange={(o) => { if (!o) setEditRole(null); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Editar rol</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={roleEditForm.handleSubmit((values) => {
              if (!editRole) return;
              editRoleMutation.mutate({ id: editRole.id, dto: { ...values, permissionIds: selectedPermIds } });
            })}
            className="space-y-4 pt-2"
          >
            <FormField id="er-name" label="Nombre del rol" error={roleEditForm.formState.errors.name?.message}>
              <Input id="er-name" {...roleEditForm.register("name")} />
            </FormField>
            <FormField id="er-desc" label="Descripción" error={roleEditForm.formState.errors.description?.message}>
              <Input id="er-desc" {...roleEditForm.register("description")} />
            </FormField>
            <div className="space-y-2">
              <Label className="text-sm">Permisos del rol</Label>
              <PermissionSelector
                permissions={ALL_PERMISSIONS}
                selected={selectedPermIds}
                onToggle={togglePerm}
              />
            </div>
            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setEditRole(null)}>
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={editRoleMutation.isPending || !roleEditForm.formState.isValid}
              >
                {editRoleMutation.isPending ? "Guardando..." : "Guardar cambios"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Delete role dialog ──────────────────────────────────────── */}
      <Dialog open={!!deleteRole} onOpenChange={(o) => { if (!o) setDeleteRole(null); }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Eliminar rol</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            ¿Eliminar el rol{" "}
            <span className="font-medium text-foreground">"{deleteRole?.name}"</span>? Los
            usuarios con este rol perderán los permisos asociados.
          </p>
          <DialogFooter className="pt-2">
            <Button variant="outline" onClick={() => setDeleteRole(null)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              disabled={deleteRoleMutation.isPending}
              onClick={() => deleteRole && deleteRoleMutation.mutate(deleteRole.id)}
            >
              {deleteRoleMutation.isPending ? "Eliminando..." : "Eliminar rol"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Assign user to role dialog ──────────────────────────────── */}
      <Dialog open={!!assignRoleUser} onOpenChange={(o) => { if (!o) setAssignRoleUser(null); }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Asignar rol · {assignRoleUser?.role.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-1 py-2">
            {activeUsers
              .filter((u) => !assignRoleUser?.role.userIds.includes(u.id))
              .map((u) => (
                <button
                  key={u.id}
                  type="button"
                  className="flex items-center gap-3 w-full px-3 py-2 rounded-md hover:bg-accent text-left transition-colors"
                  onClick={() =>
                    assignRoleUser &&
                    assignUserToRoleMutation.mutate({
                      roleId: assignRoleUser.role.id,
                      userId: u.id,
                    })
                  }
                >
                  <Avatar className="size-7">
                    <AvatarFallback className="text-[10px] bg-primary/10 text-primary">
                      {initials(u.firstName)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <p className="text-sm font-medium">
                      {u.firstName} {u.lastName}
                    </p>
                    <p className="text-xs text-muted-foreground">{u.position}</p>
                  </div>
                </button>
              ))}
            {activeUsers.filter((u) => !assignRoleUser?.role.userIds.includes(u.id)).length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">
                Todos los usuarios activos ya tienen este rol
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignRoleUser(null)}>
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Assign permission to user dialog ───────────────────────── */}
      <Dialog open={!!assignPermUser} onOpenChange={(o) => { if (!o) setAssignPermUser(null); }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>
              Asignar permiso directamente
            </DialogTitle>
          </DialogHeader>
          <p className="text-xs text-muted-foreground -mt-2">
            Permiso:{" "}
            <span className="font-medium text-foreground">
              {ALL_PERMISSIONS.find((p) => p.id === assignPermUser?.permissionId)?.label}
            </span>
          </p>
          <div className="space-y-1 py-2">
            {activeUsers
              .filter((u) => {
                if (!assignPermUser) return false;
                const hasDirect = userPermissions.some(
                  (up) => up.userId === u.id && up.permissionId === assignPermUser.permissionId,
                );
                return !hasDirect;
              })
              .map((u) => (
                <button
                  key={u.id}
                  type="button"
                  className="flex items-center gap-3 w-full px-3 py-2 rounded-md hover:bg-accent text-left transition-colors"
                  onClick={() =>
                    assignPermUser &&
                    assignPermMutation.mutate({
                      userId: u.id,
                      permissionId: assignPermUser.permissionId,
                    })
                  }
                >
                  <Avatar className="size-7">
                    <AvatarFallback className="text-[10px] bg-primary/10 text-primary">
                      {initials(u.firstName)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <p className="text-sm font-medium">
                      {u.firstName} {u.lastName}
                    </p>
                    <p className="text-xs text-muted-foreground">{u.position}</p>
                  </div>
                </button>
              ))}
            {activeUsers.filter((u) => {
              if (!assignPermUser) return false;
              return !userPermissions.some(
                (up) => up.userId === u.id && up.permissionId === assignPermUser.permissionId,
              );
            }).length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">
                Todos los usuarios ya tienen este permiso asignado directamente
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignPermUser(null)}>
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Revoke direct permission dialog ────────────────────────── */}
      <Dialog
        open={!!revokePermTarget}
        onOpenChange={(o) => { if (!o) setRevokePermTarget(null); }}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Revocar permiso directo</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            ¿Revocar el permiso{" "}
            <span className="font-medium text-foreground">
              "{ALL_PERMISSIONS.find((p) => p.id === revokePermTarget?.permissionId)?.label}"
            </span>{" "}
            asignado directamente a{" "}
            <span className="font-medium text-foreground">
              {companyUsers.find((u) => u.id === revokePermTarget?.userId)?.firstName}
            </span>
            ? El usuario puede conservar el permiso si lo tiene mediante un rol.
          </p>
          <DialogFooter className="pt-2">
            <Button variant="outline" onClick={() => setRevokePermTarget(null)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              disabled={revokePermMutation.isPending}
              onClick={() =>
                revokePermTarget &&
                revokePermMutation.mutate({
                  userId: revokePermTarget.userId,
                  permissionId: revokePermTarget.permissionId,
                })
              }
            >
              {revokePermMutation.isPending ? "Revocando..." : "Revocar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── RolesSection ──────────────────────────────────────────────────────────────

function RolesSection({
  roles,
  rolesLoading,
  users,
  permissions,
  userPermissions,
  expandedRoles,
  setExpandedRoles,
  expandedPermissions,
  setExpandedPermissions,
  onEditRole,
  onDeleteRole,
  onRemoveUserFromRole,
  onAssignRoleUser,
  onAssignPermUser,
  onRevokePermUser,
}: {
  companyId: string;
  roles: ApiRole[];
  rolesLoading: boolean;
  users: ApiUser[];
  permissions: ApiPermission[];
  userPermissions: ApiUserPermission[];
  expandedRoles: Set<string>;
  setExpandedRoles: (s: Set<string>) => void;
  expandedPermissions: Set<string>;
  setExpandedPermissions: (s: Set<string>) => void;
  onEditRole: (r: ApiRole) => void;
  onDeleteRole: (r: ApiRole) => void;
  onRemoveUserFromRole: (roleId: string, userId: string) => void;
  onAssignRoleUser: (role: ApiRole) => void;
  onAssignPermUser: (permissionId: string) => void;
  onRevokePermUser: (userId: string, permissionId: string) => void;
}) {
  const [view, setView] = useState<"by-role" | "by-permission">("by-role");

  const toggleRole = (id: string) => {
    const next = new Set(expandedRoles);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setExpandedRoles(next);
  };

  const togglePermission = (id: string) => {
    const next = new Set(expandedPermissions);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setExpandedPermissions(next);
  };

  return (
    <main className="p-6 space-y-4">
      <Tabs
        value={view}
        onValueChange={(v) => setView(v as typeof view)}
        className="gap-0"
      >
        <TabsList className="w-fit">
          <TabsTrigger value="by-role">
            <Shield className="size-4" />
            Por rol
          </TabsTrigger>
          <TabsTrigger value="by-permission">
            <Key className="size-4" />
            Por permiso
          </TabsTrigger>
        </TabsList>

        {/* ── Por Rol ─────────────────────────────────────────────── */}
        <TabsContent value="by-role" className="mt-4">
          <div className="rounded-lg border border-border bg-card overflow-hidden">
            {rolesLoading ? (
              <div className="flex items-center justify-center py-16 text-sm text-muted-foreground">
                Cargando roles...
              </div>
            ) : roles.length === 0 ? (
              <div className="flex items-center justify-center py-16 text-sm text-muted-foreground">
                No hay roles creados
              </div>
            ) : (
              <div className="divide-y divide-border">
                {roles.map((role) => {
                  const isExpanded = expandedRoles.has(role.id);
                  const roleUsers = users.filter((u) => role.userIds.includes(u.id));
                  return (
                    <div key={role.id}>
                      {/* Role row */}
                      <div
                        className="flex items-center gap-3 px-5 py-3.5 hover:bg-muted/30 transition-colors cursor-pointer"
                        onClick={() => toggleRole(role.id)}
                      >
                        <button
                          type="button"
                          className="flex items-center justify-center size-6 rounded text-muted-foreground shrink-0"
                          onClick={(e) => { e.stopPropagation(); toggleRole(role.id); }}
                        >
                          {isExpanded ? (
                            <ChevronDown className="size-4" />
                          ) : (
                            <ChevronRight className="size-4" />
                          )}
                        </button>

                        <div className="flex items-center justify-center size-8 rounded-md bg-primary/10 shrink-0">
                          <Shield className="size-4 text-primary" />
                        </div>

                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium">{role.name}</p>
                          <p className="text-xs text-muted-foreground">{role.description}</p>
                        </div>

                        <div className="flex items-center gap-3 shrink-0" onClick={(e) => e.stopPropagation()}>
                          <span className="text-xs text-muted-foreground">
                            {role.permissionIds.length} permisos
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {roleUsers.length} {roleUsers.length === 1 ? "usuario" : "usuarios"}
                          </span>
                          <DropdownMenu>
                            <DropdownMenuTrigger className="inline-flex items-center justify-center size-8 rounded-md text-muted-foreground hover:bg-accent hover:text-foreground transition-colors">
                              <MoreHorizontal className="size-4" />
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => onEditRole(role)}>
                                <Pencil className="size-4" />
                                Editar rol
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                className="text-destructive focus:text-destructive"
                                onClick={() => onDeleteRole(role)}
                              >
                                <Trash2 className="size-4" />
                                Eliminar rol
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>

                      {/* Expanded content */}
                      {isExpanded && (
                        <div className="bg-muted/30 border-t border-border px-14 py-4 space-y-4">
                          {/* Permissions */}
                          <div>
                            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                              Permisos del rol
                            </p>
                            <div className="flex flex-wrap gap-1.5">
                              {role.permissionIds.length === 0 ? (
                                <span className="text-xs text-muted-foreground">Sin permisos</span>
                              ) : (
                                role.permissionIds.map((pid) => {
                                  const perm = permissions.find((p) => p.id === pid);
                                  return perm ? (
                                    <Badge key={pid} variant="outline" className="text-xs">
                                      {perm.label}
                                    </Badge>
                                  ) : null;
                                })
                              )}
                            </div>
                          </div>

                          {/* Users */}
                          <div>
                            <div className="flex items-center justify-between mb-2">
                              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                                Usuarios asignados
                              </p>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 text-xs"
                                onClick={() => onAssignRoleUser(role)}
                              >
                                <UserPlus className="size-3" />
                                Asignar usuario
                              </Button>
                            </div>
                            {roleUsers.length === 0 ? (
                              <p className="text-xs text-muted-foreground">
                                Ningún usuario tiene este rol
                              </p>
                            ) : (
                              <div className="space-y-1">
                                {roleUsers.map((u) => (
                                  <div
                                    key={u.id}
                                    className="flex items-center gap-2.5 py-1.5"
                                  >
                                    <Avatar className="size-6">
                                      <AvatarFallback className="text-[9px] bg-primary/10 text-primary">
                                        {initials(u.firstName)}
                                      </AvatarFallback>
                                    </Avatar>
                                    <span className="text-sm flex-1">
                                      {u.firstName} {u.lastName}
                                    </span>
                                    <span className="text-xs text-muted-foreground">
                                      {u.position}
                                    </span>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="size-6 text-muted-foreground hover:text-destructive"
                                      onClick={() => onRemoveUserFromRole(role.id, u.id)}
                                    >
                                      <X className="size-3" />
                                    </Button>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </TabsContent>

        {/* ── Por Permiso ─────────────────────────────────────────── */}
        <TabsContent value="by-permission" className="mt-4">
          <ByPermissionView
            permissions={permissions}
            roles={roles}
            users={users}
            userPermissions={userPermissions}
            expandedPermissions={expandedPermissions}
            onToggle={togglePermission}
            onAssignPermUser={onAssignPermUser}
            onRevokePermUser={onRevokePermUser}
          />
        </TabsContent>
      </Tabs>
    </main>
  );
}

// ── ByPermissionView ──────────────────────────────────────────────────────────

function ByPermissionView({
  permissions,
  roles,
  users,
  userPermissions,
  expandedPermissions,
  onToggle,
  onAssignPermUser,
  onRevokePermUser,
}: {
  permissions: ApiPermission[];
  roles: ApiRole[];
  users: ApiUser[];
  userPermissions: ApiUserPermission[];
  expandedPermissions: Set<string>;
  onToggle: (id: string) => void;
  onAssignPermUser: (permissionId: string) => void;
  onRevokePermUser: (userId: string, permissionId: string) => void;
}) {
  const categories = useMemo(
    () => [...new Set(permissions.map((p) => p.category))],
    [permissions],
  );

  return (
    <div className="space-y-6">
      {categories.map((category) => {
        const catPerms = permissions.filter((p) => p.category === category);
        return (
          <div key={category}>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 px-1">
              {category}
            </p>
            <div className="rounded-lg border border-border bg-card overflow-hidden divide-y divide-border">
              {catPerms.map((perm) => {
                const isExpanded = expandedPermissions.has(perm.id);
                const rolesWithPerm = roles.filter((r) => r.permissionIds.includes(perm.id));
                const usersWithPerm = getUsersForPermission(perm.id, roles, users, userPermissions);

                return (
                  <div key={perm.id}>
                    {/* Permission row */}
                    <div
                      className="flex items-center gap-3 px-5 py-3.5 hover:bg-muted/30 transition-colors cursor-pointer"
                      onClick={() => onToggle(perm.id)}
                    >
                      <button
                        type="button"
                        className="flex items-center justify-center size-6 rounded text-muted-foreground shrink-0"
                        onClick={(e) => { e.stopPropagation(); onToggle(perm.id); }}
                      >
                        {isExpanded ? (
                          <ChevronDown className="size-4" />
                        ) : (
                          <ChevronRight className="size-4" />
                        )}
                      </button>

                      <div className="flex items-center justify-center size-8 rounded-md bg-muted shrink-0">
                        <Key className="size-4 text-muted-foreground" />
                      </div>

                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">{perm.label}</p>
                        <p className="text-xs text-muted-foreground">{perm.description}</p>
                      </div>

                      {/* Roles badges (compact) */}
                      <div
                        className="flex items-center gap-1.5 flex-wrap justify-end max-w-xs"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {rolesWithPerm.slice(0, 3).map((r) => (
                          <Badge key={r.id} variant="secondary" className="text-xs shrink-0">
                            {r.name}
                          </Badge>
                        ))}
                        {rolesWithPerm.length > 3 && (
                          <Badge variant="outline" className="text-xs shrink-0">
                            +{rolesWithPerm.length - 3}
                          </Badge>
                        )}
                        {rolesWithPerm.length === 0 && (
                          <span className="text-xs text-muted-foreground">Sin rol</span>
                        )}
                      </div>

                      <div className="flex items-center gap-2 shrink-0 ml-2" onClick={(e) => e.stopPropagation()}>
                        <span className="text-xs text-muted-foreground whitespace-nowrap">
                          {usersWithPerm.length} {usersWithPerm.length === 1 ? "usuario" : "usuarios"}
                        </span>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs"
                          onClick={(e) => { e.stopPropagation(); onAssignPermUser(perm.id); }}
                        >
                          <UserPlus className="size-3" />
                          Asignar
                        </Button>
                      </div>
                    </div>

                    {/* Expanded: user list */}
                    {isExpanded && (
                      <div className="bg-muted/30 border-t border-border px-14 py-4 space-y-3">
                        {/* Roles with this permission */}
                        {rolesWithPerm.length > 0 && (
                          <div>
                            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                              Roles con este permiso
                            </p>
                            <div className="flex flex-wrap gap-1.5">
                              {rolesWithPerm.map((r) => (
                                <Badge key={r.id} variant="outline" className="text-xs gap-1">
                                  <Shield className="size-3" />
                                  {r.name}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Users with this permission */}
                        <div>
                          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                            Usuarios con acceso
                          </p>
                          {usersWithPerm.length === 0 ? (
                            <p className="text-xs text-muted-foreground">
                              Ningún usuario tiene este permiso
                            </p>
                          ) : (
                            <div className="space-y-1.5">
                              {usersWithPerm.map(({ user, viaRoles, isDirect }) => (
                                <div key={user.id} className="flex items-center gap-2.5 py-1">
                                  <Avatar className="size-6">
                                    <AvatarFallback className="text-[9px] bg-primary/10 text-primary">
                                      {initials(user.firstName)}
                                    </AvatarFallback>
                                  </Avatar>
                                  <span className="text-sm font-medium min-w-[140px]">
                                    {user.firstName} {user.lastName}
                                  </span>
                                  {/* Source tags */}
                                  <div className="flex flex-wrap gap-1">
                                    {viaRoles.map((r) => (
                                      <Badge
                                        key={r.id}
                                        variant="secondary"
                                        className="text-[10px] px-1.5 py-0"
                                      >
                                        <Shield className="size-2.5 mr-0.5" />
                                        {r.name}
                                      </Badge>
                                    ))}
                                    {isDirect && (
                                      <Badge
                                        variant="outline"
                                        className="text-[10px] px-1.5 py-0 text-primary border-primary/30"
                                      >
                                        <Key className="size-2.5 mr-0.5" />
                                        Directo
                                      </Badge>
                                    )}
                                  </div>
                                  {/* Revoke direct if applicable */}
                                  {isDirect && (
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="size-6 ml-auto text-muted-foreground hover:text-destructive"
                                      title="Revocar permiso directo"
                                      onClick={() => onRevokePermUser(user.id, perm.id)}
                                    >
                                      <ShieldOff className="size-3" />
                                    </Button>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── PermissionSelector ────────────────────────────────────────────────────────

function PermissionSelector({
  permissions,
  selected,
  onToggle,
}: {
  permissions: ApiPermission[];
  selected: string[];
  onToggle: (id: string) => void;
}) {
  const categories = [...new Set(permissions.map((p) => p.category))];
  return (
    <div className="rounded-md border border-border p-3 space-y-3 max-h-64 overflow-y-auto">
      {categories.map((cat) => (
        <div key={cat}>
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
            {cat}
          </p>
          <div className="space-y-1">
            {permissions
              .filter((p) => p.category === cat)
              .map((p) => (
                <div key={p.id} className="flex items-center gap-2">
                  <Checkbox
                    id={`perm-${p.id}`}
                    checked={selected.includes(p.id)}
                    onCheckedChange={() => onToggle(p.id)}
                  />
                  <label
                    htmlFor={`perm-${p.id}`}
                    className="text-sm cursor-pointer select-none"
                  >
                    {p.label}
                  </label>
                </div>
              ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Shared sub-components ─────────────────────────────────────────────────────

function StatCard({
  title,
  value,
  icon,
}: {
  title: string;
  value: number;
  icon: React.ReactNode;
}) {
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
  );
}

function NavItem({
  icon,
  label,
  active,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  active?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-2.5 w-full px-2 py-2 rounded-md text-sm transition-colors ${
        active
          ? "bg-primary/10 text-primary font-medium"
          : "text-muted-foreground hover:bg-accent hover:text-foreground"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

function FormField({
  id,
  label,
  error,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

function InfoRow({
  label,
  value,
  mono,
}: {
  label: string;
  value: React.ReactNode;
  mono?: boolean;
}) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <div className={`text-sm font-medium ${mono ? "font-mono" : ""}`}>{value}</div>
    </div>
  );
}
