import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { rolesApi, type ApiRole } from '@/lib/api/roles';
import { usersApi } from '@/lib/api/users';
import { requiredString, optionalString } from '@/lib/validations/schemas';
import { resolveApiError } from '@/lib/utils/api-error';

const roleSchema = z.object({
  name: requiredString(),
  description: optionalString,
});

export type RoleForm = z.infer<typeof roleSchema>;

export function useRoles(companyId: string) {
  const queryClient = useQueryClient();
  const { t } = useTranslation();

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
    queryFn: ({ signal }) => rolesApi.listRoles(undefined, signal),
    staleTime: 60_000,
    enabled: !!companyId,
  });

  const { data: permissions = [] } = useQuery({
    queryKey: ['permissions'],
    queryFn: ({ signal }) => rolesApi.listPermissions(signal),
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
    onError: (error: unknown) => {
      toast.error(resolveApiError(error, t, t('roles.dialogs.createRoleError')));
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
    onError: (error: unknown) => {
      toast.error(resolveApiError(error, t, t('roles.dialogs.editRoleError')));
    },
  });

  const deleteRoleMutation = useMutation({
    mutationFn: (id: string) => rolesApi.deleteRole(id),
    onSuccess: () => {
      invalidateRoles();
      setDeleteRole(null);
    },
    onError: (error: unknown) => {
      toast.error(resolveApiError(error, t, t('roles.dialogs.deleteRoleError')));
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
    mutationFn: ({ userId, roleId }: { userId: string; roleId: string }) =>
      usersApi.removeUserFromRole(userId, companyId, roleId),
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

  // Mirrors RolePolicy.validatePermissionSet on the backend (the actual
  // enforcement — this is just proactive UX so an admin doesn't have to
  // discover the rule by hitting a save error): an action permission
  // (WRITE, DELETE, APPROVE, ...) is useless without READ ("Ver") on the
  // same module, since the user could never reach the screen that exposes
  // the action. So checking an action auto-checks READ for its module, and
  // unchecking READ cascades to unchecking every other permission on that
  // module — otherwise unchecking READ alone would silently recreate the
  // exact inconsistent state this whole mechanism exists to prevent.
  const togglePerm = (permId: string) => {
    const perm = permissions.find((p) => p.id === permId);
    if (!perm) {
      // Catalog not loaded yet or a stale id — fall back to a plain toggle
      // rather than dropping the interaction.
      setSelectedPermIds((prev) =>
        prev.includes(permId) ? prev.filter((p) => p !== permId) : [...prev, permId],
      );
      return;
    }

    setSelectedPermIds((prev) => {
      const isSelected = prev.includes(permId);

      if (isSelected) {
        if (perm.action === 'READ') {
          const sameModuleIds = new Set(
            permissions.filter((p) => p.module === perm.module).map((p) => p.id),
          );
          return prev.filter((id) => !sameModuleIds.has(id));
        }
        return prev.filter((id) => id !== permId);
      }

      const next = [...prev, permId];
      if (perm.action !== 'READ') {
        const readPerm = permissions.find((p) => p.module === perm.module && p.action === 'READ');
        if (readPerm && !next.includes(readPerm.id)) next.push(readPerm.id);
      }
      return next;
    });
  };

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
