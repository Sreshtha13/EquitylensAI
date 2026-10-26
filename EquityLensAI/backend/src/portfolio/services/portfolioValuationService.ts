import type {
  Portfolio,
  PortfolioHolding,
  PortfolioSummary,
  PortfolioTransaction,
} from '@equitylensai/shared';
import { MarketService } from '../../market/marketService.js';
import { instrumentRepository } from '../../market/instruments/repository.js';
import { portfolioAccountingService, type ReconstructedLedger } from './portfolioAccountingService.js';
import { currencyService } from './currencyService.js';
import { logger } from '../../utils/logger.js';

export class PortfolioValuationService {
  private marketService = new MarketService();

  /**
   * Evaluates all positions in the portfolio with live market quotes, FX conversion,
   * and produces fully derived holdings and comprehensive summary metrics.
   */
  async evaluatePortfolio(
    portfolio: Portfolio,
    transactions: PortfolioTransaction[],
  ): Promise<{
    holdings: PortfolioHolding[];
    summary: PortfolioSummary;
    ledger: ReconstructedLedger;
  }> {
    const ledger = portfolioAccountingService.reconstructLedger(transactions);
    const activePositions = Array.from(ledger.positions.values()).filter((p) => p.quantity > 0.000001);

    // 1. Fetch quotes for all active holdings concurrently with error isolation
    const quotesMap = new Map<
      string,
      {
        price: number | null;
        freshness: string;
        source: string;
        observedAt: string;
        isStale: boolean;
      }
    >();

    const ratesMap = new Map<string, number>();

    const quotePromises = activePositions.map(async (pos) => {
      const key = portfolioAccountingService.makeKey(pos.symbol, pos.exchange);
      try {
        const quote = await this.marketService.getQuote({
          symbol: pos.symbol,
          exchange: pos.exchange,
        });

        quotesMap.set(key, {
          price: quote.price,
          freshness: quote.freshness,
          source: quote.source,
          observedAt: quote.observedAt,
          isStale: quote.isStale,
        });
      } catch (err) {
        logger.warn(
          { err, symbol: pos.symbol, exchange: pos.exchange },
          'Failed to retrieve live quote for portfolio holding',
        );
        quotesMap.set(key, {
          price: null,
          freshness: 'unavailable',
          source: 'none',
          observedAt: new Date().toISOString(),
          isStale: true,
        });
      }

      // Check FX conversion if holding currency != portfolio.baseCurrency
      if (pos.currency !== portfolio.baseCurrency) {
        try {
          const rateObs = await currencyService.getExchangeRate(
            pos.currency as any,
            portfolio.baseCurrency,
          );
          ratesMap.set(`${pos.currency}_${portfolio.baseCurrency}`, rateObs.rate);
        } catch {
          ratesMap.set(`${pos.currency}_${portfolio.baseCurrency}`, 1.0);
        }
      }
    });

    await Promise.allSettled(quotePromises);

    // 2. Build holdings array
    const { holdings, unpricedCount, totalHoldingsMarketValue } =
      portfolioAccountingService.buildHoldings(
        ledger.positions,
        quotesMap,
        ratesMap,
        portfolio.baseCurrency,
      );

    // Enrich holding names and assetTypes from instrument master
    for (const h of holdings) {
      const inst = instrumentRepository.getBySymbol(h.symbol, h.exchange);
      if (inst) {
        h.name = inst.name;
        h.assetType = inst.assetType;
      }
    }

    // 3. Compute Portfolio Summary Metrics
    const holdingsCount = holdings.length;
    const totalCostBasis = holdings.reduce((sum, h) => sum + h.totalCostBasis, 0);

    let valuationStatus: PortfolioSummary['valuationStatus'] = 'complete';
    if (holdingsCount === 0) {
      valuationStatus = 'empty';
    } else if (unpricedCount === holdingsCount) {
      valuationStatus = 'unavailable';
    } else if (unpricedCount > 0) {
      valuationStatus = 'partial';
    }

    const valuationCoveragePercent =
      holdingsCount > 0
        ? Number((((holdingsCount - unpricedCount) / holdingsCount) * 100).toFixed(1))
        : 100;

    const currentHoldingsValue =
      valuationStatus === 'unavailable' || valuationStatus === 'empty'
        ? holdingsCount === 0
          ? 0
          : null
        : totalHoldingsMarketValue;

    const cashBalance = Number(ledger.cashBalance.toFixed(2));
    const totalPortfolioValue =
      currentHoldingsValue !== null ? Number((currentHoldingsValue + cashBalance).toFixed(2)) : null;

    const unrealizedPnL =
      currentHoldingsValue !== null ? Number((currentHoldingsValue - totalCostBasis).toFixed(2)) : null;

    const unrealizedPnLPercent =
      unrealizedPnL !== null && totalCostBasis > 0
        ? Number(((unrealizedPnL / totalCostBasis) * 100).toFixed(2))
        : null;

    const realizedPnL = Number(ledger.totalRealizedPnL.toFixed(2));
    const totalDividends = Number(ledger.totalDividends.toFixed(2));
    const totalFees = Number(ledger.totalFees.toFixed(2));

    // Total Return = Realized P&L + Unrealized P&L + Dividends - Standalone Fees
    const totalReturn =
      unrealizedPnL !== null
        ? Number((realizedPnL + unrealizedPnL + totalDividends - totalFees).toFixed(2))
        : null;

    // Denominator for total return percentage: Total Cost Basis + Net Positive Cash Inflow
    const returnBase = totalCostBasis + Math.max(0, ledger.netInvestedCapital);
    const totalReturnPercent =
      totalReturn !== null && returnBase > 0
        ? Number(((totalReturn / returnBase) * 100).toFixed(2))
        : null;

    const summary: PortfolioSummary = {
      portfolioId: portfolio.id,
      name: portfolio.name,
      baseCurrency: portfolio.baseCurrency,
      holdingsCount,
      totalCostBasis: Number(totalCostBasis.toFixed(2)),
      currentHoldingsValue,
      cashBalance,
      totalPortfolioValue,
      unrealizedPnL,
      unrealizedPnLPercent,
      realizedPnL,
      totalDividends,
      totalFees,
      totalReturn,
      totalReturnPercent,
      netDeposits: Number(ledger.netInvestedCapital.toFixed(2)),
      valuationStatus,
      valuationCoveragePercent,
      unpricedHoldingsCount: unpricedCount,
      lastValuationAt: new Date().toISOString(),
    };

    return {
      holdings,
      summary,
      ledger,
    };
  }
}

export const portfolioValuationService = new PortfolioValuationService();
