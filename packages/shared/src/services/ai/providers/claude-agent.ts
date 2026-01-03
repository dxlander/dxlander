/**
 * Claude Agent SDK Provider
 *
 * Uses the official @anthropic-ai/claude-agent-sdk package.
 * This is the MOST POWERFUL provider - it has built-in:
 * - File system access (Read, Write, Edit, Glob, Grep)
 * - Code execution (Bash)
 * - Web search
 * - MCP extensibility
 *
 * Perfect for deep project analysis.
 *
 * NOTE: This provider does NOT extend BaseToolProvider because the
 * Claude Agent SDK has its own built-in tool system that is more
 * powerful than the Vercel AI SDK tools. We keep this implementation
 * separate to leverage the full power of the Claude Agent SDK's
 * native capabilities.
 *
 * The SDK provides:
 * - Read/Write/Edit tools (not just Read like our custom tools)
 * - Bash execution (can run commands, not just read files)
 * - Built-in web search
 * - MCP server integration
 *
 * Using BaseToolProvider would actually REDUCE functionality here.
 */

import { query, type Options } from '@anthropic-ai/claude-agent-sdk';
import type {
  IAIProvider,
  AIProviderConfig,
  AICompletionRequest,
  AICompletionResponse,
  ProjectContext,
  ProjectAnalysisResult,
  DeploymentConfigRequest,
  DeploymentConfigResult,
} from '../types';
import { PromptTemplates, extractJsonFromResponse, validateAnalysisResult } from '../prompts';

export class ClaudeAgentProvider implements IAIProvider {
  readonly name = 'claude-agent-sdk' as const;
  private config: AIProviderConfig | null = null;
  private ready = false;

  /**
   * Initialize the provider
   */
  async initialize(config: AIProviderConfig): Promise<void> {
    // Validate API key
    if (!config.apiKey) {
      throw new Error('API key is required for Claude Agent SDK');
    }

    this.config = config;
    this.ready = true;
  }

  /**
   * Test connection by sending a simple query
   */
  async testConnection(): Promise<boolean> {
    if (!this.ready || !this.config) {
      return false;
    }

    try {
      const result = query({
        prompt: 'Reply with "OK" if you can see this message.',
        options: {
          model: this.config.model || 'claude-sonnet-4-5-20250929',
          maxTurns: 1,
          permissionMode: 'bypassPermissions',
          allowedTools: [], // No tools needed for connection test
          env: {
            ...process.env, // Spread all environment variables
            ANTHROPIC_API_KEY: this.config.apiKey, // Override with API key
          },
        },
      });

      // Consume the stream
      for await (const message of result) {
        if (message.type === 'result') {
          return !message.is_error;
        }
      }

      return false;
    } catch (error) {
      console.error('Claude Agent SDK connection test failed:', error);
      return false;
    }
  }

  /**
   * Get available models
   */
  async getAvailableModels(): Promise<string[]> {
    return [
      'claude-sonnet-4-5-20250929', // Latest Claude 4.5 Sonnet
      'claude-3-5-sonnet-20241022',
      'claude-3-5-sonnet-20240620',
      'claude-3-opus-20240229',
      'claude-3-haiku-20240307',
    ];
  }

  /**
   * Send a chat completion request (basic mode - no file access)
   */
  async chat(request: AICompletionRequest): Promise<AICompletionResponse> {
    if (!this.ready || !this.config) {
      throw new Error('Provider not initialized');
    }

    try {
      // Convert messages to prompt string
      const prompt = request.messages
        .filter((m) => m.role === 'user')
        .map((m) => m.content)
        .join('\n\n');

      const systemPrompt = request.messages
        .filter((m) => m.role === 'system')
        .map((m) => m.content)
        .join('\n\n');

      const options: Options = {
        model: request.model || this.config.model || 'claude-sonnet-4-5-20250929',
        maxTurns: 1,
        permissionMode: 'bypassPermissions',
        allowedTools: [], // No tools for basic chat
        systemPrompt: systemPrompt || undefined,
        env: {
          ...process.env, // Spread all environment variables
          ANTHROPIC_API_KEY: this.config.apiKey, // Override with API key
        },
      };

      const result = query({ prompt, options });

      const response: AICompletionResponse = {
        content: '',
        finishReason: 'stop',
        model: options.model || 'claude-sonnet-4-5-20250929',
      };

      for await (const message of result) {
        if (message.type === 'assistant') {
          // Extract text content from assistant message
          const textContent = message.message.content
            .filter((block: any) => block.type === 'text')
            .map((block: any) => block.text)
            .join('\n');

          response.content += textContent;
        }

        if (message.type === 'result') {
          response.usage = {
            promptTokens: message.usage.input_tokens,
            completionTokens: message.usage.output_tokens,
            totalTokens: message.usage.input_tokens + message.usage.output_tokens,
          };
          response.finishReason = message.is_error ? 'error' : 'stop';

          if (message.subtype === 'success') {
            // Use the final result if available
            if (message.result) {
              response.content = message.result;
            }
          }
        }
      }

      return response;
    } catch (error) {
      throw new Error(`Claude Agent SDK chat failed: ${error}`);
    }
  }

  /**
   * Analyze a project (THIS IS WHERE THE MAGIC HAPPENS)
   *
   * Uses the full power of Claude Agent SDK:
   * - Read files
   * - Search with Grep
   * - Find files with Glob
   * - Execute commands
   */
  async analyzeProject(context: ProjectContext): Promise<ProjectAnalysisResult> {
    if (!this.ready || !this.config) {
      throw new Error('Provider not initialized');
    }

    // Use absolute path from context, fallback to current directory
    const projectPath = context.projectPath || process.cwd();

    // Use centralized prompt template
    const analysisPrompt = PromptTemplates.buildAnalysisPrompt(context);

    const options: Options = {
      model: this.config.model || 'claude-sonnet-4-5-20250929',
      cwd: projectPath,
      permissionMode: 'bypassPermissions',
      maxTurns: 50, // Increased from 20 to handle complex projects (Nuxt, monorepos, etc.)
      allowedTools: ['Read', 'Grep', 'Glob'], // Only file reading tools
      systemPrompt: {
        type: 'preset',
        preset: 'claude_code',
        append: PromptTemplates.getAnalysisSystemPrompt(),
      },
      env: {
        ...process.env, // Spread all environment variables
        ANTHROPIC_API_KEY: this.config.apiKey, // Override with API key
      },
    };

    const queryResult = query({ prompt: analysisPrompt, options });

    let analysisJson = '';
    let allTextContent = ''; // Collect all text content as fallback

    for await (const message of queryResult) {
      // Stream progress events to caller
      if (context.onProgress) {
        if (message.type === 'assistant') {
          // Check for tool usage in assistant message
          const msg = message as any;
          const toolUses =
            msg.message?.content?.filter((block: any) => block.type === 'tool_use') || [];

          for (const toolUse of toolUses) {
            const toolName = toolUse.name || 'unknown';
            const toolInput = toolUse.input || {};

            let details = '';
            if (toolName === 'Read') {
              details = `Reading: ${toolInput.file_path || 'unknown file'}`;
            } else if (toolName === 'Grep') {
              details = `Searching for: ${toolInput.pattern || 'pattern'}`;
            } else if (toolName === 'Glob') {
              details = `Finding files: ${toolInput.pattern || 'pattern'}`;
            } else {
              details = JSON.stringify(toolInput).substring(0, 100);
            }

            await context.onProgress({
              type: 'tool_use',
              action: toolName.toLowerCase(),
              details,
              message: details,
            });
          }

          // Also capture thinking (text content)
          const textBlocks =
            msg.message?.content?.filter((block: any) => block.type === 'text') || [];
          if (textBlocks.length > 0) {
            const textContent = textBlocks.map((block: any) => block.text).join('\n');
            if (textContent.trim()) {
              // Collect all text content as fallback
              allTextContent += `${textContent}\n`;

              await context.onProgress({
                type: 'thinking',
                message: textContent.substring(0, 200), // First 200 chars
              });
            }
          }
        }
      }

      if (message.type === 'result') {
        const resultMsg = message as any;

        if (resultMsg.subtype === 'success') {
          analysisJson = resultMsg.result || '';
          break;
        } else if (resultMsg.subtype === 'error_max_turns') {
          // Try to use collected text as fallback
          if (allTextContent.trim().length > 0) {
            analysisJson = allTextContent;
            break; // Don't throw, try to parse what we have
          }

          throw new Error(
            `Analysis exceeded maximum turns (${resultMsg.num_turns}/${options.maxTurns}). The project may be too complex or needs more turns. Cost: $${resultMsg.total_cost_usd?.toFixed(4)}`
          );
        } else if (resultMsg.subtype === 'error_during_execution') {
          throw new Error('Analysis failed during execution.');
        }
      }
    }

    // Check if we got a response
    if (!analysisJson || analysisJson.trim().length === 0) {
      if (allTextContent.trim().length > 0) {
        analysisJson = allTextContent;
      } else {
        throw new Error(
          'Claude Agent SDK returned empty response. The model may have hit token limits or encountered an error.'
        );
      }
    }

    // Parse and validate
    const analysisResult = extractJsonFromResponse(analysisJson);

    if (!validateAnalysisResult(analysisResult)) {
      throw new Error('Analysis result does not match expected structure');
    }

    return analysisResult;
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

    // Use centralized prompt template
    const configPrompt = PromptTemplates.buildConfigPrompt(request);

    const options: Options = {
      model: this.config.model || 'claude-sonnet-4-5-20250929',
      cwd: request.projectContext.projectPath || process.cwd(), // Set working directory to project path
      permissionMode: 'bypassPermissions',
      maxTurns: 20, // Increased for file writing operations
      allowedTools: ['Write', 'Read', 'Glob'], // Allow Write to create config files
      systemPrompt: PromptTemplates.getConfigGenerationSystemPrompt(),
      env: {
        ...process.env, // Spread all environment variables
        ANTHROPIC_API_KEY: this.config.apiKey, // Override with API key
      },
    };

    const result = query({ prompt: configPrompt, options });

    const filesCreated: string[] = [];

    for await (const message of result) {
      // Track files being created
      if (message.type === 'assistant') {
        const msg = message as any;
        const toolUses =
          msg.message?.content?.filter((block: any) => block.type === 'tool_use') || [];

        for (const toolUse of toolUses) {
          if (toolUse.name === 'Write') {
            const filePath = toolUse.input?.file_path;
            if (filePath) {
              filesCreated.push(filePath);
            }
          }
        }
      }

      if (message.type === 'result') {
        if (message.subtype === 'success' || message.subtype === 'error_max_turns') {
          break;
        }
      }
    }

    // Now wait for ALL files to be written to disk
    // The AI writes _summary.json last, so we use it as the completion signal
    const fs = await import('fs/promises');
    const path = await import('path');
    const projectPath = request.projectContext.projectPath || process.cwd();

    // Wait for all tracked files to exist with exponential backoff
    const maxAttempts = 20; // 20 attempts
    const baseDelay = 250; // Start with 250ms

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const missingFiles: string[] = [];

      // Check if all files exist
      for (const file of filesCreated) {
        const filePath = path.isAbsolute(file) ? file : path.join(projectPath, file);
        try {
          await fs.access(filePath);
        } catch {
          missingFiles.push(path.basename(file));
        }
      }

      if (missingFiles.length === 0) {
        break;
      }

      // Exponential backoff: 250ms, 500ms, 1000ms, 2000ms, then cap at 2000ms
      const delay = Math.min(baseDelay * Math.pow(2, attempt - 1), 2000);

      if (attempt === maxAttempts) {
        // Timeout reached, continue anyway
      } else {
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }

    // Read and parse _summary.json
    const summaryPath = path.join(projectPath, '_summary.json');

    try {
      const summaryContent = await fs.readFile(summaryPath, 'utf-8');
      const configResult = JSON.parse(summaryContent);
      return configResult;
    } catch {
      // Fallback: construct result from tracked files
      return {
        files: filesCreated.map((filePath) => ({
          fileName: path.basename(filePath),
          description: `Generated ${path.basename(filePath)}`,
        })),
      };
    }
  }

  /**
   * Check if provider is ready
   */
  isReady(): boolean {
    return this.ready && this.config !== null;
  }
}
