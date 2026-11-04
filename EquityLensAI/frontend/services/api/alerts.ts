import { apiClient } from './client';
import type {
  AlertRule,
  AlertEvent,
  AlertType,
  AlertStatus,
  AlertTriggerType,
  AlertRuleConfig,
  SupportedExchange,
  AlertDashboardStats,
} from '@equitylensai/shared';

export type CreateAlertInput = {
  name: string;
  alertType: AlertType;
  symbol?: string | null | undefined;
  exchange?: SupportedExchange | null | undefined;
  status?: AlertStatus | undefined;
  triggerType?: AlertTriggerType | undefined;
  expiresAt?: string | null | undefined;
  deliveryChannels?: Array<'in_app' | 'email' | 'push'> | undefined;
  cooldownMinutes?: number | undefined;
  ruleConfig: AlertRuleConfig;
};

export type UpdateAlertInput = {
  name?: string | undefined;
  enabled?: boolean | undefined;
  status?: AlertStatus | undefined;
  triggerType?: AlertTriggerType | undefined;
  expiresAt?: string | null | undefined;
  deliveryChannels?: Array<'in_app' | 'email' | 'push'> | undefined;
  cooldownMinutes?: number | undefined;
  ruleConfig?: AlertRuleConfig | undefined;
};

export type ListAlertsParams = {
  alertType?: AlertType | undefined;
  enabled?: boolean | undefined;
  symbol?: string | undefined;
  limit?: number | undefined;
  offset?: number | undefined;
};

export type ListAlertsResponse = {
  rules: AlertRule[];
  total: number;
  limit: number;
  offset: number;
};

export type PreviewAlertResponse = {
  currentObservation: number | null;
  observationTimestamp: string | null;
  conditionSatisfied: boolean;
  explanation: string;
};

export type SupportedTypesResponse = {
  alertTypes: string[];
  alertStatuses: string[];
  triggerTypes: string[];
  priceConditions: string[];
  percentagePeriods: string[];
  percentageDirections: string[];
  rsiConditions: string[];
  macdConditions: string[];
  maConditions: string[];
  highLowConditions: string[];
  circuitConditions: string[];
  corporateActionTypes: string[];
  supportedIndices: string[];
  watchlistEventTypes: string[];
  financialMetrics: string[];
  comparisonOperators: string[];
  notificationCategories: string[];
  announcementCategories: string[];
};

export async function listAlerts(params: ListAlertsParams = {}): Promise<ListAlertsResponse> {
  const query = new URLSearchParams();
  if (params.alertType) query.set('alertType', params.alertType);
  if (params.enabled !== undefined) query.set('enabled', String(params.enabled));
  if (params.symbol) query.set('symbol', params.symbol);
  if (params.limit) query.set('limit', String(params.limit));
  if (params.offset) query.set('offset', String(params.offset));

  const url = `/api/v1/alerts${query.toString() ? `?${query.toString()}` : ''}`;
  return apiClient.get<ListAlertsResponse>(url);
}

export async function getAlertStats(): Promise<AlertDashboardStats> {
  return apiClient.get<AlertDashboardStats>('/api/v1/alerts/stats');
}

export async function getAlert(alertId: string): Promise<AlertRule> {
  return apiClient.get<AlertRule>(`/api/v1/alerts/${alertId}`);
}

export async function createAlert(input: CreateAlertInput): Promise<AlertRule> {
  return apiClient.post<AlertRule>('/api/v1/alerts', input);
}

export async function updateAlert(alertId: string, input: UpdateAlertInput): Promise<AlertRule> {
  return apiClient.patch<AlertRule>(`/api/v1/alerts/${alertId}`, input);
}

export async function deleteAlert(alertId: string): Promise<{ deleted: boolean; alertId: string }> {
  return apiClient.delete<{ deleted: boolean; alertId: string }>(`/api/v1/alerts/${alertId}`);
}

export async function enableAlert(alertId: string): Promise<AlertRule> {
  return apiClient.post<AlertRule>(`/api/v1/alerts/${alertId}/enable`, {});
}

export async function disableAlert(alertId: string): Promise<AlertRule> {
  return apiClient.post<AlertRule>(`/api/v1/alerts/${alertId}/disable`, {});
}

export async function listAlertEvents(
  alertId: string,
  limit = 50,
): Promise<{ events: AlertEvent[]; count: number }> {
  return apiClient.get<{ events: AlertEvent[]; count: number }>(
    `/api/v1/alerts/${alertId}/events?limit=${limit}`,
  );
}

export async function previewAlert(input: CreateAlertInput): Promise<PreviewAlertResponse> {
  return apiClient.post<PreviewAlertResponse>('/api/v1/alerts/preview', input);
}

export async function getSupportedAlertTypes(): Promise<SupportedTypesResponse> {
  return apiClient.get<SupportedTypesResponse>('/api/v1/alerts/supported-types');
}

export async function triggerAlertEvaluation(): Promise<Record<string, unknown>> {
  return apiClient.post<Record<string, unknown>>('/api/v1/alerts/evaluate', {});
}
