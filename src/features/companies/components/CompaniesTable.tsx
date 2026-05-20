import { Fragment, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import {
  Building2,
  CheckCircle,
  XCircle,
  ChevronRight,
  ChevronDown,
  ChevronLeft,
  MoreHorizontal,
  Trash2,
  UserPlus,
  Pencil as PencilIcon,
  CheckCircle as CheckIcon,
  XCircle as XIcon,
  ShieldCheck,
  Search,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { StatCard } from "@/components/ui/stat-card";
import { type ApiCompany } from "@/lib/api/companies";
import { usersApi, type ApiUser } from "@/lib/api/users";
import { initials, isDeleted, formatDate } from "@/lib/formatters";
import type { useAdminCompanies } from "@/features/companies/hooks/use-admin-companies";

type CompaniesHook = ReturnType<typeof useAdminCompanies>;
type StatusFilter = 'all' | 'active' | 'inactive'
type UserStatusFilter = 'all' | 'active' | 'inactive' | 'pending'
const PAGE_SIZE = 20
const USER_PAGE_SIZE = 10

interface CompaniesTableProps {
  hook: CompaniesHook;
  onCreateUser: (companyId: string) => void;
  onEditUser: (u: ApiUser) => void;
  onDeleteUser: (u: ApiUser) => void;
  onToggleUserStatus: (u: ApiUser) => void;
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
  } = hook;
  const { t } = useTranslation();

  const [search, setSearch]       = useState('')
  const [statusFilter, setStatus] = useState<StatusFilter>('all')
  const [page, setPage]           = useState(1)

  const filtered = companies.filter((c) => {
    const q = search.toLowerCase()
    const matchesSearch = !q ||
      c.name.toLowerCase().includes(q) ||
      (c.nit ?? '').toLowerCase().includes(q)

    const matchesStatus =
      statusFilter === 'all'      ? true :
      statusFilter === 'active'   ? c.status === 'active' :
      /* inactive */                c.status !== 'active'

    return matchesSearch && matchesStatus
  })

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const safePage   = Math.min(page, totalPages)
  const paginated  = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)

  const handleSearch = (v: string) => { setSearch(v); setPage(1) }
  const handleStatus = (v: StatusFilter) => { setStatus(v); setPage(1) }

  const totalActiveCompanies = companies.filter((c) => c.status === "active").length;

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
        {/* Header */}
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
              {paginated.map((company) => (
                <Fragment key={company.id}>
                  <TableRow
                    className={
                      selectedCompany?.id === company.id ? "bg-primary/5" : ""
                    }
                  >
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => toggleExpand(company)}
                          aria-expanded={expandedCompanies.has(company.id) ? "true" : "false"}
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
                          <span className="text-sm font-medium">
                            {company.name}
                          </span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground font-mono">
                      {company.nit ?? "—"}
                    </TableCell>
                    <TableCell>
                      {company.status === "active" ? (
                        <Badge
                          variant="outline"
                          className="text-xs text-emerald-600 border-emerald-200 bg-emerald-50"
                        >
                          {t('common.active')}
                        </Badge>
                      ) : (
                        <Badge
                          variant="outline"
                          className="text-xs text-muted-foreground"
                        >
                          {t('common.inactive')}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {company.address ?? "—"}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {company.phone ?? "—"}
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
                            status:
                              company.status === "active"
                                ? "inactive"
                                : "active",
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
          <Pager page={safePage} totalPages={totalPages} total={filtered.length} onChange={setPage} />
        )}
      </div>
    </main>
  );
}

// ── Pager ─────────────────────────────────────────────────────────────────────

function Pager({ page, totalPages, total, onChange }: {
  page: number; totalPages: number; total: number; onChange: (p: number) => void
}) {
  const { t } = useTranslation();
  return (
    <div className="flex items-center justify-between px-5 py-3 border-t border-border text-sm text-muted-foreground">
      <span>{t('common.resultsCount', { count: total })}</span>
      <div className="flex items-center gap-1">
        <Button variant="ghost" size="icon" className="size-7" disabled={page <= 1} onClick={() => onChange(page - 1)}>
          <ChevronLeft className="size-4" />
        </Button>
        <span className="px-2 text-xs">{page} / {totalPages}</span>
        <Button variant="ghost" size="icon" className="size-7" disabled={page >= totalPages} onClick={() => onChange(page + 1)}>
          <ChevronRight className="size-4" />
        </Button>
      </div>
    </div>
  )
}

// ── CompanyActions ────────────────────────────────────────────────────────────

interface CompanyActionsProps {
  company: ApiCompany;
  onCreateUser: () => void;
  onEdit: () => void;
  onToggleStatus: () => void;
  onDelete: () => void;
}

function CompanyActions({
  company,
  onCreateUser,
  onEdit,
  onToggleStatus,
  onDelete,
}: CompanyActionsProps) {
  const { t } = useTranslation();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={t('companies.actions.openCompanyMenu', { name: company.name })}
        className="inline-flex items-center justify-center size-8 rounded-md text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
      >
        <MoreHorizontal className="size-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={onCreateUser}>
          <UserPlus className="size-4" /> {t('companies.actions.createUser')}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onEdit}>
          <PencilIcon className="size-4" /> {t('companies.actions.editCompany')}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onToggleStatus}>
          {company.status === "active" ? (
            <>
              <XCircle className="size-4" /> {t('companies.actions.deactivateCompany')}
            </>
          ) : (
            <>
              <CheckCircle className="size-4" /> {t('companies.actions.activateCompany')}
            </>
          )}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="text-destructive focus:text-destructive"
          onClick={onDelete}
        >
          <Trash2 className="size-4" /> {t('companies.actions.deleteCompany')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// ── CompanyUsersRow ───────────────────────────────────────────────────────────

interface CompanyUsersRowProps {
  id: string;
  companyId: string;
  onEditUser: (u: ApiUser) => void;
  onDeleteUser: (u: ApiUser) => void;
  onToggleUserStatus: (u: ApiUser) => void;
}

function CompanyUsersRow({
  id,
  companyId,
  onEditUser,
  onDeleteUser,
  onToggleUserStatus,
}: CompanyUsersRowProps) {
  const { t } = useTranslation();
  const { data: users = [], isLoading, isError, refetch } = useQuery({
    queryKey: ["company-users", companyId],
    queryFn: () => usersApi.listUsersByOrg(companyId),
    staleTime: 60_000,
    refetchInterval: 30_000,
    refetchIntervalInBackground: false,
  });

  const [search, setSearch]       = useState('')
  const [statusFilter, setStatus] = useState<UserStatusFilter>('all')
  const [page, setPage]           = useState(1)

  const filtered = users.filter((u) => {
    const q = search.toLowerCase()
    const matchesSearch = !q ||
      (u.firstName ?? '').toLowerCase().includes(q) ||
      (u.lastName ?? '').toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q)

    const matchesStatus =
      statusFilter === 'all'      ? true :
      statusFilter === 'inactive' ? !!u.deletedAt :
      statusFilter === 'pending'  ? u.registrationStatus === 'pending_credentials' && !u.deletedAt :
      /* active */                  !u.deletedAt && u.registrationStatus !== 'pending_credentials'

    return matchesSearch && matchesStatus
  })

  const totalPages = Math.max(1, Math.ceil(filtered.length / USER_PAGE_SIZE))
  const safePage   = Math.min(page, totalPages)
  const paginated  = filtered.slice((safePage - 1) * USER_PAGE_SIZE, safePage * USER_PAGE_SIZE)

  const handleSearch = (v: string) => { setSearch(v); setPage(1) }
  const handleStatus = (v: UserStatusFilter) => { setStatus(v); setPage(1) }

  const USER_STATUS_LABELS: Record<UserStatusFilter, string> = {
    all:      t('common.all'),
    active:   t('common.active'),
    inactive: t('common.deleted'),
    pending:  t('common.pending'),
  }

  return (
    <TableRow id={id} className="hover:bg-transparent">
      <TableCell colSpan={7} className="p-0">
        <div className="bg-muted/40 border-b border-border">
          <div className="pl-14 pr-6 py-4">
            {/* Sub-header */}
            <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                {t('companies.companyUsers')}
              </p>
              {!isLoading && !isError && users.length > 0 && (
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <Search className="absolute left-2 top-1/2 -translate-y-1/2 size-3 text-muted-foreground pointer-events-none" />
                    <input
                      value={search}
                      onChange={(e) => handleSearch(e.target.value)}
                      placeholder={t('common.search')}
                      className="h-7 pl-6 pr-2 w-36 text-xs rounded-md border border-input bg-background outline-none focus-visible:border-ring"
                    />
                  </div>
                  <select
                    value={statusFilter}
                    onChange={(e) => handleStatus(e.target.value as UserStatusFilter)}
                    className="h-7 rounded-md border border-input bg-transparent px-2 py-0.5 text-xs outline-none focus-visible:border-ring"
                  >
                    {(['all', 'active', 'inactive', 'pending'] as UserStatusFilter[]).map((s) => (
                      <option key={s} value={s}>{USER_STATUS_LABELS[s]}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {isLoading ? (
              <p className="text-xs text-muted-foreground py-4 text-center">
                {t('companies.loadingUsers')}
              </p>
            ) : isError ? (
              <div className="flex flex-col items-center gap-2 py-4">
                <p className="text-xs text-destructive text-center">
                  {t('companies.errorUsers')}
                </p>
                <button
                  type="button"
                  onClick={() => refetch()}
                  className="text-xs text-primary underline-offset-4 hover:underline"
                >
                  {t('companies.retryUsers')}
                </button>
              </div>
            ) : filtered.length === 0 ? (
              <p className="text-xs text-muted-foreground py-4 text-center">
                {search || statusFilter !== 'all' ? t('common.noResults') : t('companies.noUsers')}
              </p>
            ) : (
              <div className="rounded-md border border-border bg-card overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead className="text-xs py-2.5">{t('common.user')}</TableHead>
                      <TableHead className="text-xs py-2.5">{t('common.status')}</TableHead>
                      <TableHead className="text-xs py-2.5">
                        {t('companies.registrationStatus')}
                      </TableHead>
                      <TableHead className="text-xs py-2.5">{t('common.role')}</TableHead>
                      <TableHead className="w-10 py-2.5" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginated.map((u) => (
                      <TableRow
                        key={u.id}
                        className={isDeleted(u) ? "opacity-50" : ""}
                      >
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <Avatar className="size-8">
                              <AvatarFallback className="text-xs bg-primary/10 text-primary">
                                {initials(u.firstName)}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="text-sm font-medium">
                                {u.firstName} {u.lastName}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {u.email}
                              </p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="py-2.5">
                          {isDeleted(u) ? (
                            <Badge variant="destructive" className="text-xs">
                              {t('common.inactive')}
                            </Badge>
                          ) : (
                            <Badge
                              variant="outline"
                              className="text-xs text-emerald-600 border-emerald-200 bg-emerald-50"
                            >
                              {t('common.active')}
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {u.registrationStatus === "pending_credentials" ? (
                            <Badge variant="default" className="gap-1 text-xs">
                              <ShieldCheck className="size-3" /> {t('companies.pendingCredentials')}
                            </Badge>
                          ) : (
                            <Badge
                              variant="outline"
                              className="text-xs text-emerald-600 border-emerald-200 bg-emerald-50"
                            >
                              <ShieldCheck className="size-3" /> {t('common.registered')}
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="py-2.5">
                          {u.roles.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {u.roles.map((r) => (
                                <Badge key={r.roleId} variant="secondary" className="text-xs">
                                  {r.roleName}
                                </Badge>
                              ))}
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">{t('common.noRole')}</span>
                          )}
                        </TableCell>
                        <TableCell className="py-2.5">
                          <DropdownMenu>
                            <DropdownMenuTrigger
                              aria-label={t('companies.actions.openUserMenu', { name: `${u.firstName} ${u.lastName}` })}
                              className="inline-flex items-center justify-center size-7 rounded-md text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
                            >
                              <MoreHorizontal className="size-3.5" />
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => onEditUser(u)}>
                                <PencilIcon className="size-4" /> {t('companies.actions.editUser')}
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => onToggleUserStatus(u)}>
                                {isDeleted(u) ? (
                                  <>
                                    <CheckIcon className="size-4" /> {t('companies.actions.activateUser')}
                                  </>
                                ) : (
                                  <>
                                    <XIcon className="size-4" /> {t('companies.actions.deactivateUser')}
                                  </>
                                )}
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                className="text-destructive focus:text-destructive"
                                onClick={() => onDeleteUser(u)}
                              >
                                <Trash2 className="size-4" /> {t('companies.actions.deleteUser')}
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {totalPages > 1 && (
                  <div className="flex items-center justify-between px-4 py-2 border-t border-border text-xs text-muted-foreground">
                    <span>{t('common.resultsCount', { count: filtered.length })}</span>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="icon" className="size-6" disabled={safePage <= 1} onClick={() => setPage(safePage - 1)}>
                        <ChevronLeft className="size-3" />
                      </Button>
                      <span className="px-1">{safePage} / {totalPages}</span>
                      <Button variant="ghost" size="icon" className="size-6" disabled={safePage >= totalPages} onClick={() => setPage(safePage + 1)}>
                        <ChevronRight className="size-3" />
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </TableCell>
    </TableRow>
  );
}
