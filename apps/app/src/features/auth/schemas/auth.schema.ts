import z, { email, string } from 'zod';

export const UserProfileSchema = z.object({
  email: email(),
  username: string(),
});
export type UserProfile = z.infer<typeof UserProfileSchema>;

const loginSchema = z.object({
  email: z.email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

export type LoginFormValues = z.infer<typeof loginSchema>;

export const userSessionSchema = z.object({
  token: z.string(),
  user: z.object({
    id: z.uuid(),
    email: z.email(),
    name: z.string(),
  }),
});

export type UserSession = z.infer<typeof userSessionSchema>;
