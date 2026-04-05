import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  usersApi,
  type ApiUser,
  type CreateUserDto,
  type UpdateUserDto,
} from "@/lib/api/users";
import { rolesApi } from "@/lib/api/roles";
import { orgStructureApi } from "@/lib/api/org-structure";
import { emailField, requiredString, optionalString } from "@/lib/validations/schemas";

const createUserSchema = z.object({
  email: emailField,
  orgId: z.string().optional(),
  roleId: z.string().optional(),
  departamentoId: z.string().uuid().optional(),
  areaId: z.string().uuid().optional(),
  cargoId: z.string().uuid().optional(),
});

const editUserSchema = z.object({
  firstName: requiredString("The first name"),
  lastName: requiredString("The last name"),
  idNumber: optionalString,
});

export type CreateUserForm = z.infer<typeof createUserSchema>;
export type EditUserForm = z.infer<typeof editUserSchema>;

export function useAdminUsers() {
  const queryClient = useQueryClient();

  const [createOpen, setCreateOpen] = useState(false);
  const [createUserContext, setCreateUserContext] = useState<
    "super-admin" | "company"
  >("super-admin");
  const [createCompanyId, setCreateCompanyId] = useState<string | null>(null);
  const [editUser, setEditUser] = useState<ApiUser | null>(null);
  const [deleteUser, setDeleteUser] = useState<ApiUser | null>(null);

  // Cascade selection state for org-structure dropdowns
  const [selectedDeptId, setSelectedDeptId] = useState<string>("");
  const [selectedAreaId, setSelectedAreaId] = useState<string>("");

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

  const { data: companyRoles = [] } = useQuery({
    queryKey: ["roles", createCompanyId],
    queryFn: rolesApi.listRoles,
    staleTime: 60_000,
    enabled: createUserContext === "company" && !!createCompanyId && createOpen,
  });

  const { data: departamentos = [] } = useQuery({
    queryKey: ["departamentos", createCompanyId],
    queryFn: () => orgStructureApi.listDepartamentos(createCompanyId!),
    staleTime: 300_000,
    enabled: createUserContext === "company" && !!createCompanyId && createOpen,
  });

  const { data: areas = [] } = useQuery({
    queryKey: ["areas", createCompanyId, selectedDeptId],
    queryFn: () => orgStructureApi.listAreas(createCompanyId!, selectedDeptId),
    staleTime: 300_000,
    enabled: createUserContext === "company" && !!selectedDeptId && createOpen,
  });

  const { data: cargos = [] } = useQuery({
    queryKey: ["cargos", createCompanyId, selectedDeptId, selectedAreaId],
    queryFn: () => orgStructureApi.listCargos(createCompanyId!, selectedDeptId, selectedAreaId),
    staleTime: 300_000,
    enabled: createUserContext === "company" && !!selectedAreaId && createOpen,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["users"] });
    queryClient.invalidateQueries({ queryKey: ["superAdmins"] });
  };

  const createForm = useForm<CreateUserForm>({
    resolver: zodResolver(createUserSchema),
    mode: "onChange",
  });

  const createMutation = useMutation({
    mutationFn: async ({
      dto,
      roleId,
      orgId,
    }: {
      dto: CreateUserDto;
      roleId?: string;
      orgId?: string;
    }) => {
      const user = await usersApi.create(dto);
      if (roleId && orgId) {
        await usersApi.assignUserToOrg(user.id, orgId, roleId);
      }
      return user;
    },
    onSuccess: () => {
      invalidate();
      queryClient.invalidateQueries({ queryKey: ["roles"] });
      queryClient.invalidateQueries({ queryKey: ["company-users"] });
      setCreateOpen(false);
    },
  });

  const editMutation = useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: UpdateUserDto }) =>
      usersApi.update(id, dto),
    onSuccess: () => {
      invalidate();
      setEditUser(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => usersApi.remove(id),
    onSuccess: () => {
      invalidate();
      setDeleteUser(null);
    },
  });

  const restoreMutation = useMutation({
    mutationFn: (id: string) => usersApi.restore(id),
    onSuccess: invalidate,
  });

  const toggleSuperAdminMutation = useMutation({
    mutationFn: ({ id, isSuperAdmin }: { id: string; isSuperAdmin: boolean }) =>
      usersApi.toggleSuperAdmin(id, isSuperAdmin),
    onSuccess: invalidate,
  });

  const editForm = useForm<EditUserForm>({
    resolver: zodResolver(editUserSchema),
    mode: "onChange",
  });

  const openCreate = (
    context: "super-admin" | "company",
    companyId?: string,
  ) => {
    setCreateUserContext(context);
    setCreateCompanyId(companyId ?? null);
    setSelectedDeptId("");
    setSelectedAreaId("");
    createForm.reset();
    setCreateOpen(true);
  };

  const openEdit = (u: ApiUser) => {
    setEditUser(u);
    editForm.reset({
      firstName: u.firstName ?? undefined,
      lastName: u.lastName ?? undefined,
      idNumber: u.idNumber ?? undefined,
    });
    editForm.trigger();
  };

  const onCreateSubmit = (values: CreateUserForm) => {
    const { roleId, orgId: _orgId, ...rest } = values;
    const orgId = createUserContext === "company" ? (createCompanyId ?? undefined) : undefined;
    createMutation.mutate({
      dto: { ...rest, isSuperAdmin: createUserContext === "super-admin", orgId },
      roleId: roleId || undefined,
      orgId,
    });
  };

  const onEditSubmit = (values: EditUserForm) => {
    if (!editUser) return;
    editMutation.mutate({ id: editUser.id, dto: values });
  };

  return {
    users,
    superAdmins,
    superAdminsLoading,
    createOpen,
    setCreateOpen,
    createUserContext,
    companyRoles,
    departamentos,
    areas,
    cargos,
    selectedDeptId,
    setSelectedDeptId,
    selectedAreaId,
    setSelectedAreaId,
    editUser,
    setEditUser,
    deleteUser,
    setDeleteUser,
    createForm,
    editForm,
    openCreate,
    openEdit,
    onCreateSubmit,
    onEditSubmit,
    createMutation,
    editMutation,
    deleteMutation,
    restoreMutation,
    toggleSuperAdminMutation,
  };
}
