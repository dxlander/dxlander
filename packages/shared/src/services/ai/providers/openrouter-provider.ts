/**
 * OpenRouter Provider
 *
 * Uses the OpenRouter API to access multiple AI models through a unified interface.
 */

import axios from 'axios';
import { PromptTemplates, extractJsonFromResponse, validateAnalysisResult } from '../prompts';
import type {
  AICompletionRequest,
  AICompletionResponse,
  AIProviderConfig,
  DeploymentConfigRequest,
  DeploymentConfigResult,
  IAIProvider,
  ProjectAnalysisResult,
  ProjectContext,
} from '../types';

export class OpenRouterProvider implements IAIProvider {
  readonly name = 'openrouter' as const;
  private config: AIProviderConfig | null = null;
  private ready = false;

  /**
   * Initialize the provider
   */
  async initialize(config: AIProviderConfig): Promise<void> {
    // Validate API key
    if (!config.apiKey) {
      throw new Error('API key is required for OpenRouter');
    }

    this.config = config;

    // Test connection to validate API key with timeout
    try {
      const isConnected = await Promise.race([
        this.testConnection(),
        new Promise<boolean>((resolve) => setTimeout(() => resolve(false), 10000)), // 10 second timeout
      ]);

      if (!isConnected) {
        throw new Error(
          'Failed to connect to OpenRouter API. Please check your API key and network connection.'
        );
      }
    } catch (error: any) {
      throw new Error(`Failed to initialize OpenRouter provider: ${error.message}`);
    }

    this.ready = true;
  }

  /**
   * Validate API key format and basic requirements
   */
  private validateApiKey(apiKey: string): void {
    if (!apiKey) {
      throw new Error('API key is required for OpenRouter');
    }

    // Basic validation - just check for minimum length and basic characters
    // This is more lenient to accommodate different key formats
    if (apiKey.length < 16) {
      throw new Error('API key is too short. Please check your OpenRouter API key.');
    }

    // Check for common issues like spaces or obviously invalid patterns
    if (/\s/.test(apiKey)) {
      throw new Error('API key should not contain spaces');
    }
  }

  async testConnection(): Promise<boolean> {
    if (!this.config?.apiKey) {
      console.error('API key is required');
      return false;
    }

    try {
      // First validate the API key format
      this.validateApiKey(this.config.apiKey);

      const response = await Promise.race([
        axios.get('https://openrouter.ai/api/v1/auth/key', {
          headers: {
            Authorization: `Bearer ${this.config.apiKey}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': 'https://dxlander.com',
            'X-Title': 'DXLander',
          },
          timeout: 10000, // 10 second timeout
          validateStatus: (status) => status < 500, // Don't throw for 4xx errors
        }),
        new Promise<any>((_, reject) =>
          setTimeout(() => reject(new Error('Request timeout')), 11000)
        ),
      ]);

      // Check if the response indicates an invalid key
      if (response.status === 401 || response.status === 403) {
        throw new Error('Invalid API key. Please check your OpenRouter API key.');
      }

      // For any other non-200 status, consider it a failure
      if (response.status !== 200) {
        throw new Error(`API returned status ${response.status}: ${response.statusText}`);
      }

      // If we got here, the key is valid
      return true;
    } catch (error: any) {
      console.error('OpenRouter connection test failed:', error.message || error);
      return false;
    }
  }

  /**
   * Get available models
   * Fetches dynamically from OpenRouter API instead of using hardcoded list
   */
  async getAvailableModels(): Promise<string[]> {
    // Delegate to getDetailedModels and return just the IDs
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

    // Use retry mechanism to handle rate limiting
    return this.withRetry(async () => {
      try {
        const response = await Promise.race([
          axios.get('https://openrouter.ai/api/v1/models', {
            headers: {
              Authorization: `Bearer ${this.config!.apiKey}`,
            },
            timeout: 10000, // 10 second timeout
          }),
          new Promise<any>((_, reject) =>
            setTimeout(() => reject(new Error('Request timeout')), 11000)
          ),
        ]);

        const models = response.data.data || [];

        // Filter models to include only those useful for code-related tasks
        const codeCapableModels = models
          .filter((model: any) => {
            // Skip models that are primarily for image generation
            if (
              model.id.includes('image') ||
              model.id.includes('vision') ||
              model.id.includes('dall-e') ||
              model.id.includes('stable-diffusion') ||
              model.id.includes('imagen') ||
              model.id.includes('midjourney')
            ) {
              return false;
            }

            // Skip models that are explicitly for audio/voice
            if (
              model.id.includes('audio') ||
              model.id.includes('voice') ||
              model.id.includes('whisper') ||
              model.id.includes('speech') ||
              model.id.includes('tts')
            ) {
              return false;
            }

            // Skip models that are explicitly for embedding-only tasks
            if (
              (model.id.includes('embed') && !model.id.includes('chat')) ||
              model.id.includes('embedding') ||
              model.id.includes('retrieval')
            ) {
              return false;
            }

            // Include models with sufficient context length (at least 4k tokens)
            const contextLength = model.context_length || 0;
            if (contextLength < 4096) {
              return false;
            }

            // Include models that are known to be good for coding tasks
            const codingModelIndicators = [
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

            // Check if model name contains any coding indicators or if it's in our preferred list
            const isCodingModel = codingModelIndicators.some(
              (indicator) =>
                model.id.toLowerCase().includes(indicator) ||
                model.name.toLowerCase().includes(indicator)
            );

            // Also include models that have "chat" in their name (as they're likely conversational)
            const isChatModel = model.id.includes('chat') || model.name.includes('Chat');

            return isCodingModel || isChatModel;
          })
          .map((model: any) => {
            // Determine if model is free based on pricing
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
            // Sort free models first, then by name
            if (a.isFree && !b.isFree) return -1;
            if (!a.isFree && b.isFree) return 1;
            return a.name.localeCompare(b.name);
          });

        return codeCapableModels;
      } catch (error: any) {
        console.error('Failed to fetch OpenRouter models:', error.message || error);
        // Check if the response data is a string (not JSON)
        if (error.response && typeof error.response.data === 'string') {
          throw new Error(
            `Failed to fetch models: ${error.response.status} - ${error.response.data}`
          );
        } else if (error.response) {
          throw new Error(
            `Failed to fetch models: ${error.response.status} - ${error.response.data?.message || error.response.statusText}`
          );
        } else {
          throw new Error(`Failed to fetch models: ${error.message || 'Unknown error'}`);
        }
      }
    }, 3); // Use fewer retries for model fetching
  }

  /**
   * Send a chat completion request
   */
  async chat(request: AICompletionRequest): Promise<AICompletionResponse> {
    if (!this.ready || !this.config) {
      throw new Error('Provider not initialized');
    }

    return this.withRetry(async () => {
      const messages = request.messages.map((msg) => ({
        role: msg.role,
        content: msg.content,
      }));

      const response = await Promise.race([
        axios.post(
          'https://openrouter.ai/api/v1/chat/completions',
          {
            model: request.model || this.config!.model,
            messages: messages,
            temperature: request.temperature || 0.7,
            max_tokens: request.maxTokens || 1000,
          },
          {
            headers: {
              Authorization: `Bearer ${this.config!.apiKey}`,
              'HTTP-Referer': 'https://dxlander.com',
              'X-Title': 'DXLander',
              'Content-Type': 'application/json',
            },
            timeout: 30000, // 30 second timeout for chat
          }
        ),
        new Promise<any>((_, reject) =>
          setTimeout(() => reject(new Error('Chat request timeout after 30 seconds')), 31000)
        ),
      ]);

      const data = response.data;

      // Check if response is valid
      if (!data || !data.choices || data.choices.length === 0) {
        throw new Error(`OpenRouter API returned invalid response: ${JSON.stringify(data)}`);
      }

      const choice = data.choices[0];
      if (!choice || !choice.message || !choice.message.content) {
        throw new Error(`OpenRouter API returned empty message content: ${JSON.stringify(choice)}`);
      }

      return {
        content: choice.message.content,
        finishReason: choice.finish_reason,
        model: data.model,
        usage: {
          promptTokens: data.usage?.prompt_tokens || 0,
          completionTokens: data.usage?.completion_tokens || 0,
          totalTokens: data.usage?.total_tokens || 0,
        },
      };
    });
  }

  /**
   * Analyze a project
   */
  async analyzeProject(context: ProjectContext): Promise<ProjectAnalysisResult> {
    if (!this.ready || !this.config) {
      throw new Error('Provider not initialized');
    }

    return this.withRetry(async () => {
      // Use centralized prompt template
      const analysisPrompt = PromptTemplates.buildAnalysisPrompt(context);

      // Add system prompt
      const systemPrompt = PromptTemplates.getAnalysisSystemPrompt();

      // Send request to OpenRouter API with timeout
      const response = await Promise.race([
        axios.post(
          'https://openrouter.ai/api/v1/chat/completions',
          {
            model: this.config!.model,
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: analysisPrompt },
            ],
            temperature: 0.7,
            max_tokens: 4000,
          },
          {
            headers: {
              Authorization: `Bearer ${this.config!.apiKey}`,
              'HTTP-Referer': 'https://dxlander.com',
              'X-Title': 'DXLander',
              'Content-Type': 'application/json',
            },
            timeout: 60000, // 60 second timeout for analysis
          }
        ),
        new Promise<any>((_, reject) =>
          setTimeout(() => reject(new Error('Analysis request timeout after 60 seconds')), 61000)
        ),
      ]);

      const data = response.data;

      // Check if response is valid
      if (!data || !data.choices || data.choices.length === 0) {
        throw new Error(
          `OpenRouter API returned invalid response for project analysis: ${JSON.stringify(data)}`
        );
      }

      const choice = data.choices[0];
      const analysisJson = choice.message?.content;

      // Check for empty or whitespace-only responses
      if (!analysisJson || analysisJson.trim().length === 0) {
        // Log more detailed information about the response
        const modelInfo = data.model || this.config!.model || 'unknown';
        const providerInfo = (data as any).provider || 'unknown';
        const usageInfo = data.usage
          ? `Prompt tokens: ${data.usage.prompt_tokens}, Completion tokens: ${data.usage.completion_tokens}`
          : 'No usage info';

        throw new Error(
          `OpenRouter API returned empty or whitespace-only response for project analysis. Model: ${modelInfo}, Provider: ${providerInfo}, Usage: ${usageInfo}. Response: ${JSON.stringify(data)}`
        );
      }

      // Parse and validate
      const analysisResult = extractJsonFromResponse(analysisJson);

      if (!validateAnalysisResult(analysisResult)) {
        throw new Error(
          `Analysis result does not match expected structure. Response: ${analysisJson}`
        );
      }

      return analysisResult;
    });
  }

  /**
   * Generate deployment configuration
   */
  async generateDeploymentConfig(
    request: DeploymentConfigRequest
  ): Promise<DeploymentConfigResult> {
    if (!this.ready || !this.config) {
      throw new Error('Provider not initialized');
    }

    return this.withRetry(async () => {
      // Use centralized prompt template
      const configPrompt = PromptTemplates.buildConfigPrompt(request);

      // Add system prompt
      const systemPrompt = PromptTemplates.getConfigGenerationSystemPrompt();

      // Send request to OpenRouter API with timeout
      const response = await Promise.race([
        axios.post(
          'https://openrouter.ai/api/v1/chat/completions',
          {
            model: this.config!.model,
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: configPrompt },
            ],
            temperature: 0.7,
            max_tokens: 4000,
          },
          {
            headers: {
              Authorization: `Bearer ${this.config!.apiKey}`,
              'HTTP-Referer': 'https://dxlander.com',
              'X-Title': 'DXLander',
              'Content-Type': 'application/json',
            },
            timeout: 60000, // 60 second timeout for config generation
          }
        ),
        new Promise<any>((_, reject) =>
          setTimeout(
            () => reject(new Error('Config generation request timeout after 60 seconds')),
            61000
          )
        ),
      ]);

      const data = response.data;

      // Check if response is valid
      if (!data || !data.choices || data.choices.length === 0) {
        throw new Error(
          `OpenRouter API returned invalid response for deployment config: ${JSON.stringify(data)}`
        );
      }

      const choice = data.choices[0];
      const configJson = choice.message?.content;

      // Check for empty or whitespace-only responses
      if (!configJson || configJson.trim().length === 0) {
        // Log more detailed information about the response
        const modelInfo = data.model || this.config!.model || 'unknown';
        const providerInfo = (data as any).provider || 'unknown';
        const usageInfo = data.usage
          ? `Prompt tokens: ${data.usage.prompt_tokens}, Completion tokens: ${data.usage.completion_tokens}`
          : 'No usage info';

        throw new Error(
          `OpenRouter API returned empty or whitespace-only response for deployment config. Model: ${modelInfo}, Provider: ${providerInfo}, Usage: ${usageInfo}. Response: ${JSON.stringify(data)}`
        );
      }

      // Parse and validate
      const configResult = extractJsonFromResponse(configJson);

      // Basic validation for deployment config result
      if (!configResult || typeof configResult !== 'object') {
        throw new Error(`Deployment config result is not a valid object. Response: ${configJson}`);
      }

      // Ensure configResult has the required configType property
      if (!configResult.configType) {
        configResult.configType = request.configType;
      }

      return configResult;
    });
  }

  /**
   * Utility method to handle retries with exponential backoff for rate limiting
   */
  private async withRetry<T>(operation: () => Promise<T>, maxRetries: number = 5): Promise<T> {
    let lastError: any;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error: any) {
        lastError = error;

        // If this is the last attempt, throw the error
        if (attempt === maxRetries) {
          throw error;
        }

        // Check if this is a rate limit error (429)
        if (error.response?.status === 429) {
          // Check for rate limit reset time in headers
          let delay = Math.pow(2, attempt) * 2000; // Base exponential backoff

          // OpenRouter may provide rate limit reset info in headers
          const resetHeader =
            error.response.headers['x-ratelimit-reset'] ||
            error.response.headers['retry-after'] ||
            error.response.headers['x-ratelimit-reset-tokens'] ||
            error.response.headers['x-ratelimit-reset-requests'];

          if (resetHeader) {
            try {
              // Handle different header formats
              if (resetHeader.includes('-')) {
                // It's a date string, parse it
                const resetDate = new Date(resetHeader);
                const now = new Date();
                if (resetDate > now) {
                  delay = resetDate.getTime() - now.getTime();
                  // Add some buffer time
                  delay += 1000 + Math.random() * 2000;
                }
              } else {
                // If it's a timestamp, calculate delay
                const resetTime = parseInt(resetHeader);
                if (!isNaN(resetTime)) {
                  const now = Date.now() / 1000; // Convert to seconds
                  if (resetTime > now) {
                    delay = (resetTime - now) * 1000; // Convert to milliseconds
                    // Add some buffer time
                    delay += 1000 + Math.random() * 2000;
                  }
                }
              }
            } catch (parseError) {
              // If parsing fails, fall back to exponential backoff
              console.warn('Failed to parse rate limit reset header:', parseError);
            }
          }

          // If we still have the default delay, use a longer base delay for rate limits
          if (delay === Math.pow(2, attempt) * 2000) {
            delay = Math.pow(2, attempt) * 5000; // 5 seconds base for rate limits
          }

          // Cap the delay to prevent excessive waiting but allow for longer waits for rate limits
          delay = Math.min(delay, 120000); // Max 2 minutes for rate limits

          // Add some random jitter to prevent thundering herd (1-3 seconds)
          const jitter = 1000 + Math.random() * 2000;

          console.log(
            `OpenRouter rate limit hit. Retrying in ${Math.round((delay + jitter) / 1000)} seconds (attempt ${attempt + 1}/${maxRetries + 1})`
          );

          // Wait before retrying
          await new Promise((resolve) => setTimeout(resolve, delay + jitter));
        } else if (error.response?.status >= 400 && error.response?.status < 500) {
          // For client errors (4xx), don't retry as they won't succeed
          throw error;
        } else if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
          // Handle timeout errors with shorter delays
          const delay = 2000 + Math.random() * 1000;
          console.log(
            `OpenRouter timeout error: ${error.message}. Retrying in ${Math.round(delay)}ms (attempt ${attempt + 1}/${maxRetries + 1})`
          );
          await new Promise((resolve) => setTimeout(resolve, delay));
        } else {
          // For other errors, use a moderate delay before retrying
          const delay = 2000 + Math.random() * 2000;
          console.log(
            `OpenRouter API error: ${error.message}. Retrying in ${Math.round(delay)}ms (attempt ${attempt + 1}/${maxRetries + 1})`
          );
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }

    throw lastError;
  }

  /**
   * Check if provider is ready
   */
  isReady(): boolean {
    return this.ready && this.config !== null;
  }
}
