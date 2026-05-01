import { createFileRoute, Link } from '@tanstack/react-router';

import { LoginForm } from '../features/auth';

export const Route = createFileRoute('/')({
  component: Index,
});
// todo: replace this page with the home one
const Index = () => {
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
