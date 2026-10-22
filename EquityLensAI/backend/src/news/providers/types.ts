import type { ProviderHealthInfo, SourceType, AnnouncementCategory } from '@equitylensai/shared';

export type RawNewsItem = {
  providerId: string;
  externalId?: string | null | undefined;
  title: string;
  canonicalUrl: string;
  sourceName: string;
  sourceType: SourceType;
  publishedAt: string | null;
  retrievedAt: string;
  language?: string | null | undefined;
  contentExcerpt?: string | null | undefined;
  category?: string | null | undefined;
  rawSymbols?: string[] | undefined;
  rawIsins?: string[] | undefined;
  rawCompanyName?: string | undefined;
};

export type RawAnnouncementItem = {
  providerId: string;
  externalId?: string | null | undefined;
  symbol: string;
  companyName: string;
  exchange: string;
  isin?: string | null | undefined;
  title: string;
  category: AnnouncementCategory;
  description: string | null;
  publishedAt: string;
  receivedAt?: string | null | undefined;
  sourceUrl: string;
  documentUrl?: string | null | undefined;
  fileSize?: string | null | undefined;
  retrievedAt: string;
};

export type NewsQueryOptions = {
  symbol?: string | undefined;
  exchange?: string | undefined;
  query?: string | undefined;
  category?: string | undefined;
  limit?: number | undefined;
};

export type AnnouncementQueryOptions = {
  symbol?: string | undefined;
  exchange?: string | undefined;
  category?: AnnouncementCategory | undefined;
  from?: string | undefined;
  to?: string | undefined;
  limit?: number | undefined;
};

export interface NewsProvider {
  readonly id: string;
  readonly name: string;
  isConfigured(): boolean;
  getHealth(): Promise<ProviderHealthInfo>;
  fetchNews(options?: NewsQueryOptions): Promise<RawNewsItem[]>;
}

export interface AnnouncementsProvider {
  readonly id: string;
  readonly name: string;
  isConfigured(): boolean;
  getHealth(): Promise<ProviderHealthInfo>;
  fetchAnnouncements(options?: AnnouncementQueryOptions): Promise<RawAnnouncementItem[]>;
}
