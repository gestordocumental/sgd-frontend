import {
  Users,
  ShieldCheck,
  ShieldOff,
  Pencil,
  Trash2,
  RotateCcw,
  MoreHorizontal,
  MailCheck,
  Search,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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
import { StatCard } from '@/components/ui/stat-card';
import { RefreshCountdown } from '@/components/ui/refresh-countdown';
import { initials, isDeleted } from '@/lib/formatters';
import type { ApiUser } from '@/lib/api/users';
import type { AdminUsersHook } from '@/features/users/hooks/use-admin-users';

type StatusFilter = 'all' | 'active' | 'deleted' | 'pending';

interface UsersTableProps {
  hook: AdminUsersHook;
}

export function UsersTable({ hook }: UsersTableProps) {
  const {
    superAdmins,
    superAdminsTotal,
    superAdminsTotalPages,
    superAdminsLoading,
    superAdminsIsFetching,
    superAdminsDataUpdatedAt,
    refreshSuperAdmins,
    openEdit,
    setDeleteUser,
    restoreMutation,
    toggleSuperAdminMutation,
    resendInvitationMutation,
    saSearch,
    setSaSearch,
    saStatus,
    setSaStatus,
    saPage,
    setSaPage,
  } = hook;
  const { t } = useTranslation();

  // Totals from current page data (accurate only for the fetched slice)
  const totalActive = superAdmins.filter((u) => !isDeleted(u)).length;
  const totalSA = superAdmins.filter((u) => u.isSuperAdmin).length;

  const STATUS_LABELS: Record<StatusFilter, string> = {
    all: t('common.all'),
    active: t('common.active'),
    deleted: t('common.deleted'),
    pending: t('common.pending'),
  };

  return (
    <main className="p-6 space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          title={t('users.totalUsers')}
          value={superAdminsTotal}
          icon={<Users className="size-5 text-muted-foreground" />}
        />
        <StatCard
          title={t('users.activeUsers')}
          value={totalActive}
          icon={<Users className="size-5 text-muted-foreground" />}
        />
        <StatCard
          title={t('users.superAdmins')}
          value={totalSA}
          icon={<ShieldCheck className="size-5 text-muted-foreground" />}
        />
      </div>

      <div className="rounded-lg border border-border bg-card overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 border-b border-border flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2 shrink-0">
            <h2 className="text-sm font-semibold">{t('users.title')}</h2>
            <div className="flex flex-col items-center gap-0.5">
              <Button
                variant="ghost"
                size="icon"
                className="size-7"
                onClick={refreshSuperAdmins}
                disabled={superAdminsIsFetching}
                title={t('common.refresh')}
                aria-label={t('common.refresh')}
              >
                <RefreshCw
                  className={`size-3.5 text-muted-foreground ${superAdminsIsFetching ? 'animate-spin' : ''}`}
                />
              </Button>
              <RefreshCountdown
                duration={60_000}
                isFetching={superAdminsIsFetching}
                updatedAt={superAdminsDataUpdatedAt}
              />
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" />
              <Input
                value={saSearch}
                onChange={(e) => setSaSearch(e.target.value)}
                placeholder={t('common.search')}
                className="h-8 pl-8 w-48 text-sm"
              />
            </div>
            <select
              value={saStatus}
              onChange={(e) => setSaStatus(e.target.value as StatusFilter)}
              className="h-8 rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm outline-none focus-visible:border-ring"
            >
              {(['all', 'active', 'deleted', 'pending'] as StatusFilter[]).map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABELS[s]}
                </option>
              ))}
            </select>
          </div>
        </div>

        {superAdminsLoading ? (
          <div className="flex items-center justify-center py-16 text-sm text-muted-foreground">
            {t('users.loading')}
          </div>
        ) : superAdmins.length === 0 ? (
          <div className="flex items-center justify-center py-16 text-sm text-muted-foreground">
            {saSearch || saStatus !== 'all' ? t('common.noResults') : t('users.empty')}
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('users.userColumn')}</TableHead>
                <TableHead>{t('users.roleColumn')}</TableHead>
                <TableHead>{t('users.registrationColumn')}</TableHead>
                <TableHead>{t('users.statusColumn')}</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {superAdmins.map((u) => (
                <UserRow
                  key={u.id}
                  user={u}
                  onEdit={() => openEdit(u)}
                  onDelete={() => setDeleteUser(u)}
                  onRestore={() => restoreMutation.mutate(u.id)}
                  onToggleSuperAdmin={() =>
                    toggleSuperAdminMutation.mutate({ id: u.id, isSuperAdmin: !u.isSuperAdmin })
                  }
                  onResendInvitation={() => resendInvitationMutation.mutate(u.id)}
                />
              ))}
            </TableBody>
          </Table>
        )}

        {superAdminsTotalPages > 1 && (
          <Pager
            page={saPage}
            totalPages={superAdminsTotalPages}
            total={superAdminsTotal}
            onChange={setSaPage}
          />
        )}
      </div>
    </main>
  );
}

// ── Pager ─────────────────────────────────────────────────────────────────────

function Pager({
  page,
  totalPages,
  total,
  onChange,
}: {
  page: number;
  totalPages: number;
  total: number;
  onChange: (p: number) => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="flex items-center justify-between px-5 py-3 border-t border-border text-sm text-muted-foreground">
      <span>{t('common.resultsCount', { count: total })}</span>
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon"
          className="size-7"
          aria-label={t('common.prevPage')}
          disabled={page <= 1}
          onClick={() => onChange(page - 1)}
        >
          <ChevronLeft className="size-4" />
        </Button>
        <span className="px-2 text-xs">
          {page} / {totalPages}
        </span>
        <Button
          variant="ghost"
          size="icon"
          className="size-7"
          aria-label={t('common.nextPage')}
          disabled={page >= totalPages}
          onClick={() => onChange(page + 1)}
        >
          <ChevronRight className="size-4" />
        </Button>
      </div>
    </div>
  );
}

// ── UserRow ───────────────────────────────────────────────────────────────────

interface UserRowProps {
  user: ApiUser;
  onEdit: () => void;
  onDelete: () => void;
  onRestore: () => void;
  onToggleSuperAdmin: () => void;
  onResendInvitation: () => void;
}

function UserRow({
  user: u,
  onEdit,
  onDelete,
  onRestore,
  onToggleSuperAdmin,
  onResendInvitation,
}: UserRowProps) {
  const { t } = useTranslation();
  return (
    <TableRow className={isDeleted(u) ? 'opacity-50' : ''}>
      <TableCell>
        <div className="flex items-center gap-3">
          <Avatar className="size-8">
            <AvatarFallback className="text-xs bg-primary/10 text-primary">
              {initials(u.firstName)}
            </AvatarFallback>
          </Avatar>
          <div>
            <p className="text-sm font-medium">
              {[u.firstName, u.lastName].filter(Boolean).join(' ') || t('common.unnamed')}
            </p>
            <p className="text-xs text-muted-foreground">{u.email}</p>
          </div>
        </div>
      </TableCell>
      <TableCell>
        {u.isSuperAdmin ? (
          <Badge variant="default" className="gap-1 text-xs">
            <ShieldCheck className="size-3" /> {t('users.superAdmin')}
          </Badge>
        ) : (
          <Badge variant="secondary" className="text-xs">
            {t('users.userBadge')}
          </Badge>
        )}
      </TableCell>
      <TableCell>
        {u.registrationStatus === 'pending_credentials' ? (
          <Badge variant="default" className="gap-1 text-xs">
            <ShieldCheck className="size-3" /> {t('users.pendingCredentials')}
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
      <TableCell>
        {isDeleted(u) ? (
          <Badge variant="destructive" className="text-xs">
            {t('common.deleted')}
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
        <DropdownMenu>
          <DropdownMenuTrigger
            className="inline-flex items-center justify-center size-8 rounded-md text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
            aria-label={t('users.actions.menuLabel', { name: u.firstName ?? u.email })}
          >
            <MoreHorizontal className="size-4" aria-hidden="true" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {!isDeleted(u) && (
              <>
                <DropdownMenuItem onClick={onEdit}>
                  <Pencil className="size-4" /> {t('users.actions.edit')}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={onToggleSuperAdmin}>
                  {u.isSuperAdmin ? (
                    <>
                      <ShieldOff className="size-4" /> {t('users.actions.removeSuperAdmin')}
                    </>
                  ) : (
                    <>
                      <ShieldCheck className="size-4" /> {t('users.actions.grantSuperAdmin')}
                    </>
                  )}
                </DropdownMenuItem>
                {u.registrationStatus === 'pending_credentials' && (
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
            {isDeleted(u) && (
              <DropdownMenuItem onClick={onRestore}>
                <RotateCcw className="size-4" /> {t('users.actions.restore')}
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </TableCell>
    </TableRow>
  );
}
