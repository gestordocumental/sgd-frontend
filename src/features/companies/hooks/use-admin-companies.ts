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

  // ── Server-side search / filter / cursor pagination state ─────────────────
  type CompanyStatus = 'all' | 'active' | 'inactive' | 'deleted';
  const PAGE_SIZE = 20;
  const [search, setSearchValue] = useState('');
  const [debouncedSearch, setDebounced] = useState('');
  const [statusFilter, setStatusFilterValue] = useState<CompanyStatus>('all');

  // cursor stack: [null, cursor1, cursor2, ...]  — null = first page
  const [cursors, setCursors] = useState<(string | null)[]>([null]);
  const [cursorIdx, setCursorIdx] = useState(0);
  const currentCursor = cursors[cursorIdx] ?? undefined;

  const resetCursor = useCallback(() => {
    setCursors([null]);
    setCursorIdx(0);
  }, []);

  const setSearch = useCallback(
    (value: string) => {
      setSearchValue(value);
      resetCursor();
    },
    [resetCursor],
  );

  const setStatusFilter = useCallback(
    (value: CompanyStatus) => {
      setStatusFilterValue(value);
      resetCursor();
    },
    [resetCursor],
  );

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
    queryKey: [
      'companies',
      { cursor: currentCursor, search: debouncedSearch, status: statusFilter },
    ],
    queryFn: ({ signal }) =>
      companiesApi.list(
        {
          cursor: currentCursor,
          limit: PAGE_SIZE,
          search: debouncedSearch || undefined,
          status: statusFilter !== 'all' ? statusFilter : undefined,
        },
        signal,
      ),
    staleTime: 60_000,
    placeholderData: (prev) => prev,
  });

  const companies = companiesResult?.data ?? [];
  const hasPrevPage = cursorIdx > 0;
  const hasNextPage = companiesResult?.hasMore ?? false;

  const goNextPage = useCallback(() => {
    const next = companiesResult?.nextCursor;
    if (!next) return;
    setCursors((prev) => [...prev.slice(0, cursorIdx + 1), next]);
    setCursorIdx((prev) => prev + 1);
  }, [companiesResult?.nextCursor, cursorIdx]);

  const goPrevPage = useCallback(() => {
    if (cursorIdx > 0) setCursorIdx((prev) => prev - 1);
  }, [cursorIdx]);

  const refreshCompanies = useCallback(() => {
    resetCursor();
    queryClient.invalidateQueries({ queryKey: ['companies'] });
  }, [queryClient, resetCursor]);

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
    companiesLoading,
    companiesIsFetching,
    companiesDataUpdatedAt,
    refreshCompanies,
    // Search / filter / cursor pagination
    search,
    setSearch,
    statusFilter,
    setStatusFilter,
    hasPrevPage,
    hasNextPage,
    goNextPage,
    goPrevPage,
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
