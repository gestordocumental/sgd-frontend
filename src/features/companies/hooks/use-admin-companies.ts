import { useState, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { companiesApi, type ApiCompany, type CreateCompanyDto, type UpdateCompanyDto } from '@/lib/api/companies'
import { requiredString } from '@/lib/validations/schemas'

const companySchema = z.object({
  name: requiredString('The company name'),
  nit: z.string().optional(),
  address: z.string().optional(),
  phone: z.string().optional(),
})

export type CompanyForm = z.infer<typeof companySchema>

export function useAdminCompanies() {
  const queryClient = useQueryClient()

  const [createOpen, setCreateOpen] = useState(false)
  const [editCompany, setEditCompany] = useState<ApiCompany | null>(null)
  const [deleteCompany, setDeleteCompany] = useState<ApiCompany | null>(null)
  const [expandedCompanies, setExpandedCompanies] = useState<Set<string>>(new Set())
  const [selectedCompany, setSelectedCompany] = useState<ApiCompany | null>(null)

  const {
    data: companies = [],
    isLoading: companiesLoading,
    isFetching: companiesIsFetching,
    dataUpdatedAt: companiesDataUpdatedAt,
  } = useQuery({
    queryKey: ['companies'],
    queryFn: companiesApi.list,
    staleTime: 60_000,
  })

  const refreshCompanies = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['companies'] })
  }, [queryClient])

  const createMutation = useMutation({
    mutationFn: (dto: CreateCompanyDto) => companiesApi.create(dto),
    onSuccess: () => { refreshCompanies(); setCreateOpen(false) },
  })

  const editMutation = useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: UpdateCompanyDto }) => companiesApi.update(id, dto),
    onSuccess: (updated) => {
      refreshCompanies()
      setEditCompany(null)
      setSelectedCompany((prev) => (prev?.id === updated.id ? updated : prev))
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => companiesApi.remove(id),
    onSuccess: (_, deletedId) => {
      refreshCompanies()
      setDeleteCompany(null)
      setSelectedCompany((prev) => (prev?.id === deletedId ? null : prev))
      setExpandedCompanies((prev) => {
        const next = new Set(prev)
        next.delete(deletedId)
        return next
      })
    },
  })

  const toggleStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: 'active' | 'inactive' }) =>
      companiesApi.update(id, { status }),
    onSuccess: refreshCompanies,
  })

  const restoreMutation = useMutation({
    mutationFn: (id: string) => companiesApi.restore(id),
    onSuccess: refreshCompanies,
  })

  const createForm = useForm<CompanyForm>({ resolver: zodResolver(companySchema), mode: 'onTouched' })
  const editForm = useForm<CompanyForm>({ resolver: zodResolver(companySchema), mode: 'onTouched' })

  const openEdit = (c: ApiCompany) => {
    setEditCompany(c)
    editForm.reset({ name: c.name, nit: c.nit ?? '', address: c.address ?? '', phone: c.phone ?? '' })
  }

  const onCreateSubmit = (values: CompanyForm) => createMutation.mutate(values)

  const onEditSubmit = (values: CompanyForm) => {
    if (!editCompany) return
    editMutation.mutate({ id: editCompany.id, dto: values })
  }

  const toggleExpand = (company: ApiCompany) => {
    const next = new Set(expandedCompanies)
    if (next.has(company.id)) {
      next.delete(company.id)
      if (selectedCompany?.id === company.id) setSelectedCompany(null)
    } else {
      next.add(company.id)
      setSelectedCompany(company)
    }
    setExpandedCompanies(next)
  }

  const openCreate = () => {
    createForm.reset()
    setCreateOpen(true)
  }

  return {
    companies,
    companiesLoading,
    companiesIsFetching,
    companiesDataUpdatedAt,
    refreshCompanies,
    createOpen, setCreateOpen,
    editCompany, setEditCompany,
    deleteCompany, setDeleteCompany,
    expandedCompanies,
    selectedCompany,
    createForm,
    editForm,
    openCreate,
    openEdit,
    onCreateSubmit,
    onEditSubmit,
    toggleExpand,
    createMutation,
    editMutation,
    deleteMutation,
    toggleStatusMutation,
    restoreMutation,
  }
}
