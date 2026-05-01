import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { useEffect } from 'react';
import { toast } from 'sonner';
import z from 'zod';

import { LoginForm } from '../features/auth';

const loginSearchSchema = z.object({
  error: z.string().optional(),
});

export const Route = createFileRoute('/login')({
  component: RouteComponent,
  validateSearch: loginSearchSchema,
});

const RouteComponent = () => {
  const { error } = Route.useSearch();
  const navigate = useNavigate({ from: Route.id });

  useEffect(() => {
    if (!error) return;

    if (error === 'EXPIRED_TOKEN') {
      toast.error('Your magic link expired. Please request a new one.', { 
        id: 'expired-token' 
      });
    } else {
      toast.error('Authentication failed. Please try again.', { 
        id: 'auth-error' 
      });
    }

    navigate({
      search: {}, 
      replace: true, 
    });
    
  }, [error, navigate]);
  
  return (
    <main className="bg-stoic-background relative flex min-h-screen items-center justify-between">
      <section className="flex min-h-screen w-1/2 flex-col justify-between p-12">
        <h1 className="text-xl font-bold">Aura</h1>
        <div className="flex max-w-[75%] flex-col gap-y-8">
          <h1 className="text-7xl font-bold">Master your mind.</h1>
          <p>
            Begin your journey of daily reflection and emotional resilience.
            Practice the art of Stoicism to find clarity in a chaotic world.
            Your personal sanctuary for mental fortitude.
          </p>
        </div>
        <p>Join the waitlist</p>
      </section>

      <section className="flex min-h-screen w-1/2 items-center justify-center">
        <div className="shadow-card rounded-xl bg-white p-8">
          <div className="flex flex-col gap-y-10">
            <div className="flex flex-col gap-y-2">
              <p className="text-primary text-2xl font-bold">Welcome Back</p>
              <p>Sign in to continue your daily practice.</p>
            </div>

            <LoginForm />

            <p className="text-secondary text-center text-sm">
              New to the path?{' '}
              <Link to="/" className="text-primary font-bold">
                Create an account
              </Link>
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
