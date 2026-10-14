import type { HealthStatus } from '../types/http.js';

export function getHealthStatus(): HealthStatus {
  return {
    status: 'ok',
    service: 'equitylensai-api',
    timestamp: new Date().toISOString(),
  };
}
