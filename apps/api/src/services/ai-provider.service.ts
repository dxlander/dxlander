/**
 * AI Provider Service
 *
 * Centralized service for managing AI provider instantiation and usage.
 * Handles encryption/decryption of credentials and provider lifecycle.
 */

import { db, schema } from '@dxlander/database'
import { eq, and } from 'drizzle-orm'
import { encryptionService, ClaudeAgentProvider } from '@dxlander/shared'
import type { IAIProvider } from '@dxlander/shared'

interface GetProviderOptions {
  userId: string
  providerId?: string // If not specified, uses default provider
}

interface ProviderConfig {
  provider: 'claude-code' | 'openai' | 'anthropic' | 'ollama' | 'lmstudio'
  apiKey?: string
  model: string
  settings?: {
    temperature?: number
    maxTokens?: number
    baseUrl?: string
  }
}

export class AIProviderService {
  /**
   * Get a provider instance for the user
   */
  static async getProvider(options: GetProviderOptions): Promise<IAIProvider> {
    const { userId, providerId } = options

    // Get provider from database
    let providerRecord
    if (providerId) {
      providerRecord = await db.query.aiProviders.findFirst({
        where: and(
          eq(schema.aiProviders.id, providerId),
          eq(schema.aiProviders.userId, userId)
        )
      })
    } else {
      // Get default provider
      providerRecord = await db.query.aiProviders.findFirst({
        where: and(
          eq(schema.aiProviders.userId, userId),
          eq(schema.aiProviders.isDefault, true),
          eq(schema.aiProviders.isActive, true)
        )
      })
    }

    if (!providerRecord) {
      throw new Error('No AI provider found. Please configure a provider in Settings.')
    }

    // Decrypt API key if present (encryption service already initialized)
    let apiKey: string | undefined
    if (providerRecord.encryptedApiKey) {
      apiKey = encryptionService.decryptFromStorage(providerRecord.encryptedApiKey)
    }

    // Parse settings
    const settings = providerRecord.settings ? JSON.parse(providerRecord.settings) : {}

    // Create provider configuration
    const config: ProviderConfig = {
      provider: providerRecord.provider as any,
      apiKey: apiKey || process.env.ANTHROPIC_API_KEY, // Fallback to env var for Claude Code
      model: settings.model || 'claude-sonnet-4-5-20250929',
      settings: {
        temperature: settings.temperature || 0.7,
        maxTokens: settings.maxTokens || 4096,
        baseUrl: settings.baseUrl
      }
    }

    // Instantiate provider
    return await this.instantiateProvider(config, providerRecord.id)
  }

  /**
   * Instantiate a provider based on configuration
   */
  private static async instantiateProvider(config: ProviderConfig, providerId: string): Promise<IAIProvider> {
    switch (config.provider) {
      case 'claude-code':
      case 'anthropic': {
        const provider = new ClaudeAgentProvider()
        await provider.initialize({
          apiKey: config.apiKey || '',
          model: config.model,
          provider: config.provider
        })

        // Update last used timestamp
        await this.updateLastUsed(providerId)

        return provider
      }

      case 'openai': {
        // TODO: Implement OpenAI provider
        throw new Error('OpenAI provider not yet implemented')
      }

      case 'ollama':
      case 'lmstudio': {
        // TODO: Implement local providers
        throw new Error('Local providers not yet implemented')
      }

      default:
        throw new Error(`Unknown provider: ${config.provider}`)
    }
  }

  /**
   * Update last used timestamp for a provider
   */
  private static async updateLastUsed(providerId: string): Promise<void> {
    try {
      // Get current usage count
      const provider = await db.query.aiProviders.findFirst({
        where: eq(schema.aiProviders.id, providerId)
      })

      await db.update(schema.aiProviders)
        .set({
          lastUsed: new Date(),
          usageCount: (provider?.usageCount || 0) + 1
        })
        .where(eq(schema.aiProviders.id, providerId))
    } catch (error) {
      console.warn('Failed to update provider usage stats:', error)
    }
  }

  /**
   * Get all active providers for a user
   */
  static async listProviders(userId: string) {
    return await db.query.aiProviders.findMany({
      where: and(
        eq(schema.aiProviders.userId, userId),
        eq(schema.aiProviders.isActive, true)
      ),
      orderBy: (aiProviders, { desc }) => [desc(aiProviders.isDefault), desc(aiProviders.createdAt)]
    })
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
      )
    })
  }
}
