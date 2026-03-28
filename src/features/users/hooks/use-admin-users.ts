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
import { emailField, requiredString, optionalString } from "@/lib/validations/schemas";

const createUserSchema = z.object({
  position: requiredString("The position"),
  email: emailField,
  orgId: z.string().optional(),
});

const editUserSchema = z.object({
  firstName: requiredString("The first name"),
  lastName: requiredString("The last name"),
  idNumber: optionalString,
  position: optionalString,
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

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["users"] });
    queryClient.invalidateQueries({ queryKey: ["superAdmins"] });
  };

  const createMutation = useMutation({
    mutationFn: (dto: CreateUserDto) => usersApi.create(dto),
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

  const createForm = useForm<CreateUserForm>({
    resolver: zodResolver(createUserSchema),
    mode: "onChange",
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
    createForm.reset();
    setCreateOpen(true);
  };

  const openEdit = (u: ApiUser) => {
    setEditUser(u);
    editForm.reset({
      firstName: u.firstName ?? undefined,
      lastName: u.lastName ?? undefined,
      idNumber: u.idNumber ?? undefined,
      position: u.position ?? undefined,
    });
    editForm.trigger();
  };

  const onCreateSubmit = (values: CreateUserForm) =>
    createMutation.mutate({
      ...values,
      isSuperAdmin: createUserContext === "super-admin",
      orgId:
        createUserContext === "company"
          ? (createCompanyId ?? undefined)
          : undefined,
    });

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
