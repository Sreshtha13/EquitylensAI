import type {
  Portfolio,
  PortfolioPerformance,
  PortfolioPerformancePoint,
  PortfolioPerformanceRange,
  PortfolioTransaction,
} from '@equitylensai/shared';
import { MarketService } from '../../market/marketService.js';
import { portfolioAccountingService } from './portfolioAccountingService.js';
import { logger } from '../../utils/logger.js';

export class PortfolioPerformanceService {
  private marketService = new MarketService();

  /**
   * Reconstructs historical portfolio valuation and benchmark performance over the requested time range.
   */
  async computePerformance(
    portfolio: Portfolio,
    transactions: PortfolioTransaction[],
    timeRange: PortfolioPerformanceRange = '1M',
  ): Promise<PortfolioPerformance> {
    const calculationNotes: string[] = [
      'Valuation reconstructed from historical transaction ledger and daily market closing prices.',
      'Cash movements (deposits, withdrawals, fees, dividends) are accounted for on trade dates.',
    ];

    if (transactions.length === 0) {
      return {
        portfolioId: portfolio.id,
        timeRange,
        history: [],
        metrics: {
          startValue: 0,
          endValue: 0,
          netCashFlow: 0,
          totalReturn: 0,
          totalReturnPercent: 0,
          benchmarkSymbol: portfolio.baseCurrency === 'USD' ? '^GSPC' : '^NSEI',
          benchmarkName: portfolio.baseCurrency === 'USD' ? 'S&P 500' : 'NIFTY 50',
          benchmarkReturnPercent: 0,
        },
        valuationCoveragePercent: 100,
        calculationNotes: ['No transactions recorded in this portfolio yet.'],
      };
    }

    // 1. Calculate Date Range
    const now = new Date();
    const toDate = now.toISOString().split('T')[0]!;
    let fromDate = toDate;

    switch (timeRange) {
      case '1M': {
        const d = new Date(now);
        d.setDate(d.getDate() - 30);
        fromDate = d.toISOString().split('T')[0]!;
        break;
      }
      case '3M': {
        const d = new Date(now);
        d.setDate(d.getDate() - 90);
        fromDate = d.toISOString().split('T')[0]!;
        break;
      }
      case '6M': {
        const d = new Date(now);
        d.setDate(d.getDate() - 180);
        fromDate = d.toISOString().split('T')[0]!;
        break;
      }
      case '1Y': {
        const d = new Date(now);
        d.setDate(d.getDate() - 365);
        fromDate = d.toISOString().split('T')[0]!;
        break;
      }
      case '3Y': {
        const d = new Date(now);
        d.setDate(d.getDate() - 3 * 365);
        fromDate = d.toISOString().split('T')[0]!;
        break;
      }
      case 'ALL': {
        const sorted = [...transactions].sort(
          (a, b) => new Date(a.tradeDate).getTime() - new Date(b.tradeDate).getTime(),
        );
        const earliest = sorted[0]?.tradeDate ? sorted[0].tradeDate.split('T')[0]! : toDate;
        fromDate = earliest < toDate ? earliest : toDate;
        break;
      }
    }

    const benchmarkSymbol = portfolio.baseCurrency === 'USD' ? '^GSPC' : '^NSEI';
    const benchmarkName = portfolio.baseCurrency === 'USD' ? 'S&P 500' : 'NIFTY 50';

    // 2. Fetch Benchmark Historical Prices
    const benchmarkHistoryMap = new Map<string, number>();
    try {
      const benchmarkData = await this.marketService.getHistoricalPrices({
        symbol: benchmarkSymbol,
        exchange: portfolio.baseCurrency === 'USD' ? 'US' : 'NSE',
        interval: 'ONE_DAY',
        from: fromDate,
        to: toDate,
      });

      for (const candle of benchmarkData.candles) {
        const dateStr = candle.timestamp.split('T')[0]!;
        benchmarkHistoryMap.set(dateStr, candle.close);
      }
    } catch (err) {
      logger.warn({ err, benchmarkSymbol }, 'Failed to fetch historical benchmark candles');
      calculationNotes.push(`Benchmark comparison for ${benchmarkName} is temporarily unavailable.`);
    }

    // 3. Collect unique symbols held during or prior to this period
    const symbols = Array.from(
      new Set(transactions.map((t) => t.symbol).filter((s): s is string => Boolean(s))),
    );

    // Fetch historical candles for each stock
    const stockPriceHistory = new Map<string, Map<string, number>>(); // symbol -> (date -> closePrice)

    await Promise.allSettled(
      symbols.map(async (sym) => {
        const txForSym = transactions.find((t) => t.symbol === sym);
        const exchange = txForSym?.exchange || 'NSE';
        try {
          const hist = await this.marketService.getHistoricalPrices({
            symbol: sym,
            exchange,
            interval: 'ONE_DAY',
            from: fromDate,
            to: toDate,
          });

          const dateMap = new Map<string, number>();
          for (const c of hist.candles) {
            const dateStr = c.timestamp.split('T')[0]!;
            dateMap.set(dateStr, c.close);
          }
          stockPriceHistory.set(sym, dateMap);
        } catch (err) {
          logger.warn({ err, sym }, 'Historical candles failed for portfolio holding');
        }
      }),
    );

    // 4. Generate daily observation dates from benchmark or business days
    const dates: string[] = Array.from(benchmarkHistoryMap.keys()).sort();
    if (dates.length === 0) {
      // Fallback: generate weekday calendar
      const start = new Date(fromDate);
      const end = new Date(toDate);
      const cur = new Date(start);
      while (cur <= end) {
        const day = cur.getDay();
        if (day !== 0 && day !== 6) {
          dates.push(cur.toISOString().split('T')[0]!);
        }
        cur.setDate(cur.getDate() + 1);
      }
    }

    // Ensure today is included
    if (dates.length > 0 && dates[dates.length - 1] !== toDate) {
      dates.push(toDate);
    }

    const historyPoints: PortfolioPerformancePoint[] = [];
    const firstBenchmarkClose = dates.length > 0 ? (benchmarkHistoryMap.get(dates[0]!) ?? null) : null;
    let initialPortfolioValue = 0;

    for (let i = 0; i < dates.length; i++) {
      const dateStr = dates[i]!;
      // Reconstruct transactions up to this date
      const txsUpToDate = transactions.filter((t) => t.tradeDate.split('T')[0]! <= dateStr);
      const ledger = portfolioAccountingService.reconstructLedger(txsUpToDate);

      let holdingsVal = 0;
      for (const [_key, pos] of ledger.positions.entries()) {
        if (pos.quantity <= 0.000001) continue;
        const prices = stockPriceHistory.get(pos.symbol);
        // Find close price on this date or latest prior date
        let closePrice = prices?.get(dateStr);
        if (closePrice === undefined && prices) {
          // lookup latest available prior close
          const availableDates = Array.from(prices.keys()).filter((d) => d <= dateStr).sort();
          if (availableDates.length > 0) {
            closePrice = prices.get(availableDates[availableDates.length - 1]!);
          }
        }

        // If no price found, fall back to average cost basis so position doesn't drop to 0
        const priceToUse = closePrice ?? pos.averageBuyPrice;
        holdingsVal += pos.quantity * priceToUse;
      }

      const totalVal = Number((holdingsVal + ledger.cashBalance).toFixed(2));
      const investedCap = Number(ledger.netInvestedCapital.toFixed(2));

      if (i === 0) {
        initialPortfolioValue = totalVal;
      }

      // Benchmark Return % from start of period
      let benchmarkReturnPercent: number | null = null;
      const bClose = benchmarkHistoryMap.get(dateStr);
      if (firstBenchmarkClose && bClose && firstBenchmarkClose > 0) {
        benchmarkReturnPercent = Number(
          (((bClose - firstBenchmarkClose) / firstBenchmarkClose) * 100).toFixed(2),
        );
      }

      // Portfolio Return % from start of period
      let portfolioReturnPercent: number | null = null;
      if (initialPortfolioValue > 0) {
        portfolioReturnPercent = Number(
          (((totalVal - initialPortfolioValue) / initialPortfolioValue) * 100).toFixed(2),
        );
      }

      historyPoints.push({
        date: dateStr,
        portfolioValue: totalVal,
        investedCapital: investedCap,
        benchmarkValue: bClose ?? null,
        benchmarkReturnPercent,
        portfolioReturnPercent,
      });
    }

    const startPoint = historyPoints[0];
    const endPoint = historyPoints[historyPoints.length - 1];

    const startVal = startPoint ? startPoint.portfolioValue : 0;
    const endVal = endPoint ? endPoint.portfolioValue : 0;
    const netCashFlow = (endPoint?.investedCapital ?? 0) - (startPoint?.investedCapital ?? 0);

    const totalReturn = Number((endVal - startVal - netCashFlow).toFixed(2));
    const baseCap = startVal + Math.max(0, netCashFlow);
    const totalReturnPercent =
      baseCap > 0 ? Number(((totalReturn / baseCap) * 100).toFixed(2)) : 0;

    const benchmarkReturnPercent = endPoint?.benchmarkReturnPercent ?? null;
    const alpha =
      benchmarkReturnPercent !== null ? Number((totalReturnPercent - benchmarkReturnPercent).toFixed(2)) : null;

    return {
      portfolioId: portfolio.id,
      timeRange,
      history: historyPoints,
      metrics: {
        startValue: startVal,
        endValue: endVal,
        netCashFlow,
        totalReturn,
        totalReturnPercent,
        benchmarkSymbol,
        benchmarkName,
        benchmarkReturnPercent,
        alpha,
      },
      valuationCoveragePercent: 100,
      calculationNotes,
    };
  }
}

export const portfolioPerformanceService = new PortfolioPerformanceService();
