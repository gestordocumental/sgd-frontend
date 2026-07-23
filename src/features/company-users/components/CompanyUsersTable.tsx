import { useState } from 'react';
import {
  Pencil,
  Trash2,
  RotateCcw,
  MoreHorizontal,
  MailCheck,
  UserPlus,
  Search,
  RefreshCw,
  UserCheck,
  Ban,
  CircleCheck,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Pager } from '@/components/ui/pager';
import { RefreshCountdown } from '@/components/ui/refresh-countdown';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { initials, isDeleted, isPendingRegistration } from '@/lib/formatters';
import type { ApiUserWithRoles } from '@/lib/api/users';
import type { useCompanyUsers } from '@/features/company-users/hooks/use-company-users';
import { useAuthStore } from '@/store/authStore';

type CompanyUsersHook = ReturnType<typeof useCompanyUsers>;
type StatusFilter = 'all' | 'active' | 'inactive' | 'deleted';

const PAGE_SIZE = 20;

interface CompanyUsersTableProps {
  hook: CompanyUsersHook;
  canWrite?: boolean;
}

export function CompanyUsersTable({ hook, canWrite = false }: CompanyUsersTableProps) {
  const {
    users,
    usersLoading,
    usersIsFetching,
    usersDataUpdatedAt,
    refreshUsers,
    openEdit,
    setDeleteUser,
    restoreMutation,
    disableMutation,
    enableMutation,
    resendInvitationMutation,
    toggleOptionalReviewerMutation,
    cargoMap,
  } = hook;
  const { t } = useTranslation();
  const currentUserId = useAuthStore((s) => s.user?.id);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [page, setPage] = useState(1);

  const filtered = users.filter((u) => {
    const q = search.toLowerCase();
    const matchesSearch =
      !q ||
      u.email.toLowerCase().includes(q) ||
      (u.firstName ?? '').toLowerCase().includes(q) ||
      (u.lastName ?? '').toLowerCase().includes(q);

    const isRemoved = !!u.deletedAt || !!u.orgRemovedAt;
    const matchesStatus =
      statusFilter === 'all'
        ? true
        : statusFilter === 'deleted'
          ? isRemoved
          : statusFilter === 'active'
            ? u.isActive && !isRemoved && u.roles.length > 0
            : /* inactive */ (!u.isActive || u.roles.length === 0) && !isRemoved;

    return matchesSearch && matchesStatus;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paginated = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const handleSearch = (v: string) => {
    setSearch(v);
    setPage(1);
  };
  const handleStatus = (v: StatusFilter) => {
    setStatusFilter(v);
    setPage(1);
  };

  const activeCount = users.filter(
    (u) => u.isActive && !u.deletedAt && !u.orgRemovedAt && u.roles.length > 0,
  ).length;

  const STATUS_LABELS: Record<StatusFilter, string> = {
    all: t('common.all'),
    active: t('common.active'),
    inactive: t('common.inactive'),
    deleted: t('common.deleted'),
  };

  return (
    <main className="p-6 space-y-4">
      <div className="rounded-lg border border-border bg-card overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 border-b border-border flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 shrink-0">
            <h2 className="text-sm font-semibold">{t('users.companyUsers')}</h2>
            <div className="flex flex-col items-center gap-0.5">
              <Button
                variant="ghost"
                size="icon"
                className="size-7"
                onClick={refreshUsers}
                disabled={usersIsFetching}
                title={t('common.refresh')}
                aria-label={t('common.refresh')}
              >
                <RefreshCw
                  className={`size-3.5 text-muted-foreground ${usersIsFetching ? 'animate-spin' : ''}`}
                />
              </Button>
              <RefreshCountdown
                duration={60_000}
                isFetching={usersIsFetching}
                updatedAt={usersDataUpdatedAt}
              />
            </div>
          </div>
          <div className="flex items-center gap-2 flex-1 justify-end flex-wrap">
            <span className="text-xs text-muted-foreground shrink-0">
              {t('users.activeCount', { active: activeCount, total: users.length })}
            </span>

            {/* Search */}
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" />
              <Input
                aria-label={t('common.search')}
                value={search}
                onChange={(e) => handleSearch(e.target.value)}
                placeholder={t('common.search')}
                className="h-8 pl-8 w-48 text-sm"
              />
            </div>

            {/* Status filter */}
            <select
              aria-label={t('common.status')}
              value={statusFilter}
              onChange={(e) => handleStatus(e.target.value as StatusFilter)}
              className="h-8 rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm outline-none focus-visible:border-ring"
            >
              {(['all', 'active', 'inactive', 'deleted'] as StatusFilter[]).map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABELS[s]}
                </option>
              ))}
            </select>

            {canWrite && (
              <Button size="sm" onClick={hook.openCreate}>
                <UserPlus className="size-4" />
                {t('dashboard.newUser')}
              </Button>
            )}
          </div>
        </div>

        {/* Table */}
        {usersLoading ? (
          <div className="flex items-center justify-center py-16 text-sm text-muted-foreground">
            {t('users.loading')}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex items-center justify-center py-16 text-sm text-muted-foreground">
            {search || statusFilter !== 'all' ? t('common.noResults') : t('users.empty')}
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('users.userColumn')}</TableHead>
                <TableHead>{t('users.positionColumn')}</TableHead>
                <TableHead>{t('users.rolesColumn')}</TableHead>
                <TableHead>{t('users.registrationStatusColumn')}</TableHead>
                <TableHead>{t('common.status')}</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginated.map((u) => (
                <UserRow
                  key={u.id}
                  user={u}
                  cargoName={u.cargoId ? (cargoMap.get(u.cargoId) ?? '—') : '—'}
                  canWrite={canWrite}
                  isSelf={u.id === currentUserId}
                  onEdit={() => openEdit(u)}
                  onDelete={() => setDeleteUser(u)}
                  onRestore={(user) =>
                    restoreMutation.mutate(user, { onSuccess: () => setStatusFilter('all') })
                  }
                  onDisable={() => disableMutation.mutate(u.id)}
                  onEnable={() => enableMutation.mutate(u.id)}
                  onResendInvitation={() => resendInvitationMutation.mutate(u.id)}
                  onToggleOptionalReviewer={() =>
                    toggleOptionalReviewerMutation.mutate({
                      id: u.id,
                      value: !u.isOptionalReviewer,
                    })
                  }
                />
              ))}
            </TableBody>
          </Table>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <Pager
            page={safePage}
            totalPages={totalPages}
            total={filtered.length}
            onChange={setPage}
            className="px-5 py-3 border-t border-border"
          />
        )}
      </div>
    </main>
  );
}

// ── UserRow ───────────────────────────────────────────────────────────────────

interface UserRowProps {
  user: ApiUserWithRoles;
  cargoName: string;
  canWrite: boolean;
  isSelf: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onRestore: (u: ApiUserWithRoles) => void;
  onDisable: () => void;
  onEnable: () => void;
  onResendInvitation: () => void;
  onToggleOptionalReviewer: () => void;
}

function UserRow({
  user: u,
  cargoName,
  canWrite,
  isSelf,
  onEdit,
  onDelete,
  onRestore: onRestoreUser,
  onDisable,
  onEnable,
  onResendInvitation,
  onToggleOptionalReviewer,
}: UserRowProps) {
  const { t } = useTranslation();
  const isPending = isPendingRegistration(u);
  return (
    <TableRow className={isDeleted(u) || !!u.orgRemovedAt ? 'opacity-50' : ''}>
      <TableCell>
        <div className="flex items-center gap-3">
          <Avatar className="size-8">
            <AvatarFallback className="text-xs bg-primary/10 text-primary">
              {initials(u.firstName)}
            </AvatarFallback>
          </Avatar>
          <div>
            <div className="flex items-center gap-1.5">
              <p className="text-sm font-medium">
                {u.firstName} {u.lastName}
              </p>
              {u.isOptionalReviewer && (
                <Badge
                  variant="outline"
                  className="text-[10px] px-1.5 py-0 text-purple-700 border-purple-200 bg-purple-50"
                >
                  {t('users.optionalReviewer')}
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground">{u.email}</p>
          </div>
        </div>
      </TableCell>
      <TableCell className="text-sm text-muted-foreground">{cargoName}</TableCell>
      <TableCell>
        <div className="flex flex-wrap gap-1">
          {u.roles.length > 0 ? (
            u.roles.map((r) => (
              <Badge key={r.roleId} variant="secondary" className="text-xs">
                {r.roleName}
              </Badge>
            ))
          ) : (
            <span className="text-xs text-muted-foreground">{t('common.noRole')}</span>
          )}
        </div>
      </TableCell>
      <TableCell>
        {isPending ? (
          <Badge variant="default" className="text-xs">
            {t('common.pending')}
          </Badge>
        ) : (
          <Badge
            variant="outline"
            className="text-xs text-emerald-600 border-emerald-200 bg-emerald-50"
          >
            {t('common.registered')}
          </Badge>
        )}
      </TableCell>
      <TableCell>
        {isDeleted(u) || u.orgRemovedAt ? (
          <Badge variant="destructive" className="text-xs">
            {t('common.deleted')}
          </Badge>
        ) : u.roles.length === 0 ? (
          <Badge variant="outline" className="text-xs text-amber-600 border-amber-200 bg-amber-50">
            {t('common.noRole')}
          </Badge>
        ) : u.isActive ? (
          <Badge
            variant="outline"
            className="text-xs text-emerald-600 border-emerald-200 bg-emerald-50"
          >
            {t('common.active')}
          </Badge>
        ) : (
          <Badge variant="outline" className="text-xs text-amber-600 border-amber-200 bg-amber-50">
            {t('common.inactive')}
          </Badge>
        )}
      </TableCell>
      {canWrite && (
        <TableCell>
          <DropdownMenu>
            <DropdownMenuTrigger
              aria-label={t('users.actions.menuLabel', {
                name: [u.firstName, u.lastName].filter(Boolean).join(' ') || u.email,
              })}
              className="inline-flex items-center justify-center size-8 rounded-md text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
            >
              <MoreHorizontal className="size-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {!isDeleted(u) && !u.orgRemovedAt && (
                <>
                  {!isPending && (
                    <DropdownMenuItem onClick={onEdit}>
                      <Pencil className="size-4" /> {t('users.actions.edit')}
                    </DropdownMenuItem>
                  )}
                  {!isSelf && (
                    <>
                      {!isPending && (
                        <>
                          {u.isActive ? (
                            <DropdownMenuItem onClick={onDisable}>
                              <Ban className="size-4" /> {t('users.actions.disable')}
                            </DropdownMenuItem>
                          ) : (
                            <DropdownMenuItem onClick={onEnable}>
                              <CircleCheck className="size-4" /> {t('users.actions.enable')}
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem onClick={onToggleOptionalReviewer}>
                            <UserCheck className="size-4" />
                            {u.isOptionalReviewer
                              ? t('users.actions.removeOptionalReviewer')
                              : t('users.actions.markAsOptionalReviewer')}
                          </DropdownMenuItem>
                        </>
                      )}
                      {isPending && (
                        <DropdownMenuItem onClick={onResendInvitation}>
                          <MailCheck className="size-4" /> {t('users.actions.resendInvitation')}
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        className="text-destructive focus:text-destructive"
                        onClick={onDelete}
                      >
                        <Trash2 className="size-4" /> {t('users.actions.delete')}
                      </DropdownMenuItem>
                    </>
                  )}
                </>
              )}
              {(isDeleted(u) || !!u.orgRemovedAt) && (
                <DropdownMenuItem onClick={() => onRestoreUser(u)}>
                  <RotateCcw className="size-4" /> {t('users.actions.restore')}
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </TableCell>
      )}
    </TableRow>
  );
}
