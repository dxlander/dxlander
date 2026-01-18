'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface EnvironmentVariable {
  key: string;
  value?: string;
  example?: string;
  description?: string;
  sensitive?: boolean;
  validation?: string;
}

interface ConfigMetadata {
  environmentVariables?: {
    required?: EnvironmentVariable[];
    optional?: EnvironmentVariable[];
  };
  ports?: Array<{ host: number; container: number; service?: string }>;
  services?: Array<{ name: string; image?: string; build?: boolean }>;
}

interface DeploymentSummaryProps {
  projectName: string;
  projectFramework?: string | null;
  projectLanguage?: string | null;
  configName: string;
  configVersion: number;
  metadata?: ConfigMetadata;
  platform: 'docker' | 'vercel' | 'railway';
  className?: string;
}

function isSensitiveKey(key: string): boolean {
  const sensitivePatterns = [
    'password',
    'secret',
    'key',
    'token',
    'auth',
    'credential',
    'api_key',
    'apikey',
    'private',
    'jwt',
  ];
  const lowerKey = key.toLowerCase();
  return sensitivePatterns.some((pattern) => lowerKey.includes(pattern));
}

function maskValue(value: string): string {
  if (!value || value.length <= 4) return '••••••••';
  return `${value.slice(0, 2)}••••••${value.slice(-2)}`;
}

function EnvVarRow({ envVar, index }: { envVar: EnvironmentVariable; index: number }) {
  const [showValue, setShowValue] = useState(false);
  const [copied, setCopied] = useState(false);

  const value = envVar.value || envVar.example || '';
  const isSensitive = envVar.sensitive || isSensitiveKey(envVar.key);
  const hasValue = !!value;
  const displayValue = showValue || !isSensitive ? value : maskValue(value);

  const handleCopy = async () => {
    if (value) {
      try {
        await navigator.clipboard.writeText(value);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      } catch {
        // Clipboard API may fail in non-secure contexts
      }
    }
  };

  return (
    <div
      className={cn(
        'flex items-center justify-between py-2 px-3 rounded-lg',
        index % 2 === 0 ? 'bg-gray-50' : 'bg-white'
      )}
    >
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <code className="text-sm font-semibold text-gray-900 truncate">{envVar.key}</code>
        {!hasValue && (
          <Badge variant="outline" className="text-xs text-amber-600 border-amber-300 bg-amber-50">
            Not set
          </Badge>
        )}
        {isSensitive && hasValue && (
          <Badge variant="outline" className="text-xs text-gray-500">
            Sensitive
          </Badge>
        )}
      </div>
      <div className="flex items-center gap-2 ml-4">
        {hasValue ? (
          <>
            <code className="text-sm text-gray-600 font-mono max-w-[200px] truncate">
              {displayValue}
            </code>
            {isSensitive && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs"
                onClick={() => setShowValue(!showValue)}
              >
                {showValue ? 'Hide' : 'Show'}
              </Button>
            )}
            <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={handleCopy}>
              {copied ? 'Copied' : 'Copy'}
            </Button>
          </>
        ) : (
          <span className="text-sm text-gray-400 italic">—</span>
        )}
      </div>
    </div>
  );
}

function PortMappingRow({
  port,
  index,
}: {
  port: { host: number; container: number; service?: string };
  index: number;
}) {
  return (
    <div
      className={cn(
        'flex items-center justify-between py-2 px-3 rounded-lg',
        index % 2 === 0 ? 'bg-gray-50' : 'bg-white'
      )}
    >
      <span className="text-sm">
        <span className="font-mono font-medium text-ocean-700">{port.host}</span>
        <span className="text-gray-400 mx-2">→</span>
        <span className="font-mono text-gray-600">{port.container}</span>
      </span>
      {port.service && (
        <Badge variant="secondary" className="text-xs">
          {port.service}
        </Badge>
      )}
    </div>
  );
}

export function DeploymentSummary({
  projectName,
  projectFramework,
  configName,
  configVersion,
  metadata,
  platform,
  className,
}: DeploymentSummaryProps) {
  const requiredEnvVars = metadata?.environmentVariables?.required || [];
  const optionalEnvVars = metadata?.environmentVariables?.optional || [];
  const allEnvVars = [...requiredEnvVars, ...optionalEnvVars];

  const missingRequiredVars = requiredEnvVars.filter((v) => !v.value && !v.example);
  const hasMissingVars = missingRequiredVars.length > 0;

  const ports = metadata?.ports || [];
  const services = metadata?.services || [];

  const getPlatformBadge = () => {
    switch (platform) {
      case 'docker':
        return <Badge className="bg-blue-100 text-blue-700 border-blue-300">Docker</Badge>;
      case 'vercel':
        return <Badge className="bg-black text-white">Vercel</Badge>;
      case 'railway':
        return <Badge className="bg-purple-100 text-purple-700 border-purple-300">Railway</Badge>;
    }
  };

  return (
    <div className={cn('space-y-4', className)}>
      {/* Header Card - Project & Config Overview */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="text-lg">Deployment Summary</CardTitle>
              <CardDescription className="mt-1">
                Review your deployment configuration before proceeding
              </CardDescription>
            </div>
            {getPlatformBadge()}
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="space-y-1">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Project</p>
              <p className="text-sm font-semibold text-gray-900">{projectName}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Framework</p>
              <p className="text-sm font-semibold text-gray-900">{projectFramework || 'Unknown'}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Config</p>
              <p className="text-sm font-semibold text-gray-900">{configName}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Version</p>
              <p className="text-sm font-semibold text-gray-900">v{configVersion}</p>
            </div>
          </div>

          {/* Warnings */}
          {hasMissingVars && (
            <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <p className="text-sm font-medium text-amber-800">
                {missingRequiredVars.length} required variable
                {missingRequiredVars.length > 1 ? 's' : ''} not configured
              </p>
              <p className="text-xs text-amber-700 mt-1">
                {missingRequiredVars.map((v) => v.key).join(', ')}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Environment Variables */}
      {allEnvVars.length > 0 && (
        <Card>
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CardTitle className="text-base">Environment Variables</CardTitle>
                <Badge variant="secondary">{allEnvVars.length}</Badge>
              </div>
              {requiredEnvVars.length > 0 && (
                <Badge variant="outline" className="text-xs">
                  {requiredEnvVars.length} required
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="space-y-1">
              {requiredEnvVars.length > 0 && (
                <div className="mb-3">
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
                    Required
                  </p>
                  <div className="space-y-1 rounded-lg overflow-hidden">
                    {requiredEnvVars.map((envVar, index) => (
                      <EnvVarRow key={envVar.key} envVar={envVar} index={index} />
                    ))}
                  </div>
                </div>
              )}
              {optionalEnvVars.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
                    Optional
                  </p>
                  <div className="space-y-1 rounded-lg overflow-hidden">
                    {optionalEnvVars.map((envVar, index) => (
                      <EnvVarRow key={envVar.key} envVar={envVar} index={index} />
                    ))}
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Ports & Services Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Port Mappings */}
        {ports.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <CardTitle className="text-base">Port Mappings</CardTitle>
                <Badge variant="secondary">{ports.length}</Badge>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="space-y-1 rounded-lg overflow-hidden">
                {ports.map((port, index) => (
                  <PortMappingRow key={index} port={port} index={index} />
                ))}
              </div>
              <p className="text-xs text-gray-500 mt-2">
                Access your app at http://localhost:{ports[0]?.host}
              </p>
            </CardContent>
          </Card>
        )}

        {/* Docker Services */}
        {services.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <CardTitle className="text-base">Services</CardTitle>
                <Badge variant="secondary">{services.length}</Badge>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="space-y-2">
                {services.map((service, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded-lg"
                  >
                    <span className="text-sm font-medium text-gray-900">{service.name}</span>
                    {service.build ? (
                      <Badge variant="outline" className="text-xs">
                        Build
                      </Badge>
                    ) : service.image ? (
                      <Badge variant="secondary" className="text-xs font-mono">
                        {service.image.split(':')[0]}
                      </Badge>
                    ) : null}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Show placeholder if no ports or services */}
        {ports.length === 0 && services.length === 0 && (
          <Card className="md:col-span-2">
            <CardContent className="py-8">
              <p className="text-center text-sm text-gray-500">
                Port and service information will be detected during deployment
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
