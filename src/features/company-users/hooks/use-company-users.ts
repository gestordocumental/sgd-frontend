import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { usersApi, type ApiUser, type CreateUserDto, type UpdateUserDto } from '@/lib/api/users'
import { companiesApi } from '@/lib/api/companies'
import { emailField, requiredString } from '@/lib/validations/schemas'

const createUserSchema = z.object({
  position: requiredString('The position'),
  email: emailField,
})

const editUserSchema = z.object({
  name: requiredString('The name'),
  email: emailField,
})

export type CreateUserForm = z.infer<typeof createUserSchema>
export type EditUserForm = z.infer<typeof editUserSchema>

export function useCompanyUsers(companyId: string) {
  const queryClient = useQueryClient()

  const [createUserOpen, setCreateUserOpen] = useState(false)
  const [editUser, setEditUser] = useState<ApiUser | null>(null)
  const [deleteUser, setDeleteUser] = useState<ApiUser | null>(null)

  const { data: company } = useQuery({
    queryKey: ['company', companyId],
    queryFn: () => companiesApi.getById(companyId),
    staleTime: 60_000,
  })

  const { data: users = [], isLoading: usersLoading } = useQuery({
    queryKey: ['company-users', companyId],
    queryFn: () => usersApi.listUsersByOrg(companyId),
    staleTime: 60_000,
    refetchInterval: 30_000,
    refetchIntervalInBackground: false,
  })

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ['company-users', companyId] })

  const createMutation = useMutation({
    mutationFn: (dto: CreateUserDto) => usersApi.create(dto),
    onSuccess: () => { invalidate(); setCreateUserOpen(false) },
  })

  const editMutation = useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: UpdateUserDto }) => usersApi.update(id, dto),
    onSuccess: () => { invalidate(); setEditUser(null) },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => usersApi.remove(id),
    onSuccess: () => { invalidate(); setDeleteUser(null) },
  })

  const restoreMutation = useMutation({
    mutationFn: (id: string) => usersApi.restore(id),
    onSuccess: invalidate,
  })

  const createForm = useForm<CreateUserForm>({ resolver: zodResolver(createUserSchema), mode: 'onTouched' })
  const editForm = useForm<EditUserForm>({ resolver: zodResolver(editUserSchema), mode: 'onTouched' })

  const openCreate = () => {
    createForm.reset()
    setCreateUserOpen(true)
  }

  const openEdit = (u: ApiUser) => {
    setEditUser(u)
    editForm.reset({ name: u.firstName ?? undefined, email: u.email })
  }

  return {
    company,
    users,
    usersLoading,
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
