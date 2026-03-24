import type { ZodSchema } from 'zod';
import {
  AppDataParseError,
  AppNetworkError,
  AppValidationError,
} from '../errors';
import { createAuthClient } from 'better-auth/react';
import {
  inferAdditionalFields,
  magicLinkClient,
} from 'better-auth/client/plugins';
import type { Auth } from '../../../../api/src/app/auth/auth.configuration';
const DEFAULT_ERROR_MESSAGE = 'An unexpected error occurred';

export const authClient = createAuthClient({
  baseURL:
    import.meta.env['VITE_DEV_SERVER_BASE_URL'] || 'http://localhost:3000',
  plugins: [magicLinkClient(), inferAdditionalFields<Auth>()],
});

export const apiClient = async <T>(
  endpoint: string,
  config: RequestInit = {},
  schema?: ZodSchema<T>,
): Promise<T> => {
  const requestConfig: RequestInit = {
    ...config,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...config?.headers,
    },
  };

  try {
    const fetchResponse = await fetch(endpoint, requestConfig);

    if (!fetchResponse.ok) {
      if (fetchResponse.status === 401) {
        throw new AppNetworkError('Session expired', 401);
      }

      const data = await fetchResponse.json().catch(() => ({}));

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
