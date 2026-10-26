'use client';

import { useState } from 'react';
import { usePreviewImport, useConfirmImport } from '@/hooks/usePortfolio';
import { getAuthToken } from '@/services/api/client';
import { getFrontendEnv } from '@/lib/env';
import type { ImportPreviewRow } from '@/services/api/portfolio';

type ImportExportModalProps = {
  isOpen: boolean;
  onClose: () => void;
  portfolioId: string;
  portfolioName: string;
  onSuccess?: (() => void) | undefined;
};

export function ImportExportModal({
  isOpen,
  onClose,
  portfolioId,
  portfolioName,
  onSuccess,
}: ImportExportModalProps) {
  const [tab, setTab] = useState<'import' | 'export'>('import');
  const [csvContent, setCsvContent] = useState('');
  const [previewData, setPreviewData] = useState<{
    previewRows: ImportPreviewRow[];
    totalRows: number;
    validRowsCount: number;
    invalidRowsCount: number;
    batchId: string;
  } | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const previewMutation = usePreviewImport();
  const confirmMutation = useConfirmImport();

  if (!isOpen) return null;

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      setCsvContent(text);
      setPreviewData(null);
      setErrorMsg(null);
    };
    reader.readAsText(file);
  };

  const handlePreview = async () => {
    if (!csvContent.trim()) {
      setErrorMsg('Please upload a CSV file or paste CSV content.');
      return;
    }
    setErrorMsg(null);

    try {
      const res = await previewMutation.mutateAsync({
        portfolioId,
        csvContent,
      });
      setPreviewData(res);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to parse and validate CSV file');
    }
  };

  const handleConfirm = async () => {
    if (!previewData || previewData.validRowsCount === 0) return;
    setErrorMsg(null);

    try {
      await confirmMutation.mutateAsync({
        portfolioId,
        data: {
          batchId: previewData.batchId,
          rows: previewData.previewRows,
        },
      });

      onSuccess?.();
      onClose();
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to commit imported transactions');
    }
  };

  const handleDownloadCsv = () => {
    const { NEXT_PUBLIC_API_URL } = getFrontendEnv();
    const token = getAuthToken();
    const url = `${NEXT_PUBLIC_API_URL.replace(/\/$/, '')}/api/v1/portfolios/${portfolioId}/transactions/export`;

    fetch(url, {
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    })
      .then((res) => {
        if (!res.ok) throw new Error('Download failed');
        return res.blob();
      })
      .then((blob) => {
        const downloadUrl = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = downloadUrl;
        a.download = `portfolio_${portfolioName.replace(/\s+/g, '_')}_transactions.csv`;
        document.body.appendChild(a);
        a.click();
        a.remove();
      })
      .catch((err) => {
        alert(err.message || 'Failed to export CSV');
      });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fadeIn">
      <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-3xl border border-white/10 bg-slate-900 p-6 sm:p-8 shadow-2xl scrollbar-none">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 pb-4">
          <div>
            <h2 className="text-lg font-bold text-white">Import & Export Transactions</h2>
            <p className="text-xs text-slate-400">
              Bulk transaction management for <span className="text-white font-semibold">{portfolioName}</span>
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 hover:bg-white/5 hover:text-white transition"
          >
            ✕
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="mt-4 flex space-x-2 border-b border-white/10 pb-3">
          <button
            onClick={() => setTab('import')}
            className={`rounded-xl px-4 py-1.5 text-xs font-semibold transition ${
              tab === 'import'
                ? 'bg-sky-500 text-white shadow-md shadow-sky-500/20'
                : 'text-slate-400 hover:bg-slate-800 hover:text-white'
            }`}
          >
            Import CSV
          </button>
          <button
            onClick={() => setTab('export')}
            className={`rounded-xl px-4 py-1.5 text-xs font-semibold transition ${
              tab === 'export'
                ? 'bg-sky-500 text-white shadow-md shadow-sky-500/20'
                : 'text-slate-400 hover:bg-slate-800 hover:text-white'
            }`}
          >
            Export Ledger CSV
          </button>
        </div>

        {errorMsg && (
          <div className="mt-4 rounded-xl border border-rose-500/20 bg-rose-500/10 p-3 text-xs text-rose-300">
            {errorMsg}
          </div>
        )}

        {/* TAB: EXPORT */}
        {tab === 'export' && (
          <div className="mt-6 flex flex-col gap-4">
            <p className="text-xs text-slate-300 leading-relaxed">
              Download your complete transaction ledger as a sanitized CSV file. Includes all
              historical BUY, SELL, DIVIDEND, SPLIT, FEE, DEPOSIT, and WITHDRAWAL events with
              formula injection protection.
            </p>
            <div className="rounded-2xl border border-white/10 bg-slate-950 p-4">
              <span className="text-xs font-semibold text-slate-400">CSV Headers included:</span>
              <p className="mt-1 font-mono text-[11px] text-slate-300">
                ID, Date, Type, Symbol, Exchange, Quantity, Price, Currency, Fees, Taxes, TotalAmount, Notes
              </p>
            </div>
            <div className="mt-2 flex justify-end">
              <button
                onClick={handleDownloadCsv}
                className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-sky-500 to-indigo-600 px-5 py-2.5 text-xs font-bold text-white shadow-lg shadow-sky-500/20 hover:brightness-110 transition"
              >
                Download CSV Export
              </button>
            </div>
          </div>
        )}

        {/* TAB: IMPORT */}
        {tab === 'import' && (
          <div className="mt-6 flex flex-col gap-5">
            {/* Format Instructions */}
            <div className="rounded-2xl border border-white/10 bg-slate-950 p-4 text-xs text-slate-300 space-y-1.5">
              <span className="font-semibold text-white">Expected CSV Format:</span>
              <p className="font-mono text-[11px] text-sky-300">
                Date, Type, Symbol, Exchange, Quantity, Price, Currency, Fees, Taxes, Notes
              </p>
              <p className="text-[11px] text-slate-400">
                Example: <span className="font-mono text-slate-300">2026-01-15, BUY, RELIANCE, NSE, 10, 2500, INR, 20, 0, Purchase</span>
              </p>
            </div>

            {/* File Upload & Paste Area */}
            <div>
              <label className="text-xs font-semibold text-slate-300">Upload CSV File</label>
              <input
                type="file"
                accept=".csv"
                onChange={handleFileUpload}
                className="mt-1.5 block w-full text-xs text-slate-400 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-sky-500/10 file:text-sky-400 hover:file:bg-sky-500/20 file:cursor-pointer cursor-pointer"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-300">Or Paste CSV Content</label>
              <textarea
                rows={4}
                value={csvContent}
                onChange={(e) => {
                  setCsvContent(e.target.value);
                  setPreviewData(null);
                }}
                placeholder="Date,Type,Symbol,Exchange,Quantity,Price,Currency,Fees,Taxes,Notes"
                className="mt-1.5 w-full rounded-xl border border-white/10 bg-slate-950 px-3.5 py-2 font-mono text-[11px] text-white focus:border-sky-500 focus:outline-none resize-none"
              />
            </div>

            {/* Preview Button */}
            {!previewData && (
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={handlePreview}
                  disabled={previewMutation.isPending || !csvContent.trim()}
                  className="rounded-xl bg-sky-500 px-5 py-2 text-xs font-bold text-white hover:bg-sky-400 transition disabled:opacity-50"
                >
                  {previewMutation.isPending ? 'Validating...' : 'Preview & Validate'}
                </button>
              </div>
            )}

            {/* Validation Preview Table */}
            {previewData && (
              <div className="flex flex-col gap-3">
                <div className="flex items-center gap-3">
                  <span className="rounded-lg bg-emerald-500/10 px-2.5 py-1 text-xs font-bold text-emerald-400 border border-emerald-500/20">
                    {previewData.validRowsCount} Valid Rows
                  </span>
                  {previewData.invalidRowsCount > 0 && (
                    <span className="rounded-lg bg-rose-500/10 px-2.5 py-1 text-xs font-bold text-rose-400 border border-rose-500/20">
                      {previewData.invalidRowsCount} Invalid Rows
                    </span>
                  )}
                </div>

                <div className="max-h-56 overflow-y-auto rounded-xl border border-white/10 bg-slate-950/80 scrollbar-none">
                  <table className="w-full text-left text-xs">
                    <thead className="border-b border-white/10 bg-slate-950 text-[10px] uppercase text-slate-400">
                      <tr>
                        <th className="px-3 py-2">Row</th>
                        <th className="px-3 py-2">Type</th>
                        <th className="px-3 py-2">Security</th>
                        <th className="px-3 py-2 text-right">Qty</th>
                        <th className="px-3 py-2 text-right">Price</th>
                        <th className="px-3 py-2">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {previewData.previewRows.map((r) => (
                        <tr key={r.index} className="hover:bg-white/[0.02]">
                          <td className="px-3 py-2 font-mono text-slate-400">{r.index}</td>
                          <td className="px-3 py-2 font-bold text-white">{r.type}</td>
                          <td className="px-3 py-2 text-slate-300">
                            {r.symbol || '—'} {r.exchange ? `(${r.exchange})` : ''}
                          </td>
                          <td className="px-3 py-2 text-right text-slate-300">{r.quantity}</td>
                          <td className="px-3 py-2 text-right text-slate-300">{r.price}</td>
                          <td className="px-3 py-2">
                            {r.isValid ? (
                              <span className="text-[10px] font-bold text-emerald-400">Valid</span>
                            ) : (
                              <span
                                className="text-[10px] font-bold text-rose-400"
                                title={r.errors.join(', ')}
                              >
                                {r.errors[0] || 'Error'}
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="flex items-center justify-between pt-2">
                  <button
                    type="button"
                    onClick={() => setPreviewData(null)}
                    className="text-xs text-slate-400 hover:text-white"
                  >
                    ← Edit CSV Input
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirm}
                    disabled={confirmMutation.isPending || previewData.validRowsCount === 0}
                    className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 px-5 py-2 text-xs font-bold text-white shadow-lg shadow-emerald-500/20 hover:brightness-110 transition disabled:opacity-50"
                  >
                    {confirmMutation.isPending
                      ? 'Importing...'
                      : `Commit ${previewData.validRowsCount} Transactions`}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
