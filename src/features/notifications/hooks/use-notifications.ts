import { useEffect } from 'react';
import { useQuery, useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { notificationsApi } from '@/lib/api/notifications';
import { useAuthStore } from '@/store/authStore';
import { decodeJwt } from '@/lib/jwt';

const SSE_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:8000';
const BACKOFF_INITIAL_MS = 1_000;
const BACKOFF_MAX_MS = 30_000;

// ±25 % randomisation spreads out reconnect storms when a Railway redeploy
// drops all SSE connections simultaneously (thundering-herd mitigation).
function withJitter(ms: number): number {
  return ms * (0.75 + Math.random() * 0.5);
}

export function useNotifications() {
  const queryClient = useQueryClient();
  const accessToken = useAuthStore((s) => s.accessToken);

  const decoded = accessToken ? decodeJwt(accessToken) : null;
  const userId = decoded?.sub as string | undefined;
  const companyId = decoded?.companyId as string | undefined;

  // ── SSE connection — ticket-based auth keeps the JWT out of URLs/logs ───────
  useEffect(() => {
    if (!accessToken) return;

    // BroadcastChannel propagates revocation events to all tabs of the same origin,
    // including this one — use-user-profile's bc.onmessage fires on this tab too
    // because it holds a different BroadcastChannel instance on the same channel.
    const bc = new BroadcastChannel('sgd-session');

    let es: EventSource | null = null;
    let retryTimeoutId: ReturnType<typeof setTimeout> | null = null;
    let retryDelayMs = BACKOFF_INITIAL_MS;
    let active = true;
    // Prevents a second connect() from racing with an in-flight ticket fetch.
    let isConnecting = false;

    const scheduleRetry = () => {
      if (!active) return;
      // Clear any pre-existing timer so onerror firing multiple times never
      // stacks up duplicate setTimeout calls.
      if (retryTimeoutId !== null) clearTimeout(retryTimeoutId);
      retryTimeoutId = setTimeout(() => {
        retryTimeoutId = null;
        retryDelayMs = Math.min(retryDelayMs * 2, BACKOFF_MAX_MS);
        void connect();
      }, withJitter(retryDelayMs));
    };

    const attach = (sse: EventSource) => {
      sse.addEventListener('notification', () => {
        retryDelayMs = BACKOFF_INITIAL_MS; // reset backoff on a healthy message
        void queryClient.invalidateQueries({ queryKey: ['notifications-list', userId, companyId] });
        void queryClient.invalidateQueries({
          queryKey: ['notifications-unread-count', userId, companyId],
        });
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
      // exponential backoff (max 30 s) instead of relying on EventSource auto-retry.
      sse.onerror = () => {
        sse.close();
        es = null;
        scheduleRetry();
      };
    };

    const connect = async () => {
      // Guard: skip if unmounted, already connecting, or already connected.
      if (!active || isConnecting || es) return;
      isConnecting = true;
      try {
        const { ticket } = await notificationsApi.sseTicket();
        if (!active) return;
        es = new EventSource(
          `${SSE_BASE}/notifications/stream?ticket=${encodeURIComponent(ticket)}`,
        );
        attach(es);
      } catch {
        if (!active) return;
        scheduleRetry();
      } finally {
        isConnecting = false;
      }
    };

    // Cancel any pending backoff timer and reconnect immediately when the
    // browser reports network recovery (e.g. user reconnects to WiFi).
    const handleOnline = () => {
      if (!active || es || isConnecting) return;
      if (retryTimeoutId !== null) {
        clearTimeout(retryTimeoutId);
        retryTimeoutId = null;
      }
      retryDelayMs = BACKOFF_INITIAL_MS; // reset backoff on network recovery
      void connect();
    };

    // When the user returns to a tab where the SSE connection silently died,
    // reconnect immediately rather than waiting for the next backoff tick.
    const handleVisibilityChange = () => {
      if (document.visibilityState !== 'visible' || !active || es || isConnecting) return;
      if (retryTimeoutId !== null) {
        clearTimeout(retryTimeoutId);
        retryTimeoutId = null;
      }
      void connect();
    };

    window.addEventListener('online', handleOnline);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    void connect();

    return () => {
      active = false;
      es?.close();
      es = null;
      bc.close();
      if (retryTimeoutId !== null) clearTimeout(retryTimeoutId);
      window.removeEventListener('online', handleOnline);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [accessToken, queryClient, userId, companyId]);

  // ── Queries ────────────────────────────────────────────────────────────────
  const { data: unreadData } = useQuery({
    queryKey: ['notifications-unread-count', userId, companyId],
    queryFn: ({ signal }) => notificationsApi.unreadCount(signal),
    staleTime: 30_000,
    enabled: !!accessToken,
  });

  const {
    data: listData,
    isLoading,
    hasNextPage,
    fetchNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ['notifications-list', userId, companyId],
    queryFn: ({ pageParam, signal }) => notificationsApi.list(pageParam, 20, signal),
    initialPageParam: 1,
    getNextPageParam: (lastPage) => {
      const totalPages = Math.ceil(lastPage.total / lastPage.limit);
      return lastPage.page < totalPages ? lastPage.page + 1 : undefined;
    },
    staleTime: 30_000,
    enabled: !!accessToken,
  });

  // ── Mutations ─────────────────────────────────────────────────────────────
  const markAsReadMutation = useMutation({
    mutationFn: notificationsApi.markAsRead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications-list', userId, companyId] });
      queryClient.invalidateQueries({
        queryKey: ['notifications-unread-count', userId, companyId],
      });
    },
  });

  const markAllAsReadMutation = useMutation({
    mutationFn: notificationsApi.markAllAsRead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications-list', userId, companyId] });
      queryClient.invalidateQueries({
        queryKey: ['notifications-unread-count', userId, companyId],
      });
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
