import { apiClient } from './client';
import type {
  NewsFeedResponse,
  AnnouncementsFeedResponse,
  WatchlistNewsResponse,
  CorporateAnnouncement,
  NewsItem,
  GroundedAiSummary,
  NewsIngestionStatus,
  AnnouncementCategory,
} from '@/types';

export async function getMarketNews(
  options: {
    category?: string | undefined;
    limit?: number | undefined;
    page?: number | undefined;
  } = {},
): Promise<NewsFeedResponse> {
  const params = new URLSearchParams();
  if (options.category) params.set('category', options.category);
  if (options.limit) params.set('limit', String(options.limit));
  if (options.page) params.set('page', String(options.page));
  const qStr = params.toString() ? `?${params.toString()}` : '';

  return apiClient.get<NewsFeedResponse>(`/api/v1/news${qStr}`);
}

export async function getStockNews(
  symbol: string,
  exchange?: string | undefined,
  options: { limit?: number | undefined; page?: number | undefined } = {},
): Promise<NewsFeedResponse> {
  const params = new URLSearchParams();
  if (exchange) params.set('exchange', exchange);
  if (options.limit) params.set('limit', String(options.limit));
  if (options.page) params.set('page', String(options.page));
  const qStr = params.toString() ? `?${params.toString()}` : '';

  return apiClient.get<NewsFeedResponse>(
    `/api/v1/stocks/${encodeURIComponent(symbol)}/news${qStr}`,
  );
}

export async function getAnnouncements(
  options: {
    category?: AnnouncementCategory | undefined;
    exchange?: string | undefined;
    limit?: number | undefined;
    page?: number | undefined;
  } = {},
): Promise<AnnouncementsFeedResponse> {
  const params = new URLSearchParams();
  if (options.category) params.set('category', options.category);
  if (options.exchange) params.set('exchange', options.exchange);
  if (options.limit) params.set('limit', String(options.limit));
  if (options.page) params.set('page', String(options.page));
  const qStr = params.toString() ? `?${params.toString()}` : '';

  return apiClient.get<AnnouncementsFeedResponse>(`/api/v1/announcements${qStr}`);
}

export async function getStockAnnouncements(
  symbol: string,
  exchange?: string | undefined,
  options: {
    category?: AnnouncementCategory | undefined;
    limit?: number | undefined;
    page?: number | undefined;
  } = {},
): Promise<AnnouncementsFeedResponse> {
  const params = new URLSearchParams();
  if (exchange) params.set('exchange', exchange);
  if (options.category) params.set('category', options.category);
  if (options.limit) params.set('limit', String(options.limit));
  if (options.page) params.set('page', String(options.page));
  const qStr = params.toString() ? `?${params.toString()}` : '';

  return apiClient.get<AnnouncementsFeedResponse>(
    `/api/v1/stocks/${encodeURIComponent(symbol)}/announcements${qStr}`,
  );
}

export async function getAnnouncementDetail(
  announcementId: string,
): Promise<CorporateAnnouncement> {
  return apiClient.get<CorporateAnnouncement>(
    `/api/v1/announcements/${encodeURIComponent(announcementId)}`,
  );
}

export async function getNewsDetail(newsId: string): Promise<NewsItem> {
  return apiClient.get<NewsItem>(`/api/v1/news/${encodeURIComponent(newsId)}`);
}

export async function getWatchlistNews(
  options: {
    limit?: number | undefined;
    page?: number | undefined;
  } = {},
): Promise<WatchlistNewsResponse> {
  const params = new URLSearchParams();
  if (options.limit) params.set('limit', String(options.limit));
  if (options.page) params.set('page', String(options.page));
  const qStr = params.toString() ? `?${params.toString()}` : '';

  return apiClient.get<WatchlistNewsResponse>(`/api/v1/users/me/watchlist-news${qStr}`);
}

export async function summarizeNews(newsId: string): Promise<GroundedAiSummary> {
  return apiClient.get<GroundedAiSummary>(`/api/v1/news/${encodeURIComponent(newsId)}/summarize`);
}

export async function summarizeAnnouncement(announcementId: string): Promise<GroundedAiSummary> {
  return apiClient.get<GroundedAiSummary>(
    `/api/v1/announcements/${encodeURIComponent(announcementId)}/summarize`,
  );
}

export async function getNewsStatus(): Promise<NewsIngestionStatus> {
  return apiClient.get<NewsIngestionStatus>('/api/v1/news/status');
}
