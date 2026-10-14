import type { HealthStatus } from '@/types';
import { apiClient } from './client';

export function getHealth(signal?: AbortSignal): Promise<HealthStatus> {
  return apiClient.get<HealthStatus>('/api/v1/health', signal ? { signal } : undefined);
}
