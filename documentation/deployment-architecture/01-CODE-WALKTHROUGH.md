# Deployment Architecture - Code Walkthrough

## Overview

DXLander uses an **AI-only deployment system** where all deployments are handled by an AI agent that can read files, run pre-flight checks, deploy containers, verify health, and fix issues automatically.

## File Locations

### Backend (API)

| File                                                   | Purpose                                   |
| ------------------------------------------------------ | ----------------------------------------- |
| `apps/api/src/services/deployment-agent.service.ts`    | AI agent that orchestrates deployments    |
| `apps/api/src/services/deployment-executor.service.ts` | High-level deployment orchestration       |
| `apps/api/src/services/executors/docker.executor.ts`   | Docker Compose executor                   |
| `apps/api/src/services/executors/types.ts`             | Interface definitions and types           |
| `apps/api/src/services/executors/registry.ts`          | ExecutorRegistry class                    |
| `apps/api/src/services/sse.service.ts`                 | Server-Sent Events for real-time progress |
| `apps/api/src/routes/deployments.ts`                   | tRPC endpoints                            |
| `apps/api/src/routes/sessions.ts`                      | Session progress endpoint                 |

### Frontend (Web)

| File                                                           | Purpose                         |
| -------------------------------------------------------------- | ------------------------------- |
| `apps/web/app/project/[id]/configs/[configId]/deploy/page.tsx` | Dedicated deployment page       |
| `apps/web/components/deployment/AIActivityLog.tsx`             | Real-time AI activity display   |
| `apps/web/components/deployment/BuildLogsPanel.tsx`            | Build logs terminal             |
| `apps/web/components/deployment/DeploymentStatusCard.tsx`      | Status and controls             |
| `apps/web/components/deployment/DeploymentSummary.tsx`         | Pre-deployment summary          |
| `apps/web/components/deployment/DeploymentTargetSelector.tsx`  | Platform selection              |
| `apps/web/components/configuration/DeploymentTab.tsx`          | Deployment list and logs viewer |

### Shared Types

| File                                                            | Purpose                         |
| --------------------------------------------------------------- | ------------------------------- |
| `packages/shared/src/types/deployment.ts`                       | CreateDeploymentSchema, types   |
| `packages/shared/src/services/ai/tools/recovery-agent-tools.ts` | AI tool definitions and schemas |

## Key Components

### AI Deployment Agent (`deployment-agent.service.ts`)

The AI agent has access to the following tools:

| Tool                    | Purpose                        |
| ----------------------- | ------------------------------ |
| `readDeploymentFile`    | Read files from the project    |
| `writeDeploymentFile`   | Modify configuration files     |
| `listDeploymentFiles`   | List project files             |
| `runPreFlightChecks`    | Validate Docker, images, ports |
| `deployProject`         | Run docker-compose up          |
| `getDeploymentLogs`     | Fetch build/runtime logs       |
| `validateDockerCompose` | Validate compose file syntax   |
| `validateDockerfile`    | Validate Dockerfile syntax     |
| `reportProgress`        | Send status updates to UI      |
| `completeSession`       | Mark deployment as complete    |
| `checkServiceHealth`    | Check container status         |
| `checkEndpointHealth`   | HTTP health check              |
| `getContainerLogs`      | Get live container logs        |

### Activity Logging

AI activities are stored in the `sessionActivity` table:

```typescript
// deployment-agent.service.ts
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
```

### Retrieving Activity Logs

Activity logs are retrieved via `getActivityLogs` in `deployment-executor.service.ts`:

```typescript
async getActivityLogs(userId: string, deploymentId: string) {
  // Get sessionId from deployment metadata
  const metadata = deployment.metadata;
  const sessionId = metadata?.sessionId;

  // Query sessionActivity table
  const logs = await db.query.sessionActivity.findMany({
    where: eq(schema.sessionActivity.sessionId, sessionId),
    orderBy: (sa, { asc }) => [asc(sa.timestamp)],
  });

  return logs;
}
```

## Data Flow

### Deployment Flow

```
User clicks "Deploy to Docker"
       ↓
createMutation.mutate({ projectId, configSetId, platform, customInstructions })
       ↓
tRPC: deployments.create
       ↓
DeploymentExecutorService.createDeployment()
       ↓
1. Create deployment record in DB
2. Create deployment session
3. Start DeploymentAgentService
       ↓
AI Agent runs with tools:
  - readDeploymentFile (analyzes project)
  - runPreFlightChecks (validates environment)
  - deployProject (docker-compose up)
  - checkServiceHealth (verifies containers)
  - checkEndpointHealth (HTTP health check)
  - completeSession (marks done)
       ↓
SSE streams progress to frontend
       ↓
UI updates in real-time
```

### SSE Progress Flow

```
Frontend subscribes to SSE
       ↓
useDeploymentSessionProgress(sessionId)
       ↓
GET /sessions/progress?sessionId=xxx
       ↓
SSEService.getSessionProgress()
       ↓
Returns: { status, buildLogs, activityLog, progress }
       ↓
Frontend updates AIActivityLog, BuildLogsPanel
```

### Viewing Historical Logs

```
User clicks "View Logs" button in DeploymentTab
       ↓
trpc.deployments.getLogs (build/runtime logs)
trpc.deployments.getActivityLogs (AI activity)
       ↓
Dialog shows:
  - AI Activity section
  - Build Logs section
  - Runtime Logs section
```

## Key Functions Reference

### DeploymentAgentService

| Method                      | Purpose                         |
| --------------------------- | ------------------------------- |
| `startSession()`            | Initialize and run the AI agent |
| `createRecoveryTools()`     | Define all available tools      |
| `toolDeploy()`              | Execute docker-compose up       |
| `toolCheckServiceHealth()`  | Check container health          |
| `toolCheckEndpointHealth()` | Make HTTP health check          |
| `logActivity()`             | Store activity in database      |
| `completeSession()`         | Finalize deployment             |

### DeploymentExecutorService

| Method                | Purpose                     |
| --------------------- | --------------------------- |
| `createDeployment()`  | Orchestrate full deployment |
| `getLogs()`           | Get build and runtime logs  |
| `getActivityLogs()`   | Get AI activity logs        |
| `startDeployment()`   | Start stopped container     |
| `stopDeployment()`    | Stop running container      |
| `restartDeployment()` | Restart container           |

### Frontend Components

| Component              | Props                                               | Purpose                     |
| ---------------------- | --------------------------------------------------- | --------------------------- |
| `AIActivityLog`        | `currentActivity`, `activityLog`, `status`, `error` | Display AI tool calls       |
| `BuildLogsPanel`       | `logs`, `isStreaming`                               | Terminal-style build output |
| `DeploymentStatusCard` | `status`, `deployUrl`, controls                     | Status and actions          |

## How to Modify

### Adding a new AI tool

1. Define schema in `recovery-agent-tools.ts`:

```typescript
export const MyToolSchema = z.object({
  param1: z.string(),
  param2: z.number().optional(),
});
```

2. Add to `createRecoveryTools()` in `deployment-agent.service.ts`:

```typescript
myTool: tool({
  description: 'Description of what the tool does',
  inputSchema: MyToolSchema,
  execute: async ({ param1, param2 }) => {
    const result = await this.toolMyTool({ param1, param2 });
    await this.logActivity('tool_call', 'myTool', { param1, param2 }, result.output);
    return result.output;
  },
}),
```

3. Implement the tool method:

```typescript
private async toolMyTool(args: z.infer<typeof MyToolSchema>): Promise<ToolResult> {
  // Implementation
  return { success: true, output: { message: 'Done' } };
}
```

### Adding a new deployment platform

1. Create `apps/api/src/services/executors/railway.executor.ts`
2. Implement `IDeploymentExecutor` interface
3. Register in `initializeExecutors()` in `registry.ts`
4. Add platform to `DeploymentPlatform` type in shared types
5. Add platform tools to `deployment-agent.service.ts`

### Modifying the AI system prompt

Edit `AI_DEPLOYMENT_SYSTEM_PROMPT` in `recovery-agent-tools.ts`:

```typescript
export const AI_DEPLOYMENT_SYSTEM_PROMPT = `
You are an AI deployment assistant...
`;
```

## Database Tables

### deployments

Stores deployment records with:

- `id`, `userId`, `projectId`, `configSetId`
- `status` (pending, pre_flight, building, deploying, running, stopped, failed)
- `buildLogs`, `runtimeLogs`
- `metadata` (includes `sessionId` for linking to activity logs)

### deploymentSessions

Stores AI session information:

- `id`, `deploymentId`, `userId`
- `status`, `maxAttempts`, `currentAttempt`
- `customInstructions`

### sessionActivity

Stores AI activity logs:

- `id`, `sessionId`
- `type` (tool_call, ai_response, user_action, error)
- `action` (tool name)
- `input`, `output` (JSON strings)
- `timestamp`
