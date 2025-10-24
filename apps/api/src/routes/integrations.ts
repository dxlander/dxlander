import { z } from 'zod'
import { router, publicProcedure, protectedProcedure, IdSchema } from '@dxlander/shared'

export const integrationsRouter = router({
  listAvailable: publicProcedure
    .query(async () => {
      // TODO: Return list of supported integrations
      return [
        {
          service: 'supabase',
          name: 'Supabase',
          type: 'database',
          description: 'Open source Firebase alternative',
          requiredCredentials: ['url', 'anonKey']
        }
      ]
    }),

  listSaved: protectedProcedure
    .query(async ({ ctx }) => {
      // TODO: Get user's saved integrations (encrypted)
      return []
    }),

  save: protectedProcedure
    .input(z.object({
      service: z.string(),
      credentials: z.record(z.string()),
      projectId: z.string().optional()
    }))
    .mutation(async ({ input, ctx }) => {
      // TODO: Implement credential saving
      return {
        integrationId: 'temp-integration-id',
        service: input.service,
        success: true
      }
    })
})