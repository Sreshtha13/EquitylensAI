import PDFDocument from 'pdfkit';
import type {
  ResearchReport,
  ResearchProject,
  ResearchEvidenceItem,
  ResearchNote,
} from '@equitylensai/shared';

export class ExportService {
  /**
   * Generates a professional institutional equity research PDF using PDFKit.
   * Returns a Buffer containing the complete PDF binary.
   */
  async generatePdf(project: ResearchProject, report: ResearchReport): Promise<Buffer> {
    return new Promise<Buffer>((resolve, reject) => {
      try {
        const doc = new PDFDocument({
          size: 'A4',
          margins: { top: 50, bottom: 50, left: 50, right: 50 },
          bufferPages: true,
          info: {
            Title: report.title,
            Author: 'EquityLensAI Platform',
            Subject: `Equity Research Report: ${project.companyName} (${project.symbol})`,
            Keywords: 'equity, research, finance, valuation, investment',
            CreationDate: new Date(),
          },
        });

        const chunks: Buffer[] = [];
        doc.on('data', (chunk) => chunks.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', (err) => reject(err));

        // ─── Header Decorator ───────────────────────────────────────────────
        doc.rect(50, 45, doc.page.width - 100, 3).fill('#0284c7'); // Sky blue accent bar

        // ─── Cover / Title Section ──────────────────────────────────────────
        doc.moveDown(1.5);
        doc.fontSize(10).fillColor('#64748b').text('EQUITYLENSAI INSTITUTIONAL RESEARCH', { characterSpacing: 1.5 });
        doc.moveDown(0.5);

        doc.fontSize(22).fillColor('#0f172a').font('Helvetica-Bold').text(report.title);
        doc.moveDown(0.3);

        doc.fontSize(14).fillColor('#334155').font('Helvetica').text(`${project.companyName} (${project.symbol}) — ${project.exchange}`);
        doc.moveDown(0.8);

        // Metadata grid
        const metaY = doc.y;
        doc.fontSize(9).font('Helvetica-Bold').fillColor('#475569');
        doc.text('Report Status:', 50, metaY);
        doc.font('Helvetica').text(report.status.toUpperCase(), 140, metaY);

        doc.font('Helvetica-Bold').text('Template:', 240, metaY);
        doc.font('Helvetica').text(report.templateId.replace(/_/g, ' '), 300, metaY);

        doc.font('Helvetica-Bold').text('Date:', 420, metaY);
        doc.font('Helvetica').text(new Date(report.createdAt).toLocaleDateString(), 460, metaY);

        doc.moveDown(1.5);
        doc.strokeColor('#e2e8f0').lineWidth(1).moveTo(50, doc.y).lineTo(doc.page.width - 50, doc.y).stroke();
        doc.moveDown(1.2);

        // ─── Render Report Sections ─────────────────────────────────────────
        for (const section of report.sections) {
          // If close to page bottom, advance to next page
          if (doc.y > doc.page.height - 120) {
            doc.addPage();
          }

          // Section Title
          doc.fontSize(13).font('Helvetica-Bold').fillColor('#0369a1').text(section.title);
          doc.moveDown(0.4);

          // Content formatting: strip markdown hashes or format nicely
          const cleanLines = section.content.split('\n');
          for (const line of cleanLines) {
            if (doc.y > doc.page.height - 70) {
              doc.addPage();
            }

            const trimmed = line.trim();
            if (trimmed.startsWith('### ')) {
              doc.moveDown(0.4);
              doc.fontSize(11).font('Helvetica-Bold').fillColor('#1e293b').text(trimmed.replace(/^###\s+/, ''));
              doc.moveDown(0.2);
            } else if (trimmed.startsWith('#### ')) {
              doc.moveDown(0.3);
              doc.fontSize(10).font('Helvetica-Bold').fillColor('#334155').text(trimmed.replace(/^####\s+/, ''));
              doc.moveDown(0.2);
            } else if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
              doc.fontSize(9.5).font('Helvetica').fillColor('#334155').text(`  •  ${trimmed.slice(2)}`, { indent: 10, lineGap: 2 });
            } else if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
              // Table row text representation
              if (!trimmed.includes(':---')) {
                const cells = trimmed
                  .split('|')
                  .map((c) => c.trim().replace(/\*\*/g, ''))
                  .filter(Boolean);
                doc.fontSize(8.5).font('Helvetica-Bold').fillColor('#1e293b').text(cells.join('   |   '), { lineGap: 2 });
              }
            } else if (trimmed) {
              const cleaned = trimmed.replace(/\*\*(.*?)\*\*/g, '$1').replace(/\*(.*?)\*/g, '$1');
              doc.fontSize(9.5).font('Helvetica').fillColor('#334155').text(cleaned, { lineGap: 3 });
            } else {
              doc.moveDown(0.3);
            }
          }

          // Citing Evidence
          if (section.evidenceIds && section.evidenceIds.length > 0) {
            doc.moveDown(0.3);
            doc.fontSize(8).font('Helvetica-Oblique').fillColor('#64748b').text(`Sources Cited: ${section.evidenceIds.join(', ')}`);
          }

          doc.moveDown(1);
          doc.strokeColor('#f1f5f9').lineWidth(0.5).moveTo(50, doc.y).lineTo(doc.page.width - 50, doc.y).stroke();
          doc.moveDown(0.8);
        }

        // ─── User Notes Section if any ──────────────────────────────────────
        if (report.notes && report.notes.length > 0) {
          if (doc.y > doc.page.height - 140) doc.addPage();
          doc.fontSize(13).font('Helvetica-Bold').fillColor('#0369a1').text('Analyst Research Notes');
          doc.moveDown(0.4);

          for (const note of report.notes) {
            if (doc.y > doc.page.height - 60) doc.addPage();
            doc.fontSize(9).font('Helvetica-Bold').fillColor('#0f766e').text(`[${note.tag.toUpperCase()}] ${new Date(note.createdAt).toLocaleDateString()}`);
            doc.fontSize(9.5).font('Helvetica').fillColor('#334155').text(note.content, { lineGap: 2 });
            doc.moveDown(0.5);
          }
        }

        // ─── Evidence & Provenance Register ─────────────────────────────────
        if (report.evidence && report.evidence.length > 0) {
          if (doc.y > doc.page.height - 140) doc.addPage();
          doc.fontSize(13).font('Helvetica-Bold').fillColor('#0369a1').text('Evidence Provenance Register');
          doc.moveDown(0.4);

          for (const ev of report.evidence.slice(0, 15)) {
            if (doc.y > doc.page.height - 50) doc.addPage();
            doc.fontSize(8.5).font('Helvetica-Bold').fillColor('#1e293b').text(`${ev.id}: ${ev.title}`);
            doc.fontSize(8).font('Helvetica').fillColor('#64748b').text(`Provider: ${ev.sourceReference} | Observed: ${ev.observedAt ? new Date(ev.observedAt).toLocaleDateString() : 'N/A'}${ev.reportingPeriod ? ` | Period: ${ev.reportingPeriod}` : ''}`);
            doc.moveDown(0.2);
          }
        }

        // ─── Footers & Page Numbering ───────────────────────────────────────
        const totalPages = doc.bufferedPageRange().count;
        for (let i = 0; i < totalPages; i++) {
          doc.switchToPage(i);
          doc.fontSize(8).font('Helvetica').fillColor('#94a3b8');
          doc.text(
            `EquityLensAI Research Platform • ${project.symbol} • Report v${report.version}`,
            50,
            doc.page.height - 35,
            { align: 'left' },
          );
          doc.text(
            `Page ${i + 1} of ${totalPages}`,
            doc.page.width - 150,
            doc.page.height - 35,
            { align: 'right' },
          );
        }

        doc.end();
      } catch (err) {
        reject(err);
      }
    });
  }

  /**
   * Generates a sanitized CSV of all financial metrics, statements, and peer data.
   * Defends against spreadsheet formula injection (=, +, -, @, \t, \r).
   */
  generateCsv(
    project: ResearchProject,
    report: ResearchReport,
    projectNotes?: ResearchNote[],
  ): string {
    const sanitizeCell = (val: unknown): string => {
      if (val === null || val === undefined) return '';
      const str = String(val).trim();
      // Prefix formula characters with a single quote to prevent execution in Excel/Sheets
      if (/^[=+\-@\t\r]/.test(str)) {
        return `"'${str.replace(/"/g, '""')}"`;
      }
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const rows: string[][] = [
      ['Report Title', report.title],
      ['Company', project.companyName],
      ['Symbol', project.symbol],
      ['Exchange', project.exchange],
      ['Report Status', report.status],
      ['Template', report.templateId],
      ['Created At', report.createdAt],
      ['Last Refreshed', report.lastRefreshedAt || 'N/A'],
      [],
      ['--- EVIDENCE & FINANCIAL METRICS REGISTER ---'],
      ['Evidence ID', 'Type', 'Title', 'Source Provider', 'Period', 'Units', 'Value', 'Observed Date'],
    ];

    if (report.evidence) {
      report.evidence.forEach((ev: ResearchEvidenceItem) => {
        rows.push([
          ev.id,
          ev.evidenceType,
          ev.title,
          ev.sourceReference,
          ev.reportingPeriod || '',
          ev.units || ev.currency || '',
          ev.value !== null && ev.value !== undefined ? String(ev.value) : '',
          ev.observedAt ? new Date(ev.observedAt).toISOString() : '',
        ]);
      });
    }

    rows.push([]);
    rows.push(['--- REPORT SECTIONS ---']);
    rows.push(['Section Position', 'Section Type', 'Section Title', 'Generated By', 'Status', 'Content Excerpt']);

    if (report.sections) {
      report.sections.forEach((sec) => {
        rows.push([
          String(sec.position),
          sec.sectionType,
          sec.title,
          sec.generatedBy,
          sec.status,
          sec.content.replace(/\n/g, ' ').slice(0, 300),
        ]);
      });
    }

    const allNotes = [...(report.notes || []), ...(projectNotes || [])];
    if (allNotes.length > 0) {
      rows.push([]);
      rows.push(['--- ANALYST NOTES ---']);
      rows.push(['Tag', 'Created At', 'Content']);
      allNotes.forEach((note) => {
        rows.push([note.tag, note.createdAt, note.content]);
      });
    }

    return rows.map((row) => row.map(sanitizeCell).join(',')).join('\n');
  }
}

export const exportService = new ExportService();
