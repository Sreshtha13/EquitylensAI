'use client';

import { useState } from 'react';
import type { PortfolioTransaction, PortfolioTransactionType } from '@equitylensai/shared';
import { useDeleteTransaction } from '@/hooks/usePortfolio';

type TransactionHistoryTableProps = {
  transactions: PortfolioTransaction[];
  portfolioId: string;
  onEditTransaction?: ((tx: PortfolioTransaction) => void) | undefined;
  isLoading?: boolean | undefined;
};

export function TransactionHistoryTable({
  transactions,
  portfolioId,
  onEditTransaction,
  isLoading,
}: TransactionHistoryTableProps) {
  const [filterType, setFilterType] = useState<string>('ALL');
  const [filterSymbol, setFilterSymbol] = useState<string>('');
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const deleteTxMutation = useDeleteTransaction();

  const filtered = transactions.filter((tx) => {
    if (filterType !== 'ALL' && tx.type !== filterType) return false;
    if (
      filterSymbol.trim() &&
      !tx.symbol?.toUpperCase().includes(filterSymbol.trim().toUpperCase())
    ) {
      return false;
    }
    return true;
  });

  const handleDelete = async (txId: string) => {
    try {
      await deleteTxMutation.mutateAsync({
        portfolioId,
        transactionId: txId,
      });
      setDeleteConfirmId(null);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to delete transaction');
    }
  };

  const getTypeBadge = (type: PortfolioTransactionType) => {
    switch (type) {
      case 'BUY':
        return (
          <span className="rounded bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-400 border border-emerald-500/20">
            BUY
          </span>
        );
      case 'SELL':
        return (
          <span className="rounded bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold text-amber-400 border border-amber-500/20">
            SELL
          </span>
        );
      case 'DIVIDEND':
        return (
          <span className="rounded bg-purple-500/10 px-2 py-0.5 text-[10px] font-bold text-purple-400 border border-purple-500/20">
            DIVIDEND
          </span>
        );
      case 'DEPOSIT':
        return (
          <span className="rounded bg-sky-500/10 px-2 py-0.5 text-[10px] font-bold text-sky-400 border border-sky-500/20">
            DEPOSIT
          </span>
        );
      case 'WITHDRAWAL':
        return (
          <span className="rounded bg-rose-500/10 px-2 py-0.5 text-[10px] font-bold text-rose-400 border border-rose-500/20">
            WITHDRAWAL
          </span>
        );
      case 'FEE':
        return (
          <span className="rounded bg-slate-500/10 px-2 py-0.5 text-[10px] font-bold text-slate-400 border border-slate-500/20">
            FEE
          </span>
        );
      case 'SPLIT':
        return (
          <span className="rounded bg-indigo-500/10 px-2 py-0.5 text-[10px] font-bold text-indigo-400 border border-indigo-500/20">
            SPLIT
          </span>
        );
    }
  };

  return (
    <div className="overflow-hidden rounded-2xl border border-white/10 bg-slate-900/80 shadow-xl backdrop-blur-xl">
      {/* Header & Filters */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 px-6 py-4">
        <div>
          <h2 className="text-sm font-bold text-white uppercase tracking-wider">
            Transaction Ledger ({transactions.length})
          </h2>
          <p className="text-xs text-slate-400">
            Auditable, deterministic history of all investment and cash events
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Symbol Filter */}
          <input
            type="text"
            placeholder="Filter symbol..."
            value={filterSymbol}
            onChange={(e) => setFilterSymbol(e.target.value)}
            className="h-8 rounded-lg border border-white/10 bg-slate-950 px-2.5 text-xs text-white placeholder-slate-500 focus:border-sky-500 focus:outline-none w-28 sm:w-36"
          />

          {/* Type Filter */}
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="h-8 rounded-lg border border-white/10 bg-slate-950 px-2 text-xs text-white focus:border-sky-500 focus:outline-none"
          >
            <option value="ALL">All Types</option>
            <option value="BUY">BUY</option>
            <option value="SELL">SELL</option>
            <option value="DIVIDEND">DIVIDEND</option>
            <option value="DEPOSIT">DEPOSIT</option>
            <option value="WITHDRAWAL">WITHDRAWAL</option>
            <option value="FEE">FEE</option>
            <option value="SPLIT">SPLIT</option>
          </select>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-2 p-6 animate-pulse">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-10 w-full rounded-lg bg-slate-800/40" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="p-8 text-center text-xs text-slate-400">
          No transactions match your filter criteria.
        </div>
      ) : (
        <div className="overflow-x-auto scrollbar-none">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-white/5 bg-slate-950/40 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              <tr>
                <th className="px-6 py-3.5">Date</th>
                <th className="px-4 py-3.5">Type</th>
                <th className="px-4 py-3.5">Security</th>
                <th className="px-4 py-3.5 text-right">Quantity</th>
                <th className="px-4 py-3.5 text-right">Price</th>
                <th className="px-4 py-3.5 text-right">Fees & Taxes</th>
                <th className="px-4 py-3.5 text-right">Cash Impact</th>
                <th className="px-4 py-3.5">Notes</th>
                <th className="px-6 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filtered.map((tx) => {
                const curr = tx.currency === 'USD' ? '$' : '₹';
                const isOutflow = ['BUY', 'WITHDRAWAL', 'FEE'].includes(tx.type);
                const isInflow = ['SELL', 'DIVIDEND', 'DEPOSIT'].includes(tx.type);

                return (
                  <tr key={tx.id} className="hover:bg-white/[0.02] transition">
                    {/* Date */}
                    <td className="px-6 py-3.5 font-mono text-[11px] text-slate-300">
                      {new Date(tx.tradeDate).toLocaleDateString()}
                    </td>

                    {/* Type */}
                    <td className="px-4 py-3.5">{getTypeBadge(tx.type)}</td>

                    {/* Security */}
                    <td className="px-4 py-3.5">
                      {tx.symbol ? (
                        <div className="flex items-center gap-1.5 font-bold text-white">
                          <span>{tx.symbol}</span>
                          {tx.exchange && (
                            <span className="text-[10px] text-slate-400">({tx.exchange})</span>
                          )}
                        </div>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>

                    {/* Quantity */}
                    <td className="px-4 py-3.5 text-right font-medium text-slate-300">
                      {tx.type === 'SPLIT'
                        ? `${tx.splitRatio}:1 Split`
                        : tx.quantity > 0
                          ? tx.quantity.toLocaleString('en-IN', {
                              minimumFractionDigits: 0,
                              maximumFractionDigits: 4,
                            })
                          : '—'}
                    </td>

                    {/* Price */}
                    <td className="px-4 py-3.5 text-right text-slate-300">
                      {tx.price > 0 ? (
                        <span>
                          {curr}
                          {tx.price.toLocaleString('en-IN', {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </span>
                      ) : (
                        '—'
                      )}
                    </td>

                    {/* Fees & Taxes */}
                    <td className="px-4 py-3.5 text-right text-slate-400">
                      {tx.fees + tx.taxes > 0 ? (
                        <span>
                          {curr}
                          {(tx.fees + tx.taxes).toFixed(2)}
                        </span>
                      ) : (
                        '—'
                      )}
                    </td>

                    {/* Cash Impact */}
                    <td className="px-4 py-3.5 text-right font-semibold">
                      {tx.type === 'SPLIT' ? (
                        <span className="text-slate-400">0.00</span>
                      ) : (
                        <span className={isInflow ? 'text-emerald-400' : 'text-slate-300'}>
                          {isInflow ? '+' : isOutflow ? '-' : ''}
                          {curr}
                          {tx.totalAmount.toLocaleString('en-IN', {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </span>
                      )}
                    </td>

                    {/* Notes */}
                    <td className="px-4 py-3.5 text-[11px] text-slate-400 max-w-[150px] truncate">
                      {tx.notes || '—'}
                    </td>

                    {/* Actions */}
                    <td className="px-6 py-3.5 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {onEditTransaction && (
                          <button
                            onClick={() => onEditTransaction(tx)}
                            className="text-[11px] text-slate-400 hover:text-white transition"
                          >
                            Edit
                          </button>
                        )}

                        {deleteConfirmId === tx.id ? (
                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={() => handleDelete(tx.id)}
                              className="rounded bg-rose-500/20 px-2 py-0.5 text-[10px] font-bold text-rose-300 hover:bg-rose-500/30"
                            >
                              Confirm
                            </button>
                            <button
                              onClick={() => setDeleteConfirmId(null)}
                              className="text-[10px] text-slate-400 hover:text-white"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setDeleteConfirmId(tx.id)}
                            className="text-[11px] text-rose-400/80 hover:text-rose-400 transition"
                          >
                            Delete
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
