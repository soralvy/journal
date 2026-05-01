import { createZodDto } from 'nestjs-zod';
import z from 'zod';

export const JournalResponseSchema = z.object({
  id: z.string(),
  content: z.string(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

export class JournalResponseDto extends createZodDto(JournalResponseSchema) {}
