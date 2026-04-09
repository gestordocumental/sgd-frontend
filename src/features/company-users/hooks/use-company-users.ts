import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { usersApi, type ApiUserWithRoles, type CreateUserDto, type UpdateUserDto } from '@/lib/api/users'
import { rolesApi } from '@/lib/api/roles'
import { companiesApi } from '@/lib/api/companies'
import { orgStructureApi } from '@/lib/api/org-structure'
import { emailField, requiredString, optionalString } from '@/lib/validations/schemas'

const createUserSchema = z.object({
  email: emailField,
  roleId: z.string().uuid().optional(),
  departamentoId: z.string().uuid().optional(),
  areaId: z.string().uuid().optional(),
  cargoId: z.string().uuid().optional(),
})

const editUserSchema = z.object({
  firstName: requiredString('The first name'),
  lastName: requiredString('The last name'),
  idNumber: optionalString,
  departamentoId: z.string().uuid().optional(),
  areaId: z.string().uuid().optional(),
  cargoId: z.string().uuid().optional(),
})

export type CreateUserForm = z.infer<typeof createUserSchema>
export type EditUserForm = z.infer<typeof editUserSchema>

export function useCompanyUsers(companyId: string) {
  const queryClient = useQueryClient()

  const [createUserOpen, setCreateUserOpen] = useState(false)
  const [editUser, setEditUser] = useState<ApiUserWithRoles | null>(null)
  const [deleteUser, setDeleteUser] = useState<ApiUserWithRoles | null>(null)

  // Cascade state — create form
  const [selectedDeptId, setSelectedDeptId] = useState<string>('')
  const [selectedAreaId, setSelectedAreaId] = useState<string>('')

  // Cascade state — edit form
  const [editSelectedDeptId, setEditSelectedDeptId] = useState<string>('')
  const [editSelectedAreaId, setEditSelectedAreaId] = useState<string>('')

  const { data: company } = useQuery({
    queryKey: ['company', companyId],
    queryFn: () => companiesApi.getById(companyId),
    staleTime: 60_000,
    enabled: !!companyId,
  })

  const { data: roles = [] } = useQuery({
    queryKey: ['roles', companyId],
    queryFn: () => rolesApi.listRoles(),
    staleTime: 300_000,
    enabled: createUserOpen,
  })

  // Flat cargo list for the table display
  const { data: allCargos = [] } = useQuery({
    queryKey: ['all-cargos', companyId],
    queryFn: () => orgStructureApi.listAllCargos(companyId),
    staleTime: 300_000,
    enabled: !!companyId,
  })

  const cargoMap = new Map(allCargos.map((c) => [c.id, c.name]))

  // Shared departamentos list (used by both create and edit modals)
  const { data: departamentos = [] } = useQuery({
    queryKey: ['departamentos', companyId],
    queryFn: () => orgStructureApi.listDepartamentos(companyId),
    staleTime: 300_000,
    enabled: (createUserOpen || !!editUser) && !!companyId,
  })

  // Areas / cargos for create form
  const { data: areas = [] } = useQuery({
    queryKey: ['areas', companyId, selectedDeptId],
    queryFn: () => orgStructureApi.listAreas(companyId, selectedDeptId),
    staleTime: 300_000,
    enabled: createUserOpen && !!selectedDeptId,
  })

  const { data: cargos = [] } = useQuery({
    queryKey: ['cargos', companyId, selectedDeptId, selectedAreaId],
    queryFn: () => orgStructureApi.listCargos(companyId, selectedDeptId, selectedAreaId),
    staleTime: 300_000,
    enabled: createUserOpen && !!selectedAreaId,
  })

  // Areas / cargos for edit form — share the same cache keys as create form
  const { data: editAreas = [] } = useQuery({
    queryKey: ['areas', companyId, editSelectedDeptId],
    queryFn: () => orgStructureApi.listAreas(companyId, editSelectedDeptId),
    staleTime: 300_000,
    enabled: !!editUser && !!editSelectedDeptId,
  })

  const { data: editCargos = [] } = useQuery({
    queryKey: ['cargos', companyId, editSelectedDeptId, editSelectedAreaId],
    queryFn: () => orgStructureApi.listCargos(companyId, editSelectedDeptId, editSelectedAreaId),
    staleTime: 300_000,
    enabled: !!editUser && !!editSelectedAreaId,
  })

  const { data: users = [], isLoading: usersLoading } = useQuery({
    queryKey: ['company-users', companyId],
    queryFn: () => usersApi.listUsersByOrg(companyId),
    staleTime: 60_000,
    enabled: !!companyId,
  })

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ['company-users', companyId] })

  const createForm = useForm<CreateUserForm>({ resolver: zodResolver(createUserSchema), mode: 'onChange' })

  const createMutation = useMutation({
    mutationFn: (dto: CreateUserDto) => usersApi.create(dto),
    onSuccess: () => { invalidate(); setCreateUserOpen(false) },
    onError: (error: { response?: { data?: { message?: string } } }) => {
      const msg = error.response?.data?.message
      if (msg) createForm.setError('email', { message: msg })
    },
  })

  const editMutation = useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: UpdateUserDto }) => usersApi.update(id, dto),
    onSuccess: () => {
      invalidate()
      queryClient.invalidateQueries({ queryKey: ['all-cargos', companyId] })
      setEditUser(null)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => usersApi.remove(id),
    onSuccess: () => { invalidate(); setDeleteUser(null) },
  })

  const restoreMutation = useMutation({
    mutationFn: (id: string) => usersApi.restore(id),
    onSuccess: invalidate,
  })

  const editForm = useForm<EditUserForm>({ resolver: zodResolver(editUserSchema), mode: 'onChange' })

  const openCreate = () => {
    createForm.reset()
    setSelectedDeptId('')
    setSelectedAreaId('')
    setCreateUserOpen(true)
  }

  const openEdit = (u: ApiUserWithRoles) => {
    setEditUser(u)
    const deptId = u.departamentoId ?? ''
    const areaId = u.areaId ?? ''
    setEditSelectedDeptId(deptId)
    setEditSelectedAreaId(areaId)
    editForm.reset({
      firstName: u.firstName ?? undefined,
      lastName: u.lastName ?? undefined,
      idNumber: u.idNumber ?? undefined,
      departamentoId: u.departamentoId ?? undefined,
      areaId: u.areaId ?? undefined,
      cargoId: u.cargoId ?? undefined,
    })
    editForm.trigger()
  }

  return {
    company,
    users,
    usersLoading,
    roles,
    cargoMap,
    departamentos,
    areas,
    cargos,
    selectedDeptId,
    setSelectedDeptId,
    selectedAreaId,
    setSelectedAreaId,
    editAreas,
    editCargos,
    editSelectedDeptId,
    setEditSelectedDeptId,
    editSelectedAreaId,
    setEditSelectedAreaId,
    createUserOpen, setCreateUserOpen,
    editUser, setEditUser,
    deleteUser, setDeleteUser,
    createForm,
    editForm,
    openCreate,
    openEdit,
    createMutation,
    editMutation,
    deleteMutation,
    restoreMutation,
  }
}
