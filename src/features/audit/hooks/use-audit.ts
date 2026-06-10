import { useState, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { auditApi, type AuditLogFilters } from '@/lib/api/audit';

const PAGE_SIZE = 50;

export function useAudit(companyId: string | undefined, enabled: boolean) {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState<Omit<AuditLogFilters, 'page' | 'limit' | 'orgId'>>({});

  const queryKey = ['audit-logs', companyId ?? 'all', filters, page];

  const query = useQuery({
    queryKey,
    queryFn: ({ signal }) =>
      auditApi.getLogs(
        { ...filters, orgId: companyId || undefined, page, limit: PAGE_SIZE },
        signal,
      ),
    // Disable when companyId is an empty string (not yet loaded in org context).
    // When undefined (super admin — all orgs) or a UUID, proceed normally.
    enabled: enabled && companyId !== '',
    staleTime: 300_000,
  });

  function applyFilters(next: Omit<AuditLogFilters, 'page' | 'limit' | 'orgId'>) {
    setFilters(next);
    setPage(1);
  }

  function clearFilters() {
    setFilters({});
    setPage(1);
  }

  const refresh = useCallback(() => {
    queryClient.invalidateQueries({ queryKey });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryClient, companyId ?? 'all', filters, page]);

  return {
    logs: query.data?.data ?? [],
    total: query.data?.total ?? 0,
    page: query.data?.page ?? page,
    limit: query.data?.limit ?? PAGE_SIZE,
    isLoading: query.isLoading,
    isError: query.isError,
    isFetching: query.isFetching,
    dataUpdatedAt: query.dataUpdatedAt,
    filters,
    applyFilters,
    clearFilters,
    setPage,
    refresh,
  };
}
