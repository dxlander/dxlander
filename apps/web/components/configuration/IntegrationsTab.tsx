'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ExternalLink, Database, Shield, Zap, Key, CheckCircle2, Copy } from 'lucide-react';

// Type definitions for integrations
interface Integration {
  name: string;
  type: string;
  detectedFrom: string;
  optional?: boolean;
  requiredKeys: string[];
  notes?: string;
}

interface IntegrationsSummary {
  integrations?: {
    detected?: Integration[];
  };
}

interface IntegrationsTabProps {
  summary: IntegrationsSummary | null;
  integrationsCount: number;
}

export function IntegrationsTab({ summary, integrationsCount }: IntegrationsTabProps) {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const handleCopyKey = (key: string) => {
    navigator.clipboard.writeText(key);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const getIntegrationIcon = (type: string) => {
    switch (type) {
      case 'database':
        return <Database className="h-4 w-4" />;
      case 'payment':
        return <Shield className="h-4 w-4" />;
      case 'ai':
        return <Zap className="h-4 w-4" />;
      case 'auth':
        return <Key className="h-4 w-4" />;
      default:
        return <ExternalLink className="h-4 w-4" />;
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ExternalLink className="h-5 w-5 text-ocean-600" />
            <h3 className="text-lg font-semibold">Third-Party Integrations</h3>
          </div>
          <Badge variant="outline">
            {integrationsCount} integration{integrationsCount !== 1 ? 's' : ''}
          </Badge>
        </div>
        <CardDescription>External services requiring credentials and API keys</CardDescription>
      </CardHeader>
      <CardContent>
        {summary?.integrations?.detected && summary.integrations.detected.length > 0 ? (
          <div className="space-y-4">
            {summary.integrations.detected.map((integration, idx) => (
              <div
                key={idx}
                className="border rounded-lg p-6 hover:border-ocean-300 transition-colors"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="p-3 rounded-lg bg-ocean-50 text-ocean-600">
                      {getIntegrationIcon(integration.type)}
                    </div>
                    <div>
                      <h4 className="font-semibold text-gray-900 text-lg">{integration.name}</h4>
                      <p className="text-sm text-gray-600 mt-0.5">
                        <span className="font-medium">Type:</span> {integration.type}
                      </p>
                      <p className="text-sm text-gray-600 mt-0.5">{integration.detectedFrom}</p>
                    </div>
                  </div>
                  <Badge variant={integration.optional ? 'secondary' : 'default'}>
                    {integration.optional ? 'Optional' : 'Required'}
                  </Badge>
                </div>

                <Separator className="my-4" />

                <div className="space-y-3">
                  <p className="text-sm font-semibold text-gray-900">
                    Required Environment Variables:
                  </p>
                  <div className="grid gap-2">
                    {integration.requiredKeys.map((key, keyIdx) => (
                      <div
                        key={keyIdx}
                        className="flex items-center gap-2 p-3 bg-gray-50 rounded border group hover:border-ocean-300 transition-colors"
                      >
                        <code className="text-sm font-mono flex-1 text-gray-900">{key}</code>
                        <Button variant="ghost" size="sm" onClick={() => handleCopyKey(key)}>
                          {copiedKey === key ? (
                            <CheckCircle2 className="h-4 w-4 text-green-600" />
                          ) : (
                            <Copy className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>

                {integration.notes && (
                  <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-100">
                    <p className="text-sm text-blue-900">{integration.notes}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <Card className="bg-gradient-to-br from-green-50 to-emerald-50 border-green-200">
            <CardContent className="text-center py-16">
              <div className="flex items-center justify-center mb-4">
                <div className="p-4 rounded-full bg-green-100">
                  <CheckCircle2 className="h-12 w-12 text-green-600" />
                </div>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                No External Integrations Detected
              </h3>
              <p className="text-sm text-gray-600 mb-1">
                This project is self-contained and doesn't require external services.
              </p>
              <p className="text-xs text-gray-500 mt-4">
                <strong>Note:</strong> Integrations are external services requiring API keys,
                tokens, or credentials (e.g., Supabase, Stripe, SendGrid). Built-in features like
                localStorage are not integrations.
              </p>
            </CardContent>
          </Card>
        )}
      </CardContent>
    </Card>
  );
}
