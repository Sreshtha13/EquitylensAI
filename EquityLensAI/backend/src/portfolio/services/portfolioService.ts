import { randomUUID } from 'node:crypto';
import type {
  Portfolio,
  PortfolioHolding,
  PortfolioSummary,
  PortfolioAllocation,
  PortfolioPerformance,
  PortfolioPerformanceRange,
  PortfolioTransaction,
  PortfolioTransactionType,
  SupportedCurrency,
  SupportedExchange,
} from '@equitylensai/shared';
import { portfolioRepository } from '../repositories/portfolioRepository.js';
import { portfolioAccountingService } from './portfolioAccountingService.js';
import { portfolioValuationService } from './portfolioValuationService.js';
import { portfolioAllocationService } from './portfolioAllocationService.js';
import { portfolioPerformanceService } from './portfolioPerformanceService.js';
import { portfolioImportExportService, type ImportPreviewRow } from './portfolioImportExportService.js';
import { MarketService } from '../../market/marketService.js';
import { AppError } from '../../utils/appError.js';

export class PortfolioService {
  private marketService = new MarketService();

  // ─── Portfolio CRUD ────────────────────────────────────────────────────────

  async listPortfolios(userId: string): Promise<Portfolio[]> {
    return portfolioRepository.listByUser(userId);
  }

  async getPortfolio(userId: string, portfolioId: string): Promise<Portfolio> {
    const portfolio = await portfolioRepository.getById(portfolioId, userId);
    if (!portfolio) {
      throw new AppError('PORTFOLIO_NOT_FOUND', 'Portfolio not found', 404);
    }
    return portfolio;
  }

  async createPortfolio(
    userId: string,
    data: {
      name: string;
      description?: string | null;
      baseCurrency?: SupportedCurrency;
      isDefault?: boolean;
    },
  ): Promise<Portfolio> {
    const existing = await portfolioRepository.listByUser(userId);
    const duplicate = existing.find(
      (p) => p.name.trim().toLowerCase() === data.name.trim().toLowerCase(),
    );
    if (duplicate) {
      throw new AppError('DUPLICATE_PORTFOLIO_NAME', `Portfolio named "${data.name}" already exists`, 409);
    }

    const now = new Date().toISOString();
    const portfolio: Portfolio = {
      id: randomUUID(),
      userId,
      name: data.name.trim(),
      description: data.description?.trim() || null,
      baseCurrency: data.baseCurrency || 'INR',
      isDefault: Boolean(data.isDefault) || existing.length === 0,
      createdAt: now,
      updatedAt: now,
    };

    return portfolioRepository.create(portfolio);
  }

  async updatePortfolio(
    userId: string,
    portfolioId: string,
    data: {
      name?: string;
      description?: string | null;
      baseCurrency?: SupportedCurrency;
      isDefault?: boolean;
    },
  ): Promise<Portfolio> {
    const existing = await this.getPortfolio(userId, portfolioId);

    if (data.name && data.name.trim().toLowerCase() !== existing.name.toLowerCase()) {
      const userPortfolios = await portfolioRepository.listByUser(userId);
      const duplicate = userPortfolios.find(
        (p) => p.id !== portfolioId && p.name.trim().toLowerCase() === data.name!.trim().toLowerCase(),
      );
      if (duplicate) {
        throw new AppError('DUPLICATE_PORTFOLIO_NAME', `Portfolio named "${data.name}" already exists`, 409);
      }
    }

    const updated = await portfolioRepository.update(portfolioId, userId, {
      name: data.name !== undefined ? data.name.trim() : existing.name,
      description: data.description !== undefined ? data.description : existing.description,
      baseCurrency: data.baseCurrency !== undefined ? data.baseCurrency : existing.baseCurrency,
      isDefault: data.isDefault !== undefined ? data.isDefault : existing.isDefault,
    });

    if (!updated) {
      throw new AppError('PORTFOLIO_NOT_FOUND', 'Portfolio not found', 404);
    }

    return updated;
  }

  async deletePortfolio(userId: string, portfolioId: string): Promise<void> {
    const deleted = await portfolioRepository.delete(portfolioId, userId);
    if (!deleted) {
      throw new AppError('PORTFOLIO_NOT_FOUND', 'Portfolio not found', 404);
    }
  }

  // ─── Transaction Management ────────────────────────────────────────────────

  async listTransactions(
    userId: string,
    portfolioId: string,
    options?: {
      symbol?: string | undefined;
      type?: string | undefined;
      limit?: number | undefined;
      offset?: number | undefined;
    },
  ): Promise<{ transactions: PortfolioTransaction[]; total: number }> {
    await this.getPortfolio(userId, portfolioId); // verify ownership
    return portfolioRepository.listTransactions(portfolioId, userId, options);
  }

  async getTransaction(
    userId: string,
    portfolioId: string,
    transactionId: string,
  ): Promise<PortfolioTransaction> {
    await this.getPortfolio(userId, portfolioId);
    const tx = await portfolioRepository.getTransactionById(transactionId, portfolioId, userId);
    if (!tx) {
      throw new AppError('TRANSACTION_NOT_FOUND', 'Transaction not found', 404);
    }
    return tx;
  }

  async addTransaction(
    userId: string,
    portfolioId: string,
    input: {
      type: PortfolioTransactionType;
      symbol?: string | null;
      exchange?: SupportedExchange | null;
      quantity: number;
      price: number;
      currency?: SupportedCurrency;
      fees?: number;
      taxes?: number;
      tradeDate?: string;
      settlementDate?: string | null;
      notes?: string | null;
      splitRatio?: number | null;
    },
  ): Promise<PortfolioTransaction> {
    const portfolio = await this.getPortfolio(userId, portfolioId);

    const cleanSym = input.symbol?.trim().toUpperCase() || null;
    const cleanExch = cleanSym
      ? ((input.exchange?.trim().toUpperCase() || 'NSE') as SupportedExchange)
      : null;

    // Verify instrument exists for stock-related transaction types
    if (['BUY', 'SELL', 'DIVIDEND', 'SPLIT'].includes(input.type)) {
      if (!cleanSym) {
        throw new AppError('VALIDATION_ERROR', `Transaction type ${input.type} requires a stock symbol`, 400);
      }
      await this.marketService.resolveInstrument({ symbol: cleanSym, exchange: cleanExch || 'NSE' });
    }

    const quantity = Math.abs(input.quantity);
    const price = Math.abs(input.price);
    const fees = Math.abs(input.fees || 0);
    const taxes = Math.abs(input.taxes || 0);
    const currency = input.currency || portfolio.baseCurrency;
    const tradeDate = input.tradeDate ? new Date(input.tradeDate).toISOString() : new Date().toISOString();

    // Prevent short selling
    if (input.type === 'SELL') {
      const existing = await portfolioRepository.getAllTransactionsForPortfolio(portfolioId);
      portfolioAccountingService.validateSellPosition(existing, {
        type: 'SELL',
        symbol: cleanSym,
        exchange: cleanExch,
        quantity,
        tradeDate,
      });
    }

    // Compute total amount based on transaction type
    let totalAmount = 0;
    if (input.type === 'BUY') {
      totalAmount = quantity * price + fees + taxes;
    } else if (input.type === 'SELL') {
      totalAmount = quantity * price - fees - taxes;
    } else if (input.type === 'DIVIDEND') {
      totalAmount = quantity * price > 0 ? quantity * price : price;
    } else if (input.type === 'FEE') {
      totalAmount = fees > 0 ? fees : price;
    } else if (input.type === 'DEPOSIT' || input.type === 'WITHDRAWAL') {
      totalAmount = price > 0 ? price : quantity;
    }

    const now = new Date().toISOString();
    const transaction: PortfolioTransaction = {
      id: randomUUID(),
      portfolioId,
      type: input.type,
      symbol: cleanSym,
      exchange: cleanExch,
      quantity,
      price,
      currency,
      fees,
      taxes,
      totalAmount: Number(totalAmount.toFixed(2)),
      tradeDate,
      settlementDate: input.settlementDate ? new Date(input.settlementDate).toISOString() : null,
      notes: input.notes?.trim() || null,
      splitRatio: input.splitRatio ? Number(input.splitRatio) : null,
      createdAt: now,
      updatedAt: now,
    };

    return portfolioRepository.createTransaction(transaction, userId);
  }

  async updateTransaction(
    userId: string,
    portfolioId: string,
    transactionId: string,
    updates: Partial<{
      type: PortfolioTransactionType;
      symbol: string | null;
      exchange: SupportedExchange | null;
      quantity: number;
      price: number;
      currency: SupportedCurrency;
      fees: number;
      taxes: number;
      tradeDate: string;
      settlementDate: string | null;
      notes: string | null;
      splitRatio: number | null;
    }>,
  ): Promise<PortfolioTransaction> {
    await this.getPortfolio(userId, portfolioId);
    const existing = await this.getTransaction(userId, portfolioId, transactionId);

    const merged = {
      ...existing,
      ...updates,
      quantity: updates.quantity !== undefined ? Math.abs(updates.quantity) : existing.quantity,
      price: updates.price !== undefined ? Math.abs(updates.price) : existing.price,
      fees: updates.fees !== undefined ? Math.abs(updates.fees) : existing.fees,
      taxes: updates.taxes !== undefined ? Math.abs(updates.taxes) : existing.taxes,
    };

    // If SELL, validate prospective position
    if (merged.type === 'SELL') {
      const allTxs = await portfolioRepository.getAllTransactionsForPortfolio(portfolioId);
      portfolioAccountingService.validateSellPosition(allTxs, {
        type: 'SELL',
        symbol: merged.symbol,
        exchange: merged.exchange,
        quantity: merged.quantity,
        tradeDate: merged.tradeDate,
        excludeTxId: transactionId,
      });
    }

    // Recalculate totalAmount
    let totalAmount = 0;
    if (merged.type === 'BUY') {
      totalAmount = merged.quantity * merged.price + merged.fees + merged.taxes;
    } else if (merged.type === 'SELL') {
      totalAmount = merged.quantity * merged.price - merged.fees - merged.taxes;
    } else if (merged.type === 'DIVIDEND') {
      totalAmount = merged.quantity * merged.price > 0 ? merged.quantity * merged.price : merged.price;
    } else if (merged.type === 'FEE') {
      totalAmount = merged.fees > 0 ? merged.fees : merged.price;
    } else if (merged.type === 'DEPOSIT' || merged.type === 'WITHDRAWAL') {
      totalAmount = merged.price > 0 ? merged.price : merged.quantity;
    }
    merged.totalAmount = Number(totalAmount.toFixed(2));

    const updated = await portfolioRepository.updateTransaction(
      transactionId,
      portfolioId,
      userId,
      merged,
    );
    if (!updated) {
      throw new AppError('TRANSACTION_NOT_FOUND', 'Transaction not found', 404);
    }
    return updated;
  }

  async deleteTransaction(userId: string, portfolioId: string, transactionId: string): Promise<void> {
    await this.getPortfolio(userId, portfolioId);
    await this.getTransaction(userId, portfolioId, transactionId);

    // Verify deleting this transaction does not leave future sells negative
    const allTxs = await portfolioRepository.getAllTransactionsForPortfolio(portfolioId);
    const withoutDeleted = allTxs.filter((t) => t.id !== transactionId);

    try {
      const ledger = portfolioAccountingService.reconstructLedger(withoutDeleted);
      for (const [_key, pos] of ledger.positions.entries()) {
        if (pos.quantity < -0.000001) {
          throw new AppError(
            'CANNOT_DELETE_TRANSACTION',
            `Deleting this transaction would result in a negative holding position for ${pos.symbol} in subsequent sales.`,
            400,
          );
        }
      }
    } catch (err) {
      if (err instanceof AppError) throw err;
      throw new AppError('CANNOT_DELETE_TRANSACTION', 'Deleting this transaction violates ledger integrity', 400);
    }

    await portfolioRepository.deleteTransaction(transactionId, portfolioId, userId);
  }

  // ─── Holdings & Valuation ──────────────────────────────────────────────────

  async getHoldings(
    userId: string,
    portfolioId: string,
  ): Promise<{ holdings: PortfolioHolding[]; summary: PortfolioSummary }> {
    const portfolio = await this.getPortfolio(userId, portfolioId);
    const transactions = await portfolioRepository.getAllTransactionsForPortfolio(portfolioId);
    const { holdings, summary } = await portfolioValuationService.evaluatePortfolio(portfolio, transactions);
    return { holdings, summary };
  }

  async getSummary(userId: string, portfolioId: string): Promise<PortfolioSummary> {
    const { summary } = await this.getHoldings(userId, portfolioId);
    return summary;
  }

  // ─── Allocation & Analytics ────────────────────────────────────────────────

  async getAllocation(userId: string, portfolioId: string): Promise<PortfolioAllocation> {
    const { holdings, summary } = await this.getHoldings(userId, portfolioId);
    return portfolioAllocationService.computeAllocation(holdings, summary);
  }

  // ─── Performance ───────────────────────────────────────────────────────────

  async getPerformance(
    userId: string,
    portfolioId: string,
    timeRange: PortfolioPerformanceRange = '1M',
  ): Promise<PortfolioPerformance> {
    const portfolio = await this.getPortfolio(userId, portfolioId);
    const transactions = await portfolioRepository.getAllTransactionsForPortfolio(portfolioId);
    return portfolioPerformanceService.computePerformance(portfolio, transactions, timeRange);
  }

  // ─── CSV Import / Export ───────────────────────────────────────────────────

  async exportTransactionsCsv(userId: string, portfolioId: string): Promise<string> {
    await this.getPortfolio(userId, portfolioId);
    const transactions = await portfolioRepository.getAllTransactionsForPortfolio(portfolioId);
    return portfolioImportExportService.exportToCsv(transactions);
  }

  async previewImportCsv(
    userId: string,
    portfolioId: string,
    csvContent: string,
  ): Promise<{
    previewRows: ImportPreviewRow[];
    totalRows: number;
    validRowsCount: number;
    invalidRowsCount: number;
    batchId: string;
  }> {
    const portfolio = await this.getPortfolio(userId, portfolioId);
    const existing = await portfolioRepository.getAllTransactionsForPortfolio(portfolioId);
    return portfolioImportExportService.parseAndPreviewCsv(
      csvContent,
      existing,
      portfolio.baseCurrency,
    );
  }

  async confirmImport(
    userId: string,
    portfolioId: string,
    rows: ImportPreviewRow[],
    batchId: string,
  ): Promise<PortfolioTransaction[]> {
    await this.getPortfolio(userId, portfolioId);
    return portfolioImportExportService.confirmImport(portfolioId, userId, rows, batchId);
  }
}

export const portfolioService = new PortfolioService();
