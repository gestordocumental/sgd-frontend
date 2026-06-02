import { useState, useCallback, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  companiesApi,
  type ApiCompany,
  type CreateCompanyDto,
  type UpdateCompanyDto,
} from '@/lib/api/companies';
import { requiredString } from '@/lib/validations/schemas';

const companySchema = z.object({
  name: requiredString(),
  nit: z.string().optional(),
  address: z.string().optional(),
  phone: z.string().optional(),
});

export type CompanyForm = z.infer<typeof companySchema>;

export function useAdminCompanies() {
  const queryClient = useQueryClient();

  const [createOpen, setCreateOpen] = useState(false);
  const [editCompany, setEditCompany] = useState<ApiCompany | null>(null);
  const [deleteCompany, setDeleteCompany] = useState<ApiCompany | null>(null);
  const [expandedCompanies, setExpandedCompanies] = useState<Set<string>>(new Set());
  const [selectedCompany, setSelectedCompany] = useState<ApiCompany | null>(null);

  // ── Server-side search / filter / pagination state ────────────────────────
  type CompanyStatus = 'all' | 'active' | 'inactive' | 'deleted';
  const PAGE_SIZE = 20;
  const [search, setSearchValue] = useState('');
  const [debouncedSearch, setDebounced] = useState('');
  const [statusFilter, setStatusFilterValue] = useState<CompanyStatus>('all');
  const [page, setPage] = useState(1);

  const setSearch = useCallback((value: string) => {
    setSearchValue(value);
    setPage(1);
  }, []);

  const setStatusFilter = useCallback((value: CompanyStatus) => {
    setStatusFilterValue(value);
    setPage(1);
  }, []);

  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => setDebounced(search), 400);
    return () => {
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    };
  }, [search]);

  const {
    data: companiesResult,
    isLoading: companiesLoading,
    isFetching: companiesIsFetching,
    dataUpdatedAt: companiesDataUpdatedAt,
  } = useQuery({
    queryKey: ['companies', { page, search: debouncedSearch, status: statusFilter }],
    queryFn: () =>
      companiesApi.list({
        page,
        limit: PAGE_SIZE,
        search: debouncedSearch || undefined,
        status: statusFilter !== 'all' ? statusFilter : undefined,
      }),
    staleTime: 60_000,
    placeholderData: (prev) => prev,
  });

  const { data: activeResult } = useQuery({
    queryKey: ['companies-active-total'],
    queryFn: () => companiesApi.list({ status: 'active', limit: 1 }),
    staleTime: 60_000,
  });

  const companies = companiesResult?.data ?? [];
  const companiesTotal = companiesResult?.total ?? 0;
  const activeCompaniesTotal = activeResult?.total ?? 0;
  const companiesTotalPages = Math.max(1, Math.ceil(companiesTotal / PAGE_SIZE));
  const effectivePage = Math.min(page, companiesTotalPages);

  const refreshCompanies = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['companies'] });
    queryClient.invalidateQueries({ queryKey: ['companies-active-total'] });
  }, [queryClient]);

  const createMutation = useMutation({
    mutationFn: (dto: CreateCompanyDto) => companiesApi.create(dto),
    onSuccess: () => {
      refreshCompanies();
      setCreateOpen(false);
    },
  });

  const editMutation = useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: UpdateCompanyDto }) =>
      companiesApi.update(id, dto),
    onSuccess: (updated) => {
      refreshCompanies();
      setEditCompany(null);
      setSelectedCompany((prev) => (prev?.id === updated.id ? updated : prev));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => companiesApi.remove(id),
    onSuccess: (_, deletedId) => {
      refreshCompanies();
      setDeleteCompany(null);
      setSelectedCompany((prev) => (prev?.id === deletedId ? null : prev));
      setExpandedCompanies((prev) => {
        const next = new Set(prev);
        next.delete(deletedId);
        return next;
      });
    },
  });

  const toggleStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: 'active' | 'inactive' }) =>
      companiesApi.update(id, { status }),
    onSuccess: refreshCompanies,
  });

  const restoreMutation = useMutation({
    mutationFn: (id: string) => companiesApi.restore(id),
    onSuccess: refreshCompanies,
  });

  const createForm = useForm<CompanyForm>({
    resolver: zodResolver(companySchema),
    mode: 'onTouched',
  });
  const editForm = useForm<CompanyForm>({
    resolver: zodResolver(companySchema),
    mode: 'onTouched',
  });

  const openEdit = (c: ApiCompany) => {
    setEditCompany(c);
    editForm.reset({
      name: c.name,
      nit: c.nit ?? '',
      address: c.address ?? '',
      phone: c.phone ?? '',
    });
  };

  const onCreateSubmit = (values: CompanyForm) => createMutation.mutate(values);

  const onEditSubmit = (values: CompanyForm) => {
    if (!editCompany) return;
    editMutation.mutate({ id: editCompany.id, dto: values });
  };

  const toggleExpand = (company: ApiCompany) => {
    const next = new Set(expandedCompanies);
    if (next.has(company.id)) {
      next.delete(company.id);
      if (selectedCompany?.id === company.id) setSelectedCompany(null);
    } else {
      next.add(company.id);
      setSelectedCompany(company);
    }
    setExpandedCompanies(next);
  };

  const openCreate = () => {
    createForm.reset();
    setCreateOpen(true);
  };

  return {
    companies,
    companiesTotal,
    activeCompaniesTotal,
    companiesTotalPages,
    companiesLoading,
    companiesIsFetching,
    companiesDataUpdatedAt,
    refreshCompanies,
    // Search / filter / pagination
    search,
    setSearch,
    statusFilter,
    setStatusFilter,
    page: effectivePage,
    setPage,
    createOpen,
    setCreateOpen,
    editCompany,
    setEditCompany,
    deleteCompany,
    setDeleteCompany,
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
  };
}
