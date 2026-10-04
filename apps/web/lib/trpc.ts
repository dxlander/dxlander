'use client';

import { createTRPCReact } from '@trpc/react-query';
import { createTRPCClient, httpBatchLink, TRPCClientError } from '@trpc/client';
import type { AppRouter } from '../../../apps/api/src/routes';

// @ts-expect-error - tRPC v11.8 error codes type mismatch with react-query types
export const trpc = createTRPCReact<AppRouter>();

// Helper function to handle global errors
const handleGlobalError = (error: unknown) => {
  if (typeof window === 'undefined') return;

  if (error instanceof TRPCClientError) {
    // You can replace this with your toast library (e.g., toast.error(error.message))
    console.error('API Error:', error.message);

    if (error.data?.code === 'UNAUTHORIZED') {
      // Handle unauthorized access globally
      localStorage.removeItem('dxlander-token');
      window.location.href = '/login'; // Redirect to login if appropriate
    }
  } else {
    console.error('Unknown API Error:', error);
  }
};

// Create vanilla tRPC client for use outside React components
// @ts-expect-error - tRPC v11.8 error codes type mismatch
export const trpcClient = createTRPCClient<AppRouter>({
  links: [
    httpBatchLink({
      url: `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/trpc`,
      // Add auth headers when available
      headers() {
        const token = typeof window !== 'undefined' ? localStorage.getItem('dxlander-token') : null;
        return token ? { authorization: `Bearer ${token}` } : {};
      },
    }),
  ],
});
