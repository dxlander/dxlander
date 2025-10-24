'use client'

import React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Server,
  Package,
  Code,
  Lock,
  Settings,
  AlertTriangle,
  CheckCircle2,
  TrendingUp,
  Zap,
  Key
} from 'lucide-react'
import { AnalysisResults as AnalysisResultsType } from '@/lib/mock-data'
import { cn } from '@/lib/utils'

interface AnalysisResultsProps {
  results: AnalysisResultsType
  className?: string
}

const InfoRow: React.FC<{ label: string; value: React.ReactNode }> = ({ label, value }) => (
  <div className="flex justify-between items-start py-2 border-b border-gray-100 last:border-0">
    <span className="text-sm text-gray-600">{label}</span>
    <span className="text-sm font-medium text-gray-900 text-right">{value}</span>
  </div>
)

const SectionCard: React.FC<{
  title: string
  icon: React.ReactNode
  children: React.ReactNode
  badge?: React.ReactNode
}> = ({ title, icon, children, badge }) => (
  <Card variant="default">
    <CardHeader>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="text-ocean-600">{icon}</div>
          <CardTitle className="text-base">{title}</CardTitle>
        </div>
        {badge}
      </div>
    </CardHeader>
    <CardContent>{children}</CardContent>
  </Card>
)

export const AnalysisResults: React.FC<AnalysisResultsProps> = ({ results, className }) => {
  const totalVulnerabilities =
    results.security.vulnerabilities.critical +
    results.security.vulnerabilities.high +
    results.security.vulnerabilities.moderate +
    results.security.vulnerabilities.low

  return (
    <div className={cn('space-y-6', className)}>
      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card variant="interactive">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl bg-ocean-50 text-ocean-600">
                <Server className="h-6 w-6" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Framework</p>
                <p className="text-lg font-semibold text-gray-900">{results.framework.name}</p>
                <p className="text-xs text-gray-500">{results.framework.version}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card variant="interactive">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl bg-purple-50 text-purple-600">
                <Code className="h-6 w-6" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Language</p>
                <p className="text-lg font-semibold text-gray-900">{results.language.primary}</p>
                <p className="text-xs text-gray-500">
                  {results.language.breakdown[results.language.primary]}%
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card variant="interactive">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl bg-green-50 text-green-600">
                <Package className="h-6 w-6" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Dependencies</p>
                <p className="text-lg font-semibold text-gray-900">
                  {results.dependencies.totalCount}
                </p>
                <p className="text-xs text-gray-500">{results.dependencies.totalSize}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card variant="interactive">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div
                className={cn(
                  'p-3 rounded-xl',
                  totalVulnerabilities === 0
                    ? 'bg-green-50 text-green-600'
                    : totalVulnerabilities < 3
                    ? 'bg-yellow-50 text-yellow-600'
                    : 'bg-red-50 text-red-600'
                )}
              >
                <Lock className="h-6 w-6" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Security</p>
                <p className="text-lg font-semibold text-gray-900">
                  {totalVulnerabilities === 0 ? 'Secure' : `${totalVulnerabilities} Issues`}
                </p>
                <p className="text-xs text-gray-500">
                  {totalVulnerabilities === 0 ? 'No vulnerabilities' : 'View details below'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Tabs */}
      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="w-full justify-start border-b rounded-none h-auto p-0 bg-transparent">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="dependencies">Dependencies</TabsTrigger>
          <TabsTrigger value="environment">Environment</TabsTrigger>
          <TabsTrigger value="security">Security</TabsTrigger>
          <TabsTrigger value="recommendations">Recommendations</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4 mt-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <SectionCard
              title="Framework Details"
              icon={<Server className="h-5 w-5" />}
              badge={
                <Badge variant="success">
                  {results.framework.confidence}% confidence
                </Badge>
              }
            >
              <div className="space-y-2">
                <InfoRow label="Name" value={results.framework.name} />
                <InfoRow label="Version" value={results.framework.version} />
                {results.framework.type && (
                  <InfoRow
                    label="Type"
                    value={
                      <Badge variant="secondary" className="capitalize">
                        {results.framework.type}
                      </Badge>
                    }
                  />
                )}
                <div className="pt-2">
                  <p className="text-xs text-gray-500 mb-2">Detected from:</p>
                  <div className="flex flex-wrap gap-1">
                    {results.framework.detectedFrom.map((source, idx) => (
                      <Badge key={idx} variant="secondary" className="text-xs">
                        {source}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>
            </SectionCard>

            <SectionCard
              title="Language Breakdown"
              icon={<Code className="h-5 w-5" />}
            >
              <div className="space-y-3">
                {Object.entries(results.language.breakdown).map(([lang, percentage]) => (
                  <div key={lang}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-600">{lang}</span>
                      <span className="font-medium text-gray-900">{percentage}%</span>
                    </div>
                    <Progress value={percentage} className="h-1.5" />
                  </div>
                ))}
              </div>
            </SectionCard>

            <SectionCard
              title="Runtime & Package Manager"
              icon={<Zap className="h-5 w-5" />}
            >
              <div className="space-y-2">
                <div>
                  <p className="text-xs text-gray-500 mb-1">Runtime</p>
                  <InfoRow label={results.runtime.name} value={results.runtime.version} />
                </div>
                <div className="pt-2">
                  <p className="text-xs text-gray-500 mb-1">Package Manager</p>
                  <InfoRow
                    label={results.packageManager.name}
                    value={results.packageManager.version || 'Latest'}
                  />
                </div>
              </div>
            </SectionCard>

            <SectionCard
              title="Build Configuration"
              icon={<Settings className="h-5 w-5" />}
            >
              <div className="space-y-2">
                <InfoRow label="Build Command" value={<code className="text-xs bg-gray-100 px-2 py-1 rounded">{results.buildConfig.buildCommand}</code>} />
                <InfoRow label="Start Command" value={<code className="text-xs bg-gray-100 px-2 py-1 rounded">{results.buildConfig.startCommand}</code>} />
                <InfoRow label="Port" value={results.buildConfig.port} />
                <InfoRow label="Output Directory" value={results.buildConfig.outputDirectory} />
              </div>
            </SectionCard>
          </div>
        </TabsContent>

        <TabsContent value="dependencies" className="space-y-4 mt-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <SectionCard
              title="Production Dependencies"
              icon={<Package className="h-5 w-5" />}
              badge={<Badge>{results.dependencies.production.length} packages</Badge>}
            >
              <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2">
                {results.dependencies.production.map((dep, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-2 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900">{dep.name}</p>
                      <p className="text-xs text-gray-500">{dep.version}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {dep.size && (
                        <span className="text-xs text-gray-500">{dep.size}</span>
                      )}
                      {dep.risk && (
                        <Badge
                          variant={
                            dep.risk === 'low'
                              ? 'success'
                              : dep.risk === 'medium'
                              ? 'warning'
                              : 'destructive'
                          }
                          className="text-xs"
                        >
                          {dep.risk}
                        </Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </SectionCard>

            <SectionCard
              title="Development Dependencies"
              icon={<Package className="h-5 w-5" />}
              badge={<Badge variant="secondary">{results.dependencies.development.length} packages</Badge>}
            >
              <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2">
                {results.dependencies.development.map((dep, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-2 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900">{dep.name}</p>
                      <p className="text-xs text-gray-500">{dep.version}</p>
                    </div>
                    {dep.size && (
                      <span className="text-xs text-gray-500">{dep.size}</span>
                    )}
                  </div>
                ))}
              </div>
            </SectionCard>
          </div>
        </TabsContent>

        <TabsContent value="environment" className="space-y-4 mt-6">
          <SectionCard
            title="Environment Variables"
            icon={<Key className="h-5 w-5" />}
            badge={<Badge>{results.environmentVariables.length} variables</Badge>}
          >
            <div className="space-y-4">
              {results.environmentVariables.map((envVar, idx) => (
                <div
                  key={idx}
                  className="p-4 rounded-xl border border-gray-200 hover:border-ocean-200 hover:bg-ocean-50/20 transition-all"
                >
                  <div className="flex items-start justify-between mb-2">
                    <code className="text-sm font-semibold text-ocean-600">{envVar.key}</code>
                    <div className="flex gap-2">
                      {envVar.required && (
                        <Badge variant="destructive" className="text-xs">
                          Required
                        </Badge>
                      )}
                      <Badge variant="secondary" className="text-xs capitalize">
                        {envVar.type.replace('_', ' ')}
                      </Badge>
                    </div>
                  </div>
                  <p className="text-sm text-gray-700 mb-2">{envVar.description}</p>
                  <div className="bg-gray-50 p-2 rounded-lg mb-2">
                    <code className="text-xs text-gray-600">{envVar.example}</code>
                  </div>
                  <div className="flex flex-wrap gap-1 mb-1">
                    <span className="text-xs text-gray-500">Detected in:</span>
                    {envVar.detectedIn.map((file, i) => (
                      <Badge key={i} variant="secondary" className="text-xs">
                        {file}
                      </Badge>
                    ))}
                  </div>
                  {envVar.feature && (
                    <Badge variant="default" className="text-xs mt-2">
                      {envVar.feature}
                    </Badge>
                  )}
                </div>
              ))}
            </div>
          </SectionCard>
        </TabsContent>

        <TabsContent value="security" className="space-y-4 mt-6">
          <SectionCard
            title="Security Overview"
            icon={<Lock className="h-5 w-5" />}
            badge={
              totalVulnerabilities === 0 ? (
                <Badge variant="success">Secure</Badge>
              ) : (
                <Badge variant="destructive">{totalVulnerabilities} Issues</Badge>
              )
            }
          >
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
              <div className="text-center p-3 rounded-xl bg-red-50">
                <p className="text-2xl font-bold text-red-600">
                  {results.security.vulnerabilities.critical}
                </p>
                <p className="text-xs text-red-700">Critical</p>
              </div>
              <div className="text-center p-3 rounded-xl bg-orange-50">
                <p className="text-2xl font-bold text-orange-600">
                  {results.security.vulnerabilities.high}
                </p>
                <p className="text-xs text-orange-700">High</p>
              </div>
              <div className="text-center p-3 rounded-xl bg-yellow-50">
                <p className="text-2xl font-bold text-yellow-600">
                  {results.security.vulnerabilities.moderate}
                </p>
                <p className="text-xs text-yellow-700">Moderate</p>
              </div>
              <div className="text-center p-3 rounded-xl bg-green-50">
                <p className="text-2xl font-bold text-green-600">
                  {results.security.vulnerabilities.low}
                </p>
                <p className="text-xs text-green-700">Low</p>
              </div>
            </div>

            {results.security.notices.length > 0 && (
              <div className="space-y-3">
                <h5 className="text-sm font-semibold text-gray-900">Security Notices</h5>
                {results.security.notices.map((notice, idx) => (
                  <div
                    key={idx}
                    className="p-4 rounded-xl border-2 border-orange-200 bg-orange-50/50"
                  >
                    <div className="flex items-start gap-3">
                      <AlertTriangle className="h-5 w-5 text-orange-600 flex-shrink-0 mt-0.5" />
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant="warning" className="capitalize">
                            {notice.severity}
                          </Badge>
                          {notice.cvss && (
                            <span className="text-xs text-gray-600">CVSS: {notice.cvss}</span>
                          )}
                        </div>
                        <p className="text-sm font-medium text-gray-900 mb-1">
                          {notice.package} {notice.version}
                        </p>
                        <p className="text-sm text-gray-700 mb-2">{notice.issue}</p>
                        <p className="text-sm text-green-700 font-medium">
                          → {notice.recommendation}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>
        </TabsContent>

        <TabsContent value="recommendations" className="space-y-4 mt-6">
          <div className="space-y-4">
            {results.recommendations.excellent.length > 0 && (
              <SectionCard
                title="Excellent Practices"
                icon={<CheckCircle2 className="h-5 w-5 text-green-600" />}
                badge={<Badge variant="success">{results.recommendations.excellent.length}</Badge>}
              >
                <div className="space-y-3">
                  {results.recommendations.excellent.map((rec, idx) => (
                    <div
                      key={idx}
                      className="p-3 rounded-xl bg-green-50 border border-green-200"
                    >
                      <div className="flex items-start gap-2">
                        <CheckCircle2 className="h-4 w-4 text-green-600 flex-shrink-0 mt-0.5" />
                        <div>
                          <p className="text-sm font-medium text-gray-900">{rec.title}</p>
                          <p className="text-sm text-gray-600 mt-1">{rec.description}</p>
                          <Badge variant="success" className="mt-2 text-xs capitalize">
                            {rec.impact} impact
                          </Badge>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </SectionCard>
            )}

            {results.recommendations.improvements.length > 0 && (
              <SectionCard
                title="Suggested Improvements"
                icon={<TrendingUp className="h-5 w-5 text-ocean-600" />}
                badge={<Badge>{results.recommendations.improvements.length}</Badge>}
              >
                <div className="space-y-3">
                  {results.recommendations.improvements.map((rec, idx) => (
                    <div
                      key={idx}
                      className="p-4 rounded-xl bg-ocean-50/50 border border-ocean-200"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <p className="text-sm font-medium text-gray-900">{rec.title}</p>
                        <div className="flex gap-2">
                          {rec.difficulty && (
                            <Badge variant="secondary" className="text-xs capitalize">
                              {rec.difficulty}
                            </Badge>
                          )}
                          {rec.estimatedTime && (
                            <Badge variant="secondary" className="text-xs">
                              {rec.estimatedTime}
                            </Badge>
                          )}
                        </div>
                      </div>
                      <p className="text-sm text-gray-600 mb-2">{rec.description}</p>
                      <Badge variant="default" className="text-xs capitalize mb-2">
                        {rec.impact} impact
                      </Badge>
                      {rec.code && (
                        <pre className="bg-gray-900 text-gray-100 p-3 rounded-lg text-xs overflow-x-auto mt-3">
                          <code>{rec.code}</code>
                        </pre>
                      )}
                    </div>
                  ))}
                </div>
              </SectionCard>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
