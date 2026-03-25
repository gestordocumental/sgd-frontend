import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { rolesApi, type ApiRole } from '@/lib/api/roles'
import { requiredString } from '@/lib/validations/schemas'

const roleSchema = z.object({
  name: requiredString('El nombre del rol'),
  description: requiredString('La descripción'),
})

export type RoleForm = z.infer<typeof roleSchema>

export function useRoles(companyId: string) {
  const queryClient = useQueryClient()

  const [createRoleOpen, setCreateRoleOpen] = useState(false)
  const [editRole, setEditRole] = useState<ApiRole | null>(null)
  const [deleteRole, setDeleteRole] = useState<ApiRole | null>(null)
  const [selectedPermIds, setSelectedPermIds] = useState<string[]>([])
  const [assignRoleUser, setAssignRoleUser] = useState<{ role: ApiRole } | null>(null)
  const [assignPermUser, setAssignPermUser] = useState<{ permissionId: string } | null>(null)
  const [revokePermTarget, setRevokePermTarget] = useState<{ userId: string; permissionId: string } | null>(null)
  const [expandedRoles, setExpandedRoles] = useState<Set<string>>(new Set())
  const [expandedPermissions, setExpandedPermissions] = useState<Set<string>>(new Set())

  const { data: roles = [], isLoading: rolesLoading } = useQuery({
    queryKey: ['roles', companyId],
    queryFn: () => rolesApi.listRoles(companyId),
    staleTime: 60_000,
  })

  const { data: userPermissions = [] } = useQuery({
    queryKey: ['user-permissions', companyId],
    queryFn: () => rolesApi.listUserPermissions(companyId),
    staleTime: 60_000,
  })

  const invalidateRoles = () =>
    queryClient.invalidateQueries({ queryKey: ['roles', companyId] })

  const invalidatePermissions = () =>
    queryClient.invalidateQueries({ queryKey: ['user-permissions', companyId] })

  const createRoleMutation = useMutation({
    mutationFn: (dto: { name: string; description: string; permissionIds: string[] }) =>
      rolesApi.createRole(companyId, dto),
    onSuccess: () => { invalidateRoles(); setCreateRoleOpen(false) },
  })

  const editRoleMutation = useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: { name: string; description: string; permissionIds: string[] } }) =>
      rolesApi.updateRole(id, dto),
    onSuccess: () => { invalidateRoles(); setEditRole(null) },
  })

  const deleteRoleMutation = useMutation({
    mutationFn: (id: string) => rolesApi.deleteRole(id),
    onSuccess: () => { invalidateRoles(); setDeleteRole(null) },
  })

  const assignUserToRoleMutation = useMutation({
    mutationFn: ({ roleId, userId }: { roleId: string; userId: string }) =>
      rolesApi.assignUserToRole(roleId, userId),
    onSuccess: () => { invalidateRoles(); setAssignRoleUser(null) },
  })

  const removeUserFromRoleMutation = useMutation({
    mutationFn: ({ roleId, userId }: { roleId: string; userId: string }) =>
      rolesApi.removeUserFromRole(roleId, userId),
    onSuccess: invalidateRoles,
  })

  const assignPermMutation = useMutation({
    mutationFn: ({ userId, permissionId }: { userId: string; permissionId: string }) =>
      rolesApi.assignPermissionToUser(userId, permissionId),
    onSuccess: () => { invalidatePermissions(); setAssignPermUser(null) },
  })

  const revokePermMutation = useMutation({
    mutationFn: ({ userId, permissionId }: { userId: string; permissionId: string }) =>
      rolesApi.revokePermissionFromUser(userId, permissionId),
    onSuccess: () => { invalidatePermissions(); setRevokePermTarget(null) },
  })

  const createForm = useForm<RoleForm>({ resolver: zodResolver(roleSchema), mode: 'onTouched' })
  const editForm = useForm<RoleForm>({ resolver: zodResolver(roleSchema), mode: 'onTouched' })

  const openCreate = () => {
    setSelectedPermIds([])
    createForm.reset()
    setCreateRoleOpen(true)
  }

  const openEdit = (role: ApiRole) => {
    setEditRole(role)
    setSelectedPermIds([...role.permissionIds])
    editForm.reset({ name: role.name, description: role.description })
  }

  const togglePerm = (permId: string) =>
    setSelectedPermIds((prev) =>
      prev.includes(permId) ? prev.filter((p) => p !== permId) : [...prev, permId],
    )

  return {
    roles,
    rolesLoading,
    userPermissions,
    createRoleOpen, setCreateRoleOpen,
    editRole, setEditRole,
    deleteRole, setDeleteRole,
    selectedPermIds,
    assignRoleUser, setAssignRoleUser,
    assignPermUser, setAssignPermUser,
    revokePermTarget, setRevokePermTarget,
    expandedRoles, setExpandedRoles,
    expandedPermissions, setExpandedPermissions,
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
    assignPermMutation,
    revokePermMutation,
  }
}
