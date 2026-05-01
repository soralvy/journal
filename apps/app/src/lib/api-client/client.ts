import { authAdditionalFields } from '@repo/auth-contracts';
import {
  inferAdditionalFields,
  magicLinkClient,
} from 'better-auth/client/plugins';
import { createAuthClient } from 'better-auth/react';
import type { z } from 'zod';

import {
  AppDataParseError,
  AppNetworkError,
  AppValidationError,
} from '../errors';

const DEFAULT_ERROR_MESSAGE = 'An unexpected error occurred';
const DEFAULT_BASE_URL = 'http://localhost:3000';

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
};

const isStringRecord = (value: unknown): value is Record<string, string> => {
  return (
    isRecord(value) &&
    Object.values(value).every((item) => typeof item === 'string')
  );
};

const parseJsonSafely = async (response: Response): Promise<unknown> => {
  try {
    return (await response.json()) as unknown;
  } catch {
    return {};
  }
};

const getErrorMessage = (data: unknown) => {
  if (!isRecord(data)) {
    return DEFAULT_ERROR_MESSAGE;
  }

  const message = data['message'];

  return typeof message === 'string' && message !== ''
    ? message
    : DEFAULT_ERROR_MESSAGE;
};

const devServerBaseUrl: unknown = import.meta.env['VITE_DEV_SERVER_BASE_URL'];
const baseURL =
  typeof devServerBaseUrl === 'string' && devServerBaseUrl !== ''
    ? devServerBaseUrl
    : DEFAULT_BASE_URL;

export const authClient = createAuthClient({
  baseURL,
  plugins: [
    magicLinkClient(),
    inferAdditionalFields({ user: authAdditionalFields }),
  ],
});

export const apiClient = async <T>(
  endpoint: string,
  config: RequestInit = {},
  schema?: z.ZodType<T>,
): Promise<T> => {
  const headers = new Headers(config.headers);

  if (!headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const requestConfig: RequestInit = {
    ...config,
    credentials: 'include',
    headers,
  };

  try {
    const fetchResponse = await fetch(endpoint, requestConfig);

    if (!fetchResponse.ok) {
      if (fetchResponse.status === 401) {
        throw new AppNetworkError('Session expired', 401);
      }

      const data = await parseJsonSafely(fetchResponse);

      if (
        fetchResponse.status === 400 &&
        isRecord(data) &&
        isStringRecord(data['fieldErrors'])
      ) {
        throw new AppValidationError(data['fieldErrors']);
      }

      throw new AppNetworkError(getErrorMessage(data), fetchResponse.status);
    }

    const rawData = await parseJsonSafely(fetchResponse);

    if (schema) {
      const parsed = schema.safeParse(rawData);

      if (!parsed.success) {
        // Tracked: report API response schema mismatches to observability.
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
