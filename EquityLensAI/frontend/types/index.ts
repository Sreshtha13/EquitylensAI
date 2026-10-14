export type {
  ApiError,
  ApiResponse,
  ApiSuccess,
  AssetType,
  Market,
  Pagination,
} from '@equitylensai/shared';

export type HealthStatus = {
  status: 'ok';
  service: string;
  timestamp: string;
};
