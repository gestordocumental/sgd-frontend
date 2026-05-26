import { useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { notificationsApi } from '@/lib/api/notifications';
import { useAuthStore } from '@/store/authStore';
import { decodeJwt } from '@/lib/jwt';

const SSE_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:8000';

export function useNotifications() {
  const queryClient = useQueryClient();
  const accessToken = useAuthStore((s) => s.accessToken);

  // ── SSE connection — server pushes updates, no polling needed ──────────────
  useEffect(() => {
    if (!accessToken) return;

    const url = `${SSE_BASE}/notifications/stream?token=${encodeURIComponent(accessToken)}`;
    const es = new EventSource(url);

    es.addEventListener('notification', () => {
      void queryClient.invalidateQueries({ queryKey: ['notifications-list'] });
      void queryClient.invalidateQueries({ queryKey: ['notifications-unread-count'] });
    });

    // Delegate session revocation to useUserProfile which has the full context
    // (other companies, super-admin token, etc.) to decide the best UX action.
    es.addEventListener('session-revoked', (e: MessageEvent<string>) => {
      try {
        const payload =
          typeof e.data === 'string' ? (JSON.parse(e.data) as { orgId?: string }) : e.data;
        const currentCompanyId = decodeJwt(accessToken)?.companyId as string | undefined;
        if (payload.orgId && payload.orgId !== currentCompanyId) return;
        window.dispatchEvent(new CustomEvent('sgd:session-revoked', { detail: payload }));
      } catch {
        window.dispatchEvent(new CustomEvent('sgd:session-revoked', { detail: {} }));
      }
    });

    es.addEventListener('super-admin-revoked', () => {
      window.dispatchEvent(new CustomEvent('sgd:super-admin-revoked'));
    });

    // EventSource reconnects automatically on error with exponential backoff.
    return () => es.close();
  }, [accessToken, queryClient]);

  // ── Queries — stale time longer since SSE handles freshness ───────────────
  const { data: unreadData } = useQuery({
    queryKey: ['notifications-unread-count'],
    queryFn: notificationsApi.unreadCount,
    staleTime: 60_000,
  });

  const { data: listData, isLoading } = useQuery({
    queryKey: ['notifications-list'],
    queryFn: () => notificationsApi.list(1, 20),
    staleTime: 60_000,
  });

  // ── Mutations ─────────────────────────────────────────────────────────────
  const markAsReadMutation = useMutation({
    mutationFn: notificationsApi.markAsRead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications-list'] });
      queryClient.invalidateQueries({ queryKey: ['notifications-unread-count'] });
    },
  });

  const markAllAsReadMutation = useMutation({
    mutationFn: notificationsApi.markAllAsRead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications-list'] });
      queryClient.invalidateQueries({ queryKey: ['notifications-unread-count'] });
    },
  });

  return {
    notifications: listData?.data ?? [],
    total: listData?.total ?? 0,
    unreadCount: unreadData?.count ?? 0,
    isLoading,
    markAsRead: (id: string) => markAsReadMutation.mutate(id),
    markAllAsRead: () => markAllAsReadMutation.mutate(),
    isMarkingAll: markAllAsReadMutation.isPending,
  };
}
