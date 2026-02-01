'use client';

import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

interface BuildLogsPanelProps {
  logs: string;
  isStreaming?: boolean;
  className?: string;
}

function parseAnsiCodes(text: string): string {
  // eslint-disable-next-line no-control-regex
  const ansiRegex = /\x1b\[[0-9;]*m/g;
  return text.replace(ansiRegex, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

function highlightLogLine(line: string): { className: string; prefix?: string } {
  const lowerLine = line.toLowerCase();

  if (lowerLine.includes('error') || lowerLine.includes('failed') || lowerLine.includes('fatal')) {
    return { className: 'text-red-400', prefix: '' };
  }
  if (lowerLine.includes('warning') || lowerLine.includes('warn')) {
    return { className: 'text-yellow-400', prefix: '' };
  }
  if (
    lowerLine.includes('success') ||
    lowerLine.includes('done') ||
    lowerLine.includes('completed')
  ) {
    return { className: 'text-green-400', prefix: '' };
  }
  if (line.startsWith('#') || line.startsWith('Step') || line.startsWith('=>')) {
    return { className: 'text-cyan-400 font-semibold', prefix: '' };
  }
  if (line.startsWith('$') || line.startsWith('>')) {
    return { className: 'text-ocean-400', prefix: '' };
  }

  return { className: 'text-muted-foreground', prefix: '' };
}

export function BuildLogsPanel({ logs, isStreaming, className }: BuildLogsPanelProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);

  const cleanLogs = parseAnsiCodes(logs);
  const lines = cleanLogs.split('\n').filter((line) => line.trim());

  useEffect(() => {
    if (scrollRef.current && isStreaming) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs, isStreaming]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(cleanLogs);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API may fail in non-secure contexts
    }
  };

  const handleDownload = () => {
    const blob = new Blob([cleanLogs], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `build-logs-${new Date().toISOString().slice(0, 10)}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <Card className={cn('h-full bg-gray-900 border-gray-800', className)}>
      <CardHeader className="pb-2 border-b border-gray-800">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CardTitle className="text-base text-gray-100">Build Logs</CardTitle>
            {isStreaming && (
              <Badge variant="outline" className="border-ocean-500 text-ocean-400 text-xs">
                Streaming
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCopy}
              className="text-gray-400 hover:text-gray-100 hover:bg-gray-800 text-xs"
            >
              {copied ? 'Copied' : 'Copy'}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDownload}
              className="text-gray-400 hover:text-gray-100 hover:bg-gray-800 text-xs"
            >
              Download
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="h-[300px] overflow-auto" ref={scrollRef}>
          <div className="p-4 font-mono text-sm leading-relaxed">
            {lines.length === 0 ? (
              <div className="flex items-center justify-center h-32 text-muted-foreground">
                <p>Waiting for build output...</p>
              </div>
            ) : (
              lines.map((line, index) => {
                const { className: lineClass } = highlightLogLine(line);
                return (
                  <div key={index} className={cn('whitespace-pre-wrap break-all', lineClass)}>
                    <span className="text-muted-foreground select-none mr-3">
                      {String(index + 1).padStart(3, ' ')}
                    </span>
                    {line}
                  </div>
                );
              })
            )}
            {isStreaming && (
              <div className="flex items-center gap-2 text-muted-foreground mt-2">
                <span className="animate-pulse">_</span>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
