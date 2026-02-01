import { db, schema } from '@dxlander/database';
import { eq, and, desc } from 'drizzle-orm';
import { randomUUID } from 'crypto';
import * as path from 'path';
import * as fs from 'fs';
import { homedir } from 'os';
import { getExecutorRegistry, initializeExecutors } from './executors';
import { ConfigServiceService } from './config-service.service';
import {
  type DeploymentPlatform,
  type DeploymentStatus,
  type Deployment,
  type DeploymentActivityLog,
  type ErrorAnalysis,
  type SerializedErrorAnalysis,
  resolveProjectPath,
} from '@dxlander/shared';
import type { PreFlightResult } from './executors/types';
import { DeploymentAgentService } from './deployment-agent.service';

// Initialize executors on module load
initializeExecutors();

/**
 * Deployment creation options (AI-only mode)
 */
export interface CreateDeploymentOptions {
  userId: string;
  projectId: string;
  configSetId: string;
  platform: DeploymentPlatform;
  name?: string;
  environment?: string;
  notes?: string;
  customInstructions?: string;
  maxAttempts?: number;
  onProgress?: (event: DeploymentProgressEvent) => void;
}

/**
 * Deployment progress event
 */
export interface DeploymentProgressEvent {
  phase: 'pre_flight' | 'build' | 'deploy' | 'complete' | 'error';
  status: DeploymentStatus;
  message: string;
  progress?: number;
  details?: Record<string, any>;
}

/**
 * Deployment Executor Service
 *
 * Orchestrates AI-powered deployment operations.
 * All deployments use AI agents for intelligent error handling and auto-recovery.
 */
export class DeploymentExecutorService {
  /**
   * Create and execute a deployment using AI agent
   *
   * The AI agent will:
   * 1. Analyze the configuration
   * 2. Run pre-flight checks
   * 3. Handle any errors automatically
   * 4. Attempt deployment with auto-recovery
   */
  async createDeployment(options: CreateDeploymentOptions): Promise<Deployment> {
    const {
      userId,
      projectId,
      configSetId,
      platform,
      name,
      environment = 'development',
      notes,
      customInstructions,
      maxAttempts = 3,
      onProgress,
    } = options;

    // Validate config exists and belongs to user
    const config = await db.query.configSets.findFirst({
      where: and(eq(schema.configSets.id, configSetId), eq(schema.configSets.userId, userId)),
    });

    if (!config) {
      throw new Error('Config set not found or access denied');
    }

    if (!config.localPath) {
      throw new Error('Config set does not have a local path');
    }

    // Resolve relative path to absolute for file operations
    const resolvedConfigPath = resolveProjectPath(config.localPath);
    if (!resolvedConfigPath) {
      throw new Error('Could not resolve config path');
    }

    // Get project
    const project = await db.query.projects.findFirst({
      where: eq(schema.projects.id, projectId),
    });

    if (!project) {
      throw new Error('Project not found');
    }

    const projectDir = path.dirname(path.dirname(resolvedConfigPath));
    const filesDir = path.join(projectDir, 'files');

    if (!fs.existsSync(filesDir)) {
      throw new Error('Project source files not found');
    }

    const dockerfilePath = path.join(resolvedConfigPath, 'Dockerfile');
    const composeFilePath = path.join(resolvedConfigPath, 'docker-compose.yml');

    if (!fs.existsSync(dockerfilePath)) {
      throw new Error('Dockerfile not found in config');
    }

    if (!fs.existsSync(composeFilePath)) {
      throw new Error('docker-compose.yml not found in config');
    }

    // Create deployment record with 'pending' status
    const deploymentId = randomUUID();
    const now = new Date();
    const deploymentName = name || `${project.name}-${Date.now()}`;
    const composeProjectName = `dxlander-${deploymentId.substring(0, 12)}`;
    const dxlanderHome = process.env.DXLANDER_HOME || path.join(homedir(), '.dxlander');
    const buildDir = path.join(dxlanderHome, 'deployments', deploymentId);

    await db.insert(schema.deployments).values({
      id: deploymentId,
      projectId,
      configSetId,
      userId,
      name: deploymentName,
      platform,
      environment,
      status: 'pending',
      notes,
      metadata: JSON.stringify({
        composeProjectName,
        buildDir,
        customInstructions,
        maxAttempts,
      }),
      createdAt: now,
      updatedAt: now,
    });

    await this.logActivity(deploymentId, 'deployment_started', 'Starting AI-assisted deployment');

    onProgress?.({
      phase: 'pre_flight',
      status: 'pre_flight',
      message: 'Starting AI-assisted deployment...',
    });

    try {
      // Create build directory and copy files
      fs.mkdirSync(buildDir, { recursive: true });
      this.copyDirectorySync(filesDir, buildDir);
      fs.copyFileSync(dockerfilePath, path.join(buildDir, 'Dockerfile'));
      fs.copyFileSync(composeFilePath, path.join(buildDir, 'docker-compose.yml'));

      const dockerignorePath = path.join(resolvedConfigPath, '.dockerignore');
      if (fs.existsSync(dockerignorePath)) {
        fs.copyFileSync(dockerignorePath, path.join(buildDir, '.dockerignore'));
      }

      // Prepare environment variables from config's _summary.json
      const envVars = this.extractEnvironmentVariables(resolvedConfigPath);
      if (Object.keys(envVars).length > 0) {
        const envPath = path.join(buildDir, '.env');
        this.writeEnvFile(envVars, envPath);
        await this.logActivity(
          deploymentId,
          'env_prepared',
          `Wrote ${Object.keys(envVars).length} environment variables to .env`
        );
      }

      // Update deployment with build directory
      await db
        .update(schema.deployments)
        .set({
          metadata: JSON.stringify({
            composeProjectName,
            buildDir,
            customInstructions,
            maxAttempts,
          }),
          updatedAt: new Date(),
        })
        .where(eq(schema.deployments.id, deploymentId));

      // Create AI agent service and start session
      const agentService = new DeploymentAgentService();

      const sessionId = await agentService.startAIDeploymentSession({
        deploymentId,
        userId,
        configSetId,
        maxAttempts,
        customInstructions,
        onProgress: (event) => {
          // Convert session events to deployment events
          if (event.type === 'session_started') {
            onProgress?.({
              phase: 'build',
              status: 'building',
              message: 'AI agent started',
            });
          } else if (event.type === 'ai_message') {
            onProgress?.({
              phase: 'build',
              status: 'building',
              message: event.content,
            });
          } else if (event.type === 'deploy_started') {
            onProgress?.({
              phase: 'deploy',
              status: 'deploying',
              message: 'Deploying...',
            });
          } else if (event.type === 'deploy_result') {
            if (event.success) {
              onProgress?.({
                phase: 'complete',
                status: 'running',
                message: 'AI deployment successful',
                details: { deployUrl: event.deployUrl },
              });
            } else {
              onProgress?.({
                phase: 'error',
                status: 'failed',
                message: event.error || 'Deployment failed',
              });
            }
          } else if (event.type === 'session_completed') {
            onProgress?.({
              phase: 'complete',
              status: 'running',
              message: event.summary || 'AI deployment completed',
              details: { deployUrl: event.deployUrl },
            });
          } else if (event.type === 'session_failed') {
            onProgress?.({
              phase: 'error',
              status: 'failed',
              message: event.error,
              details: { suggestions: event.suggestions },
            });
          }
        },
      });

      // Run the agent loop in background (don't await - SSE will track progress)
      agentService.runAgentLoop().catch((error) => {
        console.error('[AI Deployment] Agent loop error:', error);
      });

      // Return the deployment with session ID in metadata
      const deployment = await this.getDeployment(deploymentId);

      // Update metadata to include session ID
      const existingMetadata =
        typeof deployment.metadata === 'string'
          ? JSON.parse(deployment.metadata || '{}')
          : deployment.metadata || {};

      await db
        .update(schema.deployments)
        .set({
          metadata: JSON.stringify({
            ...existingMetadata,
            sessionId,
          }),
          updatedAt: new Date(),
        })
        .where(eq(schema.deployments.id, deploymentId));

      return await this.getDeployment(deploymentId);
    } catch (error: any) {
      await this.logActivity(deploymentId, 'deployment_error', error.message);
      await this.updateDeploymentStatus(deploymentId, 'failed', error.message);

      onProgress?.({
        phase: 'error',
        status: 'failed',
        message: error.message,
      });

      return await this.getDeployment(deploymentId);
    }
  }

  /**
   * Run pre-flight checks for a deployment
   */
  async runPreFlightChecks(
    userId: string,
    configSetId: string,
    platform: DeploymentPlatform
  ): Promise<PreFlightResult> {
    const registry = getExecutorRegistry();
    const executor = registry.get(platform);

    const config = await db.query.configSets.findFirst({
      where: and(eq(schema.configSets.id, configSetId), eq(schema.configSets.userId, userId)),
    });

    if (!config || !config.localPath) {
      throw new Error('Config set not found or missing local path');
    }

    // Resolve relative path to absolute for file operations
    const resolvedConfigPath = resolveProjectPath(config.localPath);
    if (!resolvedConfigPath) {
      throw new Error('Could not resolve config path');
    }

    // Get provision service names for image validation
    const configServices = await ConfigServiceService.getConfigServices(userId, configSetId);
    const provisionServiceNames = configServices
      .filter((s) => s.sourceMode === 'provision')
      .map((s) => s.composeServiceName)
      .filter(Boolean) as string[];

    return await executor.runPreFlightChecks({
      configPath: resolvedConfigPath,
      userId,
      configSetId,
      provisionServiceNames,
    });
  }

  /**
   * Start a stopped deployment
   */
  async startDeployment(userId: string, deploymentId: string): Promise<void> {
    const deployment = await this.getDeploymentWithAuth(userId, deploymentId);
    const { composeProjectName, buildDir } = this.getComposeMetadata(deployment);

    const executor = getExecutorRegistry().get(deployment.platform);
    const result = await executor.start(buildDir, composeProjectName);

    if (!result.success) {
      throw new Error(result.errorMessage || 'Failed to start services');
    }

    await this.updateDeploymentStatus(deploymentId, 'running');
    await this.logActivity(deploymentId, 'services_started', 'Services started');
  }

  /**
   * Stop a running deployment
   */
  async stopDeployment(userId: string, deploymentId: string): Promise<void> {
    const deployment = await this.getDeploymentWithAuth(userId, deploymentId);
    const { composeProjectName, buildDir } = this.getComposeMetadata(deployment);

    const executor = getExecutorRegistry().get(deployment.platform);
    const result = await executor.stop(buildDir, composeProjectName);

    if (!result.success) {
      throw new Error(result.errorMessage || 'Failed to stop services');
    }

    await db
      .update(schema.deployments)
      .set({
        status: 'stopped',
        stoppedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(schema.deployments.id, deploymentId));

    await this.logActivity(deploymentId, 'services_stopped', 'Services stopped');
  }

  /**
   * Restart a deployment
   */
  async restartDeployment(userId: string, deploymentId: string): Promise<void> {
    const deployment = await this.getDeploymentWithAuth(userId, deploymentId);
    const { composeProjectName, buildDir } = this.getComposeMetadata(deployment);

    const executor = getExecutorRegistry().get(deployment.platform);
    const result = await executor.restart(buildDir, composeProjectName);

    if (!result.success) {
      throw new Error(result.errorMessage || 'Failed to restart services');
    }

    await this.updateDeploymentStatus(deploymentId, 'running');
    await this.logActivity(deploymentId, 'services_restarted', 'Services restarted');
  }

  /**
   * Delete a deployment
   */
  async deleteDeployment(
    userId: string,
    deploymentId: string,
    removeImages = false
  ): Promise<void> {
    const deployment = await this.getDeploymentWithAuth(userId, deploymentId);

    try {
      const { composeProjectName, buildDir } = this.getComposeMetadata(deployment);
      const executor = getExecutorRegistry().get(deployment.platform);

      await executor.delete(buildDir, composeProjectName, {
        removeVolumes: true,
        removeImages: removeImages ? 'local' : undefined,
      });

      if (fs.existsSync(buildDir)) {
        try {
          fs.rmSync(buildDir, { recursive: true, force: true });
        } catch {
          // Ignore cleanup errors
        }
      }
    } catch {
      // Metadata may not exist
    }

    await db
      .update(schema.deployments)
      .set({
        status: 'terminated',
        updatedAt: new Date(),
      })
      .where(eq(schema.deployments.id, deploymentId));

    await this.logActivity(deploymentId, 'deployment_deleted', 'Deployment deleted');
  }

  /**
   * Get deployment logs
   */
  async getLogs(
    userId: string,
    deploymentId: string,
    options: { type?: 'build' | 'runtime' | 'all'; tail?: number; service?: string } = {}
  ): Promise<{ buildLogs?: string; runtimeLogs?: string }> {
    const deployment = await this.getDeploymentWithAuth(userId, deploymentId);
    const result: { buildLogs?: string; runtimeLogs?: string } = {};

    if (options.type === 'build' || options.type === 'all' || !options.type) {
      result.buildLogs = deployment.buildLogs ?? undefined;
    }

    if (options.type === 'runtime' || options.type === 'all' || !options.type) {
      try {
        const { composeProjectName, buildDir } = this.getComposeMetadata(deployment);
        const executor = getExecutorRegistry().get(deployment.platform);

        result.runtimeLogs = await executor.getLogs(buildDir, composeProjectName, {
          tail: options.tail,
          service: options.service,
        });

        await db
          .update(schema.deployments)
          .set({
            runtimeLogs: result.runtimeLogs,
            updatedAt: new Date(),
          })
          .where(eq(schema.deployments.id, deploymentId));
      } catch {
        // Deployment may not exist
      }
    }

    return result;
  }

  /**
   * Get deployment status
   */
  async getDeploymentStatus(userId: string, deploymentId: string): Promise<DeploymentStatus> {
    const deployment = await this.getDeploymentWithAuth(userId, deploymentId);

    try {
      const { composeProjectName, buildDir } = this.getComposeMetadata(deployment);
      const executor = getExecutorRegistry().get(deployment.platform);

      const status = await executor.getStatus(buildDir, composeProjectName);

      let newStatus: DeploymentStatus;
      if (status.services.length === 0) {
        newStatus = 'stopped';
      } else if (status.running) {
        const hasRestarting = status.services.some((s) => s.status === 'restarting');
        newStatus = hasRestarting ? 'failed' : 'running';
      } else {
        const hasExited = status.services.some((s) => s.status === 'exited');
        const hasRestarting = status.services.some((s) => s.status === 'restarting');
        if (hasRestarting) {
          newStatus = 'failed';
        } else if (hasExited) {
          newStatus = 'stopped';
        } else {
          newStatus = 'failed';
        }
      }

      if (newStatus !== deployment.status) {
        await this.updateDeploymentStatus(deploymentId, newStatus);
      }

      return newStatus;
    } catch {
      return deployment.status as DeploymentStatus;
    }
  }

  /**
   * Get activity logs for a deployment
   * Fetches from sessionActivity table using the sessionId stored in deployment metadata
   */
  async getActivityLogs(userId: string, deploymentId: string): Promise<DeploymentActivityLog[]> {
    const deployment = await this.getDeploymentWithAuth(userId, deploymentId);

    // Get sessionId from deployment metadata
    let sessionId: string | null = null;
    if (deployment.metadata) {
      try {
        const metadata =
          typeof deployment.metadata === 'string'
            ? JSON.parse(deployment.metadata)
            : deployment.metadata;
        sessionId = metadata?.sessionId || null;
      } catch {
        // Ignore parse errors
      }
    }

    if (!sessionId) {
      return [];
    }

    // Query sessionActivity table instead of deploymentActivityLogs
    const logs = await db.query.sessionActivity.findMany({
      where: eq(schema.sessionActivity.sessionId, sessionId),
      orderBy: (sa, { asc }) => [asc(sa.timestamp)],
    });

    return logs.map((log) => ({
      id: log.id,
      deploymentId: deploymentId,
      action: log.action,
      result: log.output ? this.extractResultFromOutput(log.output) : null,
      details: log.input ? [log.input] : null,
      timestamp: log.timestamp,
    }));
  }

  /**
   * Extract a readable result from tool output
   */
  private extractResultFromOutput(outputStr: string): string | null {
    try {
      const output = JSON.parse(outputStr);
      if (typeof output === 'object' && output !== null) {
        if ('message' in output && typeof output.message === 'string') {
          return output.message;
        }
        if ('success' in output) {
          return output.success ? 'Completed successfully' : 'Failed';
        }
        if ('status' in output && typeof output.status === 'string') {
          return output.status;
        }
      }
      return null;
    } catch {
      return outputStr.slice(0, 100);
    }
  }

  /**
   * List deployments
   */
  async listDeployments(
    userId: string,
    options: {
      projectId?: string;
      configSetId?: string;
      status?: DeploymentStatus;
      limit?: number;
      offset?: number;
    } = {}
  ): Promise<Deployment[]> {
    const { projectId, configSetId, status, limit = 20, offset = 0 } = options;

    const conditions = [eq(schema.deployments.userId, userId)];

    if (projectId) {
      conditions.push(eq(schema.deployments.projectId, projectId));
    }

    if (configSetId) {
      conditions.push(eq(schema.deployments.configSetId, configSetId));
    }

    if (status) {
      conditions.push(eq(schema.deployments.status, status));
    }

    const deployments = await db
      .select()
      .from(schema.deployments)
      .where(and(...conditions))
      .orderBy(desc(schema.deployments.createdAt))
      .limit(limit)
      .offset(offset);

    return deployments.map(this.formatDeployment);
  }

  /**
   * Get a single deployment by ID
   */
  async getDeployment(deploymentId: string): Promise<Deployment> {
    const deployment = await db.query.deployments.findFirst({
      where: eq(schema.deployments.id, deploymentId),
    });

    if (!deployment) {
      throw new Error('Deployment not found');
    }

    return this.formatDeployment(deployment);
  }

  /**
   * Get deployment with auth check
   */
  private async getDeploymentWithAuth(userId: string, deploymentId: string): Promise<Deployment> {
    const deployment = await db.query.deployments.findFirst({
      where: and(eq(schema.deployments.id, deploymentId), eq(schema.deployments.userId, userId)),
    });

    if (!deployment) {
      throw new Error('Deployment not found or access denied');
    }

    return this.formatDeployment(deployment);
  }

  /**
   * Get compose metadata from deployment
   */
  private getComposeMetadata(deployment: Deployment): {
    composeProjectName: string;
    buildDir: string;
  } {
    if (!deployment.metadata) {
      throw new Error('Deployment metadata not found');
    }

    const metadata =
      typeof deployment.metadata === 'string'
        ? JSON.parse(deployment.metadata)
        : deployment.metadata;

    if (!metadata.composeProjectName || !metadata.buildDir) {
      throw new Error('Compose project metadata not found');
    }

    return {
      composeProjectName: metadata.composeProjectName,
      buildDir: metadata.buildDir,
    };
  }

  /**
   * Update deployment status
   */
  private async updateDeploymentStatus(
    deploymentId: string,
    status: DeploymentStatus,
    errorMessage?: string,
    buildLogs?: string
  ): Promise<void> {
    const updates: Record<string, any> = {
      status,
      updatedAt: new Date(),
    };

    if (errorMessage) {
      updates.errorMessage = errorMessage;
    }

    if (buildLogs) {
      updates.buildLogs = buildLogs;
    }

    if (status === 'building' || status === 'pre_flight' || status === 'deploying') {
      updates.startedAt = new Date();
    }

    await db.update(schema.deployments).set(updates).where(eq(schema.deployments.id, deploymentId));
  }

  /**
   * Log deployment activity
   */
  private async logActivity(
    deploymentId: string,
    action: string,
    result: string,
    details?: Record<string, any>
  ): Promise<void> {
    await db.insert(schema.deploymentActivityLogs).values({
      id: randomUUID(),
      deploymentId,
      action,
      result,
      details: details ? JSON.stringify(details) : null,
      timestamp: new Date(),
    });
  }

  /**
   * Copy a directory recursively
   */
  private copyDirectorySync(src: string, dest: string): void {
    fs.mkdirSync(dest, { recursive: true });
    const entries = fs.readdirSync(src, { withFileTypes: true });

    for (const entry of entries) {
      const srcPath = path.join(src, entry.name);
      const destPath = path.join(dest, entry.name);

      if (entry.isDirectory()) {
        this.copyDirectorySync(srcPath, destPath);
      } else {
        fs.copyFileSync(srcPath, destPath);
      }
    }
  }

  /**
   * Validate environment variable names
   */
  private validateEnvVarNames(envVars: Record<string, string>): string[] {
    const errors: string[] = [];
    const validNameRegex = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

    for (const name of Object.keys(envVars)) {
      if (!name) {
        errors.push('Empty environment variable name found');
        continue;
      }

      if (!validNameRegex.test(name)) {
        if (name.includes('*')) {
          errors.push(`"${name}": Wildcard (*) is not allowed`);
        } else if (name.includes(' ')) {
          errors.push(`"${name}": Spaces are not allowed`);
        } else if (/^[0-9]/.test(name)) {
          errors.push(`"${name}": Cannot start with a number`);
        } else {
          errors.push(`"${name}": Contains invalid characters`);
        }
      }
    }

    return errors;
  }

  /**
   * Serialize error analysis for storage/transport
   * Converts Date objects to ISO strings
   */
  private serializeErrorAnalysis(analysis: ErrorAnalysis): SerializedErrorAnalysis {
    return {
      error: {
        ...analysis.error,
        timestamp: analysis.error.timestamp.toISOString(),
      },
      possibleCauses: analysis.possibleCauses,
      suggestedFixes: analysis.suggestedFixes,
      relatedErrors: analysis.relatedErrors,
      aiAnalysisAvailable: analysis.aiAnalysisAvailable,
    };
  }

  /**
   * Format deployment from database
   */
  private formatDeployment(deployment: any): Deployment {
    return {
      id: deployment.id,
      projectId: deployment.projectId,
      configSetId: deployment.configSetId,
      buildRunId: deployment.buildRunId,
      userId: deployment.userId,
      name: deployment.name,
      platform: deployment.platform as DeploymentPlatform,
      environment: deployment.environment,
      status: deployment.status as DeploymentStatus,
      containerId: deployment.containerId,
      imageId: deployment.imageId,
      imageTag: deployment.imageTag,
      ports: deployment.ports ? JSON.parse(deployment.ports) : null,
      exposedPorts: deployment.exposedPorts ? JSON.parse(deployment.exposedPorts) : null,
      deployUrl: deployment.deployUrl,
      serviceUrls: deployment.serviceUrls ? JSON.parse(deployment.serviceUrls) : null,
      previewUrl: deployment.previewUrl,
      buildLogs: deployment.buildLogs,
      runtimeLogs: deployment.runtimeLogs,
      errorMessage: deployment.errorMessage,
      environmentVariables: deployment.environmentVariables,
      notes: deployment.notes,
      metadata: deployment.metadata ? JSON.parse(deployment.metadata) : null,
      startedAt: deployment.startedAt,
      completedAt: deployment.completedAt,
      stoppedAt: deployment.stoppedAt,
      createdAt: deployment.createdAt,
      updatedAt: deployment.updatedAt,
    };
  }

  /**
   * Extract environment variables from config's _summary.json file
   * Parses the environmentVariables section and returns key-value pairs
   */
  private extractEnvironmentVariables(configLocalPath: string | null): Record<string, string> {
    if (!configLocalPath) return {};

    try {
      const summaryPath = path.join(configLocalPath, '_summary.json');
      if (!fs.existsSync(summaryPath)) return {};

      const summaryContent = fs.readFileSync(summaryPath, 'utf-8');
      const summary = JSON.parse(summaryContent);
      const envVars: Record<string, string> = {};

      if (summary.environmentVariables) {
        const { required = [], optional = [] } = summary.environmentVariables;

        for (const envVar of [...required, ...optional]) {
          if (envVar.key) {
            const value = envVar.value || '';
            if (value && this.isValidEnvVarName(envVar.key)) {
              envVars[envVar.key] = value;
            }
          }
        }
      }

      return envVars;
    } catch {
      return {};
    }
  }

  /**
   * Validate environment variable name
   */
  private isValidEnvVarName(name: string): boolean {
    return /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name);
  }

  /**
   * Write environment variables to .env file
   */
  private writeEnvFile(envVars: Record<string, string>, outputPath: string): void {
    const content = Object.entries(envVars)
      .map(([key, value]) => {
        let escapedValue = value
          .replace(/\\/g, '\\\\')
          .replace(/"/g, '\\"')
          .replace(/\n/g, '\\n')
          .replace(/\r/g, '\\r');
        if (/[\s"'#$]/.test(value) || value.includes('\n') || value.includes('\r')) {
          escapedValue = `"${escapedValue}"`;
        }
        return `${key}=${escapedValue}`;
      })
      .join('\n');

    fs.writeFileSync(outputPath, content, 'utf-8');
  }
}
