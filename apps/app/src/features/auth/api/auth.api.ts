import { apiClient } from '../../../lib/api-client';
import {
  userSessionSchema,
  type LoginFormValues,
  type UserSession,
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
