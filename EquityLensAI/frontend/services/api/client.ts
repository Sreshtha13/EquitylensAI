import { getFrontendEnv } from '@/lib/env';
import type { ApiError, ApiSuccess } from '@/types';

export class ApiClientError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(message: string, status: number, code: string, details?: unknown) {
    super(message);
    this.name = 'ApiClientError';
    this.status = status;
    this.code = code;
    if (details !== undefined) {
      this.details = details;
    }
  }
}

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

type RequestOptions = {
  body?: unknown;
  headers?: Record<string, string>;
  signal?: AbortSignal;
};

async function request<T>(
  method: HttpMethod,
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const { NEXT_PUBLIC_API_URL } = getFrontendEnv();
  const url = `${NEXT_PUBLIC_API_URL.replace(/\/$/, '')}${path}`;

  const headers: Record<string, string> = {
    Accept: 'application/json',
    ...options.headers,
  };

  const init: RequestInit = {
    method,
    headers,
  };

  if (options.signal) {
    init.signal = options.signal;
  }

  if (options.body !== undefined) {
    headers['Content-Type'] = 'application/json';
    init.body = JSON.stringify(options.body);
  }

  let response: Response;

  try {
    response = await fetch(url, init);
  } catch (error) {
    throw new ApiClientError('Unable to reach the EquityLensAI API', 0, 'NETWORK_ERROR', error);
  }

  const raw: unknown = await response.json().catch(() => undefined);

  if (!response.ok) {
    const payload = isApiError(raw) ? raw : undefined;
    throw new ApiClientError(
      payload?.error.message ?? `Request failed with status ${response.status}`,
      response.status,
      payload?.error.code ?? 'HTTP_ERROR',
      payload?.error.details,
    );
  }

  if (!isApiSuccess<T>(raw)) {
    throw new ApiClientError('Unexpected API response shape', response.status, 'INVALID_RESPONSE');
  }

  return raw.data;
}

function isApiSuccess<T>(value: unknown): value is ApiSuccess<T> {
  return (
    typeof value === 'object' &&
    value !== null &&
    'success' in value &&
    value.success === true &&
    'data' in value
  );
}

function isApiError(value: unknown): value is ApiError {
  return (
    typeof value === 'object' &&
    value !== null &&
    'success' in value &&
    value.success === false &&
    'error' in value &&
    typeof value.error === 'object' &&
    value.error !== null
  );
}

export const apiClient = {
  get: <T>(path: string, options?: Omit<RequestOptions, 'body'>) =>
    request<T>('GET', path, options),
  post: <T>(path: string, body?: unknown, options?: Omit<RequestOptions, 'body'>) =>
    request<T>('POST', path, { ...options, body }),
  put: <T>(path: string, body?: unknown, options?: Omit<RequestOptions, 'body'>) =>
    request<T>('PUT', path, { ...options, body }),
  patch: <T>(path: string, body?: unknown, options?: Omit<RequestOptions, 'body'>) =>
    request<T>('PATCH', path, { ...options, body }),
  delete: <T>(path: string, options?: Omit<RequestOptions, 'body'>) =>
    request<T>('DELETE', path, options),
};
