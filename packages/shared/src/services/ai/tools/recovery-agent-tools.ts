/**
 * Recovery Agent Tool Definitions
 *
 * Tools for AI agents to fix deployment failures. These tools allow the AI to:
 * - Read and modify deployment files (Dockerfile, docker-compose.yml)
 * - Run pre-flight checks and deployment
 * - Get logs and analyze errors
 * - Report progress to the user
 */

import { z } from 'zod';

/**
 * Tool definition schema following OpenAI/Anthropic format
 */
export interface ToolDefinition {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<
      string,
      {
        type: string;
        description: string;
        enum?: string[];
        items?: { type: string };
      }
    >;
    required?: string[];
  };
}

/**
 * Recovery agent tool definitions
 *
 * These are the tools available to the AI during a recovery session.
 * The AI uses these to analyze errors, modify files, and retry deployment.
 */
export const recoveryAgentToolDefinitions: ToolDefinition[] = [
  {
    name: 'readDeploymentFile',
    description:
      'Read a file from the deployment directory (Dockerfile, docker-compose.yml, source files). Use this to understand the current configuration and identify issues.',
    parameters: {
      type: 'object',
      properties: {
        filePath: {
          type: 'string',
          description:
            'Relative path to file within deployment directory (e.g., "Dockerfile", "docker-compose.yml", "src/index.js")',
        },
      },
      required: ['filePath'],
    },
  },
  {
    name: 'writeDeploymentFile',
    description:
      'Modify or create a file in the deployment directory. Use for fixing Dockerfile, docker-compose.yml, or other configuration issues. Always provide a reason for the change.',
    parameters: {
      type: 'object',
      properties: {
        filePath: {
          type: 'string',
          description: 'Relative path to file (e.g., "Dockerfile")',
        },
        content: {
          type: 'string',
          description: 'Complete new file content',
        },
        reason: {
          type: 'string',
          description: 'Explanation of why this change is needed (shown to user)',
        },
      },
      required: ['filePath', 'content', 'reason'],
    },
  },
  {
    name: 'listDeploymentFiles',
    description:
      'List files in the deployment directory. Use this to explore the project structure and find relevant files.',
    parameters: {
      type: 'object',
      properties: {
        directory: {
          type: 'string',
          description: 'Relative directory path (default: root). Use "." for root directory.',
        },
        recursive: {
          type: 'boolean',
          description: 'Whether to list files recursively (default: false)',
        },
      },
    },
  },
  {
    name: 'runPreFlightChecks',
    description:
      'Run pre-deployment validation checks. This verifies Docker is running, files are valid, ports are available, etc. Run this before attempting deployment.',
    parameters: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'deployProject',
    description:
      'Attempt to deploy the project using docker compose. This builds the image and starts containers. Use after making fixes and running pre-flight checks.',
    parameters: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'getDeploymentLogs',
    description:
      'Get build and runtime logs from the deployment. Use this to understand what went wrong and diagnose issues.',
    parameters: {
      type: 'object',
      properties: {
        type: {
          type: 'string',
          description: 'Type of logs to retrieve',
          enum: ['build', 'runtime', 'all'],
        },
        tail: {
          type: 'number',
          description: 'Number of recent log lines to return (default: 100)',
        },
      },
    },
  },
  {
    name: 'validateDockerCompose',
    description:
      'Validate docker-compose.yml syntax and schema. Use this after modifying the compose file to ensure it is valid before deploying.',
    parameters: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'validateDockerfile',
    description:
      'Validate Dockerfile syntax. Use this after modifying the Dockerfile to ensure it is valid before building.',
    parameters: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'reportProgress',
    description:
      'Report progress or status to the user. Use this to keep the user informed about what you are doing.',
    parameters: {
      type: 'object',
      properties: {
        message: {
          type: 'string',
          description: 'Message to display to the user',
        },
        progressType: {
          type: 'string',
          description: 'Type of progress message',
          enum: ['info', 'success', 'warning', 'error'],
        },
      },
      required: ['message', 'progressType'],
    },
  },
  {
    name: 'completeSession',
    description:
      'Mark the recovery session as complete. Use this when you have successfully fixed the issue OR when you have determined that the issue cannot be automatically fixed.',
    parameters: {
      type: 'object',
      properties: {
        success: {
          type: 'boolean',
          description: 'Whether the deployment was successfully fixed',
        },
        summary: {
          type: 'string',
          description: 'Summary of what was done or why it could not be fixed',
        },
        suggestions: {
          type: 'array',
          description: 'Suggestions for manual steps if automatic fix failed',
          items: { type: 'string' },
        },
      },
      required: ['success', 'summary'],
    },
  },
  {
    name: 'checkServiceHealth',
    description:
      'Check the health status of deployed containers/services. Use this AFTER deployProject to verify containers are actually running and healthy, not just created. Returns container status (running, exited, etc.) and health check status if configured.',
    parameters: {
      type: 'object',
      properties: {
        service: {
          type: 'string',
          description: 'Optional service name to check. If not provided, checks all services.',
        },
      },
    },
  },
  {
    name: 'checkEndpointHealth',
    description:
      'Make an HTTP request to verify a service is responding on its port. Use this AFTER deployProject to confirm the application is actually accessible. This is essential - a container can be "running" but the app inside may have crashed.',
    parameters: {
      type: 'object',
      properties: {
        url: {
          type: 'string',
          description:
            'The URL to check (e.g., "http://localhost:3000" or "http://localhost:3000/health")',
        },
        expectedStatus: {
          type: 'number',
          description:
            'Expected HTTP status code (default: 200). Use 0 to accept any successful response (2xx).',
        },
        timeout: {
          type: 'number',
          description: 'Timeout in milliseconds (default: 5000)',
        },
      },
      required: ['url'],
    },
  },
  {
    name: 'getContainerLogs',
    description:
      'Get live logs from running containers. Unlike getDeploymentLogs which returns stored logs, this fetches current logs directly from Docker. Use this to see real-time errors or startup messages.',
    parameters: {
      type: 'object',
      properties: {
        service: {
          type: 'string',
          description: 'Optional service name. If not provided, gets logs from all services.',
        },
        tail: {
          type: 'number',
          description: 'Number of recent log lines to return (default: 50)',
        },
      },
    },
  },
];

/**
 * Zod schemas for tool parameters
 */
export const ReadDeploymentFileSchema = z.object({
  filePath: z.string().min(1),
});

export const WriteDeploymentFileSchema = z.object({
  filePath: z.string().min(1),
  content: z.string(),
  reason: z.string().min(1),
});

export const ListDeploymentFilesSchema = z.object({
  directory: z.string().optional(),
  recursive: z.boolean().optional(),
});

export const GetDeploymentLogsSchema = z.object({
  type: z.enum(['build', 'runtime', 'all']).optional(),
  tail: z.number().optional(),
});

export const ReportProgressSchema = z.object({
  message: z.string().min(1),
  progressType: z.enum(['info', 'success', 'warning', 'error']),
});

export const CompleteSessionSchema = z.object({
  success: z.boolean(),
  summary: z.string().min(1),
  suggestions: z.array(z.string()).optional(),
});

export const CheckServiceHealthSchema = z.object({
  service: z.string().optional(),
});

export const CheckEndpointHealthSchema = z.object({
  url: z.string().url(),
  expectedStatus: z.number().optional(),
  timeout: z.number().optional(),
});

export const GetContainerLogsSchema = z.object({
  service: z.string().optional(),
  tail: z.number().optional(),
});

/**
 * Tool result types
 */
export interface ReadFileResult {
  success: boolean;
  content?: string;
  error?: string;
}

export interface WriteFileResult {
  success: boolean;
  error?: string;
}

export interface ListFilesResult {
  success: boolean;
  files?: string[];
  error?: string;
}

export interface PreFlightResult {
  passed: boolean;
  checks: Array<{
    name: string;
    status: 'passed' | 'failed' | 'warning';
    message: string;
    fix?: string;
  }>;
}

export interface DeployResult {
  success: boolean;
  deployUrl?: string;
  serviceUrls?: Array<{ service: string; url: string }>;
  logs?: string;
  errorMessage?: string;
}

export interface LogsResult {
  success: boolean;
  buildLogs?: string;
  runtimeLogs?: string;
  error?: string;
}

export interface ValidateResult {
  valid: boolean;
  errors?: string[];
  warnings?: string[];
}

export interface ServiceHealthResult {
  success: boolean;
  running: boolean;
  services: Array<{
    name: string;
    status: 'running' | 'exited' | 'paused' | 'restarting' | 'dead' | 'created' | 'unknown';
    health?: 'healthy' | 'unhealthy' | 'starting' | 'none';
    exitCode?: number;
    ports?: string[];
  }>;
  error?: string;
}

export interface EndpointHealthResult {
  success: boolean;
  healthy: boolean;
  statusCode?: number;
  responseTime?: number;
  error?: string;
}

export interface ContainerLogsResult {
  success: boolean;
  logs?: string;
  error?: string;
}

/**
 * Get the list of recovery agent tool names
 */
export const recoveryAgentToolNames = [
  'readDeploymentFile',
  'writeDeploymentFile',
  'listDeploymentFiles',
  'runPreFlightChecks',
  'deployProject',
  'getDeploymentLogs',
  'validateDockerCompose',
  'validateDockerfile',
  'reportProgress',
  'completeSession',
  'checkServiceHealth',
  'checkEndpointHealth',
  'getContainerLogs',
] as const;

export type RecoveryAgentToolName = (typeof recoveryAgentToolNames)[number];

/**
 * System prompt for recovery agent
 */
export const RECOVERY_AGENT_SYSTEM_PROMPT = `You are a deployment troubleshooting AI for DXLander. Your goal is to fix a failed Docker deployment.

You have access to the deployment directory containing:
- Dockerfile: The Docker build configuration
- docker-compose.yml: The service orchestration configuration
- Project source files

Your tools allow you to:
- Read and modify files
- Run pre-flight checks
- Attempt deployment
- View logs

WORKFLOW:
1. First, understand the error by reading logs and error context provided
2. Read relevant files (Dockerfile, docker-compose.yml) to understand the current state
3. Identify the root cause based on error messages and file contents
4. Make targeted, minimal fixes
5. Run pre-flight checks to validate your changes
6. Attempt deployment
7. If still failing, analyze new errors and iterate (max attempts will be enforced)
8. Use completeSession to report success or failure

GUIDELINES:
- Make minimal, targeted changes - do not rewrite entire files unless necessary
- Explain your reasoning before making changes (use reportProgress)
- Focus on the specific error - don't try to "improve" unrelated things
- If you cannot fix the issue after analysis, explain why and suggest manual steps
- Always use completeSession when finished (success or failure)

COMMON FIXES:
- Port conflicts: Check docker-compose.yml port mappings
- Build failures: Check Dockerfile for missing dependencies or incorrect commands
- Missing env vars: Check if .env file exists and has required variables
- Dependency issues: Check package.json and Dockerfile for correct install commands
- Permission issues: Add appropriate chmod/chown commands in Dockerfile`;

/**
 * Build initial context message for recovery agent
 */
export function buildRecoveryContext(options: {
  errorMessage: string;
  errorAnalysis?: {
    type: string;
    possibleCauses: string[];
    suggestedFixes: Array<{ description: string; confidence: string }>;
  };
  buildLogs?: string;
  dockerfile?: string;
  dockerCompose?: string;
  projectFiles?: string[];
}): string {
  const { errorMessage, errorAnalysis, buildLogs, dockerfile, dockerCompose, projectFiles } =
    options;

  let context = `## Deployment Recovery Session

### Error Message
${errorMessage}
`;

  if (errorAnalysis) {
    context += `
### Error Analysis
- Error Type: ${errorAnalysis.type}
- Possible Causes:
${errorAnalysis.possibleCauses.map((c) => `  - ${c}`).join('\n')}
- Suggested Fixes:
${errorAnalysis.suggestedFixes.map((f) => `  - [${f.confidence}] ${f.description}`).join('\n')}
`;
  }

  if (dockerfile) {
    context += `
### Current Dockerfile
\`\`\`dockerfile
${dockerfile}
\`\`\`
`;
  }

  if (dockerCompose) {
    context += `
### Current docker-compose.yml
\`\`\`yaml
${dockerCompose}
\`\`\`
`;
  }

  if (projectFiles && projectFiles.length > 0) {
    context += `
### Project Files Available
${projectFiles
  .slice(0, 50)
  .map((f) => `- ${f}`)
  .join('\n')}
${projectFiles.length > 50 ? `... and ${projectFiles.length - 50} more files` : ''}
`;
  }

  if (buildLogs) {
    const logLines = buildLogs.split('\n');
    const lastLines = logLines.slice(-100).join('\n');
    context += `
### Recent Build Logs (last 100 lines)
\`\`\`
${lastLines}
\`\`\`
`;
  }

  context += `
### Your Task
Analyze the error and fix the deployment issues. Use your tools to:
1. Read any additional files you need (package.json, source files, etc.)
2. Identify the root cause of the failure
3. Write corrected Dockerfile or docker-compose.yml using the writeDeploymentFile tool
4. Run pre-flight checks to validate your changes
5. Deploy the project to verify the fix works

IMPORTANT: Use the reportProgress tool to keep the user informed of what you're doing.`;

  return context;
}

/**
 * System prompt for AI deployment agent (full deployment, not just recovery)
 */
export const AI_DEPLOYMENT_SYSTEM_PROMPT = `You are a deployment AI for DXLander. Your goal is to successfully deploy a project using Docker.

You have access to the deployment directory containing:
- Dockerfile: The Docker build configuration (already generated)
- docker-compose.yml: The service orchestration configuration (already generated)
- Project source files

Your tools allow you to:
- Read and modify files
- Run pre-flight checks
- Attempt deployment
- View logs
- Verify deployment health

WORKFLOW:
1. First, review the current configuration by reading Dockerfile and docker-compose.yml
2. Run pre-flight checks to validate the environment
3. If pre-flight checks pass, attempt deployment with deployProject
4. CRITICAL: After deployProject returns success, you MUST verify the deployment:
   a. Use checkServiceHealth to verify containers are actually running (not exited/crashed)
   b. Use checkEndpointHealth to verify the app responds on its port
   c. If containers exited, use getContainerLogs to see why they crashed
5. If verification fails, analyze errors and fix the issue
6. Retry deployment (max attempts will be enforced)
7. Only call completeSession with success=true when BOTH checkServiceHealth AND checkEndpointHealth confirm the app is running

IMPORTANT - VERIFYING DEPLOYMENT SUCCESS:
A container being "created" is NOT the same as "running". The deployProject tool may report success
because docker compose started, but the container might crash immediately after. You MUST:
- Call checkServiceHealth after every deployProject to check container status
- Call checkEndpointHealth to confirm the app is responding on its port
- If checkServiceHealth shows containers as "exited", the deployment FAILED
- Use getContainerLogs to see crash errors when containers exit

GUIDELINES:
- Start by running pre-flight checks before attempting deployment
- If pre-flight checks fail, fix the issues before deploying
- Make minimal, targeted changes when fixing issues
- Explain your reasoning using reportProgress
- NEVER mark deployment as successful without verifying with checkServiceHealth and checkEndpointHealth
- If verification fails, analyze logs and fix the issue before retrying
- Always use completeSession when finished (success or failure)

COMMON ISSUES:
- Port conflicts: Change port mappings in docker-compose.yml
- Build failures: Check Dockerfile for missing dependencies
- Missing env vars: Configuration may need environment variables
- Dependency issues: Package installation might fail
- Container crashes: App may crash on startup - check logs with getContainerLogs`;

/**
 * Build initial context message for AI deployment agent (full deployment)
 */
export function buildAIDeploymentContext(options: {
  projectName?: string;
  configSetId: string;
  customInstructions?: string;
}): string {
  const { projectName, configSetId, customInstructions } = options;

  let context = `## AI-Assisted Deployment Session

### Task
Deploy this project using the provided Docker configuration.

### Project
${projectName ? `Name: ${projectName}` : 'Project from configuration'}
Config Set ID: ${configSetId}
`;

  if (customInstructions) {
    context += `
### User Instructions
The user has provided the following additional instructions for this deployment:

${customInstructions}

Please take these instructions into account during the deployment process.
`;
  }

  context += `
### Your Goal
1. Verify the Docker configuration is valid
2. Run pre-flight checks
3. Deploy the project
4. Handle any errors that occur

Please start by reading the Dockerfile and docker-compose.yml to understand the configuration, then run pre-flight checks.`;

  return context;
}
