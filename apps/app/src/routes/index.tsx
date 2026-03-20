import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/')({
  component: Index,
});

function Index() {
  return (
    <div className="relative flex min-h-screen items-center justify-center">
      <div className="flex flex-col">
        <h1>Master your mind.</h1>
        <p>
          Begin your journey of daily reflection and emotional resilience.
          Practice the art of Stoicism to find clarity in a chaotic world. Your
          personal sanctuary for mental fortitude.
        </p>
      </div>
    </div>
  );
}
