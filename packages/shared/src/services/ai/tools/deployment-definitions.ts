/**
 * Deployment Tool Definitions for Vercel AI SDK
 *
 * Tools for AI agents to manage Docker deployments. These allow AI to:
 * - Run pre-flight checks and diagnose issues
 * - Build Docker images with progress tracking
 * - Deploy and manage containers
 * - Monitor deployment health
 * - Troubleshoot failures
 */

import { tool } from 'ai';
import { z } from 'zod';
import {
  runPreFlightChecksImpl,
  detectDockerfilePortsImpl,
  buildDockerImageImpl,
  runDockerContainerImpl,
  stopDockerContainerImpl,
  startDockerContainerImpl,
  restartDockerContainerImpl,
  removeDockerContainerImpl,
  getContainerLogsImpl,
  getContainerStatusImpl,
  writeEnvFileImpl,
  type DeploymentToolContext,
} from './deployment-implementations';

/**
 * Create deployment tools for AI agents
 */
export function createDeploymentTools(context: DeploymentToolContext) {
  return {
    /**
     * Run pre-flight checks before deployment
     */
    runPreFlightChecks: tool({
      description: `Run pre-flight checks before deployment. This verifies Docker is installed, daemon is running, Dockerfile exists, requested ports are available, and there's sufficient disk space. Returns detailed results for each check with suggestions for fixing any issues.`,
      inputSchema: z.object({
        requestedPorts: z
          .array(z.number())
          .optional()
          .describe('Array of port numbers to check availability for (e.g., [3000, 5432])'),
      }),
      execute: async ({ requestedPorts }) => runPreFlightChecksImpl({ requestedPorts }, context),
    }),

    /**
     * Detect ports from Dockerfile EXPOSE directives
     */
    detectDockerfilePorts: tool({
      description: `Parse a Dockerfile to detect EXPOSE directives. Use this to auto-detect which ports the application needs. Returns an array of port numbers found.`,
      inputSchema: z.object({
        dockerfilePath: z
          .string()
          .optional()
          .describe('Path to Dockerfile relative to config directory (default: "Dockerfile")'),
      }),
      execute: async ({ dockerfilePath }) => detectDockerfilePortsImpl({ dockerfilePath }, context),
    }),

    /**
     * Build a Docker image from Dockerfile
     */
    buildDockerImage: tool({
      description: `Build a Docker image from the Dockerfile in the config directory. Returns build success status, image ID, and a summary of build logs. Use this before runDockerContainer.`,
      inputSchema: z.object({
        imageTag: z
          .string()
          .describe('Tag for the built image (e.g., "myapp:latest", "myapp:v1.0.0")'),
        dockerfilePath: z
          .string()
          .optional()
          .describe('Path to Dockerfile relative to config directory (default: "Dockerfile")'),
        buildArgs: z
          .record(z.string())
          .optional()
          .describe('Build arguments to pass to Docker build (e.g., {"NODE_ENV": "production"})'),
      }),
      execute: async ({ imageTag, dockerfilePath, buildArgs }) =>
        buildDockerImageImpl({ imageTag, dockerfilePath, buildArgs }, context),
    }),

    /**
     * Run a Docker container from an image
     */
    runDockerContainer: tool({
      description: `Deploy and start a Docker container from a built image. Configures port mappings and environment variables. Returns container ID and deploy URL on success.`,
      inputSchema: z.object({
        imageTag: z.string().describe('Image tag to run (must be built first)'),
        containerName: z
          .string()
          .describe('Name for the container (e.g., "myapp-prod", "myapp-staging")'),
        ports: z
          .array(
            z.object({
              host: z.number().describe('Host port to expose'),
              container: z.number().describe('Container port to map'),
              protocol: z.enum(['tcp', 'udp']).optional().describe('Protocol (default: tcp)'),
            })
          )
          .describe('Port mappings array (e.g., [{host: 8080, container: 3000}])'),
        environmentVariables: z
          .record(z.string())
          .optional()
          .describe('Environment variables to set in container'),
      }),
      execute: async ({ imageTag, containerName, ports, environmentVariables }) =>
        runDockerContainerImpl({ imageTag, containerName, ports, environmentVariables }, context),
    }),

    /**
     * Stop a running container
     */
    stopDockerContainer: tool({
      description: `Stop a running Docker container gracefully. Use getContainerStatus to check current state first.`,
      inputSchema: z.object({
        containerId: z.string().describe('Container ID or name to stop'),
      }),
      execute: async ({ containerId }) => stopDockerContainerImpl({ containerId }, context),
    }),

    /**
     * Start a stopped container
     */
    startDockerContainer: tool({
      description: `Start a stopped Docker container. Use this to resume a previously stopped deployment.`,
      inputSchema: z.object({
        containerId: z.string().describe('Container ID or name to start'),
      }),
      execute: async ({ containerId }) => startDockerContainerImpl({ containerId }, context),
    }),

    /**
     * Restart a container
     */
    restartDockerContainer: tool({
      description: `Restart a Docker container. This stops and starts the container in one operation. Useful for applying config changes or recovering from issues.`,
      inputSchema: z.object({
        containerId: z.string().describe('Container ID or name to restart'),
      }),
      execute: async ({ containerId }) => restartDockerContainerImpl({ containerId }, context),
    }),

    /**
     * Remove a container
     */
    removeDockerContainer: tool({
      description: `Remove a Docker container. The container should be stopped first unless force=true. This permanently deletes the container.`,
      inputSchema: z.object({
        containerId: z.string().describe('Container ID or name to remove'),
        force: z.boolean().optional().describe('Force remove even if running (default: false)'),
      }),
      execute: async ({ containerId, force }) =>
        removeDockerContainerImpl({ containerId, force }, context),
    }),

    /**
     * Get container logs
     */
    getContainerLogs: tool({
      description: `Get logs from a Docker container. Use this to diagnose issues, check application output, or monitor startup. Returns the most recent log lines.`,
      inputSchema: z.object({
        containerId: z.string().describe('Container ID or name'),
        tail: z.number().optional().describe('Number of recent log lines to return (default: 100)'),
      }),
      execute: async ({ containerId, tail }) =>
        getContainerLogsImpl({ containerId, tail }, context),
    }),

    /**
     * Get container status
     */
    getContainerStatus: tool({
      description: `Get current status of a Docker container. Returns running state, port mappings, start time, and exit code if stopped. Use this to check deployment health.`,
      inputSchema: z.object({
        containerId: z.string().describe('Container ID or name'),
      }),
      execute: async ({ containerId }) => getContainerStatusImpl({ containerId }, context),
    }),

    /**
     * Write environment file
     */
    writeEnvFile: tool({
      description: `Write environment variables to a .env file in the config directory. Use this to prepare environment variables before building the Docker image.`,
      inputSchema: z.object({
        envVars: z.record(z.string()).describe('Environment variables to write (key-value pairs)'),
        fileName: z.string().optional().describe('File name (default: ".env")'),
      }),
      execute: async ({ envVars, fileName }) => writeEnvFileImpl({ envVars, fileName }, context),
    }),
  };
}

/**
 * Get the list of deployment tool names
 */
export const deploymentToolNames = [
  'runPreFlightChecks',
  'detectDockerfilePorts',
  'buildDockerImage',
  'runDockerContainer',
  'stopDockerContainer',
  'startDockerContainer',
  'restartDockerContainer',
  'removeDockerContainer',
  'getContainerLogs',
  'getContainerStatus',
  'writeEnvFile',
] as const;

export type DeploymentToolName = (typeof deploymentToolNames)[number];
