import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '../../lib/queries';
import { apiClient } from '../../lib/api-client';
import { UserProfileSchema, type UserProfile } from './schemas/auth.schema';

export const useCurrentUser = () => {
  return useQuery({
    queryKey: queryKeys.user.me(),
    queryFn: () =>
      apiClient<UserProfile>('/api/users/me', {}, UserProfileSchema),
    staleTime: 1000 * 60 * 5,
    retry: false,
  });
};
