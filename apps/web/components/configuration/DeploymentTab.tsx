'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { FloatingInput } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
  Key,
  Info,
  CheckCircle,
} from 'lucide-react';
import { trpc } from '@/lib/trpc';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import { useDeploymentProgress } from '@/lib/hooks/useSSE';
import type { SerializedPreFlightCheck } from '@dxlander/shared';

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
  const [showNewDeploymentDialog, setShowNewDeploymentDialog] = useState(false);
  const [showLogsDialog, setShowLogsDialog] = useState(false);
  const [selectedDeploymentId, setSelectedDeploymentId] = useState<string | null>(null);
  const [deployingId, setDeployingId] = useState<string | null>(null);

  // New deployment form state
  const [deploymentName, setDeploymentName] = useState('');
  const [selectedPlatform, setSelectedPlatform] = useState<string>('docker');
  const [deploymentNotes, setDeploymentNotes] = useState('');

  // Preflight checks state
  const [preflightChecks, setPreflightChecks] = useState<SerializedPreFlightCheck[]>([]);
  const [preflightPassed, setPreflightPassed] = useState<boolean | null>(null);
  const [preflightLoading, setPreflightLoading] = useState(false);

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
  const portVars = allEnvVars.filter((v) => v.key.toUpperCase().includes('PORT'));
  const otherVars = allEnvVars.filter((v) => !v.key.toUpperCase().includes('PORT'));

  // Validate all environment variable names
  const envValidationErrors = allEnvVars
    .map((v) => {
      const error = validateEnvVarName(v.key);
      return error ? { key: v.key, error } : null;
    })
    .filter((e): e is { key: string; error: string } => e !== null);

  const hasEnvErrors = envValidationErrors.length > 0;

  // Mutations
  const createMutation = trpc.deployments.create.useMutation({
    onSuccess: (data) => {
      toast.success('Deployment created');
      setDeployingId(data.id);
      refetchDeployments();
      setShowNewDeploymentDialog(false);
      resetForm();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

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

  const preflightMutation = trpc.deployments.runPreFlightChecks.useMutation({
    onSuccess: (data) => {
      setPreflightChecks(data.checks);
      setPreflightPassed(data.passed);
      setPreflightLoading(false);
    },
    onError: (error) => {
      toast.error(`Preflight check failed: ${error.message}`);
      setPreflightLoading(false);
      setPreflightPassed(false);
    },
  });

  // Run preflight checks when dialog opens
  useEffect(() => {
    if (showNewDeploymentDialog && selectedPlatform === 'docker') {
      setPreflightLoading(true);
      setPreflightChecks([]);
      setPreflightPassed(null);
      preflightMutation.mutate({
        configSetId,
        platform: selectedPlatform as 'docker' | 'vercel' | 'railway',
      });
    }
  }, [showNewDeploymentDialog, selectedPlatform]);

  const runPreflight = () => {
    setPreflightLoading(true);
    setPreflightChecks([]);
    setPreflightPassed(null);
    preflightMutation.mutate({
      configSetId,
      platform: selectedPlatform as 'docker' | 'vercel' | 'railway',
    });
  };

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

  const resetForm = () => {
    setDeploymentName('');
    setSelectedPlatform('docker');
    setDeploymentNotes('');
    setPreflightChecks([]);
    setPreflightPassed(null);
    setPreflightLoading(false);
  };

  const handleCreateDeployment = () => {
    createMutation.mutate({
      projectId,
      configSetId,
      platform: selectedPlatform as 'docker' | 'vercel' | 'railway',
      name: deploymentName || undefined,
      notes: deploymentNotes || undefined,
    });
  };

  const handleViewLogs = (deploymentId: string) => {
    setSelectedDeploymentId(deploymentId);
    setShowLogsDialog(true);
    refetchLogs();
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
            <Button onClick={() => setShowNewDeploymentDialog(true)}>
              <Plus className="h-4 w-4 mr-2" />
              New Deployment
            </Button>
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

                  {/* Error Message */}
                  {deployment.errorMessage && (
                    <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg">
                      <div className="flex items-start gap-2">
                        <AlertTriangle className="h-4 w-4 text-red-600 mt-0.5" />
                        <p className="text-sm text-red-700">{deployment.errorMessage}</p>
                      </div>
                    </div>
                  )}
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

      {/* New Deployment Dialog */}
      <Dialog open={showNewDeploymentDialog} onOpenChange={setShowNewDeploymentDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>New Deployment</DialogTitle>
            <DialogDescription>Review configuration and deploy</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4 max-h-[60vh] overflow-y-auto">
            {/* Platform Selection */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Platform</label>
              <Select value={selectedPlatform} onValueChange={setSelectedPlatform}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="docker">Docker (Local)</SelectItem>
                  <SelectItem value="vercel" disabled>
                    Vercel (Coming Soon)
                  </SelectItem>
                  <SelectItem value="railway" disabled>
                    Railway (Coming Soon)
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Pre-flight Checks */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">Pre-flight Checks</label>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={runPreflight}
                  disabled={preflightLoading}
                  className="h-7 px-2"
                >
                  <RefreshCw className={`h-3 w-3 ${preflightLoading ? 'animate-spin' : ''}`} />
                </Button>
              </div>

              {preflightLoading ? (
                <div className="bg-gray-50 border rounded-lg p-3">
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Running checks...</span>
                  </div>
                </div>
              ) : preflightChecks.length > 0 ? (
                <div
                  className={`border rounded-lg p-3 ${
                    preflightPassed ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'
                  }`}
                >
                  <div className="space-y-2">
                    {preflightChecks.map((check, idx) => (
                      <div key={idx} className="flex items-start gap-2">
                        {check.status === 'passed' && (
                          <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                        )}
                        {check.status === 'warning' && (
                          <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
                        )}
                        {check.status === 'failed' && (
                          <XCircle className="h-4 w-4 text-red-600 mt-0.5 flex-shrink-0" />
                        )}
                        {check.status === 'pending' && (
                          <Loader2 className="h-4 w-4 text-gray-400 mt-0.5 flex-shrink-0 animate-spin" />
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium">{check.name}</span>
                          </div>
                          <p className="text-xs text-gray-600">{check.message}</p>
                          {check.status === 'failed' && check.fix && (
                            <p className="text-xs text-red-600 mt-1">Fix: {check.fix}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="bg-gray-50 border rounded-lg p-3">
                  <p className="text-sm text-gray-500">Pre-flight checks will run automatically</p>
                </div>
              )}
            </div>

            {/* Deployment Name */}
            <FloatingInput
              id="deploymentName"
              label="Deployment Name (Optional)"
              value={deploymentName}
              onChange={(e) => setDeploymentName(e.target.value)}
            />

            {/* Configuration Summary */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Key className="h-4 w-4 text-ocean-600" />
                <label className="text-sm font-medium">Configuration Summary</label>
              </div>

              {/* Port Variables */}
              {portVars.length > 0 && (
                <div className="bg-ocean-50 border border-ocean-200 rounded-lg p-3">
                  <p className="text-xs font-medium text-ocean-700 mb-2">
                    Port Mappings (1:1 from Variables)
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {portVars.map((v, idx) => {
                      const portValue = v.value || v.example || '?';
                      return (
                        <Badge key={idx} variant="secondary" className="font-mono text-xs">
                          {v.key}={portValue} → {portValue}:{portValue}
                        </Badge>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Other Environment Variables */}
              {otherVars.length > 0 && (
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                  <p className="text-xs font-medium text-gray-700 mb-2">
                    Environment Variables ({otherVars.length})
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {otherVars.slice(0, 6).map((v, idx) => (
                      <Badge key={idx} variant="outline" className="font-mono text-xs">
                        {v.key}
                      </Badge>
                    ))}
                    {otherVars.length > 6 && (
                      <Badge variant="outline" className="text-xs">
                        +{otherVars.length - 6} more
                      </Badge>
                    )}
                  </div>
                </div>
              )}

              {allEnvVars.length === 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                  <div className="flex items-start gap-2">
                    <Info className="h-4 w-4 text-amber-600 mt-0.5" />
                    <p className="text-sm text-amber-700">
                      No environment variables configured. You can add them in the Variables tab.
                    </p>
                  </div>
                </div>
              )}

              <p className="text-xs text-gray-500">
                To change ports or variables, edit them in the Variables tab before deploying.
              </p>
            </div>

            {/* Validation Errors */}
            {hasEnvErrors && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                <div className="flex items-start gap-2">
                  <XCircle className="h-4 w-4 text-red-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-red-700 mb-1">
                      Invalid environment variable names
                    </p>
                    <ul className="text-sm text-red-600 space-y-1">
                      {envValidationErrors.map((err, idx) => (
                        <li key={idx} className="font-mono text-xs">
                          <span className="font-semibold">{err.key}</span>: {err.error}
                        </li>
                      ))}
                    </ul>
                    <p className="text-xs text-red-500 mt-2">
                      Fix these in the Variables tab before deploying.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Notes */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Deployment Notes (Optional)</label>
              <Textarea
                value={deploymentNotes}
                onChange={(e) => setDeploymentNotes(e.target.value)}
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewDeploymentDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleCreateDeployment}
              disabled={
                createMutation.isPending ||
                hasEnvErrors ||
                preflightLoading ||
                preflightPassed === false
              }
            >
              {createMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Deploying...
                </>
              ) : preflightLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Checking...
                </>
              ) : (
                <>
                  <Rocket className="h-4 w-4 mr-2" />
                  Deploy
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Logs Dialog */}
      <Dialog open={showLogsDialog} onOpenChange={setShowLogsDialog}>
        <DialogContent className="max-w-4xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>Deployment Logs</DialogTitle>
            <DialogDescription>Build and runtime logs for this deployment</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 overflow-y-auto max-h-[60vh]">
            {logsData?.buildLogs && (
              <div>
                <h4 className="text-sm font-medium mb-2">Build Logs</h4>
                <pre className="bg-gray-900 text-green-400 p-4 rounded-lg text-sm font-mono overflow-x-auto whitespace-pre-wrap">
                  {logsData.buildLogs}
                </pre>
              </div>
            )}
            {logsData?.runtimeLogs && (
              <div>
                <h4 className="text-sm font-medium mb-2">Runtime Logs</h4>
                <pre className="bg-gray-900 text-green-400 p-4 rounded-lg text-sm font-mono overflow-x-auto whitespace-pre-wrap">
                  {logsData.runtimeLogs}
                </pre>
              </div>
            )}
            {!logsData?.buildLogs && !logsData?.runtimeLogs && (
              <div className="text-center py-8 text-gray-500">
                <Terminal className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>No logs available</p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => refetchLogs()}>
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
