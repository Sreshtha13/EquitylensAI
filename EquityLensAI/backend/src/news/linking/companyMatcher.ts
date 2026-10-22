import type { CompanyAssociation } from '@equitylensai/shared';
import type { RawAnnouncementItem } from '../providers/types.js';
import { instrumentRepository } from '../../market/instruments/repository.js';

export class CompanyMatcher {
  /**
   * Resolves instrument association for official corporate announcements.
   * Uses exchange-provided identifiers (ISIN, Symbol + Exchange) first.
   */
  matchAnnouncement(raw: RawAnnouncementItem): CompanyAssociation | null {
    // 1. ISIN match
    if (raw.isin) {
      const cleanIsin = raw.isin.trim().toUpperCase();
      const allInstruments = instrumentRepository.list();
      const found = allInstruments.find((i) => i.isin?.toUpperCase() === cleanIsin);
      if (found) {
        return {
          symbol: found.symbol,
          exchange: found.exchange,
          companyName: found.name,
          confidence: 1.0,
          method: 'isin',
        };
      }
    }

    // 2. Verified Exchange + Symbol match
    if (raw.symbol && raw.exchange) {
      const found = instrumentRepository.getBySymbol(raw.symbol, raw.exchange);
      if (found) {
        return {
          symbol: found.symbol,
          exchange: found.exchange,
          companyName: found.name,
          confidence: 0.99,
          method: 'symbol_exchange',
        };
      }
    }

    // 3. Exact Symbol match
    if (raw.symbol) {
      const found = instrumentRepository.getBySymbol(raw.symbol);
      if (found) {
        return {
          symbol: found.symbol,
          exchange: found.exchange,
          companyName: found.name,
          confidence: 0.95,
          method: 'symbol_exact',
        };
      }
    }

    // 4. Normalized Company Name match
    if (raw.companyName && raw.companyName.length >= 4) {
      const cleanName = this.normalizeCompanyName(raw.companyName);
      const allInstruments = instrumentRepository.list();
      const matching = allInstruments.filter((i) => {
        const instClean = this.normalizeCompanyName(i.name);
        return instClean === cleanName || (cleanName.length > 8 && instClean.includes(cleanName));
      });

      if (matching.length === 1 && matching[0]) {
        const found = matching[0];
        return {
          symbol: found.symbol,
          exchange: found.exchange,
          companyName: found.name,
          confidence: 0.85,
          method: 'name_match',
        };
      }
    }

    // Default to retaining symbol and exchange provided by source if format is valid
    if (raw.symbol && /^[A-Z0-9-]{1,20}$/i.test(raw.symbol)) {
      return {
        symbol: raw.symbol.toUpperCase(),
        exchange: raw.exchange || 'NSE',
        companyName: raw.companyName,
        confidence: 0.9,
        method: 'symbol_exact',
      };
    }

    return null;
  }

  /**
   * Matches general news headlines and excerpts against tracked instruments.
   * Avoids false positives from generic words.
   */
  matchNewsText(title: string, excerpt?: string | null): CompanyAssociation[] {
    const text = `${title} ${excerpt || ''}`;
    const associations: CompanyAssociation[] = [];
    const seen = new Set<string>();

    const allInstruments = instrumentRepository.list();
    if (!allInstruments.length) return [];

    // Common ticker symbols that are also common English words
    const noisySymbols = new Set([
      'IT',
      'BE',
      'ON',
      'AT',
      'ALL',
      'CAN',
      'FOR',
      'NEW',
      'NOW',
      'OUT',
      'SEE',
      'DAY',
      'MAX',
      'GO',
    ]);

    for (const inst of allInstruments) {
      const sym = inst.symbol.toUpperCase();
      const name = inst.name;
      const key = `${inst.exchange}:${sym}`;

      if (seen.has(key)) continue;

      let matched = false;
      let method: CompanyAssociation['method'] = 'symbol_exact';
      let confidence = 0.95;

      // 1. Company name full match
      const cleanInstName = this.normalizeCompanyName(name);
      if (cleanInstName.length >= 5 && text.toLowerCase().includes(cleanInstName.toLowerCase())) {
        matched = true;
        method = 'name_match';
        confidence = 0.92;
      }

      // 2. Symbol word boundary match
      if (!matched && !noisySymbols.has(sym)) {
        const symRegex = new RegExp(`\\b${sym}\\b`, 'i');
        if (symRegex.test(title)) {
          matched = true;
          method = 'symbol_exact';
          confidence = 0.9;
        }
      }

      if (matched) {
        seen.add(key);
        associations.push({
          symbol: inst.symbol,
          exchange: inst.exchange,
          companyName: inst.name,
          confidence,
          method,
        });
      }
    }

    return associations;
  }

  private normalizeCompanyName(name: string): string {
    return name
      .replace(/\b(limited|ltd|industries|corp|corporation|inc|incorporated|pvt|private)\b/gi, '')
      .replace(/[^\w\s]/g, '')
      .trim()
      .toLowerCase();
  }
}

export const companyMatcher = new CompanyMatcher();
