import { PrismaClient } from '@repo/database';
import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { magicLink } from 'better-auth/plugins';
import { Resend } from 'resend';

const prisma = new PrismaClient();
const resend = new Resend(process.env.RESEND_API_KEY);

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
      sendMagicLink: async ({ email, url }) => {
        try {
          await resend.emails.send({
            from: 'Aura <onboarding@resend.dev>',
            to: email,
            subject: 'Sign in to Aura',
            html: `
              <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px; text-align: center; color: #1a1a1a;">
                <h1 style="font-size: 24px; font-weight: 700; margin-bottom: 8px;">Master your mind.</h1>
                <p style="font-size: 16px; color: #64748b; margin-bottom: 32px;">Click the link below to securely sign in to your sanctuary.</p>
                <a href="${url}" style="background-color: #1a1a1a; color: #fafafa; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px; display: inline-block;">
                  Sign In
                </a>
                <p style="font-size: 12px; color: #64748b; margin-top: 40px;">If you did not request this link, you can safely ignore this email.</p>
              </div>
            `,
          });
        } catch (error) {
          console.error('Failed to send magic link via Resend:', error);
          throw new Error('Failed to send magic link via Resend');
        }
      },
    }),
  ],
  advanced: {
    cookiePrefix: 'journal',
  },
  trustedOrigins: process.env['CORS_ORIGINS']?.split(','),
});

export type Auth = typeof auth;
