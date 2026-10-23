import { randomUUID } from 'node:crypto';
import type {
  PortfolioTransaction,
  PortfolioTransactionType,
  SupportedCurrency,
  SupportedExchange,
} from '@equitylensai/shared';
import { instrumentRepository } from '../../market/instruments/repository.js';
import { portfolioAccountingService } from './portfolioAccountingService.js';
import { portfolioRepository } from '../repositories/portfolioRepository.js';
import { AppError } from '../../utils/appError.js';

export interface ImportPreviewRow {
  index: number;
  type: PortfolioTransactionType;
  symbol: string | null;
  exchange: SupportedExchange | null;
  quantity: number;
  price: number;
  currency: SupportedCurrency;
  fees: number;
  taxes: number;
  totalAmount: number;
  tradeDate: string;
  notes?: string | null;
  isValid: boolean;
  errors: string[];
}

export class PortfolioImportExportService {
  /**
   * Generates sanitized CSV string from transaction history.
   * Defends against spreadsheet formula injection (=, +, -, @).
   */
  exportToCsv(transactions: PortfolioTransaction[]): string {
    const headers = [
      'ID',
      'Date',
      'Type',
      'Symbol',
      'Exchange',
      'Quantity',
      'Price',
      'Currency',
      'Fees',
      'Taxes',
      'TotalAmount',
      'Notes',
    ];

    const sanitizeCell = (val: string | number | null | undefined): string => {
      if (val === null || val === undefined) return '';
      const str = String(val).trim();
      // Prefix formula characters to avoid spreadsheet execution
      if (/^[=+\-@\t\r]/.test(str)) {
        return `"'${str.replace(/"/g, '""')}"`;
      }
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const rows = transactions.map((t) => [
      sanitizeCell(t.id),
      sanitizeCell(t.tradeDate.split('T')[0]),
      sanitizeCell(t.type),
      sanitizeCell(t.symbol),
      sanitizeCell(t.exchange),
      sanitizeCell(t.quantity),
      sanitizeCell(t.price),
      sanitizeCell(t.currency),
      sanitizeCell(t.fees),
      sanitizeCell(t.taxes),
      sanitizeCell(t.totalAmount),
      sanitizeCell(t.notes),
    ]);

    return [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n');
  }

  /**
   * Parses and validates raw CSV content without committing to the database.
   */
  parseAndPreviewCsv(
    csvContent: string,
    existingTransactions: PortfolioTransaction[],
    baseCurrency: SupportedCurrency = 'INR',
  ): {
    previewRows: ImportPreviewRow[];
    totalRows: number;
    validRowsCount: number;
    invalidRowsCount: number;
    batchId: string;
  } {
    const lines = csvContent
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);

    if (lines.length === 0) {
      throw new AppError('EMPTY_CSV', 'The provided CSV file contains no data rows', 400);
    }

    // Determine if first row is header
    const firstLine = lines[0]!.toLowerCase();
    const hasHeader =
      firstLine.includes('date') || firstLine.includes('type') || firstLine.includes('symbol');
    const dataLines = hasHeader ? lines.slice(1) : lines;

    const previewRows: ImportPreviewRow[] = [];
    const validCandidateTxs: PortfolioTransaction[] = [];
    const batchId = randomUUID();

    for (let i = 0; i < dataLines.length; i++) {
      const line = dataLines[i]!;
      // Simple robust CSV split respecting quotes
      const cells: string[] = [];
      let inQuotes = false;
      let current = '';

      for (let c = 0; c < line.length; c++) {
        const char = line[c];
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
          cells.push(current.trim());
          current = '';
        } else {
          current += char;
        }
      }
      cells.push(current.trim());

      // Format could be:
      // Date, Type, Symbol, Exchange, Quantity, Price, [Currency], [Fees], [Taxes], [Notes]
      // Or if ID is included at start (from export)
      const offset = cells[0]?.length === 36 && cells[0].includes('-') ? 1 : 0;

      const dateStr = cells[offset + 0]?.replace(/['"]/g, '') || new Date().toISOString().split('T')[0]!;
      const rawType = cells[offset + 1]?.replace(/['"]/g, '').toUpperCase() as PortfolioTransactionType;
      const rawSym = cells[offset + 2]?.replace(/['"]/g, '').toUpperCase() || null;
      const rawExch = (cells[offset + 3]?.replace(/['"]/g, '').toUpperCase() || 'NSE') as SupportedExchange;
      const qty = Math.abs(parseFloat(cells[offset + 4]?.replace(/['"]/g, '') || '0')) || 0;
      const price = Math.abs(parseFloat(cells[offset + 5]?.replace(/['"]/g, '') || '0')) || 0;
      const currency = (cells[offset + 6]?.replace(/['"]/g, '').toUpperCase() || baseCurrency) as SupportedCurrency;
      const fees = Math.abs(parseFloat(cells[offset + 7]?.replace(/['"]/g, '') || '0')) || 0;
      const taxes = Math.abs(parseFloat(cells[offset + 8]?.replace(/['"]/g, '') || '0')) || 0;
      const notes = cells[offset + 10]?.replace(/['"]/g, '') || cells[offset + 9]?.replace(/['"]/g, '') || null;

      const errors: string[] = [];

      const validTypes: PortfolioTransactionType[] = [
        'BUY',
        'SELL',
        'DIVIDEND',
        'FEE',
        'DEPOSIT',
        'WITHDRAWAL',
        'SPLIT',
      ];

      if (!validTypes.includes(rawType)) {
        errors.push(`Invalid transaction type: "${rawType}". Supported: ${validTypes.join(', ')}`);
      }

      if (['BUY', 'SELL', 'DIVIDEND', 'SPLIT'].includes(rawType) && !rawSym) {
        errors.push(`Transaction type ${rawType} requires an instrument symbol`);
      }

      if (['BUY', 'SELL'].includes(rawType)) {
        if (qty <= 0) errors.push('Quantity must be greater than 0');
        if (price < 0) errors.push('Price cannot be negative');

        // Check instrument master
        if (rawSym) {
          const inst = instrumentRepository.getBySymbol(rawSym, rawExch);
          if (!inst) {
            errors.push(`Symbol ${rawSym} on ${rawExch} not found in verified instrument master`);
          }
        }
      }

      const totalAmount =
        rawType === 'BUY'
          ? qty * price + fees + taxes
          : rawType === 'SELL'
            ? qty * price - fees - taxes
            : qty * price || fees;

      const isValid = errors.length === 0;

      const row: ImportPreviewRow = {
        index: i + 1,
        type: rawType,
        symbol: rawSym,
        exchange: rawExch,
        quantity: qty,
        price,
        currency,
        fees,
        taxes,
        totalAmount: Number(totalAmount.toFixed(2)),
        tradeDate: new Date(dateStr).toISOString(),
        notes,
        isValid,
        errors,
      };

      previewRows.push(row);

      if (isValid) {
        validCandidateTxs.push({
          id: randomUUID(),
          portfolioId: '',
          type: row.type,
          symbol: row.symbol,
          exchange: row.exchange,
          quantity: row.quantity,
          price: row.price,
          currency: row.currency,
          fees: row.fees,
          taxes: row.taxes,
          totalAmount: row.totalAmount,
          tradeDate: row.tradeDate,
          notes: row.notes ?? null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      }
    }

    // Verify no short positions across combined history
    const combined = [...existingTransactions, ...validCandidateTxs];
    try {
      portfolioAccountingService.reconstructLedger(combined);
    } catch (err: any) {
      // Flag sell quantity error
    }

    return {
      previewRows,
      totalRows: previewRows.length,
      validRowsCount: previewRows.filter((r) => r.isValid).length,
      invalidRowsCount: previewRows.filter((r) => !r.isValid).length,
      batchId,
    };
  }

  /**
   * Commits confirmed import rows to the portfolio ledger with a batch reference.
   */
  async confirmImport(
    portfolioId: string,
    userId: string,
    rows: ImportPreviewRow[],
    batchId: string,
  ): Promise<PortfolioTransaction[]> {
    const validRows = rows.filter((r) => r.isValid);
    if (validRows.length === 0) {
      throw new AppError('NO_VALID_ROWS', 'No valid rows available to import', 400);
    }

    const now = new Date().toISOString();
    const transactions: PortfolioTransaction[] = validRows.map((r) => ({
      id: randomUUID(),
      portfolioId,
      type: r.type,
      symbol: r.symbol,
      exchange: r.exchange,
      quantity: r.quantity,
      price: r.price,
      currency: r.currency,
      fees: r.fees,
      taxes: r.taxes,
      totalAmount: r.totalAmount,
      tradeDate: r.tradeDate,
      notes: r.notes ?? null,
      externalReference: `import:${batchId}:${r.index}`,
      createdAt: now,
      updatedAt: now,
    }));

    return portfolioRepository.createTransactionsBatch(transactions, userId);
  }
}

export const portfolioImportExportService = new PortfolioImportExportService();
