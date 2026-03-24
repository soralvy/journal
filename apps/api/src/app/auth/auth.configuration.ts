import { PrismaClient } from '@repo/database';
import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { magicLink } from 'better-auth/plugins';
const prisma = new PrismaClient();

export const auth = betterAuth({
  baseURL: process.env.BETTER_AUTH_URL,
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID as string,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
    },
  },
  user: {
    additionalFields: {
      username: { type: 'string', required: false },
      role: { type: 'string', required: true, defaultValue: 'USER' },
      deletedAt: { type: 'date', required: false },
    },
  },
  database: prismaAdapter(prisma, {
    provider: 'postgresql',
  }),
  plugins: [
    magicLink({
      sendMagicLink: ({ email, token, url }, ctx) => {},
    }),
  ],
  advanced: {
    cookiePrefix: 'journal',
  },
  trustedOrigins: process.env['CORS_ORIGINS']?.split(','),
});

export type Auth = typeof auth;
