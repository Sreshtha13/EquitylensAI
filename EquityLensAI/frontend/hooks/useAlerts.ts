import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from './useAuth';
import {
  listAlerts,
  getAlert,
  createAlert,
  updateAlert,
  deleteAlert,
  enableAlert,
  disableAlert,
  listAlertEvents,
  previewAlert,
  getSupportedAlertTypes,
  triggerAlertEvaluation,
  type ListAlertsParams,
  type CreateAlertInput,
  type UpdateAlertInput,
} from '@/services/api/alerts';

export function useAlerts(params: ListAlertsParams = {}) {
  const { isAuthenticated } = useAuth();
  return useQuery({
    queryKey: ['alerts', params],
    queryFn: () => listAlerts(params),
    enabled: isAuthenticated,
  });
}

export function useAlert(alertId?: string) {
  const { isAuthenticated } = useAuth();
  return useQuery({
    queryKey: ['alert', alertId],
    queryFn: () => getAlert(alertId!),
    enabled: isAuthenticated && Boolean(alertId),
  });
}

export function useAlertEvents(alertId?: string, limit = 50) {
  const { isAuthenticated } = useAuth();
  return useQuery({
    queryKey: ['alertEvents', alertId, limit],
    queryFn: () => listAlertEvents(alertId!, limit),
    enabled: isAuthenticated && Boolean(alertId),
  });
}

export function useSupportedAlertTypes() {
  return useQuery({
    queryKey: ['supportedAlertTypes'],
    queryFn: getSupportedAlertTypes,
    staleTime: 60 * 60 * 1000, // 1 hour
  });
}

export function useCreateAlert() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateAlertInput) => createAlert(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alerts'] });
    },
  });
}

export function useUpdateAlert() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ alertId, input }: { alertId: string; input: UpdateAlertInput }) =>
      updateAlert(alertId, input),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['alerts'] });
      queryClient.invalidateQueries({ queryKey: ['alert', variables.alertId] });
    },
  });
}

export function useDeleteAlert() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (alertId: string) => deleteAlert(alertId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alerts'] });
    },
  });
}

export function useToggleAlert() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ alertId, enabled }: { alertId: string; enabled: boolean }) =>
      enabled ? enableAlert(alertId) : disableAlert(alertId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alerts'] });
    },
  });
}

export function usePreviewAlert() {
  return useMutation({
    mutationFn: (input: CreateAlertInput) => previewAlert(input),
  });
}

export function useTriggerAlertEvaluation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => triggerAlertEvaluation(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alerts'] });
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['unreadNotificationsCount'] });
    },
  });
}
