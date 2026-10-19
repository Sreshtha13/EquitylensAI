import { apiClient } from './client';

export type ResearchClaim = {
  text: string;
  evidenceIds: string[];
};

export type ResearchEvidence = {
  id: string;
  type: 'statement' | 'metric' | 'health_score' | 'market_quote' | 'market_history';
  metric: string;
  value: number | string | null;
  unit: string | null;
  period: string | null;
  periodType?: 'annual' | 'quarterly' | 'ttm';
  source: string;
  timestamp: string | null;
  freshness?: 'live' | 'delayed' | 'eod' | 'historical' | 'stale' | 'periodic' | 'unavailable';
  stale?: boolean;
};

export type ResearchResponse = {
  schemaVersion: '1.0';
  instrument: { symbol: string; exchange: string; name: string | null };
  comparisonInstrument: { symbol: string; exchange: string; name: string | null } | null;
  question: string;
  intent:
    | 'GENERAL'
    | 'PROFITABILITY'
    | 'GROWTH'
    | 'VALUATION'
    | 'LIQUIDITY'
    | 'CASH_FLOW'
    | 'DEBT'
    | 'RISK'
    | 'HISTORICAL_PERFORMANCE'
    | 'COMPARISON';
  summary: ResearchClaim;
  overallAssessment: {
    label: 'POSITIVE' | 'NEGATIVE' | 'MIXED' | 'INSUFFICIENT_DATA';
    explanation: string;
    evidenceIds: string[];
  };
  sections: Array<{
    title: string;
    analysis: ResearchClaim;
    risks: ResearchClaim[];
    limitations: string[];
  }>;
  strengths: ResearchClaim[];
  riskFactors: ResearchClaim[];
  growthSignals: ResearchClaim[];
  valuationObservations: ResearchClaim[];
  financialObservations: ResearchClaim[];
  missingData: string[];
  evidence: ResearchEvidence[];
  confidence: {
    level: 'HIGH' | 'MEDIUM' | 'LIMITED' | 'LOW';
    explanation: string;
    availableEvidence: number;
    totalEvidence: number;
  };
  disclaimer: string;
};

export type ResearchRequest = {
  symbol: string;
  exchange?: string;
  question: string;
  comparisonInstrument?: { symbol: string; exchange?: string };
};

export function requestResearch(body: ResearchRequest): Promise<ResearchResponse> {
  return apiClient.post<ResearchResponse>('/api/v1/ai/research', body);
}
