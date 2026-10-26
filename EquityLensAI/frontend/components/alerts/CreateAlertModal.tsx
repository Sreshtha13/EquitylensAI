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

  // Price Alert Fields
  const [priceCondition, setPriceCondition] = useState<PriceCondition>('crosses_above');
  const [targetPrice, setTargetPrice] = useState('');

  // Percentage Change Fields
  const [period, setPeriod] = useState<PercentageChangePeriod>('1d');
  const [direction, setDirection] = useState<PercentageDirection>('up');
  const [targetPercent, setTargetPercent] = useState('');

  // Volume Alert Fields
  const [targetVolume, setTargetVolume] = useState('');

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
    }
  };

  const handlePreview = async () => {
    setErrorMsg(null);
    setPreviewResult(null);

    const requiresSymbol = ['price', 'percentage_change', 'volume', 'financial_metric'];
    if (requiresSymbol.includes(alertType) && !symbol.trim()) {
      setErrorMsg('Please select or enter a stock symbol.');
      return;
    }

    try {
      const config = buildRuleConfig();
      const res = await previewAlertMutation.mutateAsync({
        name: name.trim() || `${symbol} Alert`,
        alertType,
        symbol: symbol.trim() || undefined,
        exchange,
        cooldownMinutes,
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

    const requiresSymbol = ['price', 'percentage_change', 'volume', 'financial_metric'];
    if (requiresSymbol.includes(alertType) && !symbol.trim()) {
      setErrorMsg('Please select or enter a stock symbol.');
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/80 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Modal Dialog */}
      <div className="relative z-10 w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-3xl border border-white/10 bg-slate-900 p-6 shadow-2xl backdrop-blur-2xl sm:p-8 text-white">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-white/10">
          <div>
            <h2 className="text-xl font-bold tracking-tight text-white">Create Real-Time Alert</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Deterministic monitoring on verified exchange feeds & financial statements
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

          {/* 1. Alert Type Selection */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-2">
              Alert Category
            </label>
            <div className="grid grid-cols-3 gap-2">
              {(
                [
                  { type: 'price', label: 'Price Level' },
                  { type: 'percentage_change', label: '% Movement' },
                  { type: 'volume', label: 'Volume Spike' },
                  { type: 'financial_metric', label: 'Fundamental Ratio' },
                  { type: 'announcement', label: 'Disclosures' },
                  { type: 'news', label: 'News Feed' },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.type}
                  type="button"
                  onClick={() => {
                    setAlertType(tab.type);
                    setPreviewResult(null);
                  }}
                  className={`rounded-xl border p-2.5 text-xs font-semibold transition text-center ${
                    alertType === tab.type
                      ? 'border-sky-500 bg-sky-500/20 text-white shadow-sm'
                      : 'border-white/10 bg-slate-800/50 text-slate-400 hover:bg-white/5 hover:text-white'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* 2. Stock Selection (if applicable) */}
          {(alertType !== 'announcement' && alertType !== 'news') || annScope === 'stock' ? (
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
                        setName(`${inst.symbol} ${alertType.toUpperCase()} Alert`);
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
          ) : null}

          {/* Scope for Announcements / News */}
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

          {/* 3. Type-Specific Form Controls */}
          {alertType === 'price' && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Condition
                </label>
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
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Direction
                </label>
                <select
                  value={direction}
                  onChange={(e) => setDirection(e.target.value as PercentageDirection)}
                  className="w-full rounded-xl border border-white/10 bg-slate-800 p-2.5 text-xs text-white focus:outline-none focus:border-sky-500"
                >
                  <option value="up">Rises by (+)</option>
                  <option value="down">Declines by (-)</option>
                  <option value="any">Any Movement (+/-)</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Percentage (%)
                </label>
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
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Baseline
                </label>
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

          {alertType === 'financial_metric' && (
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Financial Metric
                </label>
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
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Comparison
                </label>
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
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Threshold
                </label>
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
              <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto p-2 rounded-xl bg-slate-950/40 border border-white/5">
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

          {/* 4. Rule Name & Cooldown */}
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Alert Name
              </label>
              <input
                type="text"
                placeholder="e.g. TCS Cross 4000 Resistance"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-slate-800 p-2.5 text-xs text-white focus:outline-none focus:border-sky-500"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Cooldown (Mins)
              </label>
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
