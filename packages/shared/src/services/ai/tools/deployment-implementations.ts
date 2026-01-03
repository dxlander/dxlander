/**
 * Deployment Tool Implementations
 *
 * Tools for AI agents to manage Docker deployments.
 * These tools allow AI to:
 * - Run pre-flight checks
 * - Build and deploy Docker containers
 * - Manage container lifecycle
 * - Monitor deployment status
 */

import type { PreFlightCheck, PortMapping, DeploymentStatus } from '../../../types/deployment';

/**
 * Context for deployment tools
 */
export interface DeploymentToolContext {
  configPath: string;
  dockerExecutor: DockerExecutorInterface;
  onProgress?: (event: DeploymentProgressEvent) => void;
}

/**
 * Progress event for deployment operations
 */
export interface DeploymentProgressEvent {
  type: 'pre_flight' | 'build' | 'deploy' | 'status' | 'error';
  message: string;
  progress?: number;
  details?: Record<string, unknown>;
}

/**
 * Docker executor interface for dependency injection
 */
export interface DockerExecutorInterface {
  runPreFlightChecks(
    configPath: string,
    requestedPorts: number[]
  ): Promise<{ passed: boolean; checks: PreFlightCheck[] }>;
  parseDockerfilePorts(dockerfilePath: string): Promise<number[]>;
  buildImage(options: {
    contextPath: string;
    dockerfilePath?: string;
    imageTag: string;
    buildArgs?: Record<string, string>;
    onProgress?: (event: { type: string; message: string; progress?: number }) => void;
  }): Promise<{
    success: boolean;
    imageId?: string;
    imageTag: string;
    buildLogs: string;
    errorMessage?: string;
  }>;
  deploy(options: {
    imageTag: string;
    containerName: string;
    ports: PortMapping[];
    environmentVariables: Record<string, string>;
    onProgress?: (event: { type: string; message: string }) => void;
  }): Promise<{
    success: boolean;
    containerId?: string;
    deployUrl?: string;
    ports: PortMapping[];
    errorMessage?: string;
  }>;
  start(containerId: string): Promise<void>;
  stop(containerId: string): Promise<void>;
  restart(containerId: string): Promise<void>;
  remove(containerId: string, force?: boolean): Promise<void>;
  removeImage(imageTag: string, force?: boolean): Promise<void>;
  getLogs(containerId: string, options?: { tail?: number; since?: number }): Promise<string>;
  getStatus(containerId: string): Promise<{
    status: DeploymentStatus;
    containerId: string;
    running: boolean;
    ports: PortMapping[];
    startedAt?: string;
    exitCode?: number;
  } | null>;
  writeEnvFile(envVars: Record<string, string>, outputPath: string): void;
}

/**
 * Run pre-flight checks before deployment
 */
export async function runPreFlightChecksImpl(
  { requestedPorts = [] }: { requestedPorts?: number[] },
  context: DeploymentToolContext
): Promise<{
  passed: boolean;
  checks: PreFlightCheck[];
  summary: string;
}> {
  context.onProgress?.({
    type: 'pre_flight',
    message: 'Running pre-flight checks...',
  });

  const result = await context.dockerExecutor.runPreFlightChecks(
    context.configPath,
    requestedPorts
  );

  const failedChecks = result.checks.filter((c) => c.status === 'failed');
  const warningChecks = result.checks.filter((c) => c.status === 'warning');

  let summary: string;
  if (result.passed) {
    if (warningChecks.length > 0) {
      summary = `All checks passed with ${warningChecks.length} warning(s)`;
    } else {
      summary = 'All pre-flight checks passed';
    }
  } else {
    summary = `${failedChecks.length} check(s) failed: ${failedChecks.map((c) => c.name).join(', ')}`;
  }

  context.onProgress?.({
    type: 'pre_flight',
    message: summary,
    details: { passed: result.passed, failedCount: failedChecks.length },
  });

  return {
    passed: result.passed,
    checks: result.checks,
    summary,
  };
}

/**
 * Detect exposed ports from Dockerfile
 */
export async function detectDockerfilePortsImpl(
  { dockerfilePath = 'Dockerfile' }: { dockerfilePath?: string },
  context: DeploymentToolContext
): Promise<{
  ports: number[];
  count: number;
  message: string;
}> {
  const fs = await import('fs');
  const path = await import('path');

  const fullPath = path.join(context.configPath, dockerfilePath);

  if (!fs.existsSync(fullPath)) {
    return {
      ports: [],
      count: 0,
      message: `Dockerfile not found at ${dockerfilePath}`,
    };
  }

  const ports = await context.dockerExecutor.parseDockerfilePorts(fullPath);

  return {
    ports,
    count: ports.length,
    message:
      ports.length > 0
        ? `Found ${ports.length} exposed port(s): ${ports.join(', ')}`
        : 'No EXPOSE directives found in Dockerfile',
  };
}

/**
 * Build a Docker image
 */
export async function buildDockerImageImpl(
  {
    imageTag,
    dockerfilePath = 'Dockerfile',
    buildArgs = {},
  }: {
    imageTag: string;
    dockerfilePath?: string;
    buildArgs?: Record<string, string>;
  },
  context: DeploymentToolContext
): Promise<{
  success: boolean;
  imageId?: string;
  imageTag: string;
  logSummary: string;
  errorMessage?: string;
}> {
  context.onProgress?.({
    type: 'build',
    message: `Building Docker image: ${imageTag}`,
  });

  const result = await context.dockerExecutor.buildImage({
    contextPath: context.configPath,
    dockerfilePath,
    imageTag,
    buildArgs,
    onProgress: (event) => {
      context.onProgress?.({
        type: 'build',
        message: event.message,
        progress: event.progress,
      });
    },
  });

  const logLines = result.buildLogs.split('\n').filter(Boolean);
  const logSummary =
    logLines.length > 10 ? `${logLines.length} build steps completed` : result.buildLogs;

  if (result.success) {
    context.onProgress?.({
      type: 'build',
      message: `Image built successfully: ${result.imageId?.substring(0, 12) || imageTag}`,
    });
  } else {
    context.onProgress?.({
      type: 'error',
      message: `Build failed: ${result.errorMessage}`,
    });
  }

  return {
    success: result.success,
    imageId: result.imageId,
    imageTag: result.imageTag,
    logSummary,
    errorMessage: result.errorMessage,
  };
}

/**
 * Deploy (run) a Docker container
 */
export async function runDockerContainerImpl(
  {
    imageTag,
    containerName,
    ports,
    environmentVariables = {},
  }: {
    imageTag: string;
    containerName: string;
    ports: PortMapping[];
    environmentVariables?: Record<string, string>;
  },
  context: DeploymentToolContext
): Promise<{
  success: boolean;
  containerId?: string;
  deployUrl?: string;
  ports: PortMapping[];
  errorMessage?: string;
}> {
  context.onProgress?.({
    type: 'deploy',
    message: `Deploying container: ${containerName}`,
  });

  const result = await context.dockerExecutor.deploy({
    imageTag,
    containerName,
    ports,
    environmentVariables,
    onProgress: (event) => {
      context.onProgress?.({
        type: 'deploy',
        message: event.message,
      });
    },
  });

  if (result.success) {
    context.onProgress?.({
      type: 'deploy',
      message: `Container deployed: ${result.containerId?.substring(0, 12)}`,
      details: { deployUrl: result.deployUrl },
    });
  } else {
    context.onProgress?.({
      type: 'error',
      message: `Deployment failed: ${result.errorMessage}`,
    });
  }

  return result;
}

/**
 * Stop a Docker container
 */
export async function stopDockerContainerImpl(
  { containerId }: { containerId: string },
  context: DeploymentToolContext
): Promise<{
  success: boolean;
  message: string;
}> {
  try {
    context.onProgress?.({
      type: 'status',
      message: `Stopping container: ${containerId.substring(0, 12)}`,
    });

    await context.dockerExecutor.stop(containerId);

    context.onProgress?.({
      type: 'status',
      message: 'Container stopped successfully',
    });

    return {
      success: true,
      message: `Container ${containerId.substring(0, 12)} stopped`,
    };
  } catch (error: any) {
    return {
      success: false,
      message: `Failed to stop container: ${error.message}`,
    };
  }
}

/**
 * Start a stopped Docker container
 */
export async function startDockerContainerImpl(
  { containerId }: { containerId: string },
  context: DeploymentToolContext
): Promise<{
  success: boolean;
  message: string;
}> {
  try {
    context.onProgress?.({
      type: 'status',
      message: `Starting container: ${containerId.substring(0, 12)}`,
    });

    await context.dockerExecutor.start(containerId);

    context.onProgress?.({
      type: 'status',
      message: 'Container started successfully',
    });

    return {
      success: true,
      message: `Container ${containerId.substring(0, 12)} started`,
    };
  } catch (error: any) {
    return {
      success: false,
      message: `Failed to start container: ${error.message}`,
    };
  }
}

/**
 * Restart a Docker container
 */
export async function restartDockerContainerImpl(
  { containerId }: { containerId: string },
  context: DeploymentToolContext
): Promise<{
  success: boolean;
  message: string;
}> {
  try {
    context.onProgress?.({
      type: 'status',
      message: `Restarting container: ${containerId.substring(0, 12)}`,
    });

    await context.dockerExecutor.restart(containerId);

    context.onProgress?.({
      type: 'status',
      message: 'Container restarted successfully',
    });

    return {
      success: true,
      message: `Container ${containerId.substring(0, 12)} restarted`,
    };
  } catch (error: any) {
    return {
      success: false,
      message: `Failed to restart container: ${error.message}`,
    };
  }
}

/**
 * Remove a Docker container
 */
export async function removeDockerContainerImpl(
  { containerId, force = false }: { containerId: string; force?: boolean },
  context: DeploymentToolContext
): Promise<{
  success: boolean;
  message: string;
}> {
  try {
    context.onProgress?.({
      type: 'status',
      message: `Removing container: ${containerId.substring(0, 12)}`,
    });

    await context.dockerExecutor.remove(containerId, force);

    context.onProgress?.({
      type: 'status',
      message: 'Container removed successfully',
    });

    return {
      success: true,
      message: `Container ${containerId.substring(0, 12)} removed`,
    };
  } catch (error: any) {
    return {
      success: false,
      message: `Failed to remove container: ${error.message}`,
    };
  }
}

/**
 * Get container logs
 */
export async function getContainerLogsImpl(
  { containerId, tail = 100 }: { containerId: string; tail?: number },
  context: DeploymentToolContext
): Promise<{
  containerId: string;
  logs: string;
  lineCount: number;
}> {
  const logs = await context.dockerExecutor.getLogs(containerId, { tail });
  const lineCount = logs.split('\n').filter(Boolean).length;

  return {
    containerId,
    logs,
    lineCount,
  };
}

/**
 * Get container status
 */
export async function getContainerStatusImpl(
  { containerId }: { containerId: string },
  context: DeploymentToolContext
): Promise<{
  found: boolean;
  status?: DeploymentStatus;
  running?: boolean;
  ports?: PortMapping[];
  startedAt?: string;
  exitCode?: number;
}> {
  const status = await context.dockerExecutor.getStatus(containerId);

  if (!status) {
    return {
      found: false,
    };
  }

  return {
    found: true,
    status: status.status,
    running: status.running,
    ports: status.ports,
    startedAt: status.startedAt,
    exitCode: status.exitCode,
  };
}

/**
 * Write environment variables to a .env file
 */
export async function writeEnvFileImpl(
  {
    envVars,
    fileName = '.env',
  }: {
    envVars: Record<string, string>;
    fileName?: string;
  },
  context: DeploymentToolContext
): Promise<{
  success: boolean;
  filePath: string;
  variableCount: number;
}> {
  const path = await import('path');
  const outputPath = path.join(context.configPath, fileName);

  try {
    context.dockerExecutor.writeEnvFile(envVars, outputPath);

    return {
      success: true,
      filePath: fileName,
      variableCount: Object.keys(envVars).length,
    };
  } catch (error: any) {
    throw new Error(`Failed to write env file: ${error.message}`);
  }
}
