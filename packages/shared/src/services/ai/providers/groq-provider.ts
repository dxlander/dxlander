/**
 * Groq Provider - AI SDK v6
 *
 * Uses the official @ai-sdk/groq for proper integration.
 * Extends BaseToolProvider for unified tool-calling capabilities.
 */

import { createGroq } from '@ai-sdk/groq';
import type { LanguageModel } from 'ai';
import { BaseToolProvider } from './base-tool-provider';

export class GroqProvider extends BaseToolProvider {
  readonly name = 'groq' as const;

  /**
   * Get the Groq language model using official SDK
   */
  async getLanguageModel(): Promise<LanguageModel> {
    if (!this.config) {
      throw new Error('Provider not initialized');
    }

    const groq = createGroq({
      apiKey: this.config.apiKey,
    });

    return groq(this.config.model || 'llama-3.3-70b-versatile');
  }

  /**
   * Test connection to Groq API
   */
  async testConnection(): Promise<boolean> {
    if (!this.config?.apiKey) {
      console.error('API key is required');
      return false;
    }

    try {
      // Validate API key format
      this.validateApiKey(this.config.apiKey);

      // Make a simple chat request to test the API key
      const result = await this.chat({
        messages: [{ role: 'user', content: 'test' }],
        maxTokens: 1,
      });

      return !!result.content;
    } catch (error: any) {
      console.error('Groq connection test failed:', error.message || error);
      return false;
    }
  }

  /**
   * Validate API key format
   */
  private validateApiKey(apiKey: string): void {
    if (!apiKey) {
      throw new Error('API key is required for Groq');
    }

    if (apiKey.length < 16) {
      throw new Error('API key is too short. Please check your Groq API key.');
    }

    if (/\s/.test(apiKey)) {
      throw new Error('API key should not contain spaces');
    }
  }

  /**
   * Get available models
   * NOTE: Only models that support tool/function calling are included
   */
  async getAvailableModels(): Promise<string[]> {
    return [
      'llama-3.3-70b-versatile', // Supports tools ✅
      'llama-3.1-70b-versatile', // Supports tools ✅
      'llama-3.1-8b-instant', // Supports tools ✅
      'mixtral-8x7b-32768', // Supports tools ✅
      'gemma2-9b-it', // Supports tools ✅
    ];
  }

  /**
   * Get detailed models information
   * NOTE: Only models that support tool/function calling are included
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
        id: 'llama-3.3-70b-versatile',
        name: 'LLaMA 3.3 70B Versatile (Recommended)',
        pricing: { prompt: 'Free', completion: 'Free' },
        contextLength: 131072,
        isFree: true,
      },
      {
        id: 'llama-3.1-70b-versatile',
        name: 'LLaMA 3.1 70B Versatile',
        pricing: { prompt: 'Free', completion: 'Free' },
        contextLength: 131072,
        isFree: true,
      },
      {
        id: 'llama-3.1-8b-instant',
        name: 'LLaMA 3.1 8B Instant (Fast)',
        pricing: { prompt: 'Free', completion: 'Free' },
        contextLength: 131072,
        isFree: true,
      },
      {
        id: 'mixtral-8x7b-32768',
        name: 'Mixtral 8x7B',
        pricing: { prompt: 'Free', completion: 'Free' },
        contextLength: 32768,
        isFree: true,
      },
      {
        id: 'gemma2-9b-it',
        name: 'Gemma 2 9B IT',
        pricing: { prompt: 'Free', completion: 'Free' },
        contextLength: 8192,
        isFree: true,
      },
    ];
  }
}
