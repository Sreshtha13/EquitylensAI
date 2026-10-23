import { getEnv } from '../../config/index.js';
import { logger } from '../../utils/logger.js';
import type {
  Portfolio,
  PortfolioTransaction,
  PortfolioSnapshot,
  SupportedCurrency,
  SupportedExchange,
} from '@equitylensai/shared';
import type {
  PortfolioDbRow,
  PortfolioTransactionDbRow,
  PortfolioSnapshotDbRow,
} from '../types.js';

class MemoryPortfolioStore {
  portfolios = new Map<string, Portfolio>();
  transactions = new Map<string, PortfolioTransaction & { userId: string }>();
  snapshots = new Map<string, PortfolioSnapshot>();

  clear(): void {
    this.portfolios.clear();
    this.transactions.clear();
    this.snapshots.clear();
  }
}

export const memoryPortfolioStore = new MemoryPortfolioStore();

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

function mapPortfolioRowToDomain(row: PortfolioDbRow): Portfolio {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    description: row.description ?? null,
    baseCurrency: row.base_currency,
    isDefault: Boolean(row.is_default),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapTransactionRowToDomain(row: PortfolioTransactionDbRow): PortfolioTransaction {
  return {
    id: row.id,
    portfolioId: row.portfolio_id,
    type: row.type,
    symbol: row.symbol ?? null,
    exchange: row.exchange ? (row.exchange as SupportedExchange) : null,
    quantity: Number(row.quantity),
    price: Number(row.price),
    currency: row.currency,
    fees: Number(row.fees ?? 0),
    taxes: Number(row.taxes ?? 0),
    totalAmount: Number(row.total_amount),
    tradeDate: row.trade_date,
    settlementDate: row.settlement_date ?? null,
    notes: row.notes ?? null,
    splitRatio: row.split_ratio !== null ? Number(row.split_ratio) : null,
    externalReference: row.external_reference ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapSnapshotRowToDomain(row: PortfolioSnapshotDbRow): PortfolioSnapshot {
  return {
    id: row.id,
    portfolioId: row.portfolio_id,
    valuationDate: row.valuation_date,
    holdingsValue: Number(row.holdings_value),
    cashBalance: Number(row.cash_balance),
    totalValue: Number(row.total_value),
    totalCostBasis: Number(row.total_cost_basis),
    realizedPnL: Number(row.realized_pnl),
    unrealizedPnL: Number(row.unrealized_pnl),
    currency: row.currency,
    coveragePercent: Number(row.coverage_percent),
    createdAt: row.created_at,
  };
}

export const portfolioRepository = {
  // ─── Portfolios ────────────────────────────────────────────────────────────

  async listByUser(userId: string): Promise<Portfolio[]> {
    const env = getEnv();
    if (env.NODE_ENV !== 'test') {
      const { data, ok } = await supabaseRest<PortfolioDbRow[]>(
        `portfolios?user_id=eq.${encodeURIComponent(userId)}&order=created_at.asc`,
      );
      if (ok && data) {
        return data.map(mapPortfolioRowToDomain);
      }
    }

    return Array.from(memoryPortfolioStore.portfolios.values())
      .filter((p) => p.userId === userId)
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  },

  async getById(id: string, userId: string): Promise<Portfolio | null> {
    const env = getEnv();
    if (env.NODE_ENV !== 'test') {
      const { data, ok } = await supabaseRest<PortfolioDbRow[]>(
        `portfolios?id=eq.${encodeURIComponent(id)}&user_id=eq.${encodeURIComponent(userId)}&limit=1`,
      );
      if (ok && data && data.length > 0 && data[0]) {
        return mapPortfolioRowToDomain(data[0]);
      }
    }

    const item = memoryPortfolioStore.portfolios.get(id);
    if (item && item.userId === userId) {
      return item;
    }
    return null;
  },

  async create(portfolio: Portfolio): Promise<Portfolio> {
    const env = getEnv();
    memoryPortfolioStore.portfolios.set(portfolio.id, portfolio);

    if (env.NODE_ENV !== 'test') {
      await supabaseRest('portfolios', {
        method: 'POST',
        headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
        body: JSON.stringify({
          id: portfolio.id,
          user_id: portfolio.userId,
          name: portfolio.name,
          description: portfolio.description,
          base_currency: portfolio.baseCurrency,
          is_default: portfolio.isDefault,
          created_at: portfolio.createdAt,
          updated_at: portfolio.updatedAt,
        }),
      });
    }

    return portfolio;
  },

  async update(
    id: string,
    userId: string,
    updates: Partial<Portfolio>,
  ): Promise<Portfolio | null> {
    const existing = await this.getById(id, userId);
    if (!existing) return null;

    const updated: Portfolio = {
      ...existing,
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    memoryPortfolioStore.portfolios.set(id, updated);

    const env = getEnv();
    if (env.NODE_ENV !== 'test') {
      await supabaseRest(
        `portfolios?id=eq.${encodeURIComponent(id)}&user_id=eq.${encodeURIComponent(userId)}`,
        {
          method: 'PATCH',
          headers: { Prefer: 'return=minimal' },
          body: JSON.stringify({
            name: updated.name,
            description: updated.description,
            base_currency: updated.baseCurrency,
            is_default: updated.isDefault,
            updated_at: updated.updatedAt,
          }),
        },
      );
    }

    return updated;
  },

  async delete(id: string, userId: string): Promise<boolean> {
    const existing = await this.getById(id, userId);
    if (!existing) return false;

    memoryPortfolioStore.portfolios.delete(id);
    // Cascade delete transactions from memory
    for (const [txId, tx] of memoryPortfolioStore.transactions.entries()) {
      if (tx.portfolioId === id) {
        memoryPortfolioStore.transactions.delete(txId);
      }
    }

    const env = getEnv();
    if (env.NODE_ENV !== 'test') {
      await supabaseRest(
        `portfolios?id=eq.${encodeURIComponent(id)}&user_id=eq.${encodeURIComponent(userId)}`,
        { method: 'DELETE' },
      );
    }

    return true;
  },

  // ─── Transactions ──────────────────────────────────────────────────────────

  async listTransactions(
    portfolioId: string,
    userId: string,
    options?: {
      symbol?: string | undefined;
      type?: string | undefined;
      limit?: number | undefined;
      offset?: number | undefined;
    },
  ): Promise<{ transactions: PortfolioTransaction[]; total: number }> {
    const env = getEnv();
    if (env.NODE_ENV !== 'test') {
      let query = `portfolio_transactions?portfolio_id=eq.${encodeURIComponent(portfolioId)}&user_id=eq.${encodeURIComponent(userId)}`;
      if (options?.symbol) {
        query += `&symbol=eq.${encodeURIComponent(options.symbol.toUpperCase())}`;
      }
      if (options?.type) {
        query += `&type=eq.${encodeURIComponent(options.type)}`;
      }
      query += `&order=trade_date.desc,created_at.desc`;

      const limit = options?.limit ?? 50;
      const offset = options?.offset ?? 0;
      query += `&limit=${limit}&offset=${offset}`;

      const { data, ok } = await supabaseRest<PortfolioTransactionDbRow[]>(query, {
        headers: { Prefer: 'count=exact' },
      });

      if (ok && data) {
        return {
          transactions: data.map(mapTransactionRowToDomain),
          total: data.length, // approximation if headers count not parsed
        };
      }
    }

    const all = Array.from(memoryPortfolioStore.transactions.values())
      .filter((tx) => tx.portfolioId === portfolioId && tx.userId === userId)
      .filter((tx) => (!options?.symbol ? true : tx.symbol?.toUpperCase() === options.symbol.toUpperCase()))
      .filter((tx) => (!options?.type ? true : tx.type === options.type))
      .sort((a, b) => new Date(b.tradeDate).getTime() - new Date(a.tradeDate).getTime());

    const total = all.length;
    const limit = options?.limit ?? 50;
    const offset = options?.offset ?? 0;
    const page = all.slice(offset, offset + limit);

    return {
      transactions: page.map(({ userId: _u, ...rest }) => rest),
      total,
    };
  },

  async getAllTransactionsForPortfolio(portfolioId: string): Promise<PortfolioTransaction[]> {
    const env = getEnv();
    if (env.NODE_ENV !== 'test') {
      const { data, ok } = await supabaseRest<PortfolioTransactionDbRow[]>(
        `portfolio_transactions?portfolio_id=eq.${encodeURIComponent(portfolioId)}&order=trade_date.asc,created_at.asc`,
      );
      if (ok && data) {
        return data.map(mapTransactionRowToDomain);
      }
    }

    return Array.from(memoryPortfolioStore.transactions.values())
      .filter((tx) => tx.portfolioId === portfolioId)
      .sort((a, b) => new Date(a.tradeDate).getTime() - new Date(b.tradeDate).getTime())
      .map(({ userId: _u, ...rest }) => rest);
  },

  async getTransactionById(
    id: string,
    portfolioId: string,
    userId: string,
  ): Promise<PortfolioTransaction | null> {
    const env = getEnv();
    if (env.NODE_ENV !== 'test') {
      const { data, ok } = await supabaseRest<PortfolioTransactionDbRow[]>(
        `portfolio_transactions?id=eq.${encodeURIComponent(id)}&portfolio_id=eq.${encodeURIComponent(portfolioId)}&user_id=eq.${encodeURIComponent(userId)}&limit=1`,
      );
      if (ok && data && data.length > 0 && data[0]) {
        return mapTransactionRowToDomain(data[0]);
      }
    }

    const tx = memoryPortfolioStore.transactions.get(id);
    if (tx && tx.portfolioId === portfolioId && tx.userId === userId) {
      const { userId: _u, ...rest } = tx;
      return rest;
    }
    return null;
  },

  async createTransaction(
    transaction: PortfolioTransaction,
    userId: string,
  ): Promise<PortfolioTransaction> {
    memoryPortfolioStore.transactions.set(transaction.id, { ...transaction, userId });

    const env = getEnv();
    if (env.NODE_ENV !== 'test') {
      await supabaseRest('portfolio_transactions', {
        method: 'POST',
        headers: { Prefer: 'return=minimal' },
        body: JSON.stringify({
          id: transaction.id,
          portfolio_id: transaction.portfolioId,
          user_id: userId,
          type: transaction.type,
          symbol: transaction.symbol,
          exchange: transaction.exchange,
          quantity: transaction.quantity,
          price: transaction.price,
          currency: transaction.currency,
          fees: transaction.fees,
          taxes: transaction.taxes,
          total_amount: transaction.totalAmount,
          trade_date: transaction.tradeDate,
          settlement_date: transaction.settlementDate,
          notes: transaction.notes,
          split_ratio: transaction.splitRatio,
          external_reference: transaction.externalReference,
          created_at: transaction.createdAt,
          updated_at: transaction.updatedAt,
        }),
      });
    }

    return transaction;
  },

  async createTransactionsBatch(
    transactions: PortfolioTransaction[],
    userId: string,
  ): Promise<PortfolioTransaction[]> {
    for (const tx of transactions) {
      memoryPortfolioStore.transactions.set(tx.id, { ...tx, userId });
    }

    const env = getEnv();
    if (env.NODE_ENV !== 'test' && transactions.length > 0) {
      await supabaseRest('portfolio_transactions', {
        method: 'POST',
        headers: { Prefer: 'return=minimal' },
        body: JSON.stringify(
          transactions.map((tx) => ({
            id: tx.id,
            portfolio_id: tx.portfolioId,
            user_id: userId,
            type: tx.type,
            symbol: tx.symbol,
            exchange: tx.exchange,
            quantity: tx.quantity,
            price: tx.price,
            currency: tx.currency,
            fees: tx.fees,
            taxes: tx.taxes,
            total_amount: tx.totalAmount,
            trade_date: tx.tradeDate,
            settlement_date: tx.settlementDate,
            notes: tx.notes,
            split_ratio: tx.splitRatio,
            external_reference: tx.externalReference,
            created_at: tx.createdAt,
            updated_at: tx.updatedAt,
          })),
        ),
      });
    }

    return transactions;
  },

  async updateTransaction(
    id: string,
    portfolioId: string,
    userId: string,
    updates: Partial<PortfolioTransaction>,
  ): Promise<PortfolioTransaction | null> {
    const existing = await this.getTransactionById(id, portfolioId, userId);
    if (!existing) return null;

    const updated: PortfolioTransaction = {
      ...existing,
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    memoryPortfolioStore.transactions.set(id, { ...updated, userId });

    const env = getEnv();
    if (env.NODE_ENV !== 'test') {
      await supabaseRest(
        `portfolio_transactions?id=eq.${encodeURIComponent(id)}&portfolio_id=eq.${encodeURIComponent(portfolioId)}&user_id=eq.${encodeURIComponent(userId)}`,
        {
          method: 'PATCH',
          headers: { Prefer: 'return=minimal' },
          body: JSON.stringify({
            type: updated.type,
            symbol: updated.symbol,
            exchange: updated.exchange,
            quantity: updated.quantity,
            price: updated.price,
            currency: updated.currency,
            fees: updated.fees,
            taxes: updated.taxes,
            total_amount: updated.totalAmount,
            trade_date: updated.tradeDate,
            settlement_date: updated.settlementDate,
            notes: updated.notes,
            split_ratio: updated.splitRatio,
            external_reference: updated.externalReference,
            updated_at: updated.updatedAt,
          }),
        },
      );
    }

    return updated;
  },

  async deleteTransaction(id: string, portfolioId: string, userId: string): Promise<boolean> {
    const existing = await this.getTransactionById(id, portfolioId, userId);
    if (!existing) return false;

    memoryPortfolioStore.transactions.delete(id);

    const env = getEnv();
    if (env.NODE_ENV !== 'test') {
      await supabaseRest(
        `portfolio_transactions?id=eq.${encodeURIComponent(id)}&portfolio_id=eq.${encodeURIComponent(portfolioId)}&user_id=eq.${encodeURIComponent(userId)}`,
        { method: 'DELETE' },
      );
    }

    return true;
  },

  // ─── Snapshots ─────────────────────────────────────────────────────────────

  async saveSnapshot(snapshot: PortfolioSnapshot): Promise<PortfolioSnapshot> {
    memoryPortfolioStore.snapshots.set(snapshot.id, snapshot);

    const env = getEnv();
    if (env.NODE_ENV !== 'test') {
      await supabaseRest('portfolio_snapshots?on_conflict=portfolio_id,valuation_date', {
        method: 'POST',
        headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
        body: JSON.stringify({
          id: snapshot.id,
          portfolio_id: snapshot.portfolioId,
          valuation_date: snapshot.valuationDate,
          holdings_value: snapshot.holdingsValue,
          cash_balance: snapshot.cashBalance,
          total_value: snapshot.totalValue,
          total_cost_basis: snapshot.totalCostBasis,
          realized_pnl: snapshot.realizedPnL,
          unrealized_pnl: snapshot.unrealizedPnL,
          currency: snapshot.currency,
          coverage_percent: snapshot.coveragePercent,
          created_at: snapshot.createdAt,
        }),
      });
    }

    return snapshot;
  },

  async getSnapshots(
    portfolioId: string,
    fromDate?: string,
    toDate?: string,
  ): Promise<PortfolioSnapshot[]> {
    const env = getEnv();
    if (env.NODE_ENV !== 'test') {
      let query = `portfolio_snapshots?portfolio_id=eq.${encodeURIComponent(portfolioId)}`;
      if (fromDate) query += `&valuation_date=gte.${fromDate}`;
      if (toDate) query += `&valuation_date=lte.${toDate}`;
      query += `&order=valuation_date.asc`;

      const { data, ok } = await supabaseRest<PortfolioSnapshotDbRow[]>(query);
      if (ok && data) {
        return data.map(mapSnapshotRowToDomain);
      }
    }

    return Array.from(memoryPortfolioStore.snapshots.values())
      .filter((s) => s.portfolioId === portfolioId)
      .filter((s) => (!fromDate ? true : s.valuationDate >= fromDate))
      .filter((s) => (!toDate ? true : s.valuationDate <= toDate))
      .sort((a, b) => a.valuationDate.localeCompare(b.valuationDate));
  },
};
