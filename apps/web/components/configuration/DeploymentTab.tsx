'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Rocket,
  Play,
  Square,
  RefreshCw,
  Trash2,
  MoreHorizontal,
  Terminal,
  Loader2,
  Plus,
  ExternalLink,
  Clock,
  Container,
  Wifi,
  AlertTriangle,
  XCircle,
  Bot,
  ChevronDown,
  ChevronUp,
  Lightbulb,
  Wrench,
} from 'lucide-react';
import { trpc } from '@/lib/trpc';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import { useDeploymentProgress } from '@/lib/hooks/useSSE';
import type { SerializedErrorAnalysis } from '@dxlander/shared';

interface DeploymentTabProps {
  configSetId: string;
  projectId: string;
}

interface EnvironmentVariable {
  key: string;
  description: string;
  value?: string;
  example?: string;
  integration?: string;
}

interface EnvironmentVariables {
  required?: EnvironmentVariable[];
  optional?: EnvironmentVariable[];
}

/**
 * Validate environment variable name
 * Returns error message if invalid, null if valid
 */
const validateEnvVarName = (name: string): string | null => {
  if (!name) return 'Empty variable name';

  const validNameRegex = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

  if (!validNameRegex.test(name)) {
    if (name.includes('*')) {
      return `Wildcard (*) is not allowed`;
    } else if (name.includes(' ')) {
      return `Spaces are not allowed`;
    } else if (/^[0-9]/.test(name)) {
      return `Cannot start with a number`;
    } else {
      return `Contains invalid characters`;
    }
  }

  return null;
};

const getStatusBadge = (status: string) => {
  switch (status) {
    case 'running':
      return (
        <Badge className="bg-green-100 text-green-700 border-green-300">
          <Wifi className="h-3 w-3 mr-1" />
          Running
        </Badge>
      );
    case 'stopped':
      return (
        <Badge variant="secondary">
          <Square className="h-3 w-3 mr-1" />
          Stopped
        </Badge>
      );
    case 'pending':
    case 'pre_flight':
    case 'building':
    case 'deploying':
      return (
        <Badge className="bg-blue-100 text-blue-700 border-blue-300">
          <Loader2 className="h-3 w-3 mr-1 animate-spin" />
          {status.charAt(0).toUpperCase() + status.slice(1).replace('_', ' ')}
        </Badge>
      );
    case 'failed':
      return (
        <Badge variant="destructive">
          <XCircle className="h-3 w-3 mr-1" />
          Failed
        </Badge>
      );
    case 'terminated':
      return (
        <Badge variant="outline" className="text-gray-500">
          <Square className="h-3 w-3 mr-1" />
          Terminated
        </Badge>
      );
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
};

export function DeploymentTab({ configSetId, projectId }: DeploymentTabProps) {
  const [showLogsDialog, setShowLogsDialog] = useState(false);
  const [selectedDeploymentId, setSelectedDeploymentId] = useState<string | null>(null);
  const [deployingId, setDeployingId] = useState<string | null>(null);
  const [expandedErrors, setExpandedErrors] = useState<Set<string>>(new Set());

  // Queries
  const {
    data: deploymentsData,
    isLoading: deploymentsLoading,
    refetch: refetchDeployments,
  } = trpc.deployments.list.useQuery(
    { configSetId, limit: 20, page: 1 },
    { enabled: !!configSetId }
  );

  // Get config to show environment variables summary
  const { data: configSet } = trpc.configs.get.useQuery(
    { id: configSetId },
    { enabled: !!configSetId }
  );

  const { data: logsData, refetch: refetchLogs } = trpc.deployments.getLogs.useQuery(
    { deploymentId: selectedDeploymentId || '', type: 'all', tail: 100 },
    { enabled: !!selectedDeploymentId }
  );

  const { data: activityLogsData, refetch: refetchActivityLogs } =
    trpc.deployments.getActivityLogs.useQuery(
      { deploymentId: selectedDeploymentId || '' },
      { enabled: !!selectedDeploymentId }
    );

  // Parse environment variables from config metadata
  let environmentVariables: EnvironmentVariables | undefined;
  if (configSet?.metadata) {
    try {
      const summary =
        typeof configSet.metadata === 'string'
          ? JSON.parse(configSet.metadata)
          : configSet.metadata;
      environmentVariables = summary?.environmentVariables;
    } catch {
      // Ignore parse errors
    }
  }

  // Extract port-related variables for display
  const allEnvVars = [
    ...(environmentVariables?.required || []),
    ...(environmentVariables?.optional || []),
  ];
  const _portVars = allEnvVars.filter((v) => v.key.toUpperCase().includes('PORT'));
  const _otherVars = allEnvVars.filter((v) => !v.key.toUpperCase().includes('PORT'));

  // Validate all environment variable names
  const envValidationErrors = allEnvVars
    .map((v) => {
      const error = validateEnvVarName(v.key);
      return error ? { key: v.key, error } : null;
    })
    .filter((e): e is { key: string; error: string } => e !== null);

  const _hasEnvErrors = envValidationErrors.length > 0;

  // Mutations
  const startMutation = trpc.deployments.start.useMutation({
    onSuccess: () => {
      toast.success('Deployment started');
      refetchDeployments();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const stopMutation = trpc.deployments.stop.useMutation({
    onSuccess: () => {
      toast.success('Deployment stopped');
      refetchDeployments();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const restartMutation = trpc.deployments.restart.useMutation({
    onSuccess: () => {
      toast.success('Deployment restarted');
      refetchDeployments();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const deleteMutation = trpc.deployments.delete.useMutation({
    onSuccess: () => {
      toast.success('Deployment deleted');
      refetchDeployments();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  // SSE for deployment progress
  const { data: deploymentProgress } = useDeploymentProgress(deployingId, !!deployingId);

  // Clear deploying state when complete
  if (
    deploymentProgress?.status &&
    ['running', 'failed', 'stopped'].includes(deploymentProgress.status)
  ) {
    if (deployingId) {
      setDeployingId(null);
      refetchDeployments();
    }
  }

  const toggleErrorExpanded = (deploymentId: string) => {
    setExpandedErrors((prev) => {
      const next = new Set(prev);
      if (next.has(deploymentId)) {
        next.delete(deploymentId);
      } else {
        next.add(deploymentId);
      }
      return next;
    });
  };

  const getErrorAnalysis = (
    deployment: (typeof deployments)[0]
  ): SerializedErrorAnalysis | null => {
    if (!deployment.metadata) return null;
    try {
      const metadata =
        typeof deployment.metadata === 'string'
          ? JSON.parse(deployment.metadata)
          : deployment.metadata;
      return metadata?.errorAnalysis || null;
    } catch {
      return null;
    }
  };

  const handleViewLogs = (deploymentId: string) => {
    setSelectedDeploymentId(deploymentId);
    setShowLogsDialog(true);
    refetchLogs();
    refetchActivityLogs();
  };

  const deployments = deploymentsData?.deployments || [];

  return (
    <div className="space-y-6">
      {/* Header with New Deployment Button */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Rocket className="h-5 w-5 text-ocean-600" />
              <CardTitle>Deployments</CardTitle>
            </div>
            <Link href={`/project/${projectId}/configs/${configSetId}/deploy`}>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                New Deployment
              </Button>
            </Link>
          </div>
          <CardDescription>Manage container deployments for this configuration</CardDescription>
        </CardHeader>
        <CardContent>
          {/* Deployment Progress Banner */}
          {deployingId && deploymentProgress && (
            <div className="mb-6 p-4 bg-ocean-50 border border-ocean-200 rounded-lg">
              <div className="flex items-center gap-3 mb-2">
                <Loader2 className="h-5 w-5 animate-spin text-ocean-600" />
                <span className="font-medium text-ocean-900">
                  {deploymentProgress.currentAction || 'Processing...'}
                </span>
              </div>
              <Progress value={deploymentProgress.progress || 0} className="h-2" />
              <p className="text-sm text-ocean-700 mt-2">
                {deploymentProgress.currentResult || 'Initializing deployment...'}
              </p>
            </div>
          )}

          {/* Deployments List */}
          {deploymentsLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-ocean-600" />
            </div>
          ) : deployments.length > 0 ? (
            <div className="space-y-4">
              {deployments.map((deployment) => (
                <div
                  key={deployment.id}
                  className="border rounded-lg p-4 hover:border-ocean-300 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      <div className="p-2 rounded-lg bg-ocean-50 text-ocean-600 mt-1">
                        <Container className="h-5 w-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-medium text-gray-900">
                            {deployment.name || `Deployment ${deployment.id.slice(0, 8)}`}
                          </h4>
                          {getStatusBadge(deployment.status)}
                        </div>
                        <div className="flex items-center gap-4 mt-1 text-sm text-gray-500">
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {formatDistanceToNow(new Date(deployment.createdAt), {
                              addSuffix: true,
                            })}
                          </span>
                          <span>Platform: {deployment.platform}</span>
                          {deployment.imageTag && (
                            <span className="font-mono text-xs bg-gray-100 px-1 rounded">
                              {deployment.imageTag}
                            </span>
                          )}
                        </div>
                        {/* Service URLs - show all if multiple, or just deployUrl */}
                        {deployment.serviceUrls && deployment.serviceUrls.length > 1 ? (
                          <div className="mt-2 space-y-1">
                            {deployment.serviceUrls.map(
                              (svc: { service: string; url: string }, idx: number) => (
                                <a
                                  key={idx}
                                  href={svc.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex items-center gap-2 text-sm text-ocean-600 hover:underline"
                                >
                                  <ExternalLink className="h-3 w-3" />
                                  <span className="font-medium">{svc.service}:</span>
                                  {svc.url}
                                </a>
                              )
                            )}
                          </div>
                        ) : deployment.deployUrl ? (
                          <a
                            href={deployment.deployUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 text-sm text-ocean-600 hover:underline mt-1"
                          >
                            <ExternalLink className="h-3 w-3" />
                            {deployment.deployUrl}
                          </a>
                        ) : null}
                        {deployment.ports && (
                          <div className="flex items-center gap-2 mt-2">
                            <span className="text-xs text-gray-500">Ports:</span>
                            {(typeof deployment.ports === 'string'
                              ? JSON.parse(deployment.ports)
                              : deployment.ports
                            ).map((port: { host: number; container: number }, idx: number) => (
                              <Badge key={idx} variant="outline" className="text-xs">
                                {port.host}:{port.container}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {/* Quick Actions */}
                      {deployment.status === 'running' && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => stopMutation.mutate({ deploymentId: deployment.id })}
                          disabled={stopMutation.isPending}
                        >
                          <Square className="h-4 w-4" />
                        </Button>
                      )}
                      {deployment.status === 'stopped' && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => startMutation.mutate({ deploymentId: deployment.id })}
                          disabled={startMutation.isPending}
                        >
                          <Play className="h-4 w-4" />
                        </Button>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleViewLogs(deployment.id)}
                      >
                        <Terminal className="h-4 w-4" />
                      </Button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() => restartMutation.mutate({ deploymentId: deployment.id })}
                            disabled={
                              !['running', 'stopped'].includes(deployment.status) ||
                              restartMutation.isPending
                            }
                          >
                            <RefreshCw className="h-4 w-4 mr-2" />
                            Restart
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-red-600"
                            onClick={() =>
                              deleteMutation.mutate({
                                deploymentId: deployment.id,
                                removeImage: false,
                              })
                            }
                            disabled={deleteMutation.isPending}
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>

                  {/* Error Display with Analysis */}
                  {deployment.status === 'failed' &&
                    deployment.errorMessage &&
                    (() => {
                      const errorAnalysis = getErrorAnalysis(deployment);
                      const isExpanded = expandedErrors.has(deployment.id);

                      return (
                        <div className="mt-3 border border-red-200 rounded-lg overflow-hidden">
                          {/* Error Header */}
                          <div className="p-3 bg-red-50 border-b border-red-200">
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex items-start gap-2 flex-1 min-w-0">
                                <AlertTriangle className="h-4 w-4 text-red-600 mt-0.5 flex-shrink-0" />
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium text-red-700">
                                    {errorAnalysis?.error?.message || deployment.errorMessage}
                                  </p>
                                  {errorAnalysis?.error?.type &&
                                    errorAnalysis.error.type !== 'unknown' && (
                                      <Badge
                                        variant="outline"
                                        className="mt-1 text-xs text-red-600 border-red-300"
                                      >
                                        {errorAnalysis.error.type.replace(/_/g, ' ')}
                                      </Badge>
                                    )}
                                </div>
                              </div>
                              <div className="flex items-center gap-2 flex-shrink-0">
                                {errorAnalysis?.aiAnalysisAvailable && (
                                  <Link
                                    href={`/project/${projectId}/configs/${configSetId}/deploy`}
                                  >
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="h-7 px-2 border-ocean-300 text-ocean-700 hover:bg-ocean-50"
                                    >
                                      <Bot className="h-3 w-3 mr-1" />
                                      Fix with AI
                                    </Button>
                                  </Link>
                                )}
                                {errorAnalysis &&
                                  (errorAnalysis.possibleCauses?.length > 0 ||
                                    errorAnalysis.suggestedFixes?.length > 0) && (
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className="h-7 w-7 p-0"
                                      onClick={() => toggleErrorExpanded(deployment.id)}
                                    >
                                      {isExpanded ? (
                                        <ChevronUp className="h-4 w-4" />
                                      ) : (
                                        <ChevronDown className="h-4 w-4" />
                                      )}
                                    </Button>
                                  )}
                              </div>
                            </div>
                          </div>

                          {/* Expanded Error Details */}
                          {isExpanded && errorAnalysis && (
                            <div className="p-3 bg-white space-y-3">
                              {/* Possible Causes */}
                              {errorAnalysis.possibleCauses &&
                                errorAnalysis.possibleCauses.length > 0 && (
                                  <div>
                                    <div className="flex items-center gap-1.5 text-xs font-medium text-gray-700 mb-1.5">
                                      <Lightbulb className="h-3 w-3 text-amber-500" />
                                      Possible Causes
                                    </div>
                                    <ul className="text-sm text-gray-600 space-y-1 ml-4">
                                      {errorAnalysis.possibleCauses
                                        .slice(0, 4)
                                        .map((cause, idx) => (
                                          <li key={idx} className="list-disc">
                                            {cause}
                                          </li>
                                        ))}
                                    </ul>
                                  </div>
                                )}

                              {/* Suggested Fixes */}
                              {errorAnalysis.suggestedFixes &&
                                errorAnalysis.suggestedFixes.length > 0 && (
                                  <div>
                                    <div className="flex items-center gap-1.5 text-xs font-medium text-gray-700 mb-1.5">
                                      <Wrench className="h-3 w-3 text-ocean-500" />
                                      Suggested Fixes
                                    </div>
                                    <div className="space-y-2">
                                      {errorAnalysis.suggestedFixes.slice(0, 3).map((fix, idx) => (
                                        <div
                                          key={idx}
                                          className="text-sm p-2 bg-gray-50 rounded border border-gray-100"
                                        >
                                          <div className="flex items-start gap-2">
                                            <span className="font-medium text-gray-700">
                                              {fix.description}
                                            </span>
                                            <Badge
                                              variant="outline"
                                              className={`text-xs flex-shrink-0 ${
                                                fix.confidence === 'high'
                                                  ? 'text-green-600 border-green-300'
                                                  : fix.confidence === 'medium'
                                                    ? 'text-amber-600 border-amber-300'
                                                    : 'text-gray-500 border-gray-300'
                                              }`}
                                            >
                                              {fix.confidence}
                                            </Badge>
                                          </div>
                                          {fix.details?.instructions && (
                                            <p className="text-xs text-gray-500 mt-1">
                                              {fix.details.instructions}
                                            </p>
                                          )}
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}

                              {/* Error Context */}
                              {errorAnalysis.error?.context &&
                                errorAnalysis.error.context.length > 0 && (
                                  <div>
                                    <div className="flex items-center gap-1.5 text-xs font-medium text-gray-700 mb-1.5">
                                      <Terminal className="h-3 w-3 text-gray-500" />
                                      Error Context
                                    </div>
                                    <pre className="text-xs bg-gray-900 text-gray-100 p-2 rounded overflow-x-auto max-h-32">
                                      {errorAnalysis.error.context.slice(0, 10).join('\n')}
                                    </pre>
                                  </div>
                                )}
                            </div>
                          )}
                        </div>
                      );
                    })()}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 text-gray-500">
              <Container className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <h3 className="font-medium text-gray-900 mb-1">No deployments yet</h3>
              <p className="text-sm">Create your first deployment to get started</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Logs Dialog */}
      <Dialog open={showLogsDialog} onOpenChange={setShowLogsDialog}>
        <DialogContent className="max-w-4xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>Deployment Logs</DialogTitle>
            <DialogDescription>
              View AI activity and container logs for this deployment
            </DialogDescription>
          </DialogHeader>

          <Tabs defaultValue="ai-activity" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="ai-activity" className="flex items-center gap-2">
                <Bot className="h-4 w-4" />
                AI Activity
                {activityLogsData?.logs && activityLogsData.logs.length > 0 && (
                  <Badge variant="secondary" className="ml-1 text-xs">
                    {activityLogsData.logs.length}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="docker-logs" className="flex items-center gap-2">
                <Terminal className="h-4 w-4" />
                Docker Logs
              </TabsTrigger>
            </TabsList>

            {/* AI Activity Tab */}
            <TabsContent value="ai-activity" className="mt-4">
              <div className="overflow-y-auto max-h-[50vh]">
                {activityLogsData?.logs && activityLogsData.logs.length > 0 ? (
                  <div className="border rounded-lg divide-y">
                    {activityLogsData.logs.map((log) => (
                      <div key={log.id} className="p-3 hover:bg-gray-50">
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <span className="text-sm font-medium text-gray-900">{log.action}</span>
                          <span className="text-xs text-gray-400">
                            {log.timestamp ? new Date(log.timestamp).toLocaleTimeString() : ''}
                          </span>
                        </div>
                        {log.result && <p className="text-sm text-gray-600">{log.result}</p>}
                        {log.details && log.details.length > 0 && (
                          <details className="mt-1">
                            <summary className="text-xs text-gray-500 cursor-pointer hover:text-gray-700">
                              View details
                            </summary>
                            <pre className="mt-1 text-xs bg-gray-100 text-gray-800 p-2 rounded whitespace-pre-wrap break-words max-w-full">
                              {log.details.map((d: string | object, i: number) => (
                                <div key={i}>
                                  {typeof d === 'string' ? d : JSON.stringify(d, null, 2)}
                                </div>
                              ))}
                            </pre>
                          </details>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12 text-gray-500">
                    <Bot className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p>No AI activity logs available</p>
                  </div>
                )}
              </div>
            </TabsContent>

            {/* Docker Logs Tab */}
            <TabsContent value="docker-logs" className="mt-4">
              <div className="overflow-y-auto max-h-[50vh]">
                {logsData?.buildLogs || logsData?.runtimeLogs ? (
                  <div className="space-y-4">
                    {/* Build Logs */}
                    {logsData?.buildLogs && (
                      <div>
                        <h4 className="text-sm font-medium mb-2 text-gray-700">Build Logs</h4>
                        <pre className="bg-gray-900 text-green-400 p-4 rounded-lg text-sm font-mono overflow-x-auto whitespace-pre-wrap">
                          {logsData.buildLogs}
                        </pre>
                      </div>
                    )}

                    {/* Runtime Logs */}
                    {logsData?.runtimeLogs && (
                      <div>
                        <h4 className="text-sm font-medium mb-2 text-gray-700">Runtime Logs</h4>
                        <pre className="bg-gray-900 text-green-400 p-4 rounded-lg text-sm font-mono overflow-x-auto whitespace-pre-wrap">
                          {logsData.runtimeLogs}
                        </pre>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-12 text-gray-500">
                    <Terminal className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p>No Docker logs available</p>
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                refetchLogs();
                refetchActivityLogs();
              }}
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
            <Button onClick={() => setShowLogsDialog(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
