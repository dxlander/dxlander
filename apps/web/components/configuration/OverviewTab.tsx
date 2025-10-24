'use client'

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Progress } from '@/components/ui/progress'
import {
  Info,
  Package,
  Zap,
  Settings,
  Server,
  Code,
  Activity,
  AlertCircle,
  CheckCircle2,
  FileCode,
  Key,
  ExternalLink
} from 'lucide-react'

// Type definitions for project summary structure
interface ProjectSummary {
  overview: string
  framework: string
  runtime: string
  buildTool: string
  isMultiService: boolean
  services?: string[]
}

interface BuiltInCapability {
  name: string
  description?: string
}

interface LanguageBreakdown {
  [language: string]: number
}

interface Language {
  primary: string
  breakdown: LanguageBreakdown
}

interface ProjectStructure {
  sourceDirectory?: string
  testDirectory?: string
  hasTests: boolean
  hasDocumentation: boolean
}

interface ConfigSummary {
  projectSummary?: ProjectSummary
  builtInCapabilities?: BuiltInCapability[]
  language?: Language
  projectStructure?: ProjectStructure
  recommendations?: string[]
  dependencies?: {
    totalCount: number
  }
  integrations?: {
    detected: Array<{
      name: string
      type: string
      description: string
    }>
  }
}

interface OverviewTabProps {
  summary: ConfigSummary | null
  configFilesCount: number
  totalEnvCount: number
  requiredEnvCount: number
  integrationsCount: number
}

export function OverviewTab({
  summary,
  configFilesCount,
  totalEnvCount,
  requiredEnvCount,
  integrationsCount
}: OverviewTabProps) {
  return (
    <div className="space-y-6">
      {/* Project Summary */}
      {summary?.projectSummary && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Info className="h-5 w-5 text-ocean-600" />
              <CardTitle>Project Information</CardTitle>
            </div>
            <CardDescription>{summary.projectSummary.overview}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="space-y-2">
                <p className="text-sm font-medium text-gray-500">Framework</p>
                <div className="flex items-center gap-2">
                  <Package className="h-4 w-4 text-ocean-600" />
                  <p className="text-base font-semibold text-gray-900">{summary.projectSummary.framework}</p>
                </div>
              </div>
              <div className="space-y-2">
                <p className="text-sm font-medium text-gray-500">Runtime</p>
                <div className="flex items-center gap-2">
                  <Zap className="h-4 w-4 text-ocean-600" />
                  <p className="text-base font-semibold text-gray-900">{summary.projectSummary.runtime}</p>
                </div>
              </div>
              <div className="space-y-2">
                <p className="text-sm font-medium text-gray-500">Build Tool</p>
                <div className="flex items-center gap-2">
                  <Settings className="h-4 w-4 text-ocean-600" />
                  <p className="text-base font-semibold text-gray-900">{summary.projectSummary.buildTool}</p>
                </div>
              </div>
              <div className="space-y-2">
                <p className="text-sm font-medium text-gray-500">Architecture</p>
                <div className="flex items-center gap-2">
                  <Server className="h-4 w-4 text-ocean-600" />
                  <p className="text-base font-semibold text-gray-900">
                    {summary.projectSummary.isMultiService ? 'Multi-Service' : 'Single Service'}
                  </p>
                </div>
              </div>
            </div>

            {summary.projectSummary.services && summary.projectSummary.services.length > 0 && (
              <>
                <Separator className="my-6" />
                <div>
                  <p className="text-sm font-medium text-gray-700 mb-3">Services</p>
                  <div className="flex flex-wrap gap-2">
                    {summary.projectSummary.services.map((service: string, idx: number) => (
                      <Badge key={idx} variant="outline" className="flex items-center gap-1.5 py-1.5 px-3">
                        <Server className="h-3.5 w-3.5" />
                        {service}
                      </Badge>
                    ))}
                  </div>
                </div>
              </>
            )}

            {summary.builtInCapabilities && summary.builtInCapabilities.length > 0 && (
              <>
                <Separator className="my-6" />
                <div>
                  <p className="text-sm font-medium text-gray-700 mb-3">Built-in Features</p>
                  <div className="flex flex-wrap gap-2">
                    {summary.builtInCapabilities.map((capability: any, idx: number) => (
                      <Badge key={idx} variant="secondary" className="flex items-center gap-1.5 py-1.5 px-3 bg-gray-100 text-gray-700">
                        <Package className="h-3.5 w-3.5" />
                        {capability.name}
                      </Badge>
                    ))}
                  </div>
                </div>
              </>
            )}

            {/* Language Breakdown */}
            {summary.language && summary.language.breakdown && (
              <>
                <Separator className="my-6" />
                <div>
                  <p className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
                    <Code className="h-4 w-4" />
                    Language Breakdown
                  </p>
                  <div className="space-y-3">
                    {Object.entries(summary.language.breakdown).map(([lang, percent]: [string, any]) => (
                      <div key={lang} className="space-y-1">
                        <div className="flex justify-between text-sm">
                          <span className="font-medium text-gray-700">{lang}</span>
                          <span className="text-gray-600">{percent}%</span>
                        </div>
                        <Progress value={percent} className="h-2" />
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}

            {/* Project Structure */}
            {summary.projectStructure && (
              <>
                <Separator className="my-6" />
                <div>
                  <p className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
                    <Activity className="h-4 w-4" />
                    Project Structure
                  </p>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    {summary.projectStructure.sourceDirectory && (
                      <div className="flex items-center gap-2">
                        <span className="text-gray-500">Source:</span>
                        <code className="text-xs font-mono bg-gray-100 px-2 py-0.5 rounded">
                          {summary.projectStructure.sourceDirectory}
                        </code>
                      </div>
                    )}
                    {summary.projectStructure.testDirectory && (
                      <div className="flex items-center gap-2">
                        <span className="text-gray-500">Tests:</span>
                        <code className="text-xs font-mono bg-gray-100 px-2 py-0.5 rounded">
                          {summary.projectStructure.testDirectory}
                        </code>
                      </div>
                    )}
                    <div className="flex items-center gap-2">
                      <span className="text-gray-500">Tests:</span>
                      {summary.projectStructure.hasTests ? (
                        <Badge variant="success" className="text-xs">✓ Yes</Badge>
                      ) : (
                        <Badge variant="secondary" className="text-xs">✗ No</Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-gray-500">Docs:</span>
                      {summary.projectStructure.hasDocumentation ? (
                        <Badge variant="success" className="text-xs">✓ Yes</Badge>
                      ) : (
                        <Badge variant="secondary" className="text-xs">✗ No</Badge>
                      )}
                    </div>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* Configuration Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">Config Files</p>
                <p className="text-3xl font-bold text-gray-900 mt-1">{configFilesCount}</p>
              </div>
              <FileCode className="h-10 w-10 text-ocean-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">Environment Variables</p>
                <p className="text-3xl font-bold text-gray-900 mt-1">{totalEnvCount}</p>
                {requiredEnvCount > 0 && (
                  <p className="text-xs text-amber-600 mt-1">{requiredEnvCount} required</p>
                )}
              </div>
              <Key className="h-10 w-10 text-purple-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">Integrations</p>
                <p className="text-3xl font-bold text-gray-900 mt-1">{integrationsCount}</p>
                {integrationsCount > 0 && (
                  <p className="text-xs text-blue-600 mt-1">External services</p>
                )}
              </div>
              <ExternalLink className="h-10 w-10 text-blue-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recommendations */}
      {summary?.recommendations && summary.recommendations.length > 0 && (
        <Card className="border-amber-200 bg-amber-50">
          <CardHeader>
            <div className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-amber-600" />
              <CardTitle className="text-amber-900">Recommendations</CardTitle>
            </div>
            <CardDescription className="text-amber-700">
              Important suggestions for your deployment configuration
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3">
              {summary.recommendations.map((rec: string, idx: number) => (
                <li key={idx} className="flex items-start gap-3 text-sm text-amber-900">
                  <CheckCircle2 className="h-5 w-5 mt-0.5 flex-shrink-0 text-amber-600" />
                  <span>{rec}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
