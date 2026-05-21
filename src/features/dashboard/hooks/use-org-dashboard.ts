import { useQuery } from '@tanstack/react-query'
import { typologiesApi } from '@/lib/api/typologies'
import { workflowsApi } from '@/lib/api/workflows'

export function useOrgDashboard(orgId: string, enabled = true) {
  const typologyStats = useQuery({
    queryKey: ['typology-stats', orgId],
    queryFn: () => typologiesApi.stats(orgId),
    enabled: enabled && !!orgId,
    staleTime: 60_000,
  })

  const workflowStats = useQuery({
    queryKey: ['workflow-stats', orgId],
    queryFn: () => workflowsApi.stats(),
    enabled: enabled && !!orgId,
    staleTime: 60_000,
  })

  return { typologyStats, workflowStats }
}
