import { lazy, Suspense, useState, startTransition } from 'react';
import { useQuery } from '@tanstack/react-query';
import { createFileRoute, redirect } from '@tanstack/react-router';
import { UserProfileCard } from '@/features/profile/components/UserProfileCard';
import { Users, Building2, UserPlus, LayoutDashboard, ClipboardList } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsTrigger } from '@/components/ui/tabs';
import { ScrollableTabsList } from '@/components/ui/scrollable-tabs-list';
import { useAuthStore } from '@/store/authStore';
import { isDeleted } from '@/lib/formatters';
import { useAdminUsers } from '@/features/users/hooks/use-admin-users';
import { usersApi } from '@/lib/api/users';
import { useAdminCompanies } from '@/features/companies/hooks/use-admin-companies';
import { UserDialogs } from '@/features/users/components/UserDialogs';
import { CompanyDialogs } from '@/features/companies/components/CompanyDialogs';
import type { MergedOrgStorage } from '@/features/dashboard/components/AdminDashboard';
import { Skeleton } from '@/components/ui/skeleton';

const AdminDashboard = lazy(() =>
  import('@/features/dashboard/components/AdminDashboard').then((m) => ({
    default: m.AdminDashboard,
  })),
);
const UsersTable = lazy(() =>
  import('@/features/users/components/UsersTable').then((m) => ({ default: m.UsersTable })),
);
const CompaniesTable = lazy(() =>
  import('@/features/companies/components/CompaniesTable').then((m) => ({
    default: m.CompaniesTable,
  })),
);
const AuditTable = lazy(() =>
  import('@/features/audit/components/AuditTable').then((m) => ({ default: m.AuditTable })),
);
import { useAudit } from '@/features/audit/hooks/use-audit';
import { typologiesApi } from '@/lib/api/typologies';
import { workflowsApi } from '@/lib/api/workflows';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { FeatureErrorFallback } from '@/components/FeatureErrorFallback';

export const Route = createFileRoute('/dashboard/admin')({
  beforeLoad: () => {
    const { isAuthenticated, isSuperAdmin } = useAuthStore.getState();
    if (!isAuthenticated) throw redirect({ to: '/login' });
    if (!isSuperAdmin) throw redirect({ to: '/dashboard' });
  },
  component: AdminDashboardPage,
});

function TabSkeleton() {
  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center gap-4">
        <Skeleton className="h-7 w-40" />
        <Skeleton className="h-7 w-24" />
      </div>
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <Skeleton className="h-28 rounded-xl" />
        <Skeleton className="h-28 rounded-xl" />
        <Skeleton className="h-28 rounded-xl" />
        <Skeleton className="h-28 rounded-xl" />
      </div>
      <Skeleton className="h-72 rounded-xl" />
    </div>
  );
}

function AdminDashboardPage() {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<'overview' | 'users' | 'companies' | 'audit'>(
    'overview',
  );

  const users = useAdminUsers();
  const companies = useAdminCompanies();
  const audit = useAudit(undefined, activeTab === 'audit');

  const { data: typologyStorage = [], isLoading: typologyStorageLoading } = useQuery({
    queryKey: ['admin-storage-per-org'],
    queryFn: ({ signal }) => typologiesApi.storagePerOrg(signal),
    staleTime: 120_000,
  });

  const { data: workflowStorage = [], isLoading: workflowStorageLoading } = useQuery({
    queryKey: ['admin-workflow-storage-per-org'],
    queryFn: ({ signal }) => workflowsApi.storagePerOrg(signal),
    staleTime: 120_000,
  });

  // Merge both storage sources per orgId
  const storageStats = (() => {
    const map = new Map<string, MergedOrgStorage>();
    for (const s of typologyStorage) {
      map.set(s.orgId, {
        orgId: s.orgId,
        storageTotalBytes: s.storageTotalBytes,
        uploadedDocuments: s.uploadedDocuments,
        workflowAttachments: 0,
      });
    }
    for (const s of workflowStorage) {
      const existing = map.get(s.orgId);
      if (existing) {
        existing.storageTotalBytes += s.storageTotalBytes;
        existing.workflowAttachments = s.totalAttachments;
      } else {
        map.set(s.orgId, {
          orgId: s.orgId,
          storageTotalBytes: s.storageTotalBytes,
          uploadedDocuments: 0,
          workflowAttachments: s.totalAttachments,
        });
      }
    }
    return [...map.values()].sort((a, b) => b.storageTotalBytes - a.storageTotalBytes);
  })();

  const storageLoading = typologyStorageLoading || workflowStorageLoading;

  const { data: orgUserCounts = [], isLoading: orgUserCountsLoading } = useQuery({
    queryKey: ['admin-counts-by-org'],
    queryFn: ({ signal }) => usersApi.countsByOrg(signal),
    staleTime: 120_000,
  });

  return (
    <Tabs
      value={activeTab}
      onValueChange={(v) =>
        startTransition(() => setActiveTab(v as 'overview' | 'users' | 'companies' | 'audit'))
      }
      className="flex flex-col h-screen bg-background overflow-hidden gap-0"
    >
      {/* ── Header ──────────────────────────────────────────────────── */}
      <header className="flex items-center px-4 h-16 border-b border-border bg-card shrink-0 gap-3">
        {/* Logo — nunca se encoge */}
        <div className="shrink-0">
          <img
            src="/logo.svg"
            alt="Logo"
            className="h-14 w-auto mix-blend-multiply dark:mix-blend-screen"
          />
        </div>

        <div className="w-px h-6 bg-border shrink-0" />

        {/* Pestañas — toma el espacio disponible y hace scroll si no caben */}
        <ScrollableTabsList>
          <TabsTrigger value="overview">
            <LayoutDashboard className="size-4" />
            <span className="hidden lg:inline">{t('dashboard.overview')}</span>
          </TabsTrigger>
          <TabsTrigger value="users">
            <Users className="size-4" />
            <span className="hidden lg:inline">{t('common.users')}</span>
          </TabsTrigger>
          <TabsTrigger value="companies">
            <Building2 className="size-4" />
            <span className="hidden lg:inline">{t('companies.title')}</span>
          </TabsTrigger>
          <TabsTrigger value="audit">
            <ClipboardList className="size-4" />
            <span className="hidden lg:inline">{t('audit.title')}</span>
          </TabsTrigger>
        </ScrollableTabsList>

        {/* Controles — nunca se encogen ni se solapan */}
        <div className="flex items-center gap-2 shrink-0">
          {activeTab === 'users' && (
            <Button size="sm" onClick={() => users.openCreate('super-admin')}>
              <UserPlus className="size-4" /> {t('dashboard.newUser')}
            </Button>
          )}
          {activeTab === 'companies' && (
            <Button size="sm" onClick={companies.openCreate}>
              <Building2 className="size-4" /> {t('dashboard.newCompany')}
            </Button>
          )}
          <UserProfileCard variant="header" />
        </div>
      </header>

      {/* ── Content ─────────────────────────────────────────────────── */}
      <main id="main-content" tabIndex={-1} className="flex-1 flex flex-col min-h-0 outline-none">
        <TabsContent value="overview" className="flex-1 overflow-auto">
          <ErrorBoundary
            fallback={(reset) => (
              <FeatureErrorFallback feature={t('dashboard.overview')} onReset={reset} />
            )}
          >
            <Suspense fallback={<TabSkeleton />}>
              <AdminDashboard
                companies={companies.companies}
                users={users.users}
                superAdmins={users.superAdmins}
                loading={companies.companiesLoading}
                storageStats={storageStats}
                storageLoading={storageLoading}
                orgUserCounts={orgUserCounts}
                orgUserCountsLoading={orgUserCountsLoading}
              />
            </Suspense>
          </ErrorBoundary>
        </TabsContent>
        <TabsContent value="users" className="flex-1 overflow-auto">
          <ErrorBoundary
            fallback={(reset) => (
              <FeatureErrorFallback feature={t('common.users')} onReset={reset} />
            )}
          >
            <Suspense fallback={<TabSkeleton />}>
              <UsersTable hook={users} />
            </Suspense>
          </ErrorBoundary>
        </TabsContent>
        <TabsContent value="companies" className="flex-1 overflow-auto">
          <ErrorBoundary
            fallback={(reset) => (
              <FeatureErrorFallback feature={t('companies.title')} onReset={reset} />
            )}
          >
            <Suspense fallback={<TabSkeleton />}>
              <CompaniesTable
                hook={companies}
                onCreateUser={(companyId) => users.openCreate('company', companyId)}
                onEditUser={(u, companyId) => users.openEdit(u, companyId)}
                onToggleUserStatus={(u, companyId) =>
                  isDeleted(u) || !!u.orgRemovedAt
                    ? users.restoreToOrgMutation.mutate({ user: u, orgId: companyId })
                    : u.isActive
                      ? users.disableMutation.mutate(u.id)
                      : users.enableMutation.mutate(u.id)
                }
              />
            </Suspense>
          </ErrorBoundary>
        </TabsContent>
        <TabsContent value="audit" className="flex-1 overflow-auto">
          <ErrorBoundary
            fallback={(reset) => (
              <FeatureErrorFallback feature={t('audit.title')} onReset={reset} />
            )}
          >
            <Suspense fallback={<TabSkeleton />}>
              <AuditTable hook={audit} users={users.users} />
            </Suspense>
          </ErrorBoundary>
        </TabsContent>
      </main>

      {/* ── Dialogs ─────────────────────────────────────────────────── */}
      <UserDialogs hook={users} />
      <CompanyDialogs hook={companies} />
    </Tabs>
  );
}
