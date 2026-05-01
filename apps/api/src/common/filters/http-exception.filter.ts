import { ServerResponse } from 'node:http';

import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core/helpers/http-adapter-host';
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
  fieldErrors?: Record<string, string>;
}

const isStringArray = (value: unknown): value is string[] => {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
};

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  constructor(private readonly httpAdapterHost: HttpAdapterHost) {}

  catch(exception: unknown, host: ArgumentsHost) {
    const { httpAdapter } = this.httpAdapterHost;
    const ctx = host.switchToHttp();

    const response = ctx.getResponse<FastifyReply | ServerResponse>();
    const request = ctx.getRequest<FastifyRequest>();

    const { status, message, error, fieldErrors } = this.getErrorDetails(exception);

    const errorResponse: ErrorResponse = {
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request?.url || 'unknown',
      method: request?.method || 'unknown',
      message,
      error,
      requestId: request?.id || `internal-${Date.now()}`,
      fieldErrors,
    };

    this.logError(exception, errorResponse);

    if (this.isHeadersSent(response)) {
      this.logger.warn('Headers already sent, skipping error response logic.');
      return;
    }

    // standard fastify reply
    if ('status' in response && typeof response.status === 'function') {
      response.status(status).send(errorResponse);
      return;
    }

    // raw node.js response (fallback for middleware errors)
    if (response instanceof ServerResponse) {
      response.statusCode = status;
      response.setHeader('Content-Type', 'application/json');

      const origin = request.headers.origin || request.headers.host || '*';
      response.setHeader('Access-Control-Allow-Origin', origin);
      response.setHeader('Access-Control-Allow-Credentials', 'true');
      response.setHeader('Access-Control-Allow-Methods', 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS');

      response.end(JSON.stringify(errorResponse));
      return;
    }

    try {
      httpAdapter.reply(response, errorResponse, status);
    } catch (adapterError) {
      this.logger.error('Failed to send error response via adapter', adapterError);
    }
  }

  private isHeadersSent(response: FastifyReply | ServerResponse): boolean {
    if ('sent' in response) return response.sent; // fastify
    if ('headersSent' in response) return response.headersSent; // node
    return false;
  }

  private getErrorDetails(exception: unknown): {
    status: number;
    message: string | string[];
    error: string;
    fieldErrors?: Record<string, string>;
  } {
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

    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      message: 'Internal server error',
      error: 'Internal Server Error',
    };
  }

  private handleZodError(errorCandidate: unknown): {
    status: number;
    message: string;
    error: string;
    fieldErrors?: Record<string, string>;
  } {
    if (errorCandidate instanceof ZodError) {
      return {
        status: HttpStatus.BAD_REQUEST,
        message: 'Validation failed',
        error: 'Validation Error',
        fieldErrors: this.formatZodFieldErrors(errorCandidate),
      };
    }
    return {
      status: HttpStatus.BAD_REQUEST,
      message: 'Invalid request data',
      error: 'Validation Error',
    };
  }

  private formatZodFieldErrors(zodError: ZodError): Record<string, string> {
    const errors: Record<string, string> = {};
    for (const err of zodError.issues) {
      const path = err.path.join('.') || 'root';
      if (!errors[path]) {
        errors[path] = err.message;
      }
    }
    return errors;
  }

  private handlePrismaError(exception: Prisma.PrismaClientKnownRequestError): {
    status: number;
    message: string;
    error: string;
  } {
    switch (exception.code) {
      case 'P2002': {
        const isDev = process.env.NODE_ENV === 'development';
        const target = exception.meta?.target;
        const fields = isStringArray(target) ? target.join(', ') : 'unknown';

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
