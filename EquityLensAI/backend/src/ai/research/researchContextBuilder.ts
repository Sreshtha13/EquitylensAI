import type { FinancialAnalysis, FinancialMetric } from '@equitylensai/shared';
import { financialService } from '../../financial/financialService.js';
import { instrumentRepository } from '../../market/instruments/repository.js';
import { marketService } from '../../market/marketService.js';
import { AppError } from '../../utils/appError.js';
import type { ResearchEvidence, ResearchIntent, ResearchRequest } from './researchSchema.js';

export type ResolvedInstrument = {
  symbol: string;
  exchange: string;
  name: string;
  currency: string;
};

export type ResearchContext = {
  instrument: ResolvedInstrument;
  analysis: FinancialAnalysis;
  evidence: ResearchEvidence[];
  comparisonInstrument?: ResolvedInstrument;
  missingData: string[];
  coverage: {
    available: number;
    total: number;
    period: string;
    currency: string;
    stale: boolean;
  };
};

function resolveInstrument(symbol: string, exchange?: string): ResolvedInstrument {
  const normalizedSymbol = symbol
    .trim()
    .toUpperCase()
    .replace(/\.(NS|BO)$/i, '');
  const candidates = instrumentRepository
    .search(normalizedSymbol, { limit: 100 })
    .filter((instrument) => instrument.symbol.toUpperCase() === normalizedSymbol);
  const matched = exchange
    ? candidates.find(
        (candidate) => candidate.exchange.toUpperCase() === exchange.trim().toUpperCase(),
      )
    : candidates.length === 1
      ? candidates[0]
      : undefined;

  if (!matched) {
    if (!exchange && candidates.length > 1) {
      throw new AppError(
        'VALIDATION_ERROR',
        'Exchange is required because this symbol exists on multiple exchanges.',
        400,
      );
    }

    throw new AppError(
      'INSTRUMENT_NOT_FOUND',
      `No supported instrument found for ${normalizedSymbol}.`,
      404,
    );
  }

  return {
    symbol: matched.symbol,
    exchange: matched.exchange,
    name: matched.name,
    currency: matched.currency,
  };
}

function metricEvidence(
  id: string,
  metricName: string,
  metric: FinancialMetric,
  analysis: FinancialAnalysis,
): ResearchEvidence {
  return {
    id,
    type: 'metric',
    metric: metricName,
    value: metric.value,
    unit: metricName === 'healthScore' ? 'score' : metric.unit,
    period: metric.periodEndDate,
    periodType: analysis.ttm?.periodEndDate === metric.periodEndDate ? 'ttm' : 'annual',
    source: analysis.source,
    timestamp: analysis.retrievedAt,
    freshness: analysis.isStale ? 'stale' : 'periodic',
    stale: analysis.isStale,
  };
}

function getMetricsForIntent(
  intent: ResearchIntent,
  analysis: FinancialAnalysis,
): Array<[string, FinancialMetric]> {
  const common: Array<[string, FinancialMetric]> = [
    ['netMargin', analysis.profitability.netMargin],
    ['revenueGrowthYoY', analysis.growth.revenueGrowthYoY],
    ['debtToEquity', analysis.leverage.debtToEquity],
    ['currentRatio', analysis.liquidity.currentRatio],
    [
      'healthScore',
      {
        value: analysis.healthScore.overallScore,
        formula: 'Financial Health Score',
        unit: 'ratio',
        periodEndDate: analysis.healthScore.asOfPeriod,
        isBlended: false,
      },
    ],
  ];

  switch (intent) {
    case 'PROFITABILITY':
      return [
        ['grossMargin', analysis.profitability.grossMargin],
        ['operatingMargin', analysis.profitability.operatingMargin],
        ['netMargin', analysis.profitability.netMargin],
        ['returnOnEquity', analysis.profitability.returnOnEquity],
        ['returnOnAssets', analysis.profitability.returnOnAssets],
        ['returnOnCapitalEmployed', analysis.profitability.returnOnCapitalEmployed],
      ];
    case 'GROWTH':
      return [
        ['revenueGrowthYoY', analysis.growth.revenueGrowthYoY],
        ['grossProfitGrowthYoY', analysis.growth.grossProfitGrowthYoY],
        ['operatingIncomeGrowthYoY', analysis.growth.operatingIncomeGrowthYoY],
        ['netIncomeGrowthYoY', analysis.growth.netIncomeGrowthYoY],
        ['epsGrowthYoY', analysis.growth.epsGrowthYoY],
        ['freeCashFlowGrowthYoY', analysis.growth.freeCashFlowGrowthYoY],
      ];
    case 'VALUATION':
      return [
        ['peRatio', analysis.valuation.peRatio],
        ['priceToSales', analysis.valuation.priceToSales],
        ['priceToBook', analysis.valuation.priceToBook],
        ['evToEbitda', analysis.valuation.evToEbitda],
        ['priceToFreeCashFlow', analysis.valuation.priceToFreeCashFlow],
      ];
    case 'LIQUIDITY':
      return [
        ['currentRatio', analysis.liquidity.currentRatio],
        ['quickRatio', analysis.liquidity.quickRatio],
        ['cashRatio', analysis.liquidity.cashRatio],
        ['operatingCashFlowRatio', analysis.liquidity.operatingCashFlowRatio],
      ];
    case 'CASH_FLOW':
      return [
        ['freeCashFlowMargin', analysis.cashFlow.freeCashFlowMargin],
        ['freeCashFlowYield', analysis.cashFlow.freeCashFlowYield],
        ['operatingCashFlowToNetIncome', analysis.cashFlow.operatingCashFlowToNetIncome],
        ['capexToRevenue', analysis.cashFlow.capexToRevenue],
      ];
    case 'DEBT':
    case 'RISK':
      return [
        ['debtToEquity', analysis.leverage.debtToEquity],
        ['debtToAssets', analysis.leverage.debtToAssets],
        ['interestCoverageRatio', analysis.leverage.interestCoverageRatio],
        ['netDebtToEbitda', analysis.leverage.netDebtToEbitda],
        ['currentRatio', analysis.liquidity.currentRatio],
        ['operatingCashFlowToNetIncome', analysis.cashFlow.operatingCashFlowToNetIncome],
        ['revenueGrowthYoY', analysis.growth.revenueGrowthYoY],
      ];
    case 'HISTORICAL_PERFORMANCE':
      return common;
    case 'COMPARISON':
    case 'GENERAL':
      return [
        ['grossMargin', analysis.profitability.grossMargin],
        ['operatingMargin', analysis.profitability.operatingMargin],
        ['netMargin', analysis.profitability.netMargin],
        ['returnOnEquity', analysis.profitability.returnOnEquity],
        ['revenueGrowthYoY', analysis.growth.revenueGrowthYoY],
        ['netIncomeGrowthYoY', analysis.growth.netIncomeGrowthYoY],
        ['debtToEquity', analysis.leverage.debtToEquity],
        ['currentRatio', analysis.liquidity.currentRatio],
        ['freeCashFlowMargin', analysis.cashFlow.freeCashFlowMargin],
        ['peRatio', analysis.valuation.peRatio],
        ['priceToBook', analysis.valuation.priceToBook],
        [
          'healthScore',
          {
            value: analysis.healthScore.overallScore,
            formula: 'Financial Health Score',
            unit: 'ratio',
            periodEndDate: analysis.healthScore.asOfPeriod,
            isBlended: false,
          },
        ],
      ];
  }
}

async function buildSingleContext(
  symbol: string,
  exchange: string | undefined,
  intent: ResearchIntent,
): Promise<ResearchContext> {
  const instrument = resolveInstrument(symbol, exchange);
  let analysis: FinancialAnalysis;

  try {
    analysis = await financialService.getFinancialAnalysis({
      symbol: instrument.symbol,
      exchange: instrument.exchange,
      annualPeriods: 4,
    });
  } catch (error) {
    if (error instanceof AppError && error.statusCode < 500) {
      throw error;
    }

    throw new AppError(
      'AI_CONTEXT_UNAVAILABLE',
      `Verified financial data is unavailable for ${instrument.symbol}.`,
      503,
    );
  }

  const income = analysis.latestAnnual.income;
  const balanceSheet = analysis.latestAnnual.balanceSheet;
  const cashFlow = analysis.latestAnnual.cashFlow;
  const selectedMetrics = getMetricsForIntent(intent, analysis);
  const healthScoreDimensionEvidence: ResearchEvidence[] = Object.entries(
    analysis.healthScore.dimensions,
  ).map(([dimension, result]) => ({
    id: `health-score-${dimension}`,
    type: 'health_score',
    metric: `financialHealthScore.${dimension}`,
    value: result.score,
    unit: 'score',
    period: analysis.healthScore.asOfPeriod,
    periodType: 'annual',
    source: 'EquityLensAI deterministic health-score engine',
    timestamp: analysis.healthScore.scoredAt,
    freshness: 'periodic',
    stale: false,
  }));
  const evidence: ResearchEvidence[] = [
    {
      id: 'annual-period',
      type: 'statement',
      metric: 'annualStatementPeriod',
      value: analysis.latestAnnual.periodEndDate,
      unit: null,
      period: analysis.latestAnnual.periodEndDate,
      periodType: 'annual',
      source: analysis.latestAnnual.source,
      timestamp: analysis.latestAnnual.retrievedAt,
      freshness: analysis.isStale ? 'stale' : 'periodic',
      stale: analysis.isStale,
    },
    {
      id: 'revenue',
      type: 'statement',
      metric: 'totalRevenue',
      value: income.totalRevenue,
      unit: income.currency,
      period: income.periodEndDate,
      periodType: 'annual',
      source: income.source,
      timestamp: income.retrievedAt,
      freshness: analysis.isStale ? 'stale' : 'periodic',
      stale: analysis.isStale,
    },
    {
      id: 'net-income',
      type: 'statement',
      metric: 'netIncome',
      value: income.netIncome,
      unit: income.currency,
      period: income.periodEndDate,
      periodType: 'annual',
      source: income.source,
      timestamp: income.retrievedAt,
      freshness: analysis.isStale ? 'stale' : 'periodic',
      stale: analysis.isStale,
    },
    {
      id: 'cash-flow',
      type: 'statement',
      metric: 'operatingCashFlow',
      value: cashFlow.operatingCashFlow,
      unit: cashFlow.currency,
      period: cashFlow.periodEndDate,
      periodType: 'annual',
      source: cashFlow.source,
      timestamp: cashFlow.retrievedAt,
      freshness: analysis.isStale ? 'stale' : 'periodic',
      stale: analysis.isStale,
    },
    {
      id: 'total-debt',
      type: 'statement',
      metric: 'totalDebt',
      value:
        balanceSheet.shortTermDebt === null || balanceSheet.longTermDebt === null
          ? null
          : balanceSheet.shortTermDebt + balanceSheet.longTermDebt,
      unit: balanceSheet.currency,
      period: balanceSheet.periodEndDate,
      periodType: 'annual',
      source: balanceSheet.source,
      timestamp: balanceSheet.retrievedAt,
      freshness: analysis.isStale ? 'stale' : 'periodic',
      stale: analysis.isStale,
    },
    {
      id: 'health-score',
      type: 'health_score',
      metric: 'financialHealthScore',
      value: analysis.healthScore.overallScore,
      unit: 'score',
      period: analysis.healthScore.asOfPeriod,
      periodType: 'annual',
      source: 'EquityLensAI deterministic health-score engine',
      timestamp: analysis.healthScore.scoredAt,
      freshness: 'periodic',
      stale: false,
    },
    ...healthScoreDimensionEvidence,
    ...selectedMetrics.map(([name, metric]) => metricEvidence(name, name, metric, analysis)),
  ];

  const needsMarketPrice = intent === 'VALUATION';
  if (needsMarketPrice) {
    try {
      const quote = await marketService.getQuote({
        symbol: instrument.symbol,
        exchange: instrument.exchange,
      });
      evidence.push({
        id: 'market-price',
        type: 'market_quote',
        metric: 'price',
        value: quote.price,
        unit: quote.currency,
        period: quote.observedAt,
        source: quote.source,
        timestamp: quote.retrievedAt,
        freshness: quote.freshness,
        stale: quote.isStale,
      });
    } catch (error) {
      if (!(error instanceof AppError)) {
        throw error;
      }

      evidence.push({
        id: 'market-price',
        type: 'market_quote',
        metric: 'price',
        value: null,
        unit: instrument.currency,
        period: null,
        source: 'unavailable',
        timestamp: null,
      });
    }
  }

  const missingData = evidence
    .filter((item) => item.value === null)
    .map((item) => `${item.metric} is unavailable for the supplied reporting period.`);

  missingData.push(
    'The available financial provider data does not identify consolidated versus standalone reporting scope.',
  );
  missingData.push(
    'Verified news, company events, industry context, and management statements are not included in this research context.',
  );
  missingData.push(
    ...analysis.healthScore.dataQualityWarnings.map(
      (warning) => `Health score limitation: ${warning}.`,
    ),
  );
  if (analysis.isStale || analysis.latestAnnual.isStale) {
    missingData.push('Financial evidence is stale and may not reflect the latest filing.');
  }

  return {
    instrument: { ...instrument, currency: analysis.currency },
    analysis,
    evidence,
    missingData: [...new Set(missingData)].slice(0, 20),
    coverage: {
      available: evidence.filter((item) => item.value !== null).length,
      total: evidence.length,
      period: analysis.latestAnnual.periodEndDate,
      currency: analysis.currency,
      stale: analysis.isStale || analysis.latestAnnual.isStale,
    },
  };
}

export async function buildResearchContext(
  request: ResearchRequest,
  intent: ResearchIntent,
): Promise<ResearchContext> {
  const context = await buildSingleContext(request.symbol, request.exchange, intent);
  if (
    /\b(news|event|management|ceo|guidance|industry|market share|competitor|forecast|target price|future price|next quarter)\b/i.test(
      request.question,
    )
  ) {
    context.missingData.push(
      'Part of this question asks for information outside verified platform data; it will not be inferred or estimated.',
    );
    context.missingData = [...new Set(context.missingData)].slice(0, 20);
  }

  if (
    /\b(peg ratio|altman z|discounted cash flow|dcf valuation|dividend yield|beta|sharpe ratio|short interest|intrinsic value)\b/i.test(
      request.question,
    )
  ) {
    context.missingData.push(
      'The question requests a metric or valuation method that is not currently supported by the deterministic calculation services.',
    );
    context.missingData = [...new Set(context.missingData)].slice(0, 20);
  }

  if (request.comparisonInstrument) {
    const comparisonInstrument = resolveInstrument(
      request.comparisonInstrument.symbol,
      request.comparisonInstrument.exchange,
    );
    if (
      comparisonInstrument.symbol === context.instrument.symbol &&
      comparisonInstrument.exchange === context.instrument.exchange
    ) {
      throw new AppError('VALIDATION_ERROR', 'Choose a different instrument to compare.', 400);
    }
    const comparison = await buildSingleContext(
      comparisonInstrument.symbol,
      comparisonInstrument.exchange,
      intent,
    );
    const compatible =
      context.instrument.currency === comparison.instrument.currency &&
      context.coverage.period === comparison.coverage.period;

    if (!compatible) {
      context.missingData.push(
        'Comparison is limited: reporting periods or currencies are incompatible. Values are not converted or ranked.',
      );
    } else {
      const primaryByMetric = new Map(context.evidence.map((item) => [item.metric, item]));
      const compatibleComparisonEvidence = comparison.evidence.map((item) => {
        const primary = primaryByMetric.get(item.metric);
        const periodsMatch =
          !primary || (primary.period === item.period && primary.periodType === item.periodType);
        if (!periodsMatch) {
          context.missingData.push(
            `${item.metric} comparison is omitted because the reporting periods are incompatible.`,
          );
        }

        return {
          ...item,
          id: `comparison-${item.id}`,
          metric: `${comparison.instrument.symbol}.${item.metric}`,
          value: periodsMatch ? item.value : null,
        };
      });
      context.evidence.push(...compatibleComparisonEvidence);

      const comparisonByMetric = new Map(
        compatibleComparisonEvidence.map((item) => [
          item.metric.slice(comparison.instrument.symbol.length + 1),
          item,
        ]),
      );
      for (const primary of context.evidence) {
        if (primary.type !== 'metric' || typeof primary.value !== 'number') {
          continue;
        }

        const comparable = comparisonByMetric.get(primary.metric);
        if (
          !comparable ||
          comparable.value === null ||
          typeof comparable.value !== 'number' ||
          comparable.unit !== primary.unit ||
          comparable.period !== primary.period ||
          comparable.periodType !== primary.periodType
        ) {
          continue;
        }

        context.evidence.push({
          id: `comparison-delta-${primary.id}`,
          type: 'metric',
          metric: `${comparison.instrument.symbol} minus ${context.instrument.symbol}: ${primary.metric}`,
          value: comparable.value - primary.value,
          unit: primary.unit,
          period: primary.period,
          periodType: primary.periodType,
          source: 'EquityLensAI deterministic comparison',
          timestamp: comparison.analysis.retrievedAt,
          freshness: comparison.analysis.isStale || context.analysis.isStale ? 'stale' : 'periodic',
          stale: comparison.analysis.isStale || context.analysis.isStale,
          calculationVersion: '1.0',
        });
      }

      context.coverage.stale ||= comparison.coverage.stale;
      context.missingData.push(
        `Comparison evidence for ${comparison.instrument.symbol} uses the same reporting date and currency; no categorical company ranking is provided.`,
      );
    }

    context.comparisonInstrument = comparison.instrument;
    context.missingData = [...new Set(context.missingData)].slice(0, 20);
  }

  if (intent === 'COMPARISON' && !request.comparisonInstrument) {
    context.missingData.push(
      'Comparison was not performed because a second supported instrument was not provided.',
    );
  }

  if (intent === 'HISTORICAL_PERFORMANCE') {
    const end = new Date();
    const start = new Date(end);
    start.setUTCFullYear(start.getUTCFullYear() - 1);

    try {
      const history = await marketService.getHistoricalPrices({
        symbol: context.instrument.symbol,
        exchange: context.instrument.exchange,
        interval: 'ONE_DAY',
        from: start.toISOString(),
        to: end.toISOString(),
      });
      const candles = history.candles
        .filter((candle) => Number.isFinite(candle.close))
        .sort((a, b) => a.timestamp.localeCompare(b.timestamp));
      const first = candles[0];
      const last = candles[candles.length - 1];
      const adjusted = Boolean(first?.adjustedClose && last?.adjustedClose);
      const startPrice = adjusted ? first?.adjustedClose : first?.close;
      const endPrice = adjusted ? last?.adjustedClose : last?.close;

      if (first && last && startPrice && endPrice && startPrice > 0) {
        context.evidence.push({
          id: 'historical-return-1y',
          type: 'market_history',
          metric: adjusted ? 'oneYearAdjustedPriceReturn' : 'oneYearUnadjustedPriceChange',
          value: ((endPrice - startPrice) / startPrice) * 100,
          unit: 'percent',
          period: `${first.timestamp}/${last.timestamp}`,
          source: history.source,
          timestamp: history.retrievedAt,
          freshness: 'historical',
          stale: false,
        });
        if (!adjusted) {
          context.missingData.push(
            'Historical price change uses unadjusted closing prices; dividends and corporate actions may not be reflected.',
          );
        }
      } else {
        context.evidence.push({
          id: 'historical-return-1y',
          type: 'market_history',
          metric: 'oneYearPriceReturn',
          value: null,
          unit: 'percent',
          period: null,
          source: history.source,
          timestamp: history.retrievedAt,
        });
        context.missingData.push(
          'Insufficient historical price observations to calculate a one-year return.',
        );
      }
    } catch (error) {
      if (!(error instanceof AppError)) {
        throw error;
      }

      context.evidence.push({
        id: 'historical-return-1y',
        type: 'market_history',
        metric: 'oneYearPriceReturn',
        value: null,
        unit: 'percent',
        period: null,
        source: 'unavailable',
        timestamp: null,
      });
      context.missingData.push('Historical market data is unavailable for this instrument.');
    }
  }

  if (context.evidence.length > 60) {
    throw new AppError(
      'AI_CONTEXT_UNAVAILABLE',
      'Evidence context exceeds the supported size limit.',
      503,
    );
  }

  context.coverage.total = context.evidence.length;
  context.coverage.available = context.evidence.filter((item) => item.value !== null).length;

  return context;
}
