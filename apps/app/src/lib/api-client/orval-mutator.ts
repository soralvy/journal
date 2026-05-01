import { AppNetworkError, AppValidationError } from '../errors';

const DEFAULT_ERROR_MESSAGE = 'An unexpected error occurred';
const DEFAULT_BASE_URL = 'http://localhost:3000';

interface SerializedBody {
  body?: BodyInit;
  shouldSetJsonContentType: boolean;
}

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
};

const isStringRecord = (value: unknown): value is Record<string, string> => {
  return (
    isRecord(value) &&
    Object.values(value).every((item) => typeof item === 'string')
  );
};

const isBodyInit = (value: unknown): value is BodyInit => {
  return (
    typeof value === 'string' ||
    value instanceof Blob ||
    value instanceof ArrayBuffer ||
    value instanceof FormData ||
    value instanceof URLSearchParams ||
    (typeof ReadableStream !== 'undefined' && value instanceof ReadableStream)
  );
};

const getBaseUrl = () => {
  const apiBaseUrl: unknown = import.meta.env['VITE_API_BASE_URL'];
  const devServerBaseUrl: unknown = import.meta.env['VITE_DEV_SERVER_BASE_URL'];

  if (typeof apiBaseUrl === 'string' && apiBaseUrl !== '') {
    return apiBaseUrl;
  }

  if (typeof devServerBaseUrl === 'string' && devServerBaseUrl !== '') {
    return devServerBaseUrl;
  }

  return DEFAULT_BASE_URL;
};

const createUrl = (url: string) => {
  return new URL(url, getBaseUrl()).toString();
};

const serializeBody = (body: unknown): SerializedBody => {
  if (body === undefined || body === null) {
    return { shouldSetJsonContentType: false };
  }

  if (isBodyInit(body)) {
    return { body, shouldSetJsonContentType: false };
  }

  return {
    body: JSON.stringify(body),
    shouldSetJsonContentType: true,
  };
};

const parseJsonSafely = async (response: Response): Promise<unknown> => {
  if (response.status === 204) {
    return undefined;
  }

  const contentType = response.headers.get('content-type');

  // eslint-disable-next-line @typescript-eslint/prefer-optional-chain, sonarjs/null-dereference
  if (contentType === null || !contentType.includes('application/json')) {
    return undefined;
  }

  try {
    return (await response.json()) as unknown;
  } catch {
    return undefined;
  }
};

const getErrorMessage = (data: unknown) => {
  if (!isRecord(data)) {
    return DEFAULT_ERROR_MESSAGE;
  }

  const message = data['message'];

  if (typeof message === 'string' && message !== '') {
    return message;
  }

  if (
    Array.isArray(message) &&
    message.every((item) => typeof item === 'string')
  ) {
    return message.join(', ');
  }

  return DEFAULT_ERROR_MESSAGE;
};

export const orvalMutator = async <T>(
  url: string,
  options?: RequestInit,
): Promise<T> => {
  const serializedBody = serializeBody(options?.body);
  const headers = new Headers(options?.headers);

  if (serializedBody.shouldSetJsonContentType && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  try {
    const requestConfig: RequestInit = {
      ...options,
      credentials: 'include',
      headers,
    };

    if (serializedBody.body !== undefined) {
      requestConfig.body = serializedBody.body;
    }

    const response = await fetch(createUrl(url), requestConfig);

    if (!response.ok) {
      if (response.status === 401) {
        throw new AppNetworkError('Session expired', 401);
      }

      const data = await parseJsonSafely(response);

      if (
        response.status === 400 &&
        isRecord(data) &&
        isStringRecord(data['fieldErrors'])
      ) {
        throw new AppValidationError(data['fieldErrors']);
      }

      throw new AppNetworkError(getErrorMessage(data), response.status);
    }

    return (await parseJsonSafely(response)) as T;
  } catch (error) {
    if (
      error instanceof AppValidationError ||
      error instanceof AppNetworkError
    ) {
      throw error;
    }

    throw new AppNetworkError('Network request failed entirely', undefined, {
      cause: error,
    });
  }
};

export type ErrorType<Error> = AppNetworkError | AppValidationError | Error;
export type BodyType<BodyData> = BodyData;
