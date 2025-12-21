/**
 * AI Provider Tester Service
 *
 * Clean, maintainable provider testing with a registry pattern.
 * Each provider has its own dedicated testing logic.
 */

import {
  ClaudeAgentProvider,
  type ProviderTestResult,
  type ProviderTestConfig,
} from '@dxlander/shared';

/**
 * Base provider tester interface
 */
interface IProviderTester {
  test(config: ProviderTestConfig): Promise<ProviderTestResult>;
  validateConfig(config: ProviderTestConfig): void;
}

/**
 * Claude Agent SDK Provider Tester
 */
class ClaudeAgentTester implements IProviderTester {
  validateConfig(config: ProviderTestConfig): void {
    if (!config.apiKey) {
      throw new Error('API key is required for Claude Agent SDK');
    }

    if (!config.settings?.model) {
      throw new Error('Model selection is required for Claude Agent SDK');
    }
  }

  async test(config: ProviderTestConfig): Promise<ProviderTestResult> {
    this.validateConfig(config);

    try {
      const provider = new ClaudeAgentProvider();

      await provider.initialize({
        apiKey: config.apiKey!,
        model: config.settings!.model!,
        provider: 'claude-code',
      });

      const isConnected = await provider.testConnection();

      if (!isConnected) {
        throw new Error('API returned an error response');
      }

      return {
        success: true,
        message: 'Successfully connected to Claude Agent SDK',
        model: config.settings!.model!,
        details: {
          provider: 'claude-code',
          modelTested: config.settings!.model!,
          timestamp: new Date().toISOString(),
        },
      };
    } catch (error: any) {
      throw new Error(`Claude Agent SDK connection failed: ${error.message}`);
    }
  }
}

/**
 * OpenAI Compatible Provider Tester
 * Tests any OpenAI-compatible API endpoint
 */
class OpenAICompatibleTester implements IProviderTester {
  validateConfig(config: ProviderTestConfig): void {
    if (!config.settings?.baseUrl) {
      throw new Error('Base URL is required for OpenAI Compatible provider');
    }

    try {
      new URL(config.settings.baseUrl);
    } catch {
      throw new Error('Invalid base URL format');
    }

    if (!config.settings?.model) {
      throw new Error('Model selection is required for OpenAI Compatible provider');
    }
  }

  async test(config: ProviderTestConfig): Promise<ProviderTestResult> {
    this.validateConfig(config);

    const model = config.settings!.model!;
    const baseUrl = config.settings!.baseUrl!;

    try {
      // Dynamically import to avoid circular dependencies
      const { OpenAICompatibleProvider, AI_PROVIDER_TIMEOUTS } = await import('@dxlander/shared');
      const provider = new OpenAICompatibleProvider();

      // Initialize with a timeout to prevent hanging
      await Promise.race([
        provider.initialize({
          provider: 'openai-compatible',
          apiKey: config.apiKey, // Optional for local models
          baseUrl,
          model,
          settings: config.settings,
        }),
        new Promise<void>((_, reject) =>
          setTimeout(
            () => reject(new Error('OpenAI Compatible initialization timed out')),
            AI_PROVIDER_TIMEOUTS.CONNECTION_TEST
          )
        ),
      ]);

      return {
        success: true,
        message: 'Successfully connected to OpenAI Compatible API',
        model,
        details: {
          provider: 'openai-compatible',
          baseUrl,
          model,
          note: 'Connection successful',
          timestamp: new Date().toISOString(),
        },
      };
    } catch (error: any) {
      return {
        success: false,
        message: `OpenAI Compatible connection failed: ${error.message}`,
        model,
        details: {
          error: error.message,
          errorStack: error.stack,
          provider: 'openai-compatible',
          baseUrl,
          model,
          timestamp: new Date().toISOString(),
          isTimeout: error.message.includes('timed out'),
        },
      };
    }
  }
}

/**
 * OpenAI Provider Tester
 * Uses the dedicated OpenAI provider with OpenAI-specific validation
 */
class OpenAITester implements IProviderTester {
  validateConfig(config: ProviderTestConfig): void {
    if (!config.apiKey) {
      throw new Error('API key is required for OpenAI');
    }

    if (!config.apiKey.startsWith('sk-')) {
      throw new Error('Invalid OpenAI API key format (should start with sk-)');
    }

    if (!config.settings?.model) {
      throw new Error('Model selection is required for OpenAI');
    }
  }

  async test(config: ProviderTestConfig): Promise<ProviderTestResult> {
    this.validateConfig(config);

    const model = config.settings!.model!;

    try {
      // Dynamically import to avoid circular dependencies
      const { OpenAIProvider, AI_PROVIDER_TIMEOUTS } = await import('@dxlander/shared');
      const provider = new OpenAIProvider();

      // Initialize with a timeout to prevent hanging
      await Promise.race([
        provider.initialize({
          provider: 'openai',
          apiKey: config.apiKey!,
          model,
          settings: config.settings,
        }),
        new Promise<void>((_, reject) =>
          setTimeout(
            () => reject(new Error('OpenAI initialization timed out')),
            AI_PROVIDER_TIMEOUTS.CONNECTION_TEST
          )
        ),
      ]);

      return {
        success: true,
        message: 'Successfully connected to OpenAI API',
        model,
        details: {
          provider: 'openai',
          model,
          note: 'API key validated and connection successful',
          timestamp: new Date().toISOString(),
        },
      };
    } catch (error: any) {
      return {
        success: false,
        message: `OpenAI connection failed: ${error.message}`,
        model,
        details: {
          error: error.message,
          errorStack: error.stack,
          provider: 'openai',
          model,
          timestamp: new Date().toISOString(),
          isTimeout: error.message.includes('timed out'),
        },
      };
    }
  }
}

/**
 * Ollama Provider Tester (Placeholder)
 */
class OllamaTester implements IProviderTester {
  validateConfig(config: ProviderTestConfig): void {
    if (!config.settings?.baseUrl) {
      throw new Error('Base URL is required for Ollama');
    }

    try {
      new URL(config.settings.baseUrl);
    } catch {
      throw new Error('Invalid base URL format');
    }
  }

  async test(config: ProviderTestConfig): Promise<ProviderTestResult> {
    this.validateConfig(config);

    // TODO: Add actual connection test to Ollama server
    return {
      success: true,
      message: 'Ollama URL format is valid (connection test pending)',
      model: config.settings?.model || 'llama3',
      details: {
        provider: 'ollama',
        baseUrl: config.settings!.baseUrl,
        note: 'URL validated, server connection test pending',
      },
    };
  }
}

/**
 * LM Studio Provider Tester (Placeholder)
 */
class LMStudioTester implements IProviderTester {
  validateConfig(config: ProviderTestConfig): void {
    if (!config.settings?.baseUrl) {
      throw new Error('Base URL is required for LM Studio');
    }

    try {
      new URL(config.settings.baseUrl);
    } catch {
      throw new Error('Invalid base URL format');
    }
  }

  async test(config: ProviderTestConfig): Promise<ProviderTestResult> {
    this.validateConfig(config);

    // TODO: Add actual connection test to LM Studio server
    return {
      success: true,
      message: 'LM Studio URL format is valid (connection test pending)',
      model: config.settings?.model || 'default',
      details: {
        provider: 'lmstudio',
        baseUrl: config.settings!.baseUrl,
        note: 'URL validated, server connection test pending',
      },
    };
  }
}

/**
 * OpenRouter Provider Tester
 */
class OpenRouterTester implements IProviderTester {
  validateConfig(config: ProviderTestConfig): void {
    if (!config.apiKey) {
      throw new Error('API key is required for OpenRouter');
    }

    if (!config.settings?.model) {
      throw new Error('Model selection is required for OpenRouter');
    }
  }

  async test(config: ProviderTestConfig): Promise<ProviderTestResult> {
    this.validateConfig(config);

    const model = config.settings!.model!;

    try {
      // Dynamically import to avoid circular dependencies
      const { OpenRouterProvider, AI_PROVIDER_TIMEOUTS } = await import('@dxlander/shared');
      const provider = new OpenRouterProvider();

      // Initialize with a timeout to prevent hanging
      await Promise.race([
        provider.initialize({
          provider: 'openrouter',
          apiKey: config.apiKey!,
          model,
        }),
        new Promise<void>((_, reject) =>
          setTimeout(
            () => reject(new Error('OpenRouter initialization timed out')),
            AI_PROVIDER_TIMEOUTS.CONNECTION_TEST
          )
        ),
      ]);

      return {
        success: true,
        message: 'Successfully connected to OpenRouter API',
        model,
        details: {
          provider: 'openrouter',
          model,
          note: 'API key validated and connection successful',
          timestamp: new Date().toISOString(),
        },
      };
    } catch (error: any) {
      return {
        success: false,
        message: `OpenRouter connection failed: ${error.message}`,
        model,
        details: {
          error: error.message,
          errorStack: error.stack,
          provider: 'openrouter',
          model,
          timestamp: new Date().toISOString(),
          isTimeout: error.message.includes('timed out'),
        },
      };
    }
  }
}

/**
 * Groq Provider Tester
 */
class GroqTester implements IProviderTester {
  validateConfig(config: ProviderTestConfig): void {
    if (!config.apiKey) {
      throw new Error('API key is required for Groq');
    }

    if (!config.settings?.model) {
      throw new Error('Model selection is required for Groq');
    }
  }

  async test(config: ProviderTestConfig): Promise<ProviderTestResult> {
    this.validateConfig(config);

    const model = config.settings!.model!;

    try {
      // Dynamically import to avoid circular dependencies
      const { GroqProvider, AI_PROVIDER_TIMEOUTS } = await import('@dxlander/shared');
      const provider = new GroqProvider();

      // Initialize with a timeout to prevent hanging
      await Promise.race([
        provider.initialize({
          provider: 'groq',
          apiKey: config.apiKey!,
          model,
          baseUrl: config.settings?.baseUrl, // Extract baseUrl to top level
          settings: config.settings,
        }),
        new Promise<void>((_, reject) =>
          setTimeout(
            () => reject(new Error('Groq initialization timed out')),
            AI_PROVIDER_TIMEOUTS.CONNECTION_TEST
          )
        ),
      ]);

      return {
        success: true,
        message: 'Successfully connected to Groq API',
        model,
        details: {
          provider: 'groq',
          model,
          note: 'API key validated and connection successful',
          timestamp: new Date().toISOString(),
        },
      };
    } catch (error: any) {
      return {
        success: false,
        message: `Groq connection failed: ${error.message}`,
        model,
        details: {
          error: error.message,
          errorStack: error.stack,
          provider: 'groq',
          model,
          timestamp: new Date().toISOString(),
          isTimeout: error.message.includes('timed out'),
        },
      };
    }
  }
}

/**
 * Provider Registry
 *
 * Central registry for all provider testers.
 * Makes it easy to add new providers without modifying existing code.
 */
class ProviderTesterRegistry {
  private testers: Map<string, IProviderTester> = new Map();

  constructor() {
    // Register all available provider testers
    this.register('claude-code', new ClaudeAgentTester());
    this.register('openai', new OpenAITester());
    this.register('openai-compatible', new OpenAICompatibleTester());
    this.register('ollama', new OllamaTester());
    this.register('lmstudio', new LMStudioTester());
    this.register('openrouter', new OpenRouterTester());
    this.register('groq', new GroqTester());
  }

  /**
   * Register a provider tester
   */
  register(providerName: string, tester: IProviderTester): void {
    this.testers.set(providerName, tester);
  }

  /**
   * Get a provider tester
   */
  get(providerName: string): IProviderTester {
    const tester = this.testers.get(providerName);

    if (!tester) {
      throw new Error(`Unknown provider: ${providerName}`);
    }

    return tester;
  }

  /**
   * Test a provider connection
   */
  async testProvider(config: ProviderTestConfig): Promise<ProviderTestResult> {
    const tester = this.get(config.provider);
    return await tester.test(config);
  }
}

// Singleton instance
export const providerTesterRegistry = new ProviderTesterRegistry();

/**
 * Main testing service
 */
export class AIProviderTesterService {
  /**
   * Test a provider connection
   */
  static async testConnection(config: ProviderTestConfig): Promise<ProviderTestResult> {
    try {
      return await providerTesterRegistry.testProvider(config);
    } catch (error: any) {
      return {
        success: false,
        message: error.message || 'Connection test failed',
        model: config.settings?.model || 'default',
        details: {
          error: error.message,
          provider: config.provider,
        },
      };
    }
  }
}
