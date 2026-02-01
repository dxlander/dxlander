'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Package, AlertTriangle, Shield, Code, PackageOpen } from 'lucide-react';

// Type definitions for dependencies
interface Dependency {
  name?: string;
  version?: string;
  purpose?: string;
}

interface SecuritySummary {
  vulnerabilityWarnings?: string[];
}

interface DependenciesSummary {
  dependencies?: {
    production?: Array<Dependency | string>;
    development?: Array<Dependency | string>;
    outdatedWarnings?: string[];
    totalCount?: number;
  };
  security?: SecuritySummary;
}

interface DependenciesTabProps {
  summary: DependenciesSummary | null;
}

export function DependenciesTab({ summary }: DependenciesTabProps) {
  const productionDeps = summary?.dependencies?.production || [];
  const devDeps = summary?.dependencies?.development || [];
  const hasOutdatedWarnings =
    summary?.dependencies?.outdatedWarnings && summary.dependencies.outdatedWarnings.length > 0;
  const hasSecurityWarnings =
    summary?.security?.vulnerabilityWarnings && summary.security.vulnerabilityWarnings.length > 0;

  return (
    <div className="space-y-6">
      {/* Outdated/Security Warnings */}
      {hasOutdatedWarnings && (
        <Alert variant="warning">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Package Issues Detected</AlertTitle>
          <AlertDescription>
            <ul className="mt-2 space-y-1">
              {summary.dependencies?.outdatedWarnings?.map((warning, idx) => (
                <li key={idx} className="text-sm">
                  • {warning}
                </li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      {hasSecurityWarnings && (
        <Alert variant="destructive">
          <Shield className="h-4 w-4" />
          <AlertTitle>Security Vulnerabilities</AlertTitle>
          <AlertDescription>
            <ul className="mt-2 space-y-1">
              {summary.security?.vulnerabilityWarnings?.map((warning, idx) => (
                <li key={idx} className="text-sm">
                  • {warning}
                </li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      {/* Production Dependencies */}
      {productionDeps.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Package className="h-5 w-5 text-ocean-600" />
                <CardTitle>Production Dependencies</CardTitle>
              </div>
              <Badge variant="outline">{productionDeps.length} packages</Badge>
            </div>
            <CardDescription>Runtime dependencies required for your application</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Package</TableHead>
                  <TableHead>Version</TableHead>
                  <TableHead>Purpose</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {productionDeps.map((dep, idx) => {
                  const depObj = typeof dep === 'string' ? { name: dep } : dep;
                  return (
                    <TableRow key={idx}>
                      <TableCell className="font-mono text-sm">{depObj.name || '-'}</TableCell>
                      <TableCell className="text-sm">{depObj.version || '-'}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {depObj.purpose || '-'}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Development Dependencies */}
      {devDeps.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Code className="h-5 w-5 text-purple-600" />
                <CardTitle>Development Dependencies</CardTitle>
              </div>
              <Badge variant="outline">{devDeps.length} packages</Badge>
            </div>
            <CardDescription>Development tools and build dependencies</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Package</TableHead>
                  <TableHead>Version</TableHead>
                  <TableHead>Purpose</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {devDeps.map((dep, idx) => {
                  const depObj = typeof dep === 'string' ? { name: dep } : dep;
                  return (
                    <TableRow key={idx}>
                      <TableCell className="font-mono text-sm">{depObj.name || '-'}</TableCell>
                      <TableCell className="text-sm">{depObj.version || '-'}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {depObj.purpose || '-'}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Summary Stats */}
      {summary?.dependencies && (
        <div className="grid grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Total Packages</p>
                  <p className="text-3xl font-bold text-foreground mt-1">
                    {summary.dependencies.totalCount || 0}
                  </p>
                </div>
                <PackageOpen className="h-10 w-10 text-ocean-500" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Outdated</p>
                  <p className="text-3xl font-bold text-amber-600 mt-1">
                    {summary.dependencies.outdatedWarnings?.length || 0}
                  </p>
                </div>
                <AlertTriangle className="h-10 w-10 text-amber-500" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Vulnerabilities</p>
                  <p className="text-3xl font-bold text-red-600 mt-1">
                    {summary.security?.vulnerabilityWarnings?.length || 0}
                  </p>
                </div>
                <Shield className="h-10 w-10 text-red-500" />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Empty State */}
      {!summary?.dependencies && (
        <Card>
          <CardContent className="text-center py-16">
            <PackageOpen className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium text-foreground mb-2">No Dependency Information</h3>
            <p className="text-sm text-muted-foreground">
              Dependency analysis not available for this configuration
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
