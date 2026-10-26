import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { memoryPortfolioStore } from '../src/portfolio/repositories/portfolioRepository.js';
import { portfolioAccountingService } from '../src/portfolio/services/portfolioAccountingService.js';
import { loadEnv, resetEnvCache } from '../src/config/index.js';

describe('Phase 10 — Portfolio Tracking & Investment Performance Analytics', () => {
  let app: ReturnType<typeof createApp>;

  beforeEach(() => {
    resetEnvCache();
    loadEnv({
      NODE_ENV: 'test',
      PORT: '4000',
      FRONTEND_URL: 'http://localhost:3000',
    });
    memoryPortfolioStore.clear();
    app = createApp();
  });

  afterEach(() => {
    memoryPortfolioStore.clear();
    resetEnvCache();
  });

  // ─── 1. Core Accounting Engine Tests ───
  describe('Deterministic Portfolio Accounting Engine', () => {
    it('calculates weighted-average cost basis, partial sell, realized P&L, and split accurately', () => {
      // 1. Buy 10 units of RELIANCE at 2500 with 50 fees
      const tx1 = {
        id: 'tx-1',
        portfolioId: 'p-1',
        type: 'BUY' as const,
        symbol: 'RELIANCE',
        exchange: 'NSE' as const,
        quantity: 10,
        price: 2500,
        currency: 'INR' as const,
        fees: 50,
        taxes: 0,
        totalAmount: 25050,
        tradeDate: '2026-01-10T10:00:00Z',
        createdAt: '2026-01-10T10:00:00Z',
        updatedAt: '2026-01-10T10:00:00Z',
      };

      const ledger1 = portfolioAccountingService.reconstructLedger([tx1]);
      const pos1 = ledger1.positions.get('RELIANCE:NSE')!;
      expect(pos1.quantity).toBe(10);
      expect(pos1.totalCostBasis).toBe(25050);
      expect(pos1.averageBuyPrice).toBe(2505);
      expect(ledger1.cashBalance).toBe(-25050);

      // 2. Buy another 10 units at 2700 with 50 fees
      const tx2 = {
        id: 'tx-2',
        portfolioId: 'p-1',
        type: 'BUY' as const,
        symbol: 'RELIANCE',
        exchange: 'NSE' as const,
        quantity: 10,
        price: 2700,
        currency: 'INR' as const,
        fees: 50,
        taxes: 0,
        totalAmount: 27050,
        tradeDate: '2026-01-15T10:00:00Z',
        createdAt: '2026-01-15T10:00:00Z',
        updatedAt: '2026-01-15T10:00:00Z',
      };

      const ledger2 = portfolioAccountingService.reconstructLedger([tx1, tx2]);
      const pos2 = ledger2.positions.get('RELIANCE:NSE')!;
      expect(pos2.quantity).toBe(20);
      expect(pos2.totalCostBasis).toBe(52100);
      expect(pos2.averageBuyPrice).toBe(2605); // (25050 + 27050) / 20 = 2605

      // 3. Sell 5 units at 3000 with 30 fees
      // Sold cost basis = 5 * 2605 = 13025
      // Net proceeds = (5 * 3000) - 30 = 14970
      // Realized P&L = 14970 - 13025 = 1945
      // Remaining cost basis = 52100 - 13025 = 39075
      const tx3 = {
        id: 'tx-3',
        portfolioId: 'p-1',
        type: 'SELL' as const,
        symbol: 'RELIANCE',
        exchange: 'NSE' as const,
        quantity: 5,
        price: 3000,
        currency: 'INR' as const,
        fees: 30,
        taxes: 0,
        totalAmount: 14970,
        tradeDate: '2026-01-20T10:00:00Z',
        createdAt: '2026-01-20T10:00:00Z',
        updatedAt: '2026-01-20T10:00:00Z',
      };

      const ledger3 = portfolioAccountingService.reconstructLedger([tx1, tx2, tx3]);
      const pos3 = ledger3.positions.get('RELIANCE:NSE')!;
      expect(pos3.quantity).toBe(15);
      expect(pos3.totalCostBasis).toBe(39075);
      expect(pos3.averageBuyPrice).toBe(2605);
      expect(pos3.realizedPnL).toBe(1945);
      expect(ledger3.totalRealizedPnL).toBe(1945);

      // 4. Split 2:1 on RELIANCE
      // New qty: 15 * 2 = 30
      // Total cost basis remains: 39075
      // New avg price: 39075 / 30 = 1302.5
      const txSplit = {
        id: 'tx-4',
        portfolioId: 'p-1',
        type: 'SPLIT' as const,
        symbol: 'RELIANCE',
        exchange: 'NSE' as const,
        quantity: 0,
        price: 0,
        splitRatio: 2,
        currency: 'INR' as const,
        fees: 0,
        taxes: 0,
        totalAmount: 0,
        tradeDate: '2026-01-25T10:00:00Z',
        createdAt: '2026-01-25T10:00:00Z',
        updatedAt: '2026-01-25T10:00:00Z',
      };

      const ledger4 = portfolioAccountingService.reconstructLedger([tx1, tx2, tx3, txSplit]);
      const pos4 = ledger4.positions.get('RELIANCE:NSE')!;
      expect(pos4.quantity).toBe(30);
      expect(pos4.totalCostBasis).toBe(39075);
      expect(pos4.averageBuyPrice).toBe(1302.5);

      // 5. Dividend of 300 on RELIANCE
      const txDiv = {
        id: 'tx-5',
        portfolioId: 'p-1',
        type: 'DIVIDEND' as const,
        symbol: 'RELIANCE',
        exchange: 'NSE' as const,
        quantity: 30,
        price: 10,
        currency: 'INR' as const,
        fees: 0,
        taxes: 0,
        totalAmount: 300,
        tradeDate: '2026-01-30T10:00:00Z',
        createdAt: '2026-01-30T10:00:00Z',
        updatedAt: '2026-01-30T10:00:00Z',
      };

      const ledger5 = portfolioAccountingService.reconstructLedger([tx1, tx2, tx3, txSplit, txDiv]);
      const pos5 = ledger5.positions.get('RELIANCE:NSE')!;
      expect(pos5.dividendIncome).toBe(300);
      expect(pos5.quantity).toBe(30); // unchanged
      expect(pos5.totalCostBasis).toBe(39075); // unchanged
      expect(ledger5.totalDividends).toBe(300);
    });

    it('rejects short positions when sell quantity exceeds available holdings', () => {
      const txBuy = {
        id: 'tx-buy',
        portfolioId: 'p-1',
        type: 'BUY' as const,
        symbol: 'INFY',
        exchange: 'NSE' as const,
        quantity: 10,
        price: 1500,
        currency: 'INR' as const,
        fees: 0,
        taxes: 0,
        totalAmount: 15000,
        tradeDate: '2026-01-01T10:00:00Z',
        createdAt: '2026-01-01T10:00:00Z',
        updatedAt: '2026-01-01T10:00:00Z',
      };

      expect(() => {
        portfolioAccountingService.validateSellPosition([txBuy], {
          type: 'SELL',
          symbol: 'INFY',
          exchange: 'NSE',
          quantity: 15, // attempts to sell 15 when only 10 held
          tradeDate: '2026-01-05T10:00:00Z',
        });
      }).toThrowError(/Short selling is not permitted/);
    });

    it('tracks cash balance accurately through deposits, withdrawals, trades, dividends, and fees', () => {
      const txs = [
        {
          id: 'tx-dep',
          portfolioId: 'p-1',
          type: 'DEPOSIT' as const,
          symbol: null,
          exchange: null,
          quantity: 0,
          price: 50000,
          currency: 'INR' as const,
          fees: 0,
          taxes: 0,
          totalAmount: 50000,
          tradeDate: '2026-01-01T10:00:00Z',
          createdAt: '2026-01-01T10:00:00Z',
          updatedAt: '2026-01-01T10:00:00Z',
        },
        {
          id: 'tx-buy',
          portfolioId: 'p-1',
          type: 'BUY' as const,
          symbol: 'TCS',
          exchange: 'NSE' as const,
          quantity: 10,
          price: 3500,
          currency: 'INR' as const,
          fees: 50,
          taxes: 0,
          totalAmount: 35050,
          tradeDate: '2026-01-02T10:00:00Z',
          createdAt: '2026-01-02T10:00:00Z',
          updatedAt: '2026-01-02T10:00:00Z',
        },
        {
          id: 'tx-fee',
          portfolioId: 'p-1',
          type: 'FEE' as const,
          symbol: null,
          exchange: null,
          quantity: 0,
          price: 0,
          currency: 'INR' as const,
          fees: 100,
          taxes: 0,
          totalAmount: 100,
          tradeDate: '2026-01-03T10:00:00Z',
          createdAt: '2026-01-03T10:00:00Z',
          updatedAt: '2026-01-03T10:00:00Z',
        },
        {
          id: 'tx-with',
          portfolioId: 'p-1',
          type: 'WITHDRAWAL' as const,
          symbol: null,
          exchange: null,
          quantity: 0,
          price: 5000,
          currency: 'INR' as const,
          fees: 0,
          taxes: 0,
          totalAmount: 5000,
          tradeDate: '2026-01-04T10:00:00Z',
          createdAt: '2026-01-04T10:00:00Z',
          updatedAt: '2026-01-04T10:00:00Z',
        },
      ];

      const ledger = portfolioAccountingService.reconstructLedger(txs);
      // Cash: 50000 - 35050 - 100 - 5000 = 9850
      expect(ledger.cashBalance).toBe(9850);
      expect(ledger.totalDeposits).toBe(50000);
      expect(ledger.totalWithdrawals).toBe(5000);
      expect(ledger.totalFees).toBe(100);
    });
  });

  // ─── 2. Backend API Endpoints & CRUD ───
  describe('Portfolio REST API Endpoints', () => {
    const userA = 'user-alpha';
    const userB = 'user-bravo';

    it('creates, lists, updates, and deletes portfolios with strict per-user authorization', async () => {
      // 1. User A creates portfolio
      const createRes = await request(app)
        .post('/api/v1/portfolios')
        .set('x-test-user-id', userA)
        .send({
          name: 'Growth Tech Portfolio',
          description: 'High-growth technology focus',
          baseCurrency: 'INR',
        });

      expect(createRes.status).toBe(201);
      expect(createRes.body.success).toBe(true);
      const portfolioId = createRes.body.data.id;
      expect(portfolioId).toBeDefined();
      expect(createRes.body.data.name).toBe('Growth Tech Portfolio');

      // 2. User A can list portfolios
      const listRes = await request(app)
        .get('/api/v1/portfolios')
        .set('x-test-user-id', userA);

      expect(listRes.status).toBe(200);
      expect(listRes.body.data).toHaveLength(1);
      expect(listRes.body.data[0].id).toBe(portfolioId);

      // 3. User B cannot see User A's portfolio
      const userBList = await request(app)
        .get('/api/v1/portfolios')
        .set('x-test-user-id', userB);

      expect(userBList.status).toBe(200);
      expect(userBList.body.data).toHaveLength(0);

      const userBGet = await request(app)
        .get(`/api/v1/portfolios/${portfolioId}`)
        .set('x-test-user-id', userB);
      expect(userBGet.status).toBe(404);

      // 4. User A updates portfolio
      const patchRes = await request(app)
        .patch(`/api/v1/portfolios/${portfolioId}`)
        .set('x-test-user-id', userA)
        .send({ description: 'Updated description' });

      expect(patchRes.status).toBe(200);
      expect(patchRes.body.data.description).toBe('Updated description');

      // 5. User B cannot update User A's portfolio
      const unauthorizedPatch = await request(app)
        .patch(`/api/v1/portfolios/${portfolioId}`)
        .set('x-test-user-id', userB)
        .send({ name: 'Hacked' });
      expect(unauthorizedPatch.status).toBe(404);

      // 6. User A deletes portfolio
      const delRes = await request(app)
        .delete(`/api/v1/portfolios/${portfolioId}`)
        .set('x-test-user-id', userA);
      expect(delRes.status).toBe(200);

      const afterDel = await request(app)
        .get(`/api/v1/portfolios/${portfolioId}`)
        .set('x-test-user-id', userA);
      expect(afterDel.status).toBe(404);
    });

    it('records BUY and SELL transactions, computes holdings, and rejects short sells over API', async () => {
      // Create portfolio
      const pRes = await request(app)
        .post('/api/v1/portfolios')
        .set('x-test-user-id', userA)
        .send({ name: 'Equities Portfolio', baseCurrency: 'INR' });
      const portfolioId = pRes.body.data.id;

      // Add BUY transaction: 10 shares of RELIANCE @ 2500
      const buyRes = await request(app)
        .post(`/api/v1/portfolios/${portfolioId}/transactions`)
        .set('x-test-user-id', userA)
        .send({
          type: 'BUY',
          symbol: 'RELIANCE',
          exchange: 'NSE',
          quantity: 10,
          price: 2500,
          fees: 20,
        });

      expect(buyRes.status).toBe(201);
      expect(buyRes.body.data.symbol).toBe('RELIANCE');
      expect(buyRes.body.data.quantity).toBe(10);

      // Verify holdings endpoint
      const holdingsRes = await request(app)
        .get(`/api/v1/portfolios/${portfolioId}/holdings`)
        .set('x-test-user-id', userA);

      expect(holdingsRes.status).toBe(200);
      expect(holdingsRes.body.data.holdings).toHaveLength(1);
      const holding = holdingsRes.body.data.holdings[0];
      expect(holding.symbol).toBe('RELIANCE');
      expect(holding.quantity).toBe(10);
      expect(holding.totalCostBasis).toBe(25020);

      // Attempt to sell 15 shares (exceeds 10)
      const invalidSell = await request(app)
        .post(`/api/v1/portfolios/${portfolioId}/transactions`)
        .set('x-test-user-id', userA)
        .send({
          type: 'SELL',
          symbol: 'RELIANCE',
          exchange: 'NSE',
          quantity: 15,
          price: 2600,
        });

      expect(invalidSell.status).toBe(400);
      expect(invalidSell.body.error.code).toBe('INSUFFICIENT_HOLDINGS');

      // Valid sell: 4 shares of RELIANCE
      const validSell = await request(app)
        .post(`/api/v1/portfolios/${portfolioId}/transactions`)
        .set('x-test-user-id', userA)
        .send({
          type: 'SELL',
          symbol: 'RELIANCE',
          exchange: 'NSE',
          quantity: 4,
          price: 2700,
          fees: 15,
        });

      expect(validSell.status).toBe(201);

      // Check updated holdings (10 - 4 = 6)
      const updatedHoldings = await request(app)
        .get(`/api/v1/portfolios/${portfolioId}/holdings`)
        .set('x-test-user-id', userA);

      expect(updatedHoldings.body.data.holdings[0].quantity).toBe(6);
    });

    it('returns portfolio summary with cash balance, realized/unrealized P&L, and data freshness', async () => {
      const pRes = await request(app)
        .post('/api/v1/portfolios')
        .set('x-test-user-id', userA)
        .send({ name: 'Summary Test' });
      const portfolioId = pRes.body.data.id;

      // Deposit 100,000 cash
      await request(app)
        .post(`/api/v1/portfolios/${portfolioId}/transactions`)
        .set('x-test-user-id', userA)
        .send({
          type: 'DEPOSIT',
          quantity: 0,
          price: 100000,
        });

      // Buy TCS
      await request(app)
        .post(`/api/v1/portfolios/${portfolioId}/transactions`)
        .set('x-test-user-id', userA)
        .send({
          type: 'BUY',
          symbol: 'TCS',
          exchange: 'NSE',
          quantity: 10,
          price: 3500,
        });

      const summaryRes = await request(app)
        .get(`/api/v1/portfolios/${portfolioId}/summary`)
        .set('x-test-user-id', userA);

      expect(summaryRes.status).toBe(200);
      const summary = summaryRes.body.data;
      expect(summary.holdingsCount).toBe(1);
      expect(summary.totalCostBasis).toBe(35000);
      expect(summary.cashBalance).toBe(65000); // 100000 - 35000 = 65000
      expect(summary.valuationCoveragePercent).toBeGreaterThan(0);
      expect(summary.lastValuationAt).toBeDefined();
    });

    it('computes asset and sector allocation with genuine instrument classifications', async () => {
      const pRes = await request(app)
        .post('/api/v1/portfolios')
        .set('x-test-user-id', userA)
        .send({ name: 'Allocation Test' });
      const portfolioId = pRes.body.data.id;

      await request(app)
        .post(`/api/v1/portfolios/${portfolioId}/transactions`)
        .set('x-test-user-id', userA)
        .send({
          type: 'BUY',
          symbol: 'RELIANCE',
          exchange: 'NSE',
          quantity: 10,
          price: 2500,
        });

      const allocRes = await request(app)
        .get(`/api/v1/portfolios/${portfolioId}/allocation`)
        .set('x-test-user-id', userA);

      expect(allocRes.status).toBe(200);
      const alloc = allocRes.body.data;
      expect(alloc.assetAllocation).toBeDefined();
      expect(alloc.sectorAllocation).toBeDefined();
      expect(alloc.concentration.totalHoldings).toBe(1);
    });

    it('returns historical performance series and benchmark metrics', async () => {
      const pRes = await request(app)
        .post('/api/v1/portfolios')
        .set('x-test-user-id', userA)
        .send({ name: 'Performance Test' });
      const portfolioId = pRes.body.data.id;

      await request(app)
        .post(`/api/v1/portfolios/${portfolioId}/transactions`)
        .set('x-test-user-id', userA)
        .send({
          type: 'BUY',
          symbol: 'INFY',
          exchange: 'NSE',
          quantity: 20,
          price: 1400,
        });

      const perfRes = await request(app)
        .get(`/api/v1/portfolios/${portfolioId}/performance?range=1M`)
        .set('x-test-user-id', userA);

      expect(perfRes.status).toBe(200);
      const perf = perfRes.body.data;
      expect(perf.timeRange).toBe('1M');
      expect(perf.metrics.benchmarkSymbol).toBe('^NSEI');
      expect(perf.metrics).toBeDefined();
      expect(perf.calculationNotes).toBeDefined();
    });
  });

  // ─── 3. CSV Export and Import ───
  describe('Portfolio CSV Export and Import', () => {
    const userA = 'user-csv';

    it('exports sanitized CSV preventing formula injection', async () => {
      const pRes = await request(app)
        .post('/api/v1/portfolios')
        .set('x-test-user-id', userA)
        .send({ name: 'CSV Test' });
      const portfolioId = pRes.body.data.id;

      await request(app)
        .post(`/api/v1/portfolios/${portfolioId}/transactions`)
        .set('x-test-user-id', userA)
        .send({
          type: 'BUY',
          symbol: 'TCS',
          exchange: 'NSE',
          quantity: 5,
          price: 3600,
          notes: '=SUM(A1:A10)', // formula injection attempt
        });

      const exportRes = await request(app)
        .get(`/api/v1/portfolios/${portfolioId}/transactions/export`)
        .set('x-test-user-id', userA);

      expect(exportRes.status).toBe(200);
      expect(exportRes.headers['content-type']).toContain('text/csv');
      // Formula must be prepended with apostrophe in quotes
      expect(exportRes.text).toContain("\"'=SUM(A1:A10)\"");
    });

    it('previews and confirms CSV import with validation and batch commit', async () => {
      const pRes = await request(app)
        .post('/api/v1/portfolios')
        .set('x-test-user-id', userA)
        .send({ name: 'Import Target' });
      const portfolioId = pRes.body.data.id;

      const csvData = [
        'Date,Type,Symbol,Exchange,Quantity,Price,Currency,Fees,Taxes,Notes',
        '2026-01-10,BUY,RELIANCE,NSE,10,2500,INR,0,0,Batch import item 1',
        '2026-01-12,BUY,UNKNOWN999,NSE,10,100,INR,0,0,Invalid symbol',
      ].join('\n');

      // 1. Preview Import
      const previewRes = await request(app)
        .post(`/api/v1/portfolios/${portfolioId}/import/preview`)
        .set('x-test-user-id', userA)
        .send({ csvContent: csvData });

      expect(previewRes.status).toBe(200);
      expect(previewRes.body.data.totalRows).toBe(2);
      expect(previewRes.body.data.validRowsCount).toBe(1);
      expect(previewRes.body.data.invalidRowsCount).toBe(1);
      const batchId = previewRes.body.data.batchId;
      expect(batchId).toBeDefined();

      // 2. Confirm Import of valid rows
      const confirmRes = await request(app)
        .post(`/api/v1/portfolios/${portfolioId}/import/confirm`)
        .set('x-test-user-id', userA)
        .send({
          batchId,
          rows: previewRes.body.data.previewRows,
        });

      expect(confirmRes.status).toBe(201);
      expect(confirmRes.body.data.count).toBe(1);

      // Verify holdings updated
      const holdingsRes = await request(app)
        .get(`/api/v1/portfolios/${portfolioId}/holdings`)
        .set('x-test-user-id', userA);

      expect(holdingsRes.body.data.holdings).toHaveLength(1);
      expect(holdingsRes.body.data.holdings[0].symbol).toBe('RELIANCE');
    });
  });
});
