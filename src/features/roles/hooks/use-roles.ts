import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { rolesApi, type ApiRole } from '@/lib/api/roles';
import { usersApi } from '@/lib/api/users';
import { requiredString, optionalString } from '@/lib/validations/schemas';

const roleSchema = z.object({
  name: requiredString(),
  description: optionalString,
});

export type RoleForm = z.infer<typeof roleSchema>;

export function useRoles(companyId: string) {
  const queryClient = useQueryClient();

  const [createRoleOpen, setCreateRoleOpen] = useState(false);
  const [editRole, setEditRole] = useState<ApiRole | null>(null);
  const [deleteRole, setDeleteRole] = useState<ApiRole | null>(null);
  const [selectedPermIds, setSelectedPermIds] = useState<string[]>([]);
  const [assignRoleUser, setAssignRoleUser] = useState<{
    role: ApiRole;
  } | null>(null);
  const [expandedRoles, setExpandedRoles] = useState<Set<string>>(new Set());
  const [expandedPermissions, setExpandedPermissions] = useState<Set<string>>(new Set());

  const { data: roles = [], isLoading: rolesLoading } = useQuery({
    queryKey: ['roles', companyId],
    queryFn: () => rolesApi.listRoles(),
    staleTime: 60_000,
    enabled: !!companyId,
  });

  const { data: permissions = [] } = useQuery({
    queryKey: ['permissions'],
    queryFn: () => rolesApi.listPermissions(),
    staleTime: Infinity, // permissions catalog is static
  });

  const invalidateRoles = () => queryClient.invalidateQueries({ queryKey: ['roles', companyId] });

  const invalidateUsers = () =>
    queryClient.invalidateQueries({ queryKey: ['company-users', companyId] });

  // Removes the permission cache for ALL users — needed when a role assignment
  // changes. Using removeQueries (not invalidateQueries) ensures stale data is
  // not kept if the subsequent fetch fails due to reduced permissions.
  const invalidateMyOrgRoles = () => queryClient.removeQueries({ queryKey: ['my-org-roles'] });

  const createRoleMutation = useMutation({
    mutationFn: (dto: { name: string; description?: string; permissionIds: string[] }) =>
      rolesApi.createRole({ ...dto, description: dto.description ?? '' }),
    onSuccess: () => {
      invalidateRoles();
      setCreateRoleOpen(false);
    },
  });

  const editRoleMutation = useMutation({
    mutationFn: async ({
      id,
      dto,
    }: {
      id: string;
      dto: { name: string; description?: string; permissionIds: string[] };
    }) => {
      const { permissionIds, ...roleData } = dto;
      await rolesApi.updateRole(id, { ...roleData, description: roleData.description ?? '' });
      return rolesApi.assignPermissions(id, permissionIds);
    },
    onSuccess: () => {
      invalidateRoles();
      invalidateMyOrgRoles();
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
      usersApi.assignUserToOrg(userId, companyId, roleId),
    onSuccess: () => {
      invalidateRoles();
      invalidateUsers();
      invalidateMyOrgRoles();
      setAssignRoleUser(null);
    },
  });

  const removeUserFromRoleMutation = useMutation({
    mutationFn: ({ userId }: { userId: string }) => usersApi.removeUserFromOrg(userId, companyId),
    onSuccess: () => {
      invalidateRoles();
      invalidateMyOrgRoles();
      invalidateUsers();
    },
  });

  const createForm = useForm<RoleForm>({
    resolver: zodResolver(roleSchema),
    mode: 'onChange',
  });
  const editForm = useForm<RoleForm>({
    resolver: zodResolver(roleSchema),
    mode: 'onChange',
  });

  const openCreate = () => {
    setSelectedPermIds([]);
    createForm.reset();
    setCreateRoleOpen(true);
  };

  const openEdit = (role: ApiRole) => {
    setEditRole(role);
    setSelectedPermIds(role.permissions.map((p) => p.id));
    editForm.reset({ name: role.name, description: role.description ?? undefined });
    editForm.trigger();
  };

  const togglePerm = (permId: string) =>
    setSelectedPermIds((prev) =>
      prev.includes(permId) ? prev.filter((p) => p !== permId) : [...prev, permId],
    );

  return {
    roles,
    rolesLoading,
    permissions,
    createRoleOpen,
    setCreateRoleOpen,
    editRole,
    setEditRole,
    deleteRole,
    setDeleteRole,
    selectedPermIds,
    assignRoleUser,
    setAssignRoleUser,
    expandedRoles,
    setExpandedRoles,
    expandedPermissions,
    setExpandedPermissions,
    createForm,
    editForm,
    openCreate,
    openEdit,
    togglePerm,
    createRoleMutation,
    editRoleMutation,
    deleteRoleMutation,
    assignUserToRoleMutation,
    removeUserFromRoleMutation,
  };
}
