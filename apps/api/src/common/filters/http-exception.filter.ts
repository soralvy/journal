import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { Prisma } from '@repo/database';
import { FastifyReply, FastifyRequest } from 'fastify';
import { ZodSerializationException, ZodValidationException } from 'nestjs-zod';
import { ZodError } from 'zod';

interface ErrorResponse {
  statusCode: number;
  timestamp: string;
  path: string;
  method: string;
  message: string | string[];
  error: string;
  requestId: string;
}

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<FastifyReply>();
    const request = ctx.getRequest<FastifyRequest>();

    const { status, message, error } = this.getErrorDetails(exception);

    const errorResponse: ErrorResponse = {
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      method: request.method,
      message,
      error,
      requestId: request.id || `internal-${Date.now()}`,
    };

    this.logError(exception, errorResponse);

    response.status(status).send(errorResponse);
  }

  private getErrorDetails(exception: unknown): {
    status: number;
    message: string | string[];
    error: string;
  } {
    if (exception instanceof HttpException) {
      const response = exception.getResponse();
      const status = exception.getStatus();

      // eslint-disable-next-line sonarjs/different-types-comparison
      if (typeof response === 'object' && response !== null) {
        const res = response as Record<string, unknown>;
        return {
          status,
          message: (res.message as string | string[]) || exception.message,
          error: (res.error as string) || HttpStatus[status],
        };
      }

      return { status, message: exception.message, error: HttpStatus[status] };
    }

    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      return this.handlePrismaError(exception);
    }

    if (exception instanceof Prisma.PrismaClientValidationError) {
      return {
        status: HttpStatus.BAD_REQUEST,
        message: 'Invalid database query parameters',
        error: 'Bad Request',
      };
    }

    if (exception instanceof ZodValidationException) {
      return this.handleZodError(exception.getZodError());
    }

    if (exception instanceof ZodSerializationException) {
      const possibleError = exception.getZodError();
      if (possibleError instanceof ZodError) {
        this.logger.error(`Serialization Safety Fail: ${JSON.stringify(possibleError.issues)}`);
      }
      return {
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        message: 'Internal server error',
        error: 'Internal Server Error',
      };
    }

    if (exception instanceof ZodError) {
      return this.handleZodError(exception);
    }

    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      message: 'Internal server error',
      error: 'Internal Server Error',
    };
  }

  private handleZodError(errorCandidate: unknown): { status: number; message: string[]; error: string } {
    if (errorCandidate instanceof ZodError) {
      return {
        status: HttpStatus.BAD_REQUEST,
        message: this.formatZodIssues(errorCandidate),
        error: 'Validation Error',
      };
    }
    return {
      status: HttpStatus.BAD_REQUEST,
      message: ['Invalid request data'],
      error: 'Validation Error',
    };
  }

  private formatZodIssues(zodError: ZodError): string[] {
    return zodError.issues.map((err) => {
      const path = err.path.join('.');
      return path ? `${path}: ${err.message}` : err.message;
    });
  }

  private handlePrismaError(exception: Prisma.PrismaClientKnownRequestError): {
    status: number;
    message: string;
    error: string;
  } {
    switch (exception.code) {
      case 'P2002': {
        const isDev = process.env.NODE_ENV === 'development';
        const target = (exception.meta?.target as string[]) || [];
        const fields = Array.isArray(target) ? target.join(', ') : target;

        return {
          status: HttpStatus.CONFLICT,
          message: isDev ? `Duplicate entry for field: ${fields}` : 'Unique constraint violation',
          error: 'Conflict',
        };
      }
      case 'P2025': {
        return {
          status: HttpStatus.NOT_FOUND,
          message: 'Resource not found',
          error: 'Not Found',
        };
      }
      case 'P2003': {
        return {
          status: HttpStatus.BAD_REQUEST,
          message: 'Invalid reference to related record',
          error: 'Bad Request',
        };
      }
      default: {
        this.logger.warn(`Unhandled Prisma Error Code: ${exception.code}`);
        return {
          status: HttpStatus.INTERNAL_SERVER_ERROR,
          message: 'Database error',
          error: 'Internal Server Error',
        };
      }
    }
  }

  private logError(exception: unknown, errorResponse: ErrorResponse) {
    const isServerError = errorResponse.statusCode >= 500;

    const logPayload = {
      ...errorResponse,
      stack: exception instanceof Error ? exception.stack : undefined,
      prismaMeta: exception instanceof Prisma.PrismaClientKnownRequestError ? exception.meta : undefined,
    };

    if (isServerError) {
      this.logger.error(logPayload);
    } else {
      this.logger.warn(logPayload);
    }
  }
}
