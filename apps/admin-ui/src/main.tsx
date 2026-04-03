/**
 * Admin UI entry point.
 * Sets up React, TanStack Query, and React Router.
 * @module admin-ui/main
 */

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';

import { App } from './App.js';
import { AuthProvider } from './auth/AuthProvider.js';
import './index.css';

/** Build timestamp injected by Vite — forces unique content hash per deploy */
declare const __BUILD_TIME__: string;
if (typeof __BUILD_TIME__ !== 'undefined') {
  console.debug(`[SuiteCommand Admin] Build: ${__BUILD_TIME__}`);
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
    },
  },
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter basename="/admin">
        <AuthProvider>
          <App />
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
);
