import { db, schema } from '@dxlander/database';
import {
  ClaudeAgentProvider,
  encryptionService,
  IdSchema,
  OpenRouterProvider,
  protectedProcedure,
  router,
} from '@dxlander/shared';
import { randomUUID } from 'crypto';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { AIProviderTesterService } from '../services/ai-provider-tester.service';

const CreateAIProviderSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  provider: z.enum(['claude-code', 'openai', 'ollama', 'lmstudio', 'anthropic', 'openrouter']),
  apiKey: z.string().optional(),
  settings: z.record(z.unknown()).optional(),
  isDefault: z.boolean().optional(),
});

const UpdateAIProviderSchema = z.object({
  id: z.string(),
  name: z.string().min(1).optional(),
  apiKey: z.string().optional(),
  settings: z.record(z.unknown()).optional(),
  isActive: z.boolean().optional(),
  isDefault: z.boolean().optional(),
});

const TestAIProviderSchema = z.object({
  id: z.string(),
});

const TestConnectionSchema = z.object({
  provider: z.enum(['claude-code', 'openai', 'ollama', 'lmstudio', 'anthropic', 'openrouter']),
  apiKey: z.string().optional(),
  settings: z.record(z.unknown()).optional(), // Flexible settings - each provider has different requirements
});

const SettingsSchema = z
  .object({
    model: z.string().optional(),
    baseUrl: z.string().optional(),
  })
  .passthrough();

export const aiProvidersRouter = router({
  /**
   * List all AI providers for the current user
   */
  list: protectedProcedure.query(async ({ ctx }) => {
    const { userId } = ctx;
    if (!userId) {
      throw new Error('User not authenticated');
    }

    const providers = await db.query.aiProviders.findMany({
      where: eq(schema.aiProviders.userId, userId),
      orderBy: (aiProviders, { desc }) => [desc(aiProviders.createdAt)],
    });

    // Don't expose encrypted keys in the list
    return providers.map((provider) => ({
      ...provider,
      encryptedApiKey: provider.encryptedApiKey ? '••••••••' : null,
      encryptedConfig: null,
    }));
  }),

  /**
   * Get a specific AI provider
   */
  get: protectedProcedure.input(IdSchema).query(async ({ input, ctx }) => {
    const { userId } = ctx;
    if (!userId) {
      throw new Error('User not authenticated');
    }

    const provider = await db.query.aiProviders.findFirst({
      where: and(eq(schema.aiProviders.id, input.id), eq(schema.aiProviders.userId, userId)),
    });

    if (!provider) {
      throw new Error('AI provider not found');
    }

    // Don't expose encrypted keys
    return {
      ...provider,
      encryptedApiKey: provider.encryptedApiKey ? '••••••••' : null,
      encryptedConfig: null,
    };
  }),

  /**
   * Create a new AI provider
   */
  create: protectedProcedure.input(CreateAIProviderSchema).mutation(async ({ input, ctx }) => {
    const { userId } = ctx;
    if (!userId) {
      throw new Error('User not authenticated');
    }

    try {
      // If setting as default, unset other defaults
      if (input.isDefault) {
        await db
          .update(schema.aiProviders)
          .set({ isDefault: false })
          .where(eq(schema.aiProviders.userId, userId));
      }

      // Encrypt API key if provided (encryption service already initialized with file-based key)
      let encryptedApiKey: string | null = null;
      if (input.apiKey) {
        encryptedApiKey = encryptionService.encryptForStorage(input.apiKey);
      }

      // Create provider
      const providerId = randomUUID();
      await db.insert(schema.aiProviders).values({
        id: providerId,
        userId,
        name: input.name,
        provider: input.provider,
        encryptedApiKey,
        settings: input.settings ? JSON.stringify(input.settings) : null,
        isActive: true,
        isDefault: input.isDefault || false,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      return {
        id: providerId,
        message: 'AI provider created successfully',
      };
    } catch (error) {
      console.error('Failed to create AI provider:', error);
      if (error instanceof Error) {
        throw new Error(error.message);
      }
      throw new Error('Failed to create AI provider');
    }
  }),

  /**
   * Update an existing AI provider
   */
  update: protectedProcedure.input(UpdateAIProviderSchema).mutation(async ({ input, ctx }) => {
    const { userId } = ctx;
    if (!userId) {
      throw new Error('User not authenticated');
    }

    try {
      // Verify ownership
      const provider = await db.query.aiProviders.findFirst({
        where: and(eq(schema.aiProviders.id, input.id), eq(schema.aiProviders.userId, userId)),
      });

      if (!provider) {
        throw new Error('AI provider not found');
      }

      // If setting as default, unset other defaults
      if (input.isDefault) {
        await db
          .update(schema.aiProviders)
          .set({ isDefault: false })
          .where(
            and(
              eq(schema.aiProviders.userId, userId),
              eq(schema.aiProviders.id, input.id) // Exclude current provider
            )
          );
      }

      // Encrypt API key if being updated (encryption service already initialized)
      let encryptedApiKey: string | undefined;
      if (input.apiKey) {
        encryptedApiKey = encryptionService.encryptForStorage(input.apiKey);
      }

      // Update provider
      const updateData: Partial<(typeof schema.aiProviders)['$inferInsert']> = {
        updatedAt: new Date(),
      };

      if (input.name) updateData.name = input.name;
      if (encryptedApiKey) updateData.encryptedApiKey = encryptedApiKey;
      if (input.settings) updateData.settings = JSON.stringify(input.settings);
      if (input.isActive !== undefined) updateData.isActive = input.isActive;
      if (input.isDefault !== undefined) updateData.isDefault = input.isDefault;

      await db
        .update(schema.aiProviders)
        .set(updateData)
        .where(eq(schema.aiProviders.id, input.id));

      return {
        success: true,
        message: 'AI provider updated successfully',
      };
    } catch (error) {
      console.error('Failed to update AI provider:', error);
      if (error instanceof Error) {
        throw new Error(error.message);
      }
      throw new Error('Failed to update AI provider');
    }
  }),

  /**
   * Delete an AI provider
   */
  delete: protectedProcedure.input(IdSchema).mutation(async ({ input, ctx }) => {
    const { userId } = ctx;
    if (!userId) {
      throw new Error('User not authenticated');
    }

    try {
      // Verify ownership
      const provider = await db.query.aiProviders.findFirst({
        where: and(eq(schema.aiProviders.id, input.id), eq(schema.aiProviders.userId, userId)),
      });

      if (!provider) {
        throw new Error('AI provider not found');
      }

      // Don't allow deleting the default provider if it's the only one
      if (provider.isDefault) {
        const otherProviders = await db.query.aiProviders.findMany({
          where: and(eq(schema.aiProviders.userId, userId), eq(schema.aiProviders.isActive, true)),
        });

        if (otherProviders.length === 1) {
          throw new Error('Cannot delete the only active AI provider. Add another provider first.');
        }

        // Set another provider as default
        const nextProvider = otherProviders.find((p) => p.id !== input.id);
        if (nextProvider) {
          await db
            .update(schema.aiProviders)
            .set({ isDefault: true })
            .where(eq(schema.aiProviders.id, nextProvider.id));
        }
      }

      // Delete the provider
      await db.delete(schema.aiProviders).where(eq(schema.aiProviders.id, input.id));

      return {
        success: true,
        message: 'AI provider deleted successfully',
      };
    } catch (error) {
      console.error('Failed to delete AI provider:', error);
      if (error instanceof Error) {
        throw new Error(error.message);
      }
      throw new Error('Failed to delete AI provider');
    }
  }),

  /**
   * Test an AI provider connection
   */
  test: protectedProcedure.input(TestAIProviderSchema).mutation(async ({ input, ctx }) => {
    const { userId } = ctx;
    if (!userId) {
      throw new Error('User not authenticated');
    }

    try {
      // Get provider
      const provider = await db.query.aiProviders.findFirst({
        where: and(eq(schema.aiProviders.id, input.id), eq(schema.aiProviders.userId, userId)),
      });

      if (!provider) {
        throw new Error('AI provider not found');
      }

      // Decrypt API key (encryption service already initialized)
      let apiKey: string | undefined;
      if (provider.encryptedApiKey) {
        apiKey = encryptionService.decryptFromStorage(provider.encryptedApiKey);
      }

      const settings = provider.settings ? SettingsSchema.parse(JSON.parse(provider.settings)) : {};

      let testResult = {
        success: false,
        message: '',
        model: settings.model || 'default',
      };

      // Test based on provider type
      try {
        if (provider.provider === 'claude-code' || provider.provider === 'anthropic') {
          // Use Claude Agent SDK for testing
          if (!apiKey && provider.provider !== 'claude-code') {
            throw new Error('API key is required for Anthropic provider');
          }

          const claudeProvider = new ClaudeAgentProvider();
          await claudeProvider.initialize({
            apiKey: apiKey || process.env.ANTHROPIC_API_KEY || '', // Claude Code can use env var
            model: settings.model || 'claude-sonnet-4-5-20250929',
            provider: provider.provider,
          });

          // Test connection
          const isConnected = await claudeProvider.testConnection();

          if (isConnected) {
            testResult = {
              success: true,
              message: `Successfully connected to ${provider.provider === 'claude-code' ? 'Claude Code' : 'Anthropic Claude'}`,
              model: settings.model || 'claude-sonnet-4-5-20250929',
            };
          } else {
            throw new Error('Connection test failed');
          }
        } else if (provider.provider === 'openai') {
          // For OpenAI, we'll add proper testing later
          if (!apiKey) {
            throw new Error('API key is required for OpenAI');
          }
          testResult = {
            success: true,
            message: 'OpenAI provider configured (full testing coming soon)',
            model: settings.model || 'gpt-4-turbo',
          };
        } else if (provider.provider === 'openrouter') {
          // For OpenRouter, test the actual connection
          if (!apiKey) {
            throw new Error('API key is required for OpenRouter');
          }

          // Use the provider tester service for proper testing
          const testConfig = {
            provider: 'openrouter',
            apiKey: apiKey,
            settings: settings,
          };

          testResult = await AIProviderTesterService.testConnection(testConfig);

          if (!testResult.success) {
            throw new Error(testResult.message);
          }
        } else {
          // Ollama/LM Studio - check if base URL is provided
          if (!settings.baseUrl) {
            throw new Error('Base URL is required for local providers');
          }
          testResult = {
            success: true,
            message: `${provider.provider} configured at ${settings.baseUrl}`,
            model: settings.model || 'default',
          };
        }
      } catch (error) {
        testResult = {
          success: false,
          message: error instanceof Error ? error.message : 'Connection test failed',
          model: settings.model || 'default',
        };
      }

      // Update test status
      await db
        .update(schema.aiProviders)
        .set({
          lastTested: new Date(),
          lastTestStatus: testResult.success ? 'success' : 'failed',
          lastError: testResult.success ? null : testResult.message,
        })
        .where(eq(schema.aiProviders.id, input.id));

      return testResult;
    } catch (error) {
      console.error('Failed to test AI provider:', error);

      // Update test status
      await db
        .update(schema.aiProviders)
        .set({
          lastTested: new Date(),
          lastTestStatus: 'failed',
          lastError: error instanceof Error ? error.message : 'Unknown error',
        })
        .where(eq(schema.aiProviders.id, input.id));

      if (error instanceof Error) {
        throw new Error(error.message);
      }
      throw new Error('Failed to test AI provider');
    }
  }),

  /**
   * Set a provider as default
   */
  setDefault: protectedProcedure.input(IdSchema).mutation(async ({ input, ctx }) => {
    const { userId } = ctx;
    if (!userId) {
      throw new Error('User not authenticated');
    }

    try {
      // Verify ownership
      const provider = await db.query.aiProviders.findFirst({
        where: and(eq(schema.aiProviders.id, input.id), eq(schema.aiProviders.userId, userId)),
      });

      if (!provider) {
        throw new Error('AI provider not found');
      }

      // Unset all other defaults
      await db
        .update(schema.aiProviders)
        .set({ isDefault: false })
        .where(eq(schema.aiProviders.userId, userId));

      // Set this as default
      await db
        .update(schema.aiProviders)
        .set({
          isDefault: true,
          isActive: true, // Ensure it's active
          updatedAt: new Date(),
        })
        .where(eq(schema.aiProviders.id, input.id));

      return {
        success: true,
        message: 'Default AI provider updated',
      };
    } catch (error) {
      console.error('Failed to set default provider:', error);
      if (error instanceof Error) {
        throw new Error(error.message);
      }
      throw new Error('Failed to set default provider');
    }
  }),

  /**
   * Get the default AI provider status
   */
  getDefaultStatus: protectedProcedure.query(async ({ ctx }) => {
    const { userId } = ctx;
    if (!userId) {
      throw new Error('User not authenticated');
    }

    try {
      // Get default AI provider
      const defaultProvider = await db.query.aiProviders.findFirst({
        where: and(
          eq(schema.aiProviders.userId, userId),
          eq(schema.aiProviders.isDefault, true),
          eq(schema.aiProviders.isActive, true)
        ),
      });

      if (!defaultProvider) {
        return {
          hasProvider: false,
          provider: null,
          message: 'No default AI provider configured',
        };
      }

      const settings = defaultProvider.settings
        ? SettingsSchema.parse(JSON.parse(defaultProvider.settings))
        : {};

      return {
        hasProvider: true,
        provider: {
          id: defaultProvider.id,
          name: defaultProvider.name,
          provider: defaultProvider.provider,
          model: settings.model || 'default',
          lastTestStatus: defaultProvider.lastTestStatus,
          lastTested: defaultProvider.lastTested,
        },
        message: `Using ${defaultProvider.name} (${settings.model || 'default'})`,
      };
    } catch (error) {
      console.error('Failed to get default provider status:', error);
      if (error instanceof Error) {
        throw new Error(error.message);
      }
      throw new Error('Failed to get default provider status');
    }
  }),

  /**
   * Get detailed models for a provider (currently only supports OpenRouter)
   */
  getDetailedModels: protectedProcedure
    .input(z.object({ provider: z.string(), apiKey: z.string().optional() }))
    .query(async ({ input, ctx }) => {
      const { userId } = ctx;
      if (!userId) {
        throw new Error('User not authenticated');
      }

      try {
        // Currently only support OpenRouter for detailed models
        if (input.provider !== 'openrouter') {
          return [];
        }

        // Create a temporary provider instance to fetch models
        const provider = new OpenRouterProvider();

        // Initialize with provided API key or try to get from existing provider
        let apiKey = input.apiKey;

        // If no API key provided, try to get from existing provider
        if (!apiKey) {
          const existingProvider = await db.query.aiProviders.findFirst({
            where: and(
              eq(schema.aiProviders.userId, userId),
              eq(schema.aiProviders.provider, 'openrouter'),
              eq(schema.aiProviders.isActive, true)
            ),
          });

          if (existingProvider?.encryptedApiKey) {
            apiKey = encryptionService.decryptFromStorage(existingProvider.encryptedApiKey);
          }
        }

        if (!apiKey) {
          throw new Error('API key is required to fetch OpenRouter models');
        }

        await provider.initialize({
          provider: 'openrouter',
          apiKey,
        });

        // Check if provider has getDetailedModels method before calling it
        if (typeof provider.getDetailedModels === 'function') {
          // Add timeout to prevent hanging
          const models = await Promise.race([
            provider.getDetailedModels(),
            new Promise<any>((_, reject) =>
              setTimeout(() => reject(new Error('Model fetch timeout after 15 seconds')), 15000)
            ),
          ]);
          return models;
        } else {
          throw new Error('Provider does not support detailed models');
        }
      } catch (error) {
        console.error('Failed to fetch detailed models:', error);
        if (error instanceof Error) {
          throw new Error(error.message);
        }
        throw new Error('Failed to fetch detailed models');
      }
    }),

  /**
   * Test connection before saving (no encryption needed)
   * This allows testing API keys in the modal before creating the provider
   */
  testConnection: protectedProcedure.input(TestConnectionSchema).mutation(async ({ input }) => {
    return await AIProviderTesterService.testConnection({
      provider: input.provider,
      apiKey: input.apiKey,
      settings: input.settings,
    });
  }),
});
