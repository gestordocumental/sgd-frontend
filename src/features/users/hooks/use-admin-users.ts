import { useState, useEffect, useCallback, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  usersApi,
  type ApiUser,
  type ApiUserWithRoles,
  type ApiUserCreated,
  type InvitedUserInfo,
  type CreateUserDto,
  type UpdateUserDto,
} from '@/lib/api/users';
import { rolesApi } from '@/lib/api/roles';
import { ROLE_NAMES } from '@/lib/constants/roles';
import { orgStructureApi } from '@/lib/api/org-structure';
import { emailField, requiredString, optionalString } from '@/lib/validations/schemas';

// HTML selects always produce "" when nothing is selected — convert to undefined
// before UUID validation so the form stays valid when fields are left blank.
const createUserSchema = z.object({
  email: emailField,
  orgId: z.string().optional(),
  roleId: z.string().optional(),
  departamentoId: z.string().optional(),
  areaId: z.string().optional(),
  cargoId: z.string().optional(),
});

const editUserSchema = z.object({
  firstName: requiredString(),
  lastName: requiredString(),
  idNumber: optionalString,
  roleId: z.string().optional(),
});

export type CreateUserForm = z.infer<typeof createUserSchema>;
export type EditUserForm = z.infer<typeof editUserSchema>;
export type AdminUsersHook = ReturnType<typeof useAdminUsers>;

export function useAdminUsers() {
  const queryClient = useQueryClient();

  const [createOpen, setCreateOpen] = useState(false);
  const [invitedUser, setInvitedUser] = useState<InvitedUserInfo | null>(null);
  const [createUserContext, setCreateUserContext] = useState<'super-admin' | 'company'>(
    'super-admin',
  );
  const [createCompanyId, setCreateCompanyId] = useState<string | null>(null);
  const [editCompanyId, setEditCompanyId] = useState<string | null>(null);
  const [editUser, setEditUser] = useState<ApiUser | ApiUserWithRoles | null>(null);
  const [deleteUser, setDeleteUser] = useState<ApiUser | null>(null);

  // Cascade selection state for org-structure dropdowns
  const [selectedDeptId, setSelectedDeptId] = useState<string>('');
  const [selectedAreaId, setSelectedAreaId] = useState<string>('');

  const { data: users = [] } = useQuery({
    queryKey: ['users'],
    queryFn: usersApi.list,
    staleTime: 60_000,
  });

  // ── Server-side search / filter / pagination state ────────────────────────
  type SuperAdminStatus = 'all' | 'active' | 'deleted' | 'pending';
  const PAGE_SIZE = 20;
  const [saSearch, setSaSearchValue] = useState('');
  const [saDebouncedSearch, setSaDebounced] = useState('');
  const [saStatus, setSaStatusValue] = useState<SuperAdminStatus>('all');
  const [saPage, setSaPage] = useState(1);

  const setSaSearch = useCallback((value: string) => {
    setSaSearchValue(value);
    setSaPage(1);
  }, []);

  const setSaStatus = useCallback((value: SuperAdminStatus) => {
    setSaStatusValue(value);
    setSaPage(1);
  }, []);

  // Update debounced value 400 ms after the user stops typing
  const saSearchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (saSearchTimerRef.current) clearTimeout(saSearchTimerRef.current);
    saSearchTimerRef.current = setTimeout(() => setSaDebounced(saSearch), 400);
    return () => {
      if (saSearchTimerRef.current) clearTimeout(saSearchTimerRef.current);
    };
  }, [saSearch]);

  const {
    data: superAdminsResult,
    isLoading: superAdminsLoading,
    isFetching: superAdminsIsFetching,
    dataUpdatedAt: superAdminsDataUpdatedAt,
  } = useQuery({
    queryKey: ['superAdmins', { page: saPage, search: saDebouncedSearch, status: saStatus }],
    queryFn: () =>
      usersApi.listSuperAdmin({
        page: saPage,
        limit: PAGE_SIZE,
        search: saDebouncedSearch || undefined,
        status: saStatus !== 'all' ? saStatus : undefined,
      }),
    staleTime: 60_000,
    placeholderData: (prev) => prev,
  });

  const superAdmins = superAdminsResult?.data ?? [];
  const superAdminsTotal = superAdminsResult?.total ?? 0;
  const superAdminsTotalPages = Math.max(1, Math.ceil(superAdminsTotal / PAGE_SIZE));

  const rolesCompanyId =
    createOpen && createUserContext === 'company' ? createCompanyId : editCompanyId;

  const { data: companyRoles = [] } = useQuery({
    queryKey: ['roles', rolesCompanyId],
    queryFn: () => rolesApi.listRoles(rolesCompanyId ?? undefined),
    staleTime: 60_000,
    enabled:
      !!rolesCompanyId &&
      ((createUserContext === 'company' && createOpen) || (!!editUser && !!editCompanyId)),
  });

  const { data: departamentos = [] } = useQuery({
    queryKey: ['departamentos', createCompanyId],
    queryFn: () => orgStructureApi.listDepartamentos(createCompanyId!),
    staleTime: 300_000,
    enabled: createUserContext === 'company' && !!createCompanyId && createOpen,
  });

  const { data: areas = [] } = useQuery({
    queryKey: ['areas', createCompanyId, selectedDeptId],
    queryFn: () => orgStructureApi.listAreas(createCompanyId!, selectedDeptId),
    staleTime: 300_000,
    enabled: createUserContext === 'company' && !!selectedDeptId && createOpen,
  });

  const { data: cargos = [] } = useQuery({
    queryKey: ['cargos', createCompanyId, selectedDeptId, selectedAreaId],
    queryFn: () => orgStructureApi.listCargos(createCompanyId!, selectedDeptId, selectedAreaId),
    staleTime: 300_000,
    enabled: createUserContext === 'company' && !!selectedAreaId && createOpen,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['users'] });
    queryClient.invalidateQueries({ queryKey: ['superAdmins'] });
  };

  const invalidateAllUserTables = () => {
    invalidate();
    queryClient.invalidateQueries({ queryKey: ['company-users'] });
  };

  const refreshSuperAdmins = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['superAdmins'] });
  }, [queryClient]);

  const createForm = useForm<CreateUserForm>({
    resolver: zodResolver(createUserSchema),
    mode: 'onChange',
  });

  // Pre-select ADMIN role when opening the company user creation dialog
  useEffect(() => {
    if (createUserContext === 'company' && companyRoles.length > 0) {
      const current = createForm.getValues('roleId');
      if (!current) {
        const adminRole = companyRoles.find((r) => r.name === ROLE_NAMES.ADMIN);
        if (adminRole) {
          createForm.setValue('roleId', adminRole.id, { shouldValidate: true });
        }
      }
    }
  }, [companyRoles, createForm, createUserContext]);

  const createMutation = useMutation({
    mutationFn: async ({
      dto,
      roleId,
      orgId,
    }: {
      dto: CreateUserDto;
      roleId?: string;
      orgId?: string;
    }): Promise<ApiUserCreated | null> => {
      let created: ApiUserCreated | null = null;
      let userId: string;
      try {
        created = await usersApi.create(dto);
        userId = created.id;
      } catch (err: unknown) {
        const apiErr = err as { response?: { status?: number; data?: { userId?: string } } };
        const existingUserId = apiErr?.response?.data?.userId;
        if (apiErr?.response?.status === 409 && existingUserId) {
          userId = existingUserId;
          // If assigning to a company, link the existing user to the org
          if (orgId) {
            await usersApi.assignUserToOrg(userId, orgId, roleId);
            return null;
          }
          // If creating a super-admin, promote the existing user
          if (dto.isSuperAdmin) {
            await usersApi.toggleSuperAdmin(userId, true);
            return null;
          }
        }
        throw err;
      }
      // create() already assigns the user to the org via dto.orgId/dto.roleId — no duplicate call needed.
      return created;
    },
    onSuccess: (created) => {
      invalidate();
      queryClient.invalidateQueries({ queryKey: ['roles'] });
      queryClient.invalidateQueries({ queryKey: ['company-users'] });
      setCreateOpen(false);
      if (created)
        setInvitedUser({
          email: created.email,
          invitationUrl: `${window.location.origin}/complete-registration?token=${created.invitationToken}`,
          invitationResent: created.invitationResent,
        });
    },
  });

  const editMutation = useMutation({
    mutationFn: async ({
      id,
      dto,
      orgId,
      roleId,
      currentRoleId,
    }: {
      id: string;
      dto: UpdateUserDto;
      orgId?: string;
      roleId?: string;
      currentRoleId?: string;
    }) => {
      await usersApi.update(id, dto);

      if (orgId && roleId && roleId !== currentRoleId) {
        await usersApi.assignUserToOrg(id, orgId, roleId);
      }
    },
    onSuccess: () => {
      invalidateAllUserTables();
      setEditUser(null);
      setEditCompanyId(null);
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

  const removeFromOrgMutation = useMutation({
    mutationFn: ({ userId, orgId }: { userId: string; orgId: string }) =>
      usersApi.removeUserFromOrg(userId, orgId),
    onSuccess: invalidateAllUserTables,
  });

  const restoreToOrgMutation = useMutation({
    mutationFn: async ({ user, orgId }: { user: ApiUserWithRoles; orgId: string }) => {
      if (user.deletedAt) {
        await usersApi.restore(user.id);
      }

      if (user.orgRemovedAt) {
        await usersApi.assignUserToOrg(user.id, orgId);
      }
    },
    onSuccess: invalidateAllUserTables,
  });

  const resendInvitationMutation = useMutation({
    mutationFn: (id: string) => usersApi.resendInvitation(id),
    onSuccess: (data) => {
      setInvitedUser({
        email: data.email,
        invitationUrl: `${window.location.origin}/complete-registration?token=${data.invitationToken}`,
        invitationResent: data.invitationResent,
      });
    },
  });

  const toggleSuperAdminMutation = useMutation({
    mutationFn: ({ id, isSuperAdmin }: { id: string; isSuperAdmin: boolean }) =>
      usersApi.toggleSuperAdmin(id, isSuperAdmin),
    onSuccess: invalidate,
  });

  const editForm = useForm<EditUserForm>({
    resolver: zodResolver(editUserSchema),
    mode: 'onChange',
  });

  const openCreate = (context: 'super-admin' | 'company', companyId?: string) => {
    setCreateUserContext(context);
    setCreateCompanyId(companyId ?? null);
    setEditCompanyId(null);
    setSelectedDeptId('');
    setSelectedAreaId('');
    createForm.reset();
    setCreateOpen(true);
  };

  const openEdit = (u: ApiUser | ApiUserWithRoles, companyId?: string) => {
    const currentRoleId = 'roles' in u ? u.roles[0]?.roleId : undefined;

    setEditCompanyId(companyId ?? null);
    setEditUser(u);
    editForm.reset({
      firstName: u.firstName ?? undefined,
      lastName: u.lastName ?? undefined,
      idNumber: u.idNumber ?? undefined,
      roleId: currentRoleId,
    });
    editForm.trigger();
  };

  const onCreateSubmit = (values: CreateUserForm) => {
    const { roleId, ...rest } = values;
    const orgId = createUserContext === 'company' ? (createCompanyId ?? undefined) : undefined;
    const dto: CreateUserDto = {
      ...rest,
      roleId: roleId || undefined,
      isSuperAdmin: createUserContext === 'super-admin',
      orgId,
      departamentoId: rest.departamentoId || undefined,
      areaId: rest.areaId || undefined,
      cargoId: rest.cargoId || undefined,
    };
    createMutation.mutate({
      dto,
      roleId: roleId || undefined,
      orgId,
    });
  };

  const onEditSubmit = (values: EditUserForm) => {
    if (!editUser) return;
    const { roleId, ...dto } = values;
    const currentRoleId = 'roles' in editUser ? editUser.roles[0]?.roleId : undefined;

    editMutation.mutate({
      id: editUser.id,
      dto,
      orgId: editCompanyId ?? undefined,
      roleId: roleId || undefined,
      currentRoleId,
    });
  };

  return {
    users,
    superAdmins,
    superAdminsTotal,
    superAdminsTotalPages,
    superAdminsLoading,
    superAdminsIsFetching,
    superAdminsDataUpdatedAt,
    refreshSuperAdmins,
    // Search / filter / pagination for the super-admins table
    saSearch,
    setSaSearch,
    saStatus,
    setSaStatus,
    saPage,
    setSaPage,
    createOpen,
    setCreateOpen,
    invitedUser,
    setInvitedUser,
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
    editCompanyId,
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
    removeFromOrgMutation,
    restoreToOrgMutation,
    toggleSuperAdminMutation,
    resendInvitationMutation,
  };
}
