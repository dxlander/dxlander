/**
 * Deployment Agent Service
 *
 * AI-powered deployment service that uses tools to:
 * - Run intelligent pre-flight checks
 * - Detect and suggest fixes for issues
 * - Build Docker images with progress tracking
 * - Deploy containers with proper configuration
 * - Monitor deployment health
 * - Troubleshoot failures
 */

import type { DeploymentProgressEvent, PreFlightCheck, PortMapping } from '@dxlander/shared';
import { DockerDeploymentExecutor } from './executors/docker.executor';
import { AIProviderService } from './ai-provider.service';

/**
 * Deployment request options
 */
export interface DeploymentRequest {
  configPath: string;
  imageTag: string;
  containerName: string;
  ports?: PortMapping[];
  environmentVariables?: Record<string, string>;
  userId: string;
  onProgress?: (event: DeploymentProgressEvent) => void;
}

/**
 * Deployment result
 */
export interface DeploymentResult {
  success: boolean;
  containerId?: string;
  deployUrl?: string;
  ports: PortMapping[];
  preFlightChecks: PreFlightCheck[];
  buildLogs?: string;
  errorMessage?: string;
  aiAnalysis?: string;
}

/**
 * Pre-flight result with AI analysis
 */
export interface PreFlightAnalysis {
  passed: boolean;
  checks: PreFlightCheck[];
  aiAnalysis?: string;
  suggestedFixes?: string[];
}

/**
 * Deployment Agent Service
 *
 * Orchestrates AI-powered deployments with intelligent decision making.
 */
export class DeploymentAgentService {
  private dockerExecutor: DockerDeploymentExecutor;

  constructor() {
    this.dockerExecutor = new DockerDeploymentExecutor();
  }

  /**
   * Run pre-flight checks with AI analysis
   */
  async runPreFlightWithAnalysis(
    configPath: string,
    requestedPorts: number[],
    userId: string,
    onProgress?: (event: DeploymentProgressEvent) => void
  ): Promise<PreFlightAnalysis> {
    onProgress?.({
      type: 'pre_flight',
      message: 'Running pre-flight checks...',
    });

    const result = await this.dockerExecutor.runPreFlightChecks(configPath, requestedPorts);

    if (result.passed) {
      onProgress?.({
        type: 'pre_flight',
        message: 'All pre-flight checks passed',
      });

      return {
        passed: true,
        checks: result.checks,
      };
    }

    onProgress?.({
      type: 'pre_flight',
      message: 'Some checks failed, analyzing issues...',
    });

    const aiAnalysis = await this.analyzePreFlightFailures(result.checks, userId);

    return {
      passed: false,
      checks: result.checks,
      aiAnalysis: aiAnalysis.analysis,
      suggestedFixes: aiAnalysis.fixes,
    };
  }

  /**
   * Analyze pre-flight failures with AI
   */
  private async analyzePreFlightFailures(
    checks: PreFlightCheck[],
    userId: string
  ): Promise<{ analysis: string; fixes: string[] }> {
    const failedChecks = checks.filter((c) => c.status === 'failed');

    if (failedChecks.length === 0) {
      return { analysis: '', fixes: [] };
    }

    try {
      const provider = await AIProviderService.getProvider({ userId });

      const checkDetails = failedChecks
        .map((c) => `- ${c.name}: ${c.message}${c.fix ? ` (Suggested: ${c.fix})` : ''}`)
        .join('\n');

      const response = await provider.chat({
        messages: [
          {
            role: 'system',
            content: `You are a deployment diagnostics assistant. Analyze pre-flight check failures and provide clear, actionable advice. Be concise and technical.`,
          },
          {
            role: 'user',
            content: `The following pre-flight checks failed before Docker deployment:\n\n${checkDetails}\n\nProvide a brief analysis and step-by-step fixes.`,
          },
        ],
        maxTokens: 500,
      });

      const fixes = failedChecks.map((c) => c.fix).filter((f): f is string => !!f);

      return {
        analysis: response.content,
        fixes,
      };
    } catch (error: any) {
      console.error('AI analysis failed:', error.message);
      const fixes = failedChecks.map((c) => c.fix).filter((f): f is string => !!f);
      return {
        analysis: 'AI analysis failed - using default suggestions',
        fixes,
      };
    }
  }

  /**
   * Deploy with AI agent orchestration
   *
   * Currently uses the standard deployment flow.
   * AI-powered orchestration with tool calling will be added in a future enhancement.
   */
  async deployWithAgent(request: DeploymentRequest): Promise<DeploymentResult> {
    return this.deploy(request);
  }

  /**
   * Deploy a Docker container
   *
   * Steps:
   * 1. Run pre-flight checks
   * 2. Detect ports from Dockerfile (if not provided)
   * 3. Build the Docker image
   * 4. Deploy the container
   */
  async deploy(request: DeploymentRequest): Promise<DeploymentResult> {
    const { configPath, imageTag, containerName, ports, environmentVariables, onProgress } =
      request;

    const preFlightChecks: PreFlightCheck[] = [];
    let finalPorts: PortMapping[] = ports || [];

    onProgress?.({
      type: 'pre_flight',
      message: 'Running pre-flight checks...',
    });

    const preFlightResult = await this.dockerExecutor.runPreFlightChecks(
      configPath,
      finalPorts.map((p) => p.host)
    );
    preFlightChecks.push(...preFlightResult.checks);

    if (!preFlightResult.passed) {
      return {
        success: false,
        ports: finalPorts,
        preFlightChecks,
        errorMessage: 'Pre-flight checks failed',
      };
    }

    if (finalPorts.length === 0) {
      onProgress?.({
        type: 'status',
        message: 'Detecting ports from Dockerfile...',
      });

      const path = await import('path');
      const dockerfilePath = path.join(configPath, 'Dockerfile');
      const detectedPorts = await this.dockerExecutor.parseDockerfilePorts(dockerfilePath);

      finalPorts = detectedPorts.map((p) => ({
        host: p,
        container: p,
        protocol: 'tcp' as const,
      }));
    }

    onProgress?.({
      type: 'build',
      message: 'Building Docker image...',
    });

    const buildResult = await this.dockerExecutor.buildImage({
      contextPath: configPath,
      imageTag,
      onProgress: (event) => {
        onProgress?.({
          type: 'build',
          message: event.message,
          progress: event.progress,
        });
      },
    });

    if (!buildResult.success) {
      return {
        success: false,
        ports: finalPorts,
        preFlightChecks,
        buildLogs: buildResult.buildLogs,
        errorMessage: buildResult.errorMessage || 'Build failed',
      };
    }

    onProgress?.({
      type: 'deploy',
      message: 'Deploying container...',
    });

    const deployResult = await this.dockerExecutor.deploy({
      imageTag,
      containerName,
      ports: finalPorts,
      environmentVariables: environmentVariables || {},
      onProgress: (event) => {
        onProgress?.({
          type: 'deploy',
          message: event.message,
        });
      },
    });

    if (!deployResult.success) {
      return {
        success: false,
        ports: finalPorts,
        preFlightChecks,
        buildLogs: buildResult.buildLogs,
        errorMessage: deployResult.errorMessage || 'Deployment failed',
      };
    }

    onProgress?.({
      type: 'status',
      message: 'Deployment completed successfully',
    });

    return {
      success: true,
      containerId: deployResult.containerId,
      deployUrl: deployResult.deployUrl,
      ports: deployResult.ports,
      preFlightChecks,
      buildLogs: buildResult.buildLogs,
    };
  }

  /**
   * Troubleshoot a failed deployment with AI
   */
  async troubleshoot(containerId: string, errorMessage: string, userId: string): Promise<string> {
    try {
      const provider = await AIProviderService.getProvider({ userId });

      let logs = '';
      try {
        logs = await this.dockerExecutor.getLogs(containerId, { tail: 50 });
      } catch {
        logs = 'Unable to retrieve logs';
      }

      let status = 'unknown';
      try {
        const containerStatus = await this.dockerExecutor.getStatus(containerId);
        if (containerStatus) {
          status = containerStatus.status;
        }
      } catch {
        status = 'Unable to retrieve status';
      }

      const response = await provider.chat({
        messages: [
          {
            role: 'system',
            content: `You are a Docker deployment troubleshooting expert. Analyze the error and logs to provide actionable solutions. Be concise and technical.`,
          },
          {
            role: 'user',
            content: `A Docker deployment has failed.

Error: ${errorMessage}

Container Status: ${status}

Recent Logs:
${logs}

What is the likely cause and how can it be fixed?`,
          },
        ],
        maxTokens: 500,
      });

      return response.content;
    } catch (error: any) {
      console.error('AI troubleshooting failed:', error.message);
      return `Troubleshooting analysis failed: ${error.message}`;
    }
  }

  /**
   * Get the Docker executor for direct operations
   */
  getExecutor(): DockerDeploymentExecutor {
    return this.dockerExecutor;
  }
}

export const deploymentAgentService = new DeploymentAgentService();
