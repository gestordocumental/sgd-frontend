import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import {
  MoreHorizontal,
  Trash2,
  Search,
  ShieldCheck,
  Pencil as PencilIcon,
  CheckCircle as CheckIcon,
  XCircle as XIcon,
} from 'lucide-react'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Pager } from '@/components/ui/pager'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { usersApi, type ApiUser } from '@/lib/api/users'
import { initials, isDeleted } from '@/lib/formatters'

type UserStatusFilter = 'all' | 'active' | 'inactive' | 'pending'
const USER_PAGE_SIZE = 10

interface CompanyUsersRowProps {
  id: string
  companyId: string
  onEditUser: (u: ApiUser) => void
  onDeleteUser: (u: ApiUser) => void
  onToggleUserStatus: (u: ApiUser) => void
}

export function CompanyUsersRow({
  id,
  companyId,
  onEditUser,
  onDeleteUser,
  onToggleUserStatus,
}: CompanyUsersRowProps) {
  const { t } = useTranslation()
  const { data: users = [], isLoading, isError, refetch } = useQuery({
    queryKey: ['company-users', companyId],
    queryFn: () => usersApi.listUsersByOrg(companyId),
    staleTime: 60_000,
    refetchInterval: 30_000,
    refetchIntervalInBackground: false,
  })

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
                        className={isDeleted(u) ? 'opacity-50' : ''}
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
                          {u.registrationStatus === 'pending_credentials' ? (
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
                  <Pager page={safePage} totalPages={totalPages} total={filtered.length} onChange={setPage} className="px-4 py-2 border-t border-border" />
                )}
              </div>
            )}
          </div>
        </div>
      </TableCell>
    </TableRow>
  )
}
