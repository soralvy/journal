import 'fastify';

import type { User } from '@repo/database';

declare module 'fastify' {
  interface FastifyRequest {
    user?: User;
  }
}
