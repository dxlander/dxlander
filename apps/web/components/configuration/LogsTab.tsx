'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { FileCode, Terminal, Zap } from 'lucide-react';
import { format } from 'date-fns';

interface LogEntry {
  id: string;
  action: string;
  result?: string;
  details?: any;
  timestamp: string;
}

interface LogsTabProps {
  logs: LogEntry[];
  configStatus: string;
}

export function LogsTab({ logs, configStatus }: LogsTabProps) {
  const getActionIcon = (action: string) => {
    if (action.includes('file') || action.includes('read') || action.includes('write')) {
      return <FileCode className="h-4 w-4" />;
    }
    if (action.includes('ai') || action.includes('generation')) {
      return <Zap className="h-4 w-4" />;
    }
    return <Terminal className="h-4 w-4" />;
  };

  if (!logs || logs.length === 0) {
    return (
      <Card>
        <CardContent className="p-12 text-center">
          <Terminal className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No Logs Available</h3>
          <p className="text-gray-600">
            {configStatus === 'generating'
              ? 'Logs will appear here as the configuration is being generated.'
              : 'No generation logs were recorded for this configuration.'}
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Generation Logs</CardTitle>
            <p className="text-sm text-gray-600 mt-1">
              Activity log from AI configuration generation process
            </p>
          </div>
          <Badge variant="secondary" className="bg-ocean-100 text-ocean-700">
            {logs.length} {logs.length === 1 ? 'entry' : 'entries'}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="max-h-[600px] overflow-y-auto pr-4">
          <div className="space-y-4">
            {logs.map((log, index) => (
              <div
                key={log.id}
                className="flex gap-4 p-4 rounded-lg border border-gray-200 hover:border-ocean-300 transition-colors"
              >
                {/* Timeline connector */}
                <div className="flex flex-col items-center">
                  <div className="p-2 rounded-full bg-gray-100">{getActionIcon(log.action)}</div>
                  {index < logs.length - 1 && <div className="w-px h-full bg-gray-200 mt-2"></div>}
                </div>

                {/* Log content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <h4 className="font-semibold text-gray-900">{formatAction(log.action)}</h4>
                    <span className="text-xs text-gray-500 whitespace-nowrap">
                      {format(new Date(log.timestamp), 'HH:mm:ss')}
                    </span>
                  </div>

                  {log.result && (
                    <p className="text-sm text-gray-700 mb-2 break-words">{log.result}</p>
                  )}

                  {log.details && (
                    <div className="mt-2 p-3 bg-gray-50 rounded border border-gray-200">
                      <details className="text-xs">
                        <summary className="cursor-pointer text-gray-600 font-medium hover:text-gray-900">
                          View Details
                        </summary>
                        <pre className="mt-2 text-gray-700 whitespace-pre-wrap break-all">
                          {typeof log.details === 'string'
                            ? log.details
                            : JSON.stringify(log.details, null, 2)}
                        </pre>
                      </details>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Format action name to be more human-readable
 */
function formatAction(action: string): string {
  return action
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}
