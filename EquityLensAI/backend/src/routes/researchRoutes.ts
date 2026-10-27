import { Router } from 'express';
import { validate } from '../middleware/validate.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import {
  createProjectSchema,
  updateProjectSchema,
  createReportSchema,
  updateReportSchema,
  generateSectionSchema,
  createNoteSchema,
  updateNoteSchema,
  refreshReportSchema,
} from '../validation/researchSchemas.js';
import {
  listTemplates,
  listProjects,
  getProject,
  createProject,
  updateProject,
  deleteProject,
  listReports,
  getReport,
  createReport,
  updateReport,
  deleteReport,
  generateSection,
  refreshReport,
  listReportVersions,
  listNotes,
  createNote,
  updateNote,
  deleteNote,
  exportPdf,
  exportCsv,
} from '../controllers/researchController.js';

export const researchRouter = Router();

// Templates can be read by authenticated users
researchRouter.get('/templates', asyncHandler(requireAuth), asyncHandler(listTemplates));

// All research endpoints strictly require user authentication
researchRouter.use(asyncHandler(requireAuth));

// Research Projects
researchRouter.get('/', asyncHandler(listProjects));
researchRouter.post('/', validate({ body: createProjectSchema }), asyncHandler(createProject));
researchRouter.get('/:researchId', asyncHandler(getProject));
researchRouter.patch(
  '/:researchId',
  validate({ body: updateProjectSchema }),
  asyncHandler(updateProject),
);
researchRouter.delete('/:researchId', asyncHandler(deleteProject));

// Research Notes
researchRouter.get('/:researchId/notes', asyncHandler(listNotes));
researchRouter.post(
  '/:researchId/notes',
  validate({ body: createNoteSchema }),
  asyncHandler(createNote),
);
researchRouter.patch(
  '/:researchId/notes/:noteId',
  validate({ body: updateNoteSchema }),
  asyncHandler(updateNote),
);
researchRouter.delete('/:researchId/notes/:noteId', asyncHandler(deleteNote));

// Research Reports
researchRouter.get('/:researchId/reports', asyncHandler(listReports));
researchRouter.post(
  '/:researchId/reports',
  validate({ body: createReportSchema }),
  asyncHandler(createReport),
);
researchRouter.get('/:researchId/reports/:reportId', asyncHandler(getReport));
researchRouter.patch(
  '/:researchId/reports/:reportId',
  validate({ body: updateReportSchema }),
  asyncHandler(updateReport),
);
researchRouter.delete('/:researchId/reports/:reportId', asyncHandler(deleteReport));

// Generation, Refresh & Versioning
researchRouter.post(
  '/:researchId/reports/:reportId/generate-section',
  validate({ body: generateSectionSchema }),
  asyncHandler(generateSection),
);
researchRouter.post(
  '/:researchId/reports/:reportId/refresh',
  validate({ body: refreshReportSchema }),
  asyncHandler(refreshReport),
);
researchRouter.get('/:researchId/reports/:reportId/versions', asyncHandler(listReportVersions));

// Exportable Analysis
researchRouter.get('/:researchId/reports/:reportId/export/pdf', asyncHandler(exportPdf));
researchRouter.get('/:researchId/reports/:reportId/export/csv', asyncHandler(exportCsv));
