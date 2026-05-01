import { createZodDto } from 'nestjs-zod';
import z from 'zod';

export const CreateJournalSchema = z.object({
  content: z
    .string()
    .trim()
    .min(1, 'Journal content is required')
    .max(10_000, 'Journal content must be at most 10000 characters'),
});

export class CreateJournalDto extends createZodDto(CreateJournalSchema) {}
