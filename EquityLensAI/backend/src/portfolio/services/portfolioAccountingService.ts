import type {
  PortfolioTransaction,
  PortfolioHolding,
  SupportedExchange,
} from '@equitylensai/shared';
import { AppError } from '../../utils/appError.js';

export interface ComputedPosition {
  symbol: string;
  exchange: SupportedExchange;
  quantity: number;
  averageBuyPrice: number;
  totalCostBasis: number;
  realizedPnL: number;
  dividendIncome: number;
  currency: string;
}

export interface ReconstructedLedger {
  positions: Map<string, ComputedPosition>; // key: `${symbol}:${exchange}`
  cashBalance: number;
  totalRealizedPnL: number;
  totalDividends: number;
  totalFees: number;
  totalDeposits: number;
  totalWithdrawals: number;
  netInvestedCapital: number;
}

export class PortfolioAccountingService {
  /**
   * Generates a unique key for an instrument within a portfolio.
   */
  makeKey(symbol: string, exchange: string): string {
    return `${symbol.trim().toUpperCase()}:${exchange.trim().toUpperCase()}`;
  }

  /**
   * Reconstructs the entire portfolio state sequentially from chronological transactions.
   */
  reconstructLedger(transactions: PortfolioTransaction[]): ReconstructedLedger {
    // Sort transactions chronologically: tradeDate asc, then createdAt asc
    const sorted = [...transactions].sort((a, b) => {
      const timeDiff = new Date(a.tradeDate).getTime() - new Date(b.tradeDate).getTime();
      if (timeDiff !== 0) return timeDiff;
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    });

    const positions = new Map<string, ComputedPosition>();
    let cashBalance = 0;
    let totalRealizedPnL = 0;
    let totalDividends = 0;
    let totalFees = 0;
    let totalDeposits = 0;
    let totalWithdrawals = 0;

    for (const tx of sorted) {
      const symbol = tx.symbol?.trim().toUpperCase();
      const exchange = (tx.exchange?.trim().toUpperCase() || 'NSE') as SupportedExchange;
      const key = symbol ? this.makeKey(symbol, exchange) : null;

      switch (tx.type) {
        case 'DEPOSIT': {
          const amt = tx.totalAmount || tx.quantity * tx.price || 0;
          cashBalance += amt;
          totalDeposits += amt;
          break;
        }

        case 'WITHDRAWAL': {
          const amt = tx.totalAmount || tx.quantity * tx.price || 0;
          cashBalance -= amt;
          totalWithdrawals += amt;
          break;
        }

        case 'FEE': {
          const amt = tx.fees || tx.totalAmount || 0;
          cashBalance -= amt;
          totalFees += amt;
          break;
        }

        case 'DIVIDEND': {
          const netDiv = tx.totalAmount || tx.quantity * tx.price || 0;
          cashBalance += netDiv;
          totalDividends += netDiv;

          if (key) {
            const pos = positions.get(key) || {
              symbol: symbol!,
              exchange,
              quantity: 0,
              averageBuyPrice: 0,
              totalCostBasis: 0,
              realizedPnL: 0,
              dividendIncome: 0,
              currency: tx.currency,
            };
            pos.dividendIncome += netDiv;
            positions.set(key, pos);
          }
          break;
        }

        case 'BUY': {
          if (!symbol || !key) break;
          const fees = tx.fees || 0;
          const taxes = tx.taxes || 0;
          const tradeCost = tx.quantity * tx.price + fees + taxes;

          cashBalance -= tradeCost;

          const existing = positions.get(key) || {
            symbol,
            exchange,
            quantity: 0,
            averageBuyPrice: 0,
            totalCostBasis: 0,
            realizedPnL: 0,
            dividendIncome: 0,
            currency: tx.currency,
          };

          const newQty = existing.quantity + tx.quantity;
          const newCostBasis = existing.totalCostBasis + tradeCost;
          const avgPrice = newQty > 0 ? newCostBasis / newQty : 0;

          positions.set(key, {
            ...existing,
            quantity: newQty,
            totalCostBasis: newCostBasis,
            averageBuyPrice: avgPrice,
          });
          break;
        }

        case 'SELL': {
          if (!symbol || !key) break;
          const fees = tx.fees || 0;
          const taxes = tx.taxes || 0;
          const netProceeds = tx.quantity * tx.price - fees - taxes;

          cashBalance += netProceeds;

          const existing = positions.get(key);
          const currentQty = existing ? existing.quantity : 0;

          if (tx.quantity > currentQty + 0.000001) {
            // Oversell detected during replay; clamp to available to prevent negative holdings
            const soldQty = Math.max(0, currentQty);
            const soldCostBasis = existing ? (soldQty / (existing.quantity || 1)) * existing.totalCostBasis : 0;
            const pnl = netProceeds - soldCostBasis;
            totalRealizedPnL += pnl;

            if (existing) {
              positions.set(key, {
                ...existing,
                quantity: 0,
                totalCostBasis: 0,
                averageBuyPrice: 0,
                realizedPnL: existing.realizedPnL + pnl,
              });
            }
          } else {
            const soldCostBasis = (tx.quantity / existing!.quantity) * existing!.totalCostBasis;
            const pnl = netProceeds - soldCostBasis;
            totalRealizedPnL += pnl;

            const remainingQty = existing!.quantity - tx.quantity;
            const remainingCostBasis = existing!.totalCostBasis - soldCostBasis;
            const avgPrice = remainingQty > 0.000001 ? remainingCostBasis / remainingQty : 0;

            positions.set(key, {
              ...existing!,
              quantity: remainingQty > 0.000001 ? remainingQty : 0,
              totalCostBasis: remainingQty > 0.000001 ? remainingCostBasis : 0,
              averageBuyPrice: avgPrice,
              realizedPnL: existing!.realizedPnL + pnl,
            });
          }
          break;
        }

        case 'SPLIT': {
          if (!symbol || !key || !tx.splitRatio || tx.splitRatio <= 0) break;
          const existing = positions.get(key);
          if (existing && existing.quantity > 0) {
            const ratio = tx.splitRatio;
            const newQty = existing.quantity * ratio;
            const avgPrice = newQty > 0 ? existing.totalCostBasis / newQty : 0;

            positions.set(key, {
              ...existing,
              quantity: newQty,
              averageBuyPrice: avgPrice,
              // totalCostBasis remains unchanged on a corporate stock split
            });
          }
          break;
        }
      }
    }

    const netInvestedCapital = totalDeposits - totalWithdrawals;

    return {
      positions,
      cashBalance,
      totalRealizedPnL,
      totalDividends,
      totalFees,
      totalDeposits,
      totalWithdrawals,
      netInvestedCapital,
    };
  }

  /**
   * Validates whether a prospective SELL transaction is valid given prior transactions.
   * Throws 400 AppError if the sell quantity exceeds available holdings.
   */
  validateSellPosition(
    existingTransactions: PortfolioTransaction[],
    candidateTx: {
      type: string;
      symbol?: string | null;
      exchange?: string | null;
      quantity: number;
      tradeDate: string;
      excludeTxId?: string;
    },
  ): void {
    if (candidateTx.type !== 'SELL') return;
    if (!candidateTx.symbol) {
      throw new AppError('VALIDATION_ERROR', 'Sell transaction requires an instrument symbol', 400);
    }

    const filtered = existingTransactions.filter((t) => t.id !== candidateTx.excludeTxId);
    const ledger = this.reconstructLedger(filtered);
    const exchange = (candidateTx.exchange || 'NSE') as SupportedExchange;
    const key = this.makeKey(candidateTx.symbol, exchange);

    const position = ledger.positions.get(key);
    const availableQty = position ? position.quantity : 0;

    if (candidateTx.quantity > availableQty + 0.000001) {
      throw new AppError(
        'INSUFFICIENT_HOLDINGS',
        `Cannot sell ${candidateTx.quantity} units of ${candidateTx.symbol}. Available position: ${availableQty.toFixed(4)}. Short selling is not permitted.`,
        400,
        {
          details: {
            symbol: candidateTx.symbol,
            availableQuantity: availableQty,
            requestedQuantity: candidateTx.quantity,
          },
        },
      );
    }
  }

  /**
   * Converts computed positions with market quote data into user-facing PortfolioHoldings.
   */
  buildHoldings(
    positions: Map<string, ComputedPosition>,
    quotesMap: Map<string, { price: number | null; freshness: string; source: string; observedAt: string; isStale: boolean }>,
    ratesMap: Map<string, number>, // quote currency -> base currency rate
    baseCurrency: string,
  ): { holdings: PortfolioHolding[]; unpricedCount: number; totalHoldingsMarketValue: number } {
    const holdings: PortfolioHolding[] = [];
    let unpricedCount = 0;
    let totalHoldingsMarketValue = 0;

    for (const [key, pos] of positions.entries()) {
      // Only include holdings with non-zero quantity
      if (pos.quantity <= 0.000001) continue;

      const quote = quotesMap.get(key);
      const rawPrice = quote?.price ?? null;
      const unpriced = rawPrice === null || rawPrice === undefined;
      if (unpriced) {
        unpricedCount++;
      }

      // Currency conversion factor (if holding currency != baseCurrency)
      const fxRate = pos.currency === baseCurrency ? 1.0 : (ratesMap.get(`${pos.currency}_${baseCurrency}`) ?? 1.0);

      const currentPrice = rawPrice !== null ? rawPrice * fxRate : null;
      const marketValue = currentPrice !== null ? pos.quantity * currentPrice : null;

      if (marketValue !== null) {
        totalHoldingsMarketValue += marketValue;
      }

      // Unrealized P&L = Market Value - Remaining Cost Basis (converted)
      // pos.totalCostBasis is in holding's transaction currency
      const convertedCostBasis = pos.totalCostBasis * fxRate;
      const unrealizedPnL = marketValue !== null ? marketValue - convertedCostBasis : null;
      const unrealizedPnLPercent =
        unrealizedPnL !== null && convertedCostBasis > 0
          ? (unrealizedPnL / convertedCostBasis) * 100
          : null;

      holdings.push({
        symbol: pos.symbol,
        exchange: pos.exchange,
        name: pos.symbol, // to be populated by caller from instrument master
        assetType: 'equity',
        quantity: Number(pos.quantity.toFixed(4)),
        averageBuyPrice: Number(pos.averageBuyPrice.toFixed(4)),
        totalCostBasis: Number(convertedCostBasis.toFixed(2)),
        currentPrice: currentPrice !== null ? Number(currentPrice.toFixed(2)) : null,
        currency: baseCurrency,
        marketValue: marketValue !== null ? Number(marketValue.toFixed(2)) : null,
        unrealizedPnL: unrealizedPnL !== null ? Number(unrealizedPnL.toFixed(2)) : null,
        unrealizedPnLPercent: unrealizedPnLPercent !== null ? Number(unrealizedPnLPercent.toFixed(2)) : null,
        realizedPnL: Number((pos.realizedPnL * fxRate).toFixed(2)),
        dividendIncome: Number((pos.dividendIncome * fxRate).toFixed(2)),
        allocationPercent: null, // calculated in second pass once total is known
        quoteFreshness: (quote?.freshness as any) || 'unavailable',
        quoteSource: quote?.source ?? null,
        quoteObservedAt: quote?.observedAt ?? null,
        isStale: quote?.isStale ?? false,
        unpriced,
      });
    }

    // Second pass: compute allocation percentages based on total holdings value
    for (const h of holdings) {
      if (h.marketValue !== null && totalHoldingsMarketValue > 0) {
        h.allocationPercent = Number(((h.marketValue / totalHoldingsMarketValue) * 100).toFixed(2));
      } else {
        h.allocationPercent = null;
      }
    }

    // Sort descending by market value (priced first), then cost basis
    holdings.sort((a, b) => (b.marketValue ?? b.totalCostBasis) - (a.marketValue ?? a.totalCostBasis));

    return {
      holdings,
      unpricedCount,
      totalHoldingsMarketValue: Number(totalHoldingsMarketValue.toFixed(2)),
    };
  }
}

export const portfolioAccountingService = new PortfolioAccountingService();
