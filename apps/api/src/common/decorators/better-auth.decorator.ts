import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { FastifyReply, FastifyRequest } from 'fastify';

export const BetterAuthContext = createParamDecorator((data: unknown, ctx: ExecutionContext) => {
  const http = ctx.switchToHttp();
  return {
    req: http.getRequest<FastifyRequest>(),
    res: http.getResponse<FastifyReply>(),
  };
});
