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
  RefreshCw,
  Ban,
  CircleCheck,
} from 'lucide-react';
import { useRef, useEffect } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { TableCell, TableHead, TableRow } from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Pager } from '@/components/ui/pager';
import { StatCard } from '@/components/ui/stat-card';
import { RefreshCountdown } from '@/components/ui/refresh-countdown';
import { initials, isDeleted, isPendingRegistration } from '@/lib/formatters';
import type { ApiUser } from '@/lib/api/users';
import type { AdminUsersHook } from '@/features/users/hooks/use-admin-users';
import { useAuthStore } from '@/store/authStore';

type StatusFilter = 'all' | 'active' | 'inactive' | 'deleted' | 'pending';

interface UsersTableProps {
  hook: AdminUsersHook;
}

export function UsersTable({ hook }: UsersTableProps) {
  const {
    superAdmins,
    superAdminsLoading,
    superAdminsIsFetching,
    superAdminsDataUpdatedAt,
    refreshSuperAdmins,
    openEdit,
    setDeleteUser,
    restoreMutation,
    disableMutation,
    enableMutation,
    toggleSuperAdminMutation,
    resendInvitationMutation,
    saSearch,
    setSaSearch,
    saStatus,
    setSaStatus,
    saPage,
    setSaPage,
    superAdminsTotalPages,
  } = hook;
  const { t } = useTranslation();
  const currentUserId = useAuthStore((s) => s.user?.id);
  const parentRef = useRef<HTMLDivElement>(null);

  // eslint-disable-next-line react-hooks/incompatible-library
  const rowVirtualizer = useVirtualizer({
    count: superAdmins.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 60,
    overscan: 5,
  });

  useEffect(() => {
    parentRef.current?.scrollTo({ top: 0 });
  }, [saPage, saSearch, saStatus]);

  const STATUS_LABELS: Record<StatusFilter, string> = {
    all: t('common.all'),
    active: t('common.active'),
    inactive: t('common.inactive'),
    deleted: t('common.deleted'),
    pending: t('common.pending'),
  };

  return (
    <main className="p-6 space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          title={t('users.totalUsers')}
          value={superAdmins.length}
          icon={<Users className="size-5 text-muted-foreground" />}
        />
        <StatCard
          title={t('users.activeUsers')}
          value={superAdmins.filter((u) => !u.deletedAt && u.isActive).length}
          icon={<ShieldCheck className="size-5 text-muted-foreground" />}
        />
        <StatCard
          title={t('users.inactiveUsers')}
          value={superAdmins.filter((u) => !u.deletedAt && !u.isActive).length}
          icon={<ShieldOff className="size-5 text-muted-foreground" />}
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
              {(['all', 'active', 'inactive', 'deleted', 'pending'] as StatusFilter[]).map((s) => (
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
          (() => {
            const virtualItems = rowVirtualizer.getVirtualItems();
            const totalSize = rowVirtualizer.getTotalSize();
            const paddingTop = virtualItems.length > 0 ? virtualItems[0].start : 0;
            const paddingBottom =
              virtualItems.length > 0 ? totalSize - virtualItems[virtualItems.length - 1].end : 0;
            return (
              <div
                ref={parentRef}
                className="overflow-y-auto overflow-x-auto"
                style={{ maxHeight: 'calc(100vh - 360px)' }}
              >
                <table className="w-full caption-bottom text-sm">
                  <thead className="sticky top-0 z-10 bg-card [&_tr]:border-b">
                    <TableRow>
                      <TableHead>{t('users.userColumn')}</TableHead>
                      <TableHead>{t('users.roleColumn')}</TableHead>
                      <TableHead>{t('users.registrationColumn')}</TableHead>
                      <TableHead>{t('users.statusColumn')}</TableHead>
                      <TableHead className="w-10" />
                    </TableRow>
                  </thead>
                  <tbody className="[&_tr:last-child]:border-0">
                    {paddingTop > 0 && (
                      <tr style={{ height: paddingTop }}>
                        <td colSpan={5} style={{ padding: 0, border: 'none' }} />
                      </tr>
                    )}
                    {virtualItems.map((vr) => {
                      const u = superAdmins[vr.index];
                      return (
                        <UserRow
                          key={u.id}
                          user={u}
                          isSelf={u.id === currentUserId}
                          onEdit={() => openEdit(u)}
                          onDelete={() => setDeleteUser(u)}
                          onRestore={() => restoreMutation.mutate(u.id)}
                          onDisable={() => disableMutation.mutate(u.id)}
                          onEnable={() => enableMutation.mutate(u.id)}
                          onToggleSuperAdmin={() =>
                            toggleSuperAdminMutation.mutate({
                              id: u.id,
                              isSuperAdmin: !u.isSuperAdmin,
                            })
                          }
                          onResendInvitation={() => resendInvitationMutation.mutate(u.id)}
                        />
                      );
                    })}
                    {paddingBottom > 0 && (
                      <tr style={{ height: paddingBottom }}>
                        <td colSpan={5} style={{ padding: 0, border: 'none' }} />
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            );
          })()
        )}

        {superAdminsTotalPages > 1 && (
          <Pager
            page={saPage}
            totalPages={superAdminsTotalPages}
            onChange={setSaPage}
            className="px-5 py-3 border-t border-border"
          />
        )}
      </div>
    </main>
  );
}

// ── UserRow ───────────────────────────────────────────────────────────────────

interface UserRowProps {
  user: ApiUser;
  isSelf: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onRestore: () => void;
  onDisable: () => void;
  onEnable: () => void;
  onToggleSuperAdmin: () => void;
  onResendInvitation: () => void;
}

function UserRow({
  user: u,
  isSelf,
  onEdit,
  onDelete,
  onRestore,
  onDisable,
  onEnable,
  onToggleSuperAdmin,
  onResendInvitation,
}: UserRowProps) {
  const { t } = useTranslation();
  const isPending = isPendingRegistration(u);
  const fullName = [u.firstName, u.lastName].filter(Boolean).join(' ');
  return (
    <TableRow className={isDeleted(u) ? 'opacity-50' : ''}>
      <TableCell>
        <div className="flex items-center gap-3">
          <Avatar className="size-8">
            {u.avatarUrl && <AvatarImage src={u.avatarUrl} alt={fullName} />}
            <AvatarFallback className="text-xs bg-primary/10 text-primary">
              {initials(u.firstName)}
            </AvatarFallback>
          </Avatar>
          <div>
            <p className="text-sm font-medium">{fullName || t('common.unnamed')}</p>
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
        {isPending ? (
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
                        <DropdownMenuItem onClick={onToggleSuperAdmin}>
                          {u.isSuperAdmin ? (
                            <>
                              <ShieldOff className="size-4" /> {t('users.actions.removeSuperAdmin')}
                            </>
                          ) : (
                            <>
                              <ShieldCheck className="size-4" />{' '}
                              {t('users.actions.grantSuperAdmin')}
                            </>
                          )}
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
