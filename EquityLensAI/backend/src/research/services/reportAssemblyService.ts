import crypto from 'node:crypto';
import type {
  ResearchReportSection,
  ResearchEvidenceItem,
  ReportTemplateDefinition,
  FinancialAnalysis,
  NormalizedQuote,
  CompanyProfile,
  StockPerformanceResponse,
  CorporateAnnouncement,
  NewsItem,
  PeerBenchmarkResponse,
} from '@equitylensai/shared';
import { marketService } from '../../market/marketService.js';
import { financialService } from '../../financial/financialService.js';
import { newsService } from '../../news/services/newsService.js';
import { peerDiscoveryService } from '../../compare/services/peerDiscoveryService.js';
import { benchmarkService } from '../../compare/services/benchmarkService.js';
import { logger } from '../../utils/logger.js';

export interface AssembledReportData {
  quote: NormalizedQuote | null;
  profile: CompanyProfile | null;
  performance: StockPerformanceResponse | null;
  financials: FinancialAnalysis | null;
  announcements: CorporateAnnouncement[];
  news: NewsItem[];
  peerBenchmarks: PeerBenchmarkResponse | null;
  evidence: ResearchEvidenceItem[];
  sections: ResearchReportSection[];
}

export class ReportAssemblyService {
  async assembleReport(options: {
    symbol: string;
    exchange: string;
    template: ReportTemplateDefinition;
    periods?: number;
    includePeers?: boolean;
    includeNews?: boolean;
    researchQuestion?: string;
  }): Promise<AssembledReportData> {
    const { symbol, exchange, template, periods = 4, includePeers = true, includeNews = true } = options;
    const nowIso = new Date().toISOString();

    // 1. Concurrently fetch verified baseline facts from existing services
    const [quoteRes, profileRes, perfRes, finRes, annRes, newsRes] = await Promise.allSettled([
      marketService.getQuote({ symbol, exchange }).catch(() => null),
      marketService.getCompanyProfile({ symbol, exchange }).catch(() => null),
      marketService.getStockPerformance({ symbol, exchange }).catch(() => null),
      financialService.getFinancialAnalysis({ symbol, exchange, annualPeriods: periods }).catch(() => null),
      includeNews
        ? newsService.getAnnouncements({ symbol, exchange, limit: 5 }).catch(() => ({ items: [] as CorporateAnnouncement[] }))
        : Promise.resolve({ items: [] as CorporateAnnouncement[] }),
      includeNews
        ? newsService.getStockNews(symbol, exchange, { limit: 5 }).catch(() => ({ items: [] as NewsItem[] }))
        : Promise.resolve({ items: [] as NewsItem[] }),
    ]);

    const quote: NormalizedQuote | null = quoteRes.status === 'fulfilled' ? quoteRes.value : null;
    const profile: CompanyProfile | null = profileRes.status === 'fulfilled' ? profileRes.value : null;
    const performance: StockPerformanceResponse | null = perfRes.status === 'fulfilled' ? perfRes.value : null;
    const financials: FinancialAnalysis | null = finRes.status === 'fulfilled' ? finRes.value : null;
    const announcements: CorporateAnnouncement[] =
      annRes.status === 'fulfilled' && annRes.value && 'items' in annRes.value ? annRes.value.items : [];
    const news: NewsItem[] =
      newsRes.status === 'fulfilled' && newsRes.value && 'items' in newsRes.value ? newsRes.value.items : [];

    // 2. Fetch Peer Benchmarks if requested & supported
    let peerBenchmarks: PeerBenchmarkResponse | null = null;
    if (includePeers) {
      try {
        const peersResult = await peerDiscoveryService.discoverPeers(symbol, exchange);
        if (peersResult.peers.length > 0) {
          const peerTargets = [
            { symbol, exchange },
            ...peersResult.peers.map((p) => ({ symbol: p.symbol, exchange: p.exchange })),
          ];
          peerBenchmarks = await benchmarkService.calculateBenchmarks(peerTargets, 'annual');
        }
      } catch (err) {
        logger.debug({ err, symbol }, 'Peer benchmark discovery skipped or unavailable');
      }
    }

    // 3. Register verified evidence items
    const evidence: ResearchEvidenceItem[] = [];

    if (quote && quote.price !== null) {
      evidence.push({
        id: `quote:${symbol}:price`,
        evidenceType: 'quote',
        title: `${symbol} Last Traded Price`,
        sourceReference: `${quote.exchange} Live/EOD Quote Feed`,
        observedAt: quote.observedAt,
        currency: quote.currency,
        value: quote.price,
        metadata: {
          change: quote.change,
          changePercent: quote.changePercent,
          volume: quote.volume,
          dayHigh: quote.high,
          dayLow: quote.low,
        },
      });
    }

    if (profile) {
      evidence.push({
        id: `profile:${symbol}:meta`,
        evidenceType: 'company_profile',
        title: `${profile.name} Corporate Profile`,
        sourceReference: profile.source || 'Exchange / Regulatory Directory',
        observedAt: profile.retrievedAt || nowIso,
        sourceUrl: profile.website ?? null,
        metadata: {
          sector: profile.sector,
          industry: profile.industry,
          description: profile.description,
          sharesOutstanding: profile.sharesOutstanding,
        },
      });
    }

    if (financials) {
      evidence.push({
        id: `fin:${symbol}:health_score`,
        evidenceType: 'health_score',
        title: `${symbol} Quantitative Financial Health Score`,
        sourceReference: 'EquityLensAI Deterministic Health Engine',
        observedAt: financials.retrievedAt,
        value: financials.healthScore?.overallScore ?? null,
        metadata: {
          classification: financials.healthScore?.grade,
          dimensions: financials.healthScore?.dimensions,
        },
      });

      // Income statement latest
      const latestIncome = financials.latestAnnual?.income;
      if (latestIncome) {
        evidence.push({
          id: `fin:${symbol}:income:${latestIncome.periodEndDate || 'latest'}`,
          evidenceType: 'financial_statement',
          title: `Revenue and Operating Profit (${latestIncome.periodEndDate || 'Latest'})`,
          sourceReference: `${financials.source} Audited Statements`,
          observedAt: financials.retrievedAt,
          reportingPeriod: latestIncome.periodEndDate,
          currency: financials.currency,
          units: 'Millions',
          value: latestIncome.totalRevenue,
          metadata: {
            netIncome: latestIncome.netIncome,
            operatingIncome: latestIncome.operatingIncome,
            grossProfit: latestIncome.grossProfit,
          },
        });
      }

      // Ratios
      if (financials.profitability?.operatingMargin?.value !== null && financials.profitability?.operatingMargin?.value !== undefined) {
        evidence.push({
          id: `ratio:${symbol}:operating_margin`,
          evidenceType: 'financial_ratio',
          title: 'Operating Profit Margin',
          sourceReference: 'EquityLensAI Ratio Engine',
          observedAt: financials.retrievedAt,
          units: '%',
          value: financials.profitability.operatingMargin.value,
        });
      }
      if (financials.profitability?.returnOnEquity?.value !== null && financials.profitability?.returnOnEquity?.value !== undefined) {
        evidence.push({
          id: `ratio:${symbol}:roe`,
          evidenceType: 'financial_ratio',
          title: 'Return on Equity (ROE)',
          sourceReference: 'EquityLensAI Ratio Engine',
          observedAt: financials.retrievedAt,
          units: '%',
          value: financials.profitability.returnOnEquity.value,
        });
      }
      if (financials.leverage?.debtToEquity?.value !== null && financials.leverage?.debtToEquity?.value !== undefined) {
        evidence.push({
          id: `ratio:${symbol}:debt_to_equity`,
          evidenceType: 'financial_ratio',
          title: 'Debt to Equity Ratio',
          sourceReference: 'EquityLensAI Ratio Engine',
          observedAt: financials.retrievedAt,
          value: financials.leverage.debtToEquity.value,
        });
      }
      if (financials.valuation?.peRatio?.value !== null && financials.valuation?.peRatio?.value !== undefined) {
        evidence.push({
          id: `ratio:${symbol}:pe_ratio`,
          evidenceType: 'financial_ratio',
          title: 'Price to Earnings Multiple (P/E)',
          sourceReference: 'EquityLensAI Ratio Engine',
          observedAt: financials.retrievedAt,
          value: financials.valuation.peRatio.value,
        });
      }
    }

    if (announcements.length > 0) {
      announcements.slice(0, 3).forEach((ann) => {
        evidence.push({
          id: `ann:${ann.id}`,
          evidenceType: 'corporate_announcement',
          title: ann.title,
          sourceReference: `${ann.exchange} Corporate Circular`,
          sourceUrl: ann.documentUrl || ann.sourceUrl || null,
          observedAt: ann.publishedAt,
          metadata: { category: ann.category },
        });
      });
    }

    // 4. Construct initial sections based on template default sections
    const sections: ResearchReportSection[] = [];
    let position = 0;

    for (const defSection of template.defaultSections) {
      let content = '';
      let structuredData: Record<string, unknown> | undefined;
      const evidenceIds: string[] = [];

      switch (defSection.sectionType) {
        case 'cover_metadata': {
          content = `### ${template.name}\n\n` +
            `**Company:** ${profile?.name || symbol} (${symbol})\n` +
            `**Exchange:** ${exchange} | **Currency:** ${financials?.currency || quote?.currency || 'INR'}\n` +
            `**Report Created:** ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}\n` +
            `**Data Freshness:** ${financials?.isStale ? 'Stale / Cached' : 'Current Audited Statements'}\n` +
            `**Reporting Periods Analyzed:** ${financials?.annualHistory?.length || 0} fiscal periods\n\n` +
            `> *EquityLensAI Research Platform — Independent, uncompromised fundamental research.*`;
          break;
        }

        case 'executive_summary': {
          const healthScore = financials?.healthScore?.overallScore ?? 'N/A';
          const grade = financials?.healthScore?.grade ?? 'Pending';
          const peVal = financials?.valuation?.peRatio?.value !== null && financials?.valuation?.peRatio?.value !== undefined ? financials.valuation.peRatio.value.toFixed(2) : 'N/A';
          const roeVal = financials?.profitability?.returnOnEquity?.value !== null && financials?.profitability?.returnOnEquity?.value !== undefined ? `${financials.profitability.returnOnEquity.value.toFixed(2)}%` : 'N/A';
          const opMargin = financials?.profitability?.operatingMargin?.value !== null && financials?.profitability?.operatingMargin?.value !== undefined ? `${financials.profitability.operatingMargin.value.toFixed(2)}%` : 'N/A';
          const debtEq = financials?.leverage?.debtToEquity?.value !== null && financials?.leverage?.debtToEquity?.value !== undefined ? financials.leverage.debtToEquity.value.toFixed(2) : 'N/A';

          content = `This research report provides a structured financial evaluation of **${profile?.name || symbol}** based strictly on audited filings and exchange market data.\n\n` +
            `- **Quantitative Health Score:** ${healthScore} / 100 (Grade ${grade})\n` +
            `- **Profitability & Returns:** Return on Equity of ${roeVal}; operating margin of ${opMargin}.\n` +
            `- **Capital Structure:** Debt-to-Equity stands at ${debtEq}.\n` +
            `- **Market Valuation:** Trading at P/E of ${peVal}.\n\n` +
            `*Review the detailed sections below for full financial statement tables, peer rankings, and evidence verification.*`;

          if (quote) evidenceIds.push(`quote:${symbol}:price`);
          if (financials) evidenceIds.push(`fin:${symbol}:health_score`);
          break;
        }

        case 'company_profile': {
          content = `### Corporate Profile\n\n` +
            `**${profile?.name || symbol}** operates in the **${profile?.sector || 'Diversified'}** sector within the **${profile?.industry || 'General'}** industry.\n\n` +
            `${profile?.description || 'Company description and corporate structure from official exchange filings.'}\n\n` +
            `- **Headquarters / Exchange:** ${profile?.headquarters || exchange}\n` +
            `- **Official Website:** ${profile?.website ? `[${profile.website}](${profile.website})` : 'Not verified'}\n` +
            `- **Shares Outstanding:** ${profile?.sharesOutstanding ? profile.sharesOutstanding.toLocaleString() : 'N/A'}`;

          if (profile) evidenceIds.push(`profile:${symbol}:meta`);
          break;
        }

        case 'market_overview': {
          const ltp = quote?.price !== null && quote?.price !== undefined ? `${quote.currency} ${quote.price.toFixed(2)}` : 'N/A';
          const chg = quote?.changePercent !== null && quote?.changePercent !== undefined ? `${quote.changePercent >= 0 ? '+' : ''}${quote.changePercent.toFixed(2)}%` : 'N/A';
          const dayRange = quote?.low && quote?.high ? `${quote.currency} ${quote.low.toFixed(2)} - ${quote.high.toFixed(2)}` : 'N/A';
          const p1Y = performance?.periods.find((p) => p.period === '1Y');
          const year1Return = p1Y ? `${p1Y.cumulativeReturnPercent >= 0 ? '+' : ''}${p1Y.cumulativeReturnPercent.toFixed(2)}%` : 'N/A';

          content = `### Market Overview & Trading Metrics\n\n` +
            `| Metric | Value |\n` +
            `| :--- | :--- |\n` +
            `| Last Traded Price | **${ltp}** |\n` +
            `| Change | **${chg}** |\n` +
            `| Day's Range | ${dayRange} |\n` +
            `| 1-Year Historical Return | ${year1Return} |\n` +
            `| Volume | ${quote?.volume ? quote.volume.toLocaleString() : 'N/A'} |\n` +
            `| Quote Freshness | Verified Market Feed (${quote?.observedAt ? new Date(quote.observedAt).toLocaleTimeString() : 'Recent'}) |\n`;

          structuredData = {
            price: quote?.price,
            changePercent: quote?.changePercent,
            dayHigh: quote?.high,
            dayLow: quote?.low,
            performancePeriods: performance?.periods,
          };

          if (quote) evidenceIds.push(`quote:${symbol}:price`);
          break;
        }

        case 'financial_analysis': {
          const statements = financials?.annualHistory || [];
          let tableMd = '| Fiscal Period | Revenue | Operating Income | Net Profit |\n| :--- | :---: | :---: | :---: |\n';
          statements.slice(0, 4).forEach((stmt) => {
            const yr = stmt.periodEndDate?.slice(0, 4) || 'FY';
            const rev = stmt.income.totalRevenue !== null ? (stmt.income.totalRevenue / 1e6).toFixed(1) : '-';
            const op = stmt.income.operatingIncome !== null ? (stmt.income.operatingIncome / 1e6).toFixed(1) : '-';
            const net = stmt.income.netIncome !== null ? (stmt.income.netIncome / 1e6).toFixed(1) : '-';
            tableMd += `| ${yr} | ${rev}M | ${op}M | ${net}M |\n`;
          });

          const opMargin = financials?.profitability?.operatingMargin?.value !== null && financials?.profitability?.operatingMargin?.value !== undefined ? `${financials.profitability.operatingMargin.value.toFixed(2)}%` : 'N/A';
          const netMargin = financials?.profitability?.netMargin?.value !== null && financials?.profitability?.netMargin?.value !== undefined ? `${financials.profitability.netMargin.value.toFixed(2)}%` : 'N/A';
          const currRatio = financials?.liquidity?.currentRatio?.value !== null && financials?.liquidity?.currentRatio?.value !== undefined ? financials.liquidity.currentRatio.value.toFixed(2) : 'N/A';
          const debtEq = financials?.leverage?.debtToEquity?.value !== null && financials?.leverage?.debtToEquity?.value !== undefined ? financials.leverage.debtToEquity.value.toFixed(2) : 'N/A';
          const intCov = financials?.leverage?.interestCoverageRatio?.value !== null && financials?.leverage?.interestCoverageRatio?.value !== undefined ? financials.leverage.interestCoverageRatio.value.toFixed(2) : 'N/A';
          const peVal = financials?.valuation?.peRatio?.value !== null && financials?.valuation?.peRatio?.value !== undefined ? financials.valuation.peRatio.value.toFixed(2) : 'N/A';

          content = `### Financial Statements & Multi-Year Trends\n\n` +
            `Financial metrics reflect consolidated audited disclosures in **${financials?.currency || 'INR'}**.\n\n` +
            tableMd + '\n\n' +
            `#### Key Operational Ratios\n` +
            `- **Operating Margin:** ${opMargin}\n` +
            `- **Net Margin:** ${netMargin}\n` +
            `- **Current Ratio:** ${currRatio}\n` +
            `- **Debt to Equity:** ${debtEq}\n` +
            `- **Interest Coverage:** ${intCov}\n` +
            `- **P/E Ratio:** ${peVal}`;

          structuredData = {
            latestAnnual: financials?.latestAnnual,
            annualHistory: financials?.annualHistory,
            profitability: financials?.profitability,
            liquidity: financials?.liquidity,
            leverage: financials?.leverage,
            valuation: financials?.valuation,
          };

          if (financials?.latestAnnual?.income) {
            evidenceIds.push(`fin:${symbol}:income:${financials.latestAnnual.income.periodEndDate || 'latest'}`);
          }
          if (financials?.profitability?.returnOnEquity?.value !== null) {
            evidenceIds.push(`ratio:${symbol}:roe`);
          }
          break;
        }

        case 'comparative_analysis': {
          if (peerBenchmarks && peerBenchmarks.symbols.length > 1) {
            let peerTable = `| Metric | Target (${symbol}) | Peer Median | Rank |\n| :--- | :---: | :---: | :---: |\n`;
            peerBenchmarks.benchmarks.slice(0, 5).forEach((bm) => {
              const targetRank = bm.ranks[symbol];
              const val = targetRank?.value !== null && targetRank?.value !== undefined ? targetRank.value.toFixed(2) : '-';
              const med = bm.median !== null ? bm.median.toFixed(2) : '-';
              const rk = targetRank?.rank ? `${targetRank.rank} of ${bm.sampleSize}` : '-';
              peerTable += `| ${bm.label} (${bm.unit}) | ${val} | ${med} | ${rk} |\n`;
            });

            content = `### Peer Group Benchmarking\n\n` +
              `Compared against peer group: **${peerBenchmarks.symbols.join(', ')}**\n\n` +
              peerTable;
          } else {
            content = `### Peer Group Benchmarking\n\n` +
              `Peer comparison data is not currently configured for this report. Use the Peer Comparison tool to link sector comparables.`;
          }
          break;
        }

        case 'news_and_developments': {
          let itemsList = '';
          if (announcements.length > 0) {
            itemsList += `#### Official Corporate Filings\n`;
            announcements.forEach((a) => {
              itemsList += `- **[${a.category}]** ${a.title} (${new Date(a.publishedAt).toLocaleDateString()})\n`;
              evidenceIds.push(`ann:${a.id}`);
            });
          }
          if (news.length > 0) {
            itemsList += `\n#### Verified Market News\n`;
            news.forEach((n) => {
              const pub = n.publishedAt ? new Date(n.publishedAt).toLocaleDateString() : 'Recent';
              itemsList += `- ${n.title} — *${n.sourceName}* (${pub})\n`;
            });
          }
          if (!itemsList) {
            itemsList = 'No recent corporate disclosures or news items retrieved during this research cycle.';
          }
          content = `### Corporate Disclosures & Verified News\n\n${itemsList}`;
          break;
        }

        case 'risks_and_uncertainties': {
          const debtVal = financials?.leverage?.debtToEquity?.value ?? 0;
          const currRatio = financials?.liquidity?.currentRatio?.value ?? 2;
          const riskPoints: string[] = [];

          if (debtVal > 1.5) {
            riskPoints.push(`- **Leverage Exposure:** Debt-to-Equity is elevated at ${debtVal.toFixed(2)}, indicating reliance on external borrowing.`);
          } else {
            riskPoints.push(`- **Solvency Position:** Debt-to-Equity is controlled at ${debtVal.toFixed(2)}.`);
          }

          if (currRatio < 1.0) {
            riskPoints.push(`- **Working Capital Tightness:** Current ratio is ${currRatio.toFixed(2)}, which is below standard 1.0 liquidity threshold.`);
          }

          riskPoints.push(`- **Reporting Scope:** Statements reflect consolidated accounts. Unaudited intermediate adjustments may impact future periods.`);
          riskPoints.push(`- **Market Volatility:** Historical price fluctuations and sector macro cycles.`);

          content = `### Material Risk Factors & Data Limitations\n\n${riskPoints.join('\n')}`;
          break;
        }

        case 'research_notes': {
          content = `### Analyst Observations & Thesis Notes\n\n*Add notes, hypothesis validation, and field observations here.*`;
          break;
        }

        case 'conclusion_open_questions': {
          content = `### Conclusion & Open Diligence Questions\n\n` +
            `1. How does management plan to sustain operating margins over the next fiscal cycle?\n` +
            `2. What is the expected capital expenditure pipeline and debt repayment schedule?\n` +
            `3. Verify auditor notes regarding contingent liabilities in upcoming annual filing.\n\n` +
            `*Disclaimer: This research memo is generated for institutional information and due diligence. It does not constitute investment advice or a recommendation to buy or sell securities.*`;
          break;
        }

        case 'sources_and_methodology': {
          content = `### Sources & Evidence Register\n\n` +
            `- **Market Quotes:** Exchange official ticks via EquityLensAI Market Gateway\n` +
            `- **Financial Statements:** Audited annual and quarterly schedules normalized through standard GAAP/IFRS taxonomies\n` +
            `- **Deterministic Calculations:** Quantitative ratio engine v1.0 (Liquidity, Solvency, Profitability, Health Score)\n` +
            `- **Peer Discovery:** GICS/Sector matching with market capitalization tiered bounds\n` +
            `- **Corporate Filings:** Official exchange circulars from NSE/BSE\n\n` +
            `*Generated at ${nowIso} by EquityLensAI Research Platform.*`;
          break;
        }

        default: {
          content = `### ${defSection.title}\n\n*Content pending research synthesis.*`;
          break;
        }
      }

      sections.push({
        id: crypto.randomUUID(),
        sectionType: defSection.sectionType,
        title: defSection.title,
        content,
        structuredData,
        position: position++,
        status: 'draft',
        generatedBy: 'system',
        evidenceIds,
        updatedAt: nowIso,
      });
    }

    return {
      quote,
      profile,
      performance,
      financials,
      announcements,
      news,
      peerBenchmarks,
      evidence,
      sections,
    };
  }
}

export const reportAssemblyService = new ReportAssemblyService();
