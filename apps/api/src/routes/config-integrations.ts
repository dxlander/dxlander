import { z } from 'zod';
import { router, protectedProcedure, LinkConfigIntegrationSchema } from '@dxlander/shared';
import { ConfigIntegrationService } from '../services/config-integration.service';

/**
 * Config-Integrations Router
 *
 * Manages the linking of saved integrations to config sets.
 */
export const configIntegrationsRouter = router({
  /**
   * List all linked integrations for a config set
   */
  list: protectedProcedure
    .input(
      z.object({
        configSetId: z.string().min(1),
      })
    )
    .query(async ({ input, ctx }) => {
      const { userId } = ctx;
      const { configSetId } = input;

      return await ConfigIntegrationService.getLinkedIntegrations(userId, configSetId);
    }),

  /**
   * Get available integrations (not already linked to this config)
   */
  available: protectedProcedure
    .input(
      z.object({
        configSetId: z.string().min(1),
      })
    )
    .query(async ({ input, ctx }) => {
      const { userId } = ctx;
      const { configSetId } = input;

      return await ConfigIntegrationService.getAvailableIntegrations(userId, configSetId);
    }),

  /**
   * Link an integration to a config set
   */
  link: protectedProcedure.input(LinkConfigIntegrationSchema).mutation(async ({ input, ctx }) => {
    const { userId } = ctx;

    const link = await ConfigIntegrationService.linkIntegration(userId, input);

    return {
      success: true,
      link: {
        ...link,
        createdAt: link.createdAt.toISOString(),
        updatedAt: link.updatedAt.toISOString(),
      },
    };
  }),

  /**
   * Unlink an integration from a config set
   */
  unlink: protectedProcedure
    .input(
      z.object({
        configSetId: z.string().min(1),
        integrationId: z.string().min(1),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const { userId } = ctx;
      const { configSetId, integrationId } = input;

      await ConfigIntegrationService.unlinkIntegration(userId, configSetId, integrationId);

      return { success: true };
    }),

  /**
   * Update overrides for a linked integration
   */
  updateOverrides: protectedProcedure
    .input(
      z.object({
        configSetId: z.string().min(1),
        integrationId: z.string().min(1),
        overrides: z.record(z.string()),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const { userId } = ctx;
      const { configSetId, integrationId, overrides } = input;

      await ConfigIntegrationService.updateOverrides(userId, configSetId, integrationId, overrides);

      return { success: true };
    }),

  /**
   * Get resolved environment variables for deployment
   * Returns decrypted credentials with overrides applied
   */
  getResolvedEnvVars: protectedProcedure
    .input(
      z.object({
        configSetId: z.string().min(1),
      })
    )
    .query(async ({ input, ctx }) => {
      const { userId } = ctx;
      const { configSetId } = input;

      const envVars = await ConfigIntegrationService.getResolvedEnvVars(userId, configSetId);

      // Return keys only (values are sensitive)
      // Full values are only used server-side during deployment
      return {
        keys: Object.keys(envVars),
        count: Object.keys(envVars).length,
      };
    }),

  /**
   * Reorder linked integrations
   */
  reorder: protectedProcedure
    .input(
      z.object({
        configSetId: z.string().min(1),
        orderedIntegrationIds: z.array(z.string()),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const { userId } = ctx;
      const { configSetId, orderedIntegrationIds } = input;

      await ConfigIntegrationService.reorderIntegrations(
        userId,
        configSetId,
        orderedIntegrationIds
      );

      return { success: true };
    }),
});
