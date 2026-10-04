'use client';

import { useState } from 'react';
import { QueryClient, QueryCache, MutationCache, QueryClientProvider } from '@tanstack/react-query';
import { httpBatchLink, TRPCClientError } from '@trpc/client';
import { trpc } from './trpc';
import { Toaster, toast } from 'sonner'; // Changed to use toast directly from sonner

// Helper function to handle errors globally and show toasts
const handleGlobalError = (error: unknown) => {
  if (typeof window === 'undefined') return;

  if (error instanceof TRPCClientError) {
    const errorMessage = error.message || 'A server connection error occurred.';
    toast.error('Server Errors', {
      description: errorMessage,
    });

    if (error.data?.code === 'UNAUTHORIZED') {
      localStorage.removeItem('dxlander-token');
      window.location.href = '/login';
    }
  } else if (error instanceof Error) {
    toast.error('Unexpected error', {
      description: error.message,
    });
  } else {
    toast.error('An unknown error has occurred.');
  }
};

interface ProvidersProps {
  children: React.ReactNode;
}

export function Providers({ children }: ProvidersProps) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        // Capture all query and mutation errors globally here
        queryCache: new QueryCache({
          onError: (error) => handleGlobalError(error),
        }),
        mutationCache: new MutationCache({
          onError: (error) => handleGlobalError(error),
        }),
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000, // 1 minute
            retry: false, // Turned off retry for standard errors so user sees the toast immediately
          },
        },
      })
  );

  const [trpcClient] = useState(() =>
    trpc.createClient({
      links: [
        httpBatchLink({
          url: `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/trpc`,
          headers() {
            const token =
              typeof window !== 'undefined' ? localStorage.getItem('dxlander-token') : null;
            return token ? { authorization: `Bearer ${token}` } : {};
          },
        }),
      ],
    })
  );

  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        {children}
        <Toaster position="top-center" richColors />
      </QueryClientProvider>
    </trpc.Provider>
  );
}
