import { Fragment, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Building2, CheckCircle, ChevronRight, ChevronDown, Search } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Pager } from '@/components/ui/pager'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { StatCard } from '@/components/ui/stat-card'
import { type ApiUser } from '@/lib/api/users'
import { formatDate } from '@/lib/formatters'
import type { useAdminCompanies } from '@/features/companies/hooks/use-admin-companies'
import { CompanyActions } from './CompanyActions'
import { CompanyUsersRow } from './CompanyUsersRow'

type CompaniesHook = ReturnType<typeof useAdminCompanies>
type StatusFilter = 'all' | 'active' | 'inactive'
const PAGE_SIZE = 20

interface CompaniesTableProps {
  hook: CompaniesHook
  onCreateUser: (companyId: string) => void
  onEditUser: (u: ApiUser) => void
  onDeleteUser: (u: ApiUser) => void
  onToggleUserStatus: (u: ApiUser) => void
}

export function CompaniesTable({
  hook,
  onCreateUser,
  onEditUser,
  onDeleteUser,
  onToggleUserStatus,
}: CompaniesTableProps) {
  const {
    companies,
    companiesLoading,
    expandedCompanies,
    selectedCompany,
    openEdit,
    setDeleteCompany,
    toggleExpand,
    toggleStatusMutation,
  } = hook
  const { t } = useTranslation()

  const [search, setSearch]       = useState('')
  const [statusFilter, setStatus] = useState<StatusFilter>('all')
  const [page, setPage]           = useState(1)

  const filtered = companies.filter((c) => {
    const q = search.toLowerCase()
    const matchesSearch = !q ||
      c.name.toLowerCase().includes(q) ||
      (c.nit ?? '').toLowerCase().includes(q)
    const matchesStatus =
      statusFilter === 'all'    ? true :
      statusFilter === 'active' ? c.status === 'active' :
      /* inactive */              c.status !== 'active'
    return matchesSearch && matchesStatus
  })

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const safePage   = Math.min(page, totalPages)
  const paginated  = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)

  const handleSearch = (v: string) => { setSearch(v); setPage(1) }
  const handleStatus = (v: StatusFilter) => { setStatus(v); setPage(1) }

  const totalActiveCompanies = companies.filter((c) => c.status === 'active').length

  const STATUS_LABELS: Record<StatusFilter, string> = {
    all:      t('common.all'),
    active:   t('common.active'),
    inactive: t('common.inactive'),
  }

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
          value={totalActiveCompanies}
          icon={<CheckCircle className="size-5 text-muted-foreground" />}
        />
      </div>

      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <div className="px-5 py-4 border-b border-border flex items-center justify-between gap-3 flex-wrap">
          <h2 className="text-sm font-semibold shrink-0">{t('companies.title')}</h2>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" />
              <Input
                value={search}
                onChange={(e) => handleSearch(e.target.value)}
                placeholder={t('common.search')}
                className="h-8 pl-8 w-48 text-sm"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => handleStatus(e.target.value as StatusFilter)}
              className="h-8 rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm outline-none focus-visible:border-ring"
            >
              {(['all', 'active', 'inactive'] as StatusFilter[]).map((s) => (
                <option key={s} value={s}>{STATUS_LABELS[s]}</option>
              ))}
            </select>
          </div>
        </div>

        {companiesLoading ? (
          <div className="flex items-center justify-center py-16 text-sm text-muted-foreground">
            {t('companies.loading')}
          </div>
        ) : filtered.length === 0 ? (
        ) : filtered.length === 0 ? (
          <div className="flex items-center justify-center py-16 text-sm text-muted-foreground">
            {search || statusFilter !== 'all' ? t('common.noResults') : t('companies.empty')}
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
              {paginated.map((company) => (
              {paginated.map((company) => (
                <Fragment key={company.id}>
                  <TableRow className={selectedCompany?.id === company.id ? 'bg-primary/5' : ''}>
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
                    <TableCell className="text-sm text-muted-foreground font-mono">{company.nit ?? '—'}</TableCell>
                    <TableCell>
                      {company.status === 'active' ? (
                        <Badge variant="outline" className="text-xs text-emerald-600 border-emerald-200 bg-emerald-50">
                          {t('common.active')}
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-xs text-muted-foreground">
                          {t('common.inactive')}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{company.address ?? '—'}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{company.phone ?? '—'}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{formatDate(company.createdAt)}</TableCell>
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
                      />
                    </TableCell>
                  </TableRow>

                  {expandedCompanies.has(company.id) && (
                    <CompanyUsersRow
                      id={`company-users-row-${company.id}`}
                      companyId={company.id}
                      onEditUser={onEditUser}
                      onDeleteUser={onDeleteUser}
                      onToggleUserStatus={onToggleUserStatus}
                    />
                  )}
                </Fragment>
              ))}
            </TableBody>
          </Table>
        )}

        {totalPages > 1 && (
          <Pager page={safePage} totalPages={totalPages} total={filtered.length} onChange={setPage} className="px-5 py-3 border-t border-border" />
        )}

        {totalPages > 1 && (
          <Pager page={safePage} totalPages={totalPages} total={filtered.length} onChange={setPage} className="px-5 py-3 border-t border-border" />
        )}
      </div>
    </main>
  )
}
