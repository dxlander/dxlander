import { z } from 'zod';
import { router, protectedProcedure, encryptionService } from '@dxlander/shared';
import { db, schema } from '@dxlander/database';
import { eq, and } from 'drizzle-orm';
import { randomUUID } from 'crypto';

const AIProviderSchema = z.object({
  name: z.string().min(1, 'Provider name is required'),
  provider: z.enum(['claude-agent-sdk', 'openai', 'anthropic', 'ollama', 'lmstudio']),
  apiKey: z.string().optional(),
  settings: z
    .object({
      model: z.string(),
      temperature: z.number().min(0).max(1).optional(),
      maxTokens: z.number().optional(),
      baseUrl: z.string().optional(), // For Ollama/LM Studio
    })
    .optional(),
  isDefault: z.boolean().default(false),
});

export const settingsRouter = router({
  /**
   * Get all AI providers for current user
   */
  listAIProviders: protectedProcedure.query(async ({ ctx }) => {
    try {
      const userId = ctx.userId!;

      const providers = await db.query.aiProviders.findMany({
        where: eq(schema.aiProviders.userId, userId),
      });

      // Don't send encrypted data to frontend
      return providers.map((p) => ({
        id: p.id,
        name: p.name,
        provider: p.provider,
        settings: p.settings ? JSON.parse(p.settings) : null,
        isActive: p.isActive,
        isDefault: p.isDefault,
        lastTested: p.lastTested,
        lastTestStatus: p.lastTestStatus,
        usageCount: p.usageCount,
        createdAt: p.createdAt,
      }));
    } catch (error) {
      console.error('Failed to list AI providers:', error);
      throw new Error('Failed to fetch AI providers');
    }
  }),

  /**
   * Get default AI provider
   */
  getDefaultAIProvider: protectedProcedure.query(async ({ ctx }) => {
    try {
      const userId = ctx.userId!;

      const defaultProvider = await db.query.aiProviders.findFirst({
        where: and(eq(schema.aiProviders.userId, userId), eq(schema.aiProviders.isDefault, true)),
      });

      if (!defaultProvider) {
        return null;
      }

      return {
        id: defaultProvider.id,
        name: defaultProvider.name,
        provider: defaultProvider.provider,
        settings: defaultProvider.settings ? JSON.parse(defaultProvider.settings) : null,
        hasApiKey: !!defaultProvider.encryptedApiKey,
      };
    } catch (error) {
      console.error('Failed to get default AI provider:', error);
      return null;
    }
  }),

  /**
   * Create or update AI provider
   */
  saveAIProvider: protectedProcedure.input(AIProviderSchema).mutation(async ({ input, ctx }) => {
    try {
      const userId = ctx.userId!;

      // Encrypt API key if provided (encryption service already initialized)
      let encryptedApiKey: string | undefined;
      if (input.apiKey) {
        encryptedApiKey = encryptionService.encryptForStorage(input.apiKey);
      }

      // If setting this as default, unset other defaults
      if (input.isDefault) {
        await db
          .update(schema.aiProviders)
          .set({ isDefault: false })
          .where(eq(schema.aiProviders.userId, userId));
      }

      const providerId = randomUUID();
      const providerData = {
        id: providerId,
        userId,
        name: input.name,
        provider: input.provider,
        encryptedApiKey,
        settings: input.settings ? JSON.stringify(input.settings) : null,
        isActive: true,
        isDefault: input.isDefault,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await db.insert(schema.aiProviders).values(providerData);

      return {
        success: true,
        providerId,
        message: 'AI provider saved successfully',
      };
    } catch (error) {
      console.error('Failed to save AI provider:', error);
      throw new Error('Failed to save AI provider');
    }
  }),

  /**
   * Update AI provider
   */
  updateAIProvider: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        updates: AIProviderSchema.partial(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      try {
        const userId = ctx.userId!;

        // Verify ownership
        const provider = await db.query.aiProviders.findFirst({
          where: and(eq(schema.aiProviders.id, input.id), eq(schema.aiProviders.userId, userId)),
        });

        if (!provider) {
          throw new Error('AI provider not found');
        }

        // Handle encryption if API key is being updated (encryption service already initialized)
        let encryptedApiKey = provider.encryptedApiKey;
        if (input.updates.apiKey) {
          encryptedApiKey = encryptionService.encryptForStorage(input.updates.apiKey);
        }

        // If setting this as default, unset other defaults
        if (input.updates.isDefault) {
          await db
            .update(schema.aiProviders)
            .set({ isDefault: false })
            .where(eq(schema.aiProviders.userId, userId));
        }

        await db
          .update(schema.aiProviders)
          .set({
            name: input.updates.name,
            encryptedApiKey,
            settings: input.updates.settings
              ? JSON.stringify(input.updates.settings)
              : provider.settings,
            isDefault: input.updates.isDefault,
            updatedAt: new Date(),
          })
          .where(eq(schema.aiProviders.id, input.id));

        return {
          success: true,
          message: 'AI provider updated successfully',
        };
      } catch (error) {
        console.error('Failed to update AI provider:', error);
        throw new Error('Failed to update AI provider');
      }
    }),

  /**
   * Delete AI provider
   */
  deleteAIProvider: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input, ctx }) => {
      try {
        const userId = ctx.userId!;

        // Verify ownership
        const provider = await db.query.aiProviders.findFirst({
          where: and(eq(schema.aiProviders.id, input.id), eq(schema.aiProviders.userId, userId)),
        });

        if (!provider) {
          throw new Error('AI provider not found');
        }

        await db.delete(schema.aiProviders).where(eq(schema.aiProviders.id, input.id));

        return {
          success: true,
          message: 'AI provider deleted successfully',
        };
      } catch (error) {
        console.error('Failed to delete AI provider:', error);
        throw new Error('Failed to delete AI provider');
      }
    }),
});
