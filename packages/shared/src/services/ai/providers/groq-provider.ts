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
      'whisper-large-v3',
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
   * Generate deployment configuration
   * Note: Groq has limitations on output tokens, so we've implemented dynamic token limits based on config type
   */
  async generateDeploymentConfig(
    request: DeploymentConfigRequest
  ): Promise<DeploymentConfigResult> {
    if (!this.ready || !this.config) {
      throw new Error('Provider not initialized');
    }

    // Check token limit - increase limit for Docker/Kubernetes configs
    const maxTokens = this.config.settings?.maxTokens || 4096;
    const tokenLimit = request.configType === 'bash' ? 20000 : 30000;
    if (maxTokens > tokenLimit) {
      throw new Error(
        `Groq provider has a maximum token limit of ${tokenLimit} per run for ${request.configType} configurations.`
      );
    }

    try {
      // Use centralized prompt template
      const configPrompt = PromptTemplates.buildConfigPrompt(request);

      // Add system prompt
      const systemPrompt = PromptTemplates.getConfigGenerationSystemPrompt();

      // Enhance system prompt for Groq to be more explicit about generating all required files
      let enhancedSystemPrompt = `${systemPrompt}\n\nIMPORTANT: For ${request.configType} configurations, you MUST generate ALL required files as specified:`;

      if ((request.configType as string) === 'bash') {
        enhancedSystemPrompt +=
          '\n- deploy.sh (main deployment script)\n- setup.sh (setup/initialization script)';
      } else if ((request.configType as string) === 'docker') {
        enhancedSystemPrompt +=
          '\n- Dockerfile (main container definition)\n- .dockerignore (files to exclude from build context)\n- .env.example (environment variable template)\n- _summary.json (metadata file)';
      } else if ((request.configType as string) === 'kubernetes') {
        enhancedSystemPrompt +=
          '\n- deployment.yaml\n- service.yaml\n- ingress.yaml (for web-facing apps)\n- configmap.yaml (for configuration data)\n- _summary.json (metadata file)';
      }

      enhancedSystemPrompt +=
        '\n\nUse the <write_file> format to generate each file:\n<write_file>\n<path>filename</path>\n<content>\nFile content here\n</content>\n</write_file>\n\nGenerate ALL applicable files based on the project analysis. Do not omit any required files due to token limits - use the available token budget efficiently.\n\nFor bash configurations, create both deploy.sh and setup.sh files with appropriate content for each.';

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
            max_tokens: (request.configType as string) === 'bash' ? 3000 : 6000, // Higher token limit for complex configs
          },
          {
            headers: {
              Authorization: `Bearer ${this.config.apiKey}`,
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
          `Groq API returned invalid response for deployment config: ${JSON.stringify(data)}`
        );
      }

      const choice = data.choices[0];
      const configJson = choice.message?.content;

      // Check for empty or whitespace-only responses
      if (!configJson || configJson.trim().length === 0) {
        // Log more detailed information about the response
        const modelInfo = data.model || this.config.model || 'unknown';
        const usageInfo = data.usage
          ? `Prompt tokens: ${data.usage.prompt_tokens}, Completion tokens: ${data.usage.completion_tokens}`
          : 'No usage info';

        throw new Error(
          `Groq API returned empty or whitespace-only response for deployment config. Model: ${modelInfo}, Usage: ${usageInfo}. Response: ${JSON.stringify(data)}`
        );
      }

      // For all config types, we need to handle the response appropriately
      // If it's a direct file response (like bash scripts), write it to disk
      // If it's JSON with file information, parse and write files

      const fs = await import('fs/promises');
      const path = await import('path');

      // Ensure the config directory exists
      if (request.projectContext?.projectPath) {
        // For configs where the AI returns file content directly (bash, docker, kubernetes)
        if (
          (request.configType as string) === 'bash' ||
          (request.configType as string) === 'docker' ||
          (request.configType as string) === 'kubernetes'
        ) {
          // For bash, parse the response to extract both deploy.sh and setup.sh
          if ((request.configType as string) === 'bash') {
            // Try to parse the response to extract file names and content
            // Parse the response to extract file names and content
            // The response format is markdown with file headers and code blocks
            const lines = configJson.split('\n');
            let currentFile = null;
            let collectingContent = false;
            let fileContent = '';
            const files = [];

            for (const line of lines) {
              // Check if this line indicates a new file
              const setupMatch = line.match(/###\s*setup\.sh/);
              const deployMatch = line.match(/###\s*deploy\.sh/);

              // Handle different file types
              if (setupMatch) {
                // Save previous file if exists
                if (currentFile && fileContent) {
                  files.push({
                    fileName: currentFile,
                    content: fileContent.trim(),
                  });
                  fileContent = '';
                }
                currentFile = 'setup.sh';
                collectingContent = false;
              } else if (deployMatch) {
                // Save previous file if exists
                if (currentFile && fileContent) {
                  files.push({
                    fileName: currentFile,
                    content: fileContent.trim(),
                  });
                  fileContent = '';
                }
                currentFile = 'deploy.sh';
                collectingContent = false;
              } else if (line.startsWith('```bash')) {
                // Start collecting content
                collectingContent = true;
              } else if (line.startsWith('```') && collectingContent) {
                // End collecting content
                collectingContent = false;
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

            // If we couldn't parse structured files, treat the whole response as deploy.sh
            if (files.length === 0) {
              files.push({
                fileName: 'deploy.sh',
                content: configJson,
              });

              // Create a basic setup.sh file
              files.push({
                fileName: 'setup.sh',
                content:
                  '#!/bin/bash\n\n# Basic setup script\necho "Running setup..."\n\n# Add your setup commands here\n\necho "Setup complete."\n',
              });
            }

            // Write all files to disk
            for (const file of files) {
              if (file.fileName && file.content) {
                let content = file.content;

                // Special handling for .env.example files to ensure placeholders instead of actual values
                if (file.fileName === '.env.example') {
                  content = this.processEnvExampleContent(content);
                }

                const filePath = path.join(request.projectContext.projectPath, file.fileName);
                await fs.writeFile(filePath, content, 'utf-8');
              }
            }

            // Create a summary file with proper structure
            const summary = {
              configType: 'bash',
              files: files.map((f) => ({
                fileName: f.fileName,
                description: f.fileName === 'deploy.sh' ? 'Deployment script' : 'Setup script',
              })),
              // Add deployment instructions and commands
              deployment: {
                instructions:
                  '## Deployment Instructions\n\n### Prerequisites\n- Ensure all dependencies are installed\n- Set up required environment variables\n\n### Steps\n1. Run the setup script: `chmod +x setup.sh && ./setup.sh`\n2. Run the deployment script: `chmod +x deploy.sh && ./deploy.sh`',
                buildCommand: './setup.sh',
                runCommand: './deploy.sh',
              },
              // Add basic project information
              projectSummary: {
                overview: 'Bash deployment configuration',
                framework: 'Bash',
                runtime: 'Shell',
                buildTool: 'bash',
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
              recommendations: [
                'Review the generated scripts before running in production',
                'Ensure proper permissions are set on the scripts',
                'Test the deployment in a staging environment first',
              ],
              optimization: {
                features: [
                  'Production-ready deployment scripts',
                  'Error handling and logging',
                  'Environment variable validation',
                ],
              },
            };

            const summaryPath = path.join(request.projectContext.projectPath, '_summary.json');
            await fs.writeFile(summaryPath, JSON.stringify(summary, null, 2), 'utf-8');

            // Return the result structure that the system expects
            return {
              configType: 'bash',
              files: files.map((f) => ({
                fileName: f.fileName,
                description: f.fileName === 'deploy.sh' ? 'Deployment script' : 'Setup script',
              })),
            };
          }
          // For docker and kubernetes, parse the response to extract files
          else {
            // Parse the response to extract file names and content
            // The response format can be markdown with file headers and code blocks OR XML-like tags
            let files: Array<{ fileName: string; content: string }> = [];

            // First try to parse XML-like format (<write> tags)
            const writeTagMatches = configJson.matchAll(
              /<write>\s*<path>([^<]+)<\/path>\s*<content>([\s\S]*?)<\/content>\s*<\/write>/g
            );
            const writeTagFiles = Array.from(writeTagMatches).map((match) => {
              const typedMatch = match as RegExpMatchArray;
              return {
                fileName: typedMatch[1].trim(),
                content: typedMatch[2].trim(),
              };
            });

            if (writeTagFiles.length > 0) {
              files = writeTagFiles;
            } else {
              // Try another XML-like format pattern that might be used (<write_file> tags)
              const writeFileTagMatches = configJson.matchAll(
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
                files = writeFileTagFiles;
              } else {
                // Try another XML-like format pattern that might be used (<Use the Write tool>)
                const useWriteTagMatches = configJson.matchAll(
                  /<Use the Write tool>\s*<path>([^<]+)<\/path>\s*<content>([\s\S]*?)<\/content>\s*<\/Use the Write>/g
                );
                const useWriteTagFiles = Array.from(useWriteTagMatches).map((match) => {
                  const typedMatch = match as RegExpMatchArray;
                  return {
                    fileName: typedMatch[1].trim(),
                    content: typedMatch[2].trim(),
                  };
                });

                if (useWriteTagFiles.length > 0) {
                  files = useWriteTagFiles;
                } else {
                  // Try another XML-like format pattern that might be used (<Use the Write tool> with different formatting)
                  const altUseWriteTagMatches = configJson.matchAll(
                    /<Use the Write tool>\s*<path>([^<]+)<\/path>\s*<content>([\s\S]*?)<\/content>\s*<\/Use the Write>/gi
                  );
                  const altUseWriteTagFiles = Array.from(altUseWriteTagMatches).map((match) => {
                    const typedMatch = match as RegExpMatchArray;
                    return {
                      fileName: typedMatch[1].trim(),
                      content: typedMatch[2].trim(),
                    };
                  });

                  if (altUseWriteTagFiles.length > 0) {
                    files = altUseWriteTagFiles;
                  } else {
                    // Try another XML-like format pattern that might be used (<Use the Write>)
                    const useWriteMatches = configJson.matchAll(
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
                      files = useWriteFiles;
                    } else {
                      // Try another XML-like format pattern that might be used (with different closing tag)
                      const altWriteTagMatches = configJson.matchAll(
                        /<write>\s*<path>([^<]+)<\/path>\s*<content>([\s\S]*?)<\/content>\s*<\/write>/gi
                      );
                      const altWriteTagFiles = Array.from(altWriteTagMatches).map((match) => {
                        const typedMatch = match as RegExpMatchArray;
                        return {
                          fileName: typedMatch[1].trim(),
                          content: typedMatch[2].trim(),
                        };
                      });

                      if (altWriteTagFiles.length > 0) {
                        files = altWriteTagFiles;
                      } else {
                        // Fallback to markdown parsing
                        const lines = configJson.split('\n');
                        let currentFile: string | null = null;
                        let collectingContent = false;
                        let fileContent = '';

                        for (const line of lines) {
                          // Check if this line indicates a new file
                          const dockerfileMatch = line.match(/###\s*Dockerfile/);
                          const dockerComposeMatch = line.match(/###\s*docker-compose\.yml/);
                          const dockerignoreMatch = line.match(/###\s*\.dockerignore/);
                          const deploymentMatch = line.match(/###\s*deployment\.ya?ml/); // Handle both .yaml and .yml
                          const serviceMatch = line.match(/###\s*service\.ya?ml/); // Handle both .yaml and .yml
                          const ingressMatch = line.match(/###\s*ingress\.ya?ml/); // Handle both .yaml and .yml
                          const configmapMatch = line.match(/###\s*configmap\.ya?ml/); // Handle both .yaml and .yml
                          const setupMatch = line.match(/###\s*setup\.sh/);
                          const envExampleMatch = line.match(/###\s*\.env\.example/);
                          const hpaMatch = line.match(/###\s*hpa\.ya?ml/); // Handle both .yaml and .yml
                          const secretMatch = line.match(/###\s*secret\.ya?ml/); // Handle both .yaml and .yml
                          const deployScriptMatch = line.match(/###\s*deploy\.sh/);

                          // Handle different file types based on config type
                          if (
                            dockerfileMatch ||
                            dockerComposeMatch ||
                            dockerignoreMatch ||
                            envExampleMatch ||
                            deploymentMatch ||
                            serviceMatch ||
                            ingressMatch ||
                            configmapMatch ||
                            setupMatch ||
                            hpaMatch ||
                            secretMatch ||
                            deployScriptMatch
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
                            if (dockerfileMatch) {
                              currentFile = 'Dockerfile';
                            } else if (dockerComposeMatch) {
                              currentFile = 'docker-compose.yml';
                            } else if (dockerignoreMatch) {
                              currentFile = '.dockerignore';
                            } else if (envExampleMatch) {
                              currentFile = '.env.example';
                            } else if (deploymentMatch) {
                              // Check if it's .yml or .yaml
                              currentFile = deploymentMatch[0].includes('.yml')
                                ? 'deployment.yml'
                                : 'deployment.yaml';
                            } else if (serviceMatch) {
                              // Check if it's .yml or .yaml
                              currentFile = serviceMatch[0].includes('.yml')
                                ? 'service.yml'
                                : 'service.yaml';
                            } else if (ingressMatch) {
                              // Check if it's .yml or .yaml
                              currentFile = ingressMatch[0].includes('.yml')
                                ? 'ingress.yml'
                                : 'ingress.yaml';
                            } else if (configmapMatch) {
                              // Check if it's .yml or .yaml
                              currentFile = configmapMatch[0].includes('.yml')
                                ? 'configmap.yml'
                                : 'configmap.yaml';
                            } else if (setupMatch) {
                              currentFile = 'setup.sh';
                            } else if (hpaMatch) {
                              // Check if it's .yml or .yaml
                              currentFile = hpaMatch[0].includes('.yml') ? 'hpa.yml' : 'hpa.yaml';
                            } else if (secretMatch) {
                              // Check if it's .yml or .yaml
                              currentFile = secretMatch[0].includes('.yml')
                                ? 'secret.yml'
                                : 'secret.yaml';
                            } else if (deployScriptMatch) {
                              currentFile = 'deploy.sh';
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
                      }
                    }
                  }
                }
              }
            }

            // If we couldn't parse structured files, treat the whole response as a single file
            if (files.length === 0) {
              console.log('Could not parse structured files, using fallback approach');
              let fileName;
              if ((request.configType as string) === 'docker') {
                fileName = 'Dockerfile';
              } else if ((request.configType as string) === 'kubernetes') {
                fileName = 'deployment.yaml';
              } else {
                fileName = `${request.configType}.txt`;
              }
              files.push({
                fileName: fileName,
                content: configJson,
              });
            }

            // Write all files to disk
            for (const file of files) {
              if (file.fileName && file.content) {
                let content = file.content;

                // Special handling for .env.example files to ensure placeholders instead of actual values
                if (file.fileName === '.env.example') {
                  content = this.processEnvExampleContent(content);
                }

                const filePath = path.join(request.projectContext.projectPath, file.fileName);
                await fs.writeFile(filePath, content, 'utf-8');
              }
            }

            // Create a summary file
            const summary = {
              configType: request.configType,
              files: files.map((f) => ({
                fileName: f.fileName,
                description: `${request.configType} configuration file`,
              })),
              // Add deployment instructions and commands
              deployment: {
                instructions:
                  (request.configType as string) === 'docker' ||
                  (request.configType as string) === 'docker-compose'
                    ? '## Docker Deployment Instructions\n\n### Prerequisites\n- Docker installed\n- Environment variables configured\n\n### Steps\n1. Build the image: `docker build -t myapp .`\n2. Run the container: `docker run -p 3000:3000 --env-file .env myapp`'
                    : (request.configType as string) === 'kubernetes'
                      ? '## Kubernetes Deployment Instructions\n\n### Prerequisites\n- kubectl configured\n- Kubernetes cluster access\n- Environment variables configured\n\n### Steps\n1. Apply the manifests: `kubectl apply -f .`\n2. Check the deployment: `kubectl get deployments`\n3. Check the service: `kubectl get services`'
                      : '## Deployment Instructions\n\n### Prerequisites\n- Ensure all dependencies are installed\n\n### Steps\n1. Review the generated configuration files\n2. Apply according to your deployment platform',
                buildCommand:
                  (request.configType as string) === 'docker' ||
                  (request.configType as string) === 'docker-compose'
                    ? 'docker build -t myapp .'
                    : (request.configType as string) === 'kubernetes'
                      ? 'kubectl apply -f .'
                      : `echo "Review configuration files"`,
                runCommand:
                  (request.configType as string) === 'docker' ||
                  (request.configType as string) === 'docker-compose'
                    ? 'docker run -p 3000:3000 myapp'
                    : (request.configType as string) === 'kubernetes'
                      ? 'kubectl get deployments'
                      : `echo "Apply to your platform"`,
              },
              // Add basic project information
              projectSummary: {
                overview: `${request.configType.charAt(0).toUpperCase() + request.configType.slice(1)} deployment configuration`,
                framework:
                  (request.configType as string) === 'docker' ||
                  (request.configType as string) === 'docker-compose'
                    ? 'Docker'
                    : (request.configType as string) === 'kubernetes'
                      ? 'Kubernetes'
                      : 'Generic',
                runtime:
                  (request.configType as string) === 'docker' ||
                  (request.configType as string) === 'docker-compose'
                    ? 'Container'
                    : (request.configType as string) === 'kubernetes'
                      ? 'Kubernetes'
                      : 'N/A',
                buildTool: request.configType,
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
              recommendations: [
                'Review the generated configuration files before deploying',
                'Ensure all environment variables are properly configured',
                'Test the deployment in a staging environment first',
              ],
              optimization: {
                features:
                  (request.configType as string) === 'docker' ||
                  (request.configType as string) === 'docker-compose'
                    ? [
                        'Multi-stage builds for faster rebuilds',
                        'Layer caching for dependencies',
                        'Alpine base image for smaller size',
                      ]
                    : (request.configType as string) === 'kubernetes'
                      ? [
                          'Resource limits and requests configured',
                          'Liveness and readiness probes',
                          'ConfigMaps for configuration',
                        ]
                      : [
                          'Generated configuration files',
                          'Platform-specific deployment instructions',
                        ],
              },
            };

            const summaryPath = path.join(request.projectContext.projectPath, '_summary.json');
            await fs.writeFile(summaryPath, JSON.stringify(summary, null, 2), 'utf-8');

            // Return the result structure that the system expects
            return {
              configType: request.configType,
              files: files.map((f) => ({
                fileName: f.fileName,
                description: `${request.configType} configuration file`,
              })),
            };
          }
        } else {
          // For other config types, try to parse as JSON
          try {
            const configResult = extractJsonFromResponse(configJson);

            // Basic validation for deployment config result
            if (!configResult || typeof configResult !== 'object') {
              throw new Error(
                `Deployment config result is not a valid object. Response: ${configJson}`
              );
            }

            // Ensure configResult has the required configType property
            if (!configResult.configType) {
              configResult.configType = request.configType;
            }

            // Write files to disk if they're provided in the response and projectPath exists
            const fs = await import('fs/promises');
            const path = await import('path');

            if (
              configResult.files &&
              Array.isArray(configResult.files) &&
              request.projectContext?.projectPath
            ) {
              const projectPath = request.projectContext.projectPath;
              for (const file of configResult.files) {
                if (file.fileName && file.content) {
                  let content = file.content;

                  // Special handling for .env.example files to ensure placeholders instead of actual values
                  if (file.fileName === '.env.example') {
                    content = this.processEnvExampleContent(content);
                  }

                  const filePath = path.join(projectPath, file.fileName);
                  await fs.writeFile(filePath, content, 'utf-8');
                }
              }

              // Create a summary file with proper structure if it doesn't exist in the response
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

              // Add other required fields if missing
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

              // Create a summary file
              const summaryPath = path.join(projectPath, '_summary.json');
              await fs.writeFile(summaryPath, JSON.stringify(configResult, null, 2), 'utf-8');
            }

            return configResult;
          } catch (parseError) {
            // If JSON parsing fails, check if we can extract files from the response
            const fs = await import('fs/promises');
            const path = await import('path');

            // Try to parse as individual files using our existing logic
            let files: Array<{ fileName: string; content: string }> = [];

            // Try XML-like format first (<write> tags)
            const writeTagMatches = configJson.matchAll(
              /<write>\s*<path>([^<]+)<\/path>\s*<content>([\s\S]*?)<\/content>\s*<\/write>/g
            );
            const writeTagFiles = Array.from(writeTagMatches).map((match) => {
              const typedMatch = match as RegExpMatchArray;
              return {
                fileName: typedMatch[1].trim(),
                content: typedMatch[2].trim(),
              };
            });

            if (writeTagFiles.length > 0) {
              files = writeTagFiles;
            } else {
              // Try another XML-like format pattern that might be used (<write_file> tags)
              const writeFileTagMatches = configJson.matchAll(
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
                files = writeFileTagFiles;
              } else {
                // Try another XML-like format pattern that might be used (<Use the Write tool>)
                const useWriteTagMatches = configJson.matchAll(
                  /<Use the Write tool>\s*<path>([^<]+)<\/path>\s*<content>([\s\S]*?)<\/content>\s*<\/Use the Write>/g
                );
                const useWriteTagFiles = Array.from(useWriteTagMatches).map((match) => {
                  const typedMatch = match as RegExpMatchArray;
                  return {
                    fileName: typedMatch[1].trim(),
                    content: typedMatch[2].trim(),
                  };
                });

                if (useWriteTagFiles.length > 0) {
                  files = useWriteTagFiles;
                } else {
                  // Try another XML-like format pattern that might be used (<Use the Write tool> with different formatting)
                  const altUseWriteTagMatches = configJson.matchAll(
                    /<Use the Write tool>\s*<path>([^<]+)<\/path>\s*<content>([\s\S]*?)<\/content>\s*<\/Use the Write>/gi
                  );
                  const altUseWriteTagFiles = Array.from(altUseWriteTagMatches).map((match) => {
                    const typedMatch = match as RegExpMatchArray;
                    return {
                      fileName: typedMatch[1].trim(),
                      content: typedMatch[2].trim(),
                    };
                  });

                  if (altUseWriteTagFiles.length > 0) {
                    files = altUseWriteTagFiles;
                  } else {
                    // Try another XML-like format pattern that might be used (<Use the Write>)
                    const useWriteMatches = configJson.matchAll(
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
                      files = useWriteFiles;
                    } else {
                      // Try another XML-like format pattern that might be used (with different closing tag)
                      const altWriteTagMatches = configJson.matchAll(
                        /<write>\s*<path>([^<]+)<\/path>\s*<content>([\s\S]*?)<\/content>\s*<\/write>/gi
                      );
                      const altWriteTagFiles = Array.from(altWriteTagMatches).map((match) => {
                        const typedMatch = match as RegExpMatchArray;
                        return {
                          fileName: typedMatch[1].trim(),
                          content: typedMatch[2].trim(),
                        };
                      });

                      if (altWriteTagFiles.length > 0) {
                        files = altWriteTagFiles;
                      } else {
                        // Try markdown format
                        const lines = configJson.split('\n');
                        let currentFile: string | null = null;
                        let collectingContent = false;
                        let fileContent = '';

                        for (const line of lines) {
                          // Check if this line indicates a new file
                          const dockerfileMatch = line.match(/###\s*Dockerfile/);
                          const dockerComposeMatch = line.match(/###\s*docker-compose\.yml/);
                          const dockerignoreMatch = line.match(/###\s*\.dockerignore/);
                          const deploymentMatch = line.match(/###\s*deployment\.ya?ml/); // Handle both .yaml and .yml
                          const serviceMatch = line.match(/###\s*service\.ya?ml/); // Handle both .yaml and .yml
                          const ingressMatch = line.match(/###\s*ingress\.ya?ml/); // Handle both .yaml and .yml
                          const configmapMatch = line.match(/###\s*configmap\.ya?ml/); // Handle both .yaml and .yml
                          const setupMatch = line.match(/###\s*setup\.sh/);
                          const envExampleMatch = line.match(/###\s*\.env\.example/);
                          const hpaMatch = line.match(/###\s*hpa\.ya?ml/); // Handle both .yaml and .yml
                          const secretMatch = line.match(/###\s*secret\.ya?ml/); // Handle both .yaml and .yml
                          const deployScriptMatch = line.match(/###\s*deploy\.sh/);

                          // Handle different file types based on config type
                          if (
                            dockerfileMatch ||
                            dockerComposeMatch ||
                            dockerignoreMatch ||
                            envExampleMatch ||
                            deploymentMatch ||
                            serviceMatch ||
                            ingressMatch ||
                            configmapMatch ||
                            setupMatch ||
                            hpaMatch ||
                            secretMatch ||
                            deployScriptMatch
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
                            if (dockerfileMatch) {
                              currentFile = 'Dockerfile';
                            } else if (dockerComposeMatch) {
                              currentFile = 'docker-compose.yml';
                            } else if (dockerignoreMatch) {
                              currentFile = '.dockerignore';
                            } else if (envExampleMatch) {
                              currentFile = '.env.example';
                            } else if (deploymentMatch) {
                              // Check if it's .yml or .yaml
                              currentFile = deploymentMatch[0].includes('.yml')
                                ? 'deployment.yml'
                                : 'deployment.yaml';
                            } else if (serviceMatch) {
                              // Check if it's .yml or .yaml
                              currentFile = serviceMatch[0].includes('.yml')
                                ? 'service.yml'
                                : 'service.yaml';
                            } else if (ingressMatch) {
                              // Check if it's .yml or .yaml
                              currentFile = ingressMatch[0].includes('.yml')
                                ? 'ingress.yml'
                                : 'ingress.yaml';
                            } else if (configmapMatch) {
                              // Check if it's .yml or .yaml
                              currentFile = configmapMatch[0].includes('.yml')
                                ? 'configmap.yml'
                                : 'configmap.yaml';
                            } else if (setupMatch) {
                              currentFile = 'setup.sh';
                            } else if (hpaMatch) {
                              // Check if it's .yml or .yaml
                              currentFile = hpaMatch[0].includes('.yml') ? 'hpa.yml' : 'hpa.yaml';
                            } else if (secretMatch) {
                              // Check if it's .yml or .yaml
                              currentFile = secretMatch[0].includes('.yml')
                                ? 'secret.yml'
                                : 'secret.yaml';
                            } else if (deployScriptMatch) {
                              currentFile = 'deploy.sh';
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
                      }
                    }
                  }
                }
              }
            }

            // If we successfully parsed files, write them to disk
            if (files.length > 0 && request.projectContext?.projectPath) {
              const projectPath = request.projectContext.projectPath;
              for (const file of files) {
                if (file.fileName && file.content) {
                  let content = file.content;

                  // Special handling for .env.example files to ensure placeholders instead of actual values
                  if (file.fileName === '.env.example') {
                    content = this.processEnvExampleContent(content);
                  }

                  const filePath = path.join(projectPath, file.fileName);
                  await fs.writeFile(filePath, content, 'utf-8');
                }
              }

              // Create a summary file
              const summary = {
                configType: request.configType,
                files: files.map((f) => ({
                  fileName: f.fileName,
                  description: `${request.configType} configuration file`,
                })),
                // Add deployment instructions and commands
                deployment: {
                  instructions:
                    (request.configType as string) === 'docker' ||
                    (request.configType as string) === 'docker-compose'
                      ? '## Docker Deployment Instructions\n\n### Prerequisites\n- Docker installed\n- Environment variables configured\n\n### Steps\n1. Build the image: `docker build -t myapp .`\n2. Run the container: `docker run -p 3000:3000 --env-file .env myapp`'
                      : (request.configType as string) === 'kubernetes'
                        ? '## Kubernetes Deployment Instructions\n\n### Prerequisites\n- kubectl configured\n- Kubernetes cluster access\n- Environment variables configured\n\n### Steps\n1. Apply the manifests: `kubectl apply -f .`\n2. Check the deployment: `kubectl get deployments`\n3. Check the service: `kubectl get services`'
                        : '## Deployment Instructions\n\n### Prerequisites\n- Ensure all dependencies are installed\n\n### Steps\n1. Review the generated configuration files\n2. Apply according to your deployment platform',
                  buildCommand:
                    (request.configType as string) === 'docker' ||
                    (request.configType as string) === 'docker-compose'
                      ? 'docker build -t myapp .'
                      : (request.configType as string) === 'kubernetes'
                        ? 'kubectl apply -f .'
                        : `echo "Review configuration files"`,
                  runCommand:
                    (request.configType as string) === 'docker' ||
                    (request.configType as string) === 'docker-compose'
                      ? 'docker run -p 3000:3000 myapp'
                      : (request.configType as string) === 'kubernetes'
                        ? 'kubectl get deployments'
                        : `echo "Apply to your platform"`,
                },
                // Add basic project information
                projectSummary: {
                  overview: `${request.configType.charAt(0).toUpperCase() + request.configType.slice(1)} deployment configuration`,
                  framework:
                    (request.configType as string) === 'docker' ||
                    (request.configType as string) === 'docker-compose'
                      ? 'Docker'
                      : (request.configType as string) === 'kubernetes'
                        ? 'Kubernetes'
                        : 'Generic',
                  runtime:
                    (request.configType as string) === 'docker' ||
                    (request.configType as string) === 'docker-compose'
                      ? 'Container'
                      : (request.configType as string) === 'kubernetes'
                        ? 'Kubernetes'
                        : 'N/A',
                  buildTool: request.configType,
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
                recommendations: [
                  'Review the generated configuration files before deploying',
                  'Ensure all environment variables are properly configured',
                  'Test the deployment in a staging environment first',
                ],
                optimization: {
                  features:
                    (request.configType as string) === 'docker' ||
                    (request.configType as string) === 'docker-compose'
                      ? [
                          'Multi-stage builds for faster rebuilds',
                          'Layer caching for dependencies',
                          'Alpine base image for smaller size',
                        ]
                      : (request.configType as string) === 'kubernetes'
                        ? [
                            'Resource limits and requests configured',
                            'Liveness and readiness probes',
                            'ConfigMaps for configuration',
                          ]
                        : [
                            'Generated configuration files',
                            'Platform-specific deployment instructions',
                          ],
                },
              };

              const summaryPath = path.join(projectPath, '_summary.json');
              await fs.writeFile(summaryPath, JSON.stringify(summary, null, 2), 'utf-8');

              // Return the result structure that the system expects
              return {
                configType: request.configType,
                files: files.map((f) => ({
                  fileName: f.fileName,
                  description: `${request.configType} configuration file`,
                })),
              };
            } else {
              // If all else fails, treat as direct file content
              const fileName = `${request.configType}.txt`;
              const filePath = path.join(request.projectContext.projectPath, fileName);
              let content = configJson;

              // Special handling for .env.example files to ensure placeholders instead of actual values
              if (fileName === '.env.example') {
                content = this.processEnvExampleContent(content);
              }

              await fs.writeFile(filePath, content, 'utf-8');

              // Create a summary file with proper structure
              const summary = {
                configType: request.configType,
                files: [
                  {
                    fileName: fileName,
                    description: `${request.configType} configuration`,
                  },
                ],
                // Add deployment instructions and commands
                deployment: {
                  instructions: `## ${request.configType.charAt(0).toUpperCase() + request.configType.slice(1)} Configuration Instructions

### Prerequisites
- Ensure all dependencies are installed

### Steps
1. Review the generated configuration file
2. Apply the configuration according to your deployment platform`,
                  buildCommand: `echo "Review ${fileName}"`,
                  runCommand: `echo "Apply ${fileName} to your platform"`,
                },
                // Add basic project information
                projectSummary: {
                  overview: `${request.configType.charAt(0).toUpperCase() + request.configType.slice(1)} configuration`,
                  framework: 'Generic',
                  runtime: 'N/A',
                  buildTool: request.configType,
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
                recommendations: [
                  'Review the generated configuration file',
                  'Ensure all placeholders are properly replaced',
                  'Test in a staging environment first',
                ],
                optimization: {
                  features: [
                    'Generated configuration file',
                    'Platform-specific deployment instructions',
                  ],
                },
              };

              const summaryPath = path.join(request.projectContext.projectPath, '_summary.json');
              await fs.writeFile(summaryPath, JSON.stringify(summary, null, 2), 'utf-8');

              // Return the result structure that the system expects
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
      } else {
        // Fallback: try to parse as JSON for backward compatibility
        try {
          const configResult = extractJsonFromResponse(configJson);

          // Basic validation for deployment config result
          if (!configResult || typeof configResult !== 'object') {
            throw new Error(
              `Deployment config result is not a valid object. Response: ${configJson}`
            );
          }

          // Ensure configResult has the required configType property
          if (!configResult.configType) {
            configResult.configType = request.configType;
          }

          // Write files to disk if they're provided in the response and projectPath exists
          const fs = await import('fs/promises');
          const path = await import('path');

          if (
            configResult.files &&
            Array.isArray(configResult.files) &&
            request.projectContext?.projectPath
          ) {
            const projectPath = request.projectContext.projectPath;
            for (const file of configResult.files) {
              if (file.fileName && file.content) {
                let content = file.content;

                // Special handling for .env.example files to ensure placeholders instead of actual values
                if (file.fileName === '.env.example') {
                  content = this.processEnvExampleContent(content);
                }

                const filePath = path.join(projectPath, file.fileName);
                await fs.writeFile(filePath, content, 'utf-8');
              }
            }

            // Create a summary file with proper structure if it doesn't exist in the response
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

            // Add other required fields if missing
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

            // Create a summary file
            const summaryPath = path.join(projectPath, '_summary.json');
            await fs.writeFile(summaryPath, JSON.stringify(configResult, null, 2), 'utf-8');
          }

          return configResult;
        } catch (parseError) {
          // If all else fails, throw the original error
          throw new Error(
            `Deployment config result is not a valid object. Response: ${configJson}`
          );
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
   * Process .env.example content to replace actual values with placeholders
   */
  private processEnvExampleContent(content: string): string {
    // Split content into lines
    const lines = content.split('\n');
    const processedLines = [];

    for (const line of lines) {
      // Skip empty lines and comments
      if (line.trim() === '' || line.trim().startsWith('#')) {
        processedLines.push(line);
        continue;
      }

      // Check if this is a key-value pair
      const keyValueMatch = line.match(/^([^#=]+)=(.*)$/);
      if (keyValueMatch) {
        const key = keyValueMatch[1].trim();
        const value = keyValueMatch[2].trim();

        // If there's a value, replace it with a placeholder
        if (value !== '') {
          // Special handling for NEXT_PUBLIC_CONTRACT_ID - make it clear it's a variable
          if (key === 'NEXT_PUBLIC_CONTRACT_ID') {
            processedLines.push(
              `${key}=# Replace with your deployed contract ID (e.g., CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNEFRDKWDCO5PJKJKCG5LZG4W5O)`
            );
          } else if (key === 'NEXT_PUBLIC_RPC_URL') {
            processedLines.push(
              `${key}=# Replace with your Stellar RPC URL (e.g., https://soroban-testnet.stellar.org)`
            );
          } else if (key === 'NEXT_PUBLIC_STELLAR_NETWORK') {
            processedLines.push(`${key}=# Replace with network type (testnet or mainnet)`);
          } else {
            // For other variables, use a generic placeholder
            processedLines.push(`${key}=# Replace with appropriate value`);
          }
        } else {
          processedLines.push(line);
        }
      } else {
        processedLines.push(line);
      }
    }

    return processedLines.join('\n');
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
      {
        id: 'whisper-large-v3',
        name: 'Whisper Large V3',
        pricing: { prompt: 'Free', completion: 'Free' },
        contextLength: 8192,
        isFree: true,
      },
    ];
  }
}
