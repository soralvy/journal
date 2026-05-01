import { apiClient } from '../../../lib/api-client';
import {
  type LoginFormValues,
  type UserSession,
  userSessionSchema,
} from '../schemas/auth.schema';

export const authApi = {
  login: (credentials: LoginFormValues) =>
    apiClient<UserSession>(
      '/api/login',
      {
        method: 'POST',
        body: JSON.stringify(credentials),
      },
      userSessionSchema,
    ),
};
