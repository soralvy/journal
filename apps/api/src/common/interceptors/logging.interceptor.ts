import { CallHandler, ExecutionContext, Injectable, Logger, NestInterceptor } from '@nestjs/common';
import { FastifyReply, FastifyRequest } from 'fastify';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const ctx = context.switchToHttp();
    const request = ctx.getRequest<FastifyRequest>();
    const response = ctx.getResponse<FastifyReply>();

    const { method, url, ip } = request;
    const userAgent = request.headers['user-agent'] || '-';
    const requestId = request.id;
    const startTime = Date.now();

    return next.handle().pipe(
      tap({
        next: () => {
          const duration = Date.now() - startTime;
          this.logger.log(
            `${method} ${url} ${response.statusCode} ${duration}ms - ${ip} - ${userAgent} [${requestId}]`,
          );
        },
        error: () => {
          const duration = Date.now() - startTime;
          this.logger.warn(
            `${method} ${url} ${response.statusCode} ${duration}ms - ${ip} - ${userAgent} [${requestId}]`,
          );
        },
      }),
    );
  }
}
