import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from './useAuth';
import {
  listNotifications,
  getUnreadNotificationsCount,
  markNotificationRead,
  markAllNotificationsRead,
  deleteNotification,
  getAlertPreferences,
  updateAlertPreferences,
  type ListNotificationsParams,
} from '@/services/api/notifications';
import type { UserAlertPreferences } from '@equitylensai/shared';

export function useNotifications(params: ListNotificationsParams = {}) {
  const { isAuthenticated } = useAuth();
  return useQuery({
    queryKey: ['notifications', params],
    queryFn: () => listNotifications(params),
    enabled: isAuthenticated,
  });
}

export function useUnreadNotificationsCount() {
  const { isAuthenticated } = useAuth();
  return useQuery({
    queryKey: ['unreadNotificationsCount'],
    queryFn: getUnreadNotificationsCount,
    enabled: isAuthenticated,
    refetchInterval: 30_000, // poll every 30s
  });
}

export function useMarkNotificationRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (notificationId: string) => markNotificationRead(notificationId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['unreadNotificationsCount'] });
    },
  });
}

export function useMarkAllNotificationsRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => markAllNotificationsRead(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['unreadNotificationsCount'] });
    },
  });
}

export function useDeleteNotification() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (notificationId: string) => deleteNotification(notificationId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['unreadNotificationsCount'] });
    },
  });
}

export function useAlertPreferences() {
  const { isAuthenticated } = useAuth();
  return useQuery({
    queryKey: ['alertPreferences'],
    queryFn: getAlertPreferences,
    enabled: isAuthenticated,
  });
}

export function useUpdateAlertPreferences() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (updates: Partial<UserAlertPreferences>) => updateAlertPreferences(updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alertPreferences'] });
    },
  });
}
