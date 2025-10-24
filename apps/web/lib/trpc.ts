"use client"

import { createTRPCReact } from '@trpc/react-query'
import { createTRPCClient, httpBatchLink } from '@trpc/client'
import type { AppRouter } from '../../../apps/api/src/routes'

// Create tRPC React hooks
export const trpc = createTRPCReact<AppRouter>()

// Create vanilla tRPC client for use outside React components
export const trpcClient = createTRPCClient<AppRouter>({
  links: [
    httpBatchLink({
      url: `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/trpc`,
      // Add auth headers when available
      headers() {
        const token = typeof window !== 'undefined' ? localStorage.getItem('dxlander-token') : null
        return token ? { authorization: `Bearer ${token}` } : {}
      },
    }),
  ],
})

export type { AppRouter }