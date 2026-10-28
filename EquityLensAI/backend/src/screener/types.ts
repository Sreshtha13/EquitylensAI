import type {
  ScreenerStrategyDefinition,
} from '@equitylensai/shared';

export interface SavedScreenDbRow {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  definition: ScreenerStrategyDefinition;
  last_run_at: string | null;
  last_result_count: number | null;
  created_at: string;
  updated_at: string;
}

export interface ScreenerRunDbRow {
  id: string;
  user_id: string;
  saved_screen_id: string | null;
  definition: ScreenerStrategyDefinition;
  result_count: number;
  duration_ms: number;
  coverage: {
    indexedCompanies: number;
    staleIndexedCompanies: number;
    expectedCompanies: number;
    refreshCompleted: boolean;
    refreshedAt: string | null;
    isPartial: boolean;
  };
  warnings: string[];
  executed_at: string;
}

export type CreateSavedScreenInput = {
  name: string;
  description?: string | null;
  definition: ScreenerStrategyDefinition;
};

export type UpdateSavedScreenInput = {
  name?: string;
  description?: string | null;
  definition?: ScreenerStrategyDefinition;
};
