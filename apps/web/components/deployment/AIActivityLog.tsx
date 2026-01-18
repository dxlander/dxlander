'use client';

import React, { useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ActivityLogEntry } from '@/lib/mock-data';
import { cn } from '@/lib/utils';

interface AIActivityLogProps {
  currentActivity: string;
  activityLog: ActivityLogEntry[];
  status: 'active' | 'complete' | 'error';
  error?: string;
  className?: string;
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

export function AIActivityLog({
  currentActivity,
  activityLog,
  status,
  error,
  className,
}: AIActivityLogProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new log entries are added during active deployment
  useEffect(() => {
    if (status === 'active' && scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
    }
  }, [activityLog.length, status]);

  return (
    <Card variant="elevated" className={cn('h-full', className)}>
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <CardTitle className="text-xl mb-1">AI Activity</CardTitle>
            <p className="text-sm text-gray-600">{currentActivity}</p>
          </div>
          {status === 'active' && (
            <Badge className="bg-ocean-100 text-ocean-700 border-ocean-300">Active</Badge>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Activity Log */}
        <div
          ref={scrollContainerRef}
          className="space-y-2 max-h-[400px] overflow-y-auto scroll-smooth"
        >
          {activityLog.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              <p className="text-sm">Waiting for AI activity...</p>
            </div>
          ) : (
            activityLog.map((entry) => <ActivityLogItem key={entry.id} entry={entry} />)
          )}
        </div>

        {/* Status Summary */}
        {status === 'complete' && (
          <div className="flex items-center gap-3 p-4 rounded-lg bg-ocean-50 border border-ocean-200">
            <div>
              <p className="text-sm font-medium text-ocean-900">Deployment Complete</p>
              <p className="text-xs text-ocean-700">Your application is now running</p>
            </div>
          </div>
        )}

        {status === 'error' && (
          <div className="flex items-start gap-3 p-4 rounded-lg bg-red-50 border border-red-200">
            <div className="flex-1">
              <p className="text-sm font-medium text-red-900 mb-1">Deployment Failed</p>
              <p className="text-sm text-red-700">
                {error || 'An error occurred during deployment'}
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
