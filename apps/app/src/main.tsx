import './index.css';

import { Theme } from '@radix-ui/themes';
import { QueryClientProvider } from '@tanstack/react-query';
import { createRouter, RouterProvider } from '@tanstack/react-router';
import { StrictMode } from 'react';
import ReactDOM from 'react-dom/client';
import { Toaster } from 'sonner';

import { queryClient } from './lib/queries';
import { routeTree } from './routeTree.gen';

export const router = createRouter({ routeTree });
declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}

const rootElement = document.querySelector('#root');

if (rootElement === null) {
  throw new Error('Root element not found.');
}

if (rootElement.innerHTML === '') {
  const root = ReactDOM.createRoot(rootElement);
  root.render(
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <Theme>
          <Toaster
            richColors
            position="top-center"
            expand={false}
            theme="system"
          />
          <RouterProvider router={router} />
        </Theme>
      </QueryClientProvider>
    </StrictMode>,
  );
}
