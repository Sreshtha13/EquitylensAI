import type {
  ResearchProjectStatus,
  ResearchReportStatus,
  ResearchReportSection,
  ResearchEvidenceItem,
  ResearchNote,
  NoteTag,
} from '@equitylensai/shared';

export interface ResearchProjectRow {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  symbol: string;
  exchange: string;
  company_name: string;
  status: string;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
}

export interface ResearchReportRow {
  id: string;
  research_project_id: string;
  user_id: string;
  title: string;
  template_id: string;
  status: string;
  schema_version: number;
  version: number;
  sections: ResearchReportSection[];
  evidence: ResearchEvidenceItem[];
  notes: ResearchNote[];
  generated_at: string | null;
  last_refreshed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ResearchReportVersionRow {
  id: string;
  report_id: string;
  version_number: number;
  content_snapshot: {
    title: string;
    templateId: string;
    sections: ResearchReportSection[];
    evidence: ResearchEvidenceItem[];
    notes: ResearchNote[];
  };
  summary_notes: string | null;
  created_at: string;
  created_by: string;
}

export interface ResearchNoteRow {
  id: string;
  research_project_id: string;
  report_id: string | null;
  section_id: string | null;
  user_id: string;
  tag: string;
  content: string;
  created_at: string;
  updated_at: string;
}

export interface CreateProjectInput {
  title: string;
  description?: string | null;
  symbol: string;
  exchange?: string;
  companyName?: string;
  status?: ResearchProjectStatus;
  templateId?: string;
}

export interface UpdateProjectInput {
  title?: string;
  description?: string | null;
  status?: ResearchProjectStatus;
}

export interface CreateReportInput {
  title: string;
  templateId: string;
  sections?: ResearchReportSection[];
  evidence?: ResearchEvidenceItem[];
  notes?: ResearchNote[];
  periods?: number;
  includePeers?: boolean;
  includeNews?: boolean;
  researchQuestion?: string;
}

export interface UpdateReportInput {
  title?: string;
  status?: ResearchReportStatus;
  sections?: ResearchReportSection[];
  evidence?: ResearchEvidenceItem[];
  notes?: ResearchNote[];
  version?: number;
  createSnapshot?: boolean;
  snapshotNotes?: string;
}

export interface CreateNoteInput {
  reportId?: string | null;
  sectionId?: string | null;
  tag?: NoteTag;
  content: string;
}

export interface UpdateNoteInput {
  tag?: NoteTag;
  content?: string;
}
