import { Router } from 'express';
import { validate } from '../middleware/validate.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import {
  createPortfolioSchema,
  updatePortfolioSchema,
  createTransactionSchema,
  updateTransactionSchema,
  previewImportSchema,
  confirmImportSchema,
} from '../validation/portfolioSchemas.js';
import {
  listPortfolios,
  createPortfolio,
  getPortfolio,
  updatePortfolio,
  deletePortfolio,
  listTransactions,
  createTransaction,
  getTransaction,
  updateTransaction,
  deleteTransaction,
  getHoldings,
  getSummary,
  getAllocation,
  getPerformance,
  exportTransactions,
  previewImport,
  confirmImport,
} from '../controllers/portfolioController.js';

export const portfolioRouter = Router();

// All portfolio endpoints strictly require authentication
portfolioRouter.use(asyncHandler(requireAuth));

// Portfolio Management
portfolioRouter.get('/', asyncHandler(listPortfolios));
portfolioRouter.post('/', validate({ body: createPortfolioSchema }), asyncHandler(createPortfolio));
portfolioRouter.get('/:portfolioId', asyncHandler(getPortfolio));
portfolioRouter.patch('/:portfolioId', validate({ body: updatePortfolioSchema }), asyncHandler(updatePortfolio));
portfolioRouter.delete('/:portfolioId', asyncHandler(deletePortfolio));

// Holdings, Valuation & Performance
portfolioRouter.get('/:portfolioId/holdings', asyncHandler(getHoldings));
portfolioRouter.get('/:portfolioId/summary', asyncHandler(getSummary));
portfolioRouter.get('/:portfolioId/allocation', asyncHandler(getAllocation));
portfolioRouter.get('/:portfolioId/performance', asyncHandler(getPerformance));

// Transactions
portfolioRouter.get('/:portfolioId/transactions', asyncHandler(listTransactions));
portfolioRouter.post(
  '/:portfolioId/transactions',
  validate({ body: createTransactionSchema }),
  asyncHandler(createTransaction),
);
portfolioRouter.get('/:portfolioId/transactions/export', asyncHandler(exportTransactions));
portfolioRouter.get('/:portfolioId/transactions/:transactionId', asyncHandler(getTransaction));
portfolioRouter.patch(
  '/:portfolioId/transactions/:transactionId',
  validate({ body: updateTransactionSchema }),
  asyncHandler(updateTransaction),
);
portfolioRouter.delete('/:portfolioId/transactions/:transactionId', asyncHandler(deleteTransaction));

// CSV Import
portfolioRouter.post(
  '/:portfolioId/import/preview',
  validate({ body: previewImportSchema }),
  asyncHandler(previewImport),
);
portfolioRouter.post(
  '/:portfolioId/import/confirm',
  validate({ body: confirmImportSchema }),
  asyncHandler(confirmImport),
);
