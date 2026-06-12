import { useState, startTransition, useCallback } from 'react';
import { useAuthStore } from '@/store/authStore';
import { isDeleted } from '@/lib/formatters';
import { useMyPermissions } from '@/features/profile/hooks/use-my-permissions';
import { useCompanyUsers } from '@/features/company-users/hooks/use-company-users';
import { useRoles } from '@/features/roles/hooks/use-roles';
import { useOrgStructure } from '@/features/org-structure/hooks/use-org-structure';
import { useTypologies } from '@/features/doc-governance/hooks/use-typologies';
import { useWorkflows } from '@/features/workflows/hooks/use-workflows';
import { useAudit } from '@/features/audit/hooks/use-audit';
import { useOrgDashboard } from './use-org-dashboard';

export type TabId =
  | 'overview'
  | 'company'
  | 'users'
  | 'roles'
  | 'org-structure'
  | 'workflows'
  | 'audit';

export function useCompanyDashboard() {
  const { user: me, isSuperAdmin } = useAuthStore();
  const companyId = me?.companyId ?? '';

  // ── Tab state ──────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<TabId>('overview');
  // Tabs are lazy-mounted on first visit and kept alive afterwards.
  const [mountedTabs, setMountedTabs] = useState<Set<TabId>>(() => new Set(['overview']));

  // ── Permissions ────────────────────────────────────────────────────────────
  const { hasPermission, isLoading: permissionsLoading } = useMyPermissions(
    companyId,
    isSuperAdmin,
  );

  const canViewUsers = hasPermission('USERS', 'READ');
  const canViewOrgs = hasPermission('ROLES', 'READ');
  const canViewOrgStructure = hasPermission('ORG_STRUCTURE', 'READ');
  const canViewWorkflows = hasPermission('WORKFLOWS', 'READ');
  const canManageWorkflows = hasPermission('WORKFLOWS', 'MANAGE');
  const canViewAudit = hasPermission('AUDIT', 'READ');
  const canWriteUsers = hasPermission('USERS', 'WRITE');
  const canWriteOrgs = hasPermission('ROLES', 'WRITE');
  const canWriteOrgStructure = hasPermission('ORG_STRUCTURE', 'WRITE');
  const canWriteWorkflows = hasPermission('WORKFLOWS', 'WRITE');
  const canApproveWorkflows = hasPermission('WORKFLOWS', 'APPROVE');

  const canMountTab = useCallback(
    (tab: TabId): boolean => {
      if (permissionsLoading) return true;
      if (tab === 'users') return canViewUsers;
      if (tab === 'roles') return canViewOrgs;
      if (tab === 'org-structure') return canViewOrgStructure;
      if (tab === 'workflows') return canViewWorkflows;
      if (tab === 'audit') return canViewAudit;
      return true;
    },
    [
      permissionsLoading,
      canViewUsers,
      canViewOrgs,
      canViewOrgStructure,
      canViewWorkflows,
      canViewAudit,
    ],
  );

  const handleTabChange = useCallback(
    (tab: TabId) => {
      startTransition(() => {
        const allowed = canMountTab(tab);
        setActiveTab(allowed ? tab : 'overview');
        if (allowed) {
          setMountedTabs((prev) => (prev.has(tab) ? prev : new Set(prev).add(tab)));
        }
      });
    },
    [canMountTab],
  );

  // If the active tab is inaccessible after permissions resolve, fall back to
  // 'overview' without a state mutation — derived during render.
  const effectiveTab: TabId = (() => {
    if (permissionsLoading) return activeTab;
    if (activeTab === 'users' && !canViewUsers) return 'overview';
    if (activeTab === 'roles' && !canViewOrgs) return 'overview';
    if (activeTab === 'org-structure' && !canViewOrgStructure) return 'overview';
    if (activeTab === 'workflows' && !canViewWorkflows) return 'overview';
    if (activeTab === 'audit' && !canViewAudit) return 'overview';
    return activeTab;
  })();

  // ── Domain hooks ───────────────────────────────────────────────────────────
  const companyUsers = useCompanyUsers(companyId);
  const roles = useRoles(companyId);
  const orgStructure = useOrgStructure(companyId, mountedTabs.has('org-structure'));
  const typologies = useTypologies(companyId, mountedTabs.has('org-structure'));
  const workflows = useWorkflows(companyId);
  const audit = useAudit(companyId, mountedTabs.has('audit'));
  const orgDashboard = useOrgDashboard(companyId, mountedTabs.has('overview'));

  // ── Derived state ──────────────────────────────────────────────────────────
  const activeUsers = companyUsers.users.filter((u) => !isDeleted(u));

  const handleWorkflowNotificationClick = useCallback(
    async (workflowId: string) => {
      if (!canViewWorkflows) return;
      handleTabChange('workflows');
      await workflows.actions.openDetailById(workflowId);
    },
    [canViewWorkflows, handleTabChange, workflows],
  );

  return {
    companyId,
    isSuperAdmin,
    // Tabs
    effectiveTab,
    mountedTabs,
    handleTabChange,
    // Permissions
    permissionsLoading,
    canViewUsers,
    canViewOrgs,
    canViewOrgStructure,
    canViewWorkflows,
    canManageWorkflows,
    canViewAudit,
    canWriteUsers,
    canWriteOrgs,
    canWriteOrgStructure,
    canWriteWorkflows,
    canApproveWorkflows,
    // Domain hooks
    companyUsers,
    roles,
    orgStructure,
    typologies,
    workflows,
    audit,
    orgDashboard,
    // Derived
    activeUsers,
    // Handlers
    handleWorkflowNotificationClick,
  };
}
