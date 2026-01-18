'use client';

import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

type DeploymentStatus =
  | 'pending'
  | 'pre_flight'
  | 'building'
  | 'deploying'
  | 'running'
  | 'stopped'
  | 'failed'
  | 'terminated';

interface DeploymentStatusCardProps {
  status: DeploymentStatus;
  deployUrl?: string | null;
  errorMessage?: string | null;
  suggestions?: string[];
  onStart?: () => void;
  onStop?: () => void;
  onRestart?: () => void;
  isActionPending?: boolean;
  className?: string;
}

function getStatusConfig(status: DeploymentStatus) {
  switch (status) {
    case 'pending':
      return {
        label: 'Pending',
        color: 'text-gray-500',
        bgColor: 'bg-gray-100',
        borderColor: 'border-gray-200',
      };
    case 'pre_flight':
      return {
        label: 'Running Pre-flight Checks',
        color: 'text-blue-500',
        bgColor: 'bg-blue-50',
        borderColor: 'border-blue-200',
      };
    case 'building':
      return {
        label: 'Building',
        color: 'text-amber-500',
        bgColor: 'bg-amber-50',
        borderColor: 'border-amber-200',
      };
    case 'deploying':
      return {
        label: 'Deploying',
        color: 'text-ocean-500',
        bgColor: 'bg-ocean-50',
        borderColor: 'border-ocean-200',
      };
    case 'running':
      return {
        label: 'Running',
        color: 'text-ocean-600',
        bgColor: 'bg-ocean-50',
        borderColor: 'border-ocean-200',
      };
    case 'stopped':
      return {
        label: 'Stopped',
        color: 'text-gray-500',
        bgColor: 'bg-gray-50',
        borderColor: 'border-gray-200',
      };
    case 'failed':
      return {
        label: 'Failed',
        color: 'text-red-500',
        bgColor: 'bg-red-50',
        borderColor: 'border-red-200',
      };
    case 'terminated':
      return {
        label: 'Terminated',
        color: 'text-red-500',
        bgColor: 'bg-red-50',
        borderColor: 'border-red-200',
      };
    default:
      return {
        label: 'Unknown',
        color: 'text-gray-500',
        bgColor: 'bg-gray-50',
        borderColor: 'border-gray-200',
      };
  }
}

export function DeploymentStatusCard({
  status,
  deployUrl,
  errorMessage,
  suggestions,
  onStart,
  onStop,
  onRestart,
  isActionPending,
  className,
}: DeploymentStatusCardProps) {
  const config = getStatusConfig(status);
  const isInProgress = ['pre_flight', 'building', 'deploying'].includes(status);

  return (
    <Card className={cn(config.bgColor, config.borderColor, 'border', className)}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Deployment Status</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-3">
          <Badge
            variant="secondary"
            className={cn('text-sm px-3 py-1', config.bgColor, config.color)}
          >
            {config.label}
          </Badge>
        </div>

        {deployUrl && status === 'running' && (
          <div className="p-3 bg-white/50 rounded-lg border border-ocean-200">
            <p className="text-sm text-muted-foreground mb-2">Application URL</p>
            <a
              href={deployUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-ocean-600 hover:text-ocean-700 font-medium hover:underline"
            >
              {deployUrl}
            </a>
          </div>
        )}

        {status === 'failed' && errorMessage && (
          <div className="p-3 bg-white/50 rounded-lg border border-red-200">
            <p className="text-sm font-medium text-red-700 mb-1">Error</p>
            <p className="text-sm text-red-600">{errorMessage}</p>
            {suggestions && suggestions.length > 0 && (
              <div className="mt-3">
                <p className="text-sm font-medium text-red-700 mb-1">Suggestions</p>
                <ul className="list-disc list-inside text-sm text-red-600 space-y-1">
                  {suggestions.map((suggestion, index) => (
                    <li key={index}>{suggestion}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {!isInProgress && (
          <div className="flex items-center gap-2 pt-2">
            {status === 'stopped' && onStart && (
              <Button
                size="sm"
                onClick={onStart}
                disabled={isActionPending}
                className="bg-ocean-600 hover:bg-ocean-700"
              >
                {isActionPending ? 'Starting...' : 'Start'}
              </Button>
            )}
            {status === 'running' && onStop && (
              <Button size="sm" variant="destructive" onClick={onStop} disabled={isActionPending}>
                {isActionPending ? 'Stopping...' : 'Stop'}
              </Button>
            )}
            {(status === 'running' || status === 'stopped') && onRestart && (
              <Button size="sm" variant="outline" onClick={onRestart} disabled={isActionPending}>
                {isActionPending ? 'Restarting...' : 'Restart'}
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
