import { z } from 'zod';
import {
  RESEARCH_PROJECT_STATUSES,
  RESEARCH_REPORT_STATUSES,
  REPORT_TEMPLATE_IDS,
  REPORT_SECTION_TYPES,
  NOTE_TAGS,
} from '@equitylensai/shared';

export const createProjectSchema = z
  .object({
    title: z.string().trim().min(1, 'Title is required').max(150, 'Title exceeds 150 characters'),
    description: z.string().trim().max(1000, 'Description exceeds 1000 characters').nullable().optional(),
    symbol: z
      .string()
      .trim()
      .min(1, 'Symbol is required')
      .max(30, 'Symbol exceeds 30 characters')
      .regex(/^[A-Za-z0-9._-]+$/, 'Symbol contains invalid characters'),
    exchange: z
      .string()
      .trim()
      .min(1)
      .max(10)
      .regex(/^[A-Za-z0-9_-]+$/)
      .optional()
      .default('NSE'),
    companyName: z.string().trim().min(1).max(150).optional(),
    templateId: z.string().trim().optional(),
  })
  .strict();

export const updateProjectSchema = z
  .object({
    title: z.string().trim().min(1).max(150).optional(),
    description: z.string().trim().max(1000).nullable().optional(),
    status: z.enum(RESEARCH_PROJECT_STATUSES).optional(),
  })
  .strict();

export const reportSectionSchema = z
  .object({
    id: z.string().min(1),
    sectionType: z.enum(REPORT_SECTION_TYPES),
    title: z.string().min(1).max(200),
    content: z.string(),
    structuredData: z.record(z.unknown()).optional(),
    position: z.number().int().min(0),
    status: z.enum(['draft', 'reviewed', 'final']).default('draft'),
    generatedBy: z.enum(['system', 'ai', 'user']).default('system'),
    evidenceIds: z.array(z.string()).default([]),
    updatedAt: z.string().datetime().optional(),
  })
  .strict();

export const createReportSchema = z
  .object({
    title: z.string().trim().min(1, 'Report title is required').max(200),
    templateId: z.string().trim().min(1, 'Template ID is required'),
    selectedSections: z.array(z.enum(REPORT_SECTION_TYPES)).optional(),
    reportingScope: z.enum(['consolidated', 'standalone']).optional().default('consolidated'),
    periods: z.number().int().min(1).max(10).optional().default(4),
    includePeers: z.boolean().optional().default(true),
    includeNews: z.boolean().optional().default(true),
    researchQuestion: z.string().trim().max(800).optional(),
  })
  .strict();

export const updateReportSchema = z
  .object({
    title: z.string().trim().min(1).max(200).optional(),
    status: z.enum(RESEARCH_REPORT_STATUSES).optional(),
    sections: z.array(reportSectionSchema).optional(),
    version: z.number().int().min(1).optional(),
    createSnapshot: z.boolean().optional().default(false),
    snapshotNotes: z.string().trim().max(500).optional(),
  })
  .strict();

export const generateSectionSchema = z
  .object({
    sectionId: z.string().optional(),
    sectionType: z.enum(REPORT_SECTION_TYPES),
    researchQuestion: z.string().trim().max(800).optional(),
    preserveUserNotes: z.boolean().optional().default(true),
  })
  .strict();

export const createNoteSchema = z
  .object({
    reportId: z.string().uuid().nullable().optional(),
    sectionId: z.string().nullable().optional(),
    tag: z.enum(NOTE_TAGS).optional().default('observation'),
    content: z.string().trim().min(1, 'Note content cannot be empty').max(5000),
  })
  .strict();

export const updateNoteSchema = z
  .object({
    tag: z.enum(NOTE_TAGS).optional(),
    content: z.string().trim().min(1, 'Note content cannot be empty').max(5000).optional(),
  })
  .strict();

export const refreshReportSchema = z
  .object({
    saveNewVersion: z.boolean().optional().default(false),
    versionNotes: z.string().trim().max(500).optional(),
  })
  .strict();
