import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Role } from '@repo/database';
import { fromNodeHeaders } from 'better-auth/node';
import type { FastifyRequest } from 'fastify';

import { auth } from './auth.configuration';

@Injectable()
export class AuthGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<FastifyRequest>();

    const session = await auth.api.getSession({
      headers: fromNodeHeaders(request.headers),
    });

    if (!session) {
      throw new UnauthorizedException();
    }

    request.user = {
      ...session.user,
      role: session.user.role as Role,
      image: session.user.image ?? null,
      username: session.user.username ?? null,
      deletedAt: session.user.deletedAt ?? null,
    };

    return true;
  }
}
