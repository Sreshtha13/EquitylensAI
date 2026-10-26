import { getEnv } from '../../config/index.js';
import { logger } from '../../utils/logger.js';
import type { AlertRule, AlertEvent, AlertRuleConfig, SupportedExchange } from '@equitylensai/shared';
import type { AlertRuleDbRow, AlertEventDbRow } from '../types.js';

class MemoryAlertStore {
  rules = new Map<string, AlertRule>(); // ruleId -> AlertRule
  events = new Map<string, AlertEvent>(); // eventId -> AlertEvent
  eventsByDedupKey = new Map<string, string>(); // dedupKey -> eventId

  clear(): void {
    this.rules.clear();
    this.events.clear();
    this.eventsByDedupKey.clear();
  }
}

export const memoryAlertStore = new MemoryAlertStore();

async function supabaseRest<T>(
  resource: string,
  init: RequestInit = {},
): Promise<{ data: T | null; status: number; ok: boolean }> {
  const env = getEnv();
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    return { data: null, status: 503, ok: false };
  }

  const url = `${env.SUPABASE_URL.replace(/\/+$/, '')}/rest/v1/${resource}`;
  const headers = new Headers(init.headers);
  headers.set('apikey', env.SUPABASE_SERVICE_ROLE_KEY);
  headers.set('Authorization', `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`);
  headers.set('Content-Type', 'application/json');

  try {
    const res = await fetch(url, {
      ...init,
      headers,
      signal: init.signal ?? AbortSignal.timeout(10_000),
    });

    if (!res.ok) {
      return { data: null, status: res.status, ok: false };
    }

    const text = await res.text();
    const data = text.trim().length > 0 ? (JSON.parse(text) as T) : null;
    return { data, status: res.status, ok: true };
  } catch (error) {
    logger.debug({ error, resource }, 'Supabase PostgREST request failed, using memory store');
    return { data: null, status: 500, ok: false };
  }
}

function mapRuleRowToDomain(row: AlertRuleDbRow): AlertRule {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    alertType: row.alert_type,
    symbol: row.symbol,
    exchange: row.exchange,
    ruleConfig: row.rule_config,
    enabled: Boolean(row.enabled),
    cooldownMinutes: Number(row.cooldown_minutes ?? 60),
    lastEvaluatedAt: row.last_evaluated_at,
    lastObservationAt: row.last_observation_at,
    lastObservedValue: row.last_observed_value !== null ? Number(row.last_observed_value) : null,
    lastTriggeredAt: row.last_triggered_at,
    lastState: row.last_state,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapEventRowToDomain(row: AlertEventDbRow): AlertEvent {
  return {
    id: row.id,
    ruleId: row.rule_id,
    userId: row.user_id,
    alertType: row.alert_type,
    symbol: row.symbol,
    exchange: row.exchange,
    triggerTimestamp: row.trigger_timestamp,
    observedValue: row.observed_value !== null ? Number(row.observed_value) : null,
    thresholdContext: row.threshold_context ?? {},
    source: row.source,
    deduplicationKey: row.deduplication_key,
    status: row.status,
    createdAt: row.created_at,
  };
}

export const alertRepository = {
  async createRule(rule: AlertRule): Promise<AlertRule> {
    memoryAlertStore.rules.set(rule.id, rule);

    const env = getEnv();
    if (env.NODE_ENV !== 'test') {
      await supabaseRest('alert_rules', {
        method: 'POST',
        headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
        body: JSON.stringify({
          id: rule.id,
          user_id: rule.userId,
          name: rule.name,
          alert_type: rule.alertType,
          symbol: rule.symbol,
          exchange: rule.exchange,
          rule_config: rule.ruleConfig,
          enabled: rule.enabled,
          cooldown_minutes: rule.cooldownMinutes,
          last_evaluated_at: rule.lastEvaluatedAt,
          last_observation_at: rule.lastObservationAt,
          last_observed_value: rule.lastObservedValue,
          last_triggered_at: rule.lastTriggeredAt,
          last_state: rule.lastState,
          created_at: rule.createdAt,
          updated_at: rule.updatedAt,
        }),
      });
    }

    return rule;
  },

  async getRuleById(ruleId: string, userId: string): Promise<AlertRule | null> {
    const env = getEnv();
    if (env.NODE_ENV !== 'test') {
      const { data, ok } = await supabaseRest<AlertRuleDbRow[]>(
        `alert_rules?id=eq.${encodeURIComponent(ruleId)}&user_id=eq.${encodeURIComponent(userId)}&limit=1`,
      );
      if (ok && data && data.length > 0) {
        return mapRuleRowToDomain(data[0]!);
      }
    }

    const rule = memoryAlertStore.rules.get(ruleId);
    if (rule && rule.userId === userId) {
      return rule;
    }
    return null;
  },

  async listRules(
    userId: string,
    filters?: {
      alertType?: string | undefined;
      enabled?: boolean | undefined;
      symbol?: string | undefined;
      limit?: number | undefined;
      offset?: number | undefined;
    },
  ): Promise<{ rules: AlertRule[]; total: number }> {
    const env = getEnv();
    if (env.NODE_ENV !== 'test') {
      let query = `alert_rules?user_id=eq.${encodeURIComponent(userId)}&order=created_at.desc`;
      if (filters?.alertType) {
        query += `&alert_type=eq.${encodeURIComponent(filters.alertType)}`;
      }
      if (typeof filters?.enabled === 'boolean') {
        query += `&enabled=eq.${filters.enabled}`;
      }
      if (filters?.symbol) {
        query += `&symbol=eq.${encodeURIComponent(filters.symbol.toUpperCase())}`;
      }
      if (filters?.limit) {
        query += `&limit=${filters.limit}`;
      }
      if (filters?.offset) {
        query += `&offset=${filters.offset}`;
      }

      const { data, ok } = await supabaseRest<AlertRuleDbRow[]>(query, {
        headers: { Prefer: 'count=exact' },
      });
      if (ok && data) {
        const rules = data.map(mapRuleRowToDomain);
        return { rules, total: rules.length };
      }
    }

    let rules = Array.from(memoryAlertStore.rules.values()).filter((r) => r.userId === userId);
    if (filters?.alertType) {
      rules = rules.filter((r) => r.alertType === filters.alertType);
    }
    if (typeof filters?.enabled === 'boolean') {
      rules = rules.filter((r) => r.enabled === filters.enabled);
    }
    if (filters?.symbol) {
      rules = rules.filter((r) => r.symbol?.toUpperCase() === filters.symbol?.toUpperCase());
    }

    rules.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    const total = rules.length;
    const offset = filters?.offset ?? 0;
    const limit = filters?.limit ?? 50;
    rules = rules.slice(offset, offset + limit);

    return { rules, total };
  },

  async updateRule(
    ruleId: string,
    userId: string,
    updates: Partial<AlertRule>,
  ): Promise<AlertRule | null> {
    const existing = await this.getRuleById(ruleId, userId);
    if (!existing) {
      return null;
    }

    const updated: AlertRule = {
      ...existing,
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    memoryAlertStore.rules.set(ruleId, updated);

    const env = getEnv();
    if (env.NODE_ENV !== 'test') {
      const dbUpdates: Partial<AlertRuleDbRow> = {
        updated_at: updated.updatedAt,
      };
      if (updates.name !== undefined) dbUpdates.name = updates.name;
      if (updates.ruleConfig !== undefined) dbUpdates.rule_config = updates.ruleConfig;
      if (updates.enabled !== undefined) dbUpdates.enabled = updates.enabled;
      if (updates.cooldownMinutes !== undefined) dbUpdates.cooldown_minutes = updates.cooldownMinutes;
      if (updates.lastEvaluatedAt !== undefined) dbUpdates.last_evaluated_at = updates.lastEvaluatedAt;
      if (updates.lastObservationAt !== undefined) dbUpdates.last_observation_at = updates.lastObservationAt;
      if (updates.lastObservedValue !== undefined) dbUpdates.last_observed_value = updates.lastObservedValue;
      if (updates.lastTriggeredAt !== undefined) dbUpdates.last_triggered_at = updates.lastTriggeredAt;
      if (updates.lastState !== undefined) dbUpdates.last_state = updates.lastState;

      await supabaseRest(
        `alert_rules?id=eq.${encodeURIComponent(ruleId)}&user_id=eq.${encodeURIComponent(userId)}`,
        {
          method: 'PATCH',
          body: JSON.stringify(dbUpdates),
        },
      );
    }

    return updated;
  },

  async deleteRule(ruleId: string, userId: string): Promise<boolean> {
    const existing = await this.getRuleById(ruleId, userId);
    if (!existing) {
      return false;
    }

    memoryAlertStore.rules.delete(ruleId);

    // Also delete events belonging to this rule in memory
    for (const [eventId, event] of memoryAlertStore.events.entries()) {
      if (event.ruleId === ruleId) {
        memoryAlertStore.events.delete(eventId);
        memoryAlertStore.eventsByDedupKey.delete(event.deduplicationKey);
      }
    }

    const env = getEnv();
    if (env.NODE_ENV !== 'test') {
      await supabaseRest(
        `alert_rules?id=eq.${encodeURIComponent(ruleId)}&user_id=eq.${encodeURIComponent(userId)}`,
        {
          method: 'DELETE',
        },
      );
    }

    return true;
  },

  async getAllEnabledRules(options?: { alertType?: string | undefined }): Promise<AlertRule[]> {
    const env = getEnv();
    if (env.NODE_ENV !== 'test') {
      let query = `alert_rules?enabled=eq.true`;
      if (options?.alertType) {
        query += `&alert_type=eq.${encodeURIComponent(options.alertType)}`;
      }
      const { data, ok } = await supabaseRest<AlertRuleDbRow[]>(query);
      if (ok && data) {
        return data.map(mapRuleRowToDomain);
      }
    }

    let rules = Array.from(memoryAlertStore.rules.values()).filter((r) => r.enabled);
    if (options?.alertType) {
      rules = rules.filter((r) => r.alertType === options.alertType);
    }
    return rules;
  },

  async countActiveRulesByUser(userId: string): Promise<number> {
    const env = getEnv();
    if (env.NODE_ENV !== 'test') {
      const { data, ok } = await supabaseRest<Array<{ id: string }>>(
        `alert_rules?user_id=eq.${encodeURIComponent(userId)}&enabled=eq.true&select=id`,
      );
      if (ok && data) {
        return data.length;
      }
    }

    return Array.from(memoryAlertStore.rules.values()).filter(
      (r) => r.userId === userId && r.enabled,
    ).length;
  },

  async createEvent(event: AlertEvent): Promise<{ event: AlertEvent; created: boolean }> {
    // Idempotency check via deduplication key
    if (memoryAlertStore.eventsByDedupKey.has(event.deduplicationKey)) {
      const existingId = memoryAlertStore.eventsByDedupKey.get(event.deduplicationKey)!;
      const existingEvent = memoryAlertStore.events.get(existingId);
      return { event: existingEvent ?? event, created: false };
    }

    memoryAlertStore.events.set(event.id, event);
    memoryAlertStore.eventsByDedupKey.set(event.deduplicationKey, event.id);

    const env = getEnv();
    if (env.NODE_ENV !== 'test') {
      const res = await supabaseRest<AlertEventDbRow[]>('alert_events', {
        method: 'POST',
        headers: { Prefer: 'resolution=ignore-duplicates,return=representation' },
        body: JSON.stringify({
          id: event.id,
          rule_id: event.ruleId,
          user_id: event.userId,
          alert_type: event.alertType,
          symbol: event.symbol,
          exchange: event.exchange,
          trigger_timestamp: event.triggerTimestamp,
          observed_value: event.observedValue,
          threshold_context: event.thresholdContext,
          source: event.source,
          deduplication_key: event.deduplicationKey,
          status: event.status,
          created_at: event.createdAt,
        }),
      });

      if (res.ok && res.data && res.data.length > 0) {
        return { event: mapEventRowToDomain(res.data[0]!), created: true };
      }
    }

    return { event, created: true };
  },

  async listEventsByRule(ruleId: string, userId: string, limit = 50): Promise<AlertEvent[]> {
    const env = getEnv();
    if (env.NODE_ENV !== 'test') {
      const { data, ok } = await supabaseRest<AlertEventDbRow[]>(
        `alert_events?rule_id=eq.${encodeURIComponent(ruleId)}&user_id=eq.${encodeURIComponent(userId)}&order=trigger_timestamp.desc&limit=${limit}`,
      );
      if (ok && data) {
        return data.map(mapEventRowToDomain);
      }
    }

    return Array.from(memoryAlertStore.events.values())
      .filter((e) => e.ruleId === ruleId && e.userId === userId)
      .sort((a, b) => new Date(b.triggerTimestamp).getTime() - new Date(a.triggerTimestamp).getTime())
      .slice(0, limit);
  },

  async listEventsByUser(userId: string, limit = 50): Promise<AlertEvent[]> {
    const env = getEnv();
    if (env.NODE_ENV !== 'test') {
      const { data, ok } = await supabaseRest<AlertEventDbRow[]>(
        `alert_events?user_id=eq.${encodeURIComponent(userId)}&order=trigger_timestamp.desc&limit=${limit}`,
      );
      if (ok && data) {
        return data.map(mapEventRowToDomain);
      }
    }

    return Array.from(memoryAlertStore.events.values())
      .filter((e) => e.userId === userId)
      .sort((a, b) => new Date(b.triggerTimestamp).getTime() - new Date(a.triggerTimestamp).getTime())
      .slice(0, limit);
  },
};
