import { logger } from '../../utils/logger.js';
import type { DiscoveredNSERecord, SymbolChangeRecord, NameChangeRecord } from './nseDiscoveryProvider.js';
import type { DiscoveredBSERecord } from './bseDiscoveryProvider.js';
import type { InstrumentRecord, SecurityClassification } from '../types.js';

export interface ReconciliationStats {
  nseDiscoveredCount: number;
  bseDiscoveredCount: number;
  angelDiscoveredCount: number;
  totalCanonicalInstruments: number;
  uniqueSecurityCount: number;
  dualExchangeCount: number;
  nseOnlyCount: number;
  bseOnlyCount: number;
  mainboardCount: number;
  smeCount: number;
  etfCount: number;
  newSecuritiesCount: number;
  changedSymbolsCount: number;
  unresolvedMappingsCount: number;
  reconciledAt: string;
}

export interface ReconciledUniverse {
  instruments: InstrumentRecord[];
  stats: ReconciliationStats;
  historicalSymbolMap: Map<string, string>; // oldSymbol -> currentSymbol
}

export class SecurityUniverseReconciliationService {
  /**
   * Reconciles records across official NSE discovery, BSE discovery,
   * supplementary Angel One master, and existing records.
   */
  reconcile(params: {
    nseRecords: DiscoveredNSERecord[];
    bseRecords: DiscoveredBSERecord[];
    angelRecords?: InstrumentRecord[];
    symbolChanges?: SymbolChangeRecord[];
    nameChanges?: NameChangeRecord[];
    existingRecords?: InstrumentRecord[];
  }): ReconciledUniverse {
    const {
      nseRecords = [],
      bseRecords = [],
      angelRecords = [],
      symbolChanges = [],
      nameChanges = [],
      existingRecords = [],
    } = params;

    const nowIso = new Date().toISOString();

    // 1. Build Historical Symbol Mapping (oldSymbol -> currentSymbol)
    const oldToNewSymbol = new Map<string, string>();
    const symbolAliases = new Map<string, Set<string>>(); // currentSymbol -> Set of old symbols
    const nameAliases = new Map<string, string[]>(); // symbol -> old company names

    for (const change of symbolChanges) {
      if (change.oldSymbol && change.newSymbol) {
        oldToNewSymbol.set(change.oldSymbol.toUpperCase(), change.newSymbol.toUpperCase());
        const set = symbolAliases.get(change.newSymbol.toUpperCase()) ?? new Set<string>();
        set.add(change.oldSymbol.toUpperCase());
        symbolAliases.set(change.newSymbol.toUpperCase(), set);
      }
    }

    for (const nameChg of nameChanges) {
      if (nameChg.symbol && nameChg.oldName) {
        const sym = nameChg.symbol.toUpperCase();
        const names = nameAliases.get(sym) ?? [];
        names.push(nameChg.oldName);
        nameAliases.set(sym, names);
      }
    }

    // 2. Index existing records by exchange:symbol and by isin
    const existingMap = new Map<string, InstrumentRecord>();
    for (const rec of existingRecords) {
      existingMap.set(`${rec.exchange.toUpperCase()}:${rec.symbol.toUpperCase()}`, rec);
    }

    // 3. Track ISIN cross-listings: isin -> { nse?: DiscoveredNSERecord; bse?: DiscoveredBSERecord }
    const isinCrossMap = new Map<
      string,
      {
        nse?: DiscoveredNSERecord;
        bse?: DiscoveredBSERecord;
        canonicalName: string;
        classification: SecurityClassification;
      }
    >();

    // Index NSE by ISIN and by Symbol
    const nseBySymbol = new Map<string, DiscoveredNSERecord>();
    for (const nseRec of nseRecords) {
      const symUpper = nseRec.symbol.toUpperCase();
      nseBySymbol.set(symUpper, nseRec);

      if (nseRec.isin && nseRec.isin.length === 12) {
        const entry = isinCrossMap.get(nseRec.isin) ?? {
          canonicalName: nseRec.name,
          classification: nseRec.classification ?? 'MAINBOARD_EQUITY',
        };
        entry.nse = nseRec;
        if (!entry.canonicalName || entry.canonicalName.length < nseRec.name.length) {
          entry.canonicalName = nseRec.name;
        }
        isinCrossMap.set(nseRec.isin, entry);
      }
    }

    // Index BSE by ISIN and by ScripCode / Symbol
    const bseByCode = new Map<string, DiscoveredBSERecord>();
    const bseBySymbol = new Map<string, DiscoveredBSERecord>();
    for (const bseRec of bseRecords) {
      if (bseRec.scripCode) {
        bseByCode.set(bseRec.scripCode, bseRec);
      }
      bseBySymbol.set(bseRec.symbol.toUpperCase(), bseRec);

      if (bseRec.isin && bseRec.isin.length === 12) {
        const entry = isinCrossMap.get(bseRec.isin) ?? {
          canonicalName: bseRec.name,
          classification: bseRec.classification ?? 'MAINBOARD_EQUITY',
        };
        entry.bse = bseRec;
        // If entry had no name or BSE name is more descriptive, keep it
        if (!entry.canonicalName) {
          entry.canonicalName = bseRec.name;
        }
        isinCrossMap.set(bseRec.isin, entry);
      }
    }

    // 4. Index Angel One records by:
    // a) ISIN (if available)
    // b) `${exchange}:${symbol}`
    // c) `BSE:${token}`
    const angelByIsin = new Map<string, InstrumentRecord>();
    const angelByExchSym = new Map<string, InstrumentRecord>();
    const angelByBseToken = new Map<string, InstrumentRecord>();

    for (const ang of angelRecords) {
      const exch = ang.exchange.toUpperCase();
      const sym = ang.symbol.toUpperCase();
      angelByExchSym.set(`${exch}:${sym}`, ang);

      if (ang.isin && ang.isin.length === 12) {
        angelByIsin.set(ang.isin, ang);
      }
      if (exch === 'BSE' && ang.providerToken) {
        angelByBseToken.set(ang.providerToken, ang);
      }
    }

    // 5. Build Reconciled Canonical Instruments List
    const reconciledList: InstrumentRecord[] = [];
    const processedKeys = new Set<string>();

    let newSecuritiesCount = 0;
    let unresolvedMappingsCount = 0;

    // Helper to enrich with Angel One tokens & lot/tick sizes
    const enrichFromAngel = (rec: InstrumentRecord): void => {
      const exch = rec.exchange.toUpperCase();
      const sym = rec.symbol.toUpperCase();

      let match = angelByExchSym.get(`${exch}:${sym}`);

      if (!match && rec.isin) {
        const isinMatch = angelByIsin.get(rec.isin);
        if (isinMatch && isinMatch.exchange.toUpperCase() === exch) {
          match = isinMatch;
        }
      }

      if (!match && exch === 'BSE' && rec.scripCode) {
        match = angelByBseToken.get(rec.scripCode);
      }

      if (match) {
        rec.providerToken = rec.providerToken || match.providerToken;
        rec.lotSize = rec.lotSize || match.lotSize;
        rec.tickSize = rec.tickSize || match.tickSize;
      }
    };

    // A. Process all NSE official records
    for (const nseRec of nseRecords) {
      const key = `NSE:${nseRec.symbol.toUpperCase()}`;
      processedKeys.add(key);

      const existing = existingMap.get(key);
      const isNew = !existing;
      if (isNew) newSecuritiesCount++;

      // Check for dual-listing via ISIN
      let isDualListed = false;
      let matchingBseCode: string | undefined;
      let matchingBseSym: string | undefined;

      if (nseRec.isin) {
        const cross = isinCrossMap.get(nseRec.isin);
        if (cross?.bse) {
          isDualListed = true;
          matchingBseCode = cross.bse.scripCode;
          matchingBseSym = cross.bse.symbol;
        }
      }

      const historical = Array.from(symbolAliases.get(nseRec.symbol.toUpperCase()) ?? []);

      const record: InstrumentRecord = {
        symbol: nseRec.symbol.toUpperCase(),
        name: nseRec.name,
        exchange: 'NSE',
        market: 'nse',
        assetType: nseRec.assetType || 'equity',
        currency: 'INR',
        isin: nseRec.isin,
        series: nseRec.series,
        classification: nseRec.classification || 'MAINBOARD_EQUITY',
        listingStatus: nseRec.listingStatus || 'ACTIVE',
        providerToken: nseRec.providerToken || existing?.providerToken,
        tickSize: nseRec.tickSize || existing?.tickSize || 0.05,
        lotSize: nseRec.lotSize || existing?.lotSize || 1,
        firstDiscoveredAt: existing?.firstDiscoveredAt || nseRec.firstDiscoveredAt || nowIso,
        lastDiscoveredAt: nowIso,
        lastVerifiedAt: nowIso,
        dataCompleteness: nseRec.isin ? 'COMPLETE' : 'PARTIAL',
        source: 'nse_official',
        historicalSymbols: historical.length > 0 ? historical : existing?.historicalSymbols,
        metadata: {
          isDualListed,
          bseScripCode: matchingBseCode,
          bseSymbol: matchingBseSym,
          marketLot: nseRec.marketLot,
          faceValue: nseRec.faceValue,
        },
      };

      enrichFromAngel(record);

      if (!record.isin && !record.providerToken) {
        unresolvedMappingsCount++;
      }

      reconciledList.push(record);
    }

    // B. Process all BSE official records
    for (const bseRec of bseRecords) {
      const key = `BSE:${bseRec.symbol.toUpperCase()}`;
      processedKeys.add(key);

      const existing = existingMap.get(key);
      const isNew = !existing;
      if (isNew) newSecuritiesCount++;

      // Check for dual-listing via ISIN
      let isDualListed = false;
      let matchingNseSym: string | undefined;

      if (bseRec.isin) {
        const cross = isinCrossMap.get(bseRec.isin);
        if (cross?.nse) {
          isDualListed = true;
          matchingNseSym = cross.nse.symbol;
        }
      }

      const historical = Array.from(symbolAliases.get(bseRec.symbol.toUpperCase()) ?? []);

      const record: InstrumentRecord = {
        symbol: bseRec.symbol.toUpperCase(),
        name: bseRec.name,
        exchange: 'BSE',
        market: 'bse',
        assetType: bseRec.assetType || 'equity',
        currency: 'INR',
        isin: bseRec.isin,
        scripCode: bseRec.scripCode,
        series: bseRec.group,
        classification: bseRec.classification || 'MAINBOARD_EQUITY',
        listingStatus: bseRec.listingStatus || 'ACTIVE',
        providerToken: bseRec.providerToken || bseRec.scripCode || existing?.providerToken,
        tickSize: bseRec.tickSize || existing?.tickSize || 0.05,
        lotSize: bseRec.lotSize || existing?.lotSize || 1,
        firstDiscoveredAt: existing?.firstDiscoveredAt || bseRec.firstDiscoveredAt || nowIso,
        lastDiscoveredAt: nowIso,
        lastVerifiedAt: nowIso,
        dataCompleteness: bseRec.isin ? 'COMPLETE' : 'PARTIAL',
        source: 'bse_official',
        historicalSymbols: historical.length > 0 ? historical : existing?.historicalSymbols,
        metadata: {
          isDualListed,
          nseSymbol: matchingNseSym,
          bseGroup: bseRec.group,
          bseSegment: bseRec.segment,
          industry: bseRec.industry,
          faceValue: bseRec.faceValue,
        },
      };

      enrichFromAngel(record);

      if (!record.isin && !record.providerToken) {
        unresolvedMappingsCount++;
      }

      reconciledList.push(record);
    }

    // C. Preserve existing records that were not in today's official files (NEVER DELETE)
    for (const [key, existRec] of existingMap.entries()) {
      if (!processedKeys.has(key)) {
        // Carry forward existing record with updated verification timestamp
        reconciledList.push({
          ...existRec,
          lastVerifiedAt: nowIso,
          dataCompleteness: existRec.dataCompleteness || 'PARTIAL',
        });
        processedKeys.add(key);
      }
    }

    // 6. Compute Counts & Cross-Exchange Statistics
    let mainboardCount = 0;
    let smeCount = 0;
    let etfCount = 0;

    for (const rec of reconciledList) {
      if (rec.classification === 'MAINBOARD_EQUITY') mainboardCount++;
      else if (rec.classification === 'SME_EQUITY') smeCount++;
      else if (rec.classification === 'ETF') etfCount++;
    }

    // Dual-exchange and single-exchange counts based on ISIN
    let dualExchangeCount = 0;
    let nseOnlyCount = 0;
    let bseOnlyCount = 0;

    for (const cross of isinCrossMap.values()) {
      if (cross.nse && cross.bse) {
        dualExchangeCount++;
      } else if (cross.nse && !cross.bse) {
        nseOnlyCount++;
      } else if (!cross.nse && cross.bse) {
        bseOnlyCount++;
      }
    }

    const uniqueSecurityCount =
      isinCrossMap.size + (reconciledList.filter((r) => !r.isin).length);

    const stats: ReconciliationStats = {
      nseDiscoveredCount: nseRecords.length,
      bseDiscoveredCount: bseRecords.length,
      angelDiscoveredCount: angelRecords.length,
      totalCanonicalInstruments: reconciledList.length,
      uniqueSecurityCount,
      dualExchangeCount,
      nseOnlyCount,
      bseOnlyCount,
      mainboardCount,
      smeCount,
      etfCount,
      newSecuritiesCount,
      changedSymbolsCount: symbolChanges.length,
      unresolvedMappingsCount,
      reconciledAt: nowIso,
    };

    logger.info(
      {
        total: reconciledList.length,
        unique: uniqueSecurityCount,
        dual: dualExchangeCount,
        mainboard: mainboardCount,
        sme: smeCount,
        new: newSecuritiesCount,
      },
      'Security universe reconciliation complete',
    );

    return {
      instruments: reconciledList,
      stats,
      historicalSymbolMap: oldToNewSymbol,
    };
  }
}

export const reconciliationService = new SecurityUniverseReconciliationService();
