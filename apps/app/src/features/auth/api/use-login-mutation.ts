import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { AppNetworkError } from '../../../lib/errors';
import { queryKeys } from '../../../lib/queries';
import type { LoginFormValues } from '../schemas/auth.schema';
import { authApi } from './auth.api';

interface UseLoginOptions {
  onSuccess?: () => void;
}

export const useLoginMutation = (options?: UseLoginOptions) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (credentials: LoginFormValues) => authApi.login(credentials),

    onSuccess: (data) => {
      queryClient.setQueryData(queryKeys.auth.session(), data);

      queryClient.invalidateQueries({ queryKey: queryKeys.user.all });

      options?.onSuccess?.();
    },

    onError: (error) => {
      if (error instanceof AppNetworkError) {
        if (error.statusCode && error.statusCode >= 500) {
          toast.error(
            'The server is currently unavailable. Please try again later.',
          );
        } else if (!error.statusCode) {
          toast.error('Network error. Please check your internet connection.');
        }
      }
    },
  });
};
