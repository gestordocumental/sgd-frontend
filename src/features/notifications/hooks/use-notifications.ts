import { useEffect } from 'react';
import { useQuery, useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { notificationsApi } from '@/lib/api/notifications';
import { useAuthStore } from '@/store/authStore';
import { decodeJwt } from '@/lib/jwt';

const SSE_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:8000';

export function useNotifications() {
  const queryClient = useQueryClient();
  const accessToken = useAuthStore((s) => s.accessToken);

  // ── SSE connection — ticket-based auth keeps the JWT out of URLs/logs ───────
  useEffect(() => {
    if (!accessToken) return;

    // BroadcastChannel propagates revocation events to all tabs of the same origin,
    // including this one — use-user-profile's bc.onmessage fires on this tab too
    // because it holds a different BroadcastChannel instance on the same channel.
    const bc = new BroadcastChannel('sgd-session');

    let es: EventSource | null = null;
    let retryTimeoutId: ReturnType<typeof setTimeout> | null = null;
    let retryDelayMs = 1_000;
    let active = true;

    const attach = (sse: EventSource) => {
      sse.addEventListener('notification', () => {
        retryDelayMs = 1_000; // Reset backoff on a healthy message
        void queryClient.invalidateQueries({ queryKey: ['notifications-list'] });
        void queryClient.invalidateQueries({ queryKey: ['notifications-unread-count'] });
      });

      // Delegate session revocation to useUserProfile which has the full context
      // (other companies, super-admin token, etc.) to decide the best UX action.
      sse.addEventListener('session-revoked', (e: MessageEvent<string>) => {
        try {
          const payload =
            typeof e.data === 'string' ? (JSON.parse(e.data) as { orgId?: string }) : e.data;
          const currentCompanyId = decodeJwt(accessToken)?.companyId as string | undefined;
          if (payload.orgId && payload.orgId !== currentCompanyId) return;
          // Only post to BroadcastChannel — use-user-profile's bc.onmessage delivers
          // the window event on this tab too (BC delivers to all OTHER instances on
          // the same channel, including the receiver in the same document).
          // Calling window.dispatchEvent here as well would cause a double-fire.
          bc.postMessage({ type: 'sgd:session-revoked', ...payload });
        } catch {
          bc.postMessage({ type: 'sgd:session-revoked' });
        }
      });

      sse.addEventListener('super-admin-revoked', () => {
        bc.postMessage({ type: 'sgd:super-admin-revoked' });
      });

      // Tickets are one-time-use so we manage reconnection ourselves with
      // exponential backoff (max 30s) instead of relying on EventSource auto-retry.
      sse.onerror = () => {
        sse.close();
        es = null;
        if (!active) return;
        retryTimeoutId = setTimeout(() => {
          retryDelayMs = Math.min(retryDelayMs * 2, 30_000);
          void connect();
        }, retryDelayMs);
      };
    };

    const connect = async () => {
      if (!active) return;
      try {
        const { ticket } = await notificationsApi.sseTicket();
        if (!active) return;
        const url = `${SSE_BASE}/notifications/stream?ticket=${encodeURIComponent(ticket)}`;
        es = new EventSource(url);
        attach(es);
      } catch {
        if (!active) return;
        retryTimeoutId = setTimeout(() => {
          retryDelayMs = Math.min(retryDelayMs * 2, 30_000);
          void connect();
        }, retryDelayMs);
      }
    };

    void connect();

    return () => {
      active = false;
      es?.close();
      bc.close();
      if (retryTimeoutId !== null) clearTimeout(retryTimeoutId);
    };
  }, [accessToken, queryClient]);

  // ── Queries — stale time longer since SSE handles freshness ───────────────
  const { data: unreadData } = useQuery({
    queryKey: ['notifications-unread-count'],
    queryFn: notificationsApi.unreadCount,
    staleTime: 60_000,
  });

  const {
    data: listData,
    isLoading,
    hasNextPage,
    fetchNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ['notifications-list'],
    queryFn: ({ pageParam }) => notificationsApi.list(pageParam, 20),
    initialPageParam: 1,
    getNextPageParam: (lastPage) => {
      const totalPages = Math.ceil(lastPage.total / lastPage.limit);
      return lastPage.page < totalPages ? lastPage.page + 1 : undefined;
    },
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

  const notifications = listData?.pages.flatMap((p) => p.data) ?? [];

  return {
    notifications,
    total: listData?.pages.at(-1)?.total ?? 0,
    unreadCount: unreadData?.count ?? 0,
    isLoading,
    hasMore: hasNextPage,
    isFetchingMore: isFetchingNextPage,
    fetchMore: fetchNextPage,
    markAsRead: (id: string) => markAsReadMutation.mutate(id),
    markAllAsRead: () => markAllAsReadMutation.mutate(),
    isMarkingAll: markAllAsReadMutation.isPending,
  };
}
