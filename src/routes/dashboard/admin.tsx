import { useState, Fragment } from "react";
import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  FileText,
  LogOut,
  Users,
  ShieldCheck,
  UserPlus,
  MoreHorizontal,
  Pencil,
  Trash2,
  RotateCcw,
  ShieldOff,
  Building2,
  ChevronRight,
  ChevronDown,
  CheckCircle,
  XCircle,
  Shield,
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
import { authApi } from "@/lib/api/auth";
import {
  usersApi,
  type ApiUser,
  type CreateUserDto,
  type UpdateUserDto,
} from "@/lib/api/users";
import {
  companiesApi,
  type ApiCompany,
  type CreateCompanyDto,
  type UpdateCompanyDto,
} from "@/lib/api/companies";
import { useAuthStore } from "@/store/authStore";
import { emailField, requiredString } from "@/lib/validations/schemas";

export const Route = createFileRoute("/dashboard/admin")({
  beforeLoad: () => {
    const { isAuthenticated, isSuperAdmin } = useAuthStore.getState();
    if (!isAuthenticated) throw redirect({ to: "/login" });
    if (!isSuperAdmin) throw redirect({ to: "/dashboard" });
  },
  component: AdminDashboard,
});

// ── Schemas ──────────────────────────────────────────────────────────────────

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

const companySchema = z.object({
  name: requiredString("El nombre de la empresa"),
  nit: requiredString("El NIT"),
  city: requiredString("La ciudad"),
});
type CompanyForm = z.infer<typeof companySchema>;

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

// ── Main component ────────────────────────────────────────────────────────────

function AdminDashboard() {
  const navigate = useNavigate();
  const { user: me, clearAuth } = useAuthStore();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<"users" | "companies" | "roles">("users");

  // User modals
  const [createOpen, setCreateOpen] = useState(false);
  const [createUserContext, setCreateUserContext] = useState<
    "super-admin" | "company"
  >("super-admin");
  const [editUser, setEditUser] = useState<ApiUser | null>(null);
  const [deleteUser, setDeleteUser] = useState<ApiUser | null>(null);

  // Company modals
  const [createCompanyOpen, setCreateCompanyOpen] = useState(false);
  const [editCompany, setEditCompany] = useState<ApiCompany | null>(null);
  const [deleteCompany, setDeleteCompany] = useState<ApiCompany | null>(null);

  // Companies expand / select
  const [expandedCompanies, setExpandedCompanies] = useState<Set<string>>(
    new Set(),
  );
  const [selectedCompany, setSelectedCompany] = useState<ApiCompany | null>(
    null,
  );

  // ── Data ──────────────────────────────────────────────────────────────────

  const { data: users = [] } = useQuery({
    queryKey: ["users"],
    queryFn: usersApi.list,
    staleTime: 60_000,
    refetchInterval: 30_000,
    refetchIntervalInBackground: false,
  });

  const { data: superAdmins = [], isLoading: superAdminsLoading } = useQuery({
    queryKey: ["superAdmins"],
    queryFn: usersApi.listSuperAdmin,
    staleTime: 60_000,
    refetchInterval: 30_000,
    refetchIntervalInBackground: false,
  });

  const { data: companies = [], isLoading: companiesLoading } = useQuery({
    queryKey: ["companies"],
    queryFn: companiesApi.list,
    staleTime: 60_000,
    refetchInterval: 30_000,
    refetchIntervalInBackground: false,
  });

  const totalActive = users.filter((u) => !isDeleted(u)).length;
  const totalSuperAdmins = superAdmins.filter((u) => u.isSuperAdmin).length;
  const totalActiveCompanies = companies.filter(
    (c) => c.status === "active",
  ).length;

  // ── User mutations ─────────────────────────────────────────────────────────

  const invalidateUsers = () => {
    queryClient.invalidateQueries({ queryKey: ["users"] });
    queryClient.invalidateQueries({ queryKey: ["superAdmins"] });
  };

  const createMutation = useMutation({
    mutationFn: (dto: CreateUserDto) => usersApi.create(dto),
    onSuccess: () => {
      invalidateUsers();
      setCreateOpen(false);
    },
  });

  const editMutation = useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: UpdateUserDto }) =>
      usersApi.update(id, dto),
    onSuccess: () => {
      invalidateUsers();
      setEditUser(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => usersApi.remove(id),
    onSuccess: () => {
      invalidateUsers();
      setDeleteUser(null);
    },
  });

  const restoreMutation = useMutation({
    mutationFn: (id: string) => usersApi.restore(id),
    onSuccess: invalidateUsers,
  });

  const toggleSuperAdminMutation = useMutation({
    mutationFn: ({ id, isSuperAdmin }: { id: string; isSuperAdmin: boolean }) =>
      usersApi.toggleSuperAdmin(id, isSuperAdmin),
    onSuccess: invalidateUsers,
  });

  // ── Company mutations ──────────────────────────────────────────────────────

  const invalidateCompanies = () =>
    queryClient.invalidateQueries({ queryKey: ["companies"] });

  const createCompanyMutation = useMutation({
    mutationFn: (dto: CreateCompanyDto) => companiesApi.create(dto),
    onSuccess: () => {
      invalidateCompanies();
      setCreateCompanyOpen(false);
    },
  });

  const editCompanyMutation = useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: UpdateCompanyDto }) =>
      companiesApi.update(id, dto),
    onSuccess: (updated) => {
      invalidateCompanies();
      setEditCompany(null);
      setSelectedCompany((prev) => (prev?.id === updated.id ? updated : prev));
    },
  });

  const deleteCompanyMutation = useMutation({
    mutationFn: (id: string) => companiesApi.remove(id),
    onSuccess: (_, deletedId) => {
      invalidateCompanies();
      setDeleteCompany(null);
      setSelectedCompany((prev) => (prev?.id === deletedId ? null : prev));
      setExpandedCompanies((prev) => {
        const next = new Set(prev);
        next.delete(deletedId);
        return next;
      });
    },
  });

  const toggleCompanyStatusMutation = useMutation({
    mutationFn: (id: string) => companiesApi.toggleStatus(id),
    onSuccess: invalidateCompanies,
  });

  const logoutMutation = useMutation({
    mutationFn: authApi.logout,
    onSettled: () => {
      clearAuth();
      navigate({ to: "/login" });
    },
  });

  // ── Forms ─────────────────────────────────────────────────────────────────

  const createForm = useForm<CreateUserForm>({
    resolver: zodResolver(createUserSchema),
    mode: "onTouched",
  });

  const onCreateSubmit = (values: CreateUserForm) =>
    createMutation.mutate({
      ...values,
      isSuperAdmin: createUserContext === "super-admin",
    });

  const editForm = useForm<EditUserForm>({
    resolver: zodResolver(editUserSchema),
    mode: "onTouched",
  });

  const openEditUser = (u: ApiUser) => {
    setEditUser(u);
    editForm.reset({ name: u.firstName, email: u.email });
  };

  const onEditSubmit = (values: EditUserForm) => {
    if (!editUser) return;
    editMutation.mutate({ id: editUser.id, dto: values });
  };

  const companyCreateForm = useForm<CompanyForm>({
    resolver: zodResolver(companySchema),
    mode: "onTouched",
  });

  const companyEditForm = useForm<CompanyForm>({
    resolver: zodResolver(companySchema),
    mode: "onTouched",
  });

  const openEditCompany = (c: ApiCompany) => {
    setEditCompany(c);
    companyEditForm.reset({ name: c.name, nit: c.nit, city: c.city });
  };

  const onCompanyCreateSubmit = (values: CompanyForm) =>
    createCompanyMutation.mutate(values);

  const onCompanyEditSubmit = (values: CompanyForm) => {
    if (!editCompany) return;
    editCompanyMutation.mutate({ id: editCompany.id, dto: values });
  };

  // ── Expand / select handler ────────────────────────────────────────────────

  const toggleExpand = (company: ApiCompany) => {
    const next = new Set(expandedCompanies);
    if (next.has(company.id)) {
      next.delete(company.id);
      if (selectedCompany?.id === company.id) setSelectedCompany(null);
    } else {
      next.add(company.id);
      setSelectedCompany(company);
    }
    setExpandedCompanies(next);
  };

  const openCreateUser = (context: "super-admin" | "company") => {
    setCreateUserContext(context);
    createForm.reset();
    setCreateOpen(true);
  };

  // ── Render ────────────────────────────────────────────────────────────────

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
            <p className="text-[10px] text-muted-foreground">
              Panel de administración
            </p>
          </div>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-0.5">
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-2 mb-2">
            Gestión
          </p>
          <NavItem
            icon={<Users className="size-4" />}
            label="Usuarios"
            active={activeTab === "users"}
            onClick={() => setActiveTab("users")}
          />
          <NavItem
            icon={<Building2 className="size-4" />}
            label="Empresas"
            active={activeTab === "companies"}
            onClick={() => setActiveTab("companies")}
          />
          <NavItem
            icon={<Shield className="size-4" />}
            label="Roles"
            active={activeTab === "roles"}
            onClick={() => setActiveTab("roles")}
          />
        </nav>

        <div className="px-4 py-4 border-t border-border">
          <div className="flex items-center gap-2.5">
            <Avatar className="size-8">
              <AvatarFallback className="text-xs bg-primary/10 text-primary">
                {me?.name ? initials(me.name) : "SA"}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium truncate">
                {me?.name ?? me?.email}
              </p>
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

      {/* ── Main: Tabs wrapper ──────────────────────────────────────── */}
      <Tabs
        value={activeTab}
        onValueChange={(v) => setActiveTab(v as "users" | "companies")}
        className="flex-1 min-w-0 overflow-hidden gap-0"
      >
        {/* Header */}
        <header className="flex items-center justify-between px-6 h-16 border-b border-border bg-card shrink-0">
          <TabsList>
            <TabsTrigger value="users">
              <Users className="size-4" />
              Usuarios
            </TabsTrigger>
            <TabsTrigger value="companies">
              <Building2 className="size-4" />
              Empresas
            </TabsTrigger>
          </TabsList>

          {activeTab === "users" ? (
            <Button size="sm" onClick={() => openCreateUser("super-admin")}>
              <UserPlus className="size-4" />
              Nuevo usuario
            </Button>
          ) : (
            <Button
              size="sm"
              onClick={() => {
                companyCreateForm.reset();
                setCreateCompanyOpen(true);
              }}
            >
              <Building2 className="size-4" />
              Nueva empresa
            </Button>
          )}
        </header>

        {/* ── Tab: Usuarios ──────────────────────────────────────────── */}
        <TabsContent value="users" className="overflow-auto">
          <main className="p-6 space-y-6">
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
                      <TableRow
                        key={u.id}
                        className={isDeleted(u) ? "opacity-50" : ""}
                      >
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
                              <p className="text-xs text-muted-foreground">
                                {u.email}
                              </p>
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
                          {u.registrationStatus === "pending_credentials" ? (
                            <Badge variant="default" className="gap-1 text-xs">
                              <ShieldCheck className="size-3" />
                              Pendiente de Credenciales
                            </Badge>
                          ) : (
                            <Badge
                              variant="outline"
                              className="text-xs text-emerald-600 border-emerald-200 bg-emerald-50"
                            >
                              <ShieldCheck className="size-3" />
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
                                  <DropdownMenuItem
                                    onClick={() => openEditUser(u)}
                                  >
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
                                      <>
                                        <ShieldOff className="size-4" />
                                        Quitar Super Admin
                                      </>
                                    ) : (
                                      <>
                                        <ShieldCheck className="size-4" />
                                        Dar Super Admin
                                      </>
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
                                <DropdownMenuItem
                                  onClick={() => restoreMutation.mutate(u.id)}
                                >
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
        </TabsContent>

        {/* ── Tab: Empresas ──────────────────────────────────────────── */}
        <TabsContent value="companies" className="overflow-auto">
          <main className="p-6 space-y-6">
            <div
              className={`grid grid-cols-1 gap-4 ${selectedCompany ? "sm:grid-cols-3" : "sm:grid-cols-2"}`}
            >
              <StatCard
                title="Total empresas"
                value={companies.length}
                icon={<Building2 className="size-5 text-muted-foreground" />}
              />
              <StatCard
                title="Empresas activas"
                value={totalActiveCompanies}
                icon={<CheckCircle className="size-5 text-muted-foreground" />}
              />
              {selectedCompany && (
                <StatCard
                  title={`Usuarios · ${selectedCompany.name}`}
                  value={selectedCompany.userCount}
                  icon={<Users className="size-5 text-muted-foreground" />}
                />
              )}
            </div>

            <div className="rounded-lg border border-border bg-card overflow-hidden">
              <div className="px-5 py-4 border-b border-border">
                <h2 className="text-sm font-semibold">Empresas</h2>
              </div>

              {companiesLoading ? (
                <div className="flex items-center justify-center py-16 text-sm text-muted-foreground">
                  Cargando empresas...
                </div>
              ) : companies.length === 0 ? (
                <div className="flex items-center justify-center py-16 text-sm text-muted-foreground">
                  No hay empresas registradas
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Empresa</TableHead>
                      <TableHead>NIT</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead>Ciudad</TableHead>
                      <TableHead>Usuarios</TableHead>
                      <TableHead>Creación</TableHead>
                      <TableHead className="w-10" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {companies.map((company) => (
                      <Fragment key={company.id}>
                        <TableRow
                          className={
                            selectedCompany?.id === company.id
                              ? "bg-primary/5"
                              : ""
                          }
                        >
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => toggleExpand(company)}
                                className="flex items-center justify-center size-6 rounded text-muted-foreground hover:bg-accent hover:text-foreground transition-colors shrink-0"
                              >
                                {expandedCompanies.has(company.id) ? (
                                  <ChevronDown className="size-4" />
                                ) : (
                                  <ChevronRight className="size-4" />
                                )}
                              </button>
                              <div className="flex items-center gap-2.5">
                                <div className="flex items-center justify-center size-8 rounded-md bg-primary/10 shrink-0">
                                  <Building2 className="size-4 text-primary" />
                                </div>
                                <span className="text-sm font-medium">
                                  {company.name}
                                </span>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground font-mono">
                            {company.nit}
                          </TableCell>
                          <TableCell>
                            {company.status === "active" ? (
                              <Badge
                                variant="outline"
                                className="text-xs text-emerald-600 border-emerald-200 bg-emerald-50"
                              >
                                Activo
                              </Badge>
                            ) : (
                              <Badge
                                variant="outline"
                                className="text-xs text-muted-foreground"
                              >
                                Inactivo
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {company.city}
                          </TableCell>
                          <TableCell className="text-sm">
                            {company.userCount}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {formatDate(company.createdAt)}
                          </TableCell>
                          <TableCell>
                            <DropdownMenu>
                              <DropdownMenuTrigger className="inline-flex items-center justify-center size-8 rounded-md text-muted-foreground hover:bg-accent hover:text-foreground transition-colors">
                                <MoreHorizontal className="size-4" />
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem
                                  onClick={() => openCreateUser("company")}
                                >
                                  <UserPlus className="size-4" />
                                  Crear usuario
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => openEditCompany(company)}
                                >
                                  <Pencil className="size-4" />
                                  Editar empresa
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() =>
                                    toggleCompanyStatusMutation.mutate(
                                      company.id,
                                    )
                                  }
                                >
                                  {company.status === "active" ? (
                                    <>
                                      <XCircle className="size-4" />
                                      Desactivar empresa
                                    </>
                                  ) : (
                                    <>
                                      <CheckCircle className="size-4" />
                                      Activar empresa
                                    </>
                                  )}
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  className="text-destructive focus:text-destructive"
                                  onClick={() => setDeleteCompany(company)}
                                >
                                  <Trash2 className="size-4" />
                                  Eliminar empresa
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>

                        {expandedCompanies.has(company.id) && (
                          <CompanyUsersRow
                            companyId={company.id}
                            onEditUser={openEditUser}
                            onDeleteUser={setDeleteUser}
                          />
                        )}
                      </Fragment>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>
          </main>
        </TabsContent>
      </Tabs>

      {/* ── Create user dialog ─────────────────────────────────────── */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Nuevo usuario</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={createForm.handleSubmit(onCreateSubmit)}
            className="space-y-4 pt-2"
          >
            <FormField
              id="create-email"
              label="Correo electrónico"
              error={createForm.formState.errors.email?.message}
            >
              <Input
                id="create-email"
                type="email"
                placeholder="usuario@empresa.com"
                {...createForm.register("email")}
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
                {...createForm.register("position")}
              />
            </FormField>
            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setCreateOpen(false)}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={
                  createMutation.isPending || !createForm.formState.isValid
                }
              >
                {createMutation.isPending ? "Creando..." : "Crear usuario"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Edit user dialog ───────────────────────────────────────── */}
      <Dialog
        open={!!editUser}
        onOpenChange={(open) => {
          if (!open) setEditUser(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Editar usuario</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={editForm.handleSubmit(onEditSubmit)}
            className="space-y-4 pt-2"
          >
            <FormField
              id="edit-email"
              label="Correo electrónico"
              error={editForm.formState.errors.email?.message}
            >
              <Input
                id="edit-email"
                type="email"
                placeholder="usuario@empresa.com"
                {...editForm.register("email")}
              />
            </FormField>
            <FormField
              id="edit-name"
              label="Nombre"
              error={editForm.formState.errors.name?.message}
            >
              <Input
                id="edit-name"
                placeholder="Juan García"
                {...editForm.register("name")}
              />
            </FormField>
            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setEditUser(null)}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={editMutation.isPending || !editForm.formState.isValid}
              >
                {editMutation.isPending ? "Guardando..." : "Guardar cambios"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Delete user dialog ─────────────────────────────────────── */}
      <Dialog
        open={!!deleteUser}
        onOpenChange={(open) => {
          if (!open) setDeleteUser(null);
        }}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Eliminar usuario</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            ¿Estás seguro de que deseas eliminar a{" "}
            <span className="font-medium text-foreground">
              {deleteUser?.firstName}
            </span>
            ? Podrás restaurarlo después.
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
              {deleteMutation.isPending ? "Eliminando..." : "Eliminar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Create company dialog ──────────────────────────────────── */}
      <Dialog open={createCompanyOpen} onOpenChange={setCreateCompanyOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Nueva empresa</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={companyCreateForm.handleSubmit(onCompanyCreateSubmit)}
            className="space-y-4 pt-2"
          >
            <FormField
              id="company-name"
              label="Nombre de la empresa"
              error={companyCreateForm.formState.errors.name?.message}
            >
              <Input
                id="company-name"
                placeholder="Helisa Software S.A.S"
                {...companyCreateForm.register("name")}
              />
            </FormField>
            <FormField
              id="company-nit"
              label="NIT"
              error={companyCreateForm.formState.errors.nit?.message}
            >
              <Input
                id="company-nit"
                placeholder="900.123.456-7"
                {...companyCreateForm.register("nit")}
              />
            </FormField>
            <FormField
              id="company-city"
              label="Ciudad"
              error={companyCreateForm.formState.errors.city?.message}
            >
              <Input
                id="company-city"
                placeholder="Bogotá"
                {...companyCreateForm.register("city")}
              />
            </FormField>
            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setCreateCompanyOpen(false)}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={
                  createCompanyMutation.isPending ||
                  !companyCreateForm.formState.isValid
                }
              >
                {createCompanyMutation.isPending
                  ? "Creando..."
                  : "Crear empresa"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Edit company dialog ────────────────────────────────────── */}
      <Dialog
        open={!!editCompany}
        onOpenChange={(open) => {
          if (!open) setEditCompany(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Editar empresa</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={companyEditForm.handleSubmit(onCompanyEditSubmit)}
            className="space-y-4 pt-2"
          >
            <FormField
              id="edit-company-name"
              label="Nombre de la empresa"
              error={companyEditForm.formState.errors.name?.message}
            >
              <Input
                id="edit-company-name"
                placeholder="Helisa Software S.A.S"
                {...companyEditForm.register("name")}
              />
            </FormField>
            <FormField
              id="edit-company-nit"
              label="NIT"
              error={companyEditForm.formState.errors.nit?.message}
            >
              <Input
                id="edit-company-nit"
                placeholder="900.123.456-7"
                {...companyEditForm.register("nit")}
              />
            </FormField>
            <FormField
              id="edit-company-city"
              label="Ciudad"
              error={companyEditForm.formState.errors.city?.message}
            >
              <Input
                id="edit-company-city"
                placeholder="Bogotá"
                {...companyEditForm.register("city")}
              />
            </FormField>
            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setEditCompany(null)}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={
                  editCompanyMutation.isPending ||
                  !companyEditForm.formState.isValid
                }
              >
                {editCompanyMutation.isPending
                  ? "Guardando..."
                  : "Guardar cambios"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Delete company dialog ──────────────────────────────────── */}
      <Dialog
        open={!!deleteCompany}
        onOpenChange={(open) => {
          if (!open) setDeleteCompany(null);
        }}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Eliminar empresa</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            ¿Estás seguro de que deseas eliminar{" "}
            <span className="font-medium text-foreground">
              {deleteCompany?.name}
            </span>
            ? Esta acción no se puede deshacer.
          </p>
          <DialogFooter className="pt-2">
            <Button variant="outline" onClick={() => setDeleteCompany(null)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              disabled={deleteCompanyMutation.isPending}
              onClick={() =>
                deleteCompany && deleteCompanyMutation.mutate(deleteCompany.id)
              }
            >
              {deleteCompanyMutation.isPending ? "Eliminando..." : "Eliminar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

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
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
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

function CompanyUsersRow({
  companyId,
  onEditUser,
  onDeleteUser,
}: {
  companyId: string;
  onEditUser: (u: ApiUser) => void;
  onDeleteUser: (u: ApiUser) => void;
}) {
  const { data: users = [], isLoading } = useQuery({
    queryKey: ["company-users", companyId],
    queryFn: () => companiesApi.listUsers(companyId),
    staleTime: 60_000,
    refetchInterval: 30_000,
    refetchIntervalInBackground: false,
  });

  return (
    <TableRow className="hover:bg-transparent">
      <TableCell colSpan={7} className="p-0">
        <div className="bg-muted/40 border-b border-border">
          <div className="pl-14 pr-6 py-4">
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-3">
              Usuarios de la empresa
            </p>

            {isLoading ? (
              <p className="text-xs text-muted-foreground py-4 text-center">
                Cargando usuarios...
              </p>
            ) : users.length === 0 ? (
              <p className="text-xs text-muted-foreground py-4 text-center">
                Esta empresa no tiene usuarios registrados
              </p>
            ) : (
              <div className="rounded-md border border-border bg-card overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead className="text-xs py-2.5">Usuario</TableHead>
                      <TableHead className="text-xs py-2.5">Correo</TableHead>
                      <TableHead className="text-xs py-2.5">Estado</TableHead>
                      <TableHead className="text-xs py-2.5">Contacto</TableHead>
                      <TableHead className="text-xs py-2.5">Rol</TableHead>
                      <TableHead className="text-xs py-2.5">
                        Último acceso
                      </TableHead>
                      <TableHead className="w-10 py-2.5" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users.map((u) => (
                      <TableRow
                        key={u.id}
                        className={isDeleted(u) ? "opacity-50" : ""}
                      >
                        <TableCell className="py-2.5">
                          <div className="flex items-center gap-2">
                            <Avatar className="size-7">
                              <AvatarFallback className="text-[10px] bg-primary/10 text-primary">
                                {initials(u.firstName)}
                              </AvatarFallback>
                            </Avatar>
                            <span className="text-sm font-medium">
                              {u.firstName ?? "—"}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="py-2.5 text-sm text-muted-foreground">
                          {u.email}
                        </TableCell>
                        <TableCell className="py-2.5">
                          {isDeleted(u) ? (
                            <Badge variant="destructive" className="text-xs">
                              Inactivo
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
                        <TableCell className="py-2.5 text-sm text-muted-foreground">
                          —
                        </TableCell>
                        <TableCell className="py-2.5">
                          <Badge variant="secondary" className="text-xs">
                            {u.isSuperAdmin ? "Admin" : "Usuario"}
                          </Badge>
                        </TableCell>
                        <TableCell className="py-2.5 text-sm text-muted-foreground">
                          —
                        </TableCell>
                        <TableCell className="py-2.5">
                          <DropdownMenu>
                            <DropdownMenuTrigger className="inline-flex items-center justify-center size-7 rounded-md text-muted-foreground hover:bg-accent hover:text-foreground transition-colors">
                              <MoreHorizontal className="size-3.5" />
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => onEditUser(u)}>
                                <Pencil className="size-4" />
                                Editar usuario
                              </DropdownMenuItem>
                              <DropdownMenuItem>
                                {isDeleted(u) ? (
                                  <>
                                    <CheckCircle className="size-4" />
                                    Activar usuario
                                  </>
                                ) : (
                                  <>
                                    <XCircle className="size-4" />
                                    Desactivar usuario
                                  </>
                                )}
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                className="text-destructive focus:text-destructive"
                                onClick={() => onDeleteUser(u)}
                              >
                                <Trash2 className="size-4" />
                                Eliminar usuario
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        </div>
      </TableCell>
    </TableRow>
  );
}
