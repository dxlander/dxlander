/**
 * Base Tool Provider
 *
 * Abstract base class for AI providers that use Vercel AI SDK's tool-calling system.
 * Provides unified project analysis and config generation capabilities using tools.
 *
 * All non-SDK providers (Groq, OpenRouter, OpenAI, etc.) extend this class and only
 * need to implement `getLanguageModel()` to specify which AI model to use.
 *
 * The Claude Agent SDK does NOT use this - it has its own built-in tools.
 */

import { streamText, type LanguageModel } from 'ai';
import type {
  IAIProvider,
  AIProviderConfig,
  AIProviderType,
  AICompletionRequest,
  AICompletionResponse,
  ProjectContext,
  ProjectAnalysisResult,
  DeploymentConfigRequest,
  DeploymentConfigResult,
} from '../types';
import { PromptTemplates, extractJsonFromResponse, validateAnalysisResult } from '../prompts';
import { createProjectAnalysisTools } from '../tools';

/**
 * Base class for AI providers using Vercel AI SDK tool-calling
 */
export abstract class BaseToolProvider implements IAIProvider {
  protected config: AIProviderConfig | null = null;
  protected ready = false;

  /**
   * Provider name - must be implemented by subclasses
   */
  abstract readonly name: AIProviderType;

  /**
   * Get the language model instance for this provider
   * Subclasses implement this to return their specific AI model
   */
  abstract getLanguageModel(): Promise<LanguageModel>;

  /**
   * Get available models - must be implemented by subclasses
   */
  abstract getAvailableModels(): Promise<string[]>;

  /**
   * Initialize the provider
   */
  async initialize(config: AIProviderConfig): Promise<void> {
    if (!config.apiKey) {
      throw new Error(`API key is required for ${this.name}`);
    }

    this.config = config;

    // Test connection
    const isConnected = await this.testConnection();
    if (!isConnected) {
      throw new Error(`Failed to connect to ${this.name} API. Please check your API key.`);
    }

    this.ready = true;
  }

  /**
   * Test connection to AI service
   */
  abstract testConnection(): Promise<boolean>;

  /**
   * Send basic chat completion request (no tools)
   */
  async chat(request: AICompletionRequest): Promise<AICompletionResponse> {
    // Only check config, not ready flag (to allow testConnection to use chat)
    if (!this.config) {
      throw new Error('Provider not initialized');
    }

    try {
      const model = await this.getLanguageModel();

      // Convert messages to prompt
      const systemMessages = request.messages
        .filter((m) => m.role === 'system')
        .map((m) => m.content)
        .join('\n\n');

      const userMessages = request.messages
        .filter((m) => m.role === 'user')
        .map((m) => m.content)
        .join('\n\n');

      const result = await streamText({
        model,
        system: systemMessages || undefined,
        prompt: userMessages,
        temperature: request.temperature,
        maxOutputTokens: request.maxTokens,
      });

      // Collect response
      let fullResponse = '';
      for await (const chunk of result.textStream) {
        fullResponse += chunk;
      }

      const usage = await result.usage;

      return {
        content: fullResponse,
        finishReason: 'stop',
        model: this.config.model || 'unknown',
        usage: usage
          ? {
              promptTokens: usage.inputTokens ?? 0,
              completionTokens: usage.outputTokens ?? 0,
              totalTokens: usage.totalTokens ?? 0,
            }
          : undefined,
      };
    } catch (error: any) {
      throw new Error(`Chat request failed: ${error.message}`);
    }
  }

  /**
   * Analyze a project using tool-calling
   *
   * This is where the magic happens! The AI uses tools to:
   * - Read package.json, tsconfig.json, etc.
   * - Search for imports and API calls
   * - Find all source files
   * - Explore the project structure
   *
   * All providers get the same tools, so they all can produce high-quality analysis.
   */
  async analyzeProject(context: ProjectContext): Promise<ProjectAnalysisResult> {
    if (!this.ready || !this.config) {
      throw new Error('Provider not initialized');
    }

    if (!context.projectPath) {
      throw new Error('Project path is required for analysis');
    }

    try {
      const model = await this.getLanguageModel();
      const analysisPrompt = PromptTemplates.buildAnalysisPrompt(context);
      const systemPrompt = PromptTemplates.getAnalysisSystemPrompt();

      // Create tools with project context
      const tools = createProjectAnalysisTools({ projectPath: context.projectPath });

      console.log(`🤖 Starting ${this.name} analysis with tool-calling...`);

      // Use streaming with comprehensive error handling
      const result = await streamText({
        model,
        system: systemPrompt,
        prompt: analysisPrompt,
        tools,
        temperature: 0.7,
        maxOutputTokens: 4000,
        onStepFinish: async (step) => {
          // Report progress for each tool call
          if (context.onProgress && step.toolCalls && step.toolCalls.length > 0) {
            for (const toolCall of step.toolCalls) {
              // In v5, tool calls have .input instead of .args
              const toolName = toolCall.toolName;
              const toolInput = toolCall.input;

              const message = this.formatToolMessage(toolName, toolInput);
              console.log(`  🔧 ${message}`);

              await context.onProgress({
                type: 'tool_use',
                action: toolName,
                details: JSON.stringify(toolInput),
                message,
              });
            }
          }

          // Report thinking (text output)
          if (context.onProgress && step.text) {
            const preview = step.text.substring(0, 150);
            if (preview.trim()) {
              console.log(`  💭 Thinking: ${preview}...`);

              await context.onProgress({
                type: 'thinking',
                message: preview,
              });
            }
          }
        },
      });

      // Await the full text response (this automatically consumes the stream)
      // Using result.text instead of manually iterating ensures errors are propagated correctly
      const fullResponse = await result.text;

      console.log(`✅ ${this.name} analysis complete (${fullResponse.length} chars)`);

      // Check if we got an empty response
      if (!fullResponse || fullResponse.trim().length === 0) {
        throw new Error(
          'Received empty response from AI. The model may not have completed its response.'
        );
      }

      // Parse and validate
      const analysisResult = extractJsonFromResponse(fullResponse);

      if (!validateAnalysisResult(analysisResult)) {
        throw new Error('Analysis result does not match expected structure');
      }

      return analysisResult;
    } catch (error: any) {
      console.error(`❌ ${this.name} analysis failed:`, error);

      // Extract detailed error information from various error structures
      const errorMessage = error.message || 'Unknown error';
      const errorData = error.data?.error;
      const responseBody = error.responseBody;
      const lastError = error.lastError || error.errors?.[0];

      // Provide helpful error messages for common issues
      if (errorMessage.includes('No endpoints found that support tool use')) {
        throw new Error(
          `The selected model (${this.config.model}) does not support tool/function calling, which is required for project analysis. Please select a different model that supports tools.`
        );
      }

      // Handle rate limiting (429 errors) - check multiple locations
      if (
        error.statusCode === 429 ||
        errorMessage.includes('rate limit') ||
        lastError?.statusCode === 429
      ) {
        // Try to extract the most detailed rate limit message
        let rateLimitMessage = '';

        // Check last error first (most detailed in retry scenarios)
        if (lastError?.data?.error?.metadata?.raw) {
          rateLimitMessage = lastError.data.error.metadata.raw;
        } else if (lastError?.responseBody) {
          try {
            const parsed = JSON.parse(lastError.responseBody);
            if (parsed.error?.metadata?.raw) {
              rateLimitMessage = parsed.error.metadata.raw;
            }
          } catch (e) {
            console.error('Failed to parse lastError response body:', e);
          }
        }

        // Fallback to direct error data
        if (!rateLimitMessage && errorData?.metadata?.raw) {
          rateLimitMessage = errorData.metadata.raw;
        } else if (!rateLimitMessage && responseBody) {
          try {
            const parsed =
              typeof responseBody === 'string' ? JSON.parse(responseBody) : responseBody;
            if (parsed.error?.metadata?.raw) {
              rateLimitMessage = parsed.error.metadata.raw;
            }
          } catch (e) {
            console.error('Failed to parse error response body:', e);
          }
        }

        // If we found a detailed message, use it; otherwise use generic
        if (rateLimitMessage) {
          throw new Error(`${rateLimitMessage}`);
        } else {
          throw new Error(
            `Rate limit exceeded for ${this.config.model}. Please try again later or select a different model.`
          );
        }
      }

      // Handle retry errors with more context
      if (error.reason === 'maxRetriesExceeded') {
        if (lastError) {
          // Extract the most helpful error message
          const detailedMsg =
            lastError.data?.error?.metadata?.raw ||
            lastError.data?.error?.message ||
            lastError.message;

          if (detailedMsg && detailedMsg !== 'Provider returned error') {
            throw new Error(`Failed after 3 retries: ${detailedMsg}`);
          }
        }
        throw new Error(
          `Failed after multiple retries. The model may be experiencing issues. Please try again later or select a different model.`
        );
      }

      if (errorMessage.includes('tool')) {
        throw new Error(
          `Tool calling failed: ${errorMessage}. This model may not support the required features for project analysis.`
        );
      }

      throw new Error(`Project analysis failed: ${errorMessage}`);
    }
  }

  /**
   * Generate deployment configuration
   *
   * NOTE: For now, this still uses the old prompt-based approach.
   * We may migrate this to tool-calling in the future (using Write tool).
   */
  async generateDeploymentConfig(
    request: DeploymentConfigRequest
  ): Promise<DeploymentConfigResult> {
    if (!this.ready || !this.config) {
      throw new Error('Provider not initialized');
    }

    try {
      const model = await this.getLanguageModel();
      const configPrompt = PromptTemplates.buildConfigPrompt(request);
      const systemPrompt = PromptTemplates.getConfigGenerationSystemPrompt();

      console.log(`🤖 Starting ${this.name} config generation...`);

      // For config generation, we use basic text generation (no tools yet)
      // In the future, we could add a Write tool here
      const result = await streamText({
        model,
        system: systemPrompt,
        prompt: configPrompt,
        temperature: 0.7,
        maxOutputTokens: 6000,
      });

      // Collect response
      let fullResponse = '';
      for await (const chunk of result.textStream) {
        fullResponse += chunk;
      }

      console.log(`✅ ${this.name} config generation complete (${fullResponse.length} chars)`);

      // Parse response
      const configResult = extractJsonFromResponse(fullResponse);

      if (!configResult || typeof configResult !== 'object') {
        throw new Error('Config result is not a valid object');
      }

      // Ensure required fields
      if (!configResult.configType) {
        configResult.configType = request.configType;
      }

      if (!configResult.files) {
        configResult.files = [];
      }

      return configResult as DeploymentConfigResult;
    } catch (error: any) {
      console.error(`❌ ${this.name} config generation failed:`, error.message);
      throw new Error(`Deployment config generation failed: ${error.message}`);
    }
  }

  /**
   * Check if provider is ready
   */
  isReady(): boolean {
    return this.ready && this.config !== null;
  }

  /**
   * Format tool call message for logging and progress updates
   */
  private formatToolMessage(toolName: string, args: any): string {
    switch (toolName) {
      case 'readFile':
        return `Reading file: ${args.filePath}`;
      case 'grepSearch':
        return `Searching for pattern: ${args.pattern}${args.glob ? ` in ${args.glob}` : ''}`;
      case 'globFind':
        return `Finding files matching: ${args.pattern}`;
      case 'listDirectory':
        return `Listing directory: ${args.dirPath || '.'}`;
      default:
        return `Using tool: ${toolName}`;
    }
  }
}
