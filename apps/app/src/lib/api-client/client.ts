import type { ZodSchema } from 'zod';
import {
  AppDataParseError,
  AppNetworkError,
  AppValidationError,
} from '../errors';

const DEFAULT_ERROR_MESSAGE = 'An unexpected error occurred';

export const apiClient = async <T>(
  endpoint: string,
  config: RequestInit = {},
  schema?: ZodSchema<T>,
): Promise<T> => {
  const mergedConfig = {
    ...config,
    headers: {
      'Content-Type': 'application/json',
      ...config?.headers,
    },
  };

  try {
    const fetchResponse = await fetch(endpoint, mergedConfig);

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
    throw new AppNetworkError('Network request failed entirely');
  }
};
