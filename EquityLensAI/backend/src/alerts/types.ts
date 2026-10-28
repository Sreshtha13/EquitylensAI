import type {
  AlertType,
  AlertRuleConfig,
  SupportedExchange,
  AlertEvent,
} from '@equitylensai/shared';

export interface AlertRuleDbRow {
  id: string;
  user_id: string;
  name: string;
  alert_type: AlertType;
  symbol: string | null;
  exchange: SupportedExchange | null;
  rule_config: AlertRuleConfig;
  enabled: boolean;
  cooldown_minutes: number;
  last_evaluated_at: string | null;
  last_observation_at: string | null;
  last_observed_value: number | string | null;
  last_triggered_at: string | null;
  last_state: string | null;
  created_at: string;
  updated_at: string;
}

export interface AlertEventDbRow {
  id: string;
  rule_id: string;
  user_id: string;
  alert_type: AlertType;
  symbol: string | null;
  exchange: SupportedExchange | null;
  trigger_timestamp: string;
  observed_value: number | string | null;
  threshold_context: Record<string, unknown>;
  source: string;
  deduplication_key: string;
  status: 'triggered' | 'acknowledged' | 'failed';
  created_at: string;
}

export interface AlertEvaluationResult {
  ruleId: string;
  triggered: boolean;
  skipped: boolean;
  reason?: string;
  observedValue?: number | null;
  observationTimestamp?: string;
  event?: AlertEvent;
}

export interface EvaluationJobSummary {
  evaluatedCount: number;
  triggeredCount: number;
  skippedCount: number;
  duplicatesPrevented: number;
  errorsCount: number;
  durationMs: number;
  timestamp: string;
}
