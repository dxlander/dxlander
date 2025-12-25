/**
 * OpenAI Compatible Provider - AI SDK v6
 *
 * Base provider for any service implementing the OpenAI API specification.
 * This includes OpenAI, LM Studio, Ollama, vLLM, LocalAI, and many others.
 *
 * Features:
 * - Configurable base URL for any compatible endpoint
 * - Optional API key (supports local models without authentication)
 * - Optional custom headers for provider-specific requirements
 * - Extends BaseToolProvider for unified tool-calling capabilities
 *
 * AI SDK v6 Note:
 * Uses openai.chat() instead of openai() to force the Chat Completions API.
 * This is required because AI SDK v6 defaults to the new Responses API,
 * which is not supported by most OpenAI-compatible servers (LM Studio, Ollama, etc.)
 */

import { createOpenAI } from '@ai-sdk/openai';
import type { LanguageModel } from 'ai';
import { BaseToolProvider } from './base-tool-provider';
import type { AIProviderConfig } from '../types';

export class OpenAICompatibleProvider extends BaseToolProvider {
  readonly name: 'openai-compatible' | 'openai' | 'lmstudio' | 'ollama' = 'openai-compatible';

  /**
   * Default base URL - subclasses can override
   * For the generic compatible provider, this must be configured
   */
  protected defaultBaseUrl = '';

  /**
   * Default model - subclasses can override
   * For the generic compatible provider, this must be configured
   */
  protected defaultModel = '';

  /**
   * Whether API key is required - subclasses can override
   * Default is false for maximum compatibility with local models
   */
  protected requiresApiKey = false;

  /**
   * Get the base URL to use
   */
  protected getBaseUrl(): string {
    return this.config?.baseUrl || this.config?.settings?.baseUrl || this.defaultBaseUrl;
  }

  /**
   * Get the model to use
   */
  protected getModel(): string {
    return this.config?.model || this.config?.settings?.model || this.defaultModel;
  }

  /**
   * Get custom headers if configured
   */
  protected getCustomHeaders(): Record<string, string> | undefined {
    return this.config?.settings?.headers;
  }

  /**
   * Initialize the provider
   * Override to allow optional API key
   */
  async initialize(config: AIProviderConfig): Promise<void> {
    const baseUrl = config.baseUrl || config.settings?.baseUrl || this.defaultBaseUrl;

    if (!baseUrl) {
      throw new Error(`Base URL is required for ${this.name}`);
    }

    const model = config.model || config.settings?.model || this.defaultModel;
    if (!model) {
      throw new Error(`Model is required for ${this.name}`);
    }

    if (this.requiresApiKey && !config.apiKey) {
      throw new Error(`API key is required for ${this.name}`);
    }

    this.config = config;

    // Test connection
    const isConnected = await this.testConnection();
    if (!isConnected) {
      throw new Error(`Failed to connect to ${this.name} API. Please check your configuration.`);
    }

    this.ready = true;
  }

  /**
   * Get the language model instance
   *
   * Uses openai.chat() to force the Chat Completions API instead of the
   * Responses API (which is the default in AI SDK v6). This is required
   * for compatibility with most OpenAI-compatible servers.
   */
  async getLanguageModel(): Promise<LanguageModel> {
    if (!this.config) {
      throw new Error('Provider not initialized');
    }

    const baseUrl = this.getBaseUrl();
    const model = this.getModel();
    const headers = this.getCustomHeaders();

    const openai = createOpenAI({
      baseURL: baseUrl,
      apiKey: this.config.apiKey || '', // Empty string for local models that don't require auth
      headers,
    });

    // Use .chat() to force Chat Completions API instead of Responses API
    // This is required for LM Studio, Ollama, vLLM, and other OpenAI-compatible servers
    return openai.chat(model);
  }

  /**
   * Test connection to the API
   */
  async testConnection(): Promise<boolean> {
    if (!this.config) {
      console.error('Provider not configured');
      return false;
    }

    const baseUrl = this.getBaseUrl();
    if (!baseUrl) {
      console.error('Base URL is required');
      return false;
    }

    try {
      // Test with a simple chat completion
      const result = await this.chat({
        messages: [{ role: 'user', content: 'test' }],
        maxTokens: 1,
      });

      return !!result.content || result.content === '';
    } catch (error: any) {
      console.error(`${this.name} connection test failed:`, error.message || error);
      return false;
    }
  }

  /**
   * Validate base URL format
   */
  protected validateBaseUrl(baseUrl: string): void {
    if (!baseUrl) {
      throw new Error('Base URL is required');
    }

    try {
      new URL(baseUrl);
    } catch {
      throw new Error(`Invalid base URL format: ${baseUrl}`);
    }
  }

  /**
   * Get available models
   * Returns the configured model only (per user decision)
   */
  async getAvailableModels(): Promise<string[]> {
    const model = this.getModel();
    return model ? [model] : [];
  }

  /**
   * Get detailed models information
   * Returns basic info for the configured model
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
    const model = this.getModel();
    if (!model) {
      return [];
    }

    return [
      {
        id: model,
        name: model,
        pricing: { prompt: 'N/A', completion: 'N/A' },
        contextLength: 0, // Unknown for generic compatible providers
        isFree: false, // Unknown
      },
    ];
  }
}
