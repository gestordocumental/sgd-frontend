import { useState, useCallback, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  usersApi,
  type ApiUserWithRoles,
  type InvitedUserInfo,
  type CreateUserDto,
  type UpdateUserDto,
} from '@/lib/api/users';
import { rolesApi } from '@/lib/api/roles';
import { companiesApi } from '@/lib/api/companies';
import { orgStructureApi } from '@/lib/api/org-structure';
import { emailField, requiredString, optionalString } from '@/lib/validations/schemas';
import { ROLE_NAMES } from '@/lib/constants/roles';

// Native <select> elements send "" when the placeholder option is selected.
// z.string().uuid() rejects "" (not a UUID, not undefined), so accept "" explicitly.
// Submit handlers must coerce "" → undefined before calling the API.
const optionalUuid = z.union([z.literal(''), z.string().uuid()]).optional();

const createUserSchema = z.object({
  email: emailField,
  roleId: z.string().uuid(),
  departamentoId: optionalUuid,
  areaId: optionalUuid,
  cargoId: optionalUuid,
});

const editUserSchema = z.object({
  firstName: requiredString(),
  lastName: requiredString(),
  idNumber: optionalString,
  departamentoId: optionalUuid,
  areaId: optionalUuid,
  cargoId: optionalUuid,
  roleId: optionalUuid,
});

export type CreateUserForm = z.infer<typeof createUserSchema>;
export type EditUserForm = z.infer<typeof editUserSchema>;

export function useCompanyUsers(companyId: string) {
  const queryClient = useQueryClient();

  const [createUserOpen, setCreateUserOpen] = useState(false);
  const [invitedUser, setInvitedUser] = useState<InvitedUserInfo | null>(null);
  const [editUser, setEditUser] = useState<ApiUserWithRoles | null>(null);
  const [deleteUser, setDeleteUser] = useState<ApiUserWithRoles | null>(null);

  // Cascade state — create form
  const [selectedDeptId, setSelectedDeptId] = useState<string>('');
  const [selectedAreaId, setSelectedAreaId] = useState<string>('');

  // Cascade state — edit form
  const [editSelectedDeptId, setEditSelectedDeptId] = useState<string>('');
  const [editSelectedAreaId, setEditSelectedAreaId] = useState<string>('');

  const { data: company } = useQuery({
    queryKey: ['company', companyId],
    queryFn: () => companiesApi.getById(companyId),
    staleTime: 60_000,
    enabled: !!companyId,
  });

  const { data: roles = [] } = useQuery({
    queryKey: ['roles', companyId],
    queryFn: () => rolesApi.listRoles(),
    staleTime: 300_000,
    enabled: createUserOpen || !!editUser,
  });

  // Flat cargo list for the table display
  const { data: allCargos = [] } = useQuery({
    queryKey: ['all-cargos', companyId],
    queryFn: () => orgStructureApi.listAllCargos(companyId),
    staleTime: 300_000,
    enabled: !!companyId,
  });

  const cargoMap = new Map(allCargos.map((c) => [c.id, c.name]));

  // Shared departamentos list (used by both create and edit modals)
  const { data: departamentos = [] } = useQuery({
    queryKey: ['departamentos', companyId],
    queryFn: () => orgStructureApi.listDepartamentos(companyId),
    staleTime: 300_000,
    enabled: (createUserOpen || !!editUser) && !!companyId,
  });

  // Areas / cargos for create form
  const { data: areas = [] } = useQuery({
    queryKey: ['areas', companyId, selectedDeptId],
    queryFn: () => orgStructureApi.listAreas(companyId, selectedDeptId),
    staleTime: 300_000,
    enabled: createUserOpen && !!selectedDeptId,
  });

  // Department-level cargos for create form (no area required)
  const { data: deptCargos = [] } = useQuery({
    queryKey: ['dept-cargos', companyId, selectedDeptId],
    queryFn: () => orgStructureApi.listDeptCargos(companyId, selectedDeptId),
    staleTime: 300_000,
    enabled: createUserOpen && !!selectedDeptId,
  });

  // Area-level cargos for create form
  const { data: cargos = [] } = useQuery({
    queryKey: ['cargos', companyId, selectedDeptId, selectedAreaId],
    queryFn: () => orgStructureApi.listCargos(companyId, selectedDeptId, selectedAreaId),
    staleTime: 300_000,
    enabled: createUserOpen && !!selectedAreaId,
  });

  // Combined create cargos: dept-level + area-level (when area selected)
  const allCreateCargos = useMemo(() => [...deptCargos, ...cargos], [deptCargos, cargos]);

  // Areas / cargos for edit form — share the same cache keys as create form
  const { data: editAreas = [] } = useQuery({
    queryKey: ['areas', companyId, editSelectedDeptId],
    queryFn: () => orgStructureApi.listAreas(companyId, editSelectedDeptId),
    staleTime: 300_000,
    enabled: !!editUser && !!editSelectedDeptId,
  });

  // Department-level cargos for edit form (no area required)
  const { data: editDeptCargos = [] } = useQuery({
    queryKey: ['dept-cargos', companyId, editSelectedDeptId],
    queryFn: () => orgStructureApi.listDeptCargos(companyId, editSelectedDeptId),
    staleTime: 300_000,
    enabled: !!editUser && !!editSelectedDeptId,
  });

  // Area-level cargos for edit form
  const { data: editCargos = [] } = useQuery({
    queryKey: ['cargos', companyId, editSelectedDeptId, editSelectedAreaId],
    queryFn: () => orgStructureApi.listCargos(companyId, editSelectedDeptId, editSelectedAreaId),
    staleTime: 300_000,
    enabled: !!editUser && !!editSelectedAreaId,
  });

  // Combined edit cargos: dept-level + area-level (when area selected)
  const allEditCargos = useMemo(
    () => [...editDeptCargos, ...editCargos],
    [editDeptCargos, editCargos],
  );

  // When cargos load asynchronously after editForm.reset(), the native <select>
  // had no matching <option> at reset time and shows the placeholder.
  // Re-apply cargoId once the list arrives, but only if the user hasn't changed it yet.
  useEffect(() => {
    if (!editUser?.cargoId || allEditCargos.length === 0) return;
    const current = editForm.getValues('cargoId');
    if (current === editUser.cargoId && allEditCargos.some((c) => c.id === editUser.cargoId)) {
      editForm.setValue('cargoId', editUser.cargoId, { shouldDirty: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allEditCargos]);

  const {
    data: usersPage,
    isLoading: usersLoading,
    isFetching: usersIsFetching,
    dataUpdatedAt: usersDataUpdatedAt,
  } = useQuery({
    queryKey: ['company-users', companyId],
    queryFn: () => usersApi.listUsersByOrg(companyId),
    staleTime: 60_000,
    refetchOnWindowFocus: false,
    enabled: !!companyId,
  });
  const users = usersPage?.data ?? [];

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ['company-users', companyId] });

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ['company-users'] });
    queryClient.invalidateQueries({ queryKey: ['users'] });
    queryClient.invalidateQueries({ queryKey: ['superAdmins'] });
  };

  const refreshUsers = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['company-users', companyId] });
  }, [queryClient, companyId]);

  const createForm = useForm<CreateUserForm>({
    resolver: zodResolver(createUserSchema),
    mode: 'onChange',
  });

  // Pre-select VIEWER role (or first available) when roles load for the create form
  useEffect(() => {
    if (createUserOpen && roles.length > 0) {
      const current = createForm.getValues('roleId');
      if (!current) {
        const defaultRole = roles.find((r) => r.name === ROLE_NAMES.VIEWER) ?? roles[0];
        createForm.setValue('roleId', defaultRole.id, { shouldValidate: true });
      }
    }
  }, [roles, createUserOpen, createForm]);

  const createMutation = useMutation({
    mutationFn: (dto: CreateUserDto) => usersApi.create(dto),
    onSuccess: (created) => {
      invalidate();
      setCreateUserOpen(false);
      setInvitedUser({
        email: created.email,
        invitationUrl: `${window.location.origin}/complete-registration?token=${created.invitationToken}`,
        invitationResent: created.invitationResent,
      });
    },
    onError: (error: { response?: { data?: { message?: string } } }) => {
      const msg = error.response?.data?.message;
      if (msg) createForm.setError('email', { message: msg });
    },
  });

  const editMutation = useMutation({
    mutationFn: async ({
      id,
      dto,
      roleId,
      currentRoleId,
    }: {
      id: string;
      dto: UpdateUserDto;
      roleId?: string;
      currentRoleId?: string;
    }) => {
      await usersApi.update(id, dto);
      if (roleId && roleId !== currentRoleId) {
        await usersApi.assignUserToOrg(id, companyId, roleId);
      }
    },
    onSuccess: () => {
      invalidate();
      queryClient.invalidateQueries({ queryKey: ['all-cargos', companyId] });
      setEditUser(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => usersApi.removeUserFromOrg(id, companyId),
    onSuccess: () => {
      invalidate();
      setDeleteUser(null);
    },
  });

  const restoreMutation = useMutation({
    mutationFn: async (user: ApiUserWithRoles) => {
      if (user.deletedAt) {
        // Globally soft-deleted — restore the account
        await usersApi.restore(user.id);
      }

      if (user.orgRemovedAt) {
        // Explicitly removed from this org — re-assign to org (clears removedAt on backend)
        await usersApi.assignUserToOrg(user.id, companyId);
      }
    },
    onSuccess: invalidateAll,
  });

  const toggleOptionalReviewerMutation = useMutation({
    mutationFn: ({ id, value }: { id: string; value: boolean }) =>
      usersApi.setOptionalReviewer(id, companyId, value),
    onSuccess: invalidate,
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

  const disableMutation = useMutation({
    mutationFn: (id: string) => usersApi.disable(id),
    onSuccess: invalidate,
  });

  const enableMutation = useMutation({
    mutationFn: (id: string) => usersApi.enable(id),
    onSuccess: invalidate,
  });

  const editForm = useForm<EditUserForm>({
    resolver: zodResolver(editUserSchema),
    mode: 'onChange',
  });

  const openCreate = () => {
    createForm.reset();
    setSelectedDeptId('');
    setSelectedAreaId('');
    // Pre-select VIEWER if roles are already loaded
    const viewerRole = roles.find((r) => r.name === ROLE_NAMES.VIEWER);
    if (viewerRole) {
      createForm.setValue('roleId', viewerRole.id, { shouldValidate: true });
    }
    setCreateUserOpen(true);
  };

  const openEdit = (u: ApiUserWithRoles) => {
    setEditUser(u);
    const deptId = u.departamentoId ?? '';
    const areaId = u.areaId ?? '';
    setEditSelectedDeptId(deptId);
    setEditSelectedAreaId(areaId);
    editForm.reset({
      firstName: u.firstName ?? undefined,
      lastName: u.lastName ?? undefined,
      idNumber: u.idNumber ?? undefined,
      departamentoId: u.departamentoId ?? undefined,
      areaId: u.areaId ?? undefined,
      cargoId: u.cargoId ?? undefined,
      roleId: u.roles[0]?.roleId ?? undefined,
    });
    editForm.trigger();
  };

  return {
    company,
    users,
    usersLoading,
    usersIsFetching,
    usersDataUpdatedAt,
    refreshUsers,
    roles,
    cargoMap,
    departamentos,
    areas,
    allCreateCargos,
    selectedDeptId,
    setSelectedDeptId,
    selectedAreaId,
    setSelectedAreaId,
    editAreas,
    allEditCargos,
    editSelectedDeptId,
    setEditSelectedDeptId,
    editSelectedAreaId,
    setEditSelectedAreaId,
    createUserOpen,
    setCreateUserOpen,
    invitedUser,
    setInvitedUser,
    editUser,
    setEditUser,
    deleteUser,
    setDeleteUser,
    createForm,
    editForm,
    openCreate,
    openEdit,
    createMutation,
    editMutation,
    deleteMutation,
    restoreMutation,
    disableMutation,
    enableMutation,
    resendInvitationMutation,
    toggleOptionalReviewerMutation,
  };
}
