/**
 * OpenRouter Provider - AI SDK v6
 *
 * Uses the official @openrouter/ai-sdk-provider for proper integration.
 * Extends BaseToolProvider for unified tool-calling capabilities.
 *
 * Note: The @openrouter/ai-sdk-provider package has a peer dependency on ai@^5.0.0
 * but works with v6 since the core LanguageModel interface is stable.
 */

import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import type { LanguageModel } from 'ai';
import axios from 'axios';
import { BaseToolProvider } from './base-tool-provider';

export class OpenRouterProvider extends BaseToolProvider {
  readonly name = 'openrouter' as const;

  /**
   * Get the OpenRouter language model using official SDK
   */
  async getLanguageModel(): Promise<LanguageModel> {
    if (!this.config) {
      throw new Error('Provider not initialized');
    }

    const openrouter = createOpenRouter({
      apiKey: this.config.apiKey,
    });

    return openrouter(this.config.model || 'anthropic/claude-3.5-sonnet');
  }

  /**
   * Test connection to OpenRouter API
   */
  async testConnection(): Promise<boolean> {
    if (!this.config?.apiKey) {
      console.error('API key is required');
      return false;
    }

    try {
      // Validate API key format
      this.validateApiKey(this.config.apiKey);

      const response = await Promise.race([
        axios.get('https://openrouter.ai/api/v1/auth/key', {
          headers: {
            Authorization: `Bearer ${this.config.apiKey}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': 'https://dxlander.com',
            'X-Title': 'DXLander',
          },
          timeout: 10000,
          validateStatus: (status) => status < 500,
        }),
        new Promise<any>((_, reject) =>
          setTimeout(() => reject(new Error('Request timeout')), 11000)
        ),
      ]);

      if (response.status === 401 || response.status === 403) {
        throw new Error('Invalid API key. Please check your OpenRouter API key.');
      }

      if (response.status !== 200) {
        throw new Error(`API returned status ${response.status}: ${response.statusText}`);
      }

      return true;
    } catch (error: any) {
      console.error('OpenRouter connection test failed:', error.message || error);
      return false;
    }
  }

  /**
   * Validate API key format
   */
  private validateApiKey(apiKey: string): void {
    if (!apiKey) {
      throw new Error('API key is required for OpenRouter');
    }

    if (apiKey.length < 16) {
      throw new Error('API key is too short. Please check your OpenRouter API key.');
    }

    if (/\s/.test(apiKey)) {
      throw new Error('API key should not contain spaces');
    }
  }

  /**
   * Get available models (fetch from OpenRouter API)
   */
  async getAvailableModels(): Promise<string[]> {
    const detailedModels = await this.getDetailedModels();
    return detailedModels.map((model) => model.id);
  }

  /**
   * Get detailed model information with pricing
   * Returns only models that are useful for code-related tasks
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
    if (!this.ready || !this.config) {
      throw new Error('Provider not initialized');
    }

    return this.withRetry(async () => {
      try {
        const response = await Promise.race([
          axios.get('https://openrouter.ai/api/v1/models', {
            headers: {
              Authorization: `Bearer ${this.config!.apiKey}`,
            },
            timeout: 10000,
          }),
          new Promise<any>((_, reject) =>
            setTimeout(() => reject(new Error('Request timeout')), 11000)
          ),
        ]);

        const models = response.data.data || [];

        // Filter models to include only those useful for code-related tasks
        const codeCapableModels = models
          .filter((model: any) => {
            // CRITICAL: Only include models that support tool/function calling
            // This is required for our project analysis workflow
            const supportsTools =
              model.supported_parameters?.includes('tools') ||
              model.supported_parameters?.includes('function_call') ||
              model.supported_parameters?.includes('functions');

            if (!supportsTools) {
              return false;
            }

            // Skip image/vision models
            if (
              model.id.includes('image') ||
              model.id.includes('vision') ||
              model.id.includes('dall-e') ||
              model.id.includes('stable-diffusion')
            ) {
              return false;
            }

            // Skip audio models
            if (
              model.id.includes('audio') ||
              model.id.includes('voice') ||
              model.id.includes('whisper')
            ) {
              return false;
            }

            // Skip embedding-only models
            if (model.id.includes('embed') && !model.id.includes('chat')) {
              return false;
            }

            // Require at least 4k context
            if ((model.context_length || 0) < 4096) {
              return false;
            }

            // Include coding models
            const codingIndicators = [
              'claude',
              'gpt',
              'codestral',
              'deepseek',
              'code',
              'gemini',
              'grok',
              'llama',
              'mistral',
              'wizard',
              'starling',
              'yi',
              'mixtral',
              'solar',
              'dolphin',
              'nous',
              'openhermes',
            ];

            const isCodingModel = codingIndicators.some(
              (indicator) =>
                model.id.toLowerCase().includes(indicator) ||
                model.name.toLowerCase().includes(indicator)
            );

            const isChatModel = model.id.includes('chat') || model.name.includes('Chat');

            return isCodingModel || isChatModel;
          })
          .map((model: any) => {
            const isFree = model.pricing?.prompt === '0' && model.pricing?.completion === '0';

            return {
              id: model.id,
              name: model.name,
              pricing: model.pricing || { prompt: 'N/A', completion: 'N/A' },
              contextLength: model.context_length || 0,
              isFree,
            };
          })
          .sort((a: any, b: any) => {
            // Sort free models first
            if (a.isFree && !b.isFree) return -1;
            if (!a.isFree && b.isFree) return 1;
            return a.name.localeCompare(b.name);
          });

        return codeCapableModels;
      } catch (error: any) {
        console.error('Failed to fetch OpenRouter models:', error.message || error);
        throw new Error(`Failed to fetch models: ${error.message || 'Unknown error'}`);
      }
    }, 3);
  }

  /**
   * Retry helper for rate limiting
   */
  private async withRetry<T>(operation: () => Promise<T>, maxRetries: number = 5): Promise<T> {
    let lastError: any;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error: any) {
        lastError = error;

        if (attempt === maxRetries) {
          throw error;
        }

        // Check if this is a rate limit error (429)
        if (error.response?.status === 429) {
          let delay = Math.pow(2, attempt) * 2000;

          const resetHeader =
            error.response.headers['x-ratelimit-reset'] || error.response.headers['retry-after'];

          if (resetHeader) {
            try {
              if (resetHeader.includes('-')) {
                const resetDate = new Date(resetHeader);
                const now = new Date();
                if (resetDate > now) {
                  delay = resetDate.getTime() - now.getTime() + 1000;
                }
              } else {
                const resetTime = parseInt(resetHeader);
                if (!isNaN(resetTime)) {
                  const now = Date.now() / 1000;
                  if (resetTime > now) {
                    delay = (resetTime - now) * 1000 + 1000;
                  }
                }
              }
            } catch {
              // Ignore parse errors for rate limit header
            }
          }

          delay = Math.min(delay, 120000); // Max 2 minutes
          const jitter = 1000 + Math.random() * 2000;
          await new Promise((resolve) => setTimeout(resolve, delay + jitter));
        } else if (error.response?.status >= 400 && error.response?.status < 500) {
          // Don't retry client errors
          throw error;
        } else {
          // Retry with moderate delay
          const delay = 2000 + Math.random() * 2000;
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }

    throw lastError;
  }
}
