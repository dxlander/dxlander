'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Download, CheckCircle2, Clock, XCircle, Loader2, FileText } from 'lucide-react';
import { ActivityLogEntry } from '@/lib/mock-data';
import { cn } from '@/lib/utils';

interface AIActivityMonitorProps {
  progress: number;
  currentActivity: string;
  activityLog: ActivityLogEntry[];
  filesAnalyzed?: Array<{ name: string; status: 'pending' | 'analyzing' | 'complete' }>;
  status: 'analyzing' | 'complete' | 'error';
  onExportLogs?: () => void;
  className?: string;
}

const getStatusIcon = (status: ActivityLogEntry['status']) => {
  switch (status) {
    case 'complete':
      return <CheckCircle2 className="h-4 w-4 text-ocean-600" />;
    case 'in_progress':
      return <Loader2 className="h-4 w-4 text-ocean-600 animate-spin" />;
    case 'error':
      return <XCircle className="h-4 w-4 text-red-600" />;
    case 'pending':
      return <Clock className="h-4 w-4 text-gray-400" />;
  }
};

const getStatusBadgeVariant = (status: ActivityLogEntry['status']) => {
  switch (status) {
    case 'complete':
      return 'default' as const;
    case 'in_progress':
      return 'default' as const;
    case 'error':
      return 'destructive' as const;
    case 'pending':
      return 'secondary' as const;
  }
};

const ActivityLogItem: React.FC<{ entry: ActivityLogEntry }> = ({ entry }) => {
  return (
    <div className="flex gap-3 p-3 rounded-xl border border-gray-100 hover:border-ocean-200/50 hover:bg-ocean-50/20 transition-all duration-200">
      <div className="flex-shrink-0 mt-0.5">{getStatusIcon(entry.status)}</div>
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2 mb-1">
          <p className="text-sm font-medium text-gray-900">{entry.action}</p>
          <Badge variant={getStatusBadgeVariant(entry.status)} className="flex-shrink-0">
            {entry.status.replace('_', ' ')}
          </Badge>
        </div>
        {entry.result && <p className="text-sm text-gray-600 mb-1">{entry.result}</p>}
        {entry.details && entry.details.length > 0 && (
          <ul className="text-xs text-gray-500 space-y-0.5 ml-4 list-disc">
            {entry.details.map((detail, i) => (
              <li key={i}>{detail}</li>
            ))}
          </ul>
        )}
        <div className="flex items-center gap-3 mt-2 text-xs text-gray-400">
          <span>{new Date(entry.timestamp).toLocaleTimeString()}</span>
          {entry.duration && (
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {entry.duration}ms
            </span>
          )}
          {entry.fileName && (
            <span className="flex items-center gap-1">
              <FileText className="h-3 w-3" />
              {entry.fileName}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

export const AIActivityMonitor: React.FC<AIActivityMonitorProps> = ({
  progress,
  currentActivity,
  activityLog,
  filesAnalyzed = [],
  status,
  onExportLogs,
  className,
}) => {
  return (
    <Card variant="elevated" className={cn('', className)}>
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <CardTitle className="text-xl mb-2">AI Analysis Progress</CardTitle>
            <div className="space-y-2">
              <Progress value={progress} className="h-2" />
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">{currentActivity}</span>
                <span className="font-medium text-ocean-600">{progress}%</span>
              </div>
            </div>
          </div>
          {onExportLogs && (
            <Button variant="outline" size="sm" onClick={onExportLogs} className="flex-shrink-0">
              <Download className="h-4 w-4 mr-2" />
              Export Logs
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Files Analyzed Grid */}
        {filesAnalyzed.length > 0 && (
          <div>
            <h4 className="text-sm font-semibold text-gray-900 mb-3">Files Analyzed</h4>
            <div className="flex flex-wrap gap-2">
              {filesAnalyzed.map((file, idx) => (
                <Badge
                  key={idx}
                  variant={file.status === 'analyzing' ? 'default' : 'secondary'}
                  className="flex items-center gap-1.5"
                >
                  {file.status === 'analyzing' && <Loader2 className="h-3 w-3 animate-spin" />}
                  {file.status === 'complete' && <CheckCircle2 className="h-3 w-3" />}
                  {file.name}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Activity Log */}
        <div>
          <h4 className="text-sm font-semibold text-gray-900 mb-3">Activity Log</h4>
          <div className="space-y-2 max-h-[500px] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-ocean-200 scrollbar-track-gray-100">
            {activityLog.length === 0 ? (
              <div className="text-center py-8 text-gray-400">
                <Clock className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No activity yet</p>
              </div>
            ) : (
              activityLog.map((entry) => <ActivityLogItem key={entry.id} entry={entry} />)
            )}
          </div>
        </div>

        {/* Status Summary */}
        {status === 'complete' && (
          <div className="flex items-center gap-2 p-4 rounded-xl bg-ocean-50 border border-ocean-200">
            <CheckCircle2 className="h-5 w-5 text-ocean-600 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-ocean-900">Analysis Complete</p>
              <p className="text-xs text-ocean-700">All files have been analyzed successfully</p>
            </div>
          </div>
        )}

        {status === 'error' && (
          <div className="flex items-center gap-2 p-4 rounded-xl bg-red-50 border border-red-200">
            <XCircle className="h-5 w-5 text-red-600 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-red-900">Analysis Failed</p>
              <p className="text-xs text-red-700">Please check the activity log for details</p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
