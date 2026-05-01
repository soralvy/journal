import { createZodDto } from 'nestjs-zod';
import z from 'zod';

export const CreateUserSchema = z.object({
  email: z.email({ message: 'Invalid email format' }),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain uppercase letter')
    .regex(/\d/, 'Password must contain number'),
  username: z
    .string()
    .min(3, 'Username must be at least 3 characters')
    .max(20, 'Username must be at most 20 characters')
    .regex(/^\w+$/, 'Username can only contain letters, numbers, and underscores'),
});

export class CreateUserDto extends createZodDto(CreateUserSchema) {}
