export type ApiSuccess<T> = {
  success: true;
  data: T;
};

export type ApiError = {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
    requestId?: string;
    retryable?: boolean;
  };
};

export type ApiResponse<T> = ApiSuccess<T> | ApiError;
