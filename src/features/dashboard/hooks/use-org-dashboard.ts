import { useQuery } from '@tanstack/react-query';
import { typologiesApi } from '@/lib/api/typologies';
import { workflowsApi } from '@/lib/api/workflows';

interface UseOrgDashboardOptions {
  // Each stats query is only fetched when the overview tab is mounted AND the
  // caller holds the permission that backs the corresponding module — avoids
  // requesting (and momentarily rendering) data the user isn't authorized to see.
  canViewOrgStructure: boolean;
  canViewWorkflows: boolean;
}

export function useOrgDashboard(
  orgId: string,
  tabMounted: boolean,
  options: UseOrgDashboardOptions,
) {
  const typologyStats = useQuery({
    queryKey: ['typology-stats', orgId],
    queryFn: ({ signal }) => typologiesApi.stats(orgId, signal),
    enabled: tabMounted && options.canViewOrgStructure && !!orgId,
    staleTime: 60_000,
  });

  const workflowStats = useQuery({
    queryKey: ['workflow-stats', orgId],
    queryFn: ({ signal }) => workflowsApi.stats(signal),
    enabled: tabMounted && options.canViewWorkflows && !!orgId,
    staleTime: 60_000,
  });

  return { typologyStats, workflowStats };
}
