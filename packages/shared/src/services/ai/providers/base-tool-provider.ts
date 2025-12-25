/**
 * Base Tool Provider
 *
 * Abstract base class for AI providers that use Vercel AI SDK v6's tool-calling system.
 * Provides unified project analysis and config generation capabilities using tools.
 *
 * All non-SDK providers (Groq, OpenRouter, OpenAI, etc.) extend this class and only
 * need to implement `getLanguageModel()` to specify which AI model to use.
 *
 * The Claude Agent SDK does NOT use this - it has its own built-in tools.
 *
 * AI SDK v6 Features Used:
 * - streamText() with stopWhen for multi-step tool loops
 * - tool() for defining tools with Zod schema validation
 * - LanguageModel type for provider abstraction
 */

import { streamText, stepCountIs, type LanguageModel } from 'ai';
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
import { createProjectAnalysisTools, createConfigGenerationTools } from '../tools';

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
   * Extract detailed error message from AI SDK error structures
   * This helps surface rate limit messages and other provider errors that get wrapped
   */
  protected extractDetailedError(error: any): string | null {
    // Try multiple paths where detailed errors might be hiding
    const paths = [
      error.lastError?.data?.error?.metadata?.raw,
      error.lastError?.responseBody,
      error.data?.error?.metadata?.raw,
      error.responseBody,
      error.cause?.responseBody,
    ];

    for (const path of paths) {
      if (typeof path === 'string') {
        try {
          // Try to parse JSON if it's a string
          const parsed = JSON.parse(path);
          const raw = parsed?.error?.metadata?.raw;
          if (raw && typeof raw === 'string') {
            return raw;
          }
        } catch {
          // If not JSON, check if it's a useful string
          if (path.length > 10 && path.length < 500) {
            return path;
          }
        }
      } else if (path && typeof path === 'object') {
        // Already an object
        const raw = path?.error?.metadata?.raw;
        if (raw && typeof raw === 'string') {
          return raw;
        }
      }
    }

    return null;
  }

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

      const systemMessages = request.messages
        .filter((m) => m.role === 'system')
        .map((m) => m.content)
        .join('\n\n');

      const conversationMessages = request.messages
        .filter((m) => m.role === 'user' || m.role === 'assistant')
        .map((m) => ({
          role: m.role as 'user' | 'assistant',
          content: m.content,
        }));

      const result = await streamText({
        model,
        system: systemMessages || undefined,
        messages: conversationMessages,
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

      // Analysis started - tools available: readFile, grepSearch, globFind, listDirectory

      // Use streaming with comprehensive error handling
      // stopWhen allows multi-turn tool usage: model calls tools, receives results, then produces final output
      const result = streamText({
        model,
        system: systemPrompt,
        prompt: analysisPrompt,
        tools,
        stopWhen: stepCountIs(50), // Allow up to 50 tool call rounds for thorough exploration + final output
        maxOutputTokens: 8000, // Increased to ensure complete JSON output (analysis results can be large)
        // Try to enforce JSON mode where supported (OpenAI, some OpenRouter models)
        // Note: Not all providers support this with tools, but it helps when available
        providerOptions: {
          openai: {
            response_format: { type: 'json_object' },
          },
          openrouter: {
            response_format: { type: 'json_object' },
          },
        },
        onStepFinish: async (step) => {
          // Report progress for each tool call with results
          if (context.onProgress && step.toolCalls && step.toolCalls.length > 0) {
            for (let i = 0; i < step.toolCalls.length; i++) {
              const toolCall = step.toolCalls[i];
              const toolName = toolCall.toolName;
              const toolInput = toolCall.input as Record<string, unknown>;

              // Get tool result if available (toolResults is an array matching toolCalls)
              let resultData: unknown = null;
              if (step.toolResults && step.toolResults[i]) {
                // Access the result property from the tool result object
                resultData = (step.toolResults[i] as { result?: unknown }).result;
              }

              const message = this.formatToolMessage(toolName, toolInput);

              // Include both input and result in details for logging
              await context.onProgress({
                type: 'tool_use',
                action: toolName,
                details: JSON.stringify({
                  input: toolInput,
                  result: resultData,
                }),
                message,
              });
            }
          }

          // Report thinking (text output)
          if (context.onProgress && step.text) {
            const preview = step.text.substring(0, 150);
            if (preview.trim()) {
              await context.onProgress({
                type: 'thinking',
                message: preview,
              });
            }
          }
        },
      });

      // Add timeout to prevent indefinite hanging (30 minutes max for analysis)
      // Local models can be slow, especially with large prompts and tool calling
      const ANALYSIS_TIMEOUT = 30 * 60 * 1000; // 30 minutes

      const fullResponse = await Promise.race([
        result.text,
        new Promise<never>((_, reject) =>
          setTimeout(
            () => reject(new Error(`Analysis timed out after 30 minutes.`)),
            ANALYSIS_TIMEOUT
          )
        ),
      ]);

      // Check if we got an empty response
      if (!fullResponse || fullResponse.trim().length === 0) {
        throw new Error(`AI returned empty response. Check the model logs for errors.`);
      }

      // Parse and validate
      const analysisResult = extractJsonFromResponse(fullResponse);

      if (!validateAnalysisResult(analysisResult)) {
        throw new Error('Analysis result does not match expected structure');
      }

      return analysisResult;
    } catch (error: any) {
      // Extract detailed error information from various error structures
      const errorMessage = error.message || 'Unknown error';
      const errorData = error.data?.error;
      const responseBody = error.responseBody;
      const lastError = error.lastError || error.errors?.[0];

      if (errorMessage.includes('No output generated')) {
        // Try to extract detailed error
        const detailedError = this.extractDetailedError(error);

        if (detailedError) {
          throw new Error(detailedError);
        }

        // If no detailed error found, provide a helpful generic message
        throw new Error(
          'AI model did not generate output. This could be due to rate limiting, model errors, or network issues. Please try again or select a different model.'
        );
      }

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
          } catch {
            // Ignore JSON parse errors - continue with other fallbacks
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
          } catch {
            // Ignore JSON parse errors
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
   * Uses tool-calling with writeFile tool so AI can create files directly.
   */
  async generateDeploymentConfig(
    request: DeploymentConfigRequest
  ): Promise<DeploymentConfigResult> {
    if (!this.ready || !this.config) {
      throw new Error('Provider not initialized');
    }

    if (!request.projectContext.projectPath) {
      throw new Error('Project path is required for config generation');
    }

    try {
      const model = await this.getLanguageModel();
      const configPrompt = PromptTemplates.buildConfigPrompt(request);
      const systemPrompt = PromptTemplates.getConfigGenerationSystemPrompt();

      // Create tools with config folder as project path
      const tools = createConfigGenerationTools({
        projectPath: request.projectContext.projectPath,
      });

      // Track files written by the tool
      const filesWritten: Array<{ fileName: string; description?: string }> = [];

      // Use tool-calling for config generation
      // stopWhen allows multi-turn tool usage for writing multiple files
      const result = streamText({
        model,
        system: systemPrompt,
        prompt: configPrompt,
        tools,
        stopWhen: stepCountIs(50), // Allow up to 50 tool call rounds for multi-file generation
        maxOutputTokens: 8000,
        // Try to enforce JSON mode where supported
        providerOptions: {
          openai: {
            response_format: { type: 'json_object' },
          },
          openrouter: {
            response_format: { type: 'json_object' },
          },
        },
        onStepFinish: async (step) => {
          // Log tool calls and report progress
          if (step.toolCalls && step.toolCalls.length > 0) {
            for (const toolCall of step.toolCalls) {
              if (toolCall.toolName === 'writeFile') {
                const input = toolCall.input as { filePath: string; content: string };
                filesWritten.push({ fileName: input.filePath });

                // Report progress if callback available
                if (request.projectContext.onProgress) {
                  await request.projectContext.onProgress({
                    type: 'tool_use',
                    action: 'writeFile',
                    details: JSON.stringify({
                      filePath: input.filePath,
                      size: input.content.length,
                    }),
                    message: `Writing file: ${input.filePath}`,
                  });
                }
              }
            }
          }
        },
      });

      // Wait for completion with timeout
      const CONFIG_TIMEOUT = 10 * 60 * 1000; // 10 minutes for config generation

      const fullResponse = await Promise.race([
        result.text,
        new Promise<never>((_, reject) =>
          setTimeout(
            () => reject(new Error(`Config generation timed out after 10 minutes.`)),
            CONFIG_TIMEOUT
          )
        ),
      ]);

      // Try to parse any JSON response for metadata
      let configResult: DeploymentConfigResult = {
        configType: request.configType,
        files: filesWritten,
      };

      // If there's a text response, try to parse it as JSON for additional metadata
      if (fullResponse && fullResponse.trim().length > 0) {
        try {
          const parsed = extractJsonFromResponse(fullResponse);
          if (parsed && typeof parsed === 'object') {
            configResult = {
              ...configResult,
              ...parsed,
              files: filesWritten.length > 0 ? filesWritten : parsed.files || [],
            };
          }
        } catch {
          // No JSON response is fine - files were written via tool
        }
      }

      return configResult;
    } catch (error: any) {
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
