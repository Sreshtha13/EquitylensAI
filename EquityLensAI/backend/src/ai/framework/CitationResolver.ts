import type { ResearchEvidenceItem } from '@equitylensai/shared';

export class CitationResolver {
  static resolve(
    citedIds: string[],
    validEvidence: Set<string> | ResearchEvidenceItem[] | Array<{ id: string }>,
  ): { validEvidenceIds: string[]; invalidEvidenceIds: string[] } {
    const validSet =
      validEvidence instanceof Set
        ? validEvidence
        : new Set(validEvidence.map((e) => e.id));
    const valid: string[] = [];
    const invalid: string[] = [];
    for (const id of citedIds) {
      if (validSet.has(id)) {
        if (!valid.includes(id)) valid.push(id);
      } else {
        if (!invalid.includes(id)) invalid.push(id);
      }
    }
    return { validEvidenceIds: valid, invalidEvidenceIds: invalid };
  }

  /**
   * Filter cited evidence IDs to ensure they refer only to real, verified evidence items.
   */
  static filterValidCitations(
    citedIds: string[],
    evidence: ResearchEvidenceItem[] | Array<{ id: string }>,
  ): string[] {
    const validSet = new Set(evidence.map((e) => e.id));
    return Array.from(new Set(citedIds.filter((id) => validSet.has(id))));
  }

  /**
   * Generates a citation map for evidence items for easy prompt referencing.
   */
  static formatEvidenceReferenceList(
    evidence: ResearchEvidenceItem[] | Array<{ id: string; title?: string; sourceReference?: string; value?: unknown }>,
  ): string {
    return evidence
      .map((item) => {
        const title = 'title' in item ? item.title : item.id;
        const source = 'sourceReference' in item ? item.sourceReference : 'System';
        const val = 'value' in item && item.value !== undefined && item.value !== null ? ` | Value: ${JSON.stringify(item.value)}` : '';
        return `[${item.id}] ${title} (${source})${val}`;
      })
      .join('\n');
  }
}
