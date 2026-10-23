'use client';

import { useState, useEffect } from 'react';
import { InstrumentSearch } from '@/components/market/InstrumentSearch';
import { useAddTransaction, useUpdateTransaction, usePortfolios } from '@/hooks/usePortfolio';
import type {
  PortfolioTransaction,
  PortfolioTransactionType,
  SupportedCurrency,
  SupportedExchange,
  InstrumentSummary,
} from '@equitylensai/shared';

type TransactionModalProps = {
  isOpen: boolean;
  onClose: () => void;
  portfolioId?: string | undefined;
  initialSymbol?: string | undefined;
  initialExchange?: string | undefined;
  initialPrice?: number | undefined;
  editingTransaction?: PortfolioTransaction | null | undefined;
  onSuccess?: (() => void) | undefined;
};

const TRANSACTION_TYPES: Array<{ type: PortfolioTransactionType; label: string; desc: string }> = [
  { type: 'BUY', label: 'Buy Stock', desc: 'Record a purchase of shares' },
  { type: 'SELL', label: 'Sell Stock', desc: 'Record a sale from existing holdings' },
  { type: 'DIVIDEND', label: 'Dividend', desc: 'Cash dividend receipt from an investment' },
  { type: 'DEPOSIT', label: 'Cash Deposit', desc: 'Transfer funds into portfolio cash' },
  { type: 'WITHDRAWAL', label: 'Cash Withdrawal', desc: 'Withdraw funds from portfolio cash' },
  { type: 'FEE', label: 'Expense / Fee', desc: 'Management fee or transaction cost' },
  { type: 'SPLIT', label: 'Stock Split', desc: 'Adjust share count via corporate action split' },
];

export function TransactionModal({
  isOpen,
  onClose,
  portfolioId: propPortfolioId,
  initialSymbol,
  initialExchange,
  initialPrice,
  editingTransaction,
  onSuccess,
}: TransactionModalProps) {
  const { data: portfolios = [] } = usePortfolios();
  const [selectedPortfolioId, setSelectedPortfolioId] = useState<string>(
    propPortfolioId || editingTransaction?.portfolioId || (portfolios[0]?.id ?? ''),
  );

  const [type, setType] = useState<PortfolioTransactionType>(editingTransaction?.type || 'BUY');
  const [symbol, setSymbol] = useState<string>(
    editingTransaction?.symbol || initialSymbol || '',
  );
  const [exchange, setExchange] = useState<SupportedExchange>(
    editingTransaction?.exchange || (initialExchange as SupportedExchange) || 'NSE',
  );
  const [quantity, setQuantity] = useState<string>(
    editingTransaction ? String(editingTransaction.quantity) : '1',
  );
  const [price, setPrice] = useState<string>(
    editingTransaction
      ? String(editingTransaction.price)
      : initialPrice !== undefined && initialPrice !== null
        ? String(initialPrice)
        : '',
  );
  const [fees, setFees] = useState<string>(
    editingTransaction ? String(editingTransaction.fees) : '0',
  );
  const [taxes, setTaxes] = useState<string>(
    editingTransaction ? String(editingTransaction.taxes) : '0',
  );
  const [tradeDate, setTradeDate] = useState<string>(
    editingTransaction?.tradeDate?.split('T')[0] || new Date().toISOString().split('T')[0]!,
  );
  const [notes, setNotes] = useState<string>(editingTransaction?.notes || '');
  const [splitRatio, setSplitRatio] = useState<string>(
    editingTransaction?.splitRatio ? String(editingTransaction.splitRatio) : '2',
  );
  const [currency, setCurrency] = useState<SupportedCurrency>(
    editingTransaction?.currency || 'INR',
  );
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const addTxMutation = useAddTransaction();
  const updateTxMutation = useUpdateTransaction();

  useEffect(() => {
    if (editingTransaction) {
      setType(editingTransaction.type);
      setSymbol(editingTransaction.symbol || '');
      setExchange(editingTransaction.exchange || 'NSE');
      setQuantity(String(editingTransaction.quantity));
      setPrice(String(editingTransaction.price));
      setFees(String(editingTransaction.fees));
      setTaxes(String(editingTransaction.taxes));
      setTradeDate(editingTransaction.tradeDate.split('T')[0]!);
      setNotes(editingTransaction.notes || '');
      setSplitRatio(editingTransaction.splitRatio ? String(editingTransaction.splitRatio) : '2');
      setCurrency(editingTransaction.currency);
      setSelectedPortfolioId(editingTransaction.portfolioId);
    } else {
      if (initialSymbol) setSymbol(initialSymbol);
      if (initialExchange) setExchange(initialExchange as SupportedExchange);
      if (initialPrice !== undefined && initialPrice !== null) setPrice(String(initialPrice));
      if (propPortfolioId) setSelectedPortfolioId(propPortfolioId);
    }
  }, [editingTransaction, initialSymbol, initialExchange, initialPrice, propPortfolioId]);

  if (!isOpen) return null;

  const isStockTransaction = ['BUY', 'SELL', 'DIVIDEND', 'SPLIT'].includes(type);
  const isSplit = type === 'SPLIT';
  const isCashOnly = ['DEPOSIT', 'WITHDRAWAL', 'FEE'].includes(type);

  const numQty = parseFloat(quantity) || 0;
  const numPrice = parseFloat(price) || 0;
  const numFees = parseFloat(fees) || 0;
  const numTaxes = parseFloat(taxes) || 0;

  // Real-time estimated total cash preview
  let estimatedTotal = 0;
  let cashImpactLabel = 'Total Outflow';
  if (type === 'BUY') {
    estimatedTotal = numQty * numPrice + numFees + numTaxes;
    cashImpactLabel = 'Cash Outflow';
  } else if (type === 'SELL') {
    estimatedTotal = Math.max(0, numQty * numPrice - numFees - numTaxes);
    cashImpactLabel = 'Net Cash Proceeds';
  } else if (type === 'DIVIDEND') {
    estimatedTotal = numQty * numPrice > 0 ? numQty * numPrice : numPrice;
    cashImpactLabel = 'Dividend Inflow';
  } else if (type === 'DEPOSIT') {
    estimatedTotal = numPrice;
    cashImpactLabel = 'Cash Deposit';
  } else if (type === 'WITHDRAWAL') {
    estimatedTotal = numPrice;
    cashImpactLabel = 'Cash Withdrawal';
  } else if (type === 'FEE') {
    estimatedTotal = numFees > 0 ? numFees : numPrice;
    cashImpactLabel = 'Fee Expense';
  }

  const handleSelectInstrument = (item: InstrumentSummary) => {
    setSymbol(item.symbol);
    setExchange(item.exchange as SupportedExchange);
    if (item.currency === 'USD' || item.currency === 'INR') {
      setCurrency(item.currency as SupportedCurrency);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const targetPortfolioId = selectedPortfolioId || propPortfolioId;
    if (!targetPortfolioId) {
      setErrorMsg('Please select or create a portfolio first.');
      return;
    }

    if (isStockTransaction && !symbol.trim()) {
      setErrorMsg('Please enter or select a valid stock symbol.');
      return;
    }

    if (isSplit && (!splitRatio || parseFloat(splitRatio) <= 0)) {
      setErrorMsg('Please provide a positive stock split ratio.');
      return;
    }

    try {
      if (editingTransaction) {
        await updateTxMutation.mutateAsync({
          portfolioId: targetPortfolioId,
          transactionId: editingTransaction.id,
          body: {
            type,
            symbol: isStockTransaction ? symbol.trim().toUpperCase() : null,
            exchange: isStockTransaction ? exchange : null,
            quantity: isSplit ? 0 : numQty,
            price: isSplit ? 0 : numPrice,
            currency,
            fees: numFees,
            taxes: numTaxes,
            tradeDate: new Date(tradeDate).toISOString(),
            notes: notes.trim() || null,
            splitRatio: isSplit ? parseFloat(splitRatio) : null,
          },
        });
      } else {
        await addTxMutation.mutateAsync({
          portfolioId: targetPortfolioId,
          body: {
            type,
            symbol: isStockTransaction ? symbol.trim().toUpperCase() : null,
            exchange: isStockTransaction ? exchange : null,
            quantity: isSplit ? 0 : numQty,
            price: isSplit ? 0 : numPrice,
            currency,
            fees: numFees,
            taxes: numTaxes,
            tradeDate: new Date(tradeDate).toISOString(),
            notes: notes.trim() || null,
            splitRatio: isSplit ? parseFloat(splitRatio) : null,
          },
        });
      }

      onSuccess?.();
      onClose();
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to save transaction');
    }
  };

  const isSubmitting = addTxMutation.isPending || updateTxMutation.isPending;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fadeIn">
      <div className="relative w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-3xl border border-white/10 bg-slate-900 p-6 sm:p-8 shadow-2xl scrollbar-none">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 pb-4">
          <div>
            <h2 className="text-lg font-bold text-white">
              {editingTransaction ? 'Edit Transaction' : 'Record Transaction'}
            </h2>
            <p className="text-xs text-slate-400">
              Deterministic accounting update to your authoritative ledger
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 hover:bg-white/5 hover:text-white transition"
          >
            ✕
          </button>
        </div>

        {errorMsg && (
          <div className="mt-4 rounded-xl border border-rose-500/20 bg-rose-500/10 p-3 text-xs text-rose-300">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-5">
          {/* Portfolio Selector (if multiple exist) */}
          {portfolios.length > 1 && !editingTransaction && (
            <div>
              <label className="text-xs font-semibold text-slate-300">Target Portfolio</label>
              <select
                value={selectedPortfolioId}
                onChange={(e) => setSelectedPortfolioId(e.target.value)}
                className="mt-1.5 w-full rounded-xl border border-white/10 bg-slate-950 px-3.5 py-2.5 text-xs text-white focus:border-sky-500 focus:outline-none"
              >
                {portfolios.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.baseCurrency})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Transaction Type Tabs */}
          <div>
            <label className="text-xs font-semibold text-slate-300">Transaction Type</label>
            <div className="mt-1.5 grid grid-cols-2 sm:grid-cols-4 gap-1.5">
              {TRANSACTION_TYPES.map((t) => (
                <button
                  type="button"
                  key={t.type}
                  onClick={() => setType(t.type)}
                  className={`rounded-xl px-2.5 py-2 text-xs font-semibold transition text-center ${
                    type === t.type
                      ? 'bg-sky-500 text-white shadow-md shadow-sky-500/20'
                      : 'bg-slate-950/60 text-slate-400 hover:bg-slate-800 hover:text-white'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Stock Selection */}
          {isStockTransaction && (
            <div className="flex flex-col gap-3">
              <label className="text-xs font-semibold text-slate-300">
                Security (Symbol & Exchange)
              </label>

              {symbol ? (
                <div className="flex items-center justify-between rounded-xl border border-white/10 bg-slate-950 p-3">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-white">{symbol}</span>
                    <span className="rounded bg-sky-500/20 px-1.5 py-0.5 text-[10px] font-bold text-sky-400">
                      {exchange}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setSymbol('');
                    }}
                    className="text-xs text-slate-400 hover:text-white transition"
                  >
                    Change
                  </button>
                </div>
              ) : (
                <div className="rounded-xl border border-white/10 bg-slate-950 p-2">
                  <InstrumentSearch onSelect={handleSelectInstrument} />
                </div>
              )}
            </div>
          )}

          {/* Quantity & Price */}
          {!isSplit && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {!isCashOnly && (
                <div>
                  <label className="text-xs font-semibold text-slate-300">Quantity (Shares)</label>
                  <input
                    type="number"
                    step="any"
                    min="0.0001"
                    required
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    placeholder="10"
                    className="mt-1.5 w-full rounded-xl border border-white/10 bg-slate-950 px-3.5 py-2.5 text-xs text-white focus:border-sky-500 focus:outline-none"
                  />
                </div>
              )}

              <div>
                <label className="text-xs font-semibold text-slate-300">
                  {isCashOnly ? 'Amount' : 'Execution Price'} ({currency})
                </label>
                <input
                  type="number"
                  step="any"
                  min="0"
                  required
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  placeholder="2500.00"
                  className="mt-1.5 w-full rounded-xl border border-white/10 bg-slate-950 px-3.5 py-2.5 text-xs text-white focus:border-sky-500 focus:outline-none"
                />
              </div>
            </div>
          )}

          {/* Split Ratio */}
          {isSplit && (
            <div>
              <label className="text-xs font-semibold text-slate-300">
                Split Ratio (e.g. 2 for 2:1 split, 5 for 5:1 split)
              </label>
              <input
                type="number"
                step="any"
                min="0.1"
                required
                value={splitRatio}
                onChange={(e) => setSplitRatio(e.target.value)}
                placeholder="2"
                className="mt-1.5 w-full rounded-xl border border-white/10 bg-slate-950 px-3.5 py-2.5 text-xs text-white focus:border-sky-500 focus:outline-none"
              />
            </div>
          )}

          {/* Fees & Taxes */}
          {!isSplit && !isCashOnly && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="text-xs font-semibold text-slate-300">Brokerage & Fees</label>
                <input
                  type="number"
                  step="any"
                  min="0"
                  value={fees}
                  onChange={(e) => setFees(e.target.value)}
                  placeholder="0.00"
                  className="mt-1.5 w-full rounded-xl border border-white/10 bg-slate-950 px-3.5 py-2.5 text-xs text-white focus:border-sky-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-300">Taxes / STT</label>
                <input
                  type="number"
                  step="any"
                  min="0"
                  value={taxes}
                  onChange={(e) => setTaxes(e.target.value)}
                  placeholder="0.00"
                  className="mt-1.5 w-full rounded-xl border border-white/10 bg-slate-950 px-3.5 py-2.5 text-xs text-white focus:border-sky-500 focus:outline-none"
                />
              </div>
            </div>
          )}

          {/* Trade Date */}
          <div>
            <label className="text-xs font-semibold text-slate-300">Trade Date</label>
            <input
              type="date"
              required
              value={tradeDate}
              onChange={(e) => setTradeDate(e.target.value)}
              className="mt-1.5 w-full rounded-xl border border-white/10 bg-slate-950 px-3.5 py-2.5 text-xs text-white focus:border-sky-500 focus:outline-none"
            />
          </div>

          {/* Notes */}
          <div>
            <label className="text-xs font-semibold text-slate-300">Notes (Optional)</label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Thesis, trade rationale, order ID..."
              className="mt-1.5 w-full rounded-xl border border-white/10 bg-slate-950 px-3.5 py-2 text-xs text-white focus:border-sky-500 focus:outline-none resize-none"
            />
          </div>

          {/* Calculated Preview Box */}
          {!isSplit && (
            <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-4">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400">{cashImpactLabel}:</span>
                <span className="text-base font-black text-white">
                  {currency === 'USD' ? '$' : '₹'}
                  {estimatedTotal.toLocaleString('en-IN', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </span>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="mt-2 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-white/10 px-4 py-2 text-xs font-semibold text-slate-300 hover:bg-white/5 hover:text-white transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-sky-500 to-indigo-600 px-5 py-2 text-xs font-bold text-white shadow-lg shadow-sky-500/20 hover:brightness-110 transition disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <span className="h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  <span>Saving...</span>
                </>
              ) : editingTransaction ? (
                'Update Transaction'
              ) : (
                'Save Transaction'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
