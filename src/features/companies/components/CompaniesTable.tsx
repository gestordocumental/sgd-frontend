import { Fragment } from 'react';
import { useTranslation } from 'react-i18next';
import { Building2, CheckCircle, ChevronRight, ChevronDown, Search, RefreshCw } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Pager } from '@/components/ui/pager';
import { RefreshCountdown } from '@/components/ui/refresh-countdown';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { StatCard } from '@/components/ui/stat-card';
import { type ApiUserWithRoles } from '@/lib/api/users';
import { formatDate } from '@/lib/formatters';
import type { useAdminCompanies } from '@/features/companies/hooks/use-admin-companies';
import { CompanyActions } from './CompanyActions';
import { CompanyUsersRow } from './CompanyUsersRow';

type CompaniesHook = ReturnType<typeof useAdminCompanies>;
type StatusFilter = 'all' | 'active' | 'inactive' | 'deleted';

interface CompaniesTableProps {
  hook: CompaniesHook;
  onCreateUser: (companyId: string) => void;
  onEditUser: (u: ApiUserWithRoles, companyId: string) => void;
  onToggleUserStatus: (u: ApiUserWithRoles, companyId: string) => void;
  onResendInvitation: (u: ApiUserWithRoles, companyId: string) => void;
}

export function CompaniesTable({
  hook,
  onCreateUser,
  onEditUser,
  onToggleUserStatus,
  onResendInvitation,
}: CompaniesTableProps) {
  const {
    companies,
    companiesLoading,
    companiesIsFetching,
    companiesDataUpdatedAt,
    refreshCompanies,
    expandedCompanies,
    selectedCompany,
    openEdit,
    setDeleteCompany,
    toggleExpand,
    toggleStatusMutation,
    restoreMutation,
    search,
    setSearch,
    statusFilter,
    setStatusFilter,
    hasPrevPage,
    hasNextPage,
    goNextPage,
    goPrevPage,
  } = hook;
  const { t } = useTranslation();

  const STATUS_LABELS: Record<StatusFilter, string> = {
    all: t('common.all'),
    active: t('common.active'),
    inactive: t('common.inactive'),
    deleted: t('common.deleted'),
  };

  return (
    <main className="p-6 space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <StatCard
          title={t('companies.totalCompanies')}
          value={companies.length}
          icon={<Building2 className="size-5 text-muted-foreground" />}
        />
        <StatCard
          title={t('companies.activeCompanies')}
          value={companies.filter((c) => !c.deletedAt && c.status === 'active').length}
          icon={<CheckCircle className="size-5 text-muted-foreground" />}
        />
      </div>

      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <div className="px-5 py-4 border-b border-border flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2 shrink-0">
            <h2 className="text-sm font-semibold">{t('companies.title')}</h2>
            <div className="flex flex-col items-center gap-0.5">
              <Button
                variant="ghost"
                size="icon"
                className="size-7"
                onClick={refreshCompanies}
                disabled={companiesIsFetching}
                title={t('common.refresh')}
                aria-label={t('common.refresh')}
              >
                <RefreshCw
                  className={`size-3.5 text-muted-foreground ${companiesIsFetching ? 'animate-spin' : ''}`}
                />
              </Button>
              <RefreshCountdown
                duration={60_000}
                isFetching={companiesIsFetching}
                updatedAt={companiesDataUpdatedAt}
              />
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t('common.search')}
                className="h-8 pl-8 w-48 text-sm"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
              aria-label={t('common.status')}
              className="h-8 rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm outline-none focus-visible:border-ring"
            >
              {(['all', 'active', 'inactive', 'deleted'] as StatusFilter[]).map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABELS[s]}
                </option>
              ))}
            </select>
          </div>
        </div>

        {companiesLoading ? (
          <div className="flex items-center justify-center py-16 text-sm text-muted-foreground">
            {t('companies.loading')}
          </div>
        ) : companies.length === 0 ? (
          <div className="flex items-center justify-center py-16 text-sm text-muted-foreground">
            {search || statusFilter !== 'all' ? t('common.noResults') : t('companies.empty')}
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('companies.companyColumn')}</TableHead>
                <TableHead>{t('companies.nit')}</TableHead>
                <TableHead>{t('common.status')}</TableHead>
                <TableHead>{t('common.address')}</TableHead>
                <TableHead>{t('common.phone')}</TableHead>
                <TableHead>{t('common.created')}</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {companies.map((company) => (
                <Fragment key={company.id}>
                  <TableRow
                    className={`${selectedCompany?.id === company.id ? 'bg-primary/5' : ''} ${company.deletedAt ? 'opacity-50' : ''}`}
                  >
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => toggleExpand(company)}
                          aria-expanded={expandedCompanies.has(company.id) ? 'true' : 'false'}
                          aria-controls={`company-users-row-${company.id}`}
                          aria-label={
                            expandedCompanies.has(company.id)
                              ? t('companies.actions.collapseCompany', { name: company.name })
                              : t('companies.actions.expandCompany', { name: company.name })
                          }
                          className="flex items-center justify-center size-6 rounded text-muted-foreground hover:bg-accent hover:text-foreground transition-colors shrink-0"
                        >
                          {expandedCompanies.has(company.id) ? (
                            <ChevronDown className="size-4" />
                          ) : (
                            <ChevronRight className="size-4" />
                          )}
                        </button>
                        <div className="flex items-center gap-2.5">
                          <div className="flex items-center justify-center size-8 rounded-md bg-primary/10 shrink-0">
                            <Building2 className="size-4 text-primary" />
                          </div>
                          <span className="text-sm font-medium">{company.name}</span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground font-mono">
                      {company.nit ?? '—'}
                    </TableCell>
                    <TableCell>
                      {company.deletedAt ? (
                        <Badge variant="destructive" className="text-xs">
                          {t('common.deleted')}
                        </Badge>
                      ) : company.status === 'active' ? (
                        <Badge
                          variant="outline"
                          className="text-xs text-emerald-600 border-emerald-200 bg-emerald-50"
                        >
                          {t('common.active')}
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-xs text-muted-foreground">
                          {t('common.inactive')}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {company.address ?? '—'}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {company.phone ?? '—'}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDate(company.createdAt)}
                    </TableCell>
                    <TableCell>
                      <CompanyActions
                        company={company}
                        onCreateUser={() => onCreateUser(company.id)}
                        onEdit={() => openEdit(company)}
                        onToggleStatus={() =>
                          toggleStatusMutation.mutate({
                            id: company.id,
                            status: company.status === 'active' ? 'inactive' : 'active',
                          })
                        }
                        onDelete={() => setDeleteCompany(company)}
                        onRestore={() => restoreMutation.mutate(company.id)}
                      />
                    </TableCell>
                  </TableRow>

                  {expandedCompanies.has(company.id) && (
                    <CompanyUsersRow
                      id={`company-users-row-${company.id}`}
                      companyId={company.id}
                      onEditUser={onEditUser}
                      onToggleUserStatus={onToggleUserStatus}
                      onResendInvitation={onResendInvitation}
                    />
                  )}
                </Fragment>
              ))}
            </TableBody>
          </Table>
        )}

        {(hasPrevPage || hasNextPage) && (
          <Pager
            hasPrev={hasPrevPage}
            hasNext={hasNextPage}
            onPrev={goPrevPage}
            onNext={goNextPage}
            className="px-5 py-3 border-t border-border"
          />
        )}
      </div>
    </main>
  );
}
