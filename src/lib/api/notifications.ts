import { apiClient } from './client';

export interface ApiNotification {
  id: string;
  userId: string;
  type: string;
  title: string;
  message: string;
  orgId: string | null;
  orgName: string | null;
  workflowId: string | null;
  workflowTitle: string | null;
  read: boolean;
  readAt: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

export interface PaginatedNotifications {
  data: ApiNotification[];
  total: number;
  page: number;
  limit: number;
}

export const notificationsApi = {
  list: (page = 1, limit = 20): Promise<PaginatedNotifications> =>
    apiClient
      .get<PaginatedNotifications>('/notifications', { params: { page, limit } })
      .then((r) => r.data),

  unreadCount: (): Promise<{ count: number }> =>
    apiClient.get<{ count: number }>('/notifications/unread-count').then((r) => r.data),

  markAsRead: (id: string): Promise<ApiNotification> =>
    apiClient.patch<ApiNotification>(`/notifications/${id}/read`).then((r) => r.data),

  markAllAsRead: (): Promise<{ updated: number }> =>
    apiClient.patch<{ updated: number }>('/notifications/read-all').then((r) => r.data),

  /** Exchange the current JWT (sent in the Authorization header by apiClient) for a
   *  short-lived, one-time-use ticket. The ticket is then passed as a query param to
   *  the SSE endpoint so the full JWT never appears in URLs or access logs. */
  sseTicket: (): Promise<{ ticket: string; expiresIn: number }> =>
    apiClient
      .post<{ ticket: string; expiresIn: number }>('/notifications/stream/ticket')
      .then((r) => r.data),
};
