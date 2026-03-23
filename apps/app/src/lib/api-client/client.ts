import type { ZodSchema } from 'zod';
import {
  AppDataParseError,
  AppNetworkError,
  AppValidationError,
} from '../errors';

const DEFAULT_ERROR_MESSAGE = 'An unexpected error occurred';

let isRefreshing = false;
let failedQueue: Array<{
  resolve: () => void;
  reject: (error: Error) => void;
}> = [];

const processQueue = (error: Error | null = null) => {
  failedQueue.forEach((promise) => {
    if (error) {
      promise.reject(error);
    } else {
      promise.resolve();
    }
  });

  failedQueue = [];
};

interface ApiClientConfig extends RequestInit {
  _retry?: boolean;
}

export const apiClient = async <T>(
  endpoint: string,
  config: ApiClientConfig = {},
  schema?: ZodSchema<T>,
): Promise<T> => {
  const requestConfig: ApiClientConfig = {
    ...config,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...config?.headers,
    },
  };

  try {
    const fetchResponse = await fetch(endpoint, requestConfig);

    if (
      fetchResponse.status === 401 &&
      endpoint !== '/api/auth/refresh' &&
      !requestConfig?._retry
    ) {
      if (isRefreshing) {
        return new Promise<void>((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then(() => {
            return apiClient<T>(
              endpoint,
              { ...requestConfig, _retry: true },
              schema,
            );
          })
          .catch((err) => {
            throw err;
          });
      }

      isRefreshing = true;

      try {
        const refreshTokenResponse = await fetch('/api/auth/refresh', {
          method: 'POST',
          credentials: 'include',
        });

        if (!refreshTokenResponse.ok) {
          throw new Error('Refresh token expired or invalid');
        }

        processQueue();

        return await apiClient<T>(
          endpoint,
          { ...requestConfig, _retry: true },
          schema,
        );
      } catch (refreshError) {
        processQueue(refreshError as Error);

        throw refreshError;
      } finally {
      }
    }

    if (!fetchResponse.ok) {
      const data = await fetchResponse.json().catch(() => {});

      if (fetchResponse.status === 400 && data?.fieldErrors) {
        throw new AppValidationError(data.fieldErrors);
      }

      throw new AppNetworkError(
        data?.message || DEFAULT_ERROR_MESSAGE,
        fetchResponse.status,
      );
    }

    const rawData = await fetchResponse.json();

    if (schema) {
      const parsed = schema.safeParse(rawData);

      if (!parsed.success) {
        // TODO: send to sentry
        console.error('API Response Schema Mismatch:', parsed.error.issues);
        throw new AppDataParseError(parsed.error.issues);
      }

      return parsed.data;
    }

    return rawData as T;
  } catch (error) {
    if (
      error instanceof AppValidationError ||
      error instanceof AppNetworkError ||
      error instanceof AppDataParseError
    ) {
      throw error;
    }

    throw new AppNetworkError('Network request failed entirely', undefined, {
      cause: error,
    });
  }
};
