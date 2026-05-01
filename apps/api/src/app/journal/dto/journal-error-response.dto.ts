import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class JournalApiErrorResponseDto {
  @ApiProperty({ example: 500 })
  statusCode: number;

  @ApiProperty({ example: '2026-05-01T12:00:00.000Z' })
  timestamp: string;

  @ApiProperty({ example: '/api/v1/journal' })
  path: string;

  @ApiProperty({ example: 'POST' })
  method: string;

  @ApiProperty({ example: 'Internal server error' })
  message: string;

  @ApiProperty({ example: 'Internal Server Error' })
  error: string;

  @ApiProperty({ example: '4e7046b7-55ca-4a49-9c2f-24d58a71fbf7' })
  requestId: string;
}

export class JournalValidationErrorResponseDto extends JournalApiErrorResponseDto {
  @ApiProperty({ example: 400 })
  declare statusCode: number;

  @ApiProperty({ example: 'Validation failed' })
  declare message: string;

  @ApiProperty({ example: 'Validation Error' })
  declare error: string;

  @ApiPropertyOptional({
    additionalProperties: { type: 'string' },
    example: { content: 'Journal content is required' },
    type: 'object',
  })
  fieldErrors?: Record<string, string>;
}
