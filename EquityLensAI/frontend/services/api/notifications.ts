import { apiClient } from './client';
import type {
  AppNotification,
  UserAlertPreferences,
  NotificationCategory,
} from '@equitylensai/shared';

export type ListNotificationsParams = {
  unreadOnly?: boolean | undefined;
  category?: NotificationCategory | undefined;
  limit?: number | undefined;
  offset?: number | undefined;
};

export type ListNotificationsResponse = {
  items: AppNotification[];
  total: number;
  unreadCount: number;
  limit: number;
  offset: number;
};

export async function listNotifications(
  params: ListNotificationsParams = {},
): Promise<ListNotificationsResponse> {
  const query = new URLSearchParams();
  if (params.unreadOnly !== undefined) query.set('unreadOnly', String(params.unreadOnly));
  if (params.category) query.set('category', params.category);
  if (params.limit) query.set('limit', String(params.limit));
  if (params.offset) query.set('offset', String(params.offset));

  const url = `/api/v1/notifications${query.toString() ? `?${query.toString()}` : ''}`;
  return apiClient.get<ListNotificationsResponse>(url);
}

export async function getUnreadNotificationsCount(): Promise<{ unreadCount: number }> {
  return apiClient.get<{ unreadCount: number }>('/api/v1/notifications/unread-count');
}

export async function markNotificationRead(
  notificationId: string,
): Promise<{ markedRead: boolean; notificationId: string }> {
  return apiClient.patch<{ markedRead: boolean; notificationId: string }>(
    `/api/v1/notifications/${notificationId}/read`,
  );
}

export async function markAllNotificationsRead(): Promise<{ markedRead: number }> {
  return apiClient.patch<{ markedRead: number }>('/api/v1/notifications/read-all');
}

export async function deleteNotification(
  notificationId: string,
): Promise<{ deleted: boolean; notificationId: string }> {
  return apiClient.delete<{ deleted: boolean; notificationId: string }>(
    `/api/v1/notifications/${notificationId}`,
  );
}

export async function getAlertPreferences(): Promise<UserAlertPreferences> {
  return apiClient.get<UserAlertPreferences>('/api/v1/notifications/preferences');
}

export async function updateAlertPreferences(
  updates: Partial<UserAlertPreferences>,
): Promise<UserAlertPreferences> {
  return apiClient.patch<UserAlertPreferences>('/api/v1/notifications/preferences', updates);
}
