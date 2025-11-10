/**
 * Groq Provider
 *
 * Uses the Groq API for fast inference with open-source models.
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

export class GroqProvider implements IAIProvider {
  readonly name = 'groq' as const;
  private config: AIProviderConfig | null = null;
  private ready = false;
  private baseUrl = 'https://api.groq.com/openai/v1';

  /**
   * Initialize the provider
   */
  async initialize(config: AIProviderConfig): Promise<void> {
    // Validate API key
    if (!config.apiKey) {
      throw new Error('API key is required for Groq');
    }

    this.config = config;

    // Use custom base URL if provided
    if (config.baseUrl) {
      this.baseUrl = config.baseUrl;
    }

    // Check token limit during initialization
    const maxTokens = config.settings?.maxTokens || 4096;
    const tokenLimit = (config.settings?.configType as string) === 'bash' ? 20000 : 30000;
    if (maxTokens > tokenLimit) {
      throw new Error(
        `Groq provider has a maximum token limit of ${tokenLimit} per run for ${(config.settings?.configType as string) || 'unknown'} configurations.`
      );
    }

    // Test connection to validate API key with timeout
    try {
      const isConnected = await Promise.race([
        this.testConnection(),
        new Promise<boolean>((resolve) => setTimeout(() => resolve(false), 10000)), // 10 second timeout
      ]);

      if (!isConnected) {
        throw new Error(
          'Failed to connect to Groq API. Please check your API key and network connection.'
        );
      }
    } catch (error: any) {
      throw new Error(`Failed to initialize Groq provider: ${error.message}`);
    }

    this.ready = true;
  }

  /**
   * Validate API key format and basic requirements
   */
  private validateApiKey(apiKey: string): void {
    if (!apiKey) {
      throw new Error('API key is required for Groq');
    }

    // Basic validation - just check for minimum length and basic characters
    if (apiKey.length < 16) {
      throw new Error('API key is too short. Please check your Groq API key.');
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

      // Make a simple request to test the API key
      // Groq API doesn't have a dedicated auth validation endpoint, so we'll use a minimal chat completion
      const response = await axios.post(
        `${this.baseUrl}/chat/completions`,
        {
          model: 'llama-3.1-8b-instant',
          messages: [{ role: 'user', content: 'test' }],
          max_tokens: 1,
          temperature: 0.0,
          top_p: 1.0,
          stream: false,
        },
        {
          headers: {
            Authorization: `Bearer ${this.config.apiKey}`,
            'Content-Type': 'application/json',
          },
          timeout: 10000, // 10 second timeout
        }
      );

      // If we get here without throwing, the API key is valid
      return response.status === 200;
    } catch (error: any) {
      console.error('Groq connection test failed:', error.message || error);

      // Log more detailed error information
      if (error.response) {
        console.error('Groq API Error Response:', {
          status: error.response.status,
          statusText: error.response.statusText,
          data: error.response.data,
        });
      }

      // Handle specific error cases
      if (error.response?.status === 401 || error.response?.status === 403) {
        // Invalid API key
        return false;
      }

      // For other errors (including 400, 404), we'll consider the connection failed
      return false;
    }
  }

  /**
   * Get available models
   */
  async getAvailableModels(): Promise<string[]> {
    return [
      'moonshotai/kimi-k2-instruct',
      'openai/gpt-oss-120b',
      'llama-3.3-70b-versatile',
      'llama-3.1-8b-instant',
      'qwen/qwen3-32b',
    ];
  }

  /**
   * Send a chat completion request
   */
  async chat(request: AICompletionRequest): Promise<AICompletionResponse> {
    if (!this.ready || !this.config) {
      throw new Error('Provider not initialized');
    }

    try {
      const messages = request.messages.map((msg) => ({
        role: msg.role,
        content: msg.content,
      }));

      const response = await Promise.race([
        axios.post(
          `${this.baseUrl}/chat/completions`,
          {
            model: request.model || this.config.model,
            messages: messages,
            temperature: request.temperature || 0.7,
            max_tokens: request.maxTokens || 1000,
          },
          {
            headers: {
              Authorization: `Bearer ${this.config.apiKey}`,
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
        throw new Error(`Groq API returned invalid response: ${JSON.stringify(data)}`);
      }

      const choice = data.choices[0];
      if (!choice || !choice.message || !choice.message.content) {
        throw new Error(`Groq API returned empty message content: ${JSON.stringify(choice)}`);
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
    } catch (error: any) {
      // Handle rate limiting
      if (error.response?.status === 429) {
        throw new Error('Free provider limit reached. Please wait or upgrade.');
      }

      // Handle invalid API key
      if (error.response?.status === 401) {
        throw new Error('Invalid Groq API key.');
      }

      // Handle other errors
      throw new Error(`Groq API request failed: ${error.message}`);
    }
  }

  /**
   * Analyze a project
   */
  async analyzeProject(context: ProjectContext): Promise<ProjectAnalysisResult> {
    if (!this.ready || !this.config) {
      throw new Error('Provider not initialized');
    }

    try {
      // Use centralized prompt template
      const analysisPrompt = PromptTemplates.buildAnalysisPrompt(context);

      // Add system prompt
      const systemPrompt = `${PromptTemplates.getAnalysisSystemPrompt()}\n\nCRITICAL: Return ONLY a valid JSON object. Do not include any formatting, explanations, or additional text. The response will be parsed directly as JSON.`;

      // Send request to Groq API with timeout
      const response = await Promise.race([
        axios.post(
          `${this.baseUrl}/chat/completions`,
          {
            model: this.config.model,
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: analysisPrompt },
            ],
            temperature: 0.7,
            max_tokens: 6000, // Higher token limit for comprehensive analysis
          },
          {
            headers: {
              Authorization: `Bearer ${this.config.apiKey}`,
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
          `Groq API returned invalid response for project analysis: ${JSON.stringify(data)}`
        );
      }

      const choice = data.choices[0];
      const analysisJson = choice.message?.content;

      // Check for empty or whitespace-only responses
      if (!analysisJson || analysisJson.trim().length === 0) {
        // Log more detailed information about the response
        const modelInfo = data.model || this.config.model || 'unknown';
        const usageInfo = data.usage
          ? `Prompt tokens: ${data.usage.prompt_tokens}, Completion tokens: ${data.usage.completion_tokens}`
          : 'No usage info';

        throw new Error(
          `Groq API returned empty or whitespace-only response for project analysis. Model: ${modelInfo}, Usage: ${usageInfo}. Response: ${JSON.stringify(data)}`
        );
      }

      // Parse and validate
      let parsedResult;
      try {
        parsedResult = extractJsonFromResponse(analysisJson);
      } catch (parseError) {
        // If JSON parsing fails, try to extract JSON from markdown response
        console.warn('JSON parsing failed, attempting to extract from markdown response');

        // Try to find JSON content between code blocks
        const jsonMatch = analysisJson.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
        if (jsonMatch && jsonMatch[1]) {
          try {
            parsedResult = JSON.parse(jsonMatch[1].trim());
          } catch (innerError) {
            throw new Error(
              `Failed to parse JSON from markdown code block: ${innerError}\n\nRaw response (length: ${analysisJson.length}):\n${analysisJson.substring(0, 500)}${analysisJson.length > 500 ? '...' : ''}`
            );
          }
        } else {
          // If no code block found, throw the original error
          throw parseError;
        }
      }

      // Create a cleaned copy of the result
      const analysisResult = {
        ...parsedResult,
        dependencies: {
          ...parsedResult.dependencies,
          totalCount:
            typeof parsedResult.dependencies?.totalCount === 'string'
              ? parsedResult.dependencies.totalCount.toLowerCase().includes('not detected')
                ? 0
                : parseInt(parsedResult.dependencies.totalCount, 10) || 0
              : parsedResult.dependencies?.totalCount || 0,
        },
        integrations: Array.isArray(parsedResult.integrations) ? parsedResult.integrations : [],
        builtInCapabilities: Array.isArray(parsedResult.builtInCapabilities)
          ? parsedResult.builtInCapabilities
          : [],
        environmentVariables: Array.isArray(parsedResult.environmentVariables)
          ? parsedResult.environmentVariables
          : [],
        recommendations: Array.isArray(parsedResult.recommendations)
          ? parsedResult.recommendations
          : [],
        warnings: Array.isArray(parsedResult.warnings) ? parsedResult.warnings : [],
      };

      // Validate the cleaned result
      if (!validateAnalysisResult(analysisResult)) {
        throw new Error(
          `Analysis result does not match expected structure. Response: ${analysisJson}`
        );
      }

      return analysisResult;
    } catch (error: any) {
      // Handle rate limiting
      if (error.response?.status === 429) {
        throw new Error('Free provider limit reached. Please wait or upgrade.');
      }

      // Handle invalid API key
      if (error.response?.status === 401) {
        throw new Error('Invalid Groq API key.');
      }

      // Handle bad request (400)
      if (error.response?.status === 400) {
        const errorMsg = error.response?.data?.error?.message || error.message;
        throw new Error(`Groq API request failed (400 Bad Request): ${errorMsg}`);
      }

      // Handle other errors
      throw new Error(`Groq API request failed: ${error.message}`);
    }
  }

  /**
   * Generate bash deployment configuration
   */
  private async generateBashConfig(
    request: DeploymentConfigRequest,
    configJson: string
  ): Promise<DeploymentConfigResult> {
    if (!request.projectContext?.projectPath) {
      throw new Error('Project path is required for bash configuration');
    }

    // Clean up the response - remove any tool-calling syntax or analysis text
    let cleanedContent = configJson;

    // Remove common tool-calling patterns that might appear at the start
cleanedContent = cleanedContent.replace(
      /^I'll\s+analyze[\s\S]*?(?=<write_file>|<write>|###|

    // Try to extract just the script content if there's analysis text
    const scriptMatch = cleanedContent.match(/(?:```(?:bash|sh)?\s*\n?)([\s\S]*?)(?:\n?```|$)/);
    if (scriptMatch && scriptMatch[1]) {
      cleanedContent = scriptMatch[1].trim();
    }

    const files = this.parseConfigFiles(cleanedContent);

    // If we couldn't parse structured files, treat the cleaned response as deploy.sh
    if (files.length === 0) {
      files.push({
        fileName: 'deploy.sh',
        content: cleanedContent,
      });

      // Create a basic setup.sh file
      files.push({
        fileName: 'setup.sh',
        content:
          '#!/bin/bash\n\n# Basic setup script\necho "Running setup..."\n\n# Add your setup commands here\n\necho "Setup complete."\n',
      });
    }

    // Ensure we have both deploy.sh and setup.sh
    const hasDeploy = files.some((f) => f.fileName === 'deploy.sh');
    const hasSetup = files.some((f) => f.fileName === 'setup.sh');

    if (!hasDeploy) {
      files.push({
        fileName: 'deploy.sh',
        content: cleanedContent,
      });
    }

    if (!hasSetup) {
      files.push({
        fileName: 'setup.sh',
        content:
          '#!/bin/bash\n\n# Basic setup script\necho "Running setup..."\n\n# Add your setup commands here\n\necho "Setup complete."\n',
      });
    }

    await this.writeConfigFiles(files, request.projectContext.projectPath);
    await this.createSummaryFile('bash', files, request.projectContext.projectPath);

    return {
      configType: 'bash',
      files: files.map((f) => ({
        fileName: f.fileName,
        description: f.fileName === 'deploy.sh' ? 'Deployment script' : 'Setup script',
      })),
    };
  }

  /**
   * Generate Docker deployment configuration
   */
  private async generateDockerConfig(
    request: DeploymentConfigRequest,
    configJson: string
  ): Promise<DeploymentConfigResult> {
    if (!request.projectContext?.projectPath) {
      throw new Error('Project path is required for Docker configuration');
    }

    const files = this.parseConfigFiles(configJson);

    // If we couldn't parse structured files, treat the whole response as Dockerfile
    if (files.length === 0) {
      files.push({
        fileName: 'Dockerfile',
        content: configJson,
      });
    }

    await this.writeConfigFiles(files, request.projectContext.projectPath);
    await this.createSummaryFile('docker', files, request.projectContext.projectPath);

    return {
      configType: 'docker',
      files: files.map((f) => ({
        fileName: f.fileName,
        description: 'Docker configuration file',
      })),
    };
  }

  /**
   * Generate Kubernetes deployment configuration
   */
  private async generateKubernetesConfig(
    request: DeploymentConfigRequest,
    configJson: string
  ): Promise<DeploymentConfigResult> {
    if (!request.projectContext?.projectPath) {
      throw new Error('Project path is required for Kubernetes configuration');
    }

    let files = this.parseConfigFiles(configJson);

    // Filter out Docker-related files from Kubernetes configs
    files = files.filter(
      (f) =>
        f.fileName !== 'Dockerfile' &&
        f.fileName !== '.dockerignore' &&
        f.fileName !== 'docker-compose.yml'
    );

    // If we couldn't parse structured files, treat the whole response as deployment.yaml
    if (files.length === 0) {
      files.push({
        fileName: 'deployment.yaml',
        content: configJson,
      });
    }

    await this.writeConfigFiles(files, request.projectContext.projectPath);
    await this.createSummaryFile('kubernetes', files, request.projectContext.projectPath);

    return {
      configType: 'kubernetes',
      files: files.map((f) => ({
        fileName: f.fileName,
        description: 'Kubernetes configuration file',
      })),
    };
  }

  /**
   * Generate deployment configuration
   * Note: Groq has limitations on output tokens, so we've implemented dynamic token limits based on config type
   */
  async generateDeploymentConfig(
    request: DeploymentConfigRequest
  ): Promise<DeploymentConfigResult> {
    if (!this.ready || !this.config) {
      throw new Error('Provider not initialized');
    }

    // Validate token limit
    const maxTokens = this.config.settings?.maxTokens || 4096;
    const tokenLimit = request.configType === 'bash' ? 20000 : 30000;
    if (maxTokens > tokenLimit) {
      throw new Error(
        `Groq provider has a maximum token limit of ${tokenLimit} per run for ${request.configType} configurations.`
      );
    }

    try {
      // Build prompts
      const configPrompt = PromptTemplates.buildConfigPrompt(request);
      const systemPrompt = PromptTemplates.getConfigGenerationSystemPrompt();

      // Enhance system prompt for Groq to be more explicit about generating all required files
      let enhancedSystemPrompt = `${systemPrompt}\n\nIMPORTANT: For ${request.configType} configurations, you MUST generate ALL required files as specified:`;

      if ((request.configType as string) === 'bash') {
        enhancedSystemPrompt +=
          '\n- deploy.sh (main deployment script)\n- setup.sh (setup/initialization script)';
      } else if ((request.configType as string) === 'docker') {
        enhancedSystemPrompt +=
          '\n- Dockerfile (main container definition)\n- .dockerignore (files to exclude from build context)\n- _summary.json (metadata file)';
      } else if ((request.configType as string) === 'kubernetes') {
        enhancedSystemPrompt +=
          '\n- deployment.yaml\n- service.yaml\n- ingress.yaml (for web-facing apps)\n- configmap.yaml (for configuration data)\n- _summary.json (metadata file)';
      }

      enhancedSystemPrompt +=
        '\n\nUse the <write_file> format to generate each file:\n<write_file>\n<path>filename</path>\n<content>\nFile content here\n</content>\n</write_file>\n\nGenerate ALL applicable files based on the project analysis. Do not omit any required files due to token limits - use the available token budget efficiently.\n\nFor bash configurations, create both deploy.sh and setup.sh files with appropriate content for each. Do NOT include any analysis text or tool-calling syntax - only generate the actual script files.\n\nIMPORTANT: For Kubernetes configurations, do NOT generate Docker-related files (Dockerfile, .dockerignore, docker-compose.yml). Only generate Kubernetes YAML files (deployment.yaml, service.yaml, ingress.yaml, configmap.yaml, etc.).';

      // Send request to Groq API with timeout
      const response = await Promise.race([
        axios.post(
          `${this.baseUrl}/chat/completions`,
          {
            model: this.config.model,
            messages: [
              { role: 'system', content: enhancedSystemPrompt },
              { role: 'user', content: configPrompt },
            ],
            temperature: 0.7,
            max_tokens: (request.configType as string) === 'bash' ? 3000 : 6000,
          },
          {
            headers: {
              Authorization: `Bearer ${this.config.apiKey}`,
              'Content-Type': 'application/json',
            },
            timeout: 60000,
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

      // Validate response
      if (!data || !data.choices || data.choices.length === 0) {
        throw new Error(
          `Groq API returned invalid response for deployment config: ${JSON.stringify(data)}`
        );
      }

      const choice = data.choices[0];
      const configJson = choice.message?.content;

      if (!configJson || configJson.trim().length === 0) {
        const modelInfo = data.model || this.config.model || 'unknown';
        const usageInfo = data.usage
          ? `Prompt tokens: ${data.usage.prompt_tokens}, Completion tokens: ${data.usage.completion_tokens}`
          : 'No usage info';

        throw new Error(
          `Groq API returned empty or whitespace-only response for deployment config. Model: ${modelInfo}, Usage: ${usageInfo}. Response: ${JSON.stringify(data)}`
        );
      }

      // Route to appropriate config generator
      if ((request.configType as string) === 'bash') {
        return await this.generateBashConfig(request, configJson);
      } else if ((request.configType as string) === 'docker') {
        return await this.generateDockerConfig(request, configJson);
      } else if ((request.configType as string) === 'kubernetes') {
        return await this.generateKubernetesConfig(request, configJson);
      } else {
        // For other config types, try to parse as JSON or fallback to file parsing
        try {
          const configResult = extractJsonFromResponse(configJson);

          if (!configResult || typeof configResult !== 'object') {
            throw new Error(
              `Deployment config result is not a valid object. Response: ${configJson}`
            );
          }

          if (!configResult.configType) {
            configResult.configType = request.configType;
          }

          // Write files to disk if provided
          if (
            configResult.files &&
            Array.isArray(configResult.files) &&
            request.projectContext?.projectPath
          ) {
            await this.writeConfigFiles(configResult.files, request.projectContext.projectPath);

            // Ensure required fields exist
            if (!configResult.deployment) {
              configResult.deployment = {
                instructions: `## ${request.configType.charAt(0).toUpperCase() + request.configType.slice(1)} Configuration Instructions

### Prerequisites
- Ensure all dependencies are installed

### Steps
1. Review the generated configuration files
2. Apply according to your deployment platform`,
                buildCommand: `echo "Review configuration files"`,
                runCommand: `echo "Apply to your platform"`,
              };
            }

            if (!configResult.projectSummary) {
              configResult.projectSummary = {
                overview: `${request.configType.charAt(0).toUpperCase() + request.configType.slice(1)} configuration`,
                framework: 'Generic',
                runtime: 'N/A',
                buildTool: request.configType,
                isMultiService: false,
                services: ['main app'],
                mainPort: 3000,
              };
            }

            if (!configResult.environmentVariables) {
              configResult.environmentVariables = {
                required: [],
                optional: [],
              };
            }

            if (!configResult.integrations) {
              configResult.integrations = {
                detected: [],
              };
            }

            if (!configResult.recommendations) {
              configResult.recommendations = [
                'Review the generated configuration files',
                'Ensure all placeholders are properly replaced',
                'Test in a staging environment first',
              ];
            }

            if (!configResult.optimization) {
              configResult.optimization = {
                features: [
                  'Generated configuration files',
                  'Platform-specific deployment instructions',
                ],
              };
            }

            // Create summary file
            const fs = await import('fs/promises');
            const path = await import('path');
            const summaryPath = path.join(request.projectContext.projectPath, '_summary.json');
            await fs.writeFile(summaryPath, JSON.stringify(configResult, null, 2), 'utf-8');
          }

          return configResult;
        } catch (parseError) {
          // If JSON parsing fails, try to parse as files
          if (!request.projectContext?.projectPath) {
            return {
              configType: request.configType,
              files: [],
            };
          }

          const files = this.parseConfigFiles(configJson);

          if (files.length > 0) {
            await this.writeConfigFiles(files, request.projectContext.projectPath);
            await this.createSummaryFile(
              request.configType,
              files,
              request.projectContext.projectPath
            );

            return {
              configType: request.configType,
              files: files.map((f) => ({
                fileName: f.fileName,
                description: `${request.configType} configuration file`,
              })),
            };
          } else {
            // Final fallback: treat as single file
            const fs = await import('fs/promises');
            const path = await import('path');
            const fileName = `${request.configType}.txt`;
            const filePath = path.join(request.projectContext.projectPath, fileName);
            const content = configJson;

            await fs.writeFile(filePath, content, 'utf-8');

            const singleFile = [{ fileName, content }];
            await this.createSummaryFile(
              request.configType,
              singleFile,
              request.projectContext.projectPath
            );

            return {
              configType: request.configType,
              files: [
                {
                  fileName: fileName,
                  description: `${request.configType} configuration`,
                },
              ],
            };
          }
        }
      }
    } catch (error: any) {
      // Handle rate limiting
      if (error.response?.status === 429) {
        throw new Error('Free provider limit reached. Please wait or upgrade.');
      }

      // Handle invalid API key
      if (error.response?.status === 401) {
        throw new Error('Invalid Groq API key.');
      }

      // Handle bad request (400)
      if (error.response?.status === 400) {
        const errorMsg = error.response?.data?.error?.message || error.message;
        throw new Error(`Groq API request failed (400 Bad Request): ${errorMsg}`);
      }

      // Handle other errors
      throw new Error(`Groq API request failed: ${error.message}`);
    }
  }

  /**
   * Parse config files from AI response content
   * Handles XML-like tags and markdown formats
   */
  private parseConfigFiles(content: string): Array<{ fileName: string; content: string }> {
    // Try XML-like format first (<write_file> tags)
    const writeFileTagMatches = content.matchAll(
      /<write_file>\s*<path>([^<]+)<\/path>\s*<content>([\s\S]*?)<\/content>\s*<\/write_file>/g
    );
    const writeFileTagFiles = Array.from(writeFileTagMatches).map((match) => {
      const typedMatch = match as RegExpMatchArray;
      return {
        fileName: typedMatch[1].trim(),
        content: typedMatch[2].trim(),
      };
    });

    if (writeFileTagFiles.length > 0) {
      return writeFileTagFiles;
    }

    // Try <write> tags
    const writeTagMatches = content.matchAll(
      /<write>\s*<path>([^<]+)<\/path>\s*<content>([\s\S]*?)<\/content>\s*<\/write>/gi
    );
    const writeTagFiles = Array.from(writeTagMatches).map((match) => {
      const typedMatch = match as RegExpMatchArray;
      return {
        fileName: typedMatch[1].trim(),
        content: typedMatch[2].trim(),
      };
    });

    if (writeTagFiles.length > 0) {
      return writeTagFiles;
    }

    // Try <Use the Write tool> tags
    const useWriteTagMatches = content.matchAll(
      /<Use the Write tool>\s*<path>([^<]+)<\/path>\s*<content>([\s\S]*?)<\/content>\s*<\/Use the Write>/gi
    );
    const useWriteTagFiles = Array.from(useWriteTagMatches).map((match) => {
      const typedMatch = match as RegExpMatchArray;
      return {
        fileName: typedMatch[1].trim(),
        content: typedMatch[2].trim(),
      };
    });

    if (useWriteTagFiles.length > 0) {
      return useWriteTagFiles;
    }

    // Try <Use the Write> tags
    const useWriteMatches = content.matchAll(
      /<Use the Write>\s*<path>([^<]+)<\/path>\s*<content>([\s\S]*?)<\/content>\s*<\/Use the Write>/g
    );
    const useWriteFiles = Array.from(useWriteMatches).map((match) => {
      const typedMatch = match as RegExpMatchArray;
      return {
        fileName: typedMatch[1].trim(),
        content: typedMatch[2].trim(),
      };
    });

    if (useWriteFiles.length > 0) {
      return useWriteFiles;
    }

    // Fallback to markdown parsing
    return this.parseMarkdownFiles(content);
  }

  /**
   * Parse markdown format files from content
   */
  private parseMarkdownFiles(content: string): Array<{ fileName: string; content: string }> {
    const files: Array<{ fileName: string; content: string }> = [];
    const lines = content.split('\n');
    let currentFile: string | null = null;
    let collectingContent = false;
    let fileContent = '';

    for (const line of lines) {
      // Check if this line indicates a new file
      const setupMatch = line.match(/###\s*setup\.sh/i);
      const deployMatch = line.match(/###\s*deploy\.sh/i);
      const dockerfileMatch = line.match(/###\s*Dockerfile/i);
      const dockerComposeMatch = line.match(/###\s*docker-compose\.yml/i);
      const dockerignoreMatch = line.match(/###\s*\.dockerignore/i);
      const deploymentMatch = line.match(/###\s*deployment\.ya?ml/i);
      const serviceMatch = line.match(/###\s*service\.ya?ml/i);
      const ingressMatch = line.match(/###\s*ingress\.ya?ml/i);
      const configmapMatch = line.match(/###\s*configmap\.ya?ml/i);
      const hpaMatch = line.match(/###\s*hpa\.ya?ml/i);
      const secretMatch = line.match(/###\s*secret\.ya?ml/i);

      // Handle different file types
      if (
        setupMatch ||
        deployMatch ||
        dockerfileMatch ||
        dockerComposeMatch ||
        dockerignoreMatch ||
        deploymentMatch ||
        serviceMatch ||
        ingressMatch ||
        configmapMatch ||
        hpaMatch ||
        secretMatch
      ) {
        // Save previous file if exists
        if (currentFile && fileContent) {
          files.push({
            fileName: currentFile,
            content: fileContent.trim(),
          });
          fileContent = '';
        }

        // Set the new current file
        if (setupMatch) {
          currentFile = 'setup.sh';
        } else if (deployMatch) {
          currentFile = 'deploy.sh';
        } else if (dockerfileMatch) {
          currentFile = 'Dockerfile';
        } else if (dockerComposeMatch) {
          currentFile = 'docker-compose.yml';
        } else if (dockerignoreMatch) {
          currentFile = '.dockerignore';
        } else if (deploymentMatch) {
          currentFile = deploymentMatch[0].includes('.yml') ? 'deployment.yml' : 'deployment.yaml';
        } else if (serviceMatch) {
          currentFile = serviceMatch[0].includes('.yml') ? 'service.yml' : 'service.yaml';
        } else if (ingressMatch) {
          currentFile = ingressMatch[0].includes('.yml') ? 'ingress.yml' : 'ingress.yaml';
        } else if (configmapMatch) {
          currentFile = configmapMatch[0].includes('.yml') ? 'configmap.yml' : 'configmap.yaml';
        } else if (hpaMatch) {
          currentFile = hpaMatch[0].includes('.yml') ? 'hpa.yml' : 'hpa.yaml';
        } else if (secretMatch) {
          currentFile = secretMatch[0].includes('.yml') ? 'secret.yml' : 'secret.yaml';
        }
        collectingContent = false;
      } else if (line.startsWith('```') && currentFile) {
        // Toggle collecting content when we encounter code block markers
        collectingContent = !collectingContent;
      } else if (collectingContent && currentFile) {
        // Collect content for the current file
        fileContent += `${line}\n`;
      }
    }

    // Don't forget the last file
    if (currentFile && fileContent) {
      files.push({
        fileName: currentFile,
        content: fileContent.trim(),
      });
    }

    return files;
  }

  /**
   * Write config files to disk
   * Centralizes fs/path imports
   */
  private async writeConfigFiles(
    files: Array<{ fileName: string; content: string }>,
    projectPath: string
  ): Promise<void> {
    const fs = await import('fs/promises');
    const path = await import('path');

    for (const file of files) {
      if (file.fileName && file.content) {
        const filePath = path.join(projectPath, file.fileName);
        await fs.writeFile(filePath, file.content, 'utf-8');
      }
    }
  }

  /**
   * Create summary file with deployment configuration metadata
   */
  private async createSummaryFile(
    configType: string,
    files: Array<{ fileName: string; content: string }>,
    projectPath: string
  ): Promise<void> {
    const fs = await import('fs/promises');
    const path = await import('path');

    const summary = this.buildSummaryObject(configType, files);
    const summaryPath = path.join(projectPath, '_summary.json');
    await fs.writeFile(summaryPath, JSON.stringify(summary, null, 2), 'utf-8');
  }

  /**
   * Build summary object for deployment configuration
   */
  private buildSummaryObject(
    configType: string,
    files: Array<{ fileName: string; content: string }>
  ): any {
    const isDocker = configType === 'docker' || configType === 'docker-compose';
    const isKubernetes = configType === 'kubernetes';
    const isBash = configType === 'bash';

    return {
      configType: configType,
      files: files.map((f) => ({
        fileName: f.fileName,
        description:
          isBash && f.fileName === 'deploy.sh'
            ? 'Deployment script'
            : isBash && f.fileName === 'setup.sh'
              ? 'Setup script'
              : `${configType} configuration file`,
      })),
      deployment: {
        instructions: isBash
          ? '## Deployment Instructions\n\n### Prerequisites\n- Ensure all dependencies are installed\n- Set up required environment variables\n\n### Steps\n1. Run the setup script: `chmod +x setup.sh && ./setup.sh`\n2. Run the deployment script: `chmod +x deploy.sh && ./deploy.sh`'
          : isDocker
            ? '## Docker Deployment Instructions\n\n### Prerequisites\n- Docker installed\n- Environment variables configured\n\n### Steps\n1. Build the image: `docker build -t myapp .`\n2. Run the container: `docker run -p 3000:3000 --env-file .env myapp`'
            : isKubernetes
              ? '## Kubernetes Deployment Instructions\n\n### Prerequisites\n- kubectl configured\n- Kubernetes cluster access\n- Environment variables configured\n\n### Steps\n1. Apply the manifests: `kubectl apply -f .`\n2. Check the deployment: `kubectl get deployments`\n3. Check the service: `kubectl get services`'
              : '## Deployment Instructions\n\n### Prerequisites\n- Ensure all dependencies are installed\n\n### Steps\n1. Review the generated configuration files\n2. Apply according to your deployment platform',
        buildCommand: isBash
          ? './setup.sh'
          : isDocker
            ? 'docker build -t myapp .'
            : isKubernetes
              ? 'kubectl apply -f .'
              : `echo "Review configuration files"`,
        runCommand: isBash
          ? './deploy.sh'
          : isDocker
            ? 'docker run -p 3000:3000 myapp'
            : isKubernetes
              ? 'kubectl get deployments'
              : `echo "Apply to your platform"`,
      },
      projectSummary: {
        overview: `${configType.charAt(0).toUpperCase() + configType.slice(1)} deployment configuration`,
        framework: isDocker ? 'Docker' : isKubernetes ? 'Kubernetes' : isBash ? 'Bash' : 'Generic',
        runtime: isDocker ? 'Container' : isKubernetes ? 'Kubernetes' : isBash ? 'Shell' : 'N/A',
        buildTool: configType,
        isMultiService: false,
        services: ['main app'],
        mainPort: 3000,
      },
      environmentVariables: {
        required: [],
        optional: [],
      },
      integrations: {
        detected: [],
      },
      recommendations: isBash
        ? [
            'Review the generated scripts before running in production',
            'Ensure proper permissions are set on the scripts',
            'Test the deployment in a staging environment first',
          ]
        : [
            'Review the generated configuration files before deploying',
            'Ensure all environment variables are properly configured',
            'Test the deployment in a staging environment first',
          ],
      optimization: {
        features: isDocker
          ? [
              'Multi-stage builds for faster rebuilds',
              'Layer caching for dependencies',
              'Alpine base image for smaller size',
            ]
          : isKubernetes
            ? [
                'Resource limits and requests configured',
                'Liveness and readiness probes',
                'ConfigMaps for configuration',
              ]
            : isBash
              ? [
                  'Production-ready deployment scripts',
                  'Error handling and logging',
                  'Environment variable validation',
                ]
              : ['Generated configuration files', 'Platform-specific deployment instructions'],
      },
    };
  }

  /**
   * Check if provider is ready
   */
  isReady(): boolean {
    return this.ready && this.config !== null;
  }

  /**
   * Get detailed models information
   * For Groq, we'll return static information about supported models
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
    // Groq models with their details
    return [
      {
        id: 'moonshotai/kimi-k2-instruct',
        name: 'Kimi K2 Instruct',
        pricing: { prompt: 'Free', completion: 'Free' },
        contextLength: 8192,
        isFree: true,
      },
      {
        id: 'openai/gpt-oss-120b',
        name: 'GPT OSS 120B',
        pricing: { prompt: 'Free', completion: 'Free' },
        contextLength: 8192,
        isFree: true,
      },
      {
        id: 'llama-3.3-70b-versatile',
        name: 'LLaMA 3.3 70B Versatile',
        pricing: { prompt: 'Free', completion: 'Free' },
        contextLength: 8192,
        isFree: true,
      },
      {
        id: 'llama-3.1-8b-instant',
        name: 'LLaMA 3.1 8B Instant',
        pricing: { prompt: 'Free', completion: 'Free' },
        contextLength: 8192,
        isFree: true,
      },
      {
        id: 'qwen/qwen3-32b',
        name: 'Qwen3 32B',
        pricing: { prompt: 'Free', completion: 'Free' },
        contextLength: 8192,
        isFree: true,
      },
    ];
  }
}
