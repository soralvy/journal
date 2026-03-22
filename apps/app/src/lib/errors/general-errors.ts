import type { ZodError } from 'zod';

export type AppParseIssue = ZodError['issues'][number];

export class AppValidationError extends Error {
  fieldErrors: Record<string, string>;

  constructor(fieldErrors: Record<string, string>) {
    super('Unprocessable Entity: Validation Failed');
    this.name = 'AppValidationError';
    this.fieldErrors = fieldErrors;
  }
}

export class AppNetworkError extends Error {
  statusCode?: number | undefined;

  constructor(message: string, statusCode?: number) {
    super(message);
    this.name = 'AppNetworkError';
    this.statusCode = statusCode;
  }
}

export class AppDataParseError extends Error {
  issues: AppParseIssue[];

  constructor(issues: AppParseIssue[]) {
    const formattedMessage = issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join(' | ');

    super(`Unrecognized data format: ${formattedMessage}`);
    this.name = 'AppDataParseError';
    this.issues = issues;
  }
}
