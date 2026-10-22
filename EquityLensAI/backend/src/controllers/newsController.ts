import type { Request, Response } from 'express';
import { newsService } from '../news/services/newsService.js';
import { ingestionManager } from '../news/jobs/ingestionJob.js';
import { sendSuccess } from '../utils/response.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { AppError } from '../utils/appError.js';
import type { AnnouncementCategory } from '@equitylensai/shared';

export const getMarketNews = asyncHandler(async (req: Request, res: Response) => {
  const query = req.query as Record<string, string | undefined>;
  const result = await newsService.getMarketNews({
    category: query.category,
    sourceType: query.sourceType as
      'official_exchange' | 'news_publisher' | 'investor_relations' | undefined,
    from: query.from,
    to: query.to,
    limit: query.limit ? Number(query.limit) : undefined,
    page: query.page ? Number(query.page) : undefined,
  });
  sendSuccess(res, result);
});

export const getStockNews = asyncHandler(async (req: Request, res: Response) => {
  const symbol = req.params.symbol!;
  const query = req.query as Record<string, string | undefined>;

  const result = await newsService.getStockNews(symbol, query.exchange, {
    limit: query.limit ? Number(query.limit) : undefined,
    page: query.page ? Number(query.page) : undefined,
  });
  sendSuccess(res, result);
});

export const getAnnouncements = asyncHandler(async (req: Request, res: Response) => {
  const query = req.query as Record<string, string | undefined>;
  const result = await newsService.getAnnouncements({
    symbol: query.symbol,
    exchange: query.exchange,
    category: query.category as AnnouncementCategory | undefined,
    from: query.from,
    to: query.to,
    limit: query.limit ? Number(query.limit) : undefined,
    page: query.page ? Number(query.page) : undefined,
  });
  sendSuccess(res, result);
});

export const getStockAnnouncements = asyncHandler(async (req: Request, res: Response) => {
  const symbol = req.params.symbol!;
  const query = req.query as Record<string, string | undefined>;

  const result = await newsService.getStockAnnouncements(symbol, query.exchange, {
    category: query.category as AnnouncementCategory | undefined,
    from: query.from,
    to: query.to,
    limit: query.limit ? Number(query.limit) : undefined,
    page: query.page ? Number(query.page) : undefined,
  });
  sendSuccess(res, result);
});

export const getAnnouncementDetail = asyncHandler(async (req: Request, res: Response) => {
  const announcementId = req.params.announcementId!;
  const result = await newsService.getAnnouncementById(announcementId);
  sendSuccess(res, result);
});

export const getNewsDetail = asyncHandler(async (req: Request, res: Response) => {
  const newsId = req.params.newsId!;
  const result = await newsService.getNewsById(newsId);
  sendSuccess(res, result);
});

export const getWatchlistNews = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?.id;
  if (!userId) {
    throw new AppError('UNAUTHORIZED', 'Authentication required to access watchlist news', 401);
  }

  const query = req.query as Record<string, string | undefined>;
  const result = await newsService.getWatchlistNews(userId, {
    limit: query.limit ? Number(query.limit) : undefined,
    page: query.page ? Number(query.page) : undefined,
  });
  sendSuccess(res, result);
});

export const summarizeNews = asyncHandler(async (req: Request, res: Response) => {
  const newsId = req.params.newsId!;
  const result = await newsService.summarizeNewsItem(newsId);
  sendSuccess(res, result);
});

export const summarizeAnnouncement = asyncHandler(async (req: Request, res: Response) => {
  const announcementId = req.params.announcementId!;
  const result = await newsService.summarizeAnnouncement(announcementId);
  sendSuccess(res, result);
});

export const triggerNewsIngestion = asyncHandler(async (_req: Request, res: Response) => {
  const result = await ingestionManager.runIngestion();
  sendSuccess(res, result);
});

export const getNewsIngestStatus = asyncHandler(async (_req: Request, res: Response) => {
  const result = await ingestionManager.getStatus();
  sendSuccess(res, result);
});
