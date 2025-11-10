/**
 * AI Provider Service
 *
 * Centralized service for managing AI provider instantiation and usage.
 * Handles encryption/decryption of credentials and provider lifecycle.
 */

import { db, schema } from '@dxlander/database';
import {
  ClaudeAgentProvider,
  encryptionService,
  GroqProvider,
  OpenRouterProvider,
  type IAIProvider,
} from '@dxlander/shared';
import { and, eq, gte } from 'drizzle-orm';

interface GetProviderOptions {
  userId: string;
  providerId?: string; // If not specified, uses default provider
}

interface ProviderConfig {
  provider: 'claude-code' | 'openai' | 'anthropic' | 'ollama' | 'lmstudio' | 'openrouter' | 'groq';
  apiKey?: string;
  model: string;
  settings?: {
    temperature?: number;
    maxTokens?: number;
    baseUrl?: string;
  };
}

export class AIProviderService {
  /**
   * Get a provider instance for the user
   */
  static async getProvider(options: GetProviderOptions): Promise<IAIProvider> {
    const { userId, providerId } = options;

    // Get provider from database
    let providerRecord;
    if (providerId) {
      providerRecord = await db.query.aiProviders.findFirst({
        where: and(eq(schema.aiProviders.id, providerId), eq(schema.aiProviders.userId, userId)),
      });
    } else {
      // Get default provider
      providerRecord = await db.query.aiProviders.findFirst({
        where: and(
          eq(schema.aiProviders.userId, userId),
          eq(schema.aiProviders.isDefault, true),
          eq(schema.aiProviders.isActive, true)
        ),
      });
    }

    if (!providerRecord) {
      throw new Error('No AI provider found. Please configure a provider in Settings.');
    }

    // Decrypt API key if present (encryption service already initialized)
    let apiKey: string | undefined;
    if (providerRecord.encryptedApiKey) {
      apiKey = encryptionService.decryptFromStorage(providerRecord.encryptedApiKey);
    }

    // Parse settings
    const settings = providerRecord.settings ? JSON.parse(providerRecord.settings) : {};

    // Validate that required settings exist
    if (!settings.model) {
      throw new Error(`Model is required for ${providerRecord.provider} provider`);
    }

    // Create provider configuration
    const config: ProviderConfig = {
      provider: providerRecord.provider as any,
      apiKey: apiKey,
      model: settings.model,
      settings: {
        temperature: settings.temperature || 0.7,
        maxTokens: settings.maxTokens || 4096,
        baseUrl: settings.baseUrl,
      },
    };

    // Instantiate provider with timeout
    try {
      const provider = await Promise.race([
        this.instantiateProvider(config, providerRecord.id),
        new Promise<IAIProvider>((_, reject) =>
          setTimeout(
            () => reject(new Error('Provider initialization timed out after 15 seconds')),
            15000
          )
        ),
      ]);
      return provider;
    } catch (error: any) {
      throw new Error(`Failed to initialize ${providerRecord.provider} provider: ${error.message}`);
    }
  }

  /**
   * Instantiate a provider based on configuration
   */
  private static async instantiateProvider(
    config: ProviderConfig,
    providerId: string
  ): Promise<IAIProvider> {
    switch (config.provider) {
      case 'claude-code':
      case 'anthropic': {
        const provider = new ClaudeAgentProvider();
        await provider.initialize({
          apiKey: config.apiKey || '',
          model: config.model,
          provider: config.provider,
        });

        // Update last used timestamp
        await this.updateLastUsed(providerId);

        return provider;
      }

      case 'openai': {
        // TODO: Implement OpenAI provider
        throw new Error('OpenAI provider not yet implemented');
      }

      case 'openrouter': {
        const provider = new OpenRouterProvider();
        await provider.initialize({
          apiKey: config.apiKey || '',
          model: config.model,
          provider: config.provider,
        });

        // Update last used timestamp
        await this.updateLastUsed(providerId);

        return provider;
      }

      case 'groq': {
        const provider = new GroqProvider();
        await provider.initialize({
          apiKey: config.apiKey || '',
          model: config.model,
          provider: config.provider,
          settings: config.settings,
        });
        await this.updateLastUsed(providerId);
        return provider;
      }

      case 'ollama':
      case 'lmstudio': {
        // TODO: Implement local providers
        throw new Error('Local providers not yet implemented');
      }

      default:
        throw new Error(`Unknown provider: ${config.provider}`);
    }
  }

  /**
   * Update last used timestamp for a provider
   */
  private static async updateLastUsed(providerId: string): Promise<void> {
    try {
      // Get current usage count
      const provider = await db.query.aiProviders.findFirst({
        where: eq(schema.aiProviders.id, providerId),
      });

      await db
        .update(schema.aiProviders)
        .set({
          lastUsed: new Date(),
          usageCount: (provider?.usageCount || 0) + 1,
        })
        .where(eq(schema.aiProviders.id, providerId));
    } catch (error) {
      console.warn('Failed to update provider usage stats:', error);
    }
  }

  /**
   * Get all active providers for a user
   */
  static async listProviders(userId: string) {
    return await db.query.aiProviders.findMany({
      where: and(eq(schema.aiProviders.userId, userId), eq(schema.aiProviders.isActive, true)),
      orderBy: (aiProviders, { desc }) => [
        desc(aiProviders.isDefault),
        desc(aiProviders.createdAt),
      ],
    });
  }

  /**
   * Check if the user has exceeded the rate limit for Groq provider
   * 1 project every 3 hours
   */
  static async checkGroqRateLimit(userId: string): Promise<boolean> {
    // Get the default Groq provider for the user
    const groqProvider = await db.query.aiProviders.findFirst({
      where: and(
        eq(schema.aiProviders.userId, userId),
        eq(schema.aiProviders.provider, 'groq'),
        eq(schema.aiProviders.isActive, true)
      ),
    });

    if (!groqProvider) {
      // No Groq provider configured, no rate limit
      return false;
    }

    // Check if there's been an analysis in the last 3 hours
    const threeHoursAgo = new Date(Date.now() - 3 * 60 * 60 * 1000);

    // Look for recent analysis runs using Groq
    const recentAnalysis = await db.query.analysisRuns.findFirst({
      where: and(
        eq(schema.analysisRuns.userId, userId),
        eq(schema.analysisRuns.aiProvider, 'groq'),
        gte(schema.analysisRuns.startedAt, threeHoursAgo)
      ),
      orderBy: (analysisRuns, { desc }) => [desc(analysisRuns.startedAt)],
    });

    // If there's a recent analysis, they're rate limited
    return !!recentAnalysis;
  }

  /**
   * Check if the token limit would be exceeded
   * Max 15,000 tokens per run
   */
  static checkTokenLimit(config: ProviderConfig): boolean {
    if (config.provider !== 'groq') {
      return false; // Only apply to Groq provider
    }

    // Check if maxTokens exceeds the limit
    const maxTokens = config.settings?.maxTokens || 4096;
    return maxTokens > 15000;
  }

  /**
   * Get default provider for a user
   */
  static async getDefaultProvider(userId: string) {
    return await db.query.aiProviders.findFirst({
      where: and(
        eq(schema.aiProviders.userId, userId),
        eq(schema.aiProviders.isDefault, true),
        eq(schema.aiProviders.isActive, true)
      ),
    });
  }
}
