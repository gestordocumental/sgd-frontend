import { useMemo, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { workflowsApi, type WorkflowStatus } from '@/lib/api/workflows';
import { typologiesApi } from '@/lib/api/typologies';
import { usersApi, type ApiUserWithRoles } from '@/lib/api/users';
import { rolesApi } from '@/lib/api/roles';
import type { WorkflowsInnerTab } from './workflow-schemas';

interface WorkflowQueriesOptions {
  statusFilter: WorkflowStatus | undefined;
  innerTab: WorkflowsInnerTab;
  /** Id of the workflow currently shown in the detail dialog (undefined = closed) */
  detailWorkflowId: string | undefined;
  timelineWorkflowId: string | null;
  createOpen: boolean;
  editWorkflowOpen: boolean;
  reviewCycleOpen: boolean;
}

const EMPTY_ORG_USERS: ApiUserWithRoles[] = [];

export function useWorkflowQueries(companyId: string, options: WorkflowQueriesOptions) {
  const queryClient = useQueryClient();
  const {
    statusFilter,
    innerTab,
    detailWorkflowId,
    timelineWorkflowId,
    createOpen,
    editWorkflowOpen,
    reviewCycleOpen,
  } = options;

  const {
    data: paginatedWorkflows,
    isLoading: workflowsLoading,
    isFetching: workflowsIsFetching,
    dataUpdatedAt: workflowsUpdatedAt,
  } = useQuery({
    queryKey: ['workflows', statusFilter],
    queryFn: () => workflowsApi.list({ status: statusFilter, limit: 50 }),
    staleTime: 30_000,
    refetchInterval: 30_000,
    refetchOnWindowFocus: false,
    enabled: innerTab === 'all',
  });

  const {
    data: myTasks = [],
    isLoading: myTasksLoading,
    isFetching: myTasksIsFetching,
    dataUpdatedAt: myTasksUpdatedAt,
  } = useQuery({
    queryKey: ['workflows-my-tasks'],
    queryFn: () => workflowsApi.myTasks(),
    staleTime: 30_000,
    refetchInterval: 30_000,
    refetchOnWindowFocus: false,
  });

  const {
    data: myAvailable = [],
    isLoading: myAvailableLoading,
    isFetching: myAvailableIsFetching,
    dataUpdatedAt: myAvailableUpdatedAt,
  } = useQuery({
    queryKey: ['workflows-my-available'],
    queryFn: () => workflowsApi.myAvailable(),
    staleTime: 30_000,
    refetchInterval: 30_000,
    refetchOnWindowFocus: false,
  });

  const { data: timeline = [], isLoading: timelineLoading } = useQuery({
    queryKey: ['workflow-timeline', timelineWorkflowId],
    queryFn: () => workflowsApi.getTimeline(timelineWorkflowId!),
    staleTime: 30_000,
    enabled: !!timelineWorkflowId,
  });

  // Detalle completo (con adjuntos) cuando se abre el dialog de detalle
  const { data: detailWorkflowFull } = useQuery({
    queryKey: ['workflow', detailWorkflowId],
    queryFn: () => workflowsApi.getById(detailWorkflowId!),
    staleTime: 30_000,
    refetchOnWindowFocus: false,
    enabled: !!detailWorkflowId,
  });

  // Tipologías activas de la organización — para el selector del formulario
  const { data: typologies = [] } = useQuery({
    queryKey: ['typologies', companyId],
    queryFn: () => typologiesApi.list(companyId),
    staleTime: 60_000,
    enabled: !!companyId && createOpen,
  });

  // Usuarios de la organización — para el selector de aprobadores y resolución de nombres en detalle
  const { data: orgUsersPage } = useQuery({
    queryKey: ['company-users', companyId],
    queryFn: () => usersApi.listUsersByOrg(companyId),
    staleTime: 60_000,
    enabled:
      !!companyId &&
      (createOpen ||
        !!detailWorkflowId ||
        !!timelineWorkflowId ||
        editWorkflowOpen ||
        reviewCycleOpen),
  });
  const orgUsers = orgUsersPage?.data ?? EMPTY_ORG_USERS;

  // Roles con sus permisos — para filtrar aprobadores elegibles
  const { data: allRoles = [] } = useQuery({
    queryKey: ['roles', companyId],
    queryFn: () => rolesApi.listRoles(companyId),
    staleTime: 60_000,
    enabled: !!companyId && (createOpen || editWorkflowOpen),
  });

  const invalidateAll = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['workflows'] });
    queryClient.invalidateQueries({ queryKey: ['workflows-my-tasks'] });
    queryClient.invalidateQueries({ queryKey: ['workflows-my-available'] });
  }, [queryClient]);

  const isRefreshing = workflowsIsFetching || myTasksIsFetching || myAvailableIsFetching;
  // Latest successful fetch across all three queries — changes once per fetch completion
  const workflowsDataUpdatedAt = Math.max(
    workflowsUpdatedAt,
    myTasksUpdatedAt,
    myAvailableUpdatedAt,
  );

  // ── Derived data ───────────────────────────────────────────────────────────
  const activeTypologies = useMemo(
    () => typologies.filter((t) => t.typologyStatus === 'ACTIVE'),
    [typologies],
  );

  const activeOrgUsers = useMemo(
    () => orgUsers.filter((u) => u.isActive && !u.deletedAt && u.registrationStatus === 'active'),
    [orgUsers],
  );

  /** Mapa userId → nombre completo para todos los usuarios de la org */
  const orgUsersMap = useMemo(
    () =>
      new Map(
        orgUsers.map((u) => [u.id, [u.firstName, u.lastName].filter(Boolean).join(' ') || u.email]),
      ),
    [orgUsers],
  );

  /** IDs de roles que tienen permiso WORKFLOWS:APPROVE */
  const approveRoleIds = useMemo(
    () =>
      new Set(
        allRoles
          .filter((r) =>
            r.permissions.some((p) => p.module === 'WORKFLOWS' && p.action === 'APPROVE'),
          )
          .map((r) => r.id),
      ),
    [allRoles],
  );

  /** Usuarios activos que pueden ser aprobadores (tienen al menos un rol con WORKFLOWS:APPROVE) */
  const approverEligibleUsers = useMemo(
    () => activeOrgUsers.filter((u) => u.roles.some((r) => approveRoleIds.has(r.roleId))),
    [activeOrgUsers, approveRoleIds],
  );

  return {
    paginatedWorkflows,
    workflowsLoading,
    isRefreshing,
    workflowsDataUpdatedAt,
    myTasks,
    myTasksLoading,
    myAvailable,
    myAvailableLoading,
    timeline,
    timelineLoading,
    detailWorkflowFull,
    activeTypologies,
    activeOrgUsers,
    orgUsersMap,
    approverEligibleUsers,
    invalidateAll,
  };
}
