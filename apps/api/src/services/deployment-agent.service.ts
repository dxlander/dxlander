import { db, schema } from '@dxlander/database';
import { eq, and } from 'drizzle-orm';
import { randomUUID } from 'crypto';
import * as path from 'path';
import * as fs from 'fs';
import * as yaml from 'yaml';
import { streamText, stepCountIs, tool } from 'ai';
import { z } from 'zod';
import { getExecutorRegistry } from './executors';
import { ConfigServiceService } from './config-service.service';
import {
  isPathSafe,
  type SessionProgressEvent,
  type FileChange,
  AI_DEPLOYMENT_SYSTEM_PROMPT,
  buildAIDeploymentContext,
  ReadDeploymentFileSchema,
  WriteDeploymentFileSchema,
  ListDeploymentFilesSchema,
  GetDeploymentLogsSchema,
  ReportProgressSchema,
  CompleteSessionSchema,
  CheckServiceHealthSchema,
  CheckEndpointHealthSchema,
  GetContainerLogsSchema,
} from '@dxlander/shared';
import { AIProviderService } from './ai-provider.service';

/**
 * Options for starting a recovery session
 */
export interface StartRecoverySessionOptions {
  deploymentId: string;
  userId: string;
  maxAttempts?: number;
  onProgress?: (event: SessionProgressEvent) => void;
}

/**
 * Options for starting an AI deployment session
 */
export interface StartAIDeploymentSessionOptions {
  deploymentId: string;
  userId: string;
  configSetId: string;
  maxAttempts?: number;
  customInstructions?: string;
  onProgress?: (event: SessionProgressEvent) => void;
}

/**
 * Tool execution result
 */
interface ToolResult {
  success: boolean;
  output: unknown;
  error?: string;
}

/**
 * Deployment Agent Service
 *
 * Manages AI-assisted deployment recovery sessions.
 * Uses an AI agent to analyze errors, modify files, and retry deployment.
 */
export class DeploymentAgentService {
  private workDir: string = '';
  private deploymentId: string = '';
  private sessionId: string = '';
  private userId: string = '';
  private fileChanges: FileChange[] = [];
  private onProgress?: (event: SessionProgressEvent) => void;

  /**
   * Start a new recovery session
   */
  async startRecoverySession(options: StartRecoverySessionOptions): Promise<string> {
    const { deploymentId, userId, maxAttempts = 3, onProgress } = options;

    this.deploymentId = deploymentId;
    this.userId = userId;
    this.onProgress = onProgress;
    this.fileChanges = [];

    // Get deployment
    const deployment = await db.query.deployments.findFirst({
      where: and(eq(schema.deployments.id, deploymentId), eq(schema.deployments.userId, userId)),
    });

    if (!deployment) {
      throw new Error('Deployment not found or access denied');
    }

    // Get work directory from metadata
    let metadata: Record<string, unknown> = {};
    try {
      metadata = deployment.metadata ? JSON.parse(deployment.metadata) : {};
    } catch {
      throw new Error('Invalid deployment metadata format');
    }
    const buildDir = metadata.buildDir;
    if (typeof buildDir !== 'string' || !fs.existsSync(buildDir)) {
      throw new Error('Deployment work directory not found');
    }
    this.workDir = buildDir;

    // Create session record
    this.sessionId = randomUUID();
    const now = new Date();

    await db.insert(schema.deploymentSessions).values({
      id: this.sessionId,
      deploymentId,
      userId,
      status: 'active',
      attemptNumber: 1,
      maxAttempts,
      startedAt: now,
      createdAt: now,
      updatedAt: now,
    });

    // Emit session started event
    this.emitProgress({
      type: 'session_started',
      sessionId: this.sessionId,
    });

    return this.sessionId;
  }

  /**
   * Start a new AI deployment session
   *
   * This is for full AI-assisted deployment from scratch (not recovery).
   * The agent will handle pre-flight checks, deployment, and any error recovery.
   */
  async startAIDeploymentSession(options: StartAIDeploymentSessionOptions): Promise<string> {
    const {
      deploymentId,
      userId,
      configSetId,
      maxAttempts = 3,
      customInstructions,
      onProgress,
    } = options;

    this.deploymentId = deploymentId;
    this.userId = userId;
    this.onProgress = onProgress;
    this.fileChanges = [];

    // Get deployment
    const deployment = await db.query.deployments.findFirst({
      where: and(eq(schema.deployments.id, deploymentId), eq(schema.deployments.userId, userId)),
    });

    if (!deployment) {
      throw new Error('Deployment not found or access denied');
    }

    // Get work directory from metadata
    let metadata: Record<string, unknown> = {};
    try {
      metadata = deployment.metadata ? JSON.parse(deployment.metadata) : {};
    } catch {
      throw new Error('Invalid deployment metadata format');
    }
    const buildDir = metadata.buildDir;
    if (typeof buildDir !== 'string' || !fs.existsSync(buildDir)) {
      throw new Error('Deployment work directory not found');
    }
    this.workDir = buildDir;

    // Create session record
    this.sessionId = randomUUID();
    const now = new Date();

    await db.insert(schema.deploymentSessions).values({
      id: this.sessionId,
      deploymentId,
      userId,
      status: 'active',
      attemptNumber: 1,
      maxAttempts,
      customInstructions,
      agentContext: JSON.stringify({
        configSetId,
        isFullDeployment: true,
      }),
      startedAt: now,
      createdAt: now,
      updatedAt: now,
    });

    // Emit session started event
    this.emitProgress({
      type: 'session_started',
      sessionId: this.sessionId,
    });

    return this.sessionId;
  }

  /**
   * Run the agent loop for AI deployment
   */
  async runAgentLoop(): Promise<void> {
    try {
      // Get session
      const session = await db.query.deploymentSessions.findFirst({
        where: eq(schema.deploymentSessions.id, this.sessionId),
      });

      if (!session) {
        throw new Error('Session not found');
      }

      // Get deployment
      const deployment = await db.query.deployments.findFirst({
        where: eq(schema.deployments.id, this.deploymentId),
      });

      if (!deployment) {
        throw new Error('Deployment not found');
      }

      // Get AI provider
      const provider = await this.getAIProvider();

      if (!provider) {
        await this.completeSession(false, 'No AI provider configured', [
          'Configure an AI provider in Settings',
        ]);
        return;
      }

      // Build AI deployment context
      const agentContext = session.agentContext ? JSON.parse(session.agentContext) : {};
      const contextMessage = buildAIDeploymentContext({
        projectName: deployment.name || undefined,
        configSetId: agentContext.configSetId || deployment.configSetId || '',
        customInstructions: session.customInstructions || undefined,
      });

      this.emitProgress({
        type: 'analyzing',
        message: 'AI agent starting deployment...',
      });

      // Run agent loop with tool calls
      await this.executeAgentLoop(
        provider,
        AI_DEPLOYMENT_SYSTEM_PROMPT,
        contextMessage,
        session.maxAttempts || 3
      );
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      await this.completeSession(false, `Agent error: ${errorMessage}`, []);
    }
  }

  /**
   * Create recovery tools using AI SDK tool() function
   *
   * Follows the same pattern as createProjectAnalysisTools and createConfigGenerationTools
   * in packages/shared/src/services/ai/tools/definitions.ts
   *
   * Tools are executed automatically by the AI SDK during streamText with stopWhen
   */
  private createRecoveryTools() {
    let sessionCompleted = false;

    const tools = {
      readDeploymentFile: tool({
        description:
          'Read a file from the deployment directory (Dockerfile, docker-compose.yml, source files). Use this to understand the current configuration and identify issues.',
        inputSchema: z.object({
          filePath: z.string().describe('Relative path to file within deployment directory'),
        }),
        execute: async ({ filePath }) => {
          const result = await this.toolReadFile({ filePath });
          await this.logActivity('tool_call', 'readDeploymentFile', { filePath }, result.output);
          return result.output;
        },
      }),

      writeDeploymentFile: tool({
        description:
          'Modify or create a file in the deployment directory. Use for fixing Dockerfile, docker-compose.yml, or other configuration issues.',
        inputSchema: z.object({
          filePath: z.string().describe('Relative path to file'),
          content: z.string().describe('Complete new file content'),
          reason: z.string().describe('Explanation of why this change is needed'),
        }),
        execute: async ({ filePath, content, reason }) => {
          const result = await this.toolWriteFile({ filePath, content, reason });
          await this.logActivity(
            'tool_call',
            'writeDeploymentFile',
            { filePath, reason },
            result.output
          );
          return result.output;
        },
      }),

      listDeploymentFiles: tool({
        description:
          'List files in the deployment directory. Use this to explore the project structure.',
        inputSchema: z.object({
          directory: z.string().optional().describe('Relative directory path (default: root)'),
          recursive: z.boolean().optional().describe('Whether to list files recursively'),
        }),
        execute: async ({ directory, recursive }) => {
          const result = await this.toolListFiles({ directory, recursive });
          await this.logActivity(
            'tool_call',
            'listDeploymentFiles',
            { directory, recursive },
            result.output
          );
          return result.output;
        },
      }),

      runPreFlightChecks: tool({
        description:
          'Run pre-deployment validation checks. This verifies Docker is running, files are valid, ports are available, etc.',
        inputSchema: z.object({}),
        execute: async () => {
          const result = await this.toolRunPreFlightChecks();
          await this.logActivity('tool_call', 'runPreFlightChecks', {}, result.output);
          return result.output;
        },
      }),

      deployProject: tool({
        description:
          'Attempt to deploy the project using docker compose. This builds the image and starts containers.',
        inputSchema: z.object({}),
        execute: async () => {
          const result = await this.toolDeploy();
          await this.logActivity('tool_call', 'deployProject', {}, result.output);
          return result.output;
        },
      }),

      getDeploymentLogs: tool({
        description:
          'Get build and runtime logs from the deployment. Use this to understand what went wrong.',
        inputSchema: z.object({
          type: z.enum(['build', 'runtime', 'all']).optional().describe('Type of logs to retrieve'),
          tail: z.number().optional().describe('Number of recent log lines to return'),
        }),
        execute: async ({ type, tail }) => {
          const result = await this.toolGetLogs({ type, tail });
          await this.logActivity('tool_call', 'getDeploymentLogs', { type, tail }, result.output);
          return result.output;
        },
      }),

      validateDockerCompose: tool({
        description: 'Validate docker-compose.yml syntax and schema.',
        inputSchema: z.object({}),
        execute: async () => {
          const result = await this.toolValidateCompose();
          await this.logActivity('tool_call', 'validateDockerCompose', {}, result.output);
          return result.output;
        },
      }),

      validateDockerfile: tool({
        description: 'Validate Dockerfile syntax.',
        inputSchema: z.object({}),
        execute: async () => {
          const result = await this.toolValidateDockerfile();
          await this.logActivity('tool_call', 'validateDockerfile', {}, result.output);
          return result.output;
        },
      }),

      reportProgress: tool({
        description:
          'Report progress or status to the user. Use this to keep the user informed about what you are doing.',
        inputSchema: z.object({
          message: z.string().describe('Message to display to the user'),
          progressType: z
            .enum(['info', 'success', 'warning', 'error'])
            .describe('Type of progress message'),
        }),
        execute: async ({ message, progressType }) => {
          this.emitProgress({ type: 'ai_message', content: `[${progressType}] ${message}` });
          await this.logActivity(
            'tool_call',
            'reportProgress',
            { message, progressType },
            { reported: true }
          );
          return { reported: true };
        },
      }),

      completeSession: tool({
        description:
          'Mark the recovery session as complete. Use this when you have successfully fixed the issue OR when you have determined that the issue cannot be automatically fixed.',
        inputSchema: z.object({
          success: z.boolean().describe('Whether the deployment was successfully fixed'),
          summary: z.string().describe('Summary of what was done or why it could not be fixed'),
          suggestions: z
            .array(z.string())
            .optional()
            .describe('Suggestions for manual steps if automatic fix failed'),
        }),
        execute: async ({ success, summary, suggestions }) => {
          sessionCompleted = true;
          await this.completeSession(success, summary, suggestions || []);
          await this.logActivity(
            'tool_call',
            'completeSession',
            { success, summary },
            { completed: true }
          );
          return { completed: true };
        },
      }),

      checkServiceHealth: tool({
        description:
          'Check the health status of deployed containers/services. Use this AFTER deployProject to verify containers are actually running.',
        inputSchema: z.object({
          service: z.string().optional().describe('Optional service name to check'),
        }),
        execute: async ({ service }) => {
          const result = await this.toolCheckServiceHealth({ service });
          await this.logActivity('tool_call', 'checkServiceHealth', { service }, result.output);
          return result.output;
        },
      }),

      checkEndpointHealth: tool({
        description:
          'Make an HTTP request to verify a service is responding on its port. Use this AFTER deployProject to confirm the app is accessible.',
        inputSchema: z.object({
          url: z.string().describe('The URL to check'),
          expectedStatus: z.number().optional().describe('Expected HTTP status code'),
          timeout: z.number().optional().describe('Timeout in milliseconds'),
        }),
        execute: async ({ url, expectedStatus, timeout }) => {
          const result = await this.toolCheckEndpointHealth({ url, expectedStatus, timeout });
          await this.logActivity(
            'tool_call',
            'checkEndpointHealth',
            { url, expectedStatus },
            result.output
          );
          return result.output;
        },
      }),

      getContainerLogs: tool({
        description:
          'Get live logs from running containers. Use this to see real-time errors or startup messages.',
        inputSchema: z.object({
          service: z.string().optional().describe('Optional service name'),
          tail: z.number().optional().describe('Number of recent log lines'),
        }),
        execute: async ({ service, tail }) => {
          const result = await this.toolGetContainerLogs({ service, tail });
          await this.logActivity('tool_call', 'getContainerLogs', { service, tail }, result.output);
          return result.output;
        },
      }),
    };

    return {
      tools,
      isCompleted: () => sessionCompleted,
    };
  }

  /**
   * Execute the agent loop using AI SDK streamText with tools
   *
   * This follows the same pattern as generateDeploymentConfig in base-tool-provider.ts:
   * - Uses streamText with tools and stopWhen for multi-turn tool calling
   * - Reports progress via onStepFinish callback
   * - Waits for completion with timeout
   */
  private async executeAgentLoop(
    provider: any,
    systemPrompt: string,
    initialContext: string,
    maxAttempts: number
  ): Promise<void> {
    // Get the language model from the provider
    const model = await provider.getLanguageModel();

    // Create tools with access to this service's methods
    const { tools, isCompleted } = this.createRecoveryTools();

    this.emitProgress({
      type: 'attempt_started',
      attempt: 1,
      maxAttempts,
    });

    try {
      // Use streamText with tools - AI SDK handles the multi-turn conversation automatically
      // This is the same pattern used in generateDeploymentConfig and analyzeProject
      const result = streamText({
        model,
        system: systemPrompt,
        prompt: initialContext,
        tools,
        stopWhen: stepCountIs(50), // Allow up to 50 tool call rounds
        maxOutputTokens: 4096,
        onStepFinish: async (step) => {
          // Report tool calls to SSE for UI display
          // This follows the same pattern as generateDeploymentConfig
          if (step.toolCalls && step.toolCalls.length > 0) {
            for (let i = 0; i < step.toolCalls.length; i++) {
              const toolCall = step.toolCalls[i];
              const toolName = toolCall.toolName;
              const toolInput = toolCall.input as Record<string, unknown>;

              // Get tool result if available
              let toolResult: unknown = null;
              if (step.toolResults && step.toolResults[i]) {
                const rawResult = step.toolResults[i];
                toolResult = (rawResult as { result?: unknown }).result ?? rawResult;
              }

              // Emit tool_call first, then tool_result
              this.emitProgress({
                type: 'tool_call',
                tool: toolName,
                input: toolInput,
              });

              this.emitProgress({
                type: 'tool_result',
                tool: toolName,
                output: toolResult,
                success: true,
              });
            }
          }

          // Log AI thinking/text output
          if (step.text) {
            this.emitProgress({
              type: 'ai_message',
              content: step.text,
            });
          }
        },
      });

      // Wait for completion with timeout
      const TIMEOUT = 15 * 60 * 1000; // 15 minutes max

      await Promise.race([
        result.text,
        new Promise<never>((_, reject) =>
          setTimeout(
            () => reject(new Error('Recovery session timed out after 15 minutes')),
            TIMEOUT
          )
        ),
      ]);

      // If we got here and session wasn't completed by the tool, complete with failure
      if (!isCompleted()) {
        await this.completeSession(
          false,
          'AI agent finished without explicitly completing the session',
          ['Check the activity log for details', 'Try running Fix with AI again']
        );
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      // If session wasn't already completed, mark as failed
      if (!isCompleted()) {
        await this.completeSession(false, `Recovery failed: ${errorMessage}`, [
          'Check the error logs for more details',
          'Try manually fixing the issues',
        ]);
      }
    }
  }

  /**
   * Execute a tool
   */
  private async executeTool(toolName: string, args: unknown): Promise<ToolResult> {
    this.emitProgress({
      type: 'tool_call',
      tool: toolName,
      input: args,
    });

    try {
      switch (toolName) {
        case 'readDeploymentFile':
          return await this.toolReadFile(args);
        case 'writeDeploymentFile':
          return await this.toolWriteFile(args);
        case 'listDeploymentFiles':
          return await this.toolListFiles(args);
        case 'runPreFlightChecks':
          return await this.toolRunPreFlightChecks();
        case 'deployProject':
          return await this.toolDeploy();
        case 'getDeploymentLogs':
          return await this.toolGetLogs(args);
        case 'validateDockerCompose':
          return await this.toolValidateCompose();
        case 'validateDockerfile':
          return await this.toolValidateDockerfile();
        case 'reportProgress':
          return await this.toolReportProgress(args);
        case 'completeSession':
          return await this.toolCompleteSession(args);
        default:
          return { success: false, output: null, error: `Unknown tool: ${toolName}` };
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return { success: false, output: null, error: errorMessage };
    }
  }

  /**
   * Tool: Read deployment file
   */
  private async toolReadFile(args: unknown): Promise<ToolResult> {
    const parsed = ReadDeploymentFileSchema.safeParse(args);
    if (!parsed.success) {
      return { success: false, output: null, error: 'Invalid parameters' };
    }

    const { filePath } = parsed.data;

    if (!isPathSafe(this.workDir, filePath)) {
      return { success: false, output: null, error: 'Invalid file path' };
    }

    const fullPath = path.join(this.workDir, filePath);

    if (!fs.existsSync(fullPath)) {
      return { success: false, output: null, error: `File not found: ${filePath}` };
    }

    const content = fs.readFileSync(fullPath, 'utf-8');
    return { success: true, output: { content } };
  }

  /**
   * Tool: Write deployment file
   */
  private async toolWriteFile(args: unknown): Promise<ToolResult> {
    const parsed = WriteDeploymentFileSchema.safeParse(args);
    if (!parsed.success) {
      return { success: false, output: null, error: 'Invalid parameters' };
    }

    const { filePath, content, reason } = parsed.data;

    if (!isPathSafe(this.workDir, filePath)) {
      return { success: false, output: null, error: 'Invalid file path' };
    }

    const fullPath = path.join(this.workDir, filePath);

    // Read existing content if file exists
    let before: string | null = null;
    if (fs.existsSync(fullPath)) {
      before = fs.readFileSync(fullPath, 'utf-8');
    }

    // Write new content
    fs.writeFileSync(fullPath, content, 'utf-8');

    // Track file change
    const fileChange: FileChange = {
      file: filePath,
      before,
      after: content,
      reason,
      timestamp: new Date().toISOString(),
    };
    this.fileChanges.push(fileChange);

    // Emit file modified event
    this.emitProgress({
      type: 'file_modified',
      file: filePath,
      reason,
    });

    return { success: true, output: { written: true } };
  }

  /**
   * Tool: List deployment files
   */
  private async toolListFiles(args: unknown): Promise<ToolResult> {
    const parsed = ListDeploymentFilesSchema.safeParse(args);
    if (!parsed.success) {
      return { success: false, output: null, error: 'Invalid parameters' };
    }

    const { directory = '.', recursive = false } = parsed.data;

    if (!isPathSafe(this.workDir, directory)) {
      return { success: false, output: null, error: 'Invalid directory path' };
    }

    const targetDir = path.join(this.workDir, directory);

    if (!fs.existsSync(targetDir)) {
      return { success: false, output: null, error: `Directory not found: ${directory}` };
    }

    const files: string[] = [];

    const listDir = (dir: string, prefix: string) => {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const relativePath = prefix ? `${prefix}/${entry.name}` : entry.name;
        if (entry.isFile()) {
          files.push(relativePath);
        } else if (entry.isDirectory() && recursive) {
          listDir(path.join(dir, entry.name), relativePath);
        }
      }
    };

    listDir(targetDir, '');
    return { success: true, output: { files } };
  }

  /**
   * Tool: Run pre-flight checks
   */
  private async toolRunPreFlightChecks(): Promise<ToolResult> {
    try {
      const registry = getExecutorRegistry();
      const executor = registry.get('docker');

      // Get config services for provision list
      const deployment = await db.query.deployments.findFirst({
        where: eq(schema.deployments.id, this.deploymentId),
      });

      if (!deployment?.configSetId) {
        return { success: false, output: null, error: 'No config set linked to deployment' };
      }

      const configServices = await ConfigServiceService.getConfigServices(
        this.userId,
        deployment.configSetId
      );
      const provisionServiceNames = configServices
        .filter((s) => s.sourceMode === 'provision')
        .map((s) => s.composeServiceName)
        .filter(Boolean) as string[];

      const result = await executor.runPreFlightChecks({
        configPath: this.workDir,
        userId: this.userId,
        configSetId: deployment.configSetId,
        provisionServiceNames,
      });

      this.emitProgress({
        type: 'pre_flight_result',
        passed: result.passed,
        checks: result.checks,
      });

      return { success: true, output: result };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return { success: false, output: null, error: errorMessage };
    }
  }

  /**
   * Tool: Deploy project
   */
  private async toolDeploy(): Promise<ToolResult> {
    try {
      this.emitProgress({ type: 'deploy_started' });

      const registry = getExecutorRegistry();
      const executor = registry.get('docker');

      const deployment = await db.query.deployments.findFirst({
        where: eq(schema.deployments.id, this.deploymentId),
      });

      if (!deployment) {
        return { success: false, output: null, error: 'Deployment not found' };
      }

      const metadata = deployment.metadata ? JSON.parse(deployment.metadata) : {};
      const projectName =
        metadata.composeProjectName || `dxlander-${this.deploymentId.substring(0, 12)}`;

      // Get env vars for services
      const envVars = await this.getDeploymentEnvVars(deployment.configSetId);

      const result = await executor.deploy({
        workDir: this.workDir,
        projectName,
        envVars,
        onProgress: (event) => {
          this.emitProgress({
            type: 'ai_message',
            content: event.message,
          });
        },
      });

      this.emitProgress({
        type: 'deploy_result',
        success: result.success,
        deployUrl: result.deployUrl,
        error: result.errorMessage,
      });

      // Update deployment status
      if (result.success) {
        await db
          .update(schema.deployments)
          .set({
            status: 'running',
            deployUrl: result.deployUrl,
            serviceUrls: result.serviceUrls ? JSON.stringify(result.serviceUrls) : null,
            errorMessage: null,
            completedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(schema.deployments.id, this.deploymentId));
      }

      return { success: result.success, output: result };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.emitProgress({
        type: 'deploy_result',
        success: false,
        error: errorMessage,
      });
      return { success: false, output: null, error: errorMessage };
    }
  }

  /**
   * Tool: Get deployment logs
   */
  private async toolGetLogs(args: unknown): Promise<ToolResult> {
    const parsed = GetDeploymentLogsSchema.safeParse(args);
    if (!parsed.success) {
      return { success: false, output: null, error: 'Invalid parameters' };
    }

    const { type = 'all', tail = 100 } = parsed.data;

    try {
      const deployment = await db.query.deployments.findFirst({
        where: eq(schema.deployments.id, this.deploymentId),
      });

      if (!deployment) {
        return { success: false, output: null, error: 'Deployment not found' };
      }

      const logs: { buildLogs?: string; runtimeLogs?: string } = {};

      if (type === 'build' || type === 'all') {
        logs.buildLogs = deployment.buildLogs || '';
      }

      if (type === 'runtime' || type === 'all') {
        logs.runtimeLogs = deployment.runtimeLogs || '';
      }

      // Truncate logs to tail
      if (logs.buildLogs) {
        const lines = logs.buildLogs.split('\n');
        logs.buildLogs = lines.slice(-tail).join('\n');
      }
      if (logs.runtimeLogs) {
        const lines = logs.runtimeLogs.split('\n');
        logs.runtimeLogs = lines.slice(-tail).join('\n');
      }

      return { success: true, output: logs };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return { success: false, output: null, error: errorMessage };
    }
  }

  /**
   * Tool: Validate docker-compose.yml
   */
  private async toolValidateCompose(): Promise<ToolResult> {
    const composePath = path.join(this.workDir, 'docker-compose.yml');

    if (!fs.existsSync(composePath)) {
      return { success: false, output: { valid: false, errors: ['docker-compose.yml not found'] } };
    }

    try {
      const content = fs.readFileSync(composePath, 'utf-8');
      yaml.parse(content);
      return { success: true, output: { valid: true } };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Parse error';
      return { success: true, output: { valid: false, errors: [errorMessage] } };
    }
  }

  /**
   * Tool: Validate Dockerfile
   */
  private async toolValidateDockerfile(): Promise<ToolResult> {
    const dockerfilePath = path.join(this.workDir, 'Dockerfile');

    if (!fs.existsSync(dockerfilePath)) {
      return { success: false, output: { valid: false, errors: ['Dockerfile not found'] } };
    }

    const content = fs.readFileSync(dockerfilePath, 'utf-8');
    const lines = content.split('\n').filter((l) => l.trim() && !l.trim().startsWith('#'));

    if (lines.length === 0) {
      return { success: true, output: { valid: false, errors: ['Dockerfile is empty'] } };
    }

    // Check for FROM instruction
    const hasFrom = lines.some((l) => l.trim().toUpperCase().startsWith('FROM '));
    if (!hasFrom) {
      return {
        success: true,
        output: { valid: false, errors: ['Dockerfile must start with FROM instruction'] },
      };
    }

    return { success: true, output: { valid: true } };
  }

  /**
   * Tool: Report progress
   */
  private async toolReportProgress(args: unknown): Promise<ToolResult> {
    const parsed = ReportProgressSchema.safeParse(args);
    if (!parsed.success) {
      return { success: false, output: null, error: 'Invalid parameters' };
    }

    const { message } = parsed.data;

    this.emitProgress({
      type: 'ai_message',
      content: message,
    });

    return { success: true, output: { reported: true } };
  }

  /**
   * Tool: Complete session
   */
  private async toolCompleteSession(args: unknown): Promise<ToolResult> {
    const parsed = CompleteSessionSchema.safeParse(args);
    if (!parsed.success) {
      return { success: false, output: null, error: 'Invalid parameters' };
    }

    const { success, summary, suggestions } = parsed.data;

    await this.completeSession(success, summary, suggestions || []);

    return { success: true, output: { completed: true } };
  }

  /**
   * Tool: Check service health status
   *
   * Verifies that containers are actually running (not just created/exited).
   * This is essential for confirming deployment success.
   */
  private async toolCheckServiceHealth(args: unknown): Promise<ToolResult> {
    const parsed = CheckServiceHealthSchema.safeParse(args);
    if (!parsed.success) {
      return { success: false, output: null, error: 'Invalid parameters' };
    }

    try {
      const deployment = await db.query.deployments.findFirst({
        where: eq(schema.deployments.id, this.deploymentId),
      });

      if (!deployment) {
        return { success: false, output: null, error: 'Deployment not found' };
      }

      const metadata = deployment.metadata ? JSON.parse(deployment.metadata) : {};
      const projectName =
        metadata.composeProjectName || `dxlander-${this.deploymentId.substring(0, 12)}`;

      const registry = getExecutorRegistry();
      const executor = registry.get('docker');

      const status = await executor.getStatus(this.workDir, projectName);

      // Check if any service matches the requested service filter
      let services = status.services;
      if (parsed.data.service) {
        services = services.filter((s) => s.name === parsed.data.service);
      }

      // Determine overall health
      const allRunning = services.length > 0 && services.every((s) => s.status === 'running');
      const hasExited = services.some((s) => s.status === 'exited' || s.status === 'dead');

      const result = {
        running: allRunning,
        healthy: allRunning && !hasExited,
        services: services.map((s) => ({
          name: s.name,
          status: s.status,
          ports: s.ports || [],
        })),
        message: hasExited
          ? 'One or more containers have exited. Use getContainerLogs to see why.'
          : allRunning
            ? 'All containers are running'
            : 'Containers are not in running state',
      };

      return { success: true, output: result };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return { success: false, output: null, error: errorMessage };
    }
  }

  /**
   * Tool: Check endpoint health
   *
   * Makes an HTTP request to verify the deployed service is responding.
   * A container can be "running" but the app inside may have crashed.
   */
  private async toolCheckEndpointHealth(args: unknown): Promise<ToolResult> {
    const parsed = CheckEndpointHealthSchema.safeParse(args);
    if (!parsed.success) {
      return { success: false, output: null, error: `Invalid parameters: ${parsed.error.message}` };
    }

    const { url, expectedStatus = 200, timeout = 5000 } = parsed.data;

    try {
      // eslint-disable-next-line no-undef
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      const startTime = Date.now();

      const response = await fetch(url, {
        method: 'GET',
        signal: controller.signal,
        headers: {
          'User-Agent': 'DXLander-HealthCheck/1.0',
        },
      });

      clearTimeout(timeoutId);
      const responseTime = Date.now() - startTime;

      // Check if status matches expected (0 means accept any 2xx)
      const statusOk =
        expectedStatus === 0
          ? response.status >= 200 && response.status < 300
          : response.status === expectedStatus;

      const result = {
        healthy: statusOk,
        statusCode: response.status,
        responseTime,
        message: statusOk
          ? `Endpoint is healthy (${response.status} in ${responseTime}ms)`
          : `Unexpected status code: ${response.status} (expected ${expectedStatus === 0 ? '2xx' : expectedStatus})`,
      };

      return { success: true, output: result };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      // Provide helpful error messages
      let message = errorMessage;
      if (errorMessage.includes('ECONNREFUSED')) {
        message =
          'Connection refused - the service is not listening on this port. The container may have crashed.';
      } else if (errorMessage.includes('abort')) {
        message = `Request timed out after ${timeout}ms - the service may be starting up or unresponsive.`;
      } else if (errorMessage.includes('ENOTFOUND')) {
        message = 'Host not found - check the URL is correct.';
      }

      return {
        success: true,
        output: {
          healthy: false,
          error: message,
          message: `Health check failed: ${message}`,
        },
      };
    }
  }

  /**
   * Tool: Get live container logs
   *
   * Fetches current logs directly from Docker containers.
   * Use this to see startup errors when containers crash.
   */
  private async toolGetContainerLogs(args: unknown): Promise<ToolResult> {
    const parsed = GetContainerLogsSchema.safeParse(args);
    if (!parsed.success) {
      return { success: false, output: null, error: 'Invalid parameters' };
    }

    const { service, tail = 50 } = parsed.data;

    try {
      const deployment = await db.query.deployments.findFirst({
        where: eq(schema.deployments.id, this.deploymentId),
      });

      if (!deployment) {
        return { success: false, output: null, error: 'Deployment not found' };
      }

      const metadata = deployment.metadata ? JSON.parse(deployment.metadata) : {};
      const projectName =
        metadata.composeProjectName || `dxlander-${this.deploymentId.substring(0, 12)}`;

      const registry = getExecutorRegistry();
      const executor = registry.get('docker');

      const logs = await executor.getLogs(this.workDir, projectName, {
        tail,
        service: service || undefined,
      });

      return {
        success: true,
        output: {
          logs,
          message: logs.trim() ? `Retrieved ${tail} lines of logs` : 'No logs available yet',
        },
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return { success: false, output: null, error: errorMessage };
    }
  }

  /**
   * Complete the session
   */
  private async completeSession(
    success: boolean,
    summary: string,
    suggestions: string[]
  ): Promise<void> {
    const now = new Date();

    // Get deployment for URL
    const deployment = await db.query.deployments.findFirst({
      where: eq(schema.deployments.id, this.deploymentId),
    });

    // Update session
    await db
      .update(schema.deploymentSessions)
      .set({
        status: success ? 'completed' : 'failed',
        summary,
        fileChanges: JSON.stringify(this.fileChanges),
        completedAt: now,
        updatedAt: now,
      })
      .where(eq(schema.deploymentSessions.id, this.sessionId));

    // Emit completion event
    if (success) {
      this.emitProgress({
        type: 'session_completed',
        success: true,
        summary,
        deployUrl: deployment?.deployUrl || undefined,
      });
    } else {
      this.emitProgress({
        type: 'session_failed',
        error: summary,
        suggestions,
      });
    }
  }

  /**
   * Log session activity
   */
  private async logActivity(
    type: 'tool_call' | 'ai_response' | 'user_action' | 'error',
    action: string,
    input?: unknown,
    output?: unknown
  ): Promise<void> {
    await db.insert(schema.sessionActivity).values({
      id: randomUUID(),
      sessionId: this.sessionId,
      type,
      action,
      input: input ? JSON.stringify(input) : undefined,
      output: output ? JSON.stringify(output) : undefined,
      timestamp: new Date(),
    });
  }

  /**
   * Emit progress event
   */
  private emitProgress(event: SessionProgressEvent): void {
    this.onProgress?.(event);
  }

  /**
   * Get AI provider
   */
  private async getAIProvider(): Promise<any | null> {
    try {
      return await AIProviderService.getProvider({ userId: this.userId });
    } catch {
      return null;
    }
  }

  /**
   * Get deployment env vars from config services
   */
  private async getDeploymentEnvVars(configSetId: string | null): Promise<Record<string, string>> {
    if (!configSetId) return {};

    try {
      const configServices = await ConfigServiceService.getConfigServices(this.userId, configSetId);
      const envVars: Record<string, string> = {};

      for (const service of configServices) {
        if (service.generatedEnvVars) {
          const vars =
            typeof service.generatedEnvVars === 'string'
              ? JSON.parse(service.generatedEnvVars)
              : service.generatedEnvVars;
          Object.assign(envVars, vars);
        }
      }

      return envVars;
    } catch {
      return {};
    }
  }

  /**
   * Get session by ID
   */
  static async getSession(sessionId: string, userId: string) {
    return await db.query.deploymentSessions.findFirst({
      where: and(
        eq(schema.deploymentSessions.id, sessionId),
        eq(schema.deploymentSessions.userId, userId)
      ),
    });
  }

  /**
   * Get sessions for deployment
   */
  static async getSessionsForDeployment(deploymentId: string, userId: string) {
    return await db.query.deploymentSessions.findMany({
      where: and(
        eq(schema.deploymentSessions.deploymentId, deploymentId),
        eq(schema.deploymentSessions.userId, userId)
      ),
    });
  }

  /**
   * Get session activity
   */
  static async getSessionActivity(sessionId: string) {
    return await db.query.sessionActivity.findMany({
      where: eq(schema.sessionActivity.sessionId, sessionId),
    });
  }

  /**
   * Cancel a session
   */
  static async cancelSession(sessionId: string, userId: string): Promise<void> {
    const session = await this.getSession(sessionId, userId);
    if (!session) {
      throw new Error('Session not found');
    }

    if (session.status !== 'active') {
      throw new Error('Session is not active');
    }

    await db
      .update(schema.deploymentSessions)
      .set({
        status: 'cancelled',
        completedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(schema.deploymentSessions.id, sessionId));
  }
}
