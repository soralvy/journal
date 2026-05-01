import { useQuery } from '@tanstack/react-query';

import { apiClient } from '../../lib/api-client';
import { queryKeys } from '../../lib/queries';
import { type UserProfile,UserProfileSchema } from './schemas/auth.schema';

export const useCurrentUser = () => {
  return useQuery({
    queryKey: queryKeys.user.me(),
    queryFn: () =>
      apiClient<UserProfile>('/api/users/me', {}, UserProfileSchema),
    staleTime: 1000 * 60 * 5,
    retry: false,
  });
};
