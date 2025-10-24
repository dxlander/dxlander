import { initTRPC, TRPCError } from '@trpc/server'
import { z } from 'zod'

// Context type for tRPC
export interface Context extends Record<string, unknown> {
  userId?: string
  req?: Request
}

// Initialize tRPC with context
const t = initTRPC.context<Context>().create()

export const router = t.router
export const publicProcedure = t.procedure
export const middleware = t.middleware

// Protected procedure - requires authentication
const isAuthenticated = t.middleware(async ({ ctx, next }) => {
  if (!ctx.userId) {
    throw new TRPCError({
      code: 'UNAUTHORIZED',
      message: 'Authentication required',
    })
  }

  return next({
    ctx: {
      ...ctx,
      userId: ctx.userId, // Now guaranteed to be defined
    },
  })
})

export const protectedProcedure = t.procedure.use(isAuthenticated)

// Common input schemas
export const PaginationSchema = z.object({
  page: z.number().min(1).default(1),
  limit: z.number().min(1).max(100).default(10)
})

export const IdSchema = z.object({
  id: z.string().min(1)
})

export type Pagination = z.infer<typeof PaginationSchema>
export type IdInput = z.infer<typeof IdSchema>