export interface QualityAuditResult {
  passed: boolean;
  violations: string[];
  analyticalDepthScore: number; // 0 to 100
}

export class AIResponseQualityValidator {
  private static readonly FORBIDDEN_ADVICE_PATTERNS = [
    /\b(?:strong\s+)?buy\s+(?:recommendation|signal|target)\b/i,
    /\b(?:strong\s+)?sell\s+(?:recommendation|signal|target)\b/i,
    /\btarget\s+price\s+of\s+₹?\d+/i,
    /\bguaranteed\s+(?:returns?|gains?|profit)\b/i,
  ];

  private static readonly ANALYTICAL_REASONING_MARKERS = [
    /\bbecause\b/i,
    /\bdue to\b/i,
    /\bdriven by\b/i,
    /\breflects\b/i,
    /\bindicates?\b/i,
    /\bcompared to\b/i,
    /\boutperformed\b/i,
    /\bhigher\s+(?:return|margin|cagr|ratio|growth)\b/i,
    /\blower\s+(?:leverage|debt|valuation|multiple)\b/i,
    /\bhowever\b/i,
    /\bwhereas\b/i,
    /\bsupported by\b/i,
  ];

  static auditContent(content: string): QualityAuditResult {
    const violations: string[] = [];

    // Check forbidden financial advice
    for (const pattern of this.FORBIDDEN_ADVICE_PATTERNS) {
      if (pattern.test(content)) {
        violations.push(`Contains prohibited direct investment advice matching ${pattern.toString()}`);
      }
    }

    // Check analytical depth
    let markerMatches = 0;
    for (const marker of this.ANALYTICAL_REASONING_MARKERS) {
      if (marker.test(content)) {
        markerMatches += 1;
      }
    }

    // Score from 0 to 100 based on marker diversity and length
    const lengthBonus = Math.min(content.length / 50, 40);
    const markerScore = Math.min(markerMatches * 15, 60);
    const analyticalDepthScore = Math.round(lengthBonus + markerScore);

    if (content.length < 50) {
      violations.push('Analysis content is too short to provide substantive equity research value.');
    }

    return {
      passed: violations.length === 0,
      violations,
      analyticalDepthScore,
    };
  }
}
