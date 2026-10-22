import type { NewsProvider, AnnouncementsProvider } from './types.js';
import type { ProviderHealthInfo } from '@equitylensai/shared';
import { NseAnnouncementsProvider } from './nseAnnouncementsProvider.js';
import { GoogleNewsProvider } from './googleNewsProvider.js';
import { BseAnnouncementsProvider } from './bseAnnouncementsProvider.js';

export class ProviderRegistry {
  private newsProviders: Map<string, NewsProvider> = new Map();
  private announcementsProviders: Map<string, AnnouncementsProvider> = new Map();

  constructor() {
    this.registerNewsProvider(new GoogleNewsProvider());
    this.registerAnnouncementsProvider(new NseAnnouncementsProvider());
    this.registerAnnouncementsProvider(new BseAnnouncementsProvider());
  }

  registerNewsProvider(provider: NewsProvider): void {
    this.newsProviders.set(provider.id, provider);
  }

  registerAnnouncementsProvider(provider: AnnouncementsProvider): void {
    this.announcementsProviders.set(provider.id, provider);
  }

  getNewsProvider(id: string): NewsProvider | undefined {
    return this.newsProviders.get(id);
  }

  getAnnouncementsProvider(id: string): AnnouncementsProvider | undefined {
    return this.announcementsProviders.get(id);
  }

  getAllNewsProviders(): NewsProvider[] {
    return Array.from(this.newsProviders.values());
  }

  getAllAnnouncementsProviders(): AnnouncementsProvider[] {
    return Array.from(this.announcementsProviders.values());
  }

  async getAllProvidersHealth(): Promise<ProviderHealthInfo[]> {
    const healthPromises: Promise<ProviderHealthInfo>[] = [];
    for (const p of this.newsProviders.values()) {
      healthPromises.push(p.getHealth());
    }
    for (const p of this.announcementsProviders.values()) {
      healthPromises.push(p.getHealth());
    }
    return Promise.all(healthPromises);
  }
}

export const providerRegistry = new ProviderRegistry();
