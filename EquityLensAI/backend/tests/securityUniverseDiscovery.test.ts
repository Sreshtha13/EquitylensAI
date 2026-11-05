import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { NSESecurityDiscoveryProvider } from '../src/market/instruments/nseDiscoveryProvider.js';
import { BSESecurityDiscoveryProvider } from '../src/market/instruments/bseDiscoveryProvider.js';
import { SecurityUniverseReconciliationService } from '../src/market/instruments/reconciliationService.js';
import { InstrumentRepository } from '../src/market/instruments/repository.js';
import { classifyNSESecurity, classifyBSESecurity } from '../src/market/instruments/classification.js';

describe('Complete NSE + BSE Stock Universe Discovery & Reconciliation', () => {
  const app = createApp();

  describe('1. Classification Engine (Phase 5)', () => {
    it('classifies NSE series into standard categories without false exclusions', () => {
      // Mainboard equities
      expect(classifyNSESecurity('EQ', 'RELIANCE', 'Reliance Industries Ltd').classification).toBe(
        'MAINBOARD_EQUITY',
      );
      expect(classifyNSESecurity('BE', '3IINFOLTD', '3i Infotech Ltd').classification).toBe(
        'MAINBOARD_EQUITY',
      );
      expect(classifyNSESecurity('BZ', 'ZCORP', 'Z Corp Ltd').classification).toBe(
        'MAINBOARD_EQUITY',
      );

      // SME equities
      expect(classifyNSESecurity('SM', 'THEJO', 'Thejo Engineering Limited').classification).toBe(
        'SME_EQUITY',
      );
      expect(classifyNSESecurity('ST', 'SMECORP', 'SME Corp Limited').classification).toBe(
        'SME_EQUITY',
      );

      // ETFs
      expect(classifyNSESecurity('GB', 'GOLDBEES', 'Nippon India ETF Gold BeES').classification).toBe(
        'ETF',
      );
      expect(classifyNSESecurity('EQ', 'NIFTYBEES', 'Nippon India ETF Nifty 50').classification).toBe(
        'ETF',
      );

      // Preference shares
      expect(classifyNSESecurity('P1', 'TATAMOTORP', 'Tata Motors Ltd Pref').classification).toBe(
        'PREFERENCE_SHARE',
      );
    });

    it('classifies BSE groups into standard categories', () => {
      // Mainboard groups A, B, T, X, XT, Z
      expect(classifyBSESecurity('A', 'Equity', 'ABB India Ltd').classification).toBe(
        'MAINBOARD_EQUITY',
      );
      expect(classifyBSESecurity('B', 'Equity', 'Midcap Corp Ltd').classification).toBe(
        'MAINBOARD_EQUITY',
      );
      expect(classifyBSESecurity('T', 'Equity', 'Trade Corp Ltd').classification).toBe(
        'MAINBOARD_EQUITY',
      );

      // SME groups M, MT
      expect(classifyBSESecurity('M', 'Equity', 'SME Growth Ltd').classification).toBe(
        'SME_EQUITY',
      );
      expect(classifyBSESecurity('MT', 'Equity', 'SME Trade Ltd').classification).toBe(
        'SME_EQUITY',
      );

      // ETFs
      expect(classifyBSESecurity('E', 'Equity', 'SBI ETF Nifty 50').classification).toBe('ETF');
    });
  });

  describe('2. Official NSE Discovery Provider (Phase 1)', () => {
    const nseProvider = new NSESecurityDiscoveryProvider();

    it('parses official NSE CSV format with trimmed headers and whitespace', () => {
      const sampleCsv = ` SYMBOL,NAME OF COMPANY, SERIES, DATE OF LISTING, PAID UP VALUE, MARKET LOT, ISIN NUMBER, FACE VALUE
RELIANCE,Reliance Industries Limited,EQ,29-NOV-1995,10,1,INE002A01018,10
TCS,Tata Consultancy Services Limited,EQ,25-AUG-2004,1,1,INE467B01029,1
THEJO,Thejo Engineering Limited,SM,18-SEP-2012,10,300,INE121N01019,10

**This file is updated at 10:30 am everyday.
`;
      const records = nseProvider.parseEquityCSV(sampleCsv);
      expect(records.length).toBe(3);

      const reliance = records.find((r) => r.symbol === 'RELIANCE');
      expect(reliance).toBeDefined();
      expect(reliance?.exchange).toBe('NSE');
      expect(reliance?.market).toBe('nse');
      expect(reliance?.isin).toBe('INE002A01018');
      expect(reliance?.classification).toBe('MAINBOARD_EQUITY');
      expect(reliance?.lotSize).toBe(1);

      const thejo = records.find((r) => r.symbol === 'THEJO');
      expect(thejo).toBeDefined();
      expect(thejo?.classification).toBe('SME_EQUITY');
      expect(thejo?.lotSize).toBe(300);
    });

    it('parses symbol changes and company name changes', () => {
      const symCsv = `NAME OF THE COMPANY,OLD SYMBOL,NEW SYMBOL,EFFECTIVE DATE
Cadila Healthcare Limited,CADILAHC,ZYDUSLIFE,07-MAR-2022
Tata Motors DVR,TATAMTRDVR,TATAMOTORS,01-SEP-2024
`;
      const changes = nseProvider.parseSymbolChanges(symCsv);
      expect(changes.length).toBe(2);
      expect(changes[0]?.oldSymbol).toBe('CADILAHC');
      expect(changes[0]?.newSymbol).toBe('ZYDUSLIFE');
    });

    it('throws when CSV header structure is corrupted', () => {
      const corruptCsv = `COLUMN1,COLUMN2,COLUMN3\n1,2,3`;
      expect(() => nseProvider.parseEquityCSV(corruptCsv)).toThrow(/Invalid NSE equity CSV structure/);
    });
  });

  describe('3. Official BSE Discovery Provider (Phase 2)', () => {
    const bseProvider = new BSESecurityDiscoveryProvider();

    it('normalizes BSE API records without appending NSE-specific suffixes', () => {
      const sampleScrips = [
        {
          SCRIP_CD: '500325',
          Scrip_Name: 'Reliance Industries Ltd',
          Status: 'Active',
          GROUP: 'A',
          FACE_VALUE: '10.00',
          ISIN_NUMBER: 'INE002A01018',
          scrip_id: 'RELIANCE',
          Segment: 'Equity',
          Issuer_Name: 'Reliance Industries Limited',
        },
        {
          SCRIP_CD: '543210',
          Scrip_Name: 'BSE SME Star Ltd',
          Status: 'Active',
          GROUP: 'M',
          FACE_VALUE: '10.00',
          ISIN_NUMBER: 'INE999S01011',
          scrip_id: 'SMESMART',
          Segment: 'Equity',
          Issuer_Name: 'BSE SME Star Limited',
        },
      ];

      const records = bseProvider.normalizeBSEScrips(sampleScrips, 'ACTIVE');
      expect(records.length).toBe(2);

      const reliance = records[0]!;
      expect(reliance.symbol).toBe('RELIANCE');
      expect(reliance.symbol.endsWith('-EQ')).toBe(false);
      expect(reliance.exchange).toBe('BSE');
      expect(reliance.market).toBe('bse');
      expect(reliance.scripCode).toBe('500325');
      expect(reliance.isin).toBe('INE002A01018');
      expect(reliance.classification).toBe('MAINBOARD_EQUITY');

      const sme = records[1]!;
      expect(sme.classification).toBe('SME_EQUITY');
      expect(sme.scripCode).toBe('543210');
    });
  });

  describe('4. Canonical Security Reconciliation Engine (Phase 4)', () => {
    const reconciler = new SecurityUniverseReconciliationService();

    it('links dual-listed companies on NSE and BSE using ISIN as immutable identity key', () => {
      const nseRecords = [
        {
          symbol: 'RELIANCE',
          name: 'Reliance Industries Limited',
          exchange: 'NSE',
          market: 'nse' as const,
          assetType: 'equity' as const,
          currency: 'INR',
          isin: 'INE002A01018',
          series: 'EQ',
          classification: 'MAINBOARD_EQUITY' as const,
        },
      ];

      const bseRecords = [
        {
          symbol: 'RELIANCE',
          name: 'Reliance Industries Limited',
          exchange: 'BSE',
          market: 'bse' as const,
          assetType: 'equity' as const,
          currency: 'INR',
          scripCode: '500325',
          isin: 'INE002A01018',
          group: 'A',
          segment: 'Equity',
          classification: 'MAINBOARD_EQUITY' as const,
        },
      ];

      const angelRecords = [
        {
          symbol: 'RELIANCE',
          name: 'Reliance Industries',
          exchange: 'NSE',
          market: 'nse' as const,
          assetType: 'equity' as const,
          currency: 'INR',
          providerToken: '2885',
          lotSize: 1,
          tickSize: 0.05,
        },
        {
          symbol: 'RELIANCE',
          name: 'Reliance Industries',
          exchange: 'BSE',
          market: 'bse' as const,
          assetType: 'equity' as const,
          currency: 'INR',
          providerToken: '500325',
          lotSize: 1,
          tickSize: 0.05,
        },
      ];

      const result = reconciler.reconcile({
        nseRecords,
        bseRecords,
        angelRecords,
      });

      expect(result.stats.dualExchangeCount).toBe(1);
      expect(result.stats.uniqueSecurityCount).toBe(1);
      expect(result.instruments.length).toBe(2);

      const nseListing = result.instruments.find((r) => r.exchange === 'NSE');
      const bseListing = result.instruments.find((r) => r.exchange === 'BSE');

      expect(nseListing?.isin).toBe('INE002A01018');
      expect(nseListing?.providerToken).toBe('2885');
      expect((nseListing?.metadata as Record<string, unknown> | undefined)?.['isDualListed']).toBe(true);

      expect(bseListing?.isin).toBe('INE002A01018');
      expect(bseListing?.scripCode).toBe('500325');
      expect((bseListing?.metadata as Record<string, unknown> | undefined)?.['isDualListed']).toBe(true);
    });

    it('preserves historical symbol aliases and old records without phantom deletions', () => {
      const existing = [
        {
          symbol: 'OLDSTOCK',
          name: 'Old Stock Limited',
          exchange: 'NSE',
          market: 'nse' as const,
          assetType: 'equity' as const,
          currency: 'INR',
          isin: 'INE999A01019',
        },
      ];

      const symbolChanges = [
        {
          companyName: 'Zydus Lifesciences',
          oldSymbol: 'CADILAHC',
          newSymbol: 'ZYDUSLIFE',
          effectiveDate: '07-MAR-2022',
        },
      ];

      const nseRecords = [
        {
          symbol: 'ZYDUSLIFE',
          name: 'Zydus Lifesciences Limited',
          exchange: 'NSE',
          market: 'nse' as const,
          assetType: 'equity' as const,
          currency: 'INR',
          isin: 'INE010B01027',
          series: 'EQ',
        },
      ];

      const result = reconciler.reconcile({
        nseRecords,
        bseRecords: [],
        symbolChanges,
        existingRecords: existing,
      });

      // Existing OLDSTOCK must be preserved even if absent from today's active file
      expect(result.instruments.some((r) => r.symbol === 'OLDSTOCK')).toBe(true);

      // ZYDUSLIFE should have historicalSymbols containing CADILAHC
      const zydus = result.instruments.find((r) => r.symbol === 'ZYDUSLIFE');
      expect(zydus?.historicalSymbols).toContain('CADILAHC');
    });
  });

  describe('5. Upgraded Instrument Repository (Phase 7)', () => {
    it('supports fast multi-key search by symbol, BSE scrip code, ISIN, and alias', () => {
      const repo = new InstrumentRepository();
      repo.load([
        {
          symbol: 'RELIANCE',
          name: 'Reliance Industries Limited',
          exchange: 'NSE',
          market: 'nse',
          assetType: 'equity',
          currency: 'INR',
          isin: 'INE002A01018',
          providerToken: '2885',
          classification: 'MAINBOARD_EQUITY',
          listingStatus: 'ACTIVE',
        },
        {
          symbol: 'RELIANCE',
          name: 'Reliance Industries Limited',
          exchange: 'BSE',
          market: 'bse',
          assetType: 'equity',
          currency: 'INR',
          scripCode: '500325',
          isin: 'INE002A01018',
          classification: 'MAINBOARD_EQUITY',
          listingStatus: 'ACTIVE',
        },
        {
          symbol: 'THEJO',
          name: 'Thejo Engineering Limited',
          exchange: 'NSE',
          market: 'nse',
          assetType: 'equity',
          currency: 'INR',
          isin: 'INE121N01019',
          classification: 'SME_EQUITY',
          listingStatus: 'ACTIVE',
        },
        {
          symbol: 'ZYDUSLIFE',
          name: 'Zydus Lifesciences Limited',
          exchange: 'NSE',
          market: 'nse',
          assetType: 'equity',
          currency: 'INR',
          isin: 'INE010B01027',
          classification: 'MAINBOARD_EQUITY',
          listingStatus: 'ACTIVE',
          historicalSymbols: ['CADILAHC'],
        },
      ]);

      // Search by Symbol
      const symRes = repo.search('RELIANCE');
      expect(symRes.length).toBeGreaterThan(0);
      expect(symRes[0]?.symbol).toBe('RELIANCE');

      // Search by BSE Scrip Code
      const codeRes = repo.search('500325');
      expect(codeRes.length).toBeGreaterThan(0);
      expect(codeRes[0]?.symbol).toBe('RELIANCE');
      expect(codeRes[0]?.exchange).toBe('BSE');

      // Search by ISIN
      const isinRes = repo.search('INE121N01019');
      expect(isinRes.length).toBeGreaterThan(0);
      expect(isinRes[0]?.symbol).toBe('THEJO');

      // Search by Historical Symbol Alias
      const aliasRes = repo.search('CADILAHC');
      expect(aliasRes.length).toBeGreaterThan(0);
      expect(aliasRes[0]?.symbol).toBe('ZYDUSLIFE');

      // Filter by classification
      const smeRes = repo.search('T', { classification: 'SME_EQUITY' });
      expect(smeRes.every((r) => r.classification === 'SME_EQUITY')).toBe(true);
      expect(smeRes.some((r) => r.symbol === 'THEJO')).toBe(true);

      // Filter by exchange
      const bseRes = repo.search('REL', { exchange: 'BSE' });
      expect(bseRes.every((r) => r.exchange === 'BSE')).toBe(true);
    });
  });

  describe('6. REST API Endpoints (Phase 8)', () => {
    it('GET /api/v1/stocks/search supports classification, exchange, and listingStatus filters', async () => {
      const res = await request(app).get('/api/v1/stocks/search?q=RELIANCE&exchange=NSE');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.items).toBeInstanceOf(Array);
      expect(res.body.data.items.length).toBeGreaterThan(0);
      expect(res.body.data.items[0].exchange).toBe('NSE');
    });

    it('GET /api/v1/stocks/ingest/status returns rich telemetry across NSE, BSE and Angel', async () => {
      const res = await request(app).get('/api/v1/stocks/ingest/status');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      const data = res.body.data;

      expect(typeof data.isIngesting).toBe('boolean');
      expect(typeof data.totalInstruments).toBe('number');
      expect(typeof data.nseDiscoveredCount).toBe('number');
      expect(typeof data.bseDiscoveredCount).toBe('number');
      expect(typeof data.uniqueSecurityCount).toBe('number');
      expect(typeof data.dualExchangeCount).toBe('number');
      expect(typeof data.mainboardCount).toBe('number');
      expect(typeof data.smeCount).toBe('number');
      expect(Array.isArray(data.failedDownloads)).toBe(true);
      expect(data.sources).toBeDefined();
      expect(data.sources.nse).toBeDefined();
      expect(data.sources.bse).toBeDefined();
      expect(data.sources.angel).toBeDefined();
    });

    it('POST /api/v1/stocks/ingest accepts optional mode parameter', async () => {
      const res = await request(app).post('/api/v1/stocks/ingest').send({ mode: 'reconcile' });
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.mode).toBe('reconcile');
      expect(res.body.data.ingestedCount).toBeGreaterThan(0);
    });
  });
});
