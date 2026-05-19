import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { notificationsApi } from '@/lib/api/notifications'

export function useNotifications() {
  const queryClient = useQueryClient()

  const { data: unreadData } = useQuery({
    queryKey: ['notifications-unread-count'],
    queryFn: notificationsApi.unreadCount,
    refetchInterval: 30_000,
    staleTime: 15_000,
  })

  const { data: listData, isLoading } = useQuery({
    queryKey: ['notifications-list'],
    queryFn: () => notificationsApi.list(1, 20),
    staleTime: 15_000,
    refetchInterval: 30_000,
  })

  const markAsReadMutation = useMutation({
    mutationFn: notificationsApi.markAsRead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications-list'] })
      queryClient.invalidateQueries({ queryKey: ['notifications-unread-count'] })
    },
  })

  const markAllAsReadMutation = useMutation({
    mutationFn: notificationsApi.markAllAsRead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications-list'] })
      queryClient.invalidateQueries({ queryKey: ['notifications-unread-count'] })
    },
  })

  return {
    notifications: listData?.data ?? [],
    total: listData?.total ?? 0,
    unreadCount: unreadData?.count ?? 0,
    isLoading,
    markAsRead: (id: string) => markAsReadMutation.mutate(id),
    markAllAsRead: () => markAllAsReadMutation.mutate(),
    isMarkingAll: markAllAsReadMutation.isPending,
  }
}
