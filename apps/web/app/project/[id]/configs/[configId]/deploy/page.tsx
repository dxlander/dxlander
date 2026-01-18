'use client';

import { use, useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { PageLayout, Header } from '@/components/layouts';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { trpc } from '@/lib/trpc';
import {
  AIActivityLog,
  BuildLogsPanel,
  DeploymentStatusCard,
  DeploymentSummary,
  DeploymentTargetSelector,
  type DeploymentPlatform,
} from '@/components/deployment';
import { useDeploymentSessionProgress } from '@/lib/hooks/useSSE';
import type { ActivityLogEntry } from '@/lib/mock-data';

interface PageProps {
  params: Promise<{ id: string; configId: string }>;
}

export default function DeployPage({ params }: PageProps) {
  const resolvedParams = use(params);
  const [selectedPlatform, setSelectedPlatform] = useState<DeploymentPlatform>('docker');
  const [customInstructions, setCustomInstructions] = useState('');
  const [isDeploying, setIsDeploying] = useState(false);
  const [deploymentId, setDeploymentId] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [activities, setActivities] = useState<ActivityLogEntry[]>([]);
  const [buildLogs, setBuildLogs] = useState('');
  const [currentActivity, setCurrentActivity] = useState('Waiting for AI activity...');

  const {
    data: project,
    isLoading: projectLoading,
    error: projectError,
  } = trpc.projects.get.useQuery({
    id: resolvedParams.id,
  });

  const {
    data: configSet,
    isLoading: configLoading,
    error: configError,
  } = trpc.configs.get.useQuery({
    id: resolvedParams.configId,
  });

  const { data: deployment, refetch: refetchDeployment } = trpc.deployments.get.useQuery(
    { deploymentId: deploymentId! },
    { enabled: !!deploymentId, refetchInterval: isDeploying ? 2000 : false }
  );

  const createMutation = trpc.deployments.create.useMutation({
    onSuccess: (data) => {
      setDeploymentId(data.id);
    },
    onError: (error) => {
      setIsDeploying(false);
      addActivity('Deployment failed', error.message);
    },
  });

  const stopMutation = trpc.deployments.stop.useMutation({
    onSuccess: () => refetchDeployment(),
  });

  const startMutation = trpc.deployments.start.useMutation({
    onSuccess: () => refetchDeployment(),
  });

  const restartMutation = trpc.deployments.restart.useMutation({
    onSuccess: () => refetchDeployment(),
  });

  const { data: sessionProgress } = useDeploymentSessionProgress(
    sessionId,
    isDeploying && !!sessionId
  );

  const addActivity = useCallback((action: string, result?: string, details?: string[]) => {
    setActivities((prev) => [
      ...prev,
      {
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        timestamp: new Date(),
        action,
        status: 'complete' as const,
        result,
        details,
      },
    ]);
    setCurrentActivity(action);
  }, []);

  useEffect(() => {
    if (sessionProgress) {
      if (sessionProgress.type === 'progress') {
        if (sessionProgress.activityLog) {
          const newActivities: ActivityLogEntry[] = sessionProgress.activityLog
            .filter((log) => log.type === 'tool_call')
            .map((log) => {
              const details: string[] = [];
              if (log.input) {
                try {
                  const input = typeof log.input === 'string' ? JSON.parse(log.input) : log.input;
                  if (typeof input === 'object' && input !== null) {
                    Object.entries(input).forEach(([key, value]) => {
                      details.push(`${key}: ${JSON.stringify(value)}`);
                    });
                  }
                } catch {
                  details.push(`Input: ${String(log.input)}`);
                }
              }

              let result: string | undefined;
              if (log.output) {
                try {
                  const output =
                    typeof log.output === 'string' ? JSON.parse(log.output) : log.output;
                  if (typeof output === 'object' && output !== null) {
                    if ('success' in output) {
                      result = output.success ? 'Completed successfully' : 'Failed';
                    }
                    if ('message' in output && typeof output.message === 'string') {
                      result = output.message;
                    }
                  }
                } catch {
                  result = String(log.output).slice(0, 100);
                }
              }

              return {
                id: log.id,
                timestamp: new Date(log.timestamp || Date.now()),
                action: log.action || 'Unknown action',
                status: 'complete' as const,
                result,
                details: details.length > 0 ? details : undefined,
              };
            });

          if (newActivities.length > 0 && newActivities.length !== activities.length) {
            setActivities(newActivities);
            const lastActivity = newActivities[newActivities.length - 1];
            if (lastActivity) {
              setCurrentActivity(lastActivity.action);
            }
          }
        }

        if (sessionProgress.buildLogs) {
          setBuildLogs(sessionProgress.buildLogs);
        }

        if (sessionProgress.status === 'completed') {
          setIsDeploying(false);
          setCurrentActivity('Deployment complete');
          refetchDeployment();
        } else if (sessionProgress.status === 'failed') {
          setIsDeploying(false);
          setCurrentActivity('Deployment failed');
          refetchDeployment();
        }
      }
    }
  }, [sessionProgress, activities.length, refetchDeployment]);

  useEffect(() => {
    if (deployment?.metadata) {
      const metadata =
        typeof deployment.metadata === 'string'
          ? JSON.parse(deployment.metadata)
          : deployment.metadata;
      if (metadata.sessionId && !sessionId) {
        setSessionId(metadata.sessionId);
      }
    }
  }, [deployment, sessionId]);

  const handleDeploy = () => {
    setIsDeploying(true);
    setActivities([]);
    setBuildLogs('');
    setCurrentActivity('Starting AI-assisted deployment...');

    addActivity('Starting AI-assisted deployment');

    createMutation.mutate({
      projectId: resolvedParams.id,
      configSetId: resolvedParams.configId,
      platform: selectedPlatform,
      customInstructions: customInstructions || undefined,
      maxAttempts: 3,
    });
  };

  const configMetadata = useMemo(() => {
    if (!configSet?.metadata) return undefined;

    const envVars = configSet.metadata.environmentVariables;
    const ports: Array<{ host: number; container: number; service?: string }> = [];
    const services: Array<{ name: string; image?: string; build?: boolean }> = [];

    if (envVars?.required) {
      for (const v of envVars.required) {
        if (v.key?.toLowerCase().includes('port') && v.value) {
          const portNum = parseInt(v.value, 10);
          if (!isNaN(portNum)) {
            ports.push({ host: portNum, container: portNum });
          }
        }
      }
    }

    if (configSet.files) {
      const composeFile = configSet.files.find(
        (f: { fileName: string }) =>
          f.fileName === 'docker-compose.yml' || f.fileName === 'docker-compose.yaml'
      );
      if (composeFile) {
        services.push({ name: 'app', build: true });
      }
    }

    return {
      environmentVariables: envVars,
      ports: ports.length > 0 ? ports : [{ host: 3000, container: 3000 }],
      services: services.length > 0 ? services : [{ name: 'app', build: true }],
    };
  }, [configSet]);

  const isLoading = projectLoading || configLoading;
  const error = projectError || configError;

  if (isLoading) {
    return (
      <PageLayout background="ocean">
        <Header
          title="Deploy"
          subtitle="Loading..."
          actions={
            <Link href={`/project/${resolvedParams.id}/configs/${resolvedParams.configId}`}>
              <Button variant="ghost" size="sm">
                Back
              </Button>
            </Link>
          }
        />
        <div className="py-12 flex items-center justify-center">
          <div className="text-ocean-600">Loading...</div>
        </div>
      </PageLayout>
    );
  }

  if (error) {
    return (
      <PageLayout background="ocean">
        <Header
          title="Deploy"
          subtitle="Error"
          actions={
            <Link href={`/project/${resolvedParams.id}/configs/${resolvedParams.configId}`}>
              <Button variant="ghost" size="sm">
                Back
              </Button>
            </Link>
          }
        />
        <div className="py-12">
          <Card className="max-w-md mx-auto">
            <CardContent className="pt-6">
              <p className="text-red-500">Failed to load project or configuration</p>
            </CardContent>
          </Card>
        </div>
      </PageLayout>
    );
  }

  const currentStatus = deployment?.status || 'pending';
  const isSessionActive =
    isDeploying && ['pre_flight', 'building', 'deploying'].includes(currentStatus);

  return (
    <PageLayout background="ocean">
      <Header
        title={`Deploy ${project?.name || 'Project'}`}
        subtitle={`${configSet?.name || 'Configuration'} v${configSet?.version || 1}`}
        badge={configSet?.framework || undefined}
        actions={
          <div className="flex items-center gap-2">
            <Link href={`/project/${resolvedParams.id}/configs/${resolvedParams.configId}`}>
              <Button variant="ghost" size="sm">
                Back
              </Button>
            </Link>
            <Link href={`/project/${resolvedParams.id}/configs/${resolvedParams.configId}`}>
              <Button variant="outline" size="sm">
                Edit Config
              </Button>
            </Link>
            <Button
              onClick={handleDeploy}
              disabled={isDeploying || createMutation.isPending}
              className="bg-gradient-to-r from-ocean-600 to-ocean-500 hover:from-ocean-700 hover:to-ocean-600 text-white"
            >
              {isDeploying || createMutation.isPending
                ? 'Deploying...'
                : `Deploy to ${selectedPlatform === 'docker' ? 'Docker' : selectedPlatform}`}
            </Button>
          </div>
        }
      />

      <div className="py-6 px-4 lg:px-6">
        {!deploymentId ? (
          <div className="max-w-7xl mx-auto">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Left Column: Platform Selection & Instructions */}
              <div className="space-y-6">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg">Deployment Target</CardTitle>
                    <CardDescription>Choose where to deploy your application</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <DeploymentTargetSelector
                      selected={selectedPlatform}
                      onSelect={setSelectedPlatform}
                    />
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base">Custom Instructions</CardTitle>
                      <Badge variant="secondary" className="text-xs">
                        Optional
                      </Badge>
                    </div>
                    <CardDescription>
                      Guide the AI deployment agent with specific requirements
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <Label htmlFor="instructions" className="sr-only">
                        Custom Instructions
                      </Label>
                      <Textarea
                        id="instructions"
                        placeholder="e.g., 'Increase memory limit to 2GB', 'Add healthcheck endpoint', 'Use multi-stage build'..."
                        value={customInstructions}
                        onChange={(e) => setCustomInstructions(e.target.value)}
                        className="min-h-[120px] resize-none"
                        disabled={isDeploying}
                      />
                    </div>
                  </CardContent>
                </Card>

                {configSet?.files && configSet.files.length > 0 && (
                  <Card>
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-base">Configuration Files</CardTitle>
                        <Badge variant="secondary">{configSet.files.length}</Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <div className="rounded-lg overflow-hidden">
                        {configSet.files.map(
                          (
                            file: {
                              id: string;
                              fileName: string;
                              fileType: string;
                              sizeBytes?: number;
                            },
                            index: number
                          ) => (
                            <div
                              key={file.id}
                              className={`flex items-center justify-between py-2 px-3 ${index % 2 === 0 ? 'bg-gray-50' : 'bg-white'}`}
                            >
                              <span className="text-sm font-medium text-gray-900">
                                {file.fileName}
                              </span>
                              <div className="flex items-center gap-2">
                                {file.sizeBytes && (
                                  <span className="text-xs text-gray-400">
                                    {(file.sizeBytes / 1024).toFixed(1)} KB
                                  </span>
                                )}
                                <Badge variant="outline" className="text-xs">
                                  {file.fileType}
                                </Badge>
                              </div>
                            </div>
                          )
                        )}
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>

              {/* Right Column: Deployment Summary */}
              <div className="space-y-6">
                <DeploymentSummary
                  projectName={project?.name || 'Project'}
                  projectFramework={configSet?.framework}
                  configName={configSet?.name || 'Config'}
                  configVersion={configSet?.version || 1}
                  metadata={configMetadata}
                  platform={selectedPlatform as 'docker' | 'vercel' | 'railway'}
                />
              </div>
            </div>
          </div>
        ) : (
          <div className="max-w-7xl mx-auto space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <AIActivityLog
                currentActivity={currentActivity}
                activityLog={activities}
                status={
                  deployment?.status === 'failed'
                    ? 'error'
                    : deployment?.status === 'running'
                      ? 'complete'
                      : isSessionActive
                        ? 'active'
                        : 'complete'
                }
                error={deployment?.errorMessage ?? undefined}
              />

              <div className="space-y-6">
                <DeploymentStatusCard
                  status={
                    currentStatus as
                      | 'pending'
                      | 'pre_flight'
                      | 'building'
                      | 'deploying'
                      | 'running'
                      | 'stopped'
                      | 'failed'
                      | 'terminated'
                  }
                  deployUrl={deployment?.deployUrl}
                  errorMessage={deployment?.errorMessage}
                  onStart={() => startMutation.mutate({ deploymentId })}
                  onStop={() => stopMutation.mutate({ deploymentId })}
                  onRestart={() => restartMutation.mutate({ deploymentId })}
                  isActionPending={
                    startMutation.isPending || stopMutation.isPending || restartMutation.isPending
                  }
                />

                <BuildLogsPanel logs={buildLogs} isStreaming={isSessionActive} />
              </div>
            </div>

            {!isSessionActive && deployment?.status !== 'running' && (
              <div className="flex justify-center pt-4">
                <Button
                  variant="outline"
                  onClick={() => {
                    setDeploymentId(null);
                    setSessionId(null);
                    setActivities([]);
                    setBuildLogs('');
                  }}
                >
                  Back to Deployment Setup
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </PageLayout>
  );
}
