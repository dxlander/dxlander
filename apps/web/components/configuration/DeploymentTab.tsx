'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  Terminal,
  Zap,
  Activity,
  AlertCircle,
  CheckCircle2,
  BookOpen,
  Info,
  Copy,
} from 'lucide-react';

// Type definitions for deployment
interface DeploymentSummary {
  summary?: {
    deploymentNotes?: string;
  };
  deployment?: {
    buildCommand?: string;
    runCommand?: string;
    instructions?: string;
  };
  optimization?: {
    features?: string[];
    buildTimeOptimizations?: string[];
  };
  recommendations?: string[];
}

interface DeploymentTabProps {
  summary: DeploymentSummary | null;
}

export function DeploymentTab({ summary }: DeploymentTabProps) {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const handleCopyKey = (key: string) => {
    navigator.clipboard.writeText(key);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Deployment Notes Alert */}
      {summary?.summary?.deploymentNotes && (
        <Alert>
          <Info className="h-4 w-4" />
          <AlertTitle>Deployment Considerations</AlertTitle>
          <AlertDescription>{summary.summary.deploymentNotes}</AlertDescription>
        </Alert>
      )}

      {/* Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column - Commands & Features */}
        <div className="space-y-6">
          {/* Commands */}
          {(summary?.deployment?.buildCommand || summary?.deployment?.runCommand) && (
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Terminal className="h-5 w-5 text-ocean-600" />
                  <CardTitle>Commands</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {summary.deployment?.buildCommand && (
                  <div>
                    <p className="text-xs font-medium text-gray-500 mb-2 uppercase tracking-wide">
                      Build
                    </p>
                    <div className="relative group">
                      <pre className="bg-gray-900 text-green-400 p-3 rounded-lg font-mono text-sm overflow-x-auto">
                        {summary.deployment?.buildCommand || 'No build command'}
                      </pre>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          summary.deployment?.buildCommand &&
                          handleCopyKey(summary.deployment.buildCommand)
                        }
                        className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity bg-gray-800 hover:bg-gray-700"
                        disabled={!summary.deployment?.buildCommand}
                      >
                        {copiedKey === summary.deployment?.buildCommand ? (
                          <CheckCircle2 className="h-4 w-4 text-green-400" />
                        ) : (
                          <Copy className="h-4 w-4 text-gray-400" />
                        )}
                      </Button>
                    </div>
                  </div>
                )}

                {summary.deployment?.runCommand && (
                  <div>
                    <p className="text-xs font-medium text-gray-500 mb-2 uppercase tracking-wide">
                      Run
                    </p>
                    <div className="relative group">
                      <pre className="bg-gray-900 text-green-400 p-3 rounded-lg font-mono text-sm overflow-x-auto">
                        {summary.deployment.runCommand}
                      </pre>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          summary.deployment?.runCommand &&
                          handleCopyKey(summary.deployment.runCommand)
                        }
                        className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity bg-gray-800 hover:bg-gray-700"
                        disabled={!summary.deployment?.runCommand}
                      >
                        {copiedKey === summary.deployment?.runCommand ? (
                          <CheckCircle2 className="h-4 w-4 text-green-400" />
                        ) : (
                          <Copy className="h-4 w-4 text-gray-400" />
                        )}
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Optimization Features */}
          {summary?.optimization?.features && summary.optimization.features.length > 0 && (
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Zap className="h-5 w-5 text-amber-600" />
                  <CardTitle>Optimizations</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {summary.optimization.features.map((feature, idx) => (
                    <div
                      key={idx}
                      className="flex items-start gap-2 p-2.5 rounded-lg bg-green-50 border border-green-200"
                    >
                      <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                      <span className="text-sm text-gray-700">{feature}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Build Time Optimizations */}
          {summary?.optimization?.buildTimeOptimizations &&
            summary.optimization.buildTimeOptimizations.length > 0 && (
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <Activity className="h-5 w-5 text-ocean-600" />
                    <CardTitle>Build Speed</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {summary.optimization.buildTimeOptimizations.map((opt, idx) => (
                      <li key={idx} className="flex items-start gap-2 text-sm text-gray-700">
                        <Zap className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
                        <span>{opt}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}

          {/* Recommendations */}
          {summary?.recommendations && summary.recommendations.length > 0 && (
            <Card className="border-amber-200 bg-amber-50">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <AlertCircle className="h-5 w-5 text-amber-600" />
                  <CardTitle className="text-amber-900">Recommendations</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {summary.recommendations.map((rec, idx) => (
                    <li key={idx} className="flex items-start gap-2 text-sm text-amber-900">
                      <CheckCircle2 className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
                      <span>{rec}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right Column - Deployment Guide */}
        {summary?.deployment?.instructions && (
          <div className="lg:row-span-4">
            <Card className="h-full">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <BookOpen className="h-5 w-5 text-ocean-600" />
                  <CardTitle>Deployment Guide</CardTitle>
                </div>
                <CardDescription>Follow these steps to deploy your application</CardDescription>
              </CardHeader>
              <CardContent className="prose prose-sm max-w-none">
                {summary.deployment?.instructions?.split('\n').map((line, idx) => {
                  const trimmedLine = line.trim();

                  // Skip empty lines
                  if (!trimmedLine) {
                    return <div key={idx} className="h-2" />;
                  }

                  // Handle headings
                  if (trimmedLine.startsWith('### ')) {
                    return (
                      <h3 key={idx} className="text-base font-semibold text-gray-900 mt-6 mb-2">
                        {trimmedLine.replace('### ', '')}
                      </h3>
                    );
                  }
                  if (trimmedLine.startsWith('## ')) {
                    return (
                      <h2 key={idx} className="text-lg font-semibold text-gray-900 mt-6 mb-3">
                        {trimmedLine.replace('## ', '')}
                      </h2>
                    );
                  }
                  if (trimmedLine.startsWith('# ')) {
                    return (
                      <h1 key={idx} className="text-xl font-bold text-gray-900 mt-6 mb-3">
                        {trimmedLine.replace('# ', '')}
                      </h1>
                    );
                  }

                  // Handle numbered lists
                  if (trimmedLine.match(/^\d+\.\s/)) {
                    return (
                      <div key={idx} className="flex gap-2 my-2">
                        <span className="font-semibold text-ocean-600">
                          {trimmedLine.match(/^\d+\./)?.[0]}
                        </span>
                        <span className="text-base text-gray-700 leading-relaxed flex-1">
                          {trimmedLine.replace(/^\d+\.\s/, '')}
                        </span>
                      </div>
                    );
                  }

                  // Handle bullet lists
                  if (trimmedLine.startsWith('- ') || trimmedLine.startsWith('* ')) {
                    return (
                      <div key={idx} className="flex gap-2 my-2 ml-4">
                        <span className="text-ocean-600 font-bold">•</span>
                        <span className="text-base text-gray-700 leading-relaxed flex-1">
                          {trimmedLine.substring(2)}
                        </span>
                      </div>
                    );
                  }

                  // Handle code blocks markers
                  if (trimmedLine.startsWith('```')) {
                    return null;
                  }

                  // Handle command lines
                  if (
                    trimmedLine.startsWith('$') ||
                    trimmedLine.match(/^(npm|yarn|pnpm|docker|git)\s/)
                  ) {
                    return (
                      <pre
                        key={idx}
                        className="bg-gray-900 text-green-400 p-3 rounded-lg font-mono text-sm my-3 overflow-x-auto border-l-4 border-green-500"
                      >
                        <code>{trimmedLine}</code>
                      </pre>
                    );
                  }

                  // Handle inline code with backticks
                  if (trimmedLine.includes('`')) {
                    const parts = trimmedLine.split(/`([^`]+)`/);
                    return (
                      <p key={idx} className="text-base text-gray-700 leading-relaxed my-2">
                        {parts.map((part, i) =>
                          i % 2 === 0 ? (
                            part
                          ) : (
                            <code
                              key={i}
                              className="text-xs font-mono bg-ocean-50 text-ocean-700 px-1.5 py-0.5 rounded font-semibold"
                            >
                              {part}
                            </code>
                          )
                        )}
                      </p>
                    );
                  }

                  // Handle bold text with **
                  if (trimmedLine.includes('**')) {
                    const parts = trimmedLine.split(/\*\*([^*]+)\*\*/);
                    return (
                      <p key={idx} className="text-base text-gray-700 leading-relaxed my-2">
                        {parts.map((part, i) =>
                          i % 2 === 0 ? (
                            part
                          ) : (
                            <strong key={i} className="font-semibold text-gray-900">
                              {part}
                            </strong>
                          )
                        )}
                      </p>
                    );
                  }

                  // Regular paragraphs
                  return (
                    <p key={idx} className="text-base text-gray-700 leading-relaxed my-2">
                      {trimmedLine}
                    </p>
                  );
                })}
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
