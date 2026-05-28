import { useState } from 'react';
import { Bell, CheckCheck, GitBranch } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button, buttonVariants } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { useNotifications } from '../hooks/use-notifications';
import type { ApiNotification } from '@/lib/api/notifications';

interface SimpleCompany {
  id: string;
  name: string;
}

function timeAgo(dateStr: string, t: (k: string) => string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return t('notifications.justNow');
  if (mins < 60) return t('notifications.minutesAgo').replace('{{n}}', String(mins));
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return t('notifications.hoursAgo').replace('{{n}}', String(hrs));
  const days = Math.floor(hrs / 24);
  return t('notifications.daysAgo').replace('{{n}}', String(days));
}

interface NotificationBellProps {
  onWorkflowClick?: (workflowId: string) => void;
  companies?: SimpleCompany[];
}

export function NotificationBell({ onWorkflowClick, companies = [] }: NotificationBellProps) {
  const { t } = useTranslation();
  const { notifications, unreadCount, isLoading, markAsRead, markAllAsRead, isMarkingAll } =
    useNotifications();
  const [open, setOpen] = useState(false);

  const handleNotificationClick = (n: ApiNotification) => {
    if (!n.read) markAsRead(n.id);
    if (n.workflowId && onWorkflowClick) {
      setOpen(false);
      onWorkflowClick(n.workflowId);
    }
  };

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger
        className={cn(
          buttonVariants({ variant: 'ghost', size: 'icon' }),
          'relative text-muted-foreground',
        )}
        aria-label={t('notifications.label')}
      >
        <Bell className="size-4" />
        {unreadCount > 0 && (
          <span
            className="absolute top-1 right-1 inline-flex h-3.5 min-w-3.5 px-1 items-center justify-center rounded-full text-[9px] text-white font-bold leading-none"
            style={{ backgroundColor: '#0060C5' }}
          >
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-80 p-0" sideOffset={4}>
        {/* Header */}
        <div className="flex items-center justify-between px-3 py-2 border-b border-border">
          <span className="text-sm font-semibold">{t('notifications.title')}</span>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-xs text-muted-foreground"
              onClick={markAllAsRead}
              disabled={isMarkingAll}
            >
              <CheckCheck className="size-3 mr-1" />
              {t('notifications.markAllRead')}
            </Button>
          )}
        </div>

        {/* List */}
        <div className="max-h-96 overflow-y-auto">
          {isLoading ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              {t('common.loading')}
            </div>
          ) : notifications.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              {t('notifications.empty')}
            </div>
          ) : (
            notifications.map((n) => (
              <button
                key={n.id}
                type="button"
                onClick={() => handleNotificationClick(n)}
                className={`w-full text-left flex gap-2.5 px-3 py-2.5 border-b border-border last:border-0 cursor-pointer hover:bg-accent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${!n.read ? 'bg-primary/5' : ''}`}
              >
                <div className="shrink-0 mt-0.5">
                  <div
                    className={`flex items-center justify-center size-7 rounded-full ${!n.read ? 'bg-primary/10' : 'bg-muted'}`}
                  >
                    <GitBranch
                      className={`size-3.5 ${!n.read ? 'text-primary' : 'text-muted-foreground'}`}
                    />
                  </div>
                </div>
                <div className="min-w-0 flex-1">
                  <p className={`text-xs leading-snug ${!n.read ? 'font-medium' : ''}`}>
                    {n.title}
                  </p>
                  <p className="text-xs text-muted-foreground leading-snug mt-0.5 line-clamp-2">
                    {n.message}
                  </p>
                  {n.workflowTitle && (
                    <p className="text-[10px] text-muted-foreground/70 mt-0.5 truncate">
                      {n.workflowTitle}
                    </p>
                  )}
                  <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                    {n.orgId && (n.orgName || companies.find((c) => c.id === n.orgId)) && (
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-medium bg-sky-100 text-sky-700 truncate max-w-[140px]">
                        {n.orgName ?? companies.find((c) => c.id === n.orgId)?.name}
                      </span>
                    )}
                    <p className="text-[10px] text-muted-foreground/60">
                      {timeAgo(n.createdAt, t)}
                    </p>
                  </div>
                </div>
                {!n.read && <div className="shrink-0 mt-1.5 size-1.5 rounded-full bg-primary" />}
              </button>
            ))
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
