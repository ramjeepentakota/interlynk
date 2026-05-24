import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import './index.css';
import App from './App.tsx';
import ErrorBoundary from './components/ErrorBoundary';

// Single shared client. Defaults are conservative — chat data changes fast, so
// short staleTime; the websocket path invalidates queries on top of this.
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30 * 1000,        // 30s — server state is fresh enough this window
      gcTime: 5 * 60 * 1000,       // keep cached responses around 5min
      refetchOnWindowFocus: false, // we have websockets; focus-refetch is noisy
      retry: (failureCount, err: unknown) => {
        // Don't retry auth/permission failures.
        const status = (err as { response?: { status?: number } })?.response?.status;
        if (status === 401 || status === 403 || status === 404) return false;
        return failureCount < 2;
      },
    },
    mutations: { retry: 0 },
  },
});

/**
 * Shareable meeting-link capture.
 *
 * Scheduled calls expose a URL like {@code /join/abc-defg-hij}. Visiting that
 * URL lands on the SPA, so we grab the code BEFORE React mounts, stash it in
 * sessionStorage (survives the login redirect for signed-out users) and
 * rewrite history so refresh doesn't re-trigger it. The ScheduledCalls modal
 * picks the code up on mount and joins automatically.
 */
(() => {
  try {
    const m = window.location.pathname.match(/^\/join\/([A-Za-z0-9-]+)\/?$/);
    if (!m) return;
    sessionStorage.setItem('il-pending-join-code', m[1].toLowerCase());
    window.history.replaceState(null, '', '/');
  } catch { /* sessionStorage unavailable — best-effort */ }
})();

// Register the PWA service worker (offline-shell). Skipped in dev because Vite's
// HMR doesn't play nicely with a cached fetch handler.
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      /* registration failure is non-fatal; app still runs online-only */
    });
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    </ErrorBoundary>
  </StrictMode>,
);
