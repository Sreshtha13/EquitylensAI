'use client';

import { useState } from 'react';
import { InstrumentSearch } from '@/components/market/InstrumentSearch';
import { useCreateAlert, usePreviewAlert } from '@/hooks/useAlerts';
import type {
  AlertType,
  AlertRuleConfig,
  PriceCondition,
  PercentageChangePeriod,
  PercentageDirection,
  FinancialAlertMetric,
  ComparisonOperator,
  AnnouncementCategory,
  SupportedExchange,
  DeliveryChannel,
} from '@equitylensai/shared';

const ANNOUNCEMENT_OPTIONS: AnnouncementCategory[] = [
  'financial_results',
  'dividend',
  'board_meetings',
  'bonus_issue',
  'stock_split',
  'rights_issue',
  'fundraising',
  'mergers_acquisitions',
  'shareholding_pattern',
  'management_changes',
  'credit_rating',
  'governance',
  'regulatory',
  'updates',
  'general',
];

const METRIC_LABELS: Record<FinancialAlertMetric, string> = {
  roe: 'Return on Equity (ROE %)',
  roce: 'Return on Capital Employed (ROCE %)',
  operatingMargin: 'Operating Profit Margin (%)',
  netMargin: 'Net Profit Margin (%)',
  debtToEquity: 'Debt-to-Equity Ratio',
  freeCashFlow: 'Free Cash Flow',
  peRatio: 'P/E Ratio',
  pbRatio: 'P/B Ratio',
  currentRatio: 'Current Ratio',
};

const CATEGORIES: { type: AlertType; label: string; badge: string }[] = [
  { type: 'price', label: 'Price Level', badge: 'Quotes' },
  { type: 'percentage_change', label: '% Movement', badge: 'Momentum' },
  { type: 'volume', label: 'Volume Spike', badge: 'Volume' },
  { type: 'unusual_volume', label: 'Unusual Volume', badge: 'Volume' },
  { type: 'rsi', label: 'RSI Oscillator', badge: 'Technicals' },
  { type: 'macd', label: 'MACD Cross', badge: 'Technicals' },
  { type: 'moving_average', label: 'Moving Avg (DMA)', badge: 'Technicals' },
  { type: '52w_high_low', label: '52W High / Low', badge: 'Range' },
  { type: 'circuit', label: 'Circuit Limits', badge: 'Limit' },
  { type: 'announcement', label: 'Disclosures', badge: 'Corporate' },
  { type: 'corporate_action', label: 'Dividend / Splits', badge: 'Corporate' },
  { type: 'financial_results', label: 'Quarterly Results', badge: 'Corporate' },
  { type: 'financial_metric', label: 'Fundamental Ratios', badge: 'Fundamentals' },
  { type: 'index_movement', label: 'Index Benchmark', badge: 'Market' },
  { type: 'watchlist_event', label: 'Watchlist Events', badge: 'Portfolio' },
  { type: 'news', label: 'Market News', badge: 'News' },
];

type CreateAlertModalProps = {
  isOpen: boolean;
  onClose: () => void;
  initialSymbol?: string;
  initialExchange?: SupportedExchange;
};

export function CreateAlertModal({
  isOpen,
  onClose,
  initialSymbol,
  initialExchange = 'NSE',
}: CreateAlertModalProps) {
  const [name, setName] = useState('');
  const [alertType, setAlertType] = useState<AlertType>('price');
  const [symbol, setSymbol] = useState(initialSymbol || '');
  const [exchange, setExchange] = useState<SupportedExchange>(initialExchange);
  const [cooldownMinutes, setCooldownMinutes] = useState(60);
  const [triggerType, setTriggerType] = useState<'one_time' | 'recurring'>('recurring');
  const [expiryOption, setExpiryOption] = useState<'never' | '7d' | '30d' | '90d' | '1y'>('30d');
  const [channels, setChannels] = useState<DeliveryChannel[]>(['in_app']);

  // Price Alert Fields
  const [priceCondition, setPriceCondition] = useState<PriceCondition>('crosses_above');
  const [targetPrice, setTargetPrice] = useState('');

  // Percentage Change Fields
  const [period, setPeriod] = useState<PercentageChangePeriod>('1d');
  const [direction, setDirection] = useState<PercentageDirection>('up');
  const [targetPercent, setTargetPercent] = useState('');

  // Volume Alert Fields
  const [targetVolume, setTargetVolume] = useState('');

  // Unusual Volume Fields
  const [volumeMultiplier, setVolumeMultiplier] = useState('2.0');
  const [volumeBaselineDays, setVolumeBaselineDays] = useState('20');

  // RSI Fields
  const [rsiCondition, setRsiCondition] = useState<'overbought' | 'oversold' | 'crosses_above' | 'crosses_below'>('crosses_above');
  const [rsiThreshold, setRsiThreshold] = useState('70');

  // MACD Fields
  const [macdCondition, setMacdCondition] = useState<'bullish_crossover' | 'bearish_crossover'>('bullish_crossover');

  // Moving Average Fields
  const [maPeriod, setMaPeriod] = useState<'20' | '50' | '200'>('50');
  const [maCrossType, setMaCrossType] = useState<'price_crosses_above' | 'price_crosses_below' | 'golden_cross' | 'death_cross'>('price_crosses_above');

  // 52W High/Low Fields
  const [hlCondition, setHlCondition] = useState<'new_52w_high' | 'new_52w_low' | 'within_percent_of_high' | 'within_percent_of_low'>('new_52w_high');

  // Circuit Fields
  const [circuitCondition, setCircuitCondition] = useState<'upper_circuit' | 'lower_circuit'>('upper_circuit');

  // Corporate Action Fields
  const [actionType, setActionType] = useState<'dividend' | 'bonus_issue' | 'stock_split' | 'rights_issue'>('dividend');

  // Index Movement Fields
  const [indexName, setIndexName] = useState<'NIFTY 50' | 'SENSEX' | 'BANKNIFTY'>('NIFTY 50');
  const [indexPercent, setIndexPercent] = useState('1.5');
  const [indexDirection, setIndexDirection] = useState<'up' | 'down' | 'any'>('any');

  // Watchlist Event Fields
  const [watchlistEventType, setWatchlistEventType] = useState<'price_movement' | 'announcement' | 'news'>('price_movement');
  const [watchlistPercent, setWatchlistPercent] = useState('3.0');

  // Financial Metric Fields
  const [metric, setMetric] = useState<FinancialAlertMetric>('roe');
  const [operator, setOperator] = useState<ComparisonOperator>('gt');
  const [thresholdValue, setThresholdValue] = useState('');

  // Announcement Fields
  const [annScope, setAnnScope] = useState<'stock' | 'watchlist'>('stock');
  const [selectedCategories, setSelectedCategories] = useState<AnnouncementCategory[]>([]);

  // Preview state & mutations
  const [previewResult, setPreviewResult] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const createAlertMutation = useCreateAlert();
  const previewAlertMutation = usePreviewAlert();

  if (!isOpen) return null;

  const toggleChannel = (ch: DeliveryChannel) => {
    if (channels.includes(ch)) {
      if (channels.length === 1 && ch === 'in_app') return; // in_app is mandatory
      setChannels(channels.filter((c) => c !== ch));
    } else {
      setChannels([...channels, ch]);
    }
  };

  const calculateExpiresAt = (): string | undefined => {
    if (expiryOption === 'never') return undefined;
    const daysMap = { '7d': 7, '30d': 30, '90d': 90, '1y': 365 };
    const days = daysMap[expiryOption] || 30;
    return new Date(Date.now() + days * 86400000).toISOString();
  };

  const buildRuleConfig = (): AlertRuleConfig => {
    switch (alertType) {
      case 'price':
        return {
          type: 'price',
          condition: priceCondition,
          targetPrice: parseFloat(targetPrice),
        };
      case 'percentage_change':
        return {
          type: 'percentage_change',
          period,
          direction,
          targetPercent: parseFloat(targetPercent),
        };
      case 'volume':
        return {
          type: 'volume',
          condition: 'exceeds',
          targetVolume: parseFloat(targetVolume),
        };
      case 'unusual_volume':
        return {
          type: 'unusual_volume',
          multiplier: parseFloat(volumeMultiplier) || 2.0,
          baselineDays: (parseInt(volumeBaselineDays) || 20) as 5 | 10 | 20,
        };
      case 'rsi':
        return {
          type: 'rsi',
          period: 14,
          condition: rsiCondition,
          threshold: parseFloat(rsiThreshold) || 70,
        };
      case 'macd':
        return {
          type: 'macd',
          fastPeriod: 12,
          slowPeriod: 26,
          signalPeriod: 9,
          condition: macdCondition,
        };
      case 'moving_average':
        return {
          type: 'moving_average',
          period: (parseInt(maPeriod) || 50) as 20 | 50 | 200,
          condition: maCrossType,
        };
      case '52w_high_low':
        return {
          type: '52w_high_low',
          condition: hlCondition,
          tolerancePercent: hlCondition.startsWith('within') ? 5 : undefined,
        };
      case 'circuit':
        return {
          type: 'circuit',
          condition: circuitCondition,
        };
      case 'corporate_action':
        return {
          type: 'corporate_action',
          actionType,
        };
      case 'financial_results':
        return {
          type: 'financial_results',
          scope: annScope,
        };
      case 'index_movement':
        return {
          type: 'index_movement',
          indexSymbol: indexName as any,
          condition: 'percent_change',
          threshold: parseFloat(indexPercent) || 1.5,
        };
      case 'watchlist_event':
        return {
          type: 'watchlist_event',
          eventType: watchlistEventType as any,
          thresholdPercent: watchlistEventType === 'price_movement' ? parseFloat(watchlistPercent) || 3.0 : undefined,
        };
      case 'financial_metric':
        return {
          type: 'financial_metric',
          metric,
          operator,
          thresholdValue: parseFloat(thresholdValue),
        };
      case 'announcement': {
        const cfg: { type: 'announcement'; scope: 'stock' | 'watchlist'; categories?: typeof selectedCategories } = {
          type: 'announcement',
          scope: annScope,
        };
        if (selectedCategories.length > 0) {
          cfg.categories = selectedCategories;
        }
        return cfg;
      }
      case 'news':
        return {
          type: 'news',
          scope: annScope,
        };
      default:
        return {
          type: 'price',
          condition: 'crosses_above',
          targetPrice: 100,
        };
    }
  };

  const validateInputs = (): string | null => {
    const symbolRequired = [
      'price',
      'percentage_change',
      'volume',
      'unusual_volume',
      'rsi',
      'macd',
      'moving_average',
      '52w_high_low',
      'circuit',
      'corporate_action',
      'financial_results',
      'financial_metric',
    ];

    if (symbolRequired.includes(alertType) && !symbol.trim()) {
      return 'Please select or enter a target stock symbol.';
    }

    if (alertType === 'price' && (!targetPrice || isNaN(parseFloat(targetPrice)) || parseFloat(targetPrice) <= 0)) {
      return 'Please enter a valid target price greater than 0.';
    }

    if (alertType === 'percentage_change' && (!targetPercent || isNaN(parseFloat(targetPercent)) || parseFloat(targetPercent) <= 0)) {
      return 'Please enter a valid target percentage movement.';
    }

    if (alertType === 'volume' && (!targetVolume || isNaN(parseFloat(targetVolume)) || parseFloat(targetVolume) <= 0)) {
      return 'Please enter a valid target volume threshold.';
    }

    if (alertType === 'financial_metric' && (!thresholdValue || isNaN(parseFloat(thresholdValue)))) {
      return 'Please enter a valid numeric threshold for the financial metric.';
    }

    return null;
  };

  const handlePreview = async () => {
    setErrorMsg(null);
    setPreviewResult(null);

    const validationErr = validateInputs();
    if (validationErr) {
      setErrorMsg(validationErr);
      return;
    }

    try {
      const config = buildRuleConfig();
      const res = await previewAlertMutation.mutateAsync({
        name: name.trim() || `${symbol || 'Market'} ${alertType.toUpperCase()} Alert`,
        alertType,
        symbol: symbol.trim() ? symbol.trim().toUpperCase() : undefined,
        exchange,
        cooldownMinutes,
        triggerType,
        deliveryChannels: channels,
        expiresAt: calculateExpiresAt(),
        ruleConfig: config,
      });

      setPreviewResult(res.explanation);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : String(err));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const validationErr = validateInputs();
    if (validationErr) {
      setErrorMsg(validationErr);
      return;
    }

    if (!name.trim()) {
      setErrorMsg('Please enter a descriptive alert rule name.');
      return;
    }

    try {
      const config = buildRuleConfig();
      await createAlertMutation.mutateAsync({
        name: name.trim(),
        alertType,
        symbol: symbol.trim() ? symbol.trim().toUpperCase() : undefined,
        exchange,
        cooldownMinutes,
        triggerType,
        deliveryChannels: channels,
        expiresAt: calculateExpiresAt(),
        ruleConfig: config,
      });
      onClose();
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : String(err));
    }
  };

  const toggleCategory = (cat: AnnouncementCategory) => {
    if (selectedCategories.includes(cat)) {
      setSelectedCategories(selectedCategories.filter((c) => c !== cat));
    } else {
      setSelectedCategories([...selectedCategories, cat]);
    }
  };

  const isStockScope =
    alertType !== 'index_movement' &&
    alertType !== 'watchlist_event' &&
    ((alertType !== 'announcement' && alertType !== 'news') || annScope === 'stock');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/80 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Modal Dialog */}
      <div className="relative z-10 w-full max-w-2xl max-h-[92vh] overflow-y-auto rounded-3xl border border-white/10 bg-slate-900 p-6 shadow-2xl backdrop-blur-2xl sm:p-7 text-white">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-white/10">
          <div>
            <h2 className="text-xl font-bold tracking-tight text-white">Create Deterministic Alert</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Live evaluation on verified exchange feeds, indicators & filings
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-2 text-slate-400 hover:bg-white/10 hover:text-white transition"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-5 space-y-5">
          {errorMsg && (
            <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-300">
              {errorMsg}
            </div>
          )}

          {/* 1. Category Selection */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-2">
              Alert Category ({CATEGORIES.length} Available)
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 max-h-48 overflow-y-auto p-1 rounded-xl bg-slate-950/30 border border-white/5">
              {CATEGORIES.map((tab) => (
                <button
                  key={tab.type}
                  type="button"
                  onClick={() => {
                    setAlertType(tab.type);
                    setPreviewResult(null);
                    if (!name && symbol) {
                      setName(`${symbol} ${tab.label}`);
                    }
                  }}
                  className={`rounded-xl border p-2 text-xs font-semibold transition text-left flex flex-col justify-between gap-1 ${
                    alertType === tab.type
                      ? 'border-sky-500 bg-sky-500/20 text-white shadow-sm ring-1 ring-sky-500'
                      : 'border-white/5 bg-slate-800/40 text-slate-400 hover:bg-white/5 hover:text-white'
                  }`}
                >
                  <span className="truncate">{tab.label}</span>
                  <span className="text-[9px] uppercase tracking-wider text-slate-500 font-mono">
                    {tab.badge}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* 2. Stock Selection */}
          {isStockScope && (
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Target Stock Symbol
              </label>
              <div className="flex gap-2">
                <div className="flex-1">
                  <InstrumentSearch
                    selectedSymbol={symbol}
                    onSelect={(inst) => {
                      setSymbol(inst.symbol);
                      if (inst.exchange) {
                        setExchange(inst.exchange as SupportedExchange);
                      }
                      if (!name) {
                        setName(`${inst.symbol} ${alertType.replace(/_/g, ' ').toUpperCase()}`);
                      }
                    }}
                  />
                </div>
                <select
                  value={exchange}
                  onChange={(e) => setExchange(e.target.value as SupportedExchange)}
                  className="rounded-xl border border-white/10 bg-slate-800 px-3 py-2 text-xs font-semibold text-white focus:outline-none focus:border-sky-500"
                >
                  <option value="NSE">NSE</option>
                  <option value="BSE">BSE</option>
                  <option value="US">US</option>
                </select>
              </div>
            </div>
          )}

          {/* Announcement / News Scope */}
          {(alertType === 'announcement' || alertType === 'news') && (
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Monitoring Scope
              </label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                  <input
                    type="radio"
                    name="scope"
                    value="stock"
                    checked={annScope === 'stock'}
                    onChange={() => setAnnScope('stock')}
                    className="text-sky-500 focus:ring-0"
                  />
                  Specific Stock
                </label>
                <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                  <input
                    type="radio"
                    name="scope"
                    value="watchlist"
                    checked={annScope === 'watchlist'}
                    onChange={() => setAnnScope('watchlist')}
                    className="text-sky-500 focus:ring-0"
                  />
                  All Stocks in My Watchlists
                </label>
              </div>
            </div>
          )}

          {/* 3. Category-Specific Fields */}
          {alertType === 'price' && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">Condition</label>
                <select
                  value={priceCondition}
                  onChange={(e) => setPriceCondition(e.target.value as PriceCondition)}
                  className="w-full rounded-xl border border-white/10 bg-slate-800 p-2.5 text-xs text-white focus:outline-none focus:border-sky-500"
                >
                  <option value="crosses_above">Crosses Above (State Transition)</option>
                  <option value="crosses_below">Crosses Below (State Transition)</option>
                  <option value="rises_above">Rises Above (Persistent)</option>
                  <option value="falls_below">Falls Below (Persistent)</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Threshold Price ({exchange === 'US' ? '$' : '₹'})
                </label>
                <input
                  type="number"
                  step="any"
                  placeholder="e.g. 4000"
                  value={targetPrice}
                  onChange={(e) => setTargetPrice(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-slate-800 p-2.5 text-xs text-white focus:outline-none focus:border-sky-500"
                  required
                />
              </div>
            </div>
          )}

          {alertType === 'percentage_change' && (
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">Direction</label>
                <select
                  value={direction}
                  onChange={(e) => setDirection(e.target.value as PercentageDirection)}
                  className="w-full rounded-xl border border-white/10 bg-slate-800 p-2.5 text-xs text-white focus:outline-none focus:border-sky-500"
                >
                  <option value="up">Rises by (+)</option>
                  <option value="down">Declines by (-)</option>
                  <option value="any">Any Movement (±)</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">Percentage (%)</label>
                <input
                  type="number"
                  step="any"
                  placeholder="e.g. 5"
                  value={targetPercent}
                  onChange={(e) => setTargetPercent(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-slate-800 p-2.5 text-xs text-white focus:outline-none focus:border-sky-500"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">Baseline Period</label>
                <select
                  value={period}
                  onChange={(e) => setPeriod(e.target.value as PercentageChangePeriod)}
                  className="w-full rounded-xl border border-white/10 bg-slate-800 p-2.5 text-xs text-white focus:outline-none focus:border-sky-500"
                >
                  <option value="1d">1 Day / Session</option>
                  <option value="1w">1 Week</option>
                  <option value="1m">1 Month</option>
                </select>
              </div>
            </div>
          )}

          {alertType === 'volume' && (
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Target Trading Volume (Shares)
              </label>
              <input
                type="number"
                step="1"
                placeholder="e.g. 1000000"
                value={targetVolume}
                onChange={(e) => setTargetVolume(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-slate-800 p-2.5 text-xs text-white focus:outline-none focus:border-sky-500"
                required
              />
            </div>
          )}

          {alertType === 'unusual_volume' && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">Volume Multiplier (vs Avg)</label>
                <select
                  value={volumeMultiplier}
                  onChange={(e) => setVolumeMultiplier(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-slate-800 p-2.5 text-xs text-white focus:outline-none focus:border-sky-500"
                >
                  <option value="1.5">1.5x (50% above average)</option>
                  <option value="2.0">2.0x (2x Average Volume)</option>
                  <option value="3.0">3.0x (3x Heavy Spike)</option>
                  <option value="5.0">5.0x (5x Ultra High Volume)</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">Baseline Window</label>
                <select
                  value={volumeBaselineDays}
                  onChange={(e) => setVolumeBaselineDays(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-slate-800 p-2.5 text-xs text-white focus:outline-none focus:border-sky-500"
                >
                  <option value="5">5-Day Moving Average</option>
                  <option value="10">10-Day Moving Average</option>
                  <option value="20">20-Day Moving Average (Standard)</option>
                </select>
              </div>
            </div>
          )}

          {alertType === 'rsi' && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">RSI Condition</label>
                <select
                  value={rsiCondition}
                  onChange={(e) => setRsiCondition(e.target.value as any)}
                  className="w-full rounded-xl border border-white/10 bg-slate-800 p-2.5 text-xs text-white focus:outline-none focus:border-sky-500"
                >
                  <option value="crosses_above">Crosses Above (Bullish Momentum)</option>
                  <option value="crosses_below">Crosses Below (Bearish Reversal)</option>
                  <option value="overbought">Overbought (&gt; 70)</option>
                  <option value="oversold">Oversold (&lt; 30)</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">Threshold Level (0 - 100)</label>
                <input
                  type="number"
                  min="1"
                  max="99"
                  value={rsiThreshold}
                  onChange={(e) => setRsiThreshold(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-slate-800 p-2.5 text-xs text-white focus:outline-none focus:border-sky-500"
                />
              </div>
            </div>
          )}

          {alertType === 'macd' && (
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">MACD Crossover Condition</label>
              <select
                value={macdCondition}
                onChange={(e) => setMacdCondition(e.target.value as any)}
                className="w-full rounded-xl border border-white/10 bg-slate-800 p-2.5 text-xs text-white focus:outline-none focus:border-sky-500"
              >
                <option value="bullish_crossover">Bullish Crossover (MACD crosses above Signal line)</option>
                <option value="bearish_crossover">Bearish Crossover (MACD crosses below Signal line)</option>
              </select>
            </div>
          )}

          {alertType === 'moving_average' && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">SMA Period</label>
                <select
                  value={maPeriod}
                  onChange={(e) => setMaPeriod(e.target.value as any)}
                  className="w-full rounded-xl border border-white/10 bg-slate-800 p-2.5 text-xs text-white focus:outline-none focus:border-sky-500"
                >
                  <option value="20">20 DMA (Short-term)</option>
                  <option value="50">50 DMA (Medium-term)</option>
                  <option value="200">200 DMA (Long-term / Trend)</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">Crossover Type</label>
                <select
                  value={maCrossType}
                  onChange={(e) => setMaCrossType(e.target.value as any)}
                  className="w-full rounded-xl border border-white/10 bg-slate-800 p-2.5 text-xs text-white focus:outline-none focus:border-sky-500"
                >
                  <option value="price_crosses_above">Price Crosses Above SMA</option>
                  <option value="price_crosses_below">Price Crosses Below SMA</option>
                  <option value="golden_cross">Golden Cross (50 DMA crosses above 200 DMA)</option>
                  <option value="death_cross">Death Cross (50 DMA crosses below 200 DMA)</option>
                </select>
              </div>
            </div>
          )}

          {alertType === '52w_high_low' && (
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">52-Week Range Condition</label>
              <select
                value={hlCondition}
                onChange={(e) => setHlCondition(e.target.value as any)}
                className="w-full rounded-xl border border-white/10 bg-slate-800 p-2.5 text-xs text-white focus:outline-none focus:border-sky-500"
              >
                <option value="new_52w_high">Hits New 52-Week High</option>
                <option value="new_52w_low">Hits New 52-Week Low</option>
                <option value="within_percent_of_high">Trading Within 5% of 52-Week High</option>
                <option value="within_percent_of_low">Trading Within 5% of 52-Week Low</option>
              </select>
            </div>
          )}

          {alertType === 'circuit' && (
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">Circuit Limit Condition</label>
              <select
                value={circuitCondition}
                onChange={(e) => setCircuitCondition(e.target.value as any)}
                className="w-full rounded-xl border border-white/10 bg-slate-800 p-2.5 text-xs text-white focus:outline-none focus:border-sky-500"
              >
                <option value="upper_circuit">Stock Hits Upper Circuit (Lock)</option>
                <option value="lower_circuit">Stock Hits Lower Circuit (Lock)</option>
              </select>
            </div>
          )}

          {alertType === 'corporate_action' && (
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">Action Type</label>
              <select
                value={actionType}
                onChange={(e) => setActionType(e.target.value as any)}
                className="w-full rounded-xl border border-white/10 bg-slate-800 p-2.5 text-xs text-white focus:outline-none focus:border-sky-500"
              >
                <option value="dividend">Dividend Declaration</option>
                <option value="bonus_issue">Bonus Issue</option>
                <option value="stock_split">Stock Split</option>
                <option value="rights_issue">Rights Issue</option>
              </select>
            </div>
          )}

          {alertType === 'financial_results' && (
            <div className="rounded-xl border border-white/10 bg-slate-800/50 p-3 text-xs text-slate-300">
              Notifies automatically whenever the company files quarterly or annual audited results with the exchange.
            </div>
          )}

          {alertType === 'index_movement' && (
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">Benchmark Index</label>
                <select
                  value={indexName}
                  onChange={(e) => setIndexName(e.target.value as any)}
                  className="w-full rounded-xl border border-white/10 bg-slate-800 p-2.5 text-xs text-white focus:outline-none focus:border-sky-500"
                >
                  <option value="NIFTY 50">NIFTY 50</option>
                  <option value="SENSEX">SENSEX</option>
                  <option value="BANKNIFTY">BANKNIFTY</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">Move %</label>
                <input
                  type="number"
                  step="0.1"
                  value={indexPercent}
                  onChange={(e) => setIndexPercent(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-slate-800 p-2.5 text-xs text-white focus:outline-none focus:border-sky-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">Direction</label>
                <select
                  value={indexDirection}
                  onChange={(e) => setIndexDirection(e.target.value as any)}
                  className="w-full rounded-xl border border-white/10 bg-slate-800 p-2.5 text-xs text-white focus:outline-none focus:border-sky-500"
                >
                  <option value="up">Gain (+)</option>
                  <option value="down">Drop (-)</option>
                  <option value="any">Any Movement (±)</option>
                </select>
              </div>
            </div>
          )}

          {alertType === 'watchlist_event' && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">Event Type</label>
                <select
                  value={watchlistEventType}
                  onChange={(e) => setWatchlistEventType(e.target.value as any)}
                  className="w-full rounded-xl border border-white/10 bg-slate-800 p-2.5 text-xs text-white focus:outline-none focus:border-sky-500"
                >
                  <option value="price_movement">Significant Price Move (&gt; threshold %)</option>
                  <option value="announcement">New Exchange Filing</option>
                  <option value="news">Important News Article</option>
                </select>
              </div>
              {watchlistEventType === 'price_movement' && (
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">Movement Threshold (%)</label>
                  <input
                    type="number"
                    step="0.5"
                    value={watchlistPercent}
                    onChange={(e) => setWatchlistPercent(e.target.value)}
                    className="w-full rounded-xl border border-white/10 bg-slate-800 p-2.5 text-xs text-white focus:outline-none focus:border-sky-500"
                  />
                </div>
              )}
            </div>
          )}

          {alertType === 'financial_metric' && (
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">Financial Metric</label>
                <select
                  value={metric}
                  onChange={(e) => setMetric(e.target.value as FinancialAlertMetric)}
                  className="w-full rounded-xl border border-white/10 bg-slate-800 p-2.5 text-xs text-white focus:outline-none focus:border-sky-500"
                >
                  {Object.entries(METRIC_LABELS).map(([k, label]) => (
                    <option key={k} value={k}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">Comparison</label>
                <select
                  value={operator}
                  onChange={(e) => setOperator(e.target.value as ComparisonOperator)}
                  className="w-full rounded-xl border border-white/10 bg-slate-800 p-2.5 text-xs text-white focus:outline-none focus:border-sky-500"
                >
                  <option value="gt">&gt; Greater than</option>
                  <option value="gte">&gt;= Greater or equal</option>
                  <option value="lt">&lt; Less than</option>
                  <option value="lte">&lt;= Less or equal</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">Threshold</label>
                <input
                  type="number"
                  step="any"
                  placeholder="e.g. 15"
                  value={thresholdValue}
                  onChange={(e) => setThresholdValue(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-slate-800 p-2.5 text-xs text-white focus:outline-none focus:border-sky-500"
                  required
                />
              </div>
            </div>
          )}

          {alertType === 'announcement' && (
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-2">
                Announcement Categories (optional filter)
              </label>
              <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto p-2 rounded-xl bg-slate-950/40 border border-white/5">
                {ANNOUNCEMENT_OPTIONS.map((cat) => {
                  const isSelected = selectedCategories.includes(cat);
                  return (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => toggleCategory(cat)}
                      className={`rounded-lg px-2.5 py-1 text-[11px] font-medium transition ${
                        isSelected
                          ? 'bg-sky-500 text-white font-semibold'
                          : 'bg-white/5 text-slate-400 hover:text-white'
                      }`}
                    >
                      {cat.replace(/_/g, ' ')}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* 4. Trigger Mode, Expiry & Channels */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-2 border-t border-white/10">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Trigger Mode</label>
              <select
                value={triggerType}
                onChange={(e) => setTriggerType(e.target.value as any)}
                className="w-full rounded-xl border border-white/10 bg-slate-800 p-2.5 text-xs text-white focus:outline-none focus:border-sky-500"
              >
                <option value="recurring">Recurring (Crossing Detection)</option>
                <option value="one_time">One-Time (Auto-Disarm)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Expiry Schedule</label>
              <select
                value={expiryOption}
                onChange={(e) => setExpiryOption(e.target.value as any)}
                className="w-full rounded-xl border border-white/10 bg-slate-800 p-2.5 text-xs text-white focus:outline-none focus:border-sky-500"
              >
                <option value="never">No Expiry (Indefinite)</option>
                <option value="7d">Expire in 7 days</option>
                <option value="30d">Expire in 30 days</option>
                <option value="90d">Expire in 90 days</option>
                <option value="1y">Expire in 1 year</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Cooldown (Mins)</label>
              <input
                type="number"
                min="0"
                max="43200"
                value={cooldownMinutes}
                onChange={(e) => setCooldownMinutes(parseInt(e.target.value) || 0)}
                className="w-full rounded-xl border border-white/10 bg-slate-800 p-2.5 text-xs text-white focus:outline-none focus:border-sky-500"
              />
            </div>
          </div>

          {/* Delivery Channels */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Notification Delivery Channels
            </label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={channels.includes('in_app')}
                  disabled
                  className="rounded border-white/20 bg-slate-800 text-sky-500"
                />
                In-App Notification (Mandatory)
              </label>
              <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={channels.includes('email')}
                  onChange={() => toggleChannel('email')}
                  className="rounded border-white/20 bg-slate-800 text-sky-500"
                />
                Email Alert Delivery
              </label>
            </div>
          </div>

          {/* 5. Rule Name */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Alert Rule Name</label>
            <input
              type="text"
              placeholder="e.g. TCS Cross 4000 Resistance"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-slate-800 p-2.5 text-xs text-white focus:outline-none focus:border-sky-500"
              required
            />
          </div>

          {/* Preview Output */}
          {previewResult && (
            <div className="rounded-xl border border-sky-500/30 bg-sky-500/10 p-3 text-xs text-sky-200">
              <span className="font-bold">Live Condition Check: </span>
              {previewResult}
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center justify-between pt-4 border-t border-white/10">
            <button
              type="button"
              onClick={handlePreview}
              disabled={previewAlertMutation.isPending}
              className="rounded-xl border border-white/10 bg-slate-800 px-4 py-2.5 text-xs font-semibold text-slate-300 hover:bg-white/10 hover:text-white transition"
            >
              {previewAlertMutation.isPending ? 'Checking...' : 'Check Live Preview'}
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl px-4 py-2.5 text-xs font-semibold text-slate-400 hover:text-white transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={createAlertMutation.isPending}
                className="rounded-xl bg-gradient-to-r from-sky-500 to-indigo-600 px-5 py-2.5 text-xs font-bold text-white shadow-lg shadow-sky-500/25 hover:opacity-90 disabled:opacity-50 transition"
              >
                {createAlertMutation.isPending ? 'Saving Alert...' : 'Create Alert'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
