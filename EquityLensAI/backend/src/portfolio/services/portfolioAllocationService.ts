import type {
  PortfolioAllocation,
  PortfolioHolding,
  PortfolioSummary,
} from '@equitylensai/shared';
import { MarketService } from '../../market/marketService.js';
import { logger } from '../../utils/logger.js';

export class PortfolioAllocationService {
  private marketService = new MarketService();

  async computeAllocation(
    holdings: PortfolioHolding[],
    summary: PortfolioSummary,
  ): Promise<PortfolioAllocation> {
    const portfolioId = summary.portfolioId;
    const totalValue = summary.totalPortfolioValue ?? summary.currentHoldingsValue ?? 0;

    // 1. Asset Allocation (Equity, ETF, Cash)
    const assetMap = new Map<string, number>();
    for (const h of holdings) {
      if (h.marketValue !== null) {
        const cat = h.assetType === 'etf' ? 'ETF' : 'Equity';
        assetMap.set(cat, (assetMap.get(cat) ?? 0) + h.marketValue);
      }
    }

    if (summary.cashBalance > 0) {
      assetMap.set('Cash', (assetMap.get('Cash') ?? 0) + summary.cashBalance);
    }

    const assetAllocation = Array.from(assetMap.entries()).map(([category, marketValue]) => ({
      category,
      marketValue: Number(marketValue.toFixed(2)),
      percentage: totalValue > 0 ? Number(((marketValue / totalValue) * 100).toFixed(1)) : 0,
    }));

    // 2. Sector Allocation
    const sectorMap = new Map<string, number>();
    let classifiedValue = 0;
    let unclassifiedValue = 0;

    // Fetch sector profiles concurrently
    await Promise.allSettled(
      holdings.map(async (h) => {
        if (h.marketValue === null) return;

        let sector: string | null = null;
        try {
          const profile = await this.marketService.getCompanyProfile({
            symbol: h.symbol,
            exchange: h.exchange,
          });
          sector = profile.sector;
        } catch (err) {
          logger.debug({ err, symbol: h.symbol }, 'Profile lookup failed for sector classification');
        }

        const secName = sector?.trim() || 'Unclassified';
        sectorMap.set(secName, (sectorMap.get(secName) ?? 0) + h.marketValue);

        if (secName === 'Unclassified') {
          unclassifiedValue += h.marketValue;
        } else {
          classifiedValue += h.marketValue;
        }
      }),
    );

    const holdingsTotalMarketValue = summary.currentHoldingsValue ?? 0;
    const sectorAllocation = Array.from(sectorMap.entries())
      .map(([sector, marketValue]) => ({
        sector,
        marketValue: Number(marketValue.toFixed(2)),
        percentage:
          holdingsTotalMarketValue > 0
            ? Number(((marketValue / holdingsTotalMarketValue) * 100).toFixed(1))
            : 0,
      }))
      .sort((a, b) => b.marketValue - a.marketValue);

    const sectorCoveragePercent =
      holdingsTotalMarketValue > 0
        ? Number(((classifiedValue / holdingsTotalMarketValue) * 100).toFixed(1))
        : 100;

    // 3. Concentration Analysis
    const pricedHoldings = holdings
      .filter((h) => h.marketValue !== null)
      .sort((a, b) => (b.marketValue ?? 0) - (a.marketValue ?? 0));

    const topHoldingWeight =
      pricedHoldings.length > 0 && holdingsTotalMarketValue > 0 && pricedHoldings[0]?.marketValue
        ? Number(((pricedHoldings[0].marketValue / holdingsTotalMarketValue) * 100).toFixed(1))
        : null;

    const top5Value = pricedHoldings
      .slice(0, 5)
      .reduce((sum, h) => sum + (h.marketValue ?? 0), 0);

    const top5HoldingsWeight =
      pricedHoldings.length > 0 && holdingsTotalMarketValue > 0
        ? Number(((top5Value / holdingsTotalMarketValue) * 100).toFixed(1))
        : null;

    return {
      portfolioId,
      assetAllocation,
      sectorAllocation,
      concentration: {
        topHoldingWeight,
        top5HoldingsWeight,
        totalHoldings: holdings.length,
      },
      sectorCoveragePercent,
      unclassifiedValue: Number(unclassifiedValue.toFixed(2)),
    };
  }
}

export const portfolioAllocationService = new PortfolioAllocationService();
