/**
 * OpenAI Provider - AI SDK v6
 *
 * Dedicated provider for the official OpenAI API.
 * Extends OpenAICompatibleProvider with OpenAI-specific defaults and validation.
 *
 * Features:
 * - Pre-configured for OpenAI API endpoint
 * - API key validation (sk- prefix)
 * - Common OpenAI models list
 * - Inherits all tool-calling capabilities from BaseToolProvider
 * - Uses Chat Completions API via openai.chat() (inherited from OpenAICompatibleProvider)
 */

import { OpenAICompatibleProvider } from './openai-compatible-provider';
import type { AIProviderConfig } from '../types';

export class OpenAIProvider extends OpenAICompatibleProvider {
  override readonly name = 'openai' as const;

  /**
   * OpenAI API base URL
   */
  protected defaultBaseUrl = 'https://api.openai.com/v1';

  /**
   * Default model for OpenAI
   */
  protected defaultModel = 'gpt-4-turbo';

  /**
   * OpenAI requires an API key
   */
  protected requiresApiKey = true;

  /**
   * Initialize with OpenAI-specific validation
   */
  async initialize(config: AIProviderConfig): Promise<void> {
    // Validate API key format
    if (config.apiKey) {
      this.validateApiKey(config.apiKey);
    }

    // Use OpenAI base URL if not specified
    const configWithDefaults: AIProviderConfig = {
      ...config,
      baseUrl: config.baseUrl || this.defaultBaseUrl,
      model: config.model || this.defaultModel,
    };

    await super.initialize(configWithDefaults);
  }

  /**
   * Validate OpenAI API key format
   */
  private validateApiKey(apiKey: string): void {
    if (!apiKey) {
      throw new Error('API key is required for OpenAI');
    }

    // OpenAI keys start with sk- (or sk-proj- for project keys)
    if (!apiKey.startsWith('sk-')) {
      throw new Error('Invalid OpenAI API key format. OpenAI API keys should start with "sk-"');
    }

    if (apiKey.length < 20) {
      throw new Error('API key is too short. Please check your OpenAI API key.');
    }

    if (/\s/.test(apiKey)) {
      throw new Error('API key should not contain spaces');
    }
  }

  /**
   * Get available OpenAI models
   * Returns common models that support tool/function calling
   */
  async getAvailableModels(): Promise<string[]> {
    return ['gpt-4-turbo', 'gpt-4o', 'gpt-4o-mini', 'gpt-4', 'gpt-3.5-turbo'];
  }

  /**
   * Get detailed OpenAI models information
   */
  async getDetailedModels(): Promise<
    Array<{
      id: string;
      name: string;
      pricing: { prompt: string; completion: string };
      contextLength: number;
      isFree: boolean;
    }>
  > {
    return [
      {
        id: 'gpt-4-turbo',
        name: 'GPT-4 Turbo (Recommended)',
        pricing: { prompt: '$10.00/1M', completion: '$30.00/1M' },
        contextLength: 128000,
        isFree: false,
      },
      {
        id: 'gpt-4o',
        name: 'GPT-4o',
        pricing: { prompt: '$2.50/1M', completion: '$10.00/1M' },
        contextLength: 128000,
        isFree: false,
      },
      {
        id: 'gpt-4o-mini',
        name: 'GPT-4o Mini (Fast & Affordable)',
        pricing: { prompt: '$0.15/1M', completion: '$0.60/1M' },
        contextLength: 128000,
        isFree: false,
      },
      {
        id: 'gpt-4',
        name: 'GPT-4',
        pricing: { prompt: '$30.00/1M', completion: '$60.00/1M' },
        contextLength: 8192,
        isFree: false,
      },
      {
        id: 'gpt-3.5-turbo',
        name: 'GPT-3.5 Turbo (Budget)',
        pricing: { prompt: '$0.50/1M', completion: '$1.50/1M' },
        contextLength: 16385,
        isFree: false,
      },
    ];
  }
}
