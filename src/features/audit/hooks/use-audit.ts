import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { auditApi, type AuditLogFilters } from '@/lib/api/audit'

const PAGE_SIZE = 50

export function useAudit(companyId: string, enabled: boolean) {
  const [page, setPage] = useState(1)
  const [filters, setFilters] = useState<Omit<AuditLogFilters, 'page' | 'limit' | 'orgId'>>({})

  const query = useQuery({
    queryKey: ['audit-logs', companyId, filters, page],
    queryFn: () =>
      auditApi.getLogs({ ...filters, orgId: companyId || undefined, page, limit: PAGE_SIZE }),
    enabled: enabled && !!companyId,
    staleTime: 30_000,
  })

  function applyFilters(next: Omit<AuditLogFilters, 'page' | 'limit' | 'orgId'>) {
    setFilters(next)
    setPage(1)
  }

  function clearFilters() {
    setFilters({})
    setPage(1)
  }

  return {
    logs:        query.data?.data ?? [],
    total:       query.data?.total ?? 0,
    page:        query.data?.page  ?? page,
    limit:       query.data?.limit ?? PAGE_SIZE,
    isLoading:   query.isLoading,
    isError:     query.isError,
    filters,
    applyFilters,
    clearFilters,
    setPage,
  }
}
