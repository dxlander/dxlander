# Deployment Architecture Overview

This document describes the AI-powered deployment architecture in DXLander.

## Core Principles

1. **AI-Only Deployment**: All deployments are handled by an AI agent that can read files, deploy, and fix issues
2. **Real-time Activity Logging**: Every AI action is logged and displayed to the user
3. **Health Verification**: AI verifies deployment health before marking complete
4. **Pluggable Executors**: Each deployment platform (Docker, Railway, Vercel) has its own executor
5. **Universal Project Support**: Works with any project structure or framework

## Architecture Components

### AI Deployment Agent

The AI agent orchestrates the entire deployment process using tools:

```
AI Agent
    │
    ├── readDeploymentFile    → Read project files
    ├── writeDeploymentFile   → Modify configs
    ├── listDeploymentFiles   → Browse project
    ├── runPreFlightChecks    → Validate environment
    ├── deployProject         → docker-compose up
    ├── checkServiceHealth    → Container status
    ├── checkEndpointHealth   → HTTP health check
    ├── getContainerLogs      → Live container logs
    └── completeSession       → Mark done
```

### Executor Interface (`IDeploymentExecutor`)

All deployment platforms implement this interface:

```typescript
interface IDeploymentExecutor {
  readonly platform: DeploymentPlatform;

  runPreFlightChecks(options: PreFlightOptions): Promise<PreFlightResult>;
  deploy(options: DeployOptions): Promise<DeployResult>;
  start(workDir: string, projectName: string): Promise<Result>;
  stop(workDir: string, projectName: string): Promise<Result>;
  restart(workDir: string, projectName: string): Promise<Result>;
  delete(workDir: string, projectName: string, options?: DeleteOptions): Promise<void>;
  getLogs(workDir: string, projectName: string, options?: LogOptions): Promise<string>;
  getStatus(workDir: string, projectName: string): Promise<StatusResult>;
  getDeployUrls(workDir, projectName, envVars?): Promise<UrlResult[]>;
}
```

### Executor Registry

Manages available executors and provides them by platform:

```typescript
const registry = getExecutorRegistry();
const executor = registry.get('docker'); // or 'railway', 'vercel'
await executor.deploy(options);
```

## Deployment Flow

```
┌─────────────────────────────────────────────────────────────────┐
│  User clicks "Deploy to Docker"                                 │
└──────────────────────────┬──────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────────┐
│  Create deployment record and session in DB                     │
└──────────────────────────┬──────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────────┐
│  AI Agent starts with system prompt and tools                   │
│  - Reads project files (Dockerfile, docker-compose.yml)         │
│  - Runs pre-flight checks                                       │
│  - Executes docker-compose up                                   │
│  - Verifies container health                                    │
│  - Makes HTTP health check to endpoint                          │
│  - Marks session complete or handles errors                     │
└──────────────────────────┬──────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────────┐
│  SSE streams real-time progress to frontend                     │
│  - Activity log updates                                         │
│  - Build logs streaming                                         │
│  - Status changes                                               │
└─────────────────────────────────────────────────────────────────┘
```

## Activity Logging

Every AI tool call is logged to the `sessionActivity` table:

| Field       | Description                       |
| ----------- | --------------------------------- |
| `sessionId` | Links to deployment session       |
| `type`      | tool_call, ai_response, error     |
| `action`    | Tool name (e.g., "deployProject") |
| `input`     | Tool input as JSON                |
| `output`    | Tool output as JSON               |
| `timestamp` | When the action occurred          |

Users can view activity logs in two places:

1. **Real-time**: On the deploy page during active deployment
2. **Historical**: In the DeploymentTab logs dialog after deployment

## Health Verification

The AI uses two tools to verify deployments:

### checkServiceHealth

Checks Docker container status:

- Container running state
- Restart count
- Exit codes

### checkEndpointHealth

Makes HTTP requests to verify the service responds:

- Configurable URL
- Expected status code
- Timeout handling
- Response time measurement

## Pre-flight Checks

Checks run before deployment starts:

1. **Docker Installed** - Verifies Docker CLI is available
2. **Docker Daemon Running** - Pings Docker daemon
3. **Docker Compose** - Verifies Compose plugin is installed
4. **Compose File** - Checks docker-compose.yml exists
5. **Compose Validation** - Validates YAML syntax
6. **Docker Images** - Validates images exist in registry
7. **Disk Space** - Ensures sufficient disk space

## Frontend Components

### Dedicated Deploy Page

- Platform selection (Docker, Railway, Vercel)
- Custom instructions input
- Deployment summary
- Real-time AI activity log
- Build logs terminal
- Status card with controls

### DeploymentTab (in Config view)

- Deployment history list
- Status badges
- Start/Stop/Restart controls
- Logs dialog with:
  - AI Activity section
  - Build Logs section
  - Runtime Logs section

## Adding a New Platform

To add a new deployment platform (e.g., Railway):

1. Create `apps/api/src/services/executors/railway.executor.ts`
2. Implement `IDeploymentExecutor` interface
3. Register in `apps/api/src/services/executors/index.ts`
4. Add platform-specific tools to `deployment-agent.service.ts`
5. Add platform card to `DeploymentTargetSelector.tsx`

## File Structure

```
apps/api/src/services/
├── deployment-agent.service.ts    # AI agent
├── deployment-executor.service.ts # Orchestration
├── sse.service.ts                 # Real-time updates
└── executors/
    ├── types.ts                   # Interface definitions
    ├── registry.ts                # ExecutorRegistry
    ├── docker.executor.ts         # Docker Compose
    └── index.ts                   # Initialization

apps/web/
├── app/project/[id]/configs/[configId]/deploy/
│   └── page.tsx                   # Deploy page
└── components/
    ├── deployment/
    │   ├── AIActivityLog.tsx      # Activity display
    │   ├── BuildLogsPanel.tsx     # Build terminal
    │   ├── DeploymentStatusCard.tsx
    │   ├── DeploymentSummary.tsx
    │   └── DeploymentTargetSelector.tsx
    └── configuration/
        └── DeploymentTab.tsx      # Deployment list
```
