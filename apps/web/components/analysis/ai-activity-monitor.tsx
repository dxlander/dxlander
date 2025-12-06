'use client';

import React from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Download, CheckCircle2, XCircle, ExternalLink } from 'lucide-react';
import { ActivityLogEntry } from '@/lib/mock-data';
import { cn } from '@/lib/utils';

interface AIActivityMonitorProps {
  currentActivity: string;
  activityLog: ActivityLogEntry[];
  status: 'analyzing' | 'complete' | 'error';
  error?: string;
  onExportLogs?: () => void;
  className?: string;
  projectId?: string;
  analysisId?: string;
}

const ActivityLogItem: React.FC<{ entry: ActivityLogEntry }> = ({ entry }) => {
  return (
    <div className="p-3 rounded-lg border border-gray-100 hover:bg-gray-50/50 transition-colors">
      <div className="flex items-start justify-between gap-2 mb-1">
        <p className="text-sm font-medium text-gray-900">{entry.action}</p>
        <span className="text-xs text-gray-400">
          {new Date(entry.timestamp).toLocaleTimeString()}
        </span>
      </div>
      {entry.result && <p className="text-sm text-gray-600">{entry.result}</p>}
      {entry.details && entry.details.length > 0 && (
        <ul className="text-xs text-gray-500 space-y-0.5 ml-4 list-disc mt-1">
          {entry.details.map((detail, i) => (
            <li key={i}>{detail}</li>
          ))}
        </ul>
      )}
    </div>
  );
};

export const AIActivityMonitor: React.FC<AIActivityMonitorProps> = ({
  currentActivity,
  activityLog,
  status,
  error,
  onExportLogs,
  className,
  projectId,
  analysisId,
}) => {
  return (
    <Card variant="elevated" className={cn('', className)}>
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <CardTitle className="text-xl mb-1">AI Analysis</CardTitle>
            <p className="text-sm text-gray-600">{currentActivity}</p>
          </div>
          {onExportLogs && status !== 'analyzing' && (
            <Button variant="outline" size="sm" onClick={onExportLogs} className="flex-shrink-0">
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Activity Log */}
        <div className="space-y-2 max-h-[400px] overflow-y-auto">
          {activityLog.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              <p className="text-sm">Waiting for analysis to start...</p>
            </div>
          ) : (
            activityLog.map((entry) => <ActivityLogItem key={entry.id} entry={entry} />)
          )}
        </div>

        {/* Status Summary */}
        {status === 'complete' && (
          <div className="flex items-center gap-3 p-4 rounded-lg bg-ocean-50 border border-ocean-200">
            <CheckCircle2 className="h-5 w-5 text-ocean-600 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-ocean-900">Analysis Complete</p>
              <p className="text-xs text-ocean-700">Configuration is ready to use</p>
            </div>
          </div>
        )}

        {status === 'error' && (
          <div className="flex items-start gap-3 p-4 rounded-lg bg-red-50 border border-red-200">
            <XCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-medium text-red-900 mb-1">Analysis Failed</p>
              <p className="text-sm text-red-700 mb-3">
                {error || 'An error occurred during analysis'}
              </p>
              {projectId && analysisId && (
                <Link href={`/project/${projectId}/logs?run=${analysisId}`}>
                  <Button variant="outline" size="sm" className="bg-white">
                    <ExternalLink className="h-3 w-3 mr-2" />
                    View Detailed Logs
                  </Button>
                </Link>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
