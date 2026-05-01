import { MutationCache, QueryCache, QueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { router } from '../../main';
import {
  AppDataParseError,
  AppNetworkError,
  AppValidationError,
} from '../errors';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      gcTime: 1000 * 60 * 15,
      retry: (failureCount, error) => {
        if (error instanceof AppValidationError) return false;
        if (
          error instanceof AppNetworkError &&
          error.statusCode !== undefined &&
          error.statusCode < 500
        )
          return false;
        return failureCount < 3;
      },
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: false,
    },
  },

  queryCache: new QueryCache({
    onError: (error, query) => {
      if (query.state.data !== undefined) return;
      handleGlobalError(error, query.queryKey);
    },
  }),

  mutationCache: new MutationCache({
    onError: (error, _variables, _context, mutation) => {
      if (mutation.options.onError) return;
      handleGlobalError(error);
    },
  }),
});

const handleGlobalError = (error: unknown, queryKey?: readonly unknown[]) => {
  if (error instanceof AppValidationError) return;

  if (error instanceof AppNetworkError) {
    if (error.statusCode === 401) {
      toast.error('Session expired. Please log in again.', {
        id: 'auth-error',
      });

      queryClient.clear();

      void router.navigate({ to: '/login', replace: true });
    } else if (error.statusCode !== undefined && error.statusCode >= 500) {
      toast.error(
        'The server encountered an error. Our team has been notified.',
        { id: 'server-error' },
      );
    } else if (error.statusCode === undefined) {
      toast.error('Network error. Please check your internet connection.', {
        id: 'network-error',
      });
    }
  } else if (error instanceof AppDataParseError) {
    toast.error('Data synchronization error. Please refresh the page.', {
      id: 'parse-error',
    });
    const queryKeyLabel =
      queryKey === undefined ? 'unknown' : JSON.stringify(queryKey);
    console.error(`Schema mismatch on query ${queryKeyLabel}:`, error.issues);
  } else {
    toast.error('An unexpected error occurred.', { id: 'unknown-error' });
  }
};
