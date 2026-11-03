import type { VerifiedCompanyEvidenceContext } from './ContextBuilder.js';

export interface GroundingValidationResult {
  isGrounded: boolean;
  unverifiedClaims: string[];
  missingMetrics: string[];
  periodMismatches: string[];
}

export class FinancialDataGroundingService {
  /**
   * Distinguishes missing metrics from zero values across company contexts.
   */
  auditMetricAvailability(
    companyA: VerifiedCompanyEvidenceContext,
    companyB?: VerifiedCompanyEvidenceContext,
  ): {
    availableMetricsA: string[];
    missingMetricsA: string[];
    availableMetricsB: string[];
    missingMetricsB: string[];
    comparableMetrics: string[];
  } {
    const keysA = new Set(Array.from(companyA.evidenceMap.keys()).map((k) => k.replace(`_${companyA.symbol}`, '')));
    const keysB = companyB
      ? new Set(Array.from(companyB.evidenceMap.keys()).map((k) => k.replace(`_${companyB.symbol}`, '')))
      : new Set<string>();

    const allMetrics = [
      'PRICE',
      'MCAP',
      'ROE',
      'ROCE',
      'ROA',
      'OPERATING_MARGIN',
      'NET_MARGIN',
      'DEBT_TO_EQUITY',
      'INTEREST_COVERAGE',
      'CURRENT_RATIO',
      'PE_RATIO',
      'PB_RATIO',
      'EV_EBITDA',
      'REVENUE_GROWTH',
      'NET_INCOME_GROWTH',
      'HEALTH_SCORE',
      'PERF_1Y',
      'PERF_3Y_CAGR',
    ];

    const availableA = allMetrics.filter((m) => keysA.has(m));
    const missingA = allMetrics.filter((m) => !keysA.has(m));
    const availableB = allMetrics.filter((m) => keysB.has(m));
    const missingB = allMetrics.filter((m) => !keysB.has(m));
    const comparable = allMetrics.filter((m) => keysA.has(m) && keysB.has(m));

    return {
      availableMetricsA: availableA,
      missingMetricsA: missingA,
      availableMetricsB: availableB,
      missingMetricsB: missingB,
      comparableMetrics: comparable,
    };
  }

  /**
   * Asserts that reporting periods are harmonized.
   */
  checkPeriodAlignment(
    companyA: VerifiedCompanyEvidenceContext,
    companyB: VerifiedCompanyEvidenceContext,
  ): { isAligned: boolean; note?: string } {
    if (companyA.reportingPeriod !== companyB.reportingPeriod) {
      return {
        isAligned: false,
        note: `Period mismatch detected: ${companyA.symbol} uses ${companyA.reportingPeriod} while ${companyB.symbol} uses ${companyB.reportingPeriod}.`,
      };
    }
    return { isAligned: true };
  }

  /**
   * Validates citations against verified facts in evidence context.
   */
  validateEvidenceIds(
    citedIds: string[],
    validEvidenceSet: Set<string>,
  ): { valid: string[]; invalid: string[] } {
    const valid: string[] = [];
    const invalid: string[] = [];

    for (const id of citedIds) {
      if (validEvidenceSet.has(id)) {
        valid.push(id);
      } else {
        invalid.push(id);
      }
    }

    return { valid, invalid };
  }
}

export const financialDataGroundingService = new FinancialDataGroundingService();
