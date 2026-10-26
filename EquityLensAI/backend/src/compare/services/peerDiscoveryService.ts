import type { PeerDiscoveryResult, SuggestedPeer } from '../types.js';
import { marketService } from '../../market/marketService.js';
import { instrumentRepository } from '../../market/instruments/repository.js';
import { AppError } from '../../utils/appError.js';
import { logger } from '../../utils/logger.js';

export class PeerDiscoveryService {
  async discoverPeers(symbol: string, exchange = 'NSE'): Promise<PeerDiscoveryResult> {
    const cleanSym = symbol.trim().toUpperCase().replace(/\.(NS|BO)$/i, '');
    const cleanExch = exchange.trim().toUpperCase();

    // 1. Resolve base company profile & quote
    let profile: any = null;
    let quote: any = null;

    try {
      [profile, quote] = await Promise.all([
        marketService.getCompanyProfile({ symbol: cleanSym, exchange: cleanExch }),
        marketService.getQuote({ symbol: cleanSym, exchange: cleanExch }).catch(() => null),
      ]);
    } catch (err: unknown) {
      throw new AppError(
        'INSTRUMENT_NOT_FOUND',
        `Could not resolve company ${cleanSym} on ${cleanExch}.`,
        404,
      );
    }

    const baseCompany = {
      symbol: cleanSym,
      exchange: cleanExch,
      name: profile?.name || quote?.name || cleanSym,
      sector: profile?.sector || null,
      industry: profile?.industry || null,
    };

    const warnings: string[] = [];

    // If neither sector nor industry is verified
    if (!profile?.sector && !profile?.industry) {
      return {
        baseCompany,
        peers: [],
        matchingMethod: 'manual',
        warnings: [
          `No verified industry or sector classification available for ${cleanSym}. Automatic peer discovery requires verified classification metadata.`,
        ],
      };
    }

    // 2. Scan available instruments in repository for potential candidates
    const allInstruments = instrumentRepository.search('', { limit: 500 });
    const candidates = allInstruments.filter(
      (inst) =>
        inst.symbol.toUpperCase() !== cleanSym &&
        inst.assetType === 'equity',
    );

    // Profile a batch of candidates to find real classification matches
    const peerMatches: SuggestedPeer[] = [];
    const baseCap =
      profile?.sharesOutstanding && quote?.price
        ? Math.round(profile.sharesOutstanding * quote.price)
        : null;

    // Check up to 35 candidate profiles with early termination once enough matches found
    const candidatesToCheck = candidates.slice(0, 35);
    const profilePromises = candidatesToCheck.map(async (c) => {
      try {
        const cProf = await marketService.getCompanyProfile({
          symbol: c.symbol,
          exchange: c.exchange,
        }).catch(() => null);

        if (!cProf || (!cProf.sector && !cProf.industry)) return null;

        let matchScore = 0;
        let matchRationale = '';

        const sameIndustry =
          profile.industry &&
          cProf.industry &&
          profile.industry.toLowerCase() === cProf.industry.toLowerCase();

        const sameSector =
          profile.sector &&
          cProf.sector &&
          profile.sector.toLowerCase() === cProf.sector.toLowerCase();

        if (sameIndustry) {
          matchScore = 85;
          matchRationale = `Same Industry: ${profile.industry}`;
        } else if (sameSector) {
          matchScore = 65;
          matchRationale = `Same Sector: ${profile.sector}`;
        } else {
          return null;
        }

        // Adjust score by market cap proximity if available
        let cCap: number | null = null;
        try {
          const cQuote = await marketService.getQuote({
            symbol: c.symbol,
            exchange: c.exchange,
          }).catch(() => null);
          cCap =
            cProf?.sharesOutstanding && cQuote?.price
              ? Math.round(cProf.sharesOutstanding * cQuote.price)
              : null;

          if (baseCap && cCap && baseCap > 0 && cCap > 0) {
            const ratio = Math.min(baseCap, cCap) / Math.max(baseCap, cCap);
            if (ratio > 0.5) {
              matchScore += 10;
              matchRationale += ' (Comparable Market Cap)';
            }
          }
        } catch {
          // ignore quote failures
        }

        return {
          symbol: c.symbol,
          exchange: c.exchange,
          name: cProf.name || c.name,
          sector: cProf.sector,
          industry: cProf.industry,
          marketCap: cCap,
          matchScore,
          matchRationale,
        };
      } catch (err: unknown) {
        logger.debug({ err, symbol: c.symbol }, 'Failed candidate profiling');
        return null;
      }
    });

    const evaluated = await Promise.all(profilePromises);
    for (const p of evaluated) {
      if (p) peerMatches.push(p);
    }

    // Sort peers by matchScore desc, then by cap
    peerMatches.sort((a, b) => {
      if (b.matchScore !== a.matchScore) return b.matchScore - a.matchScore;
      return (b.marketCap ?? 0) - (a.marketCap ?? 0);
    });

    const finalPeers = peerMatches.slice(0, 8);
    const matchingMethod = finalPeers.some((p) => p.matchScore >= 80)
      ? 'industry_exact'
      : 'sector_match';

    return {
      baseCompany,
      peers: finalPeers,
      matchingMethod,
      warnings,
    };
  }
}

export const peerDiscoveryService = new PeerDiscoveryService();
